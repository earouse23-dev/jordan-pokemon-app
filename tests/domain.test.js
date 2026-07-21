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
  batchAcquisitionPlan,
  gradingEstimate,
  gradingDecision,
  gradingBatchPlan,
  tradeAnalysis,
  tradeSummary,
  salePlan,
  buyOfferPlan,
  listingReadiness,
  holdingDays,
  inventoryHealth,
  insuranceDocumentation,
  positionPerformance,
  portfolioReview,
  portfolioActions,
  purchaseEntryPoints,
  businessSummary,
  liquidationPlan,
  blendedPosition,
  targetAlertChanges,
  toMinorUnits,
  validateAcquisition,
  watchPerformance,
} from "../lib/portfolio.js";
import {
  bulkOrganizePositions,
  createImportedPosition,
  hydratePosition,
  hydrateWatchlistEntry,
  loadRowsInChunks,
  loadRowsInPages,
  remapCollectionPosition,
  updatePosition,
} from "../lib/supabase-data.js";

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

test("batch raw intake validates every row without merging exact variants or costs", () => {
  const plan = batchAcquisitionPlan(
    [
      {
        id: "one",
        variant: "Holofoil",
        quantity: "2",
        totalAcquisitionCost: "10.01",
      },
      {
        id: "two",
        variant: "Reverse Holofoil",
        quantity: "1",
        totalAcquisitionCost: "4.25",
      },
    ],
    { rawCondition: "near_mint", transactionDate: "2026-07-20" },
    "2026-07-20",
  );
  assert.equal(plan.errors.length, 0);
  assert.equal(plan.ready.length, 2);
  assert.equal(plan.ready[0].variant, "Holofoil");
  assert.equal(plan.ready[0].totalMinor, 1001);
  assert.equal(plan.ready[1].variant, "Reverse Holofoil");
  assert.equal(plan.ready[1].totalMinor, 425);
  const invalid = batchAcquisitionPlan(
    [{ id: "bad", variant: "", quantity: "0", totalAcquisitionCost: "" }],
    { rawCondition: "near_mint", transactionDate: "2026-07-21" },
    "2026-07-20",
  );
  assert.equal(invalid.ready.length, 0);
  assert.ok(invalid.errors.length >= 1);
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

test("watchlist hydration preserves an exact sealed product target", () => {
  const watched = hydrateWatchlistEntry({
    id: "sealed-watch",
    card_id: null,
    provider_card_id: "sealed:5678",
    identity_snapshot: {
      providerCardId: "sealed:5678",
      name: "Crown Zenith Elite Trainer Box",
      set: "Crown Zenith",
      variant: "Sealed product",
      productType: "elite_trainer_box",
      externalIds: { pkmnpricesSealed: 5678 },
    },
    variant_key: "Sealed product",
    card_state: "sealed",
    raw_condition: null,
    grader: null,
    grade: null,
    target_price: 70,
    starting_market_price: 85,
    currency: "USD",
    created_at: "2026-07-20T12:00:00Z",
    updated_at: "2026-07-20T12:00:00Z",
  });
  assert.equal(watched.id, "sealed:5678");
  assert.equal(watched.cardState, "sealed");
  assert.equal(watched.condition, "Sealed");
  assert.equal(watched.productType, "elite_trainer_box");
  assert.deepEqual(watched.externalIds, { pkmnpricesSealed: 5678 });
});

test("position hydration attaches FIFO basis and realized gain to each sale", () => {
  const position = hydratePosition(
    {
      id: "position-1",
      identity_snapshot: { name: "Charizard" },
      card_state: "raw",
      raw_condition: "near_mint",
      quantity: 0,
      currency: "USD",
      tags: ["Favorites"],
    },
    [
      {
        id: "sale-1",
        transaction_type: "sale",
        transaction_date: "2026-07-01",
        quantity: 1,
        subtotal: 150,
        net_proceeds: 135,
        currency: "USD",
      },
    ],
    [],
    [
      {
        sale_transaction_id: "sale-1",
        allocated_cost: 80,
      },
    ],
  );
  assert.equal(position.transactions[0].allocatedCost, 80);
  assert.equal(position.transactions[0].realizedGain, 55);
  assert.deepEqual(position.tags, ["Favorites"]);
});

test("unknown imported basis and dates remain unknown through hydration and sales", () => {
  const position = hydratePosition(
    {
      id: "position-unknown",
      identity_snapshot: { name: "Diglett" },
      card_state: "raw",
      raw_condition: "lightly_played",
      quantity: 1,
      currency: "USD",
      tags: [],
    },
    [
      {
        id: "purchase-unknown",
        transaction_type: "purchase",
        transaction_date: "2026-07-20",
        quantity: 2,
        unit_price: 0,
        total_cost: 0,
        currency: "USD",
      },
      {
        id: "sale-unknown",
        transaction_type: "sale",
        transaction_date: "2026-07-21",
        quantity: 1,
        net_proceeds: 10,
        currency: "USD",
      },
    ],
    [
      {
        id: "lot-unknown",
        purchase_transaction_id: "purchase-unknown",
        acquired_at: "2026-07-20",
        acquired_at_known: false,
        quantity_acquired: 2,
        quantity_remaining: 1,
        total_cost: 0,
        remaining_cost: 0,
        cost_basis_known: false,
        currency: "USD",
      },
    ],
    [
      {
        sale_transaction_id: "sale-unknown",
        purchase_lot_id: "lot-unknown",
        allocated_cost: 0,
        cost_basis_known: false,
      },
    ],
  );
  assert.equal(position.costBasis, null);
  assert.equal(position.cost, null);
  assert.equal(position.purchaseDate, "");
  assert.equal(position.realizedGain, null);
  assert.equal(position.allocatedSoldCost, null);
  assert.equal(position.transactions[0].date, "");
  assert.equal(position.transactions[0].totalCost, null);
  assert.equal(position.transactions[1].realizedGain, null);
  assert.equal(position.lots[0].remainingCost, null);
  assert.equal(position.lots[0].costBasisKnown, false);
});

test("position hydration restores durable exact-series price history", () => {
  const position = hydratePosition(
    {
      id: "position-history",
      identity_snapshot: { name: "Charizard", variant: "Holofoil" },
      card_state: "graded",
      raw_condition: null,
      grader: "PSA",
      grade: 10,
      quantity: 1,
      currency: "USD",
      tags: [],
    },
    [],
    [],
    [],
    [
      {
        provider: "ebay",
        provider_variant_id: "4521:ebay:holo:PSA:10",
        currency: "USD",
        provider_condition: null,
        finish: "holofoil",
        grader: "PSA",
        grade: 10,
        grade_label: "10",
        amount: "1200.50",
        price_low: "1100",
        price_high: "1300",
        sales_count: 4,
        observed_at: "2026-07-01T00:00:00Z",
        granularity: "day",
        quality: { aggregator: "pkmnprices" },
      },
    ],
  );
  assert.deepEqual(position.priceHistory, [
    {
      provider: "ebay",
      providerVariantId: "4521:ebay:holo:PSA:10",
      currency: "USD",
      condition: null,
      finish: "holofoil",
      gradingCompany: "PSA",
      grade: "10",
      amount: 1200.5,
      low: 1100,
      high: 1300,
      saleCount: 4,
      recordedAt: "2026-07-01T00:00:00Z",
      granularity: "day",
      quality: { aggregator: "pkmnprices" },
    },
  ]);
});

test("sealed positions hydrate from the same private FIFO portfolio model", () => {
  const position = hydratePosition(
    {
      id: "sealed-position",
      identity_snapshot: {
        providerCardId: "sealed:5678",
        name: "Crown Zenith Elite Trainer Box",
        set: "Crown Zenith",
        variant: "Sealed product",
        productType: "elite_trainer_box",
        externalIds: { pkmnpricesSealed: 5678 },
      },
      card_state: "sealed",
      raw_condition: null,
      grader: null,
      grade: null,
      quantity: 2,
      currency: "USD",
      tags: [],
    },
    [],
    [
      {
        id: "sealed-lot",
        acquired_at: "2026-07-01",
        quantity_acquired: 2,
        quantity_remaining: 2,
        total_cost: 160,
        remaining_cost: 160,
        currency: "USD",
      },
    ],
    [],
  );
  assert.equal(position.id, "sealed:5678");
  assert.equal(position.cardState, "sealed");
  assert.equal(position.condition, "Sealed");
  assert.equal(position.productType, "elite_trainer_box");
  assert.equal(position.costBasis, 160);
});

test("position updates only send fields the user changed", async () => {
  let updated;
  let matchedId;
  const client = {
    from(table) {
      assert.equal(table, "collection_items");
      return {
        update(payload) {
          updated = payload;
          return {
            async eq(column, id) {
              assert.equal(column, "id");
              matchedId = id;
              return { error: null };
            },
          };
        },
      };
    },
  };
  await updatePosition(client, "position-1", { tags: ["Favorites"] });
  assert.deepEqual(updated, { tags: ["Favorites"] });
  assert.equal(matchedId, "position-1");
});

test("catalog correction uses one atomic owner-scoped remap RPC", async () => {
  let call;
  const client = {
    async rpc(name, input) {
      call = { name, input };
      return { data: "position-1", error: null };
    },
  };
  const identity = {
    providerCardId: "tcgdex:en:base1-4",
    name: "Charizard",
    set: "Base Set",
    number: "4/102",
    language: "en",
    variant: "1st Edition Holofoil",
    externalIds: { tcgdex: "base1-4" },
  };
  const result = await remapCollectionPosition(client, {
    collectionItemId: "position-1",
    identity,
  });
  assert.equal(result, "position-1");
  assert.deepEqual(call, {
    name: "remap_collection_position",
    input: {
      p_collection_item_id: "position-1",
      p_identity: identity,
      p_card_id: null,
      p_variant_id: null,
    },
  });
});

test("CSV retries recover the existing owner-visible position after an idempotency conflict", async () => {
  const client = {
    async rpc() {
      return { data: null, error: { code: "23505", message: "duplicate key" } };
    },
    from(table) {
      assert.equal(table, "collection_transactions");
      return {
        select(columns) {
          assert.equal(columns, "collection_item_id");
          return this;
        },
        eq(column, value) {
          assert.equal(column, "idempotency_key");
          assert.equal(value, "mica-csv-v1-test");
          return this;
        },
        async maybeSingle() {
          return { data: { collection_item_id: "position-1" }, error: null };
        },
      };
    },
  };
  assert.deepEqual(
    await createImportedPosition(client, {
      identity: {},
      cardState: "raw",
      rawCondition: "near_mint",
      quantity: 1,
      unitPrice: 10,
      transactionDate: "2026-07-20",
      idempotencyKey: "mica-csv-v1-test",
    }),
    { id: "position-1", reused: true },
  );
});

test("bulk organization only calls the owner-scoped RPC with allowed fields", async () => {
  let called;
  const client = {
    async rpc(name, values) {
      called = { name, values };
      return {
        data: [
          { collection_item_id: "position-1" },
          { collection_item_id: "position-2" },
        ],
        error: null,
      };
    },
  };
  const ids = await bulkOrganizePositions(client, {
    ids: ["position-1", "position-2", "position-1"],
    labelMode: "add",
    label: "Trade binder",
    locationMode: "set",
    location: "Case A",
    status: "owned",
    quantity: 999,
  });
  assert.deepEqual(ids, ["position-1", "position-2"]);
  assert.deepEqual(called, {
    name: "bulk_organize_collection_items",
    values: {
      p_ids: ["position-1", "position-2"],
      p_label: "Trade binder",
      p_label_mode: "add",
      p_location: "Case A",
      p_location_mode: "set",
      p_status: "owned",
    },
  });
});

test("bulk organization rejects empty, oversized, and no-op requests", async () => {
  const client = {
    rpc: () => assert.fail("invalid requests must not reach Supabase"),
  };
  await assert.rejects(
    () => bulkOrganizePositions(client, { ids: [] }),
    /between 1 and 500/,
  );
  await assert.rejects(
    () => bulkOrganizePositions(client, { ids: ["position-1"] }),
    /at least one change/,
  );
  await assert.rejects(
    () =>
      bulkOrganizePositions(client, {
        ids: ["position-1"],
        labelMode: "add",
        label: "x".repeat(41),
      }),
    /40 characters/,
  );
});

test("large owned-row lookups use bounded filters and preserve every result", async () => {
  const calls = [];
  const client = {
    from(table) {
      const builder = {
        rows: [],
        select(columns) {
          assert.equal(table, "purchase_lots");
          assert.equal(columns, "*");
          return this;
        },
        in(key, ids) {
          assert.equal(key, "collection_item_id");
          assert.ok(ids.length <= 200);
          calls.push([...ids]);
          this.rows = ids.map((id) => ({ collection_item_id: id }));
          return this;
        },
        order(column) {
          assert.equal(column, "acquired_at");
          return Promise.resolve({ data: this.rows, error: null });
        },
      };
      return builder;
    },
  };
  const ids = Array.from({ length: 450 }, (_, index) => `position-${index}`);
  const rows = await loadRowsInChunks(client, {
    table: "purchase_lots",
    key: "collection_item_id",
    ids,
    order: "acquired_at",
  });
  assert.equal(calls.length, 3);
  assert.equal(rows.length, 450);
  assert.equal(new Set(rows.map((row) => row.collection_item_id)).size, 450);
});

test("large portfolios page past the API row limit with stable ordering", async () => {
  const ranges = [];
  const allRows = Array.from({ length: 2050 }, (_, index) => ({ id: index }));
  const client = {
    from(table) {
      assert.equal(table, "collection_items");
      return {
        select() {
          return this;
        },
        order(column, options) {
          assert.ok(["created_at", "id"].includes(column));
          assert.equal(options.ascending, false);
          return this;
        },
        async range(from, to) {
          ranges.push([from, to]);
          return { data: allRows.slice(from, to + 1), error: null };
        },
      };
    },
  };
  const rows = await loadRowsInPages(client, {
    table: "collection_items",
    order: "created_at",
    secondaryOrder: "id",
    ascending: false,
  });
  assert.equal(rows.length, 2050);
  assert.deepEqual(ranges, [
    [0, 999],
    [1000, 1999],
    [2000, 2999],
  ]);
});

test("seller listing fields hydrate and update without leaking into unrelated writes", async () => {
  const position = hydratePosition({
    id: "listing-1",
    identity_snapshot: { name: "Pikachu" },
    card_state: "raw",
    raw_condition: "near_mint",
    quantity: 1,
    status: "listed",
    asking_price: "125.50",
    listing_venue: "Card show",
    listed_at: "2026-07-18",
    price_reviewed_at: "2026-07-20",
    currency: "USD",
  });
  assert.equal(position.askingPrice, 125.5);
  assert.equal(position.listingVenue, "Card show");
  assert.equal(position.listedAt, "2026-07-18");
  assert.equal(position.priceReviewedAt, "2026-07-20");

  let updated;
  const client = {
    from() {
      return {
        update(payload) {
          updated = payload;
          return {
            async eq() {
              return { error: null };
            },
          };
        },
      };
    },
  };
  await updatePosition(client, "listing-1", {
    status: "listed",
    askingPrice: "130.00",
    listingVenue: "eBay",
    listedAt: "2026-07-19",
    priceReviewedAt: "2026-07-20",
  });
  assert.deepEqual(updated, {
    status: "listed",
    asking_price: "130.00",
    listing_venue: "eBay",
    listed_at: "2026-07-19",
    price_reviewed_at: "2026-07-20",
  });
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

test("additional purchases preview the blended remaining position", () => {
  assert.deepEqual(
    blendedPosition({
      currentQuantity: 2,
      currentCostBasis: "200.00",
      newQuantity: 1,
      newTotalCost: "70.00",
      currentUnitPrice: "120.00",
    }),
    {
      quantity: 3,
      costBasisMinor: 27000,
      averageCostMinor: 9000,
      currentAverageCostMinor: 10000,
      averageChangeMinor: -1000,
      marketValueMinor: 36000,
      unrealizedGainMinor: 9000,
    },
  );
  assert.equal(
    blendedPosition({
      currentQuantity: 2,
      currentCostBasis: null,
      newQuantity: 1,
      newTotalCost: "70.00",
    }),
    null,
  );
});

test("purchase entry points compare each lot with the current exact price", () => {
  assert.deepEqual(
    purchaseEntryPoints(
      [
        {
          type: "purchase",
          date: "2026-06-25",
          quantity: 2,
          totalCost: 1000,
        },
        {
          type: "sale",
          date: "2026-07-01",
          quantity: 1,
          totalCost: 1,
        },
        {
          type: "purchase",
          date: "2026-05-01",
          quantity: 1,
          unitPrice: 400,
        },
      ],
      600,
    ),
    [
      {
        date: "2026-05-01",
        quantity: 1,
        totalCostMinor: 40000,
        unitCostMinor: 40000,
        currentUnitPriceMinor: 60000,
        changeMinor: 20000,
        returnPercent: 50,
      },
      {
        date: "2026-06-25",
        quantity: 2,
        totalCostMinor: 100000,
        unitCostMinor: 50000,
        currentUnitPriceMinor: 60000,
        changeMinor: 10000,
        returnPercent: 20,
      },
    ],
  );
});

test("grading estimate combines per-card service fees with trip costs", () => {
  assert.equal(
    gradingEstimate({
      serviceFee: "32.99",
      quantity: 2,
      shipping: "18",
      insurance: "7.50",
    }),
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

test("batch grading planner shares trip costs across selected raw cards", () => {
  assert.deepEqual(
    gradingBatchPlan({
      items: [
        {
          quantity: 2,
          rawValue: "40.00",
          expectedGradedValue: "90.00",
          acquisitionCost: "25.00",
        },
        {
          quantity: 1,
          rawValue: "100.00",
          expectedGradedValue: "175.00",
          acquisitionCost: "70.00",
        },
      ],
      serviceFee: "20.00",
      shipping: "18.00",
      insurance: "7.00",
      sellingCosts: "15.00",
    }),
    {
      cardCount: 3,
      rawValueTotalMinor: 18000,
      expectedGradedValueTotalMinor: 35500,
      serviceFeesMinor: 6000,
      gradingCostMinor: 8500,
      valueAddedMinor: 7500,
      breakEvenAverageMinor: 9334,
      potentialProfitMinor: 13500,
    },
  );
  assert.equal(gradingBatchPlan({ items: [], serviceFee: "20.00" }), null);
  assert.equal(
    gradingBatchPlan({
      items: [
        {
          quantity: 2,
          availableQuantity: 1,
          rawValue: "10",
          expectedGradedValue: "30",
        },
      ],
      serviceFee: "20.00",
    }),
    null,
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

test("trade summary shares deal terms without private portfolio fields", () => {
  const text = tradeSummary(
    {
      giveItems: [
        {
          name: "Charizard",
          set: "Base Set",
          number: "4/102",
          quantity: 1,
          valuePerCard: "100.00",
          context: "PSA 10",
          notes: "private note",
          location: "Safe A1",
          costBasis: 25,
        },
      ],
      receiveItems: [
        {
          name: "Blastoise",
          set: "Base Set",
          number: "2/102",
          quantity: 1,
          valuePerCard: "120.00",
          context: "Raw · Near Mint",
        },
      ],
      giveCash: "5.00",
      receiveCash: "0.00",
    },
    { date: "2026-07-17" },
  );
  assert.match(
    text,
    /Charizard[\s\S]+PSA 10[\s\S]+Blastoise[\s\S]+receive \$15\.00 more/i,
  );
  assert.doesNotMatch(text, /private note|Safe A1|cost basis/i);
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
  assert.equal(
    salePlan({ quantity: 1, salePriceEach: "10", feePercent: 100 }),
    null,
  );
});

test("buy offer planner protects a target ROI and previews a proposed deal", () => {
  assert.deepEqual(
    buyOfferPlan({
      quantity: 2,
      expectedResaleEach: "100.00",
      feePercent: "10",
      otherSellingCosts: "10.00",
      targetRoiPercent: "25",
      plannedOfferEach: "60.00",
    }),
    {
      grossMinor: 20000,
      marketplaceFeesMinor: 2000,
      otherSellingCostsMinor: 1000,
      netBeforeAcquisitionMinor: 17000,
      maxAcquisitionMinor: 13600,
      maxOfferEachMinor: 6800,
      plannedOfferTotalMinor: 12000,
      projectedProfitMinor: 5000,
      projectedRoiPercent: 41.66666666666667,
    },
  );
  assert.equal(
    buyOfferPlan({ quantity: 1, expectedResaleEach: "10", feePercent: 100 }),
    null,
  );
});

test("seller readiness finds incomplete and price-drifted active listings", () => {
  assert.deepEqual(
    listingReadiness(
      [
        {
          status: "listed",
          quantity: 2,
          askingPrice: 110,
          price: 100,
          listingVenue: "eBay",
          priceReviewedAt: "2026-07-19",
        },
        {
          status: "listed",
          quantity: 1,
          askingPrice: null,
          price: 50,
          listingVenue: "",
          priceReviewedAt: "",
        },
        { status: "owned", quantity: 4, askingPrice: 20, price: 20 },
      ],
      "2026-07-20",
    ),
    {
      positions: 2,
      units: 3,
      askingValueMinor: 22000,
      marketValueMinor: 25000,
      pricedPositions: 2,
      missingAsk: 1,
      missingVenue: 1,
      needsReview: 2,
    },
  );
});

test("business summary reports dated cash flow and FIFO-covered profit without mixing currencies", () => {
  assert.deepEqual(
    businessSummary(
      [
        {
          currency: "USD",
          transactions: [
            {
              type: "purchase",
              date: "2026-06-01",
              quantity: 2,
              totalCost: 100,
              currency: "USD",
            },
            {
              type: "sale",
              date: "2026-07-01",
              quantity: 1,
              subtotal: 150,
              netProceeds: 135,
              allocatedCost: 80,
              currency: "USD",
            },
            {
              type: "sale",
              date: "2025-01-01",
              quantity: 1,
              subtotal: 50,
              netProceeds: 45,
              allocatedCost: 30,
              currency: "USD",
            },
            {
              type: "sale",
              date: "2026-07-02",
              quantity: 1,
              subtotal: 60,
              netProceeds: 55,
              allocatedCost: 40,
              currency: "EUR",
            },
          ],
        },
      ],
      { from: "2026-01-01", to: "2026-12-31", currency: "USD" },
    ),
    {
      currency: "USD",
      transactionCount: 2,
      purchaseCount: 1,
      saleCount: 1,
      unitsPurchased: 2,
      unitsSold: 1,
      acquisitionSpendMinor: 10000,
      grossSalesMinor: 15000,
      netSalesMinor: 13500,
      sellingCostsMinor: 1500,
      cashFlowMinor: 3500,
      realizedProfitMinor: 5500,
      realizedCoverage: 1,
      skippedCurrencyCount: 1,
    },
  );
  assert.equal(
    businessSummary([], { from: "2026-12-31", to: "2026-01-01" }),
    null,
  );
});

test("portfolio review separates price gaps, below-cost positions, older stock, and reached targets", () => {
  const positions = [
    {
      id: "unpriced",
      price: null,
      quantity: 1,
      costBasis: 50,
      purchaseDate: "2026-06-01",
    },
    {
      id: "loss",
      price: 75,
      quantity: 1,
      costBasis: 100,
      purchaseDate: "2025-01-01",
    },
    {
      id: "gain",
      price: 125,
      quantity: 1,
      costBasis: 100,
      purchaseDate: "2026-06-01",
    },
  ];
  const watchlist = [
    { id: "hit", targetPrice: 80, currentPrice: 75 },
    { id: "waiting", targetPrice: 80, currentPrice: 90 },
  ];
  const review = portfolioReview(positions, watchlist, "2026-07-17");
  assert.deepEqual(
    review.needsPricing.map((item) => item.id),
    ["unpriced"],
  );
  assert.deepEqual(
    review.belowCost.map((item) => item.id),
    ["loss"],
  );
  assert.deepEqual(
    review.olderInventory.map((item) => item.id),
    ["loss"],
  );
  assert.deepEqual(
    review.reachedTargets.map((item) => item.id),
    ["hit"],
  );
});

test("portfolio actions put time-sensitive and data-quality work first", () => {
  const positions = [
    {
      id: "unpriced",
      price: null,
      quantity: 1,
      costBasis: 50,
      purchaseDate: "2026-06-01",
    },
    {
      id: "loss",
      price: 75,
      quantity: 1,
      costBasis: 100,
      purchaseDate: "2025-01-01",
    },
  ];
  const watchlist = [{ id: "hit", targetPrice: 80, currentPrice: 75 }];
  const actions = portfolioActions(positions, watchlist, "2026-07-17");
  assert.deepEqual(
    actions.map((action) => action.key),
    ["targets", "pricing", "below-cost", "older"],
  );
  assert.deepEqual(
    actions.map((action) => action.priority),
    [1, 2, 3, 4],
  );
  assert.equal(portfolioActions([], [], "2026-07-17").length, 0);
});

test("watch performance reports exact movement from the saved starting reference", () => {
  assert.deepEqual(
    watchPerformance({ startingPrice: "100.00", currentPrice: "85.50" }),
    {
      startingMinor: 10000,
      currentMinor: 8550,
      changeMinor: -1450,
      changePercent: -14.5,
    },
  );
  assert.equal(
    watchPerformance({ startingPrice: null, currentPrice: "85.50" }),
    null,
  );
  assert.equal(
    watchPerformance({ startingPrice: "0", currentPrice: "85.50" }),
    null,
  );
});

test("target alerts fire once per crossing and reset above the buy price", () => {
  const reached = {
    watchlistId: "watch-1",
    targetPrice: "90.00",
    currentPrice: "85.00",
    currency: "USD",
  };
  const first = targetAlertChanges([reached]);
  assert.deepEqual(first.next, { "watch-1": "USD:9000" });
  assert.equal(first.notifications.length, 1);
  assert.equal(
    targetAlertChanges([reached], first.next).notifications.length,
    0,
  );
  const reset = targetAlertChanges(
    [{ ...reached, currentPrice: "95.00" }],
    first.next,
  );
  assert.deepEqual(reset.next, {});
  assert.equal(
    targetAlertChanges([reached], reset.next).notifications.length,
    1,
  );
});

test("insurance documentation identifies missing ownership records", () => {
  assert.deepEqual(
    insuranceDocumentation([
      {
        quantity: 2,
        cardState: "graded",
        gradingCompany: "PSA",
        certificationNumber: "123",
        location: "Safe A1",
        costBasis: 200,
        price: 150,
      },
      {
        quantity: 1,
        cardState: "graded",
        gradingCompany: "CGC",
        certificationNumber: "",
        location: "",
        costBasis: null,
        price: null,
      },
    ]),
    {
      positions: 2,
      cards: 3,
      missingLocation: 1,
      missingCertification: 1,
      missingCost: 1,
      missingPrice: 1,
    },
  );
});

test("liquidation planning separates reference value from realistic take-home", () => {
  const result = liquidationPlan(
    [
      {
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
        condition: "Near Mint",
        quantity: 2,
        price: "100.00",
        costBasis: "120.00",
        currency: "USD",
      },
      {
        name: "Umbreon",
        quantity: 1,
        price: null,
        costBasis: "50.00",
        currency: "USD",
      },
      {
        name: "Pikachu",
        quantity: 3,
        price: "10.00",
        costBasis: "15.00",
        currency: "EUR",
      },
    ],
    {
      referencePercent: 90,
      feePercent: 10,
      totalSellingCosts: "5.00",
    },
  );
  assert.equal(result.referenceValueMinor, 20000);
  assert.equal(result.expectedGrossMinor, 18000);
  assert.equal(result.marketplaceFeesMinor, 1800);
  assert.equal(result.netProceedsMinor, 15700);
  assert.equal(result.profitMinor, 3700);
  assert.equal(result.roiPercent, (3700 / 12000) * 100);
  assert.equal(result.pricedUnits, 2);
  assert.equal(result.unpricedUnits, 1);
  assert.equal(result.skippedCurrencyUnits, 3);
  assert.equal(result.rows.length, 1);
});

test("liquidation planning does not claim profit with incomplete basis", () => {
  const result = liquidationPlan([
    { name: "Known", quantity: 1, price: 25, costBasis: 10, currency: "USD" },
    {
      name: "Unknown",
      quantity: 2,
      price: 5,
      costBasis: null,
      currency: "USD",
    },
  ]);
  assert.equal(result.netProceedsMinor, 3500);
  assert.equal(result.knownCostBasisMinor, 1000);
  assert.equal(result.unknownBasisUnits, 2);
  assert.equal(result.profitMinor, null);
  assert.equal(result.breakEvenReferencePercent, null);
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

test("inventory health uses remaining lots for aging and exact priced positions for concentration", () => {
  const health = inventoryHealth(
    [
      {
        name: "Charizard",
        currency: "USD",
        quantity: 2,
        price: 100,
        lots: [
          { acquiredAt: "2026-01-01", quantityRemaining: 1, remainingCost: 50 },
          { acquiredAt: "2026-07-01", quantityRemaining: 1, remainingCost: 60 },
        ],
      },
      {
        name: "Pikachu",
        currency: "USD",
        quantity: 1,
        price: 50,
        purchaseDate: "2026-04-01",
        costBasis: 40,
      },
      { name: "Mew", currency: "EUR", quantity: 1, price: 20 },
    ],
    { today: "2026-07-17", currency: "USD" },
  );
  assert.equal(
    health.buckets.find((bucket) => bucket.key === "0-30").quantity,
    1,
  );
  assert.equal(
    health.buckets.find((bucket) => bucket.key === "91-180").quantity,
    1,
  );
  assert.equal(
    health.buckets.find((bucket) => bucket.key === "181+").quantity,
    1,
  );
  assert.equal(health.totalCostBasis, 150);
  assert.equal(health.topPosition.name, "Charizard");
  assert.equal(health.topPosition.sharePercent, 80);
  assert.equal(health.topThreeSharePercent, 100);
  assert.equal(health.skippedCurrencyPositions, 1);
  assert.equal(health.unknownBasisQuantity, 0);
});

test("unknown FIFO basis is excluded from performance and cost-based review", () => {
  const allocation = allocateFifo(
    [
      {
        id: "unknown",
        acquiredAt: "2026-01-01",
        quantityAcquired: 2,
        quantityRemaining: 2,
        totalCostMinor: null,
        costBasisKnown: false,
      },
    ],
    1,
  );
  assert.equal(allocation.allocatedCost, null);
  const performance = positionPerformance({
    quantityOwned: 1,
    remainingCostBasisMinor: null,
    currentUnitPrice: "10",
    netSaleProceedsMinor: 1000,
    allocatedSoldCostMinor: null,
  });
  assert.equal(performance.currentValueMinor, 1000);
  assert.equal(performance.unrealizedGainMinor, null);
  assert.equal(performance.realizedGainMinor, null);
  assert.equal(
    portfolioReview([{ price: 1, quantity: 1, costBasis: null }]).belowCost
      .length,
    0,
  );
  assert.equal(
    inventoryHealth([
      {
        currency: "USD",
        quantity: 1,
        price: 10,
        lots: [
          {
            acquiredAt: "",
            quantityRemaining: 1,
            remainingCost: null,
            costBasisKnown: false,
          },
        ],
      },
    ]).unknownBasisQuantity,
    1,
  );
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
