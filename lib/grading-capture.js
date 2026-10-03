const REQUIRED_TYPES = Object.freeze([
  "front",
  "back",
  "alternate_front",
  "alternate_back",
]);

export function orderedRequiredCaptures(
  captures = [],
  { complete = false } = {},
) {
  const byType = new Map();
  for (const capture of captures) {
    if (
      !REQUIRED_TYPES.includes(capture?.captureType) ||
      byType.has(capture.captureType)
    )
      throw new Error(
        "The required photo views are duplicated or unrecognized.",
      );
    const side = capture.captureType.endsWith("back") ? "back" : "front";
    if (capture.side !== side || !capture.file)
      throw new Error("A required photo is missing or has the wrong side.");
    byType.set(capture.captureType, capture);
  }
  if (complete && byType.size !== REQUIRED_TYPES.length)
    throw new Error("All four photo views are needed before analysis.");
  return REQUIRED_TYPES.flatMap((type) =>
    byType.has(type) ? [byType.get(type)] : [],
  );
}

export function nextMissingCaptureIndex(captures = []) {
  const present = new Set(
    orderedRequiredCaptures(captures).map((capture) => capture.captureType),
  );
  return REQUIRED_TYPES.findIndex((type) => !present.has(type));
}

export function replaceRequiredCapture(captures, capture) {
  return orderedRequiredCaptures([
    ...orderedRequiredCaptures(captures).filter(
      (previous) => previous.captureType !== capture.captureType,
    ),
    capture,
  ]);
}
