import test from "node:test";
import assert from "node:assert/strict";
import { retainedHandler as handler } from "../api/cards.js";
import {
  positionObservationRow,
  pricingCreditPlan,
} from "../api/price-sync.js";
import { retainedHandler as offersHandler } from "../api/offers.js";
import { retainedHandler as sealedHandler } from "../api/sealed.js";
import { retainedHandler as salesHandler } from "../api/sales.js";
import {
  PRICE_EVIDENCE_RULE_VERSION,
  finishForVariant,
  gradedPriceLadder,
  summarizePsaSales,
  mergePriceHistory,
  normalizePriceCapabilityStatus,
  normalizeCard,
  portfolioPriceCoverage,
  priceEvidence,
  priceFreshness,
  priceMovement,
  reviewComparableOutliers,
  safeMarketSourceUrl,
  selectCardmarketReference,
  selectReferenceQuote,
} from "../lib/pricing.js";

test("market source links require the returned HTTPS marketplace host", () => {
  assert.equal(safeMarketSourceUrl("https://www.tcgplayer.com/product/123", "tcgplayer"), "https://www.tcgplayer.com/product/123");
  assert.equal(safeMarketSourceUrl("https://www.cardmarket.com/en/Pokemon/Products", "cardmarket"), "https://www.cardmarket.com/en/Pokemon/Products");
  for (const url of ["javascript:alert(1)", "https://tcgplayer.com.evil.example/product/123", "https://user@www.tcgplayer.com/product/123", "http://www.tcgplayer.com/product/123"])
    assert.equal(safeMarketSourceUrl(url, "tcgplayer"), null);
});
import {
  normalizeJustTcgCard,
  normalizePrinting,
} from "../lib/providers/justtcg.js";
import {
  fetchPkmnPricesOffers,
  fetchPkmnPricesSales,
  fetchPkmnPricesSealedSearch,
  fetchPkmnPricesLookup,
  matchesPkmnPricesIdentity,
  normalizePkmnPricesCard,
  normalizePkmnPricesOffer,
  normalizePkmnPricesSealedProduct,
  normalizePkmnPricesSale,
  pkmnPricesRetryDelayMs,
  saleMatchesCanonicalIdentity,
  saleMatchesLookup,
} from "../lib/providers/pkmnprices.js";
import {
  normalizeTcgdexCard,
  normalizeTcgdexPricingCard,
} from "../lib/providers/tcgdex.js";

const card = {
  id: "set-1",
  name: "Test card",
  number: "1",
  set: { name: "Test Set", releaseDate: "2026/01/02" },
  images: { small: "small.png", large: "large.png" },
  tcgplayer: {
    url: "https://example.com/us",
    updatedAt: "2026/07/10",
    prices: {
      holofoil: { low: 8, mid: 10, market: 9.5 },
      reverseHolofoil: { market: 7.25 },
    },
  },
  cardmarket: {
    url: "https://example.com/eu",
    updatedAt: "2026/07/09",
    prices: {
      trendPrice: 8.2,
      reverseHoloTrend: 6.7,
    },
  },
};

test("normalizes provider quotes without exposing provider response schemas", () => {
  const normalized = normalizeCard(card, "2026-07-12T00:00:00.000Z");
  assert.equal(normalized.providerCardId, "set-1");
  assert.equal(normalized.quotes.length, 6);
  assert.deepEqual(normalized.quotes[0].observedAt, "2026-07-10");
});

test("selects only a compatible TCGplayer finish and preferred price type", () => {
  const quotes = normalizeCard(card).quotes;
  assert.equal(selectReferenceQuote(quotes, "Holofoil").amount, 9.5);
  assert.equal(selectReferenceQuote(quotes, "Reverse Holofoil").amount, 7.25);
  assert.equal(selectReferenceQuote(quotes, "Normal"), null);
});

test("does not mix raw quotes into graded copies or substitute a different raw condition", () => {
  const rawQuotes = normalizeJustTcgCard({
    id: "card",
    name: "Card",
    variants: [
      {
        id: "nm",
        condition: "Near Mint",
        printing: "Holofoil",
        price: 100,
        lastUpdated: 1783814400,
      },
    ],
  }).quotes;
  assert.equal(
    selectReferenceQuote(rawQuotes, "Holofoil", "USD", {
      gradingCompany: "PSA",
      grade: "10",
    }),
    null,
  );
  assert.equal(
    selectReferenceQuote(rawQuotes, "Holofoil", "USD", {
      condition: "Lightly Played",
    }),
    null,
  );
  assert.equal(
    selectReferenceQuote(rawQuotes, "Holofoil", "USD", {
      condition: "Near Mint",
    }).amount,
    100,
  );
  const neutral = normalizeTcgdexPricingCard({
    id: "x",
    pricing: { tcgplayer: { unit: "USD", holofoil: { marketPrice: 80 } } },
  }).quotes;
  assert.equal(
    selectReferenceQuote(neutral, "Holofoil", "USD", {
      condition: "Lightly Played",
    }).amount,
    80,
  );
});

test("raw selection and confidence exclude graded-only evidence in every condition shape", () => {
  const gradedQuotes = [
    {
      provider: "tcgplayer",
      currency: "USD",
      finish: "holofoil",
      condition: null,
      gradingCompany: "PSA",
      grade: "10",
      priceType: "market",
      amount: 200,
      observedAt: "2026-09-16T12:00:00.000Z",
    },
    {
      provider: "tcgplayer",
      currency: "USD",
      finish: "holofoil",
      gradingCompany: "BGS",
      grade: "9.5",
      priceType: "market",
      amount: 150,
      observedAt: "2026-09-16T12:00:00.000Z",
    },
    {
      provider: "tcgplayer",
      currency: "USD",
      finish: "holofoil",
      condition: "",
      gradingCompany: "PSA",
      grade: "9",
      priceType: "market",
      amount: 120,
      observedAt: "2026-09-16T12:00:00.000Z",
    },
  ];
  const rawContext = {
    condition: "Near Mint",
    finish: "holofoil",
    edition: "unlimited",
  };
  assert.equal(
    selectReferenceQuote(gradedQuotes, "Holofoil", "USD", rawContext),
    null,
  );
  const gradedOnlyReport = priceEvidence(
    gradedQuotes,
    "Holofoil",
    "USD",
    rawContext,
    new Date("2026-09-17T12:00:00.000Z").getTime(),
  );
  assert.equal(gradedOnlyReport.level, "unavailable");
  assert.equal(gradedOnlyReport.sourceCount, 0);
  assert.deepEqual(gradedOnlyReport.evidence, []);

  const rawQuote = {
    provider: "tcgplayer",
    currency: "USD",
    finish: "holofoil",
    condition: null,
    gradingCompany: null,
    grade: null,
    priceType: "market",
    amount: 80,
    observedAt: "2026-09-16T12:00:00.000Z",
  };
  for (const quotes of [
    [...gradedQuotes, rawQuote],
    [rawQuote, ...gradedQuotes],
  ]) {
    assert.equal(
      selectReferenceQuote(quotes, "Holofoil", "USD", rawContext).amount,
      80,
    );
    assert.equal(
      selectReferenceQuote(quotes, "Holofoil", "USD", {
        gradingCompany: "PSA",
        grade: "10",
        finish: "holofoil",
        edition: "unlimited",
      }).amount,
      200,
    );
    const rawReport = priceEvidence(
      quotes,
      "Holofoil",
      "USD",
      rawContext,
      new Date("2026-09-17T12:00:00.000Z").getTime(),
    );
    assert.equal(rawReport.sourceCount, 1);
    assert.equal(rawReport.evidence[0].amount, 80);
  }
});

test("price evidence scores only exact compatible context and explains disagreement", () => {
  const quotes = [
    {
      provider: "tcgplayer",
      currency: "USD",
      finish: "holofoil",
      condition: "Near Mint",
      gradingCompany: null,
      grade: null,
      priceType: "market",
      amount: 100,
      observedAt: "2026-07-19",
    },
    {
      provider: "pkmnprices",
      currency: "USD",
      finish: "holofoil",
      condition: "Near Mint",
      gradingCompany: null,
      grade: null,
      priceType: "average",
      amount: 108,
      observedAt: "2026-07-19",
    },
    {
      provider: "ebay",
      currency: "USD",
      finish: "holofoil",
      condition: null,
      gradingCompany: "PSA",
      grade: "10",
      priceType: "average",
      amount: 400,
      observedAt: "2026-07-19",
    },
    {
      provider: "cardmarket",
      currency: "EUR",
      finish: "holofoil",
      condition: null,
      gradingCompany: null,
      grade: null,
      priceType: "trend",
      amount: 80,
      observedAt: "2026-07-19",
    },
  ];
  const report = priceEvidence(
    quotes,
    "Holofoil",
    "USD",
    { condition: "Near Mint" },
    new Date("2026-07-20T12:00:00Z").getTime(),
  );
  assert.equal(report.level, "strong");
  assert.equal(report.sourceCount, 2);
  assert.ok(report.spreadPercent > 7 && report.spreadPercent < 8);
  assert.deepEqual(
    report.evidence.map((item) => item.provider),
    ["tcgplayer", "pkmnprices"],
  );
  const graded = priceEvidence(
    quotes,
    "Holofoil",
    "USD",
    { gradingCompany: "PSA", grade: "10" },
    new Date("2026-07-20T12:00:00Z").getTime(),
  );
  assert.equal(graded.level, "limited");
  assert.equal(graded.sourceCount, 1);
  assert.equal(graded.evidence[0].amount, 400);
  const missing = priceEvidence(
    quotes,
    "Reverse Holofoil",
    "USD",
    { condition: "Near Mint" },
    new Date("2026-07-20T12:00:00Z").getTime(),
  );
  assert.equal(missing.level, "unavailable");
  assert.equal(missing.sourceCount, 0);
});

test("freshness uses the provider timestamp instead of making old data fresh when retrieved", () => {
  const now = new Date("2026-08-31T12:00:00Z").getTime();
  const market = priceFreshness(
    {
      priceType: "market",
      observedAt: "2026-08-29T10:00:00Z",
      retrievedAt: "2026-08-31T11:59:00Z",
    },
    { now },
  );
  assert.equal(market.status, "stale");
  assert.equal(market.band, "aging");
  assert.equal(market.reason, "outside_live_window");
  const sold = priceFreshness(
    { priceType: "last_sold", soldAt: "2026-08-10T12:00:00Z" },
    { now },
  );
  assert.equal(sold.status, "live");
  const undated = priceFreshness(
    { priceType: "market", retrievedAt: "2026-08-31T11:59:00Z" },
    { now },
  );
  assert.equal(undated.status, "stale");
  assert.equal(undated.reason, "source_timestamp_missing");
});

test("capability states distinguish unsupported, missing, limits, and provider failures", () => {
  assert.deepEqual(normalizePriceCapabilityStatus("plan_required"), {
    status: "unsupported",
    reason: "plan_required",
  });
  assert.equal(normalizePriceCapabilityStatus("unavailable").status, "missing");
  assert.equal(
    normalizePriceCapabilityStatus("provider_rate_limited").status,
    "rate_limited",
  );
  assert.equal(
    normalizePriceCapabilityStatus("provider_unavailable").status,
    "provider_error",
  );
});

test("confidence counts underlying markets rather than duplicate aggregators", () => {
  const now = new Date("2026-08-31T12:00:00Z").getTime();
  const base = {
    currency: "USD",
    finish: "holofoil",
    condition: "Near Mint",
    priceType: "market",
    observedAt: "2026-08-31T00:00:00Z",
  };
  const report = priceEvidence(
    [
      {
        ...base,
        provider: "tcgplayer",
        market: "tcgplayer",
        aggregator: "pkmnprices",
        amount: 100,
      },
      {
        ...base,
        provider: "tcgplayer",
        market: "tcgplayer",
        aggregator: "tcgdex",
        amount: 101,
      },
      {
        ...base,
        provider: "ebay",
        market: "ebay",
        aggregator: "pkmnprices",
        amount: 104,
      },
    ],
    "Holofoil",
    "USD",
    { condition: "Near Mint" },
    now,
  );
  assert.equal(report.sourceCount, 2);
  assert.equal(report.level, "strong");
  assert.deepEqual(
    report.evidence.map((row) => row.market),
    ["tcgplayer", "ebay"],
  );
});

test("portfolio coverage reports confidence, manual values, and excluded gaps separately", () => {
  const now = new Date("2026-08-31T12:00:00Z").getTime();
  const quote = {
    currency: "USD",
    finish: "holofoil",
    condition: "Near Mint",
    priceType: "market",
    observedAt: "2026-08-31T00:00:00Z",
  };
  const coverage = portfolioPriceCoverage(
    [
      {
        quantity: 2,
        price: 105,
        referencePrice: 105,
        pricingStatus: "live",
        variant: "Holofoil",
        currency: "USD",
        condition: "Near Mint",
        quotes: [
          {
            ...quote,
            provider: "tcgplayer",
            market: "tcgplayer",
            amount: 103,
          },
          { ...quote, provider: "ebay", market: "ebay", amount: 107 },
        ],
      },
      {
        quantity: 1,
        price: null,
        referencePrice: 90,
        pricingStatus: "stale",
      },
      { quantity: 3, price: null, pricingStatus: "unsupported" },
      { quantity: 1, price: 50, pricingStatus: "manual" },
    ],
    { now },
  );
  assert.equal(coverage.totalUnits, 7);
  assert.equal(coverage.liveAutomaticUnits, 2);
  assert.equal(coverage.pricedUnits, 3);
  assert.equal(coverage.categories.strong.units, 2);
  assert.equal(coverage.categories.stale.units, 1);
  assert.equal(coverage.categories.unsupported.units, 3);
  assert.equal(coverage.categories.manual_override.units, 1);
  assert.equal(coverage.automaticValue, 210);
  assert.equal(coverage.manualValue, 50);
  assert.equal(coverage.displayedValue, 260);
});

test("scheduled pricing reserves a conservative provider allowance for every plan", () => {
  assert.deepEqual(pricingCreditPlan("free"), {
    dailyBudget: 100,
    upperBoundPerGroup: 50,
    expanded: false,
  });
  assert.deepEqual(pricingCreditPlan("pro"), {
    dailyBudget: 20_000,
    upperBoundPerGroup: 800,
    expanded: true,
  });
  assert.equal(
    Math.floor(
      pricingCreditPlan("pro").dailyBudget /
        pricingCreditPlan("pro").upperBoundPerGroup,
    ),
    25,
  );
  assert.equal(pricingCreditPlan("business").dailyBudget, 200_000);
});

test("robust outlier review flags but never silently excludes comparable evidence", () => {
  const reviewed = reviewComparableOutliers(
    [100, 101, 99, 102, 1000].map((amount) => ({ amount })),
  );
  assert.equal(reviewed.filter((row) => row.outlierReview.flagged).length, 1);
  assert.equal(reviewed.at(-1).outlierReview.flagged, true);
  assert.equal(
    reviewed.at(-1).outlierReview.ruleVersion,
    PRICE_EVIDENCE_RULE_VERSION,
  );
  assert.equal(
    reviewed.some((row) => row.outlierReview.excluded),
    false,
  );
  const small = reviewComparableOutliers([{ amount: 10 }, { amount: 1000 }]);
  assert.equal(
    small.some((row) => row.outlierReview.flagged),
    false,
  );
  assert.equal(small[0].outlierReview.reason, "insufficient_comparables");
});

test("selects compatible Cardmarket reference without mixing currencies", () => {
  const quotes = normalizeCard(card).quotes;
  assert.equal(selectCardmarketReference(quotes, "Holofoil"), null);
  assert.equal(selectCardmarketReference(quotes, "Reverse Holofoil"), null);
  assert.equal(finishForVariant("1st Edition Holofoil"), "1stEditionHolofoil");
});

test("deduplicates and orders genuine price observations without accepting zero placeholders", () => {
  const first = {
    provider: "tcgplayer",
    providerVariantId: "v",
    currency: "USD",
    condition: null,
    finish: "holofoil",
    amount: 10,
    recordedAt: "2026-07-11T00:00:00Z",
  };
  const second = { ...first, amount: 12, recordedAt: "2026-07-12T00:00:00Z" };
  const merged = mergePriceHistory(
    [second, first],
    [first],
    [{ ...first, amount: 0 }],
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].amount, 10);
  assert.equal(merged[1].amount, 12);
});

test("calculates an honest period movement only with a sufficiently old baseline", () => {
  const history = [
    { amount: 80, recordedAt: "2026-05-30T00:00:00Z" },
    { amount: 100, recordedAt: "2026-06-10T00:00:00Z" },
    { amount: 115, recordedAt: "2026-07-10T00:00:00Z" },
  ];
  assert.deepEqual(
    priceMovement(history, {
      days: 30,
      asOf: "2026-07-10T00:00:00Z",
      currentAmount: 120,
    }),
    {
      days: 30,
      fromAmount: 100,
      toAmount: 120,
      changeAmount: 20,
      changePercent: 20,
      fromDate: "2026-06-10T00:00:00.000Z",
      toDate: "2026-07-10T00:00:00.000Z",
    },
  );
  assert.equal(
    priceMovement(history.slice(1), {
      days: 31,
      asOf: "2026-07-10T00:00:00Z",
    }),
    null,
  );
  assert.equal(priceMovement([{ amount: 10, recordedAt: "bad" }]), null);
});

test("normalizes JustTCG condition, printing, timestamps, statistics and daily history", () => {
  const normalized = normalizeJustTcgCard(
    {
      id: "pokemon-test-set-test-card-1",
      uuid: "card-uuid",
      name: "Test card",
      set_name: "Test Set",
      number: "1",
      rarity: "Rare",
      tcgplayerId: "123",
      variants: [
        {
          id: "variant-slug",
          uuid: "variant-uuid",
          condition: "Near Mint",
          printing: "Holofoil",
          language: "English",
          price: 12.5,
          lastUpdated: 1783814400,
          priceChange24hr: -1.2,
          avgPrice: 11.9,
          priceHistory: [{ p: 10.25, t: 1783728000 }],
        },
      ],
    },
    "2026-07-12T00:00:00.000Z",
    "client-card",
  );
  assert.equal(normalized.providerCardId, "client-card");
  assert.equal(normalized.externalIds.tcgplayer, "123");
  assert.equal(normalized.quotes[0].finish, "holofoil");
  assert.equal(normalized.quotes[0].quality.priceChange24h, -1.2);
  assert.equal(normalized.history[0].granularity, "day");
  assert.equal(normalizePrinting("1st Edition Holofoil"), "1stEditionHolofoil");
  assert.equal(
    selectReferenceQuote(normalized.quotes, "Holofoil").amount,
    12.5,
  );
});

test("normalizes catalog variants and only preserves safe sold-listing links", () => {
  const catalogCard = normalizeTcgdexCard(
    {
      id: "base1-4",
      localId: "4",
      name: "Charizard",
      image: "https://assets.tcgdex.net/en/base/base1/4",
      set: { id: "base1", name: "Base Set" },
      variants: { normal: false, holo: true, firstEdition: true },
    },
    "en",
  );
  assert.equal(catalogCard.id, "tcgdex:en:base1-4");
  assert.deepEqual(catalogCard.variants, ["holo", "firstEdition"]);
  assert.deepEqual(
    catalogCard.variantOptions.map(
      ({ finish, edition, promoType, status }) => ({
        finish,
        edition,
        promoType,
        status,
      }),
    ),
    [
      {
        finish: "holo",
        edition: "unknown",
        promoType: "unknown",
        status: "needs_review",
      },
      {
        finish: "unknown",
        edition: "first_edition",
        promoType: "unknown",
        status: "needs_review",
      },
    ],
  );
  const sale = normalizePkmnPricesSale({
    ebay_listing_id: "123",
    title: "Charizard PSA 10",
    price: 100,
    grader: "PSA",
    grade: "10",
    sold_at: "2026-07-10",
    listing_url: "https://www.ebay.com/itm/123",
  });
  assert.equal(sale.sourceUrl, "https://www.ebay.com/itm/123");
  const unsafe = normalizePkmnPricesSale({
    id: "x",
    title: "Bad link",
    price: 1,
    sold_at: "2026-07-10",
    listing_url: "javascript:alert(1)",
  });
  assert.equal(unsafe.sourceUrl, null);
  const deceptive = normalizePkmnPricesSale({
    id: "x2",
    title: "Deceptive host",
    price: 1,
    sold_at: "2026-07-10",
    listing_url: "https://ebay.com.example.org/itm/123",
  });
  assert.equal(deceptive.sourceUrl, null);
  const german = normalizePkmnPricesSale({
    id: "de-123",
    title: "German sold listing",
    price: 20,
    sold_at: "2026-07-10",
    listing_url: "https://www.ebay.de/itm/123",
  });
  assert.equal(german.sourceUrl, "https://www.ebay.de/itm/123");
});

test("provider-normalized unknown finish cannot inherit a label-derived price", () => {
  const card = normalizeTcgdexCard(
    {
      id: "base1-4",
      name: "Charizard",
      variants: { holo: true, firstEdition: true },
    },
    "en",
  );
  const unresolved = card.variantOptions.find(
    (option) => option.edition === "first_edition",
  );
  const mappedHolo = card.variantOptions.find(
    (option) => option.finish === "holo",
  );
  const quotes = [
    {
      provider: "tcgplayer",
      currency: "USD",
      finish: "normal",
      condition: "Near Mint",
      priceType: "market",
      amount: 123,
    },
    {
      provider: "tcgplayer",
      currency: "USD",
      finish: "1stEditionNormal",
      condition: "Near Mint",
      priceType: "market",
      amount: 234,
    },
    {
      provider: "tcgplayer",
      currency: "USD",
      finish: "holofoil",
      condition: "Near Mint",
      priceType: "market",
      amount: 345,
    },
  ];
  assert.equal(
    selectReferenceQuote(quotes, unresolved.label, "USD", {
      condition: "Near Mint",
      finish: unresolved.finish,
      edition: unresolved.edition,
    }),
    null,
  );
  assert.equal(
    selectReferenceQuote(quotes, mappedHolo.label, "USD", {
      condition: "Near Mint",
      finish: mappedHolo.finish,
      edition: mappedHolo.edition,
    }).amount,
    345,
  );
});

test("normalizes PkmnPrices card quotes and daily history into the shared pricing schema", () => {
  const normalized = normalizePkmnPricesCard(
    {
      id: 4521,
      tcg_player_id: 89356,
      name: "Charizard",
      image_url: "https://images.pkmnprices.com/cards/4521.jpg",
      number: "4",
      total_set_number: "102",
      rarity: "Rare Holo",
      artist: "Mitsuhiro Arita",
      hp: 120,
      stage: "Stage 2",
      card_type: "Fire",
      weakness: "Water",
      retreat_cost: 3,
      energy_type: ["Fire"],
      ability: "Energy Burn",
      attacks: ["Fire Spin"],
      flavor_text: "Spits fire.",
      set: { id: 1, name: "Base Set" },
      prices: [
        {
          source: "tcgplayer",
          currency: "USD",
          condition: "Near Mint",
          variant: "Holofoil",
          market_price: 285,
          created_at: "2026-04-15T00:00:00Z",
        },
        {
          source: "ebay",
          currency: "USD",
          variant: "Holofoil",
          grader: "PSA",
          grade: "10",
          avg: 1200,
          created_at: "2026-04-15T00:00:00Z",
        },
      ],
    },
    [
      {
        date: "2026-04-16",
        avg: 290,
        low: 270,
        high: 310,
        source: "ebay",
        condition: "Near Mint",
        variant: "Holofoil",
        sale_count: 3,
      },
    ],
    "2026-07-15T00:00:00.000Z",
    "base1-4",
  );
  assert.equal(normalized.providerCardId, "base1-4");
  assert.equal(normalized.externalIds.pkmnprices, 4521);
  assert.equal(normalized.quotes[0].provider, "tcgplayer");
  assert.equal(
    normalized.quotes[0].attribution,
    "TCGplayer pricing via PkmnPrices",
  );
  assert.equal(
    selectReferenceQuote(normalized.quotes, "Holofoil", "USD", {
      condition: "Near Mint",
    }).amount,
    285,
  );
  assert.equal(normalized.history[0].amount, 290);
  assert.equal(normalized.history[0].saleCount, undefined);
  assert.equal(normalized.history[0].quality.saleCount, undefined);
  assert.equal(normalized.history[0].quality.sampleSize, null);
  assert.equal(normalized.history[0].low, 270);
  assert.equal(normalized.history[0].high, 310);
  assert.equal(normalized.metadata.hp, 120);
  assert.deepEqual(normalized.metadata.attacks, ["Fire Spin"]);
  assert.deepEqual(gradedPriceLadder(normalized.quotes, "Holofoil"), [
    {
      grader: "PSA",
      grade: "10",
      amount: 1200,
      currency: "USD",
      priceType: "average",
      provider: "ebay",
      observedAt: "2026-04-15T00:00:00Z",
    },
  ]);
});

test("sold evidence preserves exact context fields and rejects incompatible rows", () => {
  const row = {
    id: 1,
    title: "Japanese BGS 9.5 Gold Label",
    price: 125.5,
    currency: "EUR",
    language: "Japanese",
    grader: "BGS",
    grade: "9.5",
    grade_qualifier: "Gold Label",
    variant: "Reverse Holofoil",
    attribution: "exact",
    sold_at: "2026-09-15T00:00:00Z",
    ingested_at: "2026-09-16T04:05:06Z",
    listing_url: "https://www.ebay.de/itm/123",
  };
  const normalized = normalizePkmnPricesSale(row);
  const exact = {
    language: "ja",
    grader: "BGS",
    grade: "9.5",
    gradeQualifier: "Gold Label",
    variant: "Reverse Holofoil",
  };
  assert.equal(normalized.currency, "EUR");
  assert.equal(normalized.grade, "9.5");
  assert.equal(normalized.gradeQualifier, "Gold Label");
  assert.equal(normalized.attribution, "exact");
  assert.equal(normalized.soldAt, row.sold_at);
  assert.equal(normalized.ingestedAt, row.ingested_at);
  assert.equal(normalized.sourceUrl, row.listing_url);
  assert.equal(saleMatchesLookup(normalized, exact), true);
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, finish: "reverseHolofoil" }),
    true,
  );
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, finish: "holofoil" }),
    false,
  );
  assert.equal(
    saleMatchesLookup(
      { ...normalized, title: `${normalized.title} 1st Edition` },
      { ...exact, edition: "unlimited" },
    ),
    false,
  );
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, edition: "first" }),
    false,
  );
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, promoType: "Stamped" }),
    false,
  );
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, language: "en" }),
    false,
  );
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, variant: "Holofoil" }),
    false,
  );
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, grader: "PSA" }),
    false,
  );
  assert.equal(saleMatchesLookup(normalized, { ...exact, grade: "10" }), false);
  assert.equal(
    saleMatchesLookup(normalized, { ...exact, gradeQualifier: "Silver Label" }),
    false,
  );
  assert.equal(
    saleMatchesLookup({ ...normalized, attribution: "shared" }, exact),
    false,
  );
  assert.equal(
    saleMatchesLookup({ ...normalized, currency: null }, exact),
    false,
  );
  assert.equal(
    saleMatchesLookup(
      {
        ...normalized,
        gradingCompany: null,
        grade: null,
        gradeQualifier: null,
      },
      exact,
    ),
    false,
  );
  assert.equal(
    normalizePkmnPricesSale({ ...row, id: 2, currency: "USD" }).currency,
    "USD",
  );
});

test("daily snapshots cannot become completed-sale volume or confidence", () => {
  const item = {
    id: "position-1",
    user_id: "user-1",
    identity_snapshot: { language: "en" },
    card_state: "graded",
    grader: "PSA",
    grade: "10",
    currency: "USD",
  };
  const row = positionObservationRow(item, {
    provider: "ebay",
    providerVariantId: "snapshot",
    currency: "USD",
    finish: "holofoil",
    amount: 100,
    saleCount: 99,
    recordedAt: "2026-09-01T00:00:00Z",
    granularity: "day",
    quality: { aggregator: "pkmnprices" },
  });
  assert.equal(row.sales_count, null);
  assert.equal(row.confidence_reason.sampleSize, null);
  assert.equal(Object.hasOwn(row.source_metadata, "saleCount"), false);
});

test("normalizes marketplace asks without presenting them as completed sales", () => {
  assert.deepEqual(
    normalizePkmnPricesOffer(
      {
        listing_id: 123,
        printing: "Holofoil",
        condition: "Near Mint",
        language: "English",
        price: 279.99,
        shipping_price: 4.5,
        seller_name: "TopTierCards",
        seller_rating: 99.8,
        seller_sales: "50,000+",
        quantity: 3,
        listing_type: "standard",
        direct_seller: true,
        gold_seller: true,
        verified_seller: true,
        custom_title: "Pack fresh",
        updated_at: "2026-06-10T14:22:00Z",
      },
      "tcgplayer",
    ),
    {
      provider: "pkmnprices",
      marketplace: "tcgplayer",
      providerListingId: "123",
      amount: 279.99,
      shipping: 4.5,
      total: 284.49,
      currency: "USD",
      condition: "Near Mint",
      language: "English",
      printing: "Holofoil",
      seller: "TopTierCards",
      sellerRating: 99.8,
      sellerSales: "50,000+",
      quantity: 3,
      listingType: "standard",
      badges: { direct: true, gold: true, verified: true },
      note: "Pack fresh",
      updatedAt: "2026-06-10T14:22:00Z",
    },
  );
  assert.equal(normalizePkmnPricesOffer({ price: 10 }, "ebay"), null);
});

test("loads exact-printing TCGplayer and Cardmarket asks independently", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url, options) => {
    const value = String(url);
    requested.push(value);
    assert.equal(options.headers["X-API-Key"], "offer-secret");
    if (value.includes("/listings/tcgplayer"))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 1,
              price: 25,
              shipping_price: 1,
              condition: "Near Mint",
              printing: "Holofoil",
            },
          ],
        }),
        { status: 200 },
      );
    return new Response(
      JSON.stringify({ error: { message: "Permission required" } }),
      { status: 403 },
    );
  };
  try {
    const result = await fetchPkmnPricesOffers("offer-secret", {
      pkmnpricesId: "4521",
      language: "ja",
      condition: "Near Mint",
      variant: "Unlimited Holofoil",
    });
    assert.equal(result.offers.length, 1);
    assert.deepEqual(result.statuses, {
      tcgplayer: "live",
      cardmarket: "plan_required",
    });
    assert.equal(
      requested.every(
        (url) =>
          url.includes("language=Japanese") &&
          url.includes("sort=price_asc") &&
          url.includes("limit=5"),
      ),
      true,
    );
    assert.equal(
      requested.some((url) => url.includes("printing=Holofoil")),
      true,
    );
    assert.equal(
      requested.some((url) => url.includes("variant=Holofoil")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("offers endpoint reports missing provider configuration without exposing keys", async () => {
  const originalKey = process.env.PKMNPRICES_API_KEY;
  delete process.env.PKMNPRICES_API_KEY;
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  try {
    const lookup = JSON.stringify({
      clientId: "base1-4",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      condition: "Near Mint",
      variant: "Holofoil",
    });
    await offersHandler(
      { method: "GET", query: { lookup }, headers: {}, socket: {} },
      response,
    );
    assert.equal(response.statusCode, 503);
    assert.equal(body.provider, "pkmnprices");
  } finally {
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
  }
});

test("normalizes sealed products into the shared pricing model", () => {
  const product = normalizePkmnPricesSealedProduct(
    {
      id: 5678,
      tcg_player_id: 45123,
      name: "Crown Zenith Elite Trainer Box",
      image_url: "https://images.pkmnprices.com/sealed/5678.jpg",
      set: { id: 284, name: "Crown Zenith" },
      prices: [
        {
          source: "tcgplayer",
          market_price: 189.99,
          created_at: "2026-04-15T00:00:00Z",
        },
      ],
    },
    "2026-07-20T00:00:00Z",
  );
  assert.equal(product.id, "sealed:5678");
  assert.equal(product.cardState, "sealed");
  assert.equal(product.externalIds.pkmnpricesSealed, 5678);
  assert.equal(product.quotes[0].finish, "sealed");
  assert.equal(
    selectReferenceQuote(product.quotes, "Sealed product", "USD", {}).amount,
    189.99,
  );
  assert.equal(finishForVariant("Sealed product"), "sealed");
});

test("sealed search preserves the requested Pro language contract", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url, options) => {
    requested.push(String(url));
    assert.equal(options.headers["X-API-Key"], "sealed-secret");
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 9,
            name: "151 Booster Box",
            set: { id: 1, name: "Pokemon Card 151" },
          },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    const japanese = await fetchPkmnPricesSealedSearch(
      "sealed-secret",
      "151 booster",
      "ja",
      undefined,
      12,
    );
    const german = await fetchPkmnPricesSealedSearch(
      "sealed-secret",
      "display",
      "de",
      undefined,
      1,
    );
    assert.equal(japanese[0].id, "sealed:9");
    assert.equal(japanese[0].language, "jp");
    assert.equal(german[0].language, "de");
    assert.match(requested[0], /\/sealed\?/);
    assert.match(requested[0], /language=jp/);
    assert.match(requested[0], /per_page=12/);
    assert.match(requested[1], /language=de/);
    assert.match(requested[1], /per_page=1/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PkmnPrices bounds Retry-After and aborts an in-flight retry delay", async () => {
  const originalFetch = globalThis.fetch;
  const now = Date.parse("2026-08-19T12:00:00.000Z");
  assert.equal(pkmnPricesRetryDelayMs({ retryAfter: "120" }, 0, now), 2_000);
  assert.equal(
    pkmnPricesRetryDelayMs(
      { retryAfter: "Wed, 19 Aug 2026 12:00:02 GMT" },
      0,
      now,
    ),
    2_000,
  );
  assert.equal(pkmnPricesRetryDelayMs({ retryAfter: "invalid" }, 0, now), 250);

  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: "Slow down" } }), {
      status: 429,
      headers: { "Retry-After": "120" },
    });
  };
  try {
    const pending = fetchPkmnPricesSealedSearch(
      "retry-secret",
      "booster box",
      "en",
      controller.signal,
    );
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(pending, (error) => error?.name === "AbortError");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PkmnPrices applies the bounded Retry-After delay before retrying", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const delays = [];
  let calls = 0;
  globalThis.setTimeout = (callback, delay, ...args) => {
    delays.push(delay);
    queueMicrotask(() => callback(...args));
    return { delay };
  };
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1)
      return new Response(JSON.stringify({ error: { message: "Slow down" } }), {
        status: 429,
        headers: { "Retry-After": "120" },
      });
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  try {
    await fetchPkmnPricesSealedSearch("retry-secret", "booster box", "en");
    assert.equal(calls, 2);
    assert.deepEqual(delays, [2_000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("sealed endpoint exposes honest unconfigured state without a provider key", async () => {
  const originalKey = process.env.PKMNPRICES_API_KEY;
  delete process.env.PKMNPRICES_API_KEY;
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  try {
    await sealedHandler(
      {
        method: "GET",
        query: { q: "Crown Zenith", language: "en" },
        headers: {},
        socket: {},
      },
      response,
    );
    assert.equal(response.statusCode, 503);
    assert.equal(body.code, "provider_unconfigured");
    assert.equal(JSON.stringify(body).includes("PKMNPRICES_API_KEY"), false);
  } finally {
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
  }
});

test("reports PkmnPrices history plan limits without fabricating observations", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers["X-API-Key"], "history-test-secret");
    if (String(url).includes("/prices/history"))
      return new Response(
        JSON.stringify({ error: { message: "Upgrade plan for history" } }),
        { status: 403 },
      );
    return new Response(
      JSON.stringify({
        id: 4521,
        name: "Charizard",
        number: "4",
        set: { name: "Base Set" },
        prices: [],
      }),
      { status: 200 },
    );
  };
  try {
    const result = await fetchPkmnPricesLookup("history-test-secret", {
      pkmnpricesId: "4521",
    });
    assert.equal(result.historyStatus, "plan_required");
    assert.deepEqual(result.history, []);
    assert.equal(JSON.stringify(result).includes("history-test-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("skips history on current-price refreshes to preserve provider credits", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return new Response(
      JSON.stringify({
        id: 4521,
        name: "Charizard",
        number: "4",
        set: { name: "Base Set" },
        prices: [],
      }),
      { status: 200 },
    );
  };
  try {
    const result = await fetchPkmnPricesLookup(
      "current-price-secret",
      { pkmnpricesId: "4521" },
      undefined,
      { includeHistory: false },
    );
    assert.equal(result.historyStatus, "not_requested");
    assert.deepEqual(result.history, []);
    assert.equal(
      requested.some((url) => url.includes("/prices/history")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects a stale PkmnPrices ID and retries the exact card identity", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    const value = String(url);
    requested.push(value);
    if (value.includes("/cards/16909"))
      return new Response(
        JSON.stringify({
          id: 16909,
          name: "Charizard",
          number: "4",
          set: { name: "Celebrations: Classic Collection" },
          prices: [{ source: "TCGPlayer", market_price: 80 }],
        }),
        { status: 200 },
      );
    if (value.includes("/cards?"))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 4521,
              name: "Charizard",
              number: "4",
              set: { name: "Base Set" },
            },
          ],
        }),
        { status: 200 },
      );
    return new Response(
      JSON.stringify({
        id: 4521,
        name: "Charizard",
        number: "4",
        set: { name: "Base Set" },
        prices: [],
      }),
      { status: 200 },
    );
  };
  try {
    const result = await fetchPkmnPricesLookup(
      "identity-secret",
      {
        pkmnpricesId: "16909",
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
      },
      undefined,
      { includeHistory: false },
    );
    assert.equal(result.card.id, 4521);
    assert.equal(
      matchesPkmnPricesIdentity(result.card, {
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
      }),
      true,
    );
    assert.equal(
      requested.some((url) => url.includes("name=Charizard")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requests Japanese search, USD and EUR prices, and 365-day Pro history", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    const value = String(url);
    requested.push(value);
    if (value.includes("/cards?"))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 99,
              name: "リザードン",
              number: "6",
              set: { name: "Expansion Pack" },
            },
          ],
        }),
        { status: 200 },
      );
    if (value.includes("/prices/history"))
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    return new Response(
      JSON.stringify({
        id: 99,
        name: "リザードン",
        number: "6",
        set: { name: "Expansion Pack" },
        prices: [],
      }),
      { status: 200 },
    );
  };
  try {
    await fetchPkmnPricesLookup(
      "pro-secret",
      {
        clientId: "jp-99",
        name: "リザードン",
        set: "Expansion Pack",
        number: "6",
        language: "ja",
      },
      undefined,
      {
        includeHistory: true,
        historyPeriod: "365d",
        historyLimit: 365,
        includeEur: true,
        includeEurHistory: true,
      },
    );
    assert.equal(
      requested.some((url) => url.includes("language=Japanese")),
      true,
    );
    assert.equal(
      requested.some(
        (url) =>
          url.includes("currency=usd") &&
          url.includes("period=365d") &&
          url.includes("limit=365"),
      ),
      true,
    );
    assert.equal(
      requested.some(
        (url) =>
          url.includes("currency=eur") && url.includes("/prices/history"),
      ),
      true,
    );
    assert.equal(
      requested.filter((url) => /\/cards\/99\?currency=/.test(url)).length,
      2,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("requests German pricing identity and preserves the language context", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    const value = String(url);
    requested.push(value);
    if (value.includes("/cards?"))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 144,
              name: "Glurak",
              number: "4",
              set: { name: "Grundset" },
            },
          ],
        }),
        { status: 200 },
      );
    return new Response(
      JSON.stringify({
        id: 144,
        name: "Glurak",
        number: "4",
        set: { name: "Grundset" },
        prices: [
          {
            source: "cardmarket",
            currency: "EUR",
            condition: "Near Mint",
            variant: "Holofoil",
            market_price: 250,
            created_at: "2026-08-30T00:00:00Z",
          },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    const result = await fetchPkmnPricesLookup(
      "pro-secret",
      {
        clientId: "de-144",
        name: "Glurak",
        set: "Grundset",
        number: "4",
        language: "de",
      },
      undefined,
      { includeHistory: false },
    );
    assert.equal(
      requested.some((url) => url.includes("language=German")),
      true,
    );
    assert.equal(result.card.language, "German");
    const normalized = normalizePkmnPricesCard(result.card, [], undefined);
    assert.equal(normalized.language, "German");
    assert.equal(normalized.quotes[0].language, "German");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("normalizes public TCGdex TCGplayer and Cardmarket price fields", () => {
  const normalized = normalizeTcgdexPricingCard(
    {
      id: "base1-4",
      localId: "4",
      name: "Charizard",
      set: { name: "Base Set" },
      pricing: {
        tcgplayer: {
          updated: "2026-07-12T10:00:00Z",
          unit: "USD",
          "unlimited-holofoil": { marketPrice: 350, lowPrice: 300 },
        },
        cardmarket: {
          updated: "2026-07-12T00:00:00Z",
          unit: "EUR",
          idProduct: 273699,
          "trend-holo": 275,
          "avg7-holo": 270,
          "avg-holo": 0,
        },
      },
    },
    "2026-07-12T12:00:00Z",
    "client-base",
  );
  assert.equal(normalized.providerCardId, "client-base");
  assert.equal(
    normalized.quotes.find(
      (quote) => quote.provider === "tcgplayer" && quote.priceType === "market",
    ).finish,
    "holofoil",
  );
  assert.equal(
    normalized.quotes.find(
      (quote) => quote.provider === "cardmarket" && quote.priceType === "trend",
    ).amount,
    275,
  );
  assert.equal(
    normalized.quotes.find((quote) => quote.quality.windowDays === 7).amount,
    270,
  );
  assert.equal(
    selectCardmarketReference(normalized.quotes, "Holofoil").amount,
    275,
  );
  assert.equal(
    normalized.quotes.some((quote) => quote.quality.field === "idProduct"),
    false,
  );
  assert.equal(
    normalized.quotes.some((quote) => quote.amount === 0),
    false,
  );
});

test("server endpoint keeps the JustTCG key in the upstream header and returns normalized data", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.JUSTTCG_API_KEY;
  const originalLicense = process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED;
  process.env.JUSTTCG_API_KEY = "test-server-secret";
  process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED = "true";
  let body;
  const headers = {};
  const response = {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers["x-api-key"], "test-server-secret");
    assert.match(String(url), /q=Test\+card/);
    return new Response(
      JSON.stringify({
        data: [
          {
            id: "pokemon-test-set-test-card-1",
            uuid: "just-card",
            name: "Test card",
            set_name: "Test Set",
            number: "1",
            rarity: "Rare",
            tcgplayerId: "123",
            variants: [
              {
                id: "v",
                uuid: "variant",
                condition: "Near Mint",
                printing: "Holofoil",
                language: "English",
                price: 9.5,
                lastUpdated: 1783814400,
                priceHistory: [],
              },
            ],
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const lookups = JSON.stringify([
      {
        clientId: "set-1",
        name: "Test card",
        set: "Test Set",
        number: "1/100",
      },
    ]);
    await handler(
      { method: "GET", query: { lookups }, headers: {}, socket: {} },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(body.cards[0].providerCardId, "set-1");
    assert.deepEqual(body.providers, ["justtcg"]);
    assert.equal(JSON.stringify(body).includes("test-server-secret"), false);
    assert.match(headers["Cache-Control"], /s-maxage=900/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.JUSTTCG_API_KEY;
    else process.env.JUSTTCG_API_KEY = originalKey;
    if (originalLicense === undefined)
      delete process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED;
    else process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED = originalLicense;
  }
});

test("server endpoint ignores JustTCG until a commercial license is approved", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.JUSTTCG_API_KEY;
  const originalLicense = process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED;
  const originalPkmnKey = process.env.PKMNPRICES_API_KEY;
  process.env.JUSTTCG_API_KEY = "must-not-be-used";
  delete process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED;
  delete process.env.PKMNPRICES_API_KEY;
  let justTcgCalled = false;
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  globalThis.fetch = async (url) => {
    if (String(url).includes("justtcg")) justTcgCalled = true;
    return new Response(
      JSON.stringify({
        id: "base-set-1",
        name: "Test card",
        set: { id: "base", name: "Test Set" },
        localId: "1",
        variants: { normal: true },
        pricing: {},
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const lookups = JSON.stringify([
      {
        clientId: "set-1",
        tcgdexId: "base-set-1",
        name: "Test card",
        set: "Test Set",
        number: "1/100",
      },
    ]);
    await handler(
      { method: "GET", query: { lookups }, headers: {}, socket: {} },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(justTcgCalled, false);
    assert.deepEqual(body.providers, ["tcgdex"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.JUSTTCG_API_KEY;
    else process.env.JUSTTCG_API_KEY = originalKey;
    if (originalLicense === undefined)
      delete process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED;
    else process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED = originalLicense;
    if (originalPkmnKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalPkmnKey;
  }
});

test("server endpoint prefers PkmnPrices when its key is configured", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PKMNPRICES_API_KEY;
  const originalJustKey = process.env.JUSTTCG_API_KEY;
  process.env.PKMNPRICES_API_KEY = "test-pkmnprices-secret";
  delete process.env.JUSTTCG_API_KEY;
  const requested = [];
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  globalThis.fetch = async (url, options) => {
    requested.push(String(url));
    assert.equal(options.headers["X-API-Key"], "test-pkmnprices-secret");
    if (String(url).includes("/cards?"))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 4521,
              name: "Charizard",
              number: "4",
              set: { name: "Base Set" },
            },
          ],
        }),
        { status: 200 },
      );
    if (String(url).includes("/prices/history"))
      return new Response(
        JSON.stringify({
          data: [
            {
              date: "2026-04-16",
              avg: 290,
              source: "ebay",
              condition: "Near Mint",
              variant: "Holofoil",
              sale_count: 3,
            },
          ],
        }),
        { status: 200 },
      );
    return new Response(
      JSON.stringify({
        id: 4521,
        tcg_player_id: 89356,
        name: "Charizard",
        number: "4",
        set: { name: "Base Set" },
        prices: [
          {
            source: "tcgplayer",
            currency: "USD",
            condition: "Near Mint",
            variant: "Holofoil",
            market_price: 285,
            created_at: "2026-04-15T00:00:00Z",
          },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    const lookups = JSON.stringify([
      {
        clientId: "base1-4",
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
      },
    ]);
    await handler(
      {
        method: "GET",
        query: { lookups, history: "full" },
        headers: {},
        socket: {},
      },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.providers, ["pkmnprices"]);
    assert.equal(body.cards[0].quotes[0].amount, 285);
    assert.equal(body.cards[0].history[0].amount, 290);
    assert.equal(
      JSON.stringify(body).includes("test-pkmnprices-secret"),
      false,
    );
    assert.equal(
      requested.some((url) => /api\.tcgdex/.test(url)),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
    if (originalJustKey === undefined) delete process.env.JUSTTCG_API_KEY;
    else process.env.JUSTTCG_API_KEY = originalJustKey;
  }
});

test("a PkmnPrices timeout does not abort the TCGdex fallback tier", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalPkmnKey = process.env.PKMNPRICES_API_KEY;
  const originalJustKey = process.env.JUSTTCG_API_KEY;
  const originalProvider = process.env.PRICING_PROVIDER;
  process.env.PKMNPRICES_API_KEY = "timeout-secret";
  delete process.env.JUSTTCG_API_KEY;
  process.env.PRICING_PROVIDER = "pkmnprices";
  let paidSignal;
  let fallbackSignal;
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  globalThis.setTimeout = (callback, delay, ...args) =>
    originalSetTimeout(callback, delay === 4_500 ? 5 : delay, ...args);
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("api.pkmnprices.com")) {
      paidSignal = options.signal;
      return new Promise((resolve, reject) => {
        const rejectAbort = () => reject(options.signal.reason);
        if (options.signal.aborted) rejectAbort();
        else
          options.signal.addEventListener("abort", rejectAbort, { once: true });
      });
    }
    assert.match(String(url), /api\.tcgdex\.net\/v2\/en\/cards\/base1-4/);
    fallbackSignal = options.signal;
    assert.equal(fallbackSignal.aborted, false);
    return new Response(
      JSON.stringify({
        id: "base1-4",
        localId: "4",
        name: "Charizard",
        set: { name: "Base Set" },
        pricing: {
          tcgplayer: {
            updated: "2026-07-12T10:00:00Z",
            unit: "USD",
            holofoil: { marketPrice: 350 },
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const lookups = JSON.stringify([
      {
        clientId: "base1-4",
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
      },
    ]);
    await handler(
      {
        method: "GET",
        query: { lookups },
        headers: {},
        socket: { remoteAddress: "timeout-fallback-test" },
      },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.providers, ["tcgdex"]);
    assert.equal(body.cards[0].quotes[0].amount, 350);
    assert.equal(paidSignal.aborted, true);
    assert.equal(fallbackSignal.aborted, false);
    assert.notEqual(paidSignal, fallbackSignal);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    if (originalPkmnKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalPkmnKey;
    if (originalJustKey === undefined) delete process.env.JUSTTCG_API_KEY;
    else process.env.JUSTTCG_API_KEY = originalJustKey;
    if (originalProvider === undefined) delete process.env.PRICING_PROVIDER;
    else process.env.PRICING_PROVIDER = originalProvider;
  }
});

test("server endpoint returns public TCGdex market pricing when no paid key is configured", async () => {
  const originalFetch = globalThis.fetch;
  const originalPkmnKey = process.env.PKMNPRICES_API_KEY;
  const originalJustKey = process.env.JUSTTCG_API_KEY;
  const originalPricingKey = process.env.PRICING_PROVIDER_API_KEY;
  delete process.env.PKMNPRICES_API_KEY;
  delete process.env.JUSTTCG_API_KEY;
  delete process.env.PRICING_PROVIDER_API_KEY;
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  globalThis.fetch = async (url) => {
    assert.match(String(url), /api\.tcgdex\.net\/v2\/en\/cards\/base1-4/);
    return new Response(
      JSON.stringify({
        id: "base1-4",
        localId: "4",
        name: "Charizard",
        set: { name: "Base Set" },
        pricing: {
          tcgplayer: {
            updated: "2026-07-12T10:00:00Z",
            unit: "USD",
            holofoil: { marketPrice: 350 },
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const lookups = JSON.stringify([
      {
        clientId: "base1-4",
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
      },
    ]);
    await handler(
      { method: "GET", query: { lookups }, headers: {}, socket: {} },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.providers, ["tcgdex"]);
    assert.equal(body.cards[0].quotes[0].amount, 350);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPkmnKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalPkmnKey;
    if (originalJustKey === undefined) delete process.env.JUSTTCG_API_KEY;
    else process.env.JUSTTCG_API_KEY = originalJustKey;
    if (originalPricingKey === undefined)
      delete process.env.PRICING_PROVIDER_API_KEY;
    else process.env.PRICING_PROVIDER_API_KEY = originalPricingKey;
  }
});

test("sold evidence preserves printing attribution and excludes unrelated raw comps", async () => {
  const originalFetch = globalThis.fetch;
  const base = {
    id: 1,
    title: "Test card",
    price: 12,
    currency: "USD",
    sold_at: "2026-09-01",
    ingested_at: "2026-09-02T00:00:00Z",
    listing_url: "https://www.ebay.com/itm/123",
    variant: "Reverse Holofoil",
    attribution: "exact",
  };
  const rows = [
    base,
    { ...base, id: 2, attribution: "shared" },
    { ...base, id: 3, attribution: "unknown" },
    { ...base, id: 4, attribution: undefined },
    { ...base, id: 5, variant: "Normal" },
    { ...base, id: 6, variant: null },
    { ...base, id: 7, grader: "PSA", grade: "10" },
    { ...base, id: 8, variant: "Staff Reverse Holofoil" },
    { ...base, id: 9, listing_url: "https://ebay.com.evil.test/sale" },
  ];
  const requests = [];
  globalThis.fetch = async (input) => {
    requests.push(new URL(input));
    return new Response(
      JSON.stringify({ data: rows, pagination: { has_more: true } }),
    );
  };
  try {
    const result = await fetchPkmnPricesSales("key", {
      pkmnpricesId: "123",
      variant: "reverse_holofoil",
      condition: "Near Mint",
    });
    assert.deepEqual(
      result.sales.map((sale) => sale.providerSaleId),
      ["1"],
    );
    assert.equal(result.sales[0].printing, "Reverse Holofoil");
    assert.equal(result.sales[0].attribution, "exact");
    assert.equal(result.sales[0].ingestedAt, base.ingested_at);
    assert.equal(result.conditionScope, "not_provided");
    assert.equal(result.excludedCount, 8);
    assert.equal(result.hasMore, true);
    assert.equal(requests[0].searchParams.get("graded"), "false");
    assert.equal(requests[0].searchParams.get("variant"), "Reverse Holofoil");
    assert.equal(requests[0].searchParams.has("condition"), false);
    const unknown = await fetchPkmnPricesSales("key", { pkmnpricesId: "123" });
    assert.equal(unknown.sales.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sold evidence never mixes grader, grade, or named grade tiers", async () => {
  const originalFetch = globalThis.fetch;
  const base = {
    id: 1,
    title: "CGC 10 Test card",
    price: 100,
    currency: "USD",
    grader: "CGC",
    grade: "10",
    variant: "Holofoil",
    attribution: "exact",
    sold_at: "2026-09-01",
    listing_url: "https://www.ebay.com/itm/123",
  };
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get("graded"), "true");
    assert.equal(url.searchParams.get("grader"), "CGC");
    assert.equal(url.searchParams.get("grade"), "10");
    return new Response(
      JSON.stringify({
        data: [
          base,
          { ...base, id: 2, grade_qualifier: "Pristine" },
          { ...base, id: 3, grader: "PSA" },
          { ...base, id: 4, grade: "9" },
          { ...base, id: 5, grader: null, grade: null },
        ],
      }),
    );
  };
  try {
    const lookup = {
      pkmnpricesId: "123",
      variant: "Holofoil",
      grader: "CGC",
      grade: "10",
    };
    const standard = await fetchPkmnPricesSales("key", lookup);
    assert.deepEqual(
      standard.sales.map((sale) => sale.providerSaleId),
      ["1"],
    );
    const pristine = await fetchPkmnPricesSales("key", {
      ...lookup,
      gradeQualifier: "Pristine",
    });
    assert.deepEqual(
      pristine.sales.map((sale) => sale.providerSaleId),
      ["2"],
    );
    assert.equal(pristine.sales[0].gradeQualifier, "Pristine");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("direct sold lookups reject a provider card from another language", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    requests.push(new URL(input));
    return new Response(JSON.stringify({ id: 123, language: "English" }));
  };
  try {
    const result = await fetchPkmnPricesSales("key", {
      pkmnpricesId: "123",
      language: "ja",
      variant: "Holofoil",
      grader: "PSA",
      grade: "10",
    });
    assert.equal(result.cardId, null);
    assert.deepEqual(result.sales, []);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].pathname, "/v1/cards/123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sold evidence rejects an exact-attributed row for a different canonical printing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    if (!url.pathname.endsWith("/listings/ebay"))
      return new Response(
        JSON.stringify({
          id: 10195,
          name: "Pikachu",
          number: "006",
          total_set_number: 15,
          language: "English",
          set: { id: 426, name: "McDonald's Promos 2023" },
        }),
      );
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 1,
            title:
              "Flying Pikachu V #006/025 | 2021 Pokemon Celebrations | PSA 10",
            price: 70,
            currency: "USD",
            grader: "PSA",
            grade: "10",
            variant: "Holofoil",
            attribution: "exact",
            sold_at: "2026-09-16",
            ingested_at: "2026-09-17T01:00:00Z",
            listing_url: "https://www.ebay.com/itm/1001",
          },
          {
            id: 2,
            title: "PSA 10 McDonald's Pikachu Holo 2023 Pokemon 006/015",
            price: 45,
            currency: "USD",
            grader: "PSA",
            grade: "10",
            variant: "Holofoil",
            attribution: "exact",
            sold_at: "2026-08-24",
            ingested_at: "2026-09-17T01:00:00Z",
            listing_url: "https://www.ebay.com/itm/1002",
          },
          {
            id: 3,
            title: "Pikachu Holo PSA 10",
            price: 50,
            currency: "USD",
            grader: "PSA",
            grade: "10",
            variant: "Holofoil",
            attribution: "exact",
            sold_at: "2026-08-20",
            ingested_at: "2026-09-17T01:00:00Z",
            listing_url: "https://www.ebay.com/itm/1003",
          },
          {
            id: 4,
            title: "Pikachu 006/015 and Flying Pikachu 006/025 bundle PSA 10",
            price: 80,
            currency: "USD",
            grader: "PSA",
            grade: "10",
            variant: "Holofoil",
            attribution: "exact",
            sold_at: "2026-08-19",
            ingested_at: "2026-09-17T01:00:00Z",
            listing_url: "https://www.ebay.com/itm/1004",
          },
          {
            id: 5,
            title: "Pikachu 006/015 McDonalds 2022 PSA 10",
            price: 40,
            currency: "USD",
            grader: "PSA",
            grade: "10",
            variant: "Holofoil",
            attribution: "exact",
            sold_at: "2026-08-18",
            ingested_at: "2026-09-17T01:00:00Z",
            listing_url: "https://www.ebay.com/itm/1005",
          },
          {
            id: 6,
            title: "Pikachu 006/015 Celebrations 2023 PSA 10",
            price: 41,
            currency: "USD",
            grader: "PSA",
            grade: "10",
            variant: "Holofoil",
            attribution: "exact",
            sold_at: "2026-08-17",
            ingested_at: "2026-09-17T01:00:00Z",
            listing_url: "https://www.ebay.com/itm/1006",
          },
        ],
      }),
    );
  };
  try {
    const result = await fetchPkmnPricesSales("synthetic-key", {
      clientId: "mcdonalds-2023-006",
      pkmnpricesId: "10195",
      name: "Pikachu",
      set: "McDonald's Promos 2023",
      number: "006/015",
      language: "en",
      variant: "Holofoil",
      grader: "PSA",
      grade: "10",
    });
    assert.deepEqual(
      result.sales.map((sale) => sale.providerSaleId),
      ["2"],
    );
    assert.deepEqual(result.exclusions, {
      normalizationRejected: 0,
      contextMismatch: 0,
      canonicalIdentityMismatch: 5,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("canonical sale identity preserves Japanese text and rejects contradictions", () => {
  const card = {
    id: 200,
    name: "ピカチュウ",
    number: "025",
    total_set_number: "165",
    set: { name: "ポケモンカード151" },
  };
  const lookup = {
    name: "ピカチュウ",
    set: "ポケモンカード151",
    number: "025/165",
    language: "ja",
  };
  assert.equal(
    saleMatchesCanonicalIdentity(
      { title: "ピカチュウ 025/165 PSA 10" },
      card,
      lookup,
    ),
    true,
  );
  assert.equal(
    saleMatchesCanonicalIdentity(
      { title: "ミュウ 025/165 PSA 10" },
      card,
      lookup,
    ),
    false,
  );
  assert.equal(
    saleMatchesCanonicalIdentity(
      { title: "ピカチュウ 151/165 PSA 10" },
      card,
      lookup,
    ),
    false,
  );
  assert.equal(
    saleMatchesCanonicalIdentity(
      { title: "ピカチュウ 025/165 黒炎の支配者 PSA 10" },
      card,
      lookup,
    ),
    false,
  );
});

test("sold API passes exact context and validates it even with direct provider IDs", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PKMNPRICES_API_KEY;
  process.env.PKMNPRICES_API_KEY = "test-sales-secret";
  let body;
  let calls = 0;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  globalThis.fetch = async (input) => {
    calls += 1;
    const url = new URL(input);
    if (!url.pathname.endsWith("/listings/ebay"))
      return new Response(
        JSON.stringify({
          id: 123,
          name: "Pikachu",
          number: "1",
          total_set_number: 10,
          language: "English",
          set: { name: "Test Set" },
        }),
      );
    assert.equal(url.searchParams.get("variant"), "Reverse Holofoil");
    assert.equal(url.searchParams.get("graded"), "false");
    return new Response(
      JSON.stringify({
        data: [
          {
            id: 1,
            price: 8,
            title: "Pikachu 1/10 Reverse Holo",
            currency: "USD",
            variant: "Reverse Holofoil",
            attribution: "exact",
            sold_at: "2026-09-01",
            listing_url: "https://www.ebay.com/itm/1",
          },
        ],
      }),
    );
  };
  try {
    const lookup = {
      clientId: "card",
      pkmnpricesId: "123",
      name: "Pikachu",
      set: "Test Set",
      number: "1/10",
      variant: "reverse_holofoil",
    };
    await salesHandler(
      { method: "GET", query: { lookup: JSON.stringify(lookup) } },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(body.sales.length, 1);
    assert.equal(body.conditionScope, "not_provided");
    assert.equal(body.sales[0].printing, "Reverse Holofoil");
    assert.deepEqual(
      {
        canonicalValidated: body.validatedContext.canonicalValidated,
        completedSaleValidated: body.validatedContext.completedSaleValidated,
        providerCardId: body.validatedContext.providerCardId,
        variant: body.validatedContext.variant,
      },
      {
        canonicalValidated: true,
        completedSaleValidated: true,
        providerCardId: "123",
        variant: "reverse_holofoil",
      },
    );
    await salesHandler(
      {
        method: "GET",
        query: { lookup: JSON.stringify({ ...lookup, grader: "<script>" }) },
      },
      response,
    );
    assert.equal(response.statusCode, 400);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
  }
});

test("sold endpoint reports a missing PkmnPrices plan entitlement honestly", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PKMNPRICES_API_KEY;
  process.env.PKMNPRICES_API_KEY = "test-sales-secret";
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  globalThis.fetch = async (url) => {
    if (String(url).includes("/cards?"))
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 10571,
              name: "Charizard",
              number: "4",
              set: { name: "Base Set" },
            },
          ],
        }),
        { status: 200 },
      );
    return new Response(
      JSON.stringify({
        error: { code: "forbidden", message: "Listings require Pro or higher" },
      }),
      { status: 403 },
    );
  };
  try {
    const lookup = JSON.stringify({
      clientId: "base1-4",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
    });
    await salesHandler({ method: "GET", query: { lookup } }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(body.code, "provider_plan_required");
    assert.equal(JSON.stringify(body).includes("test-sales-secret"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
  }
});

test("sold API distinguishes empty, invalid-key, and rate-limited states", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PKMNPRICES_API_KEY;
  const originalError = console.error;
  process.env.PKMNPRICES_API_KEY = "synthetic-sales-secret";
  console.error = () => {};
  const lookup = JSON.stringify({
    clientId: "card-123",
    pkmnpricesId: "123",
    language: "en",
    variant: "Holofoil",
    grader: "PSA",
    grade: "10",
  });
  const invoke = async () => {
    let body;
    const response = {
      setHeader() {},
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(value) {
        body = value;
        return value;
      },
    };
    await salesHandler({ method: "GET", query: { lookup } }, response);
    return { status: response.statusCode, body };
  };
  try {
    let listingResponse = () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 });
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      if (!url.pathname.endsWith("/listings/ebay"))
        return new Response(JSON.stringify({ id: 123, language: "English" }));
      return listingResponse();
    };
    const empty = await invoke();
    assert.equal(empty.status, 200);
    assert.equal(empty.body.capabilityStatus, "missing");
    assert.deepEqual(empty.body.sales, []);

    listingResponse = () =>
      new Response(JSON.stringify({ error: { code: "invalid_key" } }), {
        status: 403,
      });
    const invalid = await invoke();
    assert.equal(invalid.status, 502);
    assert.equal(invalid.body.code, "provider_authentication_failed");

    listingResponse = () =>
      new Response(JSON.stringify({ error: { code: "rate_limited" } }), {
        status: 429,
      });
    const limited = await invoke();
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "provider_rate_limited");
    assert.equal(
      JSON.stringify(limited.body).includes("synthetic-sales-secret"),
      false,
    );
  } finally {
    console.error = originalError;
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
  }
});

test("history follows scoped pagination instead of treating row limit as days", async () => {
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    requests.push(u);
    if (!u.pathname.endsWith("/prices/history"))
      return new Response(JSON.stringify({ id: 99, prices: [] }));
    const page = Number(u.searchParams.get("page"));
    return new Response(
      JSON.stringify({
        data: [
          {
            date: `2026-09-0${page}`,
            source: "tcgplayer",
            currency: "USD",
            condition: "Near Mint",
            variant: "Holofoil",
            avg: 10 + page,
          },
        ],
        pagination: { page, total_pages: 3 },
      }),
    );
  };
  try {
    const result = await fetchPkmnPricesLookup(
      "fixture",
      { pkmnpricesId: "99", variant: "Holofoil", condition: "Near Mint" },
      undefined,
      { historyPeriod: "365d", historyLimit: 365 },
    );
    const pages = requests.filter((u) =>
      u.pathname.endsWith("/prices/history"),
    );
    assert.equal(pages.length, 3);
    assert.equal(result.history.length, 3);
    assert.equal(result.historyStatus, "live");
    for (const u of pages) {
      assert.equal(u.searchParams.get("variant"), "Holofoil");
      assert.equal(u.searchParams.get("condition"), "Near Mint");
      assert.equal(u.searchParams.get("period"), "365d");
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("history retains current prices and collected rows when a later page is unavailable", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = new URL(url);
    if (!u.pathname.endsWith("/prices/history"))
      return new Response(
        JSON.stringify({ id: 99, prices: [{ market_price: 12 }] }),
      );
    if (u.searchParams.get("page") === "2")
      return new Response("{}", { status: 403 });
    return new Response(
      JSON.stringify({
        data: [{ date: "2026-09-01", avg: 10 }],
        pagination: { page: 1, total_pages: 2 },
      }),
    );
  };
  try {
    const result = await fetchPkmnPricesLookup("fixture", {
      pkmnpricesId: "99",
    });
    assert.equal(result.card.prices[0].market_price, 12);
    assert.equal(result.history.length, 1);
    assert.equal(result.historyStatus, "partial");
  } finally {
    globalThis.fetch = original;
  }
});

test("history bounds excessive pagination and rejects impossible dates without losing a card", async () => {
  const original = globalThis.fetch;
  let pages = 0;
  globalThis.fetch = async (url) => {
    if (!String(url).includes("/prices/history"))
      return new Response(JSON.stringify({ id: 99, prices: [] }));
    pages++;
    return new Response(
      JSON.stringify({
        data: [{ date: `2026-09-0${pages}`, avg: 10 }],
        pagination: { page: pages, total_pages: 99999 },
      }),
    );
  };
  try {
    const result = await fetchPkmnPricesLookup("fixture", {
      pkmnpricesId: "99",
    });
    assert.equal(pages, 4);
    assert.equal(result.historyStatus, "partial");
    const normalized = normalizePkmnPricesCard(
      result.card,
      [
        { date: "garbage", avg: 10 },
        { date: "2026-02-30", avg: 10 },
        { date: "2026-09-01", avg: 12 },
      ],
      new Date().toISOString(),
      "99",
    );
    assert.equal(normalized.history.length, 1);
    assert.equal(normalized.history[0].amount, 12);
  } finally {
    globalThis.fetch = original;
  }
});

test("PSA sale summaries retain evidence but exclude wrong grades, duplicates and flagged prices", () => {
  const sale = {
    gradingCompany: "PSA",
    grade: "10",
    attribution: "exact",
    printing: "Holofoil",
    amount: 100,
    currency: "USD",
    soldAt: "2026-09-01",
    sourceUrl: "https://www.ebay.com/itm/123",
    providerSaleId: "1",
  };
  const rows = [
    sale,
    { ...sale },
    {
      ...sale,
      amount: 200,
      providerSaleId: "2",
      sourceUrl: "https://www.ebay.com/itm/456",
    },
    {
      ...sale,
      amount: 9999,
      providerSaleId: "3",
      sourceUrl: "https://www.ebay.com/itm/789",
      outlierReview: { flagged: true },
    },
    { ...sale, grade: "9" },
    { ...sale, gradeQualifier: "Pristine" },
    { ...sale, attribution: "shared" },
    { ...sale, sourceUrl: "javascript:alert(1)" },
    { ...sale, soldAt: "2035-01-01" },
  ];
  const result = summarizePsaSales(rows, 10, Date.parse("2026-09-06"));
  assert.equal(result.median, 150);
  assert.equal(result.count, 2);
  assert.equal(result.excluded, 1);
  assert.equal(result.rows.length, 3);
  assert.equal(summarizePsaSales([], 9).median, null);
});

test("PSA sale samples count one listing across title and regional URLs", () => {
  const sale = {
    gradingCompany: "PSA",
    grade: "10",
    attribution: "exact",
    amount: 100,
    currency: "USD",
    soldAt: "2026-09-01",
    sourceUrl: "https://www.ebay.com/itm/123456789012",
    providerSaleId: "first",
  };
  const rows = [
    sale,
    {
      ...sale,
      amount: 999,
      providerSaleId: "second",
      sourceUrl:
        "https://www.ebay.com/itm/Pikachu-PSA-10/123456789012?tracking=abc",
    },
    {
      ...sale,
      amount: 999,
      providerSaleId: "third",
      sourceUrl: "https://www.ebay.co.uk/itm/123456789012/",
    },
    {
      ...sale,
      amount: 200,
      providerSaleId: "fourth",
      sourceUrl: "https://www.ebay.com/itm/Pikachu/123456789013",
    },
  ];
  const result = summarizePsaSales(rows, 10, Date.parse("2026-09-06"));
  assert.equal(result.count, 2);
  assert.equal(result.median, 150);
  assert.equal(result.rows.length, 2);
});

test("PSA sale samples require direct identifiable listing links", () => {
  const urls = [
    "https://www.ebay.com/",
    "https://www.ebay.com/sch/i.html?_nkw=pikachu",
    "https://www.ebay.com/itm/unknown",
    "https://www.ebay.com/itm/123/extra",
    "https://user:password@www.ebay.com/itm/123",
    "https://www.ebay.com:8443/itm/123",
  ];
  const rows = urls.map((sourceUrl, index) => ({
    gradingCompany: "PSA",
    grade: "10",
    attribution: "exact",
    amount: 100,
    currency: "USD",
    soldAt: "2026-09-01",
    sourceUrl,
    providerSaleId: String(index),
  }));
  const result = summarizePsaSales(rows, 10, Date.parse("2026-09-06"));
  assert.equal(result.count, 0);
  assert.equal(result.median, null);
});
