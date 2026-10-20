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
    "2026-01-01",
  );
  const missingDays = buildPortfolioView([noEarly], "2026-01-12T12:00:00Z").summaries[0].history;
  assert.equal(missingDays.length, 12);
  assert.ok(missingDays.slice(0,7).every(p => p.total === null));
  assert.equal(missingDays[7].total,100);
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
  assert.ok(summary.history.every((p) => p.total === null && p.knownTotal === 200 && p.unpricedItems === 1));
  assert.equal(summary.historyExcludedPositions, 0);
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
  b.priceHistory[0].recordedAt = "2026-01-04T12:00:00Z";
  const gap = displayPortfolioView(buildPortfolioView([a,b],"2026-01-05T12:00:00Z"),"USD",rate,now);
  assert.equal(gap.acquiredAt,"2026-01-01");
  assert.equal(gap.history[0].date,"2026-01-01");
  assert.equal(gap.history.find(p=>p.date==="2026-01-03").total,null);
  assert.equal(gap.history.at(-1).total,325);
});

test("saved daily values remain unchanged; missed days append from stored evidence and dated corrections recalculate only affected days", () => {
  const a = item("daily", "2026-01-01", 200);
  const saved = buildPortfolioView([a], "2026-01-03T12:00:00Z");
  // A later provider correction cannot silently rewrite already saved days.
  a.priceHistory[0].amount = 220;
  a.price = 250;
  const next = buildPortfolioView([a], "2026-01-06T12:00:00Z", {
    previousView: saved,
  });
  assert.deepEqual(
    next.summaries[0].history.slice(0, 3),
    saved.summaries[0].history,
  );
  assert.equal(
    next.summaries[0].history.find((p) => p.date === "2026-01-04").total,
    220,
  );
  assert.equal(next.summaries[0].history.at(-1).total, 250);
  const corrected = buildPortfolioView([a], "2026-01-06T12:00:00Z", {
    previousView: next,
    recalculateFrom: "2026-01-02",
  });
  assert.equal(corrected.summaries[0].history[0].total, 200);
  assert.equal(corrected.summaries[0].history[1].total, 220);
  assert.equal(
    new Set(corrected.summaries[0].history.map((p) => p.date)).size,
    6,
  );
  // A backdated additional holding rebuilds historical ownership, using local data.
  const b = item("backdated", "2026-01-02", 100);
  const withPurchase = buildPortfolioView([a, b], "2026-01-06T12:00:00Z", {
    previousView: next,
    recalculateFrom: "2026-01-02",
  });
  assert.equal(
    withPurchase.summaries[0].history.find((p) => p.date === "2026-01-02")
      .total,
    320,
  );
});

test("daily portfolio matches an independent acquisition/sale ledger across sparse prices and backdated holdings", () => {
  const events = [
    { day: 1, card: "a", quantity: 2 },
    { day: 5, card: "b", quantity: 3 },
    { day: 7, card: "a", quantity: -1 },
    { day: 11, card: "b", quantity: -2 },
  ];
  const prices = {
    a: [
      [1, 200],
      [4, 240],
      [10, 220],
    ],
    b: [
      [3, 90],
      [9, 110],
    ],
  };
  const date = (day) => `2026-01-${String(day).padStart(2, "0")}`;
  const a = item("a", date(1), 220, 1),
    b = item("b", date(5), 110, 1);
  for (const card of [a, b]) {
    const buy = events.find((e) => e.card === card.uid && e.quantity > 0);
    card.lots[0].quantityAcquired = buy.quantity;
    card.transactions = events
      .filter((e) => e.card === card.uid && e.quantity < 0)
      .map((e) => ({ type: "sale", date: date(e.day), quantity: -e.quantity }));
    card.priceHistory = prices[card.uid].map(([day, amount]) => ({
      ...card.priceHistory[0],
      recordedAt: date(day) + "T12:00:00Z",
      amount,
    }));
  }
  const view = buildPortfolioView([a, b], date(15) + "T12:00:00Z").summaries[0];
  for (let day = 1; day <= 15; day++) {
    let expected = 0;
    for (const card of ["a", "b"]) {
      const held = events
        .filter((e) => e.card === card && e.day <= day)
        .reduce((sum, e) => sum + e.quantity, 0);
      const price = prices[card].filter(([d]) => d <= day).at(-1)?.[1];
      expected += held * (price || 0);
    }
    assert.equal(
      view.history.find((p) => p.date === date(day)).total,
      expected,
      `ownership and prior observation on ${date(day)}`,
    );
  }
  assert.equal(view.total, 330);
  // Changing purchase cost cannot change market value.
  a.costBasis = 9999;
  a.lots[0].totalCost = 9999;
  assert.deepEqual(
    buildPortfolioView([a, b], date(15) + "T12:00:00Z").summaries[0].history,
    view.history,
  );
});

 test("All time preserves acquisition dates and earlier complete segments across later missing evidence", async () => {
  const a=item("old", "2025-12-01",200),b=item("late", "2026-01-01",100);
  b.priceHistory[0].recordedAt="2026-07-24T12:00:00Z";
  const view=buildPortfolioView([a,b],"2026-10-19T12:00:00Z");
  const summary=view.summaries[0];
  assert.equal(summary.history[0].date,"2025-12-01");
  assert.equal(summary.history[0].total,200);
  assert.equal(summary.history.find(p=>p.date==="2026-01-01").total,null);
  assert.equal(summary.history.find(p=>p.date==="2026-07-24").total,300);
  assert.equal(summary.history.at(-1).date,"2026-10-19");
  assert.equal(summary.history.at(-1).total,summary.total);
  const slab={...b,cardState:'graded',gradingCompany:'PSA',grade:'10',soldValuation:{status:'ready',ruleVersion:'mica-last-ebay-sale-v1',currency:'USD',estimate:100,contextValidated:true},matchedHistory:[{...b.priceHistory[0],verifiedExactSold:true,contextValidated:true}]};
  const graded=buildPortfolioView([a,slab],"2026-10-19T12:00:00Z").summaries[0];
  assert.equal(graded.history[0].date,"2025-12-01");
  assert.equal(graded.history.find(p=>p.date==="2026-01-01").total,null);
  assert.equal(graded.history.at(-1).total,300);
  // Upgrade a truncated v1 snapshot from local evidence; never retain the bad prefix.
  const old=structuredClone(view);old.version=1;old.summaries[0].history=summary.history.filter(p=>p.date>="2026-07-24");
  const upgrade=buildPortfolioView([a,b],"2026-10-19T12:00:00Z",{previousView:old});
  assert.deepEqual(upgrade.summaries[0].history,summary.history);
  const {displayPortfolioView}=await import('../lib/portfolio-view.js');
  // Same-currency path must preserve the null gap, rather than treating it as zero.
  assert.equal(displayPortfolioView(upgrade,"USD",null).history.find(p=>p.date==="2026-01-01").total,null);
 });
