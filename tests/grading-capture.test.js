import test from "node:test";
import assert from "node:assert/strict";
import {
  orderedRequiredCaptures,
  nextMissingCaptureIndex,
  replaceRequiredCapture,
} from "../lib/grading-capture.js";

const views = () =>
  ["front", "back", "alternate_front", "alternate_back"].map((captureType) => ({
    captureType,
    side: captureType.endsWith("back") ? "back" : "front",
    file: new Blob([captureType]),
  }));

test("retaking any required view retains every other original file and canonical order", () => {
  for (let index = 0; index < 4; index++) {
    const original = views();
    const replacement = { ...original[index], file: new Blob(["replacement"]) };
    const next = replaceRequiredCapture(original, replacement);
    assert.equal(next.length, 4);
    assert.equal(nextMissingCaptureIndex(next), -1);
    next.forEach((entry, slot) =>
      assert.equal(
        entry.file,
        slot === index ? replacement.file : original[slot].file,
      ),
    );
    assert.notEqual(original[index].file, replacement.file);
  }
});

test("capture resume finds holes by view identity and completes without a fifth photo", () => {
  const original = views();
  assert.equal(nextMissingCaptureIndex([]), 0);
  assert.equal(
    nextMissingCaptureIndex([original[3], original[0], original[2]]),
    1,
  );
  assert.deepEqual(
    orderedRequiredCaptures([...original].reverse(), { complete: true }),
    original,
  );
  assert.equal(nextMissingCaptureIndex(original), -1);
});

test("required capture validation rejects missing views, duplicate types and wrong sides", () => {
  const original = views();
  assert.throws(
    () => orderedRequiredCaptures(original.slice(0, 3), { complete: true }),
    /four/,
  );
  assert.throws(
    () => orderedRequiredCaptures([...original, original[0]]),
    /duplicated/,
  );
  assert.throws(
    () => orderedRequiredCaptures([{ ...original[0], side: "back" }]),
    /wrong side/,
  );
  assert.throws(
    () => orderedRequiredCaptures([{ ...original[0], file: null }]),
    /missing/,
  );
  assert.throws(
    () => orderedRequiredCaptures([{ ...original[0], captureType: "closeup" }]),
    /unrecognized/,
  );
});
