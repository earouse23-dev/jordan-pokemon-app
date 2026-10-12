import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortfolioView,
  portfolioCondition,
} from "../lib/portfolio-view.js";
const item = (uid, date, amount, quantity = 1) => ({
  uid,
  id: uid,
  cardState: "raw",
  currency: "USD",
  variant: "Holofoil",
  rawCondition: "near_mint",
  condition: "Like new",
  quantity,
  price: amount,
  pricingStatus: "live",
  lots: [
    {
      acquiredAt: date,
      acquisitionDateKnown: true,
      quantityAcquired: quantity,
      quantityRemaining: quantity,
    },
  ],
  transactions: [],
  priceHistory: [
    {
      recordedAt: date + "T12:00:00Z",
      amount,
      currency: "USD",
      finish: "holofoil",
      condition: "Near Mint",
      provider: "tcgplayer",
    },
  ],
});
test("purchase-date market values reconstruct daily ownership without logins or future-price backfill", () => {
  const a = item("charizard", "2026-01-01", 200, 2),
    b = item("mew", "2026-01-05", 90);
  a.priceHistory.push({
    ...a.priceHistory[0],
    recordedAt: "2026-01-10T12:00:00Z",
    amount: 250,
  });
  a.price = 250;
  const original = structuredClone([a, b]);
  const view = buildPortfolioView([a, b], "2026-01-15T12:00:00Z").summaries[0];
  assert.equal(view.total, 590);
  assert.equal(view.history.find((p) => p.date === "2026-01-01").total, 400);
  assert.equal(view.history.find((p) => p.date === "2026-01-04").total, 400);
  assert.equal(view.history.find((p) => p.date === "2026-01-05").total, 490);
  assert.equal(view.history.find((p) => p.date === "2026-01-14").total, 590);
  assert.equal(view.history.length, 15);
  assert.deepEqual([a, b], original);
  assert.equal(portfolioCondition(a), "Near Mint");
  const noEarly = item("missing", "2026-01-01", 100);
  noEarly.priceHistory[0].recordedAt = "2026-01-08T12:00:00Z";
  assert.equal(
    buildPortfolioView([noEarly], "2026-01-12T12:00:00Z").summaries[0]
      .historyStartsAt,
    "2026-01-08",
  );
});
test("sales remove holdings, preserve zero, and missing holdings cannot masquerade as the full portfolio", () => {
  const a = item("sold", "2026-01-01", 200);
  a.quantity = 0;
  a.lots[0].quantityRemaining = 0;
  a.transactions = [{ type: "sale", date: "2026-01-04", quantity: 1 }];
  const history = buildPortfolioView([a], "2026-01-06T00:00:00Z").summaries[0]
    .history;
  assert.equal(history.find((p) => p.date === "2026-01-03").total, 200);
  assert.equal(history.at(-1).total, 0);
  const missing = item("missing", "2026-01-01", null);
  missing.priceHistory = [];
  const summary = buildPortfolioView(
    [item("good", "2026-01-01", 200), missing],
    "2026-01-06T00:00:00Z",
  ).summaries[0];
  assert.equal(summary.total, null);
  assert.equal(summary.history.length, 6);
  assert.ok(summary.history.every((p) => p.total === 200));
  assert.equal(summary.historyExcludedPositions, 1);
  assert.equal(summary.knownTotal, 200);
  assert.equal(buildPortfolioView([]).summaries[0].total, 0);
});

test("today ends at the same current market value shown above the chart", () => {
  const a = item("today", "2026-01-01", 200);
  a.price = 250;
  const view = buildPortfolioView([a], "2026-01-05T12:00:00Z").summaries[0];
  assert.equal(view.history.find((p) => p.date === "2026-01-04").total, 200);
  assert.equal(view.history.at(-1).total, view.total);
  assert.equal(view.total, 250);
});

test("display totals include every native currency and never assume a missing exchange rate", async () => {
  const { displayPortfolioView } = await import("../lib/portfolio-view.js");
  const hash = "a".repeat(64),
    now = Date.parse("2026-01-05T12:00:00Z");
  const rate = {
    sourceId: "ecb-eurofxref-daily",
    sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
    base: "EUR",
    quote: "USD",
    units: "USD per EUR",
    rate: 1.25,
    effectiveDate: "2026-01-05",
    fetchedAt: "2026-01-05T00:00:00.000Z",
    contentSha256: hash,
    rateRef: "ecb-eurofxref-daily:2026-01-05:" + hash,
  };
  const a = item("usd", "2026-01-01", 200),
    b = item("eur", "2026-01-03", 100);
  b.currency = "EUR";
  b.priceHistory[0].currency = "EUR";
  const view = buildPortfolioView([a, b], "2026-01-05T12:00:00Z");
  const display = displayPortfolioView(view, "USD", rate, now);
  assert.equal(display.total, 325);
  assert.equal(display.history.find((p) => p.date === "2026-01-01").total, 200);
  assert.equal(display.history.at(-1).total, 325);
  assert.equal(displayPortfolioView(view, "USD", null, now).total, null);
});

test('saved daily values remain unchanged; missed days append from stored evidence and dated corrections recalculate only affected days', () => {
  const a = item('daily', '2026-01-01', 200);
  const saved = buildPortfolioView([a], '2026-01-03T12:00:00Z');
  // A later provider correction cannot silently rewrite already saved days.
  a.priceHistory[0].amount = 220;
  a.price = 250;
  const next = buildPortfolioView([a], '2026-01-06T12:00:00Z', {previousView:saved});
  assert.deepEqual(next.summaries[0].history.slice(0,3), saved.summaries[0].history);
  assert.equal(next.summaries[0].history.find(p=>p.date==='2026-01-04').total,220);
  assert.equal(next.summaries[0].history.at(-1).total,250);
  const corrected = buildPortfolioView([a], '2026-01-06T12:00:00Z', {previousView:next,recalculateFrom:'2026-01-02'});
  assert.equal(corrected.summaries[0].history[0].total,200);
  assert.equal(corrected.summaries[0].history[1].total,220);
  assert.equal(new Set(corrected.summaries[0].history.map(p=>p.date)).size,6);
  // A backdated additional holding rebuilds historical ownership, using local data.
  const b = item('backdated', '2026-01-02', 100);
  const withPurchase=buildPortfolioView([a,b],'2026-01-06T12:00:00Z',{previousView:next,recalculateFrom:'2026-01-02'});
  assert.equal(withPurchase.summaries[0].history.find(p=>p.date==='2026-01-02').total,320);
});
