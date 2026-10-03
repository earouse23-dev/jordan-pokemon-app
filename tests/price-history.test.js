import test from "node:test";
import assert from "node:assert/strict";
import { cardPriceHistoryWindow } from "../lib/price-history.js";
test("history ranges reject false dates and prices and count distinct days", () => {
  const now = Date.parse("2026-09-06T12:00:00Z");
  const rows = [
    ["2026-09-05", 10],
    ["2026-09-05T12:00:00Z", 20],
    ["2026-08-01", 900],
    ["2026-09-07", 900],
    ["2026-02-30", 900],
    ["2026-09-04", null],
  ].map(([recordedAt, amount]) => ({ recordedAt, amount, currency: "USD" }));
  const model = cardPriceHistoryWindow({ currency: "USD" }, rows, "1w", now);
  assert.equal(model.points.length, 2);
  assert.equal(model.summary.days, 1);
  assert.equal(model.summary.average, 15);
  assert.equal(
    cardPriceHistoryWindow({ currency: "USD" }, rows, "1d", now).points.length,
    1,
  );
});
test("purchase markers exclude unknown costs, foreign currency and dates outside the chosen window", () => {
  const purchase = {
    type: "purchase",
    date: "2026-09-05",
    totalCost: 40,
    quantity: 2,
    currency: "USD",
  };
  const model = cardPriceHistoryWindow(
    {
      currency: "USD",
      transactions: [
        purchase,
        { ...purchase, costBasisKnown: false },
        { ...purchase, currency: "EUR" },
        { ...purchase, date: "2020-01-01" },
        { ...purchase, totalCost: null },
      ],
    },
    [],
    "1w",
    Date.parse("2026-09-06"),
  );
  assert.equal(model.purchases.length, 1);
  assert.equal(model.purchases[0].y, 20);
  assert.equal(model.basis, null);
});
