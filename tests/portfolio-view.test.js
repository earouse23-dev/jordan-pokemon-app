import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPortfolioView,
  portfolioCondition,
  compactPortfolioView,
  portfolioDisplayTimeline,
  portfolioPeriodDrivers,
  portfolioRefreshNote,
  portfolioPriceIsFresh,
  portfolioOlderPriceCount,
  portfolioPricingKey,
} from "../lib/portfolio-view.js";
import { displayNativePortfolioProfitLoss } from "../lib/portfolio.js";
test("display endpoints retain estimates and distinguish carried valuations without changing saved history", () => {
  const summary={total:200,history:[{date:"2026-01-01",total:200,estimatedItems:2,unpricedItems:0}]};
  const original=structuredClone(summary);
  const carried=portfolioDisplayTimeline(summary,"2026-01-03","2026-01-01T12:00:00Z");
  assert.equal(carried.at(-1).estimatedItems,2);
  assert.equal(carried.at(-1).carriedForward,true);
  assert.equal(carried.at(-1).valuationDate,"2026-01-01");
  assert.equal(portfolioDisplayTimeline(summary,"2026-01-01","2026-01-01T12:00:00Z").length,1);
  assert.equal(portfolioDisplayTimeline(summary,"2026-01-03","2026-01-03T12:00:00Z").at(-1).carriedForward,false);
  assert.deepEqual(summary,original);
});
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
test("saved dashboard retains bounded holdings and the same performance arithmetic without pricing evidence", () => {
  const entries = Array.from({length:8}, (_,i) => ({...item(`card-${i}`, "2026-01-01", 100+i), name:`Card ${i}`, costBasis:50, lots:[{acquiredAt:"2026-01-01",quantityAcquired:1,quantityRemaining:1,currency:"USD",totalCost:50,remainingCost:50}]}));
  const full = buildPortfolioView(entries, "2026-01-05T12:00:00Z");
  full.pricing = [{secretEvidence:"not needed for first paint"}];
  const compact = JSON.parse(JSON.stringify(compactPortfolioView(full)));
  assert.equal(compact.pricing, undefined);
  assert.deepEqual(compact.displayPricing, [{displayOnly:true}]);
  assert.equal(compact.dashboard.holdings.length,5);
  assert.equal(compact.dashboard.holdings[0].name,"Card 7");
  assert.equal(compact.dashboard.holdings[0].total,107);
  const pnl = displayNativePortfolioProfitLoss(compact.dashboard.nativePerformance, "USD", null);
  assert.equal(pnl.valueMinor, compact.summaries[0].total*100);
  assert.equal(pnl.totalProfitMinor, 42800);
  assert.equal(displayNativePortfolioProfitLoss(compact.dashboard.nativePerformance,"EUR",null).unconvertedUnits,8);
  assert.deepEqual(compact.summaries[0].history,full.summaries[0].history);
});
test("price checks last a rolling 24 hours, independent of sale dates and UTC midnight", () => {
  const checkedAt = "2026-01-03T23:30:00Z";
  const pricing = {checkedAt, pricingUpdatedAt:"2024-01-01", checkedDay:"2026-01-03"};
  assert.equal(portfolioPriceIsFresh(pricing, Date.parse("2026-01-04T23:29:59Z")), true);
  assert.equal(portfolioPriceIsFresh(pricing, Date.parse("2026-01-04T23:30:00Z")), false);
  assert.equal(portfolioPriceIsFresh(pricing, Date.parse("2026-01-03T23:29:59Z")), false);
  assert.equal(portfolioPriceIsFresh({checkedDay:"2026-01-01"}, Date.parse("2026-01-03T12:00:00Z"), checkedAt), false);
});
test("compact first-paint pricing retains current quotes and one validated slab comp without histories", () => {
  const latest={transactionKey:"ebay:1", amount:200, soldAt:"2026-01-01"};
  const full={pricing:[{uid:"raw",key:"raw-key",price:100,quotes:[{amount:100}],priceHistory:Array(1000).fill({amount:100})},
    {uid:"graded",key:"graded-key",price:200,exactSaleEvidence:{sales:Array(1000).fill(latest),validatedContext:{canonicalValidated:true},retrievedAt:"2026-01-03"},soldValuation:{evidence:[latest],contributingEvidenceIds:["ebay:1"]}}]};
  const compact=compactPortfolioView(full);
  assert.equal(compact.displayPricing[0].price,100);
  assert.equal(compact.displayPricing[0].priceHistory,undefined);
  assert.deepEqual(compact.displayPricing[1].exactSaleEvidence.sales,[latest]);
  assert.equal(compact.displayPricing[1].exactSaleEvidence.summaryOnly,true);
  assert.deepEqual(compactPortfolioView(compact),compact,"Repeated caching retains the same compact prices");
  assert.equal(full.pricing[1].exactSaleEvidence.sales.length,1000,"Database evidence is not mutated");
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
  assert.equal(summary.unknownDates, 0);
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

test("an undated copy does not erase a dated copy's history, including after an allocated sale", () => {
  const card = item("mixed-dates", "2026-01-01", 100);
  card.quantity = 2;
  card.lots[0].id = "dated";
  card.lots.push({ id: "undated", acquisitionDateKnown: false, quantityAcquired: 2, quantityRemaining: 1 });
  card.transactions = [{ type: "sale", date: "2026-01-03", quantity: 1, lotAllocations: [{ lotId: "undated", quantity: 1, cost: null }] }];
  const summary = buildPortfolioView([card], "2026-01-06T00:00:00Z").summaries[0];
  assert.equal(summary.unknownDates, 1);
  assert.equal(summary.history.length, 6);
  assert.deepEqual(summary.history[0], { date: "2026-01-01", total: null, knownTotal: 100, pricedItems: 1, unpricedItems: 0, estimatedItems: 0, undatedItems: 2 });
  assert.equal(summary.history.find(point => point.date === "2026-01-04").knownTotal, 100);
  assert.equal(summary.history.at(-1).total, 200);
  delete card.transactions[0].lotAllocations;
  assert.equal(buildPortfolioView([card], "2026-01-06T00:00:00Z").summaries[0].history.find(point => point.date === "2026-01-04").knownTotal, null);
});

test("fresh saved prices and sale dates do not inflate the older-price copy count", () => {
  const rows = [
    { uid: "fresh", price: 100, checkedAt: "2026-11-17T11:35:00Z", retainedPrice: true, pricingUpdatedAt: "2026-11-02" },
    { uid: "old", price: 100, checkedAt: "2026-11-16T12:00:00Z" },
    { uid: "unknown", price: 100 },
    { uid: "unpriced", price: null, checkedAt: "2026-11-01" },
  ];
  assert.equal(portfolioOlderPriceCount(rows, rows.map(row => ({ ...row, quantity: 2 })), Date.parse("2026-11-17T12:00:00Z")), 2);
});

test("a corrected or withdrawn exact sale repairs only the affected published days", () => {
  const slab = { ...item("psa", "2026-01-01", 120), cardState: "graded", gradingCompany: "PSA", grade: "10" };
  const sale = (day, amount) => ({ recordedAt: `2026-01-${day}T00:00:00Z`, amount, currency: "USD", verifiedExactSold: true, contextValidated: true });
  slab.matchedHistory = [sale("01", 80), sale("05", 100), sale("08", 120)];
  const now = "2026-01-10T12:00:00Z";
  const previousView = buildPortfolioView([slab], now);
  previousView.pricing = [{ uid: slab.uid, key: portfolioPricingKey(slab), matchedHistory: slab.matchedHistory }];
  const previousSeries = previousView.summaries[0].history;
  const repaired = buildPortfolioView([{ ...slab, matchedHistory: [sale("01", 80), sale("05", 95)] }], now, { previousView }).summaries[0].history;
  assert.deepEqual(repaired.slice(0, 4), previousSeries.slice(0, 4));
  assert.equal(repaired.find(point => point.date === "2026-01-05").total, 95);
  assert.equal(repaired.find(point => point.date === "2026-01-08").total, 95);
  assert.deepEqual(buildPortfolioView([slab], now, { previousView }).summaries[0].history, previousSeries);
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
  b.lots[0].currency='EUR';b.lots[0].totalCost=40;
  const estimated=displayPortfolioView(buildPortfolioView([a,b],"2026-01-05T12:00:00Z"),"USD",rate,now);
  assert.equal(estimated.history.find(p=>p.date==='2026-01-03').total,250);
  assert.equal(estimated.history.find(p=>p.date==='2026-01-03').estimatedItems,1);
  assert.equal(estimated.history.at(-1).estimatedItems,0);
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

test("purchase-price history estimates respect lots, partial sales, zero cost and the first market observation", async () => {
  const a=item('paid','2024-12-01',350,2);
  a.lots=[{id:'lot1',acquiredAt:'2024-12-01',acquisitionDateKnown:true,quantityAcquired:2,quantityRemaining:1,totalCost:400,currency:'USD',costBasisKnown:true},{id:'lot2',acquiredAt:'2025-02-01',acquisitionDateKnown:true,quantityAcquired:1,quantityRemaining:1,totalCost:150,currency:'USD',costBasisKnown:true}];
  a.transactions=[{type:'sale',date:'2025-03-01',quantity:1,currency:'USD',allocatedCost:200}];
  a.priceHistory=[{...a.priceHistory[0],recordedAt:'2026-07-01T00:00:00Z',amount:300}];
  const view=buildPortfolioView([a],'2026-10-20T12:00:00Z'),summary=view.summaries[0];
  const point=date=>summary.history.find(p=>p.date===date);
  assert.equal(point('2024-12-01').total,400);assert.equal(point('2024-12-01').estimatedItems,2);
  assert.equal(point('2025-02-01').total,550);assert.equal(point('2025-03-01').total,350);assert.equal(point('2025-03-01').estimatedItems,2);
  assert.equal(point('2026-07-01').total,600);assert.equal(point('2026-07-01').estimatedItems,0);
  assert.equal(summary.history.at(-1).total,700);assert.equal(summary.history.at(-1).estimatedItems,0);
  const {portfolioProfitLoss}=await import('../lib/portfolio.js');
  assert.equal(portfolioProfitLoss([{...a,matchedHistory:[]}],'USD','2025-03-01').valueComplete,false,'Default market/P&L calculations never substitute purchase cost');
  const free=item('free','2026-01-01',100);free.priceHistory=[];free.lots[0]={...free.lots[0],currency:'USD',totalCost:0,costBasisKnown:true};
  const zero=buildPortfolioView([free],'2026-01-05T12:00:00Z').summaries[0];
  assert.equal(zero.history[0].total,0);assert.equal(zero.history[0].estimatedItems,1);
  free.lots[0].costBasisKnown=false;
  assert.equal(buildPortfolioView([free],'2026-01-05T12:00:00Z').summaries[0].history[0].total,null);
  free.lots[0].costBasisKnown=true;free.lots[0].currency='EUR';
  assert.equal(buildPortfolioView([free],'2026-01-05T12:00:00Z').summaries[0].history[0].total,null,'Do not assume historical exchange rates');
  // A same-day model repair uses the old cached source rows, not new provider downloads.
  const old=structuredClone(view);old.version=2;old.summaries[0].history=summary.history.filter(p=>p.date>='2026-07-01');
  assert.equal(buildPortfolioView([a],'2026-10-20T12:00:00Z',{previousView:old}).summaries[0].history[0].total,400);
  const saved=buildPortfolioView([a],'2026-10-19T12:00:00Z');
  a.lots[0].totalCost=600;
  const appended=buildPortfolioView([a],'2026-10-20T12:00:00Z',{previousView:saved});
  assert.deepEqual(appended.summaries[0].history.slice(0,-1),saved.summaries[0].history,'Routine daily appends preserve every saved day and estimate marker');
  const corrected=buildPortfolioView([a],'2026-10-20T12:00:00Z',{previousView:saved,recalculateFrom:'2024-12-01'});
  assert.equal(corrected.summaries[0].history[0].total,600);
  a.lots[0].totalCost=400;
  a.priceHistory.unshift({...a.priceHistory[0],recordedAt:'2026-06-01T00:00:00Z',amount:250});
  const backfilled=buildPortfolioView([a],'2026-10-20T12:00:00Z',{previousView:saved});
  assert.equal(backfilled.summaries[0].history.find(p=>p.date==='2026-06-01').total,500);
  assert.equal(backfilled.summaries[0].history.find(p=>p.date==='2026-06-01').estimatedItems,0);
});

test('saved pricing accepts partial validated enrichment but rejects a different exact context',async()=>{
 const {portfolioPricingKey,portfolioPricingKeyMatches}=await import('../lib/portfolio-view.js');
 const input={id:'card',variant:'Holofoil',currency:'USD',cardState:'graded',gradingCompany:'PSA',grade:'10',finish:'holofoil',edition:'unknown',promoType:'unknown'};
 const resolved={...input,externalIds:{pkmnprices:17262},edition:'unlimited',promoType:'none'};
 const saved={key:portfolioPricingKey(input),resolvedKey:portfolioPricingKey(resolved)};
 assert.equal(portfolioPricingKeyMatches(portfolioPricingKey({...input,externalIds:{pkmnprices:'17262'}}),saved),true);
 for(const patch of [{id:'another'},{grade:'9'},{gradingCompany:'CGC'},{edition:'first_edition'},{currency:'EUR'},{externalIds:{pkmnprices:999}}])assert.equal(portfolioPricingKeyMatches(portfolioPricingKey({...resolved,...patch}),saved),false);
 assert.equal(portfolioPricingKeyMatches(undefined,undefined),false);
});

test('saved pricing matches normalized conditions without crossing grade, printing or owner context', async () => {
  const {portfolioPricingKey,portfolioPricingKeyMatches}=await import('../lib/portfolio-view.js');
  const card={id:'same-card',variant:'Holofoil',language:'en',condition:'Near Mint',currency:'USD',cardState:'raw'};
  const saved={key:portfolioPricingKey(card),price:240};
  assert.equal(portfolioPricingKeyMatches(portfolioPricingKey({...card,rawCondition:'near_mint',condition:'Like new'}),saved),true);
  for(const change of [{rawCondition:'damaged'},{condition:'Lightly Played',rawCondition:'near_mint'},{currency:'EUR'},{variant:'Reverse Holofoil'},{cardState:'graded',gradingCompany:'PSA',grade:10},{edition:'first_edition'}])
    assert.equal(portfolioPricingKeyMatches(portfolioPricingKey({...card,...change}),saved),false);
  const slab={...card,cardState:'graded',gradingCompany:'CGC',grade:10,gradeQualifier:''};
  assert.equal(portfolioPricingKeyMatches(portfolioPricingKey({...slab,gradeQualifier:null}),{key:portfolioPricingKey(slab)}),false);
});

test('retained matching prices keep current totals while history stays dated',()=>{
  const old=item('retained','2026-01-01',240);
  old.pricingStatus='error';old.retainedPrice=true;
  const view=buildPortfolioView([old],'2026-01-10T00:00:00Z');
  assert.equal(view.summaries[0].total,240);
  assert.equal(view.summaries[0].missingUnits,0);
  assert.equal(buildPortfolioView([{...old,price:null}],'2026-01-10T00:00:00Z').summaries[0].total,null);
});

test("period drivers count only comparable positions across the two dates", () => {
  const held = {...item("old", "2026-01-01", 100, 2), name:"Held"};
  held.priceHistory.push({...held.priceHistory[0], recordedAt:"2026-01-05T12:00:00Z", amount:130});
  const added = {...held, lots:item("new","2026-01-04",130).lots};
  const rows = portfolioPeriodDrivers([held, added, {...held,currency:"EUR"}], "USD", "2026-01-02", "2026-01-06");
  assert.deepEqual(rows.map(row => [row.name,row.change]), [["Held",60]]);
  const report = compactPortfolioView(buildPortfolioView([held], "2026-01-06T00:00:00Z")).summaries[0].periodActivity.all;
  assert.equal(report.through, "2026-01-06");
  assert.equal(report.movers[0].change, 60);
});
test("incomplete match explanation survives the compact dashboard", () => {
  const saved = {refreshIncomplete:true, pendingPricing:[{pricingReason:"matching_sold_price_unavailable"}]};
  assert.match(portfolioRefreshNote(compactPortfolioView(saved)), /1 entry awaiting a matching price/);
  assert.equal(portfolioRefreshNote({...saved,refreshIncomplete:false}), "");
});
