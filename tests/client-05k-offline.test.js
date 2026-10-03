import assert from "node:assert/strict";
import test from "node:test";
import salesHandler from "../api/sales.js";
import { collectibleIdentitySnapshot } from "../lib/identity.js";
import { exactSoldValuation } from "../lib/pricing.js";
import { saleMatchesCanonicalIdentity } from "../lib/providers/pkmnprices.js";
import { normalizeTcgdexCard } from "../lib/providers/tcgdex.js";

// Offline reconstruction of the public 05J TCGdex fields; no catalog request.
const source = {
  id: "base2-1",
  name: "Clefable",
  localId: "1",
  set: { id: "base2", name: "Jungle", cardCount: { official: 64 } },
  variants: { holo: true, firstEdition: true },
  variants_detailed: [
    {
      variantId: "3a83wf50ts0izj268xwv3crwi",
      type: "holo",
      size: "standard",
      stamp: ["1st-edition"],
    },
  ],
};
const sourceVariant = "tcgdex:en:base2-1:variant:3a83wf50ts0izj268xwv3crwi";
const providerCard = {
  id: 20618,
  name: "Clefable (1)",
  number: "01",
  total_set_number: "64",
  set: { name: "Jungle" },
  language: "English",
  prices: [{ variant: "1st Edition Holofoil", currency: "USD" }],
};
const lookup = Object.freeze({
  clientId: "tcgdex:en:base2-1",
  pkmnpricesId: "20618",
  name: "Clefable (1)", // 05J/05K candidate-scoped, synthetic API hypothesis.
  set: "Jungle",
  number: "01/64",
  language: "en",
  variant: "1st Edition · Holofoil",
  finish: "holofoil",
  edition: "first_edition",
  promoType: "none",
  grader: "PSA", // Experimental context, not an owned or authenticated slab.
  grade: "10",
  gradeQualifier: "",
  currency: "USD",
});
const cardUrl = "https://api.pkmnprices.com/v1/cards/20618?currency=usd";
const soldUrl =
  "https://api.pkmnprices.com/v1/cards/20618/listings/ebay?limit=10&sort=date_desc&graded=true&variant=1st+Edition+Holofoil&grader=PSA&grade=10";
const now = Date.parse("2026-09-25T12:00:00Z");

function stopped() {
  const error = new Error("CLIENT-05K offline request guard stopped transport");
  error.status = 409; // Non-retryable by the unchanged adapter.
  return error;
}

function sourceOption(card = source) {
  const normalized = normalizeTcgdexCard(card, "en");
  const option = normalized.variantOptions.find(
    (row) => row.id === sourceVariant,
  );
  const snapshot = collectibleIdentitySnapshot(normalized, sourceVariant);
  return { normalized, option, snapshot };
}

// Candidate-specific adaptation of scripts/client-05b-guard.mjs, with no live mode.
function offlineGuard(fakeTransport, card = source) {
  const { normalized, option, snapshot } = sourceOption(card);
  let phase = 0;
  let reserved = 0;
  let verified = false;
  const calls = [];
  const sourceReady =
    card.id === "base2-1" &&
    card.name === "Clefable" &&
    String(card.localId) === "1" &&
    card.set?.id === "base2" &&
    card.set?.name === "Jungle" &&
    Number(card.set?.cardCount?.official) === 64 &&
    option?.id === sourceVariant &&
    option?.status === "exact" &&
    option?.finish === "holofoil" &&
    option?.edition === "first_edition" &&
    option?.promoType === "none" &&
    option?.language === "en" &&
    option?.metadata?.type === "holo" &&
    option?.metadata?.size === "standard" &&
    option?.metadata?.stampPresent === true &&
    JSON.stringify(option.metadata.stamp) === '["1st-edition"]' &&
    snapshot?.identityStatus === "exact" &&
    normalized.id === lookup.clientId &&
    normalized.number === "1/64";
  const directMatches = (body) =>
    String(body?.id) === "20618" &&
    body?.name === "Clefable (1)" &&
    body?.set?.name === "Jungle" &&
    String(body?.number) === "01" &&
    String(body?.total_set_number) === "64" &&
    body?.language === "English" &&
    Array.isArray(body.prices) &&
    body.prices.some(
      (row) => row.variant === "1st Edition Holofoil" && row.currency === "USD",
    );
  return {
    get ledger() {
      return { calls: [...calls], reserved };
    },
    async fetch(input, options = {}) {
      const url = String(input);
      if (
        !sourceReady ||
        !fakeTransport ||
        (phase === 1 && !verified) ||
        url !== (phase === 0 ? cardUrl : phase === 1 ? soldUrl : null) ||
        (options.method || "GET").toUpperCase() !== "GET" ||
        options.body != null ||
        (options.redirect && options.redirect !== "error")
      )
        throw stopped();
      phase++;
      reserved += phase === 1 ? 1 : 10;
      calls.push(url);
      const response = await fakeTransport(input, {
        ...options,
        redirect: "error",
      });
      if (!response.ok) return response;
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (
        (phase === 1 && !directMatches(body)) ||
        (phase === 2 && (!Array.isArray(body?.data) || body.data.length > 10))
      )
        throw stopped();
      if (phase === 1) verified = true;
      return response;
    },
  };
}

const title = "Clefable (1) Jungle 01/64 1st Edition Holofoil PSA 10";
function sale(id, price, change = {}) {
  return {
    id,
    ebay_listing_id: id,
    title,
    price,
    currency: "USD",
    grader: "PSA",
    grade: "10",
    grade_qualifier: null,
    variant: "1st Edition Holofoil",
    attribution: "exact",
    language: "English",
    sold_at: "2026-09-20",
    ingested_at: "2026-09-23T00:00:00Z",
    listing_url: `https://www.ebay.com/itm/${id}`,
    ...change,
  };
}

function response() {
  return {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function rehearse(rows, { card = providerCard, catalog = source } = {}) {
  const guard = offlineGuard(async (url, options) => {
    assert.equal(options.redirect, "error");
    return Response.json(
      String(url) === cardUrl
        ? card
        : { data: rows, pagination: { has_more: false } },
    );
  }, catalog);
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.PKMNPRICES_API_KEY;
  globalThis.fetch = guard.fetch;
  process.env.PKMNPRICES_API_KEY = "offline-fixture-only";
  const output = response();
  try {
    await salesHandler(
      { method: "GET", query: { lookup: JSON.stringify(lookup) } },
      output,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = previousKey;
  }
  const { option } = sourceOption(catalog);
  const context = {
    canonicalId: lookup.clientId,
    identityStatus: option?.status,
    name: lookup.name,
    set: lookup.set,
    number: lookup.number,
    language: lookup.language,
    variant: lookup.variant,
    finish: lookup.finish,
    edition: lookup.edition,
    promoType: lookup.promoType,
    grader: lookup.grader,
    grade: lookup.grade,
    qualifier: lookup.gradeQualifier,
    currency: lookup.currency,
  };
  const valuation =
    output.statusCode === 200
      ? exactSoldValuation(output.body.sales, context, {
          now,
          validatedContext: output.body.validatedContext,
          hasMore: output.body.hasMore,
          retrievedAt: output.body.retrievedAt,
        })
      : null;
  return { guard, output, valuation };
}

// Separate raw-row arithmetic; it imports no application filtering/calculation helper.
function independent(rows) {
  const excluded = {};
  const reject = (reason) => {
    excluded[reason] = (excluded[reason] || 0) + 1;
  };
  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const transactions = new Map();
  for (const row of rows) {
    const text = String(row.title || "");
    const match = text.match(/\b0*1\s*\/\s*0*64\b/);
    const source = new URL(row.listing_url);
    const key = source.pathname.match(/^\/itm\/(\d+)\/?$/)?.[1];
    const sold = Date.parse(row.sold_at);
    if (row.attribution !== "exact") reject("attribution");
    else if (
      !/\bClefable\b/.test(text) ||
      !/\bJungle\b/.test(text) ||
      !match ||
      /\b(?:lot|bundle|Raichu|Fossil)\b/i.test(text)
    )
      reject("identity");
    else if (
      !/\b1st Edition Holofoil\b/i.test(text) ||
      row.variant !== "1st Edition Holofoil"
    )
      reject("printing");
    else if (
      !/\bPSA 10\b/.test(text) ||
      row.grader !== "PSA" ||
      Number(row.grade) !== 10 ||
      row.grade_qualifier
    )
      reject("grade_or_qualifier");
    else if (row.language && row.language !== "English") reject("language");
    else if (row.currency !== "USD") reject("currency");
    else if (!Number.isFinite(row.price) || row.price <= 0) reject("amount");
    else if (
      !/^\d{4}-\d{2}-\d{2}$/.test(row.sold_at) ||
      !Number.isFinite(sold) ||
      sold > now ||
      sold < now - 90 * 86400000
    )
      reject("date");
    else if (
      source.protocol !== "https:" ||
      source.hostname !== "www.ebay.com" ||
      !key
    )
      reject("transaction_source");
    else transactions.set(key, [...(transactions.get(key) || []), row]);
  }
  const distinct = [];
  for (const group of transactions.values()) {
    if (
      group.some(
        (row) =>
          row.price !== group[0].price || row.sold_at !== group[0].sold_at,
      )
    )
      group.forEach(() => reject("conflicting_duplicate"));
    else {
      distinct.push(group[0]);
      group.slice(1).forEach(() => reject("duplicate_transaction"));
    }
  }
  const before = median(distinct.map((row) => row.price));
  const mad = median(distinct.map((row) => Math.abs(row.price - before)));
  const kept = distinct.filter((row) => {
    const deviation = Math.abs(row.price - before);
    const flagged =
      distinct.length >= 5 &&
      (deviation / before) * 100 >= 40 &&
      (mad === 0 || (0.6745 * deviation) / mad > 3.5);
    if (flagged) reject("outlier");
    return !flagged;
  });
  const prices = kept.map((row) => row.price).sort((a, b) => a - b);
  return {
    excluded,
    count: kept.length,
    estimate: kept.length >= 3 ? median(prices) : null,
    rangeLow: prices[0] ?? null,
    rangeHigh: prices.at(-1) ?? null,
    before,
    after: median(prices),
    newestSoldAt:
      kept.sort((a, b) => Date.parse(b.sold_at) - Date.parse(a.sold_at))[0]
        ?.sold_at || null,
  };
}

test("source facts and candidate-scoped direct gate preserve exact printing", async () => {
  const originalSource = structuredClone(source);
  const { normalized, option, snapshot } = sourceOption();
  assert.equal(normalized.id, "tcgdex:en:base2-1");
  assert.equal(option.status, "exact");
  assert.equal(option.edition, "first_edition");
  assert.equal(option.promoType, "none");
  assert.equal(snapshot.identityStatus, "exact");
  const result = await rehearse([]);
  assert.equal(result.output.statusCode, 200);
  assert.deepEqual(result.guard.ledger, {
    calls: [cardUrl, soldUrl],
    reserved: 11,
  });
  assert.equal(result.output.body.validatedContext.name, lookup.name);
  assert.equal(result.output.body.validatedContext.number, lookup.number);
  for (const field of [
    "clientId",
    "set",
    "language",
    "variant",
    "finish",
    "edition",
    "promoType",
    "grader",
    "grade",
    "gradeQualifier",
    "currency",
  ])
    assert.equal(result.output.body.validatedContext[field], lookup[field]);
  assert.deepEqual(source, originalSource);
});

test("pre-transport allowlist blocks wrong host/id/limit/retry/page/third call", async () => {
  await assert.rejects(
    () => offlineGuard().fetch(cardUrl),
    /offline request guard/,
  );
  let transports = 0;
  const transport = async () => {
    transports++;
    return Response.json(providerCard);
  };
  const guard = offlineGuard(transport);
  for (const url of [
    cardUrl.replace("20618", "20619"),
    cardUrl.replace("api.pkmnprices.com", "evil.example"),
    soldUrl,
    cardUrl.replace("/20618?", "?name=Clefable&"),
  ])
    await assert.rejects(() => guard.fetch(url), /offline request guard/);
  await assert.rejects(
    () => guard.fetch(cardUrl, { redirect: "follow" }),
    /offline request guard/,
  );
  assert.equal(transports, 0);
  await guard.fetch(cardUrl);
  for (const url of [
    cardUrl, // retry
    soldUrl.replace("limit=10", "limit=11"),
    `${soldUrl}&cursor=next`,
    soldUrl.replace("20618", "20619"),
  ])
    await assert.rejects(() => guard.fetch(url), /offline request guard/);
  assert.equal(transports, 1);
  const complete = offlineGuard((url) =>
    Response.json(
      String(url) === cardUrl
        ? providerCard
        : { data: [], pagination: { has_more: false } },
    ),
  );
  await complete.fetch(cardUrl);
  await complete.fetch(soldUrl);
  await assert.rejects(() => complete.fetch(soldUrl), /offline request guard/);
  assert.equal(complete.ledger.reserved, 11);
});

test("direct response and source contradictions stop before sold request", async () => {
  for (const changed of [
    { id: 20619 },
    { name: "Clefable" },
    { number: "1" },
    { total_set_number: null },
    { set: { name: "Fossil" } },
    { language: "Japanese" },
    { language: null },
    { prices: [] },
    { prices: [{ variant: "Unlimited Holofoil", currency: "USD" }] },
  ]) {
    const result = await rehearse([], {
      card: { ...providerCard, ...changed },
    });
    assert.equal(result.output.statusCode, 502);
    assert.equal(result.guard.ledger.calls.length, 1);
    assert.equal(result.guard.ledger.reserved, 1);
  }
  const drift = await rehearse([], {
    catalog: { ...source, variants_detailed: [] },
  });
  assert.equal(drift.output.statusCode, 502);
  assert.equal(drift.guard.ledger.calls.length, 0);
  assert.equal(drift.guard.ledger.reserved, 0);
});

test("failed direct response cannot unlock retry, search fallback or sales", async () => {
  for (const status of [302, 404, 500]) {
    let calls = 0;
    const guard = offlineGuard(async () => {
      calls++;
      return Response.json({ error: "synthetic" }, { status });
    });
    assert.equal((await guard.fetch(cardUrl)).status, status);
    for (const url of [
      cardUrl,
      "https://api.pkmnprices.com/v1/cards?name=Clefable",
      soldUrl,
    ])
      await assert.rejects(() => guard.fetch(url), /offline request guard/);
    assert.equal(calls, 1);
    assert.equal(guard.ledger.reserved, 1);
  }
});

test("positive synthetic sample independently agrees, including zero-MAD outlier", async () => {
  // Frozen expected: six valid distinct raw rows, prices 100×5 + 1000.
  // Zero MAD and 900% deviation flag 1000; five contribute, median/range 100.
  const rows = [
    sale(9001, 100),
    sale(9002, 100),
    sale(9003, 100),
    sale(9004, 100),
    sale(9005, 100),
    sale(9006, 1000),
  ];
  const independentResult = independent(rows);
  assert.deepEqual(
    {
      ...independentResult,
      excluded: independentResult.excluded,
    },
    {
      excluded: { outlier: 1 },
      count: 5,
      estimate: 100,
      rangeLow: 100,
      rangeHigh: 100,
      before: 100,
      after: 100,
      newestSoldAt: "2026-09-20",
    },
  );
  const result = await rehearse(rows);
  assert.equal(result.output.body.receivedCount, 6);
  assert.equal(result.output.body.acceptedCount, 6);
  assert.equal(result.valuation.status, "ready");
  assert.equal(result.valuation.distinctSaleCount, independentResult.count);
  assert.equal(result.valuation.estimate, independentResult.estimate);
  assert.equal(result.valuation.rangeLow, independentResult.rangeLow);
  assert.equal(result.valuation.rangeHigh, independentResult.rangeHigh);
  assert.equal(result.valuation.medianBeforeOutliers, independentResult.before);
  assert.equal(result.valuation.medianAfterOutliers, independentResult.after);
  assert.equal(result.valuation.newestSoldAt, independentResult.newestSoldAt);
  assert.equal(
    result.valuation.excluded.filter(
      (row) => row.reason === "robust_price_outlier",
    ).length,
    1,
  );
});

test("sparse and invalid synthetic rows stay unavailable", async () => {
  const sparseRows = [sale(9101, 100), sale(9102, 120)];
  const sparse = await rehearse(sparseRows);
  assert.equal(independent(sparseRows).estimate, null);
  assert.equal(sparse.valuation.status, "insufficient");
  assert.equal(sparse.valuation.estimate, null);
  const wrongGrade = await rehearse([
    sale(9111, 100),
    sale(9112, 120, { grade: "9", title: title.replace("PSA 10", "PSA 9") }),
  ]);
  assert.equal(wrongGrade.output.body.acceptedCount, 1);
  assert.equal(wrongGrade.valuation.estimate, null);
  const invalid = [
    sale(9201, 100),
    sale(9202, 120, { attribution: "shared" }),
    sale(9203, 120, { variant: "Unlimited Holofoil" }),
    sale(9204, 120, { title: title.replace("Holofoil", "Non-Holo") }),
    sale(9205, 120, { title: title.replace("Clefable", "Raichu") }),
    sale(9206, 120, { title: title.replace("Jungle", "Fossil") }),
    sale(9207, 120, { title: title.replace("01/64", "02/64") }),
    sale(9208, 120, { grade_qualifier: "Black Label" }),
    sale(9209, 120, { language: "Japanese" }),
    sale(9210, 120, { currency: "EUR" }),
  ];
  const result = await rehearse(invalid);
  assert.deepEqual(independent(invalid), {
    excluded: {
      attribution: 1,
      printing: 2,
      identity: 3,
      grade_or_qualifier: 1,
      language: 1,
      currency: 1,
    },
    count: 1,
    estimate: null,
    rangeLow: 100,
    rangeHigh: 100,
    before: 100,
    after: 100,
    newestSoldAt: "2026-09-20",
  });
  assert.equal(result.output.body.receivedCount, 10);
  assert.equal(result.output.body.acceptedCount, 2); // EUR survives API identity checks.
  assert.deepEqual(result.output.body.exclusions, {
    normalizationRejected: 0,
    contextMismatch: 4,
    canonicalIdentityMismatch: 4,
  });
  assert.equal(result.valuation.status, "insufficient");
  assert.equal(result.valuation.distinctSaleCount, 1);
  assert.equal(result.valuation.estimate, null);
  assert.equal(
    result.valuation.excluded.filter(
      (row) => row.reason === "currency_mismatch",
    ).length,
    1,
  );
});

test("duplicates and stale/future dates are independently excluded", async () => {
  const rows = [
    sale(9301, 100),
    sale(9301, 100),
    sale(9302, 120),
    sale(9302, 130),
    sale(9303, 140, { sold_at: "2026-01-01" }),
    sale(9304, 140, { sold_at: "2026-09-26" }),
    sale(9305, 150),
  ];
  const expected = independent(rows);
  assert.deepEqual(expected.excluded, {
    date: 2,
    duplicate_transaction: 1,
    conflicting_duplicate: 2,
  });
  assert.equal(expected.count, 2);
  assert.equal(expected.estimate, null);
  const result = await rehearse(rows);
  assert.equal(result.valuation.status, "insufficient");
  assert.equal(result.valuation.distinctSaleCount, expected.count);
  assert.equal(result.valuation.estimate, expected.estimate);
  assert.equal(result.valuation.rangeLow, expected.rangeLow);
  assert.equal(result.valuation.rangeHigh, expected.rangeHigh);
  assert.equal(result.valuation.newestSoldAt, expected.newestSoldAt);
  assert.deepEqual(
    Object.fromEntries(
      [
        "outside_90_day_window",
        "invalid_or_future_sold_at",
        "duplicate_transaction",
        "conflicting_duplicate",
      ].map((reason) => [
        reason,
        result.valuation.excluded.filter((row) => row.reason === reason).length,
      ]),
    ),
    {
      outside_90_day_window: 1,
      invalid_or_future_sold_at: 1,
      duplicate_transaction: 1,
      conflicting_duplicate: 2,
    },
  );
});

test("bare Clefable title with padded number agrees through API and estimator", async () => {
  const rows = [
    sale(9401, 100, { title: title.replace("Clefable (1)", "Clefable") }),
    sale(9402, 120, { title: title.replace("Clefable (1)", "Clefable") }),
    sale(9403, 140, { title: title.replace("Clefable (1)", "Clefable") }),
  ];
  const independently = independent(rows);
  assert.equal(independently.count, 3);
  assert.equal(independently.estimate, 120);
  const result = await rehearse(rows);
  assert.equal(result.output.body.acceptedCount, 3);
  assert.equal(result.output.body.exclusions.canonicalIdentityMismatch, 0);
  assert.equal(result.valuation.status, "ready");
  assert.equal(result.valuation.distinctSaleCount, independently.count);
  assert.equal(result.valuation.estimate, independently.estimate);
  assert.equal(result.valuation.rangeLow, independently.rangeLow);
  assert.equal(result.valuation.rangeHigh, independently.rangeHigh);
  assert.equal(result.valuation.newestSoldAt, independently.newestSoldAt);
});

test("numeric display suffix requires independent collector evidence", () => {
  const bare = { title: "Clefable Jungle 01/64 1st Edition Holofoil PSA 10" };
  const matches = (
    name,
    card = providerCard,
    number = "01/64",
    title = bare.title,
  ) =>
    saleMatchesCanonicalIdentity(
      { title },
      { ...card, name },
      {
        ...lookup,
        name,
        number,
      },
    );
  assert.equal(matches("Clefable (1)"), true);
  for (const [name, card, number, title] of [
    ["Clefable (2)", providerCard, "01/64", bare.title],
    [
      "Clefable (2)",
      { ...providerCard, name: "Clefable (2)" },
      "01/64",
      "Clefable (2) Jungle 01/64 1st Edition Holofoil PSA 10",
    ],
    ["Clefable (1)", { ...providerCard, number: "02" }, "01/64", bare.title],
    [
      "Clefable (1)",
      { ...providerCard, number: "02" },
      "01/64",
      "Clefable (1) Jungle 01/64 1st Edition Holofoil PSA 10",
    ],
    [
      "Clefable (1)",
      { ...providerCard, total_set_number: "65" },
      "01/64",
      bare.title,
    ],
    ["Clefable (1)", providerCard, "01", bare.title],
    [
      "Clefable (1)",
      providerCard,
      "01/64",
      "Clefable Jungle 1st Edition Holofoil PSA 10",
    ],
    [
      "Clefable (1)",
      providerCard,
      "01/64",
      "Clefable (1) Jungle 1st Edition Holofoil PSA 10",
    ],
    [
      "Clefable (1)",
      providerCard,
      "01/64",
      "Clefable 01/64 1st Edition Holofoil PSA 10",
    ],
    [
      "Clefable (1)",
      providerCard,
      "01/64",
      "Clefable Jungle 01/65 1st Edition Holofoil PSA 10",
    ],
    [
      "Clefable (1)",
      providerCard,
      "01/64",
      "Clefable (2) Jungle 01/64 1st Edition Holofoil PSA 10",
    ],
    [
      "Clefable (Staff)",
      { ...providerCard, name: "Clefable (Staff)" },
      "01/64",
      bare.title,
    ],
    [
      "Clefable (1) (1)",
      { ...providerCard, name: "Clefable (1) (1)" },
      "01/64",
      bare.title,
    ],
    [
      "Clefable V (1)",
      { ...providerCard, name: "Clefable V (1)" },
      "01/64",
      bare.title,
    ],
    [
      "Clefable VMAX (1)",
      { ...providerCard, name: "Clefable VMAX (1)" },
      "01/64",
      bare.title,
    ],
    [
      "Clefable ex (1)",
      { ...providerCard, name: "Clefable ex (1)" },
      "01/64",
      bare.title,
    ],
    [
      "Clefable LV.X (1)",
      { ...providerCard, name: "Clefable LV.X (1)" },
      "01/64",
      bare.title,
    ],
    [
      "Alolan Clefable (1)",
      { ...providerCard, name: "Alolan Clefable (1)" },
      "01/64",
      bare.title,
    ],
    [
      "Clefable2 (1)",
      { ...providerCard, name: "Clefable2 (1)" },
      "01/64",
      bare.title,
    ],
    [
      "Clefable (1)",
      providerCard,
      "01/64",
      "Clefable Fossil 01/64 1st Edition Holofoil PSA 10",
    ],
  ])
    assert.equal(
      matches(name, card, number, title),
      false,
      `${name}: ${title}`,
    );
});

test("oversized synthetic page stops at the guard, without a third request", async () => {
  const result = await rehearse(
    Array.from({ length: 11 }, (_, i) => sale(9500 + i, 100)),
  );
  assert.equal(result.output.statusCode, 502);
  assert.equal(result.guard.ledger.calls.length, 2);
  assert.equal(result.guard.ledger.reserved, 11);
});
