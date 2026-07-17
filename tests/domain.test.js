import test from "node:test";
import assert from "node:assert/strict";
import { AltProvider } from "../lib/providers/alt.js";
import { CardLadderProvider } from "../lib/providers/cardladder.js";
import {
  canonicalCardFingerprint,
  detectPriceAnomaly,
  isCompatibleObservation,
  normalizeGrade,
  normalizeGrader,
  normalizeRawCondition,
  observationKey,
  selectValuation,
} from "../lib/domain.js";
import {
  acquisitionFromTotal,
  acquisitionTotal,
  allocateFifo,
  gradingEstimate,
  gradingDecision,
  tradeAnalysis,
  salePlan,
  holdingDays,
  positionPerformance,
  toMinorUnits,
  validateAcquisition,
} from "../lib/portfolio.js";
import { hydrateWatchlistEntry } from "../lib/supabase-data.js";

test("normalizes provider raw conditions while retaining the original label", () => {
  assert.deepEqual(normalizeRawCondition("NM"), {
    normalized: "near_mint",
    original: "NM",
  });
  assert.deepEqual(normalizeRawCondition("Lightly Played"), {
    normalized: "lightly_played",
    original: "Lightly Played",
  });
});

test("normalizes graders and decimal grades without merging distinct grades", () => {
  assert.equal(normalizeGrader("Beckett").normalized, "BGS");
  assert.equal(normalizeGrader("SGC").normalized, "SGC");
  assert.equal(normalizeGrader("TAG").normalized, "TAG");
  assert.equal(normalizeGrade("9.5"), "9.5");
  assert.equal(normalizeGrade("9"), "9");
  assert.equal(normalizeGrade("9.25"), null);
});

test("watchlist hydration preserves the exact raw or graded target context", () => {
  const watched = hydrateWatchlistEntry({
    id: "watch-1",
    card_id: null,
    provider_card_id: "sv3pt5-199",
    identity_snapshot: {
      providerCardId: "sv3pt5-199",
      name: "Charizard ex",
      set: "151",
      number: "199/165",
      variant: "Holofoil",
    },
    variant_key: "Holofoil",
    card_state: "graded",
    raw_condition: null,
    grader: "PSA",
    grade: 10,
    target_price: 250,
    starting_market_price: 275,
    currency: "USD",
    notes: "Wait for a clean copy",
    created_at: "2026-07-17T12:00:00Z",
    updated_at: "2026-07-17T12:00:00Z",
  });
  assert.equal(watched.id, "sv3pt5-199");
  assert.equal(watched.watchlistId, "watch-1");
  assert.equal(watched.cardState, "graded");
  assert.equal(watched.gradingCompany, "PSA");
  assert.equal(watched.grade, "10");
  assert.equal(watched.targetPrice, 250);
  assert.equal(watched.currentPrice, null);
});

test("canonical identity separates same-name cards by set, language, number, and variant", () => {
  const base = {
    name: "Charizard",
    set: "Base Set",
    number: "4/102",
    language: "en",
    variant: "Unlimited Holofoil",
  };
  assert.notEqual(
    canonicalCardFingerprint(base),
    canonicalCardFingerprint({ ...base, set: "Base Set 2" }),
  );
  assert.notEqual(
    canonicalCardFingerprint(base),
    canonicalCardFingerprint({ ...base, language: "ja" }),
  );
  assert.notEqual(
    canonicalCardFingerprint(base),
    canonicalCardFingerprint({ ...base, variant: "1st Edition Holofoil" }),
  );
});

test("compatible observations never cross raw and graded state, grader, grade, condition, or currency", () => {
  const psa10 = {
    cardState: "graded",
    gradingCompany: "PSA",
    grade: "10",
    finish: "holofoil",
    currency: "USD",
    amount: 100,
  };
  assert.equal(
    isCompatibleObservation(psa10, {
      cardState: "graded",
      grader: "PSA",
      grade: "10",
      finish: "holofoil",
      currency: "USD",
    }),
    true,
  );
  assert.equal(
    isCompatibleObservation(psa10, {
      cardState: "graded",
      grader: "PSA",
      grade: "9",
      finish: "holofoil",
      currency: "USD",
    }),
    false,
  );
  assert.equal(
    isCompatibleObservation(psa10, {
      cardState: "graded",
      grader: "BGS",
      grade: "10",
      finish: "holofoil",
      currency: "USD",
    }),
    false,
  );
  assert.equal(
    isCompatibleObservation(psa10, {
      cardState: "raw",
      rawCondition: "near_mint",
      finish: "holofoil",
      currency: "USD",
    }),
    false,
  );
  assert.equal(
    isCompatibleObservation(
      { ...psa10, currency: "EUR" },
      {
        cardState: "graded",
        grader: "PSA",
        grade: "10",
        finish: "holofoil",
        currency: "USD",
      },
    ),
    false,
  );
});

test("deterministic valuation prefers PkmnPrices and reports stale and missing values", () => {
  const position = {
    cardState: "graded",
    grader: "PSA",
    grade: "10",
    currency: "USD",
  };
  const now = new Date("2026-07-16T12:00:00Z").getTime();
  const observations = [
    {
      provider: "cardladder",
      cardState: "graded",
      grader: "PSA",
      grade: "10",
      currency: "USD",
      amount: 120,
      observedAt: "2026-07-16T10:00:00Z",
    },
    {
      provider: "pkmnprices",
      cardState: "graded",
      grader: "PSA",
      grade: "10",
      currency: "USD",
      amount: 110,
      observedAt: "2026-07-10T10:00:00Z",
    },
  ];
  const result = selectValuation(observations, position, {
    now,
    staleAfterHours: 72,
  });
  assert.equal(result.selected.provider, "pkmnprices");
  assert.equal(result.stale, true);
  assert.equal(
    selectValuation(observations, { ...position, grade: "9" }).selected,
    null,
  );
});

test("observation dedupe key and anomaly checks are deterministic", () => {
  const row = {
    cardId: "a",
    variant: "holo",
    cardState: "raw",
    rawCondition: "near_mint",
    currency: "USD",
    provider: "pkmnprices",
    market: "tcgplayer",
    priceType: "market",
    observedAt: "2026-07-16",
    amount: 100,
  };
  assert.equal(observationKey(row), observationKey({ ...row }));
  assert.equal(
    detectPriceAnomaly({ amount: 100 }, { amount: 145 }, 40).type,
    "price_jump",
  );
  assert.equal(detectPriceAnomaly({ amount: 100 }, { amount: 120 }, 40), null);
});

test("money parsing and acquisition totals use exact minor units", () => {
  assert.equal(toMinorUnits("1000.05"), 100005);
  assert.equal(
    acquisitionTotal({
      quantity: 2,
      unitPrice: "1000.05",
      tax: "1.10",
      shipping: "2.20",
      marketplaceFees: "3.30",
      gradingFees: "4.40",
      otherCosts: "5.50",
    }),
    201660,
  );
});

test("one total acquisition input preserves every cent across multiple cards", () => {
  assert.deepEqual(acquisitionFromTotal("1000.00", 3), {
    unitPrice: "333.33",
    tax: "0.00",
    shipping: "0.00",
    marketplaceFees: "0.00",
    gradingFees: "0.00",
    otherCosts: "0.01",
    totalMinor: 100000,
  });
  assert.equal(acquisitionFromTotal("-1", 1), null);
});

test("grading estimate combines per-card service fees with trip costs", () => {
  assert.equal(
    gradingEstimate({ serviceFee: "32.99", quantity: 2, shipping: "18", insurance: "7.50" }),
    9148,
  );
});

test("grading decision reports incremental value, break-even, and owned profit", () => {
  assert.deepEqual(
    gradingDecision({
      rawValue: "100.00",
      expectedGradedValue: "180.00",
      quantity: 2,
      gradingCost: 8098,
      sellingCosts: "20.00",
      acquisitionCostPerCard: "70.00",
    }),
    {
      rawValueTotalMinor: 20000,
      expectedGradedValueTotalMinor: 36000,
      valueAddedMinor: 5902,
      breakEvenGradedValuePerCardMinor: 15049,
      potentialProfitMinor: 11902,
    },
  );
});

test("trade analysis totals both sides and recommends balancing cash", () => {
  assert.deepEqual(
    tradeAnalysis({
      giveItems: [{ quantity: 2, valuePerCard: "50.00" }],
      receiveItems: [{ quantity: 1, valuePerCard: "125.00" }],
      giveCash: "5.00",
      receiveCash: "0.00",
    }),
    {
      giveTotalMinor: 10500,
      receiveTotalMinor: 12500,
      differenceMinor: 2000,
      differencePercent: 16,
      verdict: "in_your_favor",
      cashToBalanceMinor: 2000,
      cashGoesTo: "them",
    },
  );
  assert.equal(
    tradeAnalysis({
      giveItems: [{ quantity: 1, valuePerCard: "100" }],
      receiveItems: [{ quantity: 1, valuePerCard: "103" }],
    }).verdict,
    "balanced",
  );
});

test("sale planner reports fees, net proceeds, profit, and break-even price", () => {
  assert.deepEqual(
    salePlan({
      quantity: 2,
      salePriceEach: "100.00",
      feePercent: "10",
      shipping: "5.00",
      otherCosts: "2.50",
      costBasisMinor: 12000,
      targetProfit: "50.00",
    }),
    {
      grossMinor: 20000,
      marketplaceFeesMinor: 2000,
      netProceedsMinor: 17250,
      costBasisMinor: 12000,
      profitMinor: 5250,
      roiPercent: 43.75,
      breakEvenPriceEachMinor: 7084,
      targetPriceEachMinor: 9862,
    },
  );
  assert.equal(salePlan({quantity:1,salePriceEach:"10",feePercent:100}),null);
});

test("future acquisition dates are rejected without override", () => {
  const result = validateAcquisition(
    {
      cardState: "raw",
      rawCondition: "near_mint",
      quantity: 1,
      unitPrice: "10",
      transactionDate: "2026-07-17",
    },
    "2026-07-16",
  );
  assert.equal(result.valid, false);
  assert.equal(
    result.errors.transactionDate,
    "Acquisition dates cannot be later than today.",
  );
});

test("FIFO allocates oldest distinct purchase lots first for partial sales", () => {
  const result = allocateFifo(
    [
      {
        id: "new",
        acquiredAt: "2025-01-01",
        quantityAcquired: 2,
        quantityRemaining: 2,
        totalCostMinor: 30000,
      },
      {
        id: "old",
        acquiredAt: "2024-01-01",
        quantityAcquired: 2,
        quantityRemaining: 2,
        totalCostMinor: 20000,
      },
    ],
    3,
  );
  assert.deepEqual(result.allocations, [
    { lotId: "old", quantity: 2, costMinor: 20000 },
    { lotId: "new", quantity: 1, costMinor: 15000 },
  ]);
  assert.equal(result.allocatedCost, 35000);
  assert.equal(result.unallocatedQuantity, 0);
});

test("performance handles quantity, partial sale, missing price, zero basis, and holding period", () => {
  const result = positionPerformance({
    quantityOwned: 2,
    remainingCostBasisMinor: 100000,
    currentUnitPrice: "625",
    netSaleProceedsMinor: 70000,
    allocatedSoldCostMinor: 50000,
  });
  assert.equal(result.currentValueMinor, 125000);
  assert.equal(result.unrealizedGainMinor, 25000);
  assert.equal(result.returnPercent, 25);
  assert.equal(result.realizedGainMinor, 20000);
  assert.equal(
    positionPerformance({
      quantityOwned: 1,
      remainingCostBasisMinor: 0,
      currentUnitPrice: "10",
    }).returnPercent,
    null,
  );
  assert.equal(
    positionPerformance({
      quantityOwned: 1,
      remainingCostBasisMinor: 1000,
      currentUnitPrice: null,
    }).currentValueMinor,
    null,
  );
  assert.equal(holdingDays("2025-06-25", "2025-06-30"), 5);
});

test("Alt and Card Ladder remain disabled without licensed access", () => {
  assert.equal(new AltProvider().isEnabled(), false);
  assert.equal(new CardLadderProvider().isEnabled(), false);
});
