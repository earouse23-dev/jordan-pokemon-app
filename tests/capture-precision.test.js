import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeCardGuideGeometry,
  detectCardBoundaryFromPixels,
  evaluatePsa10Centering,
  measurePrintedBorderCentering,
  measureDeviceLevel,
  normalizedCardCrop,
  scoreGradeableCameraFrame,
  summarizeGradeableFrameSequence,
} from "../lib/capture-precision.js";

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
