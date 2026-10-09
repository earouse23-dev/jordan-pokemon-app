import test from "node:test";
import assert from "node:assert/strict";
import {
  portfolioProfitLoss,
  portfolioDisplayProfitLoss,
  portfolioDisplayProfitLossHistory,
  portfolioProfitLossHistory,
} from "../lib/portfolio.js";
import { hydratePosition } from "../lib/supabase-data.js";

const point = (date, amount, currency = "USD") => ({
  recordedAt: `${date}T12:00:00Z`,
  amount,
  currency,
  provider: "synthetic",
});
const purchase = (date, amount, currency = "USD") => ({
  type: "purchase",
  date,
  quantity: 1,
  totalCost: amount,
  currency,
});
const lot = (date, amount, currency = "USD", remaining = 1) => ({
  acquiredAt: date,
  quantityAcquired: 1,
  quantityRemaining: remaining,
  totalCost: amount,
  costBasisKnown: amount !== null,
  acquisitionDateKnown: true,
  currency,
});

test("sealed ETB joins native-currency portfolio history without treating missing cost as zero", () => {
  const sealed = {
    id: "sealed:synthetic-77", cardState: "sealed", productType: "elite_trainer_box",
    name: "Synthetic Elite Trainer Box", language: "en", sealedVariant: "Pokemon Center",
    currency: "EUR", quantity: 1, costBasis: 40, price: 65, pricingStatus: "live",
    lots: [lot("2026-09-01", 40, "EUR")],
    transactions: [purchase("2026-09-01", 40, "EUR")],
    matchedHistory: [point("2026-09-01", 50, "EUR"), point("2026-09-20", 65, "EUR")],
  };
  const current = portfolioProfitLoss([sealed], "EUR");
  assert.equal(current.valueMinor, 6500);
  assert.equal(current.unrealizedMinor, 2500);
  const history = portfolioProfitLossHistory([sealed], "EUR");
  assert.equal(history.find((row) => row.date === "2026-09-01").valueMinor, 5000);
  assert.equal(history.find((row) => row.date === "2026-09-20").valueMinor, 6500);
  assert.equal(portfolioProfitLoss([sealed], "USD").pricedUnits, 0);
  const unknown = { ...sealed, costBasis: null, lots: [lot("2026-09-01", null, "EUR")], transactions: [purchase("2026-09-01", null, "EUR")] };
  const unresolved = portfolioProfitLoss([unknown], "EUR");
  assert.equal(unresolved.unknownBasisUnits, 1);
  assert.equal(unresolved.comparableUnits, 0);
  assert.equal(unresolved.historyComplete, false);
});

test("saved sealed identity rehydrates product facts and unknown purchase basis", () => {
  const item = hydratePosition({
    id: "synthetic-sealed-position", card_state: "sealed", status: "owned", quantity: 1,
    currency: "USD", tags: [],
    identity_snapshot: { providerCardId: "manual-sealed:synthetic", name: "Synthetic Elite Trainer Box", set: "Synthetic Set", language: "en", cardState: "sealed", productType: "elite_trainer_box", sealedVariant: "Pokemon Center", sealedRegion: "US", identityStatus: "needs_review", externalIds: {} },
  }, [], [{ id: "synthetic-lot", acquired_at: "2026-09-20", acquired_at_known: false, quantity_acquired: 1, quantity_remaining: 1, total_cost: null, remaining_cost: null, cost_basis_known: false, currency: "USD" }]);
  assert.equal(item.cardState, "sealed");
  assert.equal(item.productType, "elite_trainer_box");
  assert.equal(item.sealedVariant, "Pokemon Center");
  assert.equal(item.sealedRegion, "US");
  assert.equal(item.externalIds.pkmnpricesSealed, undefined);
  assert.equal(item.costBasis, null);
  assert.equal(portfolioProfitLoss([{ ...item, price: 50, pricingStatus: "live" }], "USD").unknownBasisUnits, 1);
});

test("controlled A/B/C history reconciles dated membership, partial coverage, fees and fresh reopen", () => {
  const items = [
    {
      currency: "USD",
      quantity: 1,
      costBasis: 100,
      price: 150,
      pricingStatus: "live",
      lots: [lot("2026-09-01", 100)],
      transactions: [purchase("2026-09-01", 100)],
      matchedHistory: [
        point("2026-09-01", 120),
        point("2026-09-10", 130),
        point("2026-09-15", 140),
        point("2026-09-20", 140),
        point("2026-09-25", 150),
      ],
    },
    {
      currency: "USD",
      quantity: 0,
      costBasis: 0,
      price: null,
      pricingStatus: "missing",
      lots: [lot("2026-09-05", 200, "USD", 0)],
      transactions: [
        purchase("2026-09-05", 200),
        {
          type: "sale",
          date: "2026-09-15",
          quantity: 1,
          subtotal: 300,
          marketplaceFees: 20,
          netProceeds: 280,
          allocatedCost: 200,
          currency: "USD",
        },
      ],
      matchedHistory: [point("2026-09-05", 220), point("2026-09-10", 250)],
    },
    {
      currency: "USD",
      quantity: 1,
      costBasis: 50,
      price: 70,
      pricingStatus: "live",
      lots: [lot("2026-09-20", 50)],
      transactions: [purchase("2026-09-20", 50)],
      matchedHistory: [point("2026-09-20", 70), point("2026-09-25", 70)],
    },
  ];
  const history = portfolioProfitLossHistory(items);
  const byDate = Object.fromEntries(history.map((row) => [row.date, row]));
  assert.equal(byDate["2026-09-01"].valueMinor, 12000);
  assert.equal(byDate["2026-09-05"].pricedUnits, 2);
  assert.equal(byDate["2026-09-05"].missingUnits, 0);
  assert.equal(byDate["2026-09-10"].valueMinor, 38000);
  assert.equal(byDate["2026-09-10"].unrealizedMinor, 8000);
  assert.ok(
    Math.abs(byDate["2026-09-10"].unrealizedPercent - 26.6666667) < 0.0001,
  );
  assert.equal(byDate["2026-09-15"].valueMinor, 14000);
  assert.equal(byDate["2026-09-15"].realizedMinor, 8000);
  assert.equal(byDate["2026-09-20"].valueMinor, 21000);
  assert.equal(byDate["2026-09-20"].unrealizedMinor, 6000);
  assert.equal(byDate["2026-09-25"].valueMinor, 22000);
  assert.equal(byDate["2026-09-25"].unrealizedMinor, 7000);
  assert.equal(byDate["2026-09-25"].realizedMinor, 8000);
  assert.deepEqual(
    portfolioProfitLoss(structuredClone(items)),
    portfolioProfitLoss(items),
  );
});

test("unknown, zero, stale, absent and other-currency facts remain distinct", () => {
  const rows = [
    {
      currency: "USD",
      quantity: 1,
      costBasis: null,
      price: 80,
      pricingStatus: "live",
      lots: [lot("2026-09-01", null)],
      transactions: [],
      matchedHistory: [],
    },
    {
      currency: "USD",
      quantity: 1,
      costBasis: 0,
      price: 30,
      pricingStatus: "live",
      lots: [lot("2026-09-01", 0)],
      transactions: [],
      matchedHistory: [],
    },
    {
      currency: "USD",
      quantity: 1,
      costBasis: 20,
      price: 30,
      pricingStatus: "stale",
      lots: [lot("2026-09-01", 20)],
      transactions: [],
      matchedHistory: [],
    },
    {
      currency: "EUR",
      quantity: 1,
      costBasis: 40,
      price: 50,
      pricingStatus: "live",
      lots: [lot("2026-09-01", 40, "EUR")],
      transactions: [],
      matchedHistory: [],
    },
  ];
  const usd = portfolioProfitLoss(rows, "USD");
  assert.equal(usd.valueMinor, 11000);
  assert.equal(usd.unrealizedMinor, 3000);
  assert.equal(usd.unrealizedPercent, null);
  assert.equal(usd.unknownBasisUnits, 1);
  assert.equal(usd.missingUnits, 1);
  const unavailable = portfolioProfitLoss([rows[2]], "USD");
  assert.equal(unavailable.comparableUnits, 0);
  assert.equal(unavailable.missingUnits, 1);
  assert.equal(unavailable.unrealizedPercent, null);
  assert.equal(unavailable.knownRealizedSales, 0);
  const eur = portfolioProfitLoss(rows, "EUR");
  assert.equal(eur.valueMinor, 5000);
  assert.equal(eur.unrealizedMinor, 1000);
  assert.equal(eur.unrealizedPercent, 25);
});

test("event-only dates, unknown membership and cost, final sale, and partial lots", () => {
  const sold = {
    currency: "USD",
    quantity: 0,
    lots: [lot("2026-09-01", 100, "USD", 0)],
    transactions: [
      {
        type: "sale",
        date: "2026-09-15",
        quantity: 1,
        netProceeds: 140,
        allocatedCost: 100,
        currency: "USD",
      },
    ],
    matchedHistory: [point("2026-09-10", 120)],
  };
  const rows = portfolioProfitLossHistory([sold]);
  assert.equal(
    rows.find((row) => row.date === "2026-09-15").realizedMinor,
    4000,
  );
  assert.equal(rows.find((row) => row.date === "2026-09-15").valueMinor, 0);
  assert.equal(
    rows.find((row) => row.date === "2026-09-15").knownZeroActive,
    true,
  );
  const unpriced = {
    currency: "USD",
    quantity: 1,
    lots: [lot("2026-09-20", 50)],
    transactions: [purchase("2026-09-20", 50)],
    matchedHistory: [],
  };
  const purchaseOnly = portfolioProfitLossHistory([sold, unpriced]).find(
    (row) => row.date === "2026-09-20",
  );
  assert.equal(purchaseOnly.missingUnits, 1);
  assert.equal(purchaseOnly.realizedMinor, 4000);
  assert.equal(purchaseOnly.knownZeroActive, false);
  const uncertain = {
    ...unpriced,
    lots: [
      { ...unpriced.lots[0], acquiredAt: null, acquisitionDateKnown: false },
    ],
    matchedHistory: [point("2026-09-20", 80)],
  };
  const uncertainRow = portfolioProfitLoss([uncertain], "USD", "2026-09-20");
  assert.equal(uncertainRow.unknownMembershipUnits, 1);
  assert.equal(uncertainRow.historyComplete, false);
  const noCost = {
    ...unpriced,
    lots: [{ ...unpriced.lots[0], totalCost: null, costBasisKnown: true }],
    matchedHistory: [point("2026-09-20", 80)],
  };
  assert.equal(
    portfolioProfitLoss([noCost], "USD", "2026-09-20").unknownBasisUnits,
    1,
  );
  const free = {
    ...unpriced,
    costBasis: 0,
    price: 30,
    pricingStatus: "live",
    lots: [lot("2026-09-20", 0)],
  };
  assert.equal(portfolioProfitLoss([free]).unrealizedMinor, 3000);
  assert.equal(portfolioProfitLoss([free]).unrealizedPercent, null);
  const partial = {
    currency: "USD",
    quantity: 2,
    costBasis: 80,
    price: 80,
    pricingStatus: "live",
    lots: [
      {
        acquiredAt: "2026-09-01",
        quantityAcquired: 2,
        quantityRemaining: 1,
        totalCost: 100,
        remainingCost: 50,
        costBasisKnown: true,
        acquisitionDateKnown: true,
        currency: "USD",
      },
      lot("2026-09-05", 30),
    ],
    transactions: [
      {
        type: "sale",
        date: "2026-09-15",
        quantity: 1,
        netProceeds: 70,
        allocatedCost: 50,
        currency: "USD",
      },
    ],
    matchedHistory: [point("2026-09-20", 80)],
  };
  const partialRow = portfolioProfitLoss([partial], "USD", "2026-09-20");
  assert.equal(partialRow.valueMinor, 16000);
  assert.equal(partialRow.basisMinor, 8000);
  assert.equal(partialRow.unrealizedMinor, 8000);
  assert.equal(partialRow.realizedMinor, 2000);
  const mixedSale = {
    ...sold,
    transactions: [{ ...sold.transactions[0], currency: "EUR" }],
  };
  assert.equal(
    portfolioProfitLoss([mixedSale], "USD", "2026-09-15").unknownRealizedSales,
    1,
  );
});

test("graded index is excluded while a ready attributable exact-sold estimate is eligible", () => {
  const graded = {
    cardState: "graded",
    gradingCompany: "PSA",
    currency: "EUR",
    quantity: 1,
    costBasis: 50,
    price: 900,
    pricingStatus: "live",
    lots: [lot("2026-09-01", 50, "EUR")],
    transactions: [],
    matchedHistory: [point("2026-09-10", 900, "EUR")],
  };
  assert.equal(portfolioProfitLoss([graded], "EUR").pricedUnits, 0);
  assert.equal(
    portfolioProfitLoss([graded], "EUR", "2026-09-10").pricedUnits,
    0,
  );
  const exact = {
    ...graded,
    soldValuation: {
      status: "ready",
      ruleVersion: "mica-exact-sold-v1",
      contextValidated: true,
      currency: "EUR",
      estimate: 120,
    },
  };
  assert.equal(portfolioProfitLoss([exact], "EUR").valueMinor, 12000);
  assert.equal(portfolioProfitLoss([exact], "EUR").unrealizedMinor, 7000);
  const superficiallyAttributed = {
    ...graded,
    matchedHistory: [
      {
        ...point("2026-09-10", 120, "EUR"),
        valuationType: "exact_sold_estimate",
        evidenceRuleVersion: "mica-exact-sold-v1",
        contextValidated: true,
      },
    ],
  };
  assert.equal(
    portfolioProfitLoss([superficiallyAttributed], "EUR", "2026-09-10")
      .pricedUnits,
    0,
  );
});

test("adapter keeps optimistic known flags from coercing missing numeric cost to zero", () => {
  const item = hydratePosition(
    {
      id: "synthetic",
      identity_snapshot: { name: "Synthetic", variant: "Holofoil" },
      card_state: "raw",
      raw_condition: "near_mint",
      quantity: 1,
      currency: "USD",
      status: "owned",
      tags: [],
    },
    [],
    [
      {
        id: "lot",
        acquired_at: "2026-09-01",
        acquired_at_known: true,
        quantity_acquired: 1,
        quantity_remaining: 1,
        total_cost: null,
        remaining_cost: null,
        cost_basis_known: true,
        currency: "USD",
      },
    ],
  );
  assert.equal(item.costBasis, null);
  assert.equal(item.lots[0].totalCost, null);
  assert.equal(item.lots[0].remainingCost, null);
  assert.equal(
    portfolioProfitLoss([{ ...item, price: 80, pricingStatus: "live" }])
      .unknownBasisUnits,
    1,
  );
});

test("display currency combines native valuations without changing source records or inventing FX", () => {
  const now = Date.parse("2026-10-03T12:00:00.000Z");
  const hash = "a".repeat(64);
  const rate = { sourceId: "ecb-eurofxref-daily", sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", base: "EUR", quote: "USD", units: "USD per EUR", rate: 1.25, effectiveDate: "2026-10-02", fetchedAt: "2026-10-03T00:00:00.000Z", contentSha256: hash, rateRef: "ecb-eurofxref-daily:2026-10-02:"+hash };
  const items = [
    { currency: "USD", quantity: 1, cardState: "graded", price: 999, costBasis: 100, soldValuation: { status: "ready", ruleVersion: "mica-exact-sold-v1", currency: "USD", contextValidated: true, estimate: 150 } },
    { currency: "EUR", quantity: 2, cardState: "sealed", price: 50, pricingStatus: "live", costBasis: 120 },
    { currency: "EUR", quantity: 1, cardState: "graded", price: 777, costBasis: null },
  ];
  const original = structuredClone(items);
  const usd = portfolioDisplayProfitLoss(items, "USD", rate, now);
  assert.equal(usd.valueMinor, 27500);
  assert.equal(usd.basisMinor, 25000);
  assert.equal(usd.unrealizedMinor, 2500);
  assert.equal(usd.unrealizedPercent, 10);
  assert.equal(usd.pricedUnits, 3);
  assert.equal(usd.missingUnits, 1);
  assert.equal(usd.rateRef, rate.rateRef);
  const eur = portfolioDisplayProfitLoss(items, "EUR", rate, now);
  assert.equal(eur.valueMinor, 22000);
  assert.equal(eur.unrealizedMinor, 2000);
  assert.equal(eur.unrealizedPercent, 10);
  const withUnpriced = portfolioDisplayProfitLoss([...items, { currency: "USD", quantity: 1, cardState: "raw", costBasis: 50, price: null, pricingStatus: "missing" }], "USD", rate, now);
  assert.equal(withUnpriced.knownBasisMinor, 30000);
  assert.equal(withUnpriced.knownBasisUnits, 4);
  assert.equal(withUnpriced.basisMinor, 25000);
  assert.equal(withUnpriced.missingUnits, 2);
  assert.deepEqual(items, original);
  for (const unavailable of [null, { ...rate, rate: -1 }, { ...rate, effectiveDate: "2026-09-01" }]) {
    const partial = portfolioDisplayProfitLoss(items, "USD", unavailable, now);
    assert.equal(partial.valueMinor, 15000);
    assert.equal(partial.unconvertedUnits, 3);
    assert.equal(partial.missingUnits, 3);
    assert.equal(partial.rateRef, null);
  }
  assert.throws(() => portfolioDisplayProfitLoss(items, "GBP", rate, now), /Unsupported/);
});

test("converted portfolio history combines only dated native evidence and preserves gaps", () => {
  const now = Date.parse("2026-10-03T12:00:00.000Z"), hash = "a".repeat(64);
  const rate = { sourceId: "ecb-eurofxref-daily", sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", base: "EUR", quote: "USD", units: "USD per EUR", rate: 1.25, effectiveDate: "2026-10-02", fetchedAt: "2026-10-03T00:00:00.000Z", contentSha256: hash, rateRef: "ecb-eurofxref-daily:2026-10-02:" + hash };
  const items = [
    { currency: "USD", quantity: 1, cardState: "graded", price: 999, lots: [{ acquiredAt: "2026-09-01", quantityAcquired: 1, quantityRemaining: 1, currency: "USD", totalCost: 100 }], matchedHistory: [{ ...point("2026-09-02", 150), verifiedExactSold: true, contextValidated: true }, { ...point("2026-09-03", 999), verifiedExactSold: false, contextValidated: true }] },
    { currency: "EUR", quantity: 1, cardState: "sealed", lots: [{ acquiredAt: "2026-09-01", quantityAcquired: 1, quantityRemaining: 1, currency: "EUR", totalCost: 80 }], matchedHistory: [point("2026-09-02", 100, "EUR")] },
  ];
  const original = structuredClone(items);
  const history = portfolioDisplayProfitLossHistory(items, "EUR", rate, now);
  assert.deepEqual(history.map(row => row.date), ["2026-09-01", "2026-09-02", "2026-09-03"]);
  assert.equal(history[0].missingUnits, 2);
  assert.equal(history[1].valueMinor, 22000);
  assert.equal(history[1].basisMinor, 16000);
  assert.equal(history[1].unrealizedMinor, 6000);
  assert.equal(history[1].historyComplete, true);
  assert.equal(history[1].rateRef, rate.rateRef);
  assert.equal(history[2].pricedUnits, 2);
  assert.equal(history[2].missingUnits, 0);
  assert.equal(history[2].historyComplete, true);
  const missingRate = portfolioDisplayProfitLossHistory(items, "EUR", null, now);
  assert.equal(missingRate[1].valueMinor, 10000);
  assert.equal(missingRate[1].unconvertedUnits, 1);
  assert.equal(missingRate[1].historyComplete, false);
  const undated = portfolioDisplayProfitLossHistory([...items, { currency: "USD", quantity: 1, lots: [], matchedHistory: [] }], "EUR", null, now);
  assert.equal(undated[1].unknownMembershipUnits, 1);
  assert.equal(undated[1].knownZeroActive, false);
  assert.deepEqual(items, original);
});

test("all-time P/L includes sold gains without inventing unknown sale costs", () => {
  const items = [
    { currency: "USD", cardState: "raw", quantity: 1, costBasis: 100, price: 150, pricingStatus: "live" },
    { currency: "USD", quantity: 0, transactions: [{ type: "sale", date: "2026-09-01", netProceeds: 120, allocatedCost: 100, currency: "USD" }] },
    { currency: "USD", quantity: 0, transactions: [{ type: "sale", date: "2026-09-01", netProceeds: 999, allocatedCost: null, currency: "USD" }] },
  ];
  const original = structuredClone(items);
  const result = portfolioDisplayProfitLoss(items, "USD", null);
  assert.equal(result.realizedMinor, 2000);
  assert.equal(result.realizedBasisMinor, 10000);
  assert.equal(result.totalProfitMinor, 7000);
  assert.equal(result.totalProfitPercent, 35);
  assert.equal(result.unknownRealizedSales, 1);
  assert.equal(result.historyComplete, false);
  assert.deepEqual(items, original);
});


test("portfolio carries earlier matching history without live-price expiry and separates value from unknown cost", () => {
  const a = { currency: "USD", cardState: "raw", quantity: 2, costBasis: null, lots: [{ ...lot("2026-09-01", null), quantityAcquired: 2, quantityRemaining: 2 }], matchedHistory: [point("2026-09-01", 100), point("2026-09-07", 200)] };
  assert.equal(portfolioProfitLoss([a], "USD", "2026-09-03").valueMinor, 20000);
  assert.equal(portfolioProfitLoss([a], "USD", "2026-09-03").valueComplete, true);
  assert.equal(portfolioProfitLoss([a], "USD", "2026-09-03").historyComplete, false);
  assert.equal(portfolioProfitLoss([a], "USD", "2026-09-06").missingUnits, 0);
  assert.equal(portfolioProfitLoss([a], "USD", "2026-08-31").valueMinor, 0);
  const daily = portfolioProfitLossHistory([a], "USD", true);
  assert.equal(daily.length, 7);
  assert.equal(daily.find(row => row.date === "2026-09-06").valueComplete, true);
  assert.deepEqual(a.matchedHistory.map(row => row.amount), [100, 200]);
});
