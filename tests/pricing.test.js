import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/cards.js";
import offersHandler from "../api/offers.js";
import sealedHandler from "../api/sealed.js";
import salesHandler from "../api/sales.js";
import {
  finishForVariant,
  gradedPriceLadder,
  mergePriceHistory,
  normalizeCard,
  priceEvidence,
  priceMovement,
  selectCardmarketReference,
  selectReferenceQuote,
} from "../lib/pricing.js";
import {
  normalizeJustTcgCard,
  normalizePrinting,
} from "../lib/providers/justtcg.js";
import {
  fetchPkmnPricesOffers,
  fetchPkmnPricesSealedSearch,
  fetchPkmnPricesLookup,
  normalizePkmnPricesCard,
  normalizePkmnPricesOffer,
  normalizePkmnPricesSealedProduct,
  normalizePkmnPricesSale,
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

test("price evidence scores only exact compatible context and explains disagreement", () => {
  const quotes = [
    { provider:"tcgplayer",currency:"USD",finish:"holofoil",condition:"Near Mint",gradingCompany:null,grade:null,priceType:"market",amount:100,observedAt:"2026-07-18" },
    { provider:"pkmnprices",currency:"USD",finish:"holofoil",condition:"Near Mint",gradingCompany:null,grade:null,priceType:"average",amount:108,observedAt:"2026-07-19" },
    { provider:"ebay",currency:"USD",finish:"holofoil",condition:null,gradingCompany:"PSA",grade:"10",priceType:"average",amount:400,observedAt:"2026-07-19" },
    { provider:"cardmarket",currency:"EUR",finish:"holofoil",condition:null,gradingCompany:null,grade:null,priceType:"trend",amount:80,observedAt:"2026-07-19" },
  ];
  const report=priceEvidence(quotes,"Holofoil","USD",{condition:"Near Mint"},new Date("2026-07-20T12:00:00Z").getTime());
  assert.equal(report.level,"strong");
  assert.equal(report.sourceCount,2);
  assert.ok(report.spreadPercent>7&&report.spreadPercent<8);
  assert.deepEqual(report.evidence.map(item=>item.provider),["tcgplayer","pkmnprices"]);
  const graded=priceEvidence(quotes,"Holofoil","USD",{gradingCompany:"PSA",grade:"10"},new Date("2026-07-20T12:00:00Z").getTime());
  assert.equal(graded.level,"limited");
  assert.equal(graded.sourceCount,1);
  assert.equal(graded.evidence[0].amount,400);
  const missing=priceEvidence(quotes,"Reverse Holofoil","USD",{condition:"Near Mint"},new Date("2026-07-20T12:00:00Z").getTime());
  assert.equal(missing.level,"unavailable");
  assert.equal(missing.sourceCount,0);
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
  assert.equal(normalized.history[0].quality.saleCount, 3);
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
  assert.equal(
    normalizePkmnPricesOffer({ price: 10 }, "ebay"),
    null,
  );
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
    const result = await fetchPkmnPricesOffers(
      "offer-secret",
      {
        pkmnpricesId: "4521",
        language: "ja",
        condition: "Near Mint",
        variant: "Unlimited Holofoil",
      },
    );
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

test("sealed search requests the documented Japanese product language", async () => {
  const originalFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url, options) => {
    requested = String(url);
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
    const products = await fetchPkmnPricesSealedSearch(
      "sealed-secret",
      "151 booster",
      "ja",
      undefined,
      12,
    );
    assert.equal(products[0].id, "sealed:9");
    assert.match(requested, /\/sealed\?/);
    assert.match(requested, /language=jp/);
    assert.match(requested, /per_page=12/);
  } finally {
    globalThis.fetch = originalFetch;
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
  process.env.JUSTTCG_API_KEY = "test-server-secret";
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
