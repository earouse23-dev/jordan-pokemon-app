import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCardGuideGeometry,
  cardCameraConstraints,
  configureCardCamera,
  detectCardBoundaryFromPixels,
  detectDocumentBoundaryFromPixels,
  documentBoundsFromCorners,
  documentRecognitionRegions,
  evaluatePsa10Centering,
  mapDocumentCornersToDisplay,
  measurePrintedBorderCentering,
  measureDeviceLevel,
  normalizedCardCrop,
  rectifyDocumentPixels,
  scoreGradeableCameraFrame,
  shouldKeepCameraFrame,
  summarizeGradeableFrameSequence,
} from "../lib/capture-precision.js";

function syntheticDocument(
  width,
  height,
  corners,
  { background = [36, 52, 44], document = [220, 210, 184] } = {},
) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const polygon = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];
  const inside = (x, y) => {
    let result = false;
    for (
      let index = 0, prior = polygon.length - 1;
      index < polygon.length;
      prior = index++
    ) {
      const left = polygon[index];
      const right = polygon[prior];
      if (
        left.y > y !== right.y > y &&
        x < ((right.x - left.x) * (y - left.y)) / (right.y - left.y) + left.x
      )
        result = !result;
    }
    return result;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const color = inside(x + 0.5, y + 0.5) ? document : background;
      pixels.set([...color, 255], offset);
    }
  }
  return pixels;
}

test("switching camera retains the detailed capture resolution request", () => {
  const initial = cardCameraConstraints();
  const switched = cardCameraConstraints("rear-camera");
  assert.equal(initial.audio, false);
  assert.deepEqual(initial.video.facingMode, { ideal: "environment" });
  assert.deepEqual(switched.video.deviceId, { exact: "rear-camera" });
  assert.deepEqual(switched.video.width, initial.video.width);
  assert.deepEqual(switched.video.height, initial.video.height);
  assert.equal(switched.video.facingMode, undefined);
});

test("camera tuning uses only reported continuous controls and survives rejected options", async () => {
  const attempts = [];
  const applied = await configureCardCamera({
    getCapabilities: () => ({
      focusMode: ["continuous"],
      exposureMode: ["continuous"],
      whiteBalanceMode: ["manual"],
    }),
    applyConstraints: async (value) => {
      attempts.push(value);
      if (value.advanced[0].exposureMode)
        throw new Error("unsupported at runtime");
    },
  });
  assert.deepEqual(applied, ["focusMode"]);
  assert.equal(attempts.length, 2);
  assert.deepEqual(await configureCardCamera({}), []);
  assert.deepEqual(
    await configureCardCamera({
      getCapabilities: () => {
        throw new Error("unavailable");
      },
    }),
    [],
  );
});

test("a higher score cannot replace a usable frame with one failing capture checks", () => {
  assert.equal(
    shouldKeepCameraFrame({ gradeable: false, score: 0.99 }, 0.8),
    false,
  );
  assert.equal(
    shouldKeepCameraFrame({ gradeable: true, score: 0.81 }, 0.8),
    true,
  );
  assert.equal(
    shouldKeepCameraFrame({ gradeable: true, score: 0.79 }, 0.8),
    false,
  );
  assert.equal(shouldKeepCameraFrame({ gradeable: true, score: NaN }), false);
  assert.equal(shouldKeepCameraFrame({ gradeable: true, score: 0.8 }), true);
});

test("card isolation excludes a disconnected table scratch", () => {
  const width = 126;
  const height = 176;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 42;
    pixels[index + 1] = 58;
    pixels[index + 2] = 48;
    pixels[index + 3] = 255;
  }
  for (let y = 18; y < 158; y += 1) {
    for (let x = 13; x < 113; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = 218;
      pixels[index + 1] = 205;
      pixels[index + 2] = 176;
    }
  }
  // A bright table scratch sits outside the card and must not expand its crop.
  for (let x = 2; x < 52; x += 1) {
    const index = (8 * width + x) * 4;
    pixels[index] = 245;
    pixels[index + 1] = 245;
    pixels[index + 2] = 245;
  }
  const result = detectCardBoundaryFromPixels(pixels, width, height);
  assert.equal(result.detected, true);
  assert.equal(result.backgroundExcluded, true);
  assert.ok(result.bounds.y > 0.05);
  assert.ok(result.bounds.width < 0.9);
});

test("document detection and rectification handle skew, rotation, and display mapping", () => {
  const width = 180;
  const height = 140;
  const corners = {
    topLeft: { x: 35, y: 18 },
    topRight: { x: 151, y: 34 },
    bottomRight: { x: 137, y: 119 },
    bottomLeft: { x: 22, y: 101 },
  };
  const pixels = syntheticDocument(width, height, corners);
  const detected = detectDocumentBoundaryFromPixels(pixels, width, height);
  assert.equal(detected.detected, true);
  assert.equal(detected.correctable, true);
  assert.equal(detected.documentKind, "card");
  assert.ok(detected.perspectiveDelta > 0.01);

  const corrected = rectifyDocumentPixels(pixels, width, height, detected);
  assert.equal(corrected.corrected, true);
  assert.ok(corrected.height > corrected.width);
  assert.equal(corrected.transform.photometricChanges, false);
  const middle =
    (Math.floor(corrected.height / 2) * corrected.width +
      Math.floor(corrected.width / 2)) *
    4;
  assert.ok(corrected.pixels[middle] > 180);

  const mapped = mapDocumentCornersToDisplay(
    detected.corners,
    width,
    height,
    390,
    300,
    { fit: "cover", mirrored: true },
  );
  assert.equal(mapped.length, 4);
  assert.ok(mapped.every((point) => Number.isFinite(point.x + point.y)));
  assert.ok(mapped[0].x > mapped[1].x);
});

test("edited corners define a protective source evidence envelope", () => {
  const bounds = documentBoundsFromCorners({
    topLeft: { x: 0.08, y: 0.1 },
    topRight: { x: 0.8, y: 0.12 },
    bottomRight: { x: 0.83, y: 0.9 },
    bottomLeft: { x: 0.16, y: 0.88 },
  });
  assert.ok(bounds.x < 0.08);
  assert.ok(bounds.y < 0.1);
  assert.ok(bounds.x + bounds.width > 0.83);
  assert.ok(bounds.y + bounds.height > 0.9);
  assert.equal(documentBoundsFromCorners(null), null);
});

test("slab correction retains full label and card regions", () => {
  const width = 160;
  const height = 240;
  const corners = {
    topLeft: { x: 27, y: 13 },
    topRight: { x: 129, y: 20 },
    bottomRight: { x: 140, y: 224 },
    bottomLeft: { x: 17, y: 216 },
  };
  const pixels = syntheticDocument(width, height, corners, {
    document: [200, 200, 200],
  });
  // Synthetic label and card colors are evidence that both areas survive the
  // same full-slab projective correction.
  for (let y = 32; y < 67; y += 1)
    for (let x = 40; x < 120; x += 1) {
      const offset = (y * width + x) * 4;
      pixels.set([238, 64, 64, 255], offset);
    }
  for (let y = 83; y < 205; y += 1)
    for (let x = 45; x < 116; x += 1) {
      const offset = (y * width + x) * 4;
      pixels.set([60, 104, 226, 255], offset);
    }
  const detected = detectDocumentBoundaryFromPixels(pixels, width, height);
  assert.equal(detected.detected, true);
  assert.equal(detected.documentKind, "slab");
  const corrected = rectifyDocumentPixels(pixels, width, height, detected);
  assert.equal(corrected.corrected, true);
  const regions = documentRecognitionRegions("slab");
  assert.ok(regions.label.y + regions.label.height < regions.card.y + 0.1);
  assert.deepEqual(regions.full, { x: 0, y: 0, width: 1, height: 1 });
  const colors = new Set();
  for (let index = 0; index < corrected.pixels.length; index += 4) {
    const red = corrected.pixels[index];
    const blue = corrected.pixels[index + 2];
    if (red > 210 && blue < 100) colors.add("label");
    if (blue > 180 && red < 100) colors.add("card");
  }
  assert.deepEqual([...colors].sort(), ["card", "label"]);
});

test("document capture rejects clipped, multiple, and invalid geometry conservatively", () => {
  const clipped = syntheticDocument(120, 160, {
    topLeft: { x: 0, y: 12 },
    topRight: { x: 91, y: 12 },
    bottomRight: { x: 91, y: 148 },
    bottomLeft: { x: 0, y: 148 },
  });
  assert.equal(
    detectDocumentBoundaryFromPixels(clipped, 120, 160).reason,
    "document_clipped",
  );

  const multiple = new Uint8ClampedArray(220 * 160 * 4);
  for (let index = 0; index < multiple.length; index += 4)
    multiple.set([28, 42, 34, 255], index);
  for (const [startX, endX] of [
    [12, 92],
    [126, 206],
  ])
    for (let y = 20; y < 140; y += 1)
      for (let x = startX; x < endX; x += 1)
        multiple.set([218, 205, 178, 255], (y * 220 + x) * 4);
  assert.equal(
    detectDocumentBoundaryFromPixels(multiple, 220, 160).reason,
    "multiple_documents",
  );
  assert.equal(
    rectifyDocumentPixels(multiple, 220, 160, null).reason,
    "document_geometry_unavailable",
  );
  assert.equal(
    rectifyDocumentPixels(multiple, 220, 160, {
      detected: true,
      corners: {
        topLeft: { x: 0.2, y: 0.2 },
        topRight: { x: 0.8, y: 0.8 },
        bottomRight: { x: 0.8, y: 0.2 },
        bottomLeft: { x: 0.2, y: 0.8 },
      },
    }).reason,
    "document_corners_invalid",
  );
});

test("document detection tolerates a patterned low-contrast mat", () => {
  const width = 126;
  const height = 176;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const shade = (x + y) % 8;
      pixels.set([48 + shade, 61 + shade, 52 + shade, 255], offset);
    }
  for (let y = 17; y < 159; y += 1)
    for (let x = 13; x < 113; x += 1)
      pixels.set([84, 96, 86, 255], (y * width + x) * 4);
  const detected = detectDocumentBoundaryFromPixels(pixels, width, height);
  assert.equal(detected.detected, true);
  assert.equal(detected.documentKind, "card");
});

test("device level uses gravity and honors screen rotation", () => {
  const flat = measureDeviceLevel({ x: 0.1, y: -0.1, z: 9.8 });
  assert.equal(flat.available, true);
  assert.equal(flat.level, true);
  assert.ok(flat.tiltDegrees < 2);

  const tilted = measureDeviceLevel({ x: 2.3, y: 0, z: 9.4 });
  assert.equal(tilted.available, true);
  assert.equal(tilted.level, false);
  assert.ok(tilted.tiltDegrees > 10);

  const landscape = measureDeviceLevel({ x: 0.2, y: 0.1, z: -9.8 }, 90);
  assert.equal(landscape.level, true);
});

test("card guide geometry accepts a complete straight rectangle", () => {
  const width = 126;
  const height = 176;
  const gray = new Uint8Array(width * height).fill(25);
  for (let y = 8; y < height - 8; y += 1) {
    for (let x = 6; x < width - 6; x += 1) gray[y * width + x] = 210;
  }
  const result = analyzeCardGuideGeometry(gray, width, height);
  assert.equal(result.detected, true);
  assert.equal(result.straight, true);
  assert.ok(result.confidence > 0.5);
  assert.ok(result.perspectiveDelta < 0.02);
});

test("card guide geometry rejects trapezoidal perspective", () => {
  const width = 126;
  const height = 176;
  const gray = new Uint8Array(width * height).fill(20);
  for (let y = 8; y < height - 8; y += 1) {
    const progress = (y - 8) / (height - 16);
    const inset = Math.round(18 - progress * 12);
    for (let x = inset; x < width - inset; x += 1) gray[y * width + x] = 220;
  }
  const result = analyzeCardGuideGeometry(gray, width, height);
  assert.equal(result.detected, true);
  assert.equal(result.straight, false);
  assert.ok(result.perspectiveDelta > 0.06);
});

test("printed-border centering measures a consistent normalized border", () => {
  const width = 180;
  const height = 252;
  const gray = new Uint8Array(width * height).fill(232);
  for (let y = 14; y < height - 10; y += 1)
    for (let x = 12; x < width - 8; x += 1) gray[y * width + x] = 62;
  const result = measurePrintedBorderCentering(gray, width, height);
  assert.equal(result.measurable, true);
  assert.ok(result.leftRight.first > result.leftRight.second);
  assert.ok(result.topBottom.first > result.topBottom.second);
  assert.match(result.method, /gradient/);
});

test("printed-border centering abstains when no stable border is visible", () => {
  const width = 180;
  const height = 252;
  const gray = new Uint8Array(width * height).fill(128);
  const result = measurePrintedBorderCentering(gray, width, height);
  assert.equal(result.measurable, false);
  assert.equal(result.confidence, 0);
});

test("PSA 10 centering guidance uses the published front and back limits", () => {
  const measured = (first) => ({
    measurable: true,
    leftRight: { first, second: 100 - first },
  });
  assert.equal(
    evaluatePsa10Centering(measured(54), measured(26)).status,
    "within",
  );
  assert.equal(
    evaluatePsa10Centering(measured(57), measured(26)).status,
    "outside",
  );
  assert.equal(evaluatePsa10Centering(measured(54), null).status, "incomplete");
  assert.equal(evaluatePsa10Centering(null, null).status, "unavailable");
});

test("live scanner accepts a sharp stable aligned frame and explains blockers", () => {
  const ready = scoreGradeableCameraFrame({
    brightness: 138,
    contrast: 540,
    sharpness: 12,
    glareRatio: 0.01,
    movement: 1.2,
    geometry: { detected: true, straight: true, confidence: 0.92 },
    level: { available: true, level: true },
  });
  assert.equal(ready.gradeable, true);
  assert.ok(ready.score > 0.85);

  const glare = scoreGradeableCameraFrame({
    brightness: 246,
    contrast: 500,
    sharpness: 11,
    glareRatio: 0.24,
    movement: 1,
    geometry: { detected: true, straight: true, confidence: 0.9 },
    level: { available: true, level: true },
  });
  assert.equal(glare.gradeable, false);
  assert.ok(glare.blockers.includes("glare"));
  assert.match(glare.action, /reflection/i);

  const blur = scoreGradeableCameraFrame({
    brightness: 138,
    contrast: 500,
    sharpness: 2.1,
    glareRatio: 0.01,
    movement: 1,
    geometry: { detected: true, straight: true, confidence: 0.9 },
    level: { available: true, level: true },
  });
  assert.equal(blur.gradeable, false);
  assert.ok(blur.blockers.includes("focus"));
  assert.match(blur.action, /focus/i);
});

test("report crop preserves card aspect and stays within the source frame", () => {
  const crop = normalizedCardCrop({
    x: 0.19,
    y: 0.08,
    width: 0.61,
    height: 0.84,
  });
  assert.ok(Math.abs(crop.width / crop.height - 63 / 88) < 0.0001);
  assert.ok(crop.x >= 0 && crop.y >= 0);
  assert.ok(crop.x + crop.width <= 1);
  assert.ok(crop.y + crop.height <= 1);
});

test("auto capture requires a stable gradeable video sequence", () => {
  const goodFrame = {
    score: 0.9,
    gradeable: true,
    sharpness: 10,
    glareRatio: 0.02,
    movement: 1.4,
    geometryDetected: true,
    geometryStraight: true,
    geometryConfidence: 0.9,
  };
  const stable = summarizeGradeableFrameSequence(
    Array.from({ length: 6 }, (_, index) => ({
      ...goodFrame,
      observedAtMs: index * 180,
    })),
  );
  assert.equal(stable.ready, true);
  assert.equal(stable.captureSufficientForConditionMeasurement, true);
  assert.equal(stable.exactPsaPredictionEligible, false);
  assert.equal(stable.framesEvaluated, 5);

  const unstable = summarizeGradeableFrameSequence([
    ...Array.from({ length: 4 }, () => goodFrame),
    { ...goodFrame, gradeable: false, glareRatio: 0.28, score: 0.55 },
  ]);
  assert.equal(unstable.ready, false);
  assert.ok(unstable.blockers.includes("glare_variation"));
});

test('identity capture accepts readable stable evidence without weakening grading gates', () => {
  const input={brightness:100,contrast:400,sharpness:3.8,glareRatio:.01,movement:.1,geometry:{detected:true,straight:true,confidence:.8},level:{available:false}};
  assert.equal(scoreGradeableCameraFrame({...input,purpose:'identity'}).gradeable,true);
  assert.equal(scoreGradeableCameraFrame(input).gradeable,false);
  for(const change of [{movement:12},{brightness:10},{geometry:{detected:false}},{glareRatio:.3}])assert.equal(scoreGradeableCameraFrame({...input,...change,purpose:'identity'}).gradeable,false);
});
