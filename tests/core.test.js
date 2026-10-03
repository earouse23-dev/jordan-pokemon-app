import test from "node:test";
import assert from "node:assert/strict";
import {
  accountBackupJson,
  calculateTotals,
  collectionToCsv,
  collectionWindow,
  importRecordKey,
  parseCollectionCsv,
  isStale,
  localIsoDate,
  matchesSearch,
  missingSetChecklist,
  money,
  ownedCardSummary,
  portfolioSnapshot,
  runBoundedTasks,
  sameCatalogCard,
  sameCatalogPrinting,
  safeCsvCell,
  selectedInventoryShare,
  transactionReportCsv,
} from "../lib/core.js";

test("local calendar dates do not roll over at UTC midnight", () => {
  const localLateEvening = new Date(2026, 6, 20, 23, 30, 0);
  assert.equal(localIsoDate(localLateEvening), "2026-07-20");
  assert.equal(localIsoDate("not-a-date"), "");
});

test("large collection windows render bounded pages without losing totals", () => {
  const items = Array.from({ length: 250 }, (_, index) => ({ id: index }));
  const first = collectionWindow(items, 100);
  assert.equal(first.displayed.length, 100);
  assert.equal(first.total, 250);
  assert.equal(first.remaining, 150);
  const expanded = collectionWindow(items, 200);
  assert.equal(expanded.displayed.at(-1).id, 199);
  assert.equal(expanded.remaining, 50);
});

test("CSV import keys are stable, exact, and distinguish duplicate rows", async () => {
  const record = {
    id: "sv3pt5-151",
    name: "Mew ex",
    variant: "Holofoil",
    quantity: 1,
    totalAcquisitionCost: 12.34,
    tags: ["Binder", "Favorites"],
  };
  const first = await importRecordKey(record, 0);
  assert.equal(
    first,
    await importRecordKey({ ...record, tags: [...record.tags].reverse() }, 0),
  );
  assert.notEqual(first, await importRecordKey(record, 1));
  assert.notEqual(
    first,
    await importRecordKey({ ...record, variant: "Reverse Holofoil" }, 0),
  );
  assert.match(first, /^mica-csv-v1-[a-f0-9]{64}$/);
});

test("TCGplayer CSV exports map exact identity without inventing acquisition cost", () => {
  const csv = [
    "Product ID,TCGplayer Id,Product Line,Set Name,Product Name,Number,Printing,Rarity,Condition,TCG Market Price,Total Quantity",
    '107044,2999078,Pokemon,"Base Set (Shadowless)",Diglett,047/102,Foil,Common,Lightly Played,0.73,2',
  ].join("\n");
  const result = parseCollectionCsv(csv);
  assert.equal(result.source, "TCGplayer");
  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.records[0], {
    id: "tcgplayer:107044",
    externalIds: { tcgplayer: "107044" },
    name: "Diglett",
    set: "Base Set (Shadowless)",
    number: "047/102",
    variant: "Holofoil",
    condition: "Lightly Played",
    gradingCompany: "",
    grade: "",
    quantity: 2,
    cost: null,
    price: 0.73,
    tags: [],
    folder: "",
    location: "",
    customFields: {},
    notes: "",
    source: "TCGplayer",
  });
});

test("cross-app CSV import rejects non-Pokémon product lines", () => {
  const result = parseCollectionCsv(
    "TCGplayer ID,Product Line,Product Name,Total Quantity\n123,Magic,Black Lotus,1",
  );
  assert.equal(result.source, "TCGplayer");
  assert.equal(result.records.length, 0);
  assert.match(result.errors[0], /not Pok.mon/);
});

test("bounded task runner limits concurrency and returns paused work", async () => {
  let active = 0;
  let peak = 0;
  let stop = false;
  const result = await runBoundedTasks(
    Array.from({ length: 12 }, (_, index) => index),
    async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      if (item === 3) stop = true;
      return item * 2;
    },
    { concurrency: 3, shouldStop: () => stop },
  );
  assert.ok(peak <= 3);
  assert.ok(result.completed >= 4);
  assert.ok(result.unprocessed.length > 0);
  assert.equal(result.succeeded, result.completed);
});

test("catalog ownership matches provider IDs and exact fallback identity", () => {
  const card = {
    id: "tcgdex:en:base1-4",
    externalIds: { tcgdex: "base1-4" },
    name: "Charizard",
    set: "Base Set",
    number: "4/102",
    language: "en",
  };
  assert.equal(
    sameCatalogCard(card, {
      id: "stored-position",
      externalIds: { tcgdex: "base1-4" },
    }),
    true,
  );
  assert.equal(
    sameCatalogCard(card, {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      language: "en",
    }),
    true,
  );
  assert.equal(
    sameCatalogCard(card, {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      language: "ja",
    }),
    false,
  );
  assert.deepEqual(
    ownedCardSummary(card, [
      { ...card, quantity: 2 },
      { ...card, id: "second-position", quantity: 1 },
      { ...card, id: "sold-out", quantity: 0 },
      {
        ...card,
        id: "different",
        externalIds: { tcgdex: "base1-6" },
        number: "6/102",
        quantity: 5,
      },
    ]),
    { quantity: 3, positions: 2 },
  );
});

test("catalog ownership never matches a different language through shared IDs", () => {
  const english = {
    id: "base1-4",
    language: "en",
    externalIds: { tcgdex: "base1-4", tcgplayer: "123" },
  };
  assert.equal(sameCatalogCard(english, { ...english, language: "ja" }), false);
  assert.equal(
    sameCatalogCard(english, { ...english, id: "other", language: "Japanese" }),
    false,
  );
  assert.equal(
    sameCatalogCard(english, { ...english, language: "English" }),
    true,
  );
});

test("exact printing distinguishes finish, edition, promo, and unknown versions", () => {
  const normal = { id: "base1-58", language: "en", variant: "Normal" };
  assert.equal(
    sameCatalogPrinting(normal, { ...normal, variant: "Non-holo" }),
    true,
  );
  assert.equal(
    sameCatalogPrinting(normal, { ...normal, variant: "Reverse Holofoil" }),
    false,
  );
  assert.equal(
    sameCatalogPrinting(normal, { ...normal, edition: "1st edition" }),
    false,
  );
  assert.equal(
    sameCatalogPrinting(normal, { ...normal, promoType: "staff" }),
    false,
  );
  assert.equal(sameCatalogPrinting(normal, { ...normal, variant: "" }), false);
  assert.equal(
    sameCatalogPrinting(
      { ...normal, variant: "Unknown" },
      { ...normal, variant: "Unknown" },
    ),
    false,
  );
  assert.equal(
    sameCatalogPrinting(normal, { ...normal, language: "ja" }),
    false,
  );
  assert.equal(
    sameCatalogPrinting(
      { ...normal, language: "" },
      { ...normal, language: "" },
    ),
    false,
  );
});

test("exact printing resolves selected catalog options and respects canonical IDs", () => {
  const collectibleId = "11111111-1111-4111-8111-111111111111";
  const holding = {
    id: "base1-4",
    language: "en",
    variant: "Holofoil",
    edition: "first_edition",
    collectibleId,
  };
  const result = {
    id: "base1-4",
    language: "en",
    variantId: collectibleId,
    variantOptions: [
      { id: "unlimited", finish: "holofoil", edition: "unlimited" },
      { id: collectibleId, finish: "holofoil", edition: "1st edition" },
    ],
  };
  assert.equal(sameCatalogPrinting(holding, result), true);
  assert.equal(
    sameCatalogPrinting(holding, {
      ...holding,
      collectibleId: "22222222-2222-4222-8222-222222222222",
    }),
    false,
  );
  assert.equal(
    sameCatalogPrinting(holding, { ...result, variantId: "" }),
    false,
  );
  assert.equal(
    sameCatalogPrinting(holding, {
      ...holding,
      collectibleId: null,
      variantId: "22222222-2222-4222-8222-222222222222",
    }),
    false,
  );
});

test("exact ownership counts only matching printings and retains default grouping", () => {
  const card = {
    id: "base1-58",
    language: "en",
    variant: "Normal",
    externalIds: { tcgdex: "base1-58" },
  };
  const items = [
    { ...card, id: "position-1", quantity: 2 },
    { ...card, id: "position-2", quantity: 3, variant: "Non-holo" },
    { ...card, quantity: 4, variant: "Reverse Holofoil" },
    { ...card, quantity: 6, edition: "first_edition" },
    { ...card, quantity: 8, promoType: "staff" },
    { ...card, quantity: 10, variant: "Unknown" },
    { ...card, quantity: 12, language: "ja" },
    { ...card, quantity: 0 },
  ];
  assert.deepEqual(ownedCardSummary(card, items, { exactPrinting: true }), {
    quantity: 5,
    positions: 2,
  });
  assert.deepEqual(ownedCardSummary(card, items), {
    quantity: 33,
    positions: 6,
  });
});

test("portfolio totals respect quantity and exclude unpriced values", () => {
  const totals = calculateTotals([
    { quantity: 2, cost: 10, price: 15 },
    { quantity: 3, cost: 4, price: null },
  ]);
  assert.deepEqual(totals, {
    quantity: 5,
    cost: 32,
    costKnown: 5,
    unknownCost: 0,
    value: 30,
    priced: 2,
    unpriced: 3,
    comparableValue: 30,
    comparableCost: 20,
    gainCoverage: 2,
    excludedCurrency: 0,
  });
});
test("portfolio totals exclude stale and failed prices without treating them as zero", () => {
  const totals = calculateTotals([
    { quantity: 1, cost: 10, price: 20, pricingStatus: "live" },
    { quantity: 2, cost: 5, price: 15, pricingStatus: "stale" },
    { quantity: 3, cost: 2, price: 8, pricingStatus: "provider_error" },
    { quantity: 1, cost: 4, price: 0, pricingStatus: "manual" },
  ]);
  assert.equal(totals.quantity, 7);
  assert.equal(totals.value, 20);
  assert.equal(totals.priced, 2);
  assert.equal(totals.unpriced, 5);
  assert.equal(totals.comparableValue, 20);
});
test("currency-scoped totals never add EUR amounts into a USD headline", () => {
  const totals = calculateTotals(
    [
      { quantity: 1, currency: "USD", cost: 10, price: 20 },
      { quantity: 2, currency: "EUR", cost: 30, price: 40 },
    ],
    { currency: "USD" },
  );
  assert.equal(totals.value, 20);
  assert.equal(totals.cost, 10);
  assert.equal(totals.excludedCurrency, 2);
  assert.equal(totals.priced, 1);
});
test("gain coverage excludes copies with unknown cost instead of treating them as free", () => {
  const totals = calculateTotals([
    { quantity: 2, cost: null, price: 20 },
    { quantity: 1, cost: 5, price: 10 },
    { quantity: 1, cost: 0, price: 3 },
  ]);
  assert.equal(totals.value, 53);
  assert.equal(totals.cost, 5);
  assert.equal(totals.unknownCost, 2);
  assert.equal(totals.comparableValue, 13);
  assert.equal(totals.comparableCost, 5);
  assert.equal(totals.gainCoverage, 2);
});
test("money preserves explicit currency", () => {
  assert.equal(money(12.5, "EUR"), "€12.50");
});
test("share snapshot omits private fields and only includes performance by opt in", () => {
  const items = [
    {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      quantity: 1,
      cost: 100,
      price: 150,
      pricingStatus: "live",
      referenceProvider: "TCGplayer",
      referenceAggregator: "PkmnPrices",
      referenceObservedAt: "2026-07-16T12:00:00Z",
      pricingConfidence: "Moderate evidence",
      notes: "private note",
      location: "safe",
      certificationNumber: "123",
    },
  ];
  const standard = portfolioSnapshot(items, { date: "2026-07-17" });
  assert.match(standard, /Estimated collection value: \$150\.00/);
  assert.match(standard, /1 live automatic · 0 owner-entered/);
  assert.match(
    standard,
    /TCGplayer via PkmnPrices · live · observed 2026-07-16 · Moderate evidence/,
  );
  assert.doesNotMatch(standard, /private note|safe|123|cost basis|gain\/loss/i);
  const performance = portfolioSnapshot(items, {
    includePerformance: true,
    date: "2026-07-17",
  });
  assert.match(performance, /Recorded cost basis: \$100\.00/);
  assert.match(performance, /Known gain\/loss: \+\$50\.00/);
});

test("selected inventory sharing is itemized, condition-aware, and private", () => {
  const items = [
    {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      language: "en",
      variant: "1st Edition Holofoil",
      cardState: "graded",
      gradingCompany: "PSA",
      grade: "9",
      certificationNumber: "private-cert",
      quantity: 1,
      status: "listed",
      askingPrice: 1200,
      price: 1100,
      pricingStatus: "live",
      referenceProvider: "PkmnPrices",
      referenceObservedAt: "2026-07-20T18:00:00Z",
      currency: "USD",
      costBasis: 500,
      notes: "private note",
      location: "safe A",
    },
    {
      name: "Pikachu",
      set: "151",
      number: "173/165",
      variant: "Illustration Rare",
      cardState: "raw",
      condition: "Near Mint",
      quantity: 2,
      status: "owned",
      askingPrice: null,
      price: 25,
      pricingStatus: "stale",
      currency: "USD",
      purchaseDate: "2025-06-25",
    },
  ];
  const asking = selectedInventoryShare(items, {
    mode: "asking",
    date: "2026-07-21",
  });
  assert.match(asking.text, /PSA 9 · Qty 1 · Asking price: \$1,200\.00 each/);
  assert.match(
    asking.text,
    /Raw · Near Mint · Qty 2 · Asking price: Not available/,
  );
  assert.match(asking.text, /Asking-price coverage: 1 of 2 positions/);
  assert.match(asking.text, /Total unavailable/);
  assert.doesNotMatch(
    `${asking.text}\n${asking.csv}`,
    /private-cert|private note|safe A|2025-06-25|500/,
  );
  assert.match(asking.csv, /owner_asking_price/);
  const market = selectedInventoryShare(items, { mode: "market" });
  assert.equal(market.pricedPositions, 1);
  assert.match(
    market.text,
    /Current market reference: \$1,100\.00 each · PkmnPrices · observed 2026-07-20/,
  );
  assert.match(market.text, /Current market reference: Not available/);
  const withCertification = selectedInventoryShare(items, {
    mode: "asking",
    includeCertification: true,
  });
  assert.match(withCertification.text, /Cert private-cert/);
  assert.match(withCertification.csv, /private-cert/);
  const showcase = selectedInventoryShare(items, { mode: "showcase" });
  assert.doesNotMatch(showcase.text, /\$/);
  assert.match(showcase.text, /Showcase only/);
  assert.equal(showcase.units, 3);
});

test("selected inventory sharing bounds message size but keeps the full CSV", () => {
  const items = Array.from({ length: 75 }, (_, index) => ({
    name: `Card ${index + 1}`,
    set: "Large list",
    number: String(index + 1),
    variant: "Normal",
    condition: "Near Mint",
    quantity: 1,
  }));
  const result = selectedInventoryShare(items, { mode: "showcase" });
  assert.equal(result.positions, 75);
  assert.equal(result.omittedFromText, 25);
  assert.match(result.text, /and 25 more positions/);
  assert.doesNotMatch(result.text, /75\. Card 75/);
  assert.match(result.csv, /"Card 75"/);
  assert.equal(result.csv.split("\r\n").length, 76);
});
test("staleness uses the configured threshold", () => {
  const now = new Date("2026-07-12T00:00:00Z").getTime();
  assert.equal(isStale("2026-07-01", now, 7), true);
  assert.equal(isStale("2026-07-10", now, 7), false);
});
test("search normalizes accents and punctuation", () => {
  assert.equal(
    matchesSearch(
      { name: "Flabébé", set: "Paldea", number: "4/102", tags: [] },
      "flabebe 4/102",
    ),
    true,
  );
});
test("library search finds grading and physical inventory details", () => {
  const item = {
    name: "Charizard",
    set: "Base Set",
    number: "4/102",
    gradingCompany: "PSA",
    grade: "10",
    location: "Slab case A2",
    certificationNumber: "98765432",
    purchaseDate: "2025-06-25",
    tags: [],
  };
  assert.equal(matchesSearch(item, "psa 10 a2"), true);
  assert.equal(matchesSearch(item, "98765432"), true);
  assert.equal(matchesSearch(item, "2025-06-25"), true);
});
test("CSV cells neutralize spreadsheet formulas and escape quotes", () => {
  assert.equal(safeCsvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  const csv = collectionToCsv([{ name: "@SUM(A1)", quantity: 1, tags: [] }]);
  assert.match(csv, /"'@SUM\(A1\)"/);
});
test("CSV backup round-trips owned records without turning blank costs into zero", () => {
  const source = [
    {
      id: "sv3pt5-151",
      name: "Mew ex",
      set: "151",
      setId: "sv3pt5",
      number: "151/165",
      language: "en",
      variant: "Holofoil",
      cardState: "raw",
      condition: "Near Mint",
      rawCondition: "near_mint",
      gradingCompany: "",
      grade: "",
      quantity: 2,
      cost: null,
      price: 9.25,
      pricingStatus: "live",
      referenceProvider: "TCGplayer",
      referenceAggregator: "PkmnPrices",
      referenceObservedAt: "2026-07-20T12:00:00Z",
      pricingConfidence: "Moderate evidence",
      tags: ["Favorites"],
      location: "Binder 1",
      notes: "Clean, centered",
      purchaseDate: "2025-06-25",
      currency: "USD",
    },
  ];
  const parsed = parseCollectionCsv(collectionToCsv(source));
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.records[0].cost, null);
  assert.equal(parsed.records[0].id, "sv3pt5-151");
  assert.equal(parsed.records[0].purchaseDate, "2025-06-25");
  assert.equal(parsed.records[0].cardState, "raw");
  assert.deepEqual(parsed.records[0].tags, ["Favorites"]);
  const csv = collectionToCsv(source);
  assert.match(
    csv,
    /market_reference_status,market_reference_provider,market_reference_aggregator,market_reference_observed_at,market_reference_confidence/,
  );
  assert.match(csv, /"live","TCGplayer","PkmnPrices"/);
});
test("CSV backup preserves exact total acquisition cost instead of multiplying a rounded unit basis", () => {
  const source = [
    {
      id: "card-1",
      name: "Pikachu",
      quantity: 3,
      cost: 66.67,
      costBasis: 200.01,
      condition: "Near Mint",
      cardState: "raw",
      rawCondition: "near_mint",
      tags: [],
    },
  ];
  const parsed = parseCollectionCsv(collectionToCsv(source));
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.records[0].cost, 66.67);
  assert.equal(parsed.records[0].totalAcquisitionCost, 200.01);
});
test("CSV backup round-trips sealed products without reclassifying them as raw", () => {
  const source = [
    {
      id: "sealed:5678",
      name: "Crown Zenith Elite Trainer Box",
      set: "Crown Zenith",
      language: "en",
      variant: "Sealed",
      cardState: "sealed",
      productType: "elite_trainer_box",
      condition: "Sealed",
      quantity: 2,
      cost: 80,
      costBasis: 160,
      tags: [],
    },
  ];
  const parsed = parseCollectionCsv(collectionToCsv(source));
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.records[0].id, "sealed:5678");
  assert.equal(parsed.records[0].cardState, "sealed");
  assert.equal(parsed.records[0].productType, "elite_trainer_box");
  assert.equal(parsed.records[0].rawCondition, undefined);
  assert.equal(parsed.records[0].gradingCompany, "");
});
test("complete account backup includes private ledger, lots, and watchlist without auth secrets", () => {
  const json = accountBackupJson({
    accountEmail: "collector@example.com",
    exportedAt: "2026-07-17T20:00:00.000Z",
    items: [
      {
        uid: "position-1",
        id: "base1-4",
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
        quantity: 1,
        costBasis: 100,
        price: 150,
        pricingStatus: "live",
        referenceProvider: "TCGplayer",
        referenceAggregator: "PkmnPrices",
        referenceObservedAt: "2026-07-16T12:00:00Z",
        pricingConfidence: "Moderate evidence",
        pricingConfidenceScore: 0.7,
        tags: ["Favorites"],
        location: "Safe A1",
        notes: "Private position note",
        transactions: [
          {
            type: "purchase",
            date: "2025-06-25",
            quantity: 1,
            unitPrice: 100,
            totalCost: 100,
            currency: "USD",
            notes: "Receipt 1",
          },
          {
            type: "sale",
            date: "2026-07-01",
            quantity: 1,
            unitPrice: 175,
            subtotal: 175,
            netProceeds: 160,
            allocatedCost: 100,
            realizedGain: 60,
            currency: "USD",
          },
        ],
        lots: [
          {
            acquiredAt: "2025-06-25",
            quantityAcquired: 1,
            quantityRemaining: 0,
            totalCost: 100,
            remainingCost: 0,
            currency: "USD",
          },
        ],
        access_token: "must-not-leak",
      },
    ],
    watchlist: [
      {
        id: "sv3pt5-151",
        name: "Mew ex",
        set: "151",
        number: "151/165",
        targetPrice: 25,
        currentPrice: 28,
        notes: "Buy a clean copy",
      },
    ],
  });
  const backup = JSON.parse(json);
  assert.equal(backup.format, "mica-account-backup");
  assert.equal(backup.account.email, "collector@example.com");
  assert.equal(backup.collection[0].transactions[1].fifoSoldBasis, 100);
  assert.equal(backup.collection[0].purchaseLots[0].quantityRemaining, 0);
  assert.deepEqual(backup.collection[0].marketReferenceEvidence, {
    status: "live",
    provider: "TCGplayer",
    aggregator: "PkmnPrices",
    observedAt: "2026-07-16T12:00:00Z",
    retrievedAt: null,
    confidence: "Moderate evidence",
    confidenceScore: 0.7,
  });
  assert.equal(backup.watchlist[0].targetPrice, 25);
  assert.match(json, /Private position note|Receipt 1|Buy a clean copy/);
  assert.doesNotMatch(json, /must-not-leak|access_token/);
});
test("transaction report exports period FIFO profit and neutralizes spreadsheet formulas", () => {
  const csv = transactionReportCsv(
    [
      {
        name: "=Charizard",
        set: "Base Set",
        number: "4/102",
        currency: "USD",
        transactions: [
          {
            type: "purchase",
            date: "2026-06-01",
            quantity: 1,
            unitPrice: 100,
            totalCost: 100,
            currency: "USD",
          },
          {
            type: "sale",
            date: "2026-07-01",
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
            netProceeds: 135,
            allocatedCost: 80,
            currency: "USD",
            marketplace: "@market",
          },
          {
            type: "sale",
            date: "2025-01-01",
            quantity: 1,
            netProceeds: 10,
            allocatedCost: 5,
            currency: "USD",
          },
        ],
      },
    ],
    { from: "2026-01-01", to: "2026-12-31", currency: "USD" },
  );
  assert.match(csv, /'=Charizard/);
  assert.match(csv, /"55","'@market"/);
  assert.doesNotMatch(csv, /2025-01-01/);
});
test("missing set checklist includes only unowned collector numbers and no private collection fields", () => {
  const text = missingSetChecklist(
    {
      name: "Base Set",
      totalCount: 3,
      cards: [
        { localId: "1", name: "Alakazam" },
        { localId: "2", name: "Blastoise" },
        { localId: "3", name: "Chansey" },
      ],
    },
    new Set(["2"]),
  );
  assert.match(text, /2 of 3 cards missing/);
  assert.match(text, /#1 Alakazam/);
  assert.match(text, /#3 Chansey/);
  assert.doesNotMatch(text, /Blastoise|cost|location|cert/i);
});
