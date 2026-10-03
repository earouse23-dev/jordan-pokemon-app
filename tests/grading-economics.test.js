import test from "node:test";
import assert from "node:assert/strict";
import { compareGradingOutcome } from "../lib/grading-economics.js";

test("grading comparison deducts grading and selling costs on consistent paths", () => {
  assert.deepEqual(
    compareGradingOutcome({
      rawValue: 100,
      gradedValue: 200,
      gradingCost: 30,
      sellingFeePercent: 10,
    }),
    {
      rawNetMinor: 9000,
      gradedNetMinor: 15000,
      gradingCostMinor: 3000,
      gradedSellingFeesMinor: 2000,
      differenceMinor: 6000,
      breakEvenGradedMinor: 13333,
    },
  );
  assert.equal(
    compareGradingOutcome({
      rawValue: 100,
      gradedValue: 120,
      gradingCost: 30,
      sellingFeePercent: 10,
    }).differenceMinor,
    -1200,
  );
});

test("missing prices and unknown costs never become zero-valued outcomes", () => {
  const valid = {
    rawValue: 100,
    gradedValue: 200,
    gradingCost: 30,
    sellingFeePercent: 10,
  };
  for (const key of Object.keys(valid)) {
    for (const value of [null, undefined, "", "invalid", -1])
      assert.equal(compareGradingOutcome({ ...valid, [key]: value }), null);
  }
  assert.equal(
    compareGradingOutcome({ ...valid, sellingFeePercent: 100 }),
    null,
  );
  assert.equal(
    compareGradingOutcome({
      rawValue: 0,
      gradedValue: 0,
      gradingCost: 0,
      sellingFeePercent: 0,
    }).differenceMinor,
    0,
  );
});

test("break-even is the first cent that covers costs after fee rounding", () => {
  for (const sellingFeePercent of [0, 10, 13.25, 99.99]) {
    const input = {
      rawValue: 100,
      gradedValue: 200,
      gradingCost: 30,
      sellingFeePercent,
    };
    const threshold = compareGradingOutcome(input).breakEvenGradedMinor;
    assert.ok(
      compareGradingOutcome({
        ...input,
        gradedValue: (threshold / 100).toFixed(2),
      }).differenceMinor >= 0,
    );
    assert.ok(
      compareGradingOutcome({
        ...input,
        gradedValue: ((threshold - 1) / 100).toFixed(2),
      }).differenceMinor < 0,
    );
  }
  assert.equal(
    compareGradingOutcome({
      rawValue: "999999999999999999",
      gradedValue: 1,
      gradingCost: 0,
      sellingFeePercent: 0,
    }),
    null,
  );
});
