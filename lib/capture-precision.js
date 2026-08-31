const CARD_ASPECT_RATIO = 63 / 88;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function degrees(radians) {
  return (radians * 180) / Math.PI;
}

function rounded(value, places = 2) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Isolates a card-shaped foreground component from a mostly continuous table
 * or mat. Thin disconnected table scratches are intentionally ignored by the
 * connected-component and rectangular-density gates.
 */
export function detectCardBoundaryFromPixels(
  pixels,
  width,
  height,
  { expectedAspectRatio = CARD_ASPECT_RATIO } = {},
) {
  if (
    !pixels ||
    pixels.length < width * height * 4 ||
    width < 32 ||
    height < 32
  )
    return { detected: false, confidence: 0, reason: "invalid_pixel_sample" };
  const borderDepth = Math.max(2, Math.round(Math.min(width, height) * 0.035));
  const border = [];
  const pixelAt = (x, y) => {
    const index = (y * width + x) * 4;
    return [pixels[index], pixels[index + 1], pixels[index + 2]];
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (
        x < borderDepth ||
        x >= width - borderDepth ||
        y < borderDepth ||
        y >= height - borderDepth
      )
        border.push(pixelAt(x, y));
    }
  }
  const background = [0, 1, 2].map((channel) =>
    median(border.map((pixel) => pixel[channel])),
  );
  const colorDistance = (pixel) =>
    Math.sqrt(
      (pixel[0] - background[0]) ** 2 * 0.3 +
        (pixel[1] - background[1]) ** 2 * 0.59 +
        (pixel[2] - background[2]) ** 2 * 0.11,
    );
  const borderDistances = border.map(colorDistance);
  const borderMedian = median(borderDistances);
  const borderMad = median(
    borderDistances.map((value) => Math.abs(value - borderMedian)),
  );
  const threshold = Math.min(92, Math.max(24, borderMedian + borderMad * 4));
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      mask[y * width + x] = colorDistance(pixelAt(x, y)) >= threshold ? 1 : 0;

  // Close one-pixel gaps so printed regions form one component without
  // allowing a thin, isolated background scratch to become the card.
  const closed = new Uint8Array(mask);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (mask[index]) continue;
      let neighbors = 0;
      for (let offsetY = -1; offsetY <= 1; offsetY += 1)
        for (let offsetX = -1; offsetX <= 1; offsetX += 1)
          neighbors += mask[(y + offsetY) * width + x + offsetX];
      if (neighbors >= 5) closed[index] = 1;
    }
  }

  const visited = new Uint8Array(closed.length);
  let best = null;
  const queueX = new Int32Array(closed.length);
  const queueY = new Int32Array(closed.length);
  for (let startY = 0; startY < height; startY += 1) {
    for (let startX = 0; startX < width; startX += 1) {
      const start = startY * width + startX;
      if (!closed[start] || visited[start]) continue;
      let head = 0;
      let tail = 0;
      queueX[tail] = startX;
      queueY[tail] = startY;
      tail += 1;
      visited[start] = 1;
      let count = 0;
      let minimumX = startX;
      let maximumX = startX;
      let minimumY = startY;
      let maximumY = startY;
      while (head < tail) {
        const x = queueX[head];
        const y = queueY[head];
        head += 1;
        count += 1;
        minimumX = Math.min(minimumX, x);
        maximumX = Math.max(maximumX, x);
        minimumY = Math.min(minimumY, y);
        maximumY = Math.max(maximumY, y);
        for (const [nextX, nextY] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ]) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height)
            continue;
          const next = nextY * width + nextX;
          if (!closed[next] || visited[next]) continue;
          visited[next] = 1;
          queueX[tail] = nextX;
          queueY[tail] = nextY;
          tail += 1;
        }
      }
      const boxWidth = maximumX - minimumX + 1;
      const boxHeight = maximumY - minimumY + 1;
      const boxArea = boxWidth * boxHeight;
      const density = count / boxArea;
      const centerX = (minimumX + maximumX) / 2 / width;
      const centerY = (minimumY + maximumY) / 2 / height;
      const centerPenalty = Math.hypot(centerX - 0.5, centerY - 0.5);
      const score = count * Math.max(0.2, density) * (1 - centerPenalty * 0.5);
      if (!best || score > best.score)
        best = {
          count,
          density,
          minimumX,
          maximumX,
          minimumY,
          maximumY,
          boxWidth,
          boxHeight,
          score,
        };
    }
  }
  if (!best)
    return { detected: false, confidence: 0, reason: "foreground_not_found" };
  const coverage = (best.boxWidth * best.boxHeight) / (width * height);
  const rawAspect = best.boxWidth / best.boxHeight;
  const aspectDelta = Math.abs(rawAspect - expectedAspectRatio);
  if (
    coverage < 0.16 ||
    coverage > 0.96 ||
    best.density < 0.18 ||
    aspectDelta > 0.3
  )
    return {
      detected: false,
      confidence: 0,
      reason: "foreground_not_card_shaped",
      diagnostics: { coverage, density: best.density, aspectDelta },
    };
  const paddingX = Math.max(1, Math.round(best.boxWidth * 0.025));
  const paddingY = Math.max(1, Math.round(best.boxHeight * 0.025));
  const bounds = normalizedCardCrop(
    {
      x: Math.max(0, best.minimumX - paddingX) / width,
      y: Math.max(0, best.minimumY - paddingY) / height,
      width:
        (Math.min(width - 1, best.maximumX + paddingX) -
          Math.max(0, best.minimumX - paddingX) +
          1) /
        width,
      height:
        (Math.min(height - 1, best.maximumY + paddingY) -
          Math.max(0, best.minimumY - paddingY) +
          1) /
        height,
    },
    expectedAspectRatio,
    0,
    width / height,
  );
  const confidence = clamp(
    0.34 +
      Math.min(0.26, best.density * 0.35) +
      Math.min(0.2, coverage * 0.28) +
      Math.max(0, 0.2 - aspectDelta),
    0,
    0.96,
  );
  return {
    detected: confidence >= 0.55,
    confidence: rounded(confidence, 3),
    bounds,
    backgroundExcluded: true,
    method: "background_component_card_isolation_v3",
    reason:
      "The dominant card-shaped foreground component was isolated; disconnected table marks were excluded.",
    diagnostics: {
      backgroundRgb: background.map((value) => Math.round(value)),
      threshold: rounded(threshold, 2),
      coverage: rounded(coverage, 3),
      density: rounded(best.density, 3),
      aspectDelta: rounded(aspectDelta, 3),
    },
  };
}

function unitScore(value, poor, good) {
  return clamp((Number(value) - poor) / Math.max(0.0001, good - poor), 0, 1);
}

export function scoreGradeableCameraFrame({
  brightness,
  contrast,
  sharpness,
  glareRatio,
  movement,
  geometry,
  level,
} = {}) {
  const light = Number(brightness);
  const contrastValue = Number(contrast);
  const sharpnessValue = Number(sharpness);
  const glare = Number(glareRatio);
  const motion = Number(movement);
  const brightnessScore = Number.isFinite(light)
    ? clamp(1 - Math.abs(light - 138) / 112, 0, 1)
    : 0;
  const contrastScore = unitScore(contrastValue, 70, 520);
  const sharpnessScore = unitScore(sharpnessValue, 3.5, 11);
  const glareScore = Number.isFinite(glare) ? clamp(1 - glare / 0.16, 0, 1) : 0;
  const stabilityScore = Number.isFinite(motion)
    ? clamp(1 - motion / 10, 0, 1)
    : 0;
  const geometryScore = geometry?.detected
    ? clamp(
        Number(geometry.confidence || 0) * 0.58 +
          (geometry.straight ? 0.42 : 0.12),
        0,
        1,
      )
    : 0;
  const levelScore = level?.available ? (level.level ? 1 : 0.18) : 0.86;
  const score =
    brightnessScore * 0.12 +
    contrastScore * 0.12 +
    sharpnessScore * 0.2 +
    glareScore * 0.17 +
    stabilityScore * 0.17 +
    geometryScore * 0.17 +
    levelScore * 0.05;
  const blockers = [];
  if (!geometry?.detected) blockers.push("frame");
  else if (!geometry.straight) blockers.push("angle");
  if (level?.available && !level.level) blockers.push("level");
  if (!Number.isFinite(light) || light < 30) blockers.push("dark");
  else if (light > 242 || glare > 0.18) blockers.push("glare");
  if (!Number.isFinite(sharpnessValue) || sharpnessValue < 4.4)
    blockers.push("focus");
  if (!Number.isFinite(motion) || motion > 8.5) blockers.push("motion");
  const action = blockers.includes("frame")
    ? "Fit the full card inside the frame"
    : blockers.includes("angle") || blockers.includes("level")
      ? "Align the bubbles and hold directly above the card"
      : blockers.includes("glare")
        ? "Tilt slightly until the reflection leaves the card"
        : blockers.includes("dark")
          ? "Add soft, even light"
          : blockers.includes("focus")
            ? "Hold closer and let the camera focus"
            : blockers.includes("motion")
              ? "Hold steady while Mica scans"
              : "Gradeable frame found";
  return {
    score: rounded(score, 3),
    gradeable: blockers.length === 0 && score >= 0.72,
    blockers,
    action,
    components: {
      brightness: rounded(brightnessScore, 3),
      contrast: rounded(contrastScore, 3),
      sharpness: rounded(sharpnessScore, 3),
      glare: rounded(glareScore, 3),
      stability: rounded(stabilityScore, 3),
      geometry: rounded(geometryScore, 3),
      level: rounded(levelScore, 3),
    },
  };
}

export function summarizeGradeableFrameSequence(
  frames = [],
  { minimumFrames = 5, minimumGradeableFrames = 3 } = {},
) {
  const bounded = (Array.isArray(frames) ? frames : [])
    .slice(-18)
    .filter((frame) => Number.isFinite(Number(frame?.score)));
  const recent = bounded.slice(-Math.max(minimumFrames, 5));
  const gradeable = recent.filter((frame) => frame.gradeable === true);
  const best = bounded.reduce(
    (winner, frame, index) =>
      !winner || Number(frame.score) > Number(winner.frame.score)
        ? { frame, index }
        : winner,
    null,
  );
  const averageScore = average(recent.map((frame) => Number(frame.score)));
  const averageMovement = average(
    recent
      .map((frame) => finite(frame.movement))
      .filter((value) => value !== null),
  );
  const minimumSharpness = recent.length
    ? Math.min(...recent.map((frame) => finite(frame.sharpness) ?? 0))
    : 0;
  const maximumGlare = recent.length
    ? Math.max(...recent.map((frame) => finite(frame.glareRatio) ?? 1))
    : 1;
  const minimumGeometryConfidence = recent.length
    ? Math.min(...recent.map((frame) => finite(frame.geometryConfidence) ?? 0))
    : 0;
  const blockers = [];
  if (recent.length < minimumFrames) blockers.push("sequence_too_short");
  if (gradeable.length < minimumGradeableFrames)
    blockers.push("not_enough_gradeable_frames");
  if (averageScore < 0.74) blockers.push("inconsistent_quality");
  if (averageMovement > 5.5) blockers.push("camera_motion");
  if (minimumSharpness < 4.4) blockers.push("focus_variation");
  if (maximumGlare > 0.18) blockers.push("glare_variation");
  if (minimumGeometryConfidence < 0.5) blockers.push("boundary_variation");
  const areas = {
    identity: {
      measurable: minimumSharpness >= 4.4 && minimumGeometryConfidence >= 0.5,
    },
    centering: {
      measurable: recent.every(
        (frame) =>
          frame.geometryDetected === true && frame.geometryStraight === true,
      ),
    },
    corners: { measurable: minimumSharpness >= 5.2 && maximumGlare <= 0.18 },
    edges: { measurable: minimumSharpness >= 5.2 && maximumGlare <= 0.18 },
    surface: { measurable: minimumSharpness >= 5.8 && maximumGlare <= 0.12 },
    structure: {
      measurable: minimumGeometryConfidence >= 0.58 && averageMovement <= 5.5,
    },
  };
  return {
    version: "live-sequence-v1",
    ready: blockers.length === 0,
    framesObserved: bounded.length,
    framesEvaluated: recent.length,
    gradeableFrames: gradeable.length,
    bestFrameIndex: best?.index ?? null,
    bestScore: best ? rounded(Number(best.frame.score), 3) : null,
    averageScore: recent.length ? rounded(averageScore, 3) : null,
    averageMovement: recent.length ? rounded(averageMovement, 3) : null,
    minimumSharpness: recent.length ? rounded(minimumSharpness, 3) : null,
    maximumGlare: recent.length ? rounded(maximumGlare, 4) : null,
    minimumGeometryConfidence: recent.length
      ? rounded(minimumGeometryConfidence, 3)
      : null,
    captureSufficientForConditionMeasurement:
      blockers.length === 0 &&
      Object.values(areas).every((area) => area.measurable),
    exactPsaPredictionEligible: false,
    blockers,
    areas,
  };
}

export function normalizedCardCrop(
  bounds,
  targetAspectRatio = CARD_ASPECT_RATIO,
  padding = 0.006,
  sourceAspectRatio = 1,
) {
  if (!bounds) return { x: 0, y: 0, width: 1, height: 1 };
  let x = clamp(Number(bounds.x) - padding, 0, 1);
  let y = clamp(Number(bounds.y) - padding, 0, 1);
  let width = clamp(Number(bounds.width) + padding * 2, 0.01, 1 - x);
  let height = clamp(Number(bounds.height) + padding * 2, 0.01, 1 - y);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const normalizedTargetAspect =
    targetAspectRatio / Math.max(0.0001, Number(sourceAspectRatio) || 1);
  if (width / height > normalizedTargetAspect)
    height = width / normalizedTargetAspect;
  else width = height * normalizedTargetAspect;
  width = Math.min(width, 1);
  height = Math.min(height, 1);
  x = clamp(centerX - width / 2, 0, 1 - width);
  y = clamp(centerY - height / 2, 0, 1 - height);
  return {
    x: rounded(x, 6),
    y: rounded(y, 6),
    width: rounded(width, 6),
    height: rounded(height, 6),
  };
}

export function measureDeviceLevel(
  accelerationIncludingGravity,
  screenAngle = 0,
  toleranceDegrees = 3,
) {
  const rawX = finite(accelerationIncludingGravity?.x);
  const rawY = finite(accelerationIncludingGravity?.y);
  const rawZ = finite(accelerationIncludingGravity?.z);
  if (rawX == null || rawY == null || rawZ == null)
    return {
      available: false,
      level: null,
      tiltDegrees: null,
      xDegrees: null,
      yDegrees: null,
      bubbleX: 0,
      bubbleY: 0,
    };

  const normalizedAngle = (((Number(screenAngle) || 0) % 360) + 360) % 360;
  let x = rawX;
  let y = rawY;
  if (normalizedAngle === 90) {
    x = rawY;
    y = -rawX;
  } else if (normalizedAngle === 180) {
    x = -rawX;
    y = -rawY;
  } else if (normalizedAngle === 270) {
    x = -rawY;
    y = rawX;
  }
  const magnitude = Math.hypot(x, y, rawZ);
  if (magnitude < 4 || magnitude > 16)
    return {
      available: false,
      level: null,
      tiltDegrees: null,
      xDegrees: null,
      yDegrees: null,
      bubbleX: 0,
      bubbleY: 0,
    };

  const xDegrees = degrees(Math.atan2(x, Math.hypot(y, rawZ)));
  const yDegrees = degrees(Math.atan2(y, Math.hypot(x, rawZ)));
  const tiltDegrees = degrees(
    Math.acos(clamp(Math.abs(rawZ) / magnitude, 0, 1)),
  );
  return {
    available: true,
    level: tiltDegrees <= toleranceDegrees,
    tiltDegrees: rounded(tiltDegrees),
    xDegrees: rounded(xDegrees),
    yDegrees: rounded(yDegrees),
    bubbleX: rounded(clamp(xDegrees / toleranceDegrees, -2, 2), 3),
    bubbleY: rounded(clamp(yDegrees / toleranceDegrees, -2, 2), 3),
  };
}

function average(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function bestPeak(values, start, end) {
  let bestIndex = start;
  let bestValue = -Infinity;
  for (let index = start; index <= end; index += 1) {
    if (values[index] > bestValue) {
      bestIndex = index;
      bestValue = values[index];
    }
  }
  return { index: bestIndex, value: bestValue };
}

function verticalGradient(gray, width, height, yStart, yEnd) {
  const scores = new Float64Array(width);
  for (let x = 1; x < width - 1; x += 1) {
    let total = 0;
    let count = 0;
    for (let y = yStart; y < yEnd; y += 1) {
      total += Math.abs(
        Number(gray[y * width + x + 1]) - Number(gray[y * width + x - 1]),
      );
      count += 1;
    }
    scores[x] = count ? total / count : 0;
  }
  return scores;
}

function horizontalGradient(gray, width, height, xStart, xEnd) {
  const scores = new Float64Array(height);
  for (let y = 1; y < height - 1; y += 1) {
    let total = 0;
    let count = 0;
    for (let x = xStart; x < xEnd; x += 1) {
      total += Math.abs(
        Number(gray[(y + 1) * width + x]) - Number(gray[(y - 1) * width + x]),
      );
      count += 1;
    }
    scores[y] = count ? total / count : 0;
  }
  return scores;
}

function edgePair(scores, length) {
  const outer = Math.max(2, Math.round(length * 0.3));
  return {
    near: bestPeak(scores, 1, outer),
    far: bestPeak(scores, length - outer - 1, length - 2),
  };
}

function borderPeak(scores, startRatio, endRatio, reverse = false) {
  const length = scores.length;
  const start = Math.max(2, Math.round(length * startRatio));
  const end = Math.min(length - 3, Math.round(length * endRatio));
  if (!reverse) return bestPeak(scores, start, end);
  const peak = bestPeak(scores, length - end - 1, length - start - 1);
  return { index: length - 1 - peak.index, value: peak.value };
}

export function measurePrintedBorderCentering(grayscale, width, height) {
  if (
    !grayscale ||
    grayscale.length !== width * height ||
    width < 90 ||
    height < 120
  )
    return {
      measurable: false,
      confidence: 0,
      reason: "The normalized card image is too small for border measurement.",
    };

  const vertical = verticalGradient(
    grayscale,
    width,
    height,
    Math.round(height * 0.2),
    Math.round(height * 0.8),
  );
  const horizontal = horizontalGradient(
    grayscale,
    width,
    height,
    Math.round(width * 0.2),
    Math.round(width * 0.8),
  );
  const left = borderPeak(vertical, 0.015, 0.19);
  const right = borderPeak(vertical, 0.015, 0.19, true);
  const top = borderPeak(horizontal, 0.015, 0.19);
  const bottom = borderPeak(horizontal, 0.015, 0.19, true);
  const baseline = Math.max(1, average([...vertical, ...horizontal]));
  const weakestPeak = Math.min(
    left.value,
    right.value,
    top.value,
    bottom.value,
  );
  const confidence = clamp(weakestPeak / (baseline * 3.2), 0, 1);
  const leftWidth = left.index;
  const rightWidth = right.index;
  const topWidth = top.index;
  const bottomWidth = bottom.index;
  const horizontalTotal = leftWidth + rightWidth;
  const verticalTotal = topWidth + bottomWidth;
  const plausible =
    horizontalTotal > width * 0.035 &&
    horizontalTotal < width * 0.34 &&
    verticalTotal > height * 0.035 &&
    verticalTotal < height * 0.34;
  const measurable = confidence >= 0.42 && plausible;
  if (!measurable)
    return {
      measurable: false,
      confidence: rounded(confidence, 3),
      reason:
        "A consistent printed border could not be separated from the artwork.",
    };

  const leftPercent = (leftWidth / horizontalTotal) * 100;
  const topPercent = (topWidth / verticalTotal) * 100;
  return {
    measurable: true,
    confidence: rounded(confidence, 3),
    leftRight: {
      first: rounded(leftPercent, 1),
      second: rounded(100 - leftPercent, 1),
    },
    topBottom: {
      first: rounded(topPercent, 1),
      second: rounded(100 - topPercent, 1),
    },
    borderPixels: {
      left: leftWidth,
      right: rightWidth,
      top: topWidth,
      bottom: bottomWidth,
    },
    method: "normalized-gradient-consistency-v1",
    reason: "Printed-border edges were consistently visible across the card.",
  };
}

export function evaluatePsa10Centering(front, back) {
  const frontMeasured = Boolean(front?.measurable);
  const backMeasured = Boolean(back?.measurable);
  if (!frontMeasured && !backMeasured)
    return {
      status: "unavailable",
      frontWithin: null,
      backWithin: null,
      complete: false,
    };

  const largestSide = (measurement) =>
    Math.max(
      Number(measurement?.leftRight?.first),
      Number(measurement?.leftRight?.second),
    );
  const frontWithin = frontMeasured ? largestSide(front) <= 55 : null;
  const backWithin = backMeasured ? largestSide(back) <= 75 : null;
  const complete = frontMeasured && backMeasured;
  return {
    status: !complete
      ? "incomplete"
      : frontWithin && backWithin
        ? "within"
        : "outside",
    frontWithin,
    backWithin,
    complete,
  };
}

export function analyzeCardGuideGeometry(
  grayscale,
  width,
  height,
  expectedAspectRatio = CARD_ASPECT_RATIO,
) {
  if (
    !grayscale ||
    grayscale.length !== width * height ||
    width < 32 ||
    height < 44
  )
    return {
      detected: false,
      straight: false,
      confidence: 0,
      reason: "Not enough image evidence.",
    };

  const middleYStart = Math.round(height * 0.15);
  const middleYEnd = Math.round(height * 0.85);
  const middleXStart = Math.round(width * 0.15);
  const middleXEnd = Math.round(width * 0.85);
  const topVertical = verticalGradient(
    grayscale,
    width,
    height,
    middleYStart,
    Math.round(height * 0.5),
  );
  const bottomVertical = verticalGradient(
    grayscale,
    width,
    height,
    Math.round(height * 0.5),
    middleYEnd,
  );
  const leftHorizontal = horizontalGradient(
    grayscale,
    width,
    height,
    middleXStart,
    Math.round(width * 0.5),
  );
  const rightHorizontal = horizontalGradient(
    grayscale,
    width,
    height,
    Math.round(width * 0.5),
    middleXEnd,
  );
  const topX = edgePair(topVertical, width);
  const bottomX = edgePair(bottomVertical, width);
  const leftY = edgePair(leftHorizontal, height);
  const rightY = edgePair(rightHorizontal, height);
  const peaks = [
    topX.near.value,
    topX.far.value,
    bottomX.near.value,
    bottomX.far.value,
    leftY.near.value,
    leftY.far.value,
    rightY.near.value,
    rightY.far.value,
  ];
  const baseline = Math.max(
    1,
    average([
      ...topVertical,
      ...bottomVertical,
      ...leftHorizontal,
      ...rightHorizontal,
    ]),
  );
  const confidence = clamp(Math.min(...peaks) / (baseline * 2.8), 0, 1);
  const left = average([topX.near.index, bottomX.near.index]);
  const right = average([topX.far.index, bottomX.far.index]);
  const top = average([leftY.near.index, rightY.near.index]);
  const bottom = average([leftY.far.index, rightY.far.index]);
  const cardWidth = right - left;
  const cardHeight = bottom - top;
  const margins = {
    left: left / width,
    right: (width - 1 - right) / width,
    top: top / height,
    bottom: (height - 1 - bottom) / height,
  };
  const complete =
    cardWidth > width * 0.55 &&
    cardHeight > height * 0.55 &&
    Object.values(margins).every((margin) => margin >= 0.005);
  const measuredAspectRatio = cardWidth / cardHeight;
  const aspectDelta =
    Math.abs(measuredAspectRatio - expectedAspectRatio) / expectedAspectRatio;
  const topWidth = topX.far.index - topX.near.index;
  const bottomWidth = bottomX.far.index - bottomX.near.index;
  const leftHeight = leftY.far.index - leftY.near.index;
  const rightHeight = rightY.far.index - rightY.near.index;
  const perspectiveDelta = Math.max(
    Math.abs(topWidth - bottomWidth) /
      Math.max(1, average([topWidth, bottomWidth])),
    Math.abs(leftHeight - rightHeight) /
      Math.max(1, average([leftHeight, rightHeight])),
  );
  const detected = confidence >= 0.28 && complete;
  const straight = detected && aspectDelta <= 0.09 && perspectiveDelta <= 0.065;
  return {
    detected,
    straight,
    confidence: rounded(confidence, 3),
    cardBounds: {
      x: rounded(left / width, 4),
      y: rounded(top / height, 4),
      width: rounded(cardWidth / width, 4),
      height: rounded(cardHeight / height, 4),
    },
    measuredAspectRatio: rounded(measuredAspectRatio, 4),
    expectedAspectRatio,
    aspectDelta: rounded(aspectDelta, 4),
    perspectiveDelta: rounded(perspectiveDelta, 4),
    edgeStrength: rounded(Math.min(...peaks), 2),
    reason: !detected
      ? "Keep the full card on a plain contrasting background."
      : straight
        ? "Card boundary and perspective passed."
        : aspectDelta > 0.09
          ? "Move the camera straight above the card."
          : "Make the phone parallel with the card.",
  };
}

export const capturePrecisionDefaults = Object.freeze({
  cardAspectRatio: CARD_ASPECT_RATIO,
  levelToleranceDegrees: 3,
});
