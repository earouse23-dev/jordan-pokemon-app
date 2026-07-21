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
  safeCsvCell,
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
    location: "",
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
  });
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
      notes: "private note",
      location: "safe",
      certificationNumber: "123",
    },
  ];
  const standard = portfolioSnapshot(items, { date: "2026-07-17" });
  assert.match(standard, /Estimated market value: \$150\.00/);
  assert.doesNotMatch(standard, /private note|safe|123|cost basis|gain\/loss/i);
  const performance = portfolioSnapshot(items, {
    includePerformance: true,
    date: "2026-07-17",
  });
  assert.match(performance, /Recorded cost basis: \$100\.00/);
  assert.match(performance, /Known gain\/loss: \+\$50\.00/);
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
