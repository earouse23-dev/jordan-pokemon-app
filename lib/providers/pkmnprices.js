const API_URL = "https://api.pkmnprices.com/v1";

function finiteAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function comparable(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function finishFromVariant(value) {
  const variant = String(value || "").toLowerCase();
  if (
    variant.includes("1st") &&
    (variant.includes("holo") || variant.includes("foil"))
  )
    return "1stEditionHolofoil";
  if (variant.includes("1st")) return "1stEditionNormal";
  if (variant.includes("reverse")) return "reverseHolofoil";
  if (variant.includes("holo") || variant.includes("foil")) return "holofoil";
  return "normal";
}

function sourceProvider(value) {
  const source = String(value || "").toLowerCase();
  if (source.includes("cardmarket")) return "cardmarket";
  if (source.includes("ebay")) return "ebay";
  return "tcgplayer";
}

function sourceCurrency(value) {
  return sourceProvider(value) === "cardmarket" ? "EUR" : "USD";
}

function selectCard(cards, lookup) {
  const wantedName = comparable(lookup.name);
  const wantedSet = comparable(lookup.set);
  const wantedNumber = comparable(String(lookup.number || "").split("/")[0]);
  return (
    [...cards].sort((left, right) => {
      const score = (card) =>
        (comparable(card.name) === wantedName ? 8 : 0) +
        (comparable(card.set?.name) === wantedSet ? 4 : 0) +
        (comparable(card.number) === wantedNumber ? 2 : 0);
      return score(right) - score(left);
    })[0] || null
  );
}

export function matchesPkmnPricesIdentity(card, lookup) {
  if (!card || !lookup) return false;
  const wantedName = comparable(lookup.name);
  const wantedSet = comparable(lookup.set || lookup.setName);
  const wantedNumber = comparable(String(lookup.number || "").split("/")[0]);
  const cardName = comparable(card.name);
  const cardSet = comparable(card.set?.name || card.set_name);
  const cardNumber = comparable(String(card.number || "").split("/")[0]);
  if (!wantedName && !wantedSet && !wantedNumber) return true;
  if (wantedName && cardName !== wantedName) return false;
  if (wantedNumber && cardNumber !== wantedNumber) return false;
  if (wantedSet && cardSet !== wantedSet) return false;
  return true;
}

function safeSaleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      /(^|\.)ebay\.[a-z.]+$/i.test(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function safeCardmarketUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      /(^|\.)cardmarket\.com$/i.test(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function providerLanguage(value) {
  const language = String(value || "").toLowerCase();
  return (
    {
      en: "English",
      ja: "Japanese",
      jp: "Japanese",
      de: "German",
      fr: "French",
      es: "Spanish",
      it: "Italian",
      pt: "Portuguese",
    }[language] || String(value || "English")
  );
}

function providerPrinting(value) {
  const finish = finishFromVariant(value);
  if (finish === "1stEditionHolofoil") return "1st Edition Holofoil";
  if (finish === "1stEditionNormal") return "1st Edition";
  if (finish === "reverseHolofoil") return "Reverse Holofoil";
  if (finish === "holofoil") return "Holofoil";
  return "Normal";
}

export function normalizePkmnPricesCard(
  card,
  historyRows = [],
  retrievedAt = new Date().toISOString(),
  clientId = null,
  historyStatus = "live",
) {
  const quotes = [];
  const history = [];

  for (const price of Array.isArray(card?.prices) ? card.prices : []) {
    const provider = sourceProvider(price.source);
    const currency = String(
      price.currency || sourceCurrency(price.source),
    ).toUpperCase();
    const finish = finishFromVariant(price.variant);
    const providerVariantId = [
      card.id,
      provider,
      price.condition || "",
      price.variant || "",
      price.grader || "",
      price.grade || "",
    ].join(":");
    const baseQuote = {
      provider,
      providerProductId: String(card.id || ""),
      providerVariantId,
      currency,
      region: provider === "cardmarket" ? "EU" : "US",
      condition: price.condition || null,
      finish,
      printing: price.variant || null,
      language: card.language || "English",
      gradingCompany: price.grader || null,
      grade: price.grade == null ? null : String(price.grade),
      observedAt: price.created_at || price.updated_at || null,
      retrievedAt,
      providerUrl:
        provider === "cardmarket"
          ? safeCardmarketUrl(card.cardmarket_url)
          : null,
      attribution: `${provider === "cardmarket" ? "Cardmarket" : provider === "ebay" ? "eBay sold" : "TCGplayer"} pricing via PkmnPrices`,
      derivation: "aggregated",
      quality: {
        direct: false,
        aggregator: "pkmnprices",
        source: price.source || provider,
      },
    };

    for (const [field, priceType] of Object.entries({
      market_price: "market",
      avg: "average",
      average: "average",
      low: "low",
      low_price: "low",
      high: "high",
      high_price: "high",
    })) {
      const amount = finiteAmount(price[field]);
      if (amount === null) continue;
      quotes.push({
        ...baseQuote,
        priceType,
        amount,
        quality: { ...baseQuote.quality, field },
      });
    }
  }

  for (const point of Array.isArray(historyRows) ? historyRows : []) {
    const amount = finiteAmount(
      point.avg ?? point.average ?? point.market_price,
    );
    const recordedAt = point.date
      ? new Date(`${point.date}T00:00:00Z`).toISOString()
      : null;
    if (amount === null || !recordedAt) continue;
    const provider = sourceProvider(point.source);
    history.push({
      provider,
      providerVariantId: [
        card.id,
        provider,
        point.condition || "",
        point.variant || "",
        point.grader || "",
        point.grade || "",
      ].join(":"),
      currency: String(
        point.currency || sourceCurrency(point.source),
      ).toUpperCase(),
      condition: point.condition || null,
      finish: finishFromVariant(point.variant),
      gradingCompany: point.grader || null,
      grade: point.grade == null ? null : String(point.grade),
      amount,
      low: finiteAmount(point.low),
      high: finiteAmount(point.high),
      saleCount: Number.isFinite(Number(point.sale_count))
        ? Number(point.sale_count)
        : null,
      recordedAt,
      granularity: "day",
      quality: {
        aggregator: "pkmnprices",
        saleCount: Number.isFinite(Number(point.sale_count))
          ? Number(point.sale_count)
          : null,
      },
    });
  }

  return {
    providerCardId: clientId || String(card.id || ""),
    providerCanonicalId: String(card.id || ""),
    externalIds: {
      pkmnprices: card.id || null,
      tcgplayer: card.tcg_player_id || null,
    },
    name: card.name || "",
    setName: card.set?.name || "",
    collectorNumber: card.number || "",
    rarity: card.rarity || null,
    artist: card.artist || null,
    language: card.language || "English",
    images: { small: card.image_url || null, large: card.image_url || null },
    metadata: {
      setId: card.set?.id == null ? null : String(card.set.id),
      totalSetNumber:
        card.total_set_number == null ? null : String(card.total_set_number),
      hp: Number.isFinite(Number(card.hp)) ? Number(card.hp) : null,
      stage: card.stage || null,
      cardType: card.card_type || null,
      weakness: card.weakness || null,
      resistance: card.resistance || null,
      retreatCost: Number.isFinite(Number(card.retreat_cost))
        ? Number(card.retreat_cost)
        : null,
      energyTypes: Array.isArray(card.energy_type)
        ? card.energy_type.filter(Boolean).map(String)
        : [],
      ability: card.ability || null,
      attacks: Array.isArray(card.attacks)
        ? card.attacks.filter(Boolean).map(String)
        : [],
      flavorText: card.flavor_text || null,
      cardmarketUrl: safeCardmarketUrl(card.cardmarket_url),
    },
    quotes,
    history,
    historyStatus,
  };
}

export function normalizePkmnPricesSale(sale) {
  const amount = Number(sale?.price);
  if (!Number.isFinite(amount) || amount < 0 || !sale?.sold_at) return null;
  return {
    provider: "pkmnprices",
    source: "ebay",
    providerSaleId: String(sale.ebay_listing_id || sale.id || ""),
    title: String(sale.title || ""),
    amount,
    currency: "USD",
    soldAt: String(sale.sold_at),
    gradingCompany: sale.grader || null,
    grade: sale.grade == null ? null : String(sale.grade),
    saleType: sale.sale_type || null,
    sourceUrl: safeSaleUrl(sale.listing_url),
  };
}

export function normalizePkmnPricesOffer(listing, marketplace) {
  const amount = finiteAmount(listing?.price);
  if (amount === null || !["tcgplayer", "cardmarket"].includes(marketplace))
    return null;
  const shipping =
    marketplace === "tcgplayer"
      ? Math.max(0, Number(listing.shipping_price) || 0)
      : null;
  return {
    provider: "pkmnprices",
    marketplace,
    providerListingId: String(
      listing.listing_id || listing.article_id || listing.id || "",
    ),
    amount,
    shipping,
    total: shipping === null ? amount : amount + shipping,
    currency: marketplace === "cardmarket" ? "EUR" : "USD",
    condition: listing.condition || null,
    language: listing.language || null,
    printing: listing.printing || listing.variant || null,
    seller: listing.seller_name || listing.seller || null,
    sellerRating: Number.isFinite(Number(listing.seller_rating))
      ? Number(listing.seller_rating)
      : null,
    sellerSales: listing.seller_sales || null,
    quantity: Number.isFinite(Number(listing.quantity))
      ? Number(listing.quantity)
      : null,
    listingType: listing.listing_type || null,
    badges: {
      direct: listing.direct_seller === true,
      gold: listing.gold_seller === true,
      verified: listing.verified_seller === true,
    },
    note: listing.custom_title || listing.comment || null,
    updatedAt: listing.updated_at || null,
  };
}

export function normalizePkmnPricesSealedProduct(
  product,
  retrievedAt = new Date().toISOString(),
) {
  const quotes = [];
  for (const price of Array.isArray(product?.prices) ? product.prices : []) {
    const provider = sourceProvider(price.source);
    const currency = String(
      price.currency || sourceCurrency(price.source),
    ).toUpperCase();
    const base = {
      provider,
      providerProductId: String(product.id || ""),
      providerVariantId: `${product.id || ""}:${provider}:sealed`,
      currency,
      region: provider === "cardmarket" ? "EU" : "US",
      condition: null,
      finish: "sealed",
      printing: "Sealed product",
      language: product.language || "English",
      gradingCompany: null,
      grade: null,
      observedAt: price.created_at || price.updated_at || null,
      retrievedAt,
      providerUrl: null,
      attribution: `${provider === "cardmarket" ? "Cardmarket" : "TCGplayer"} sealed pricing via PkmnPrices`,
      derivation: "aggregated",
      quality: {
        direct: false,
        aggregator: "pkmnprices",
        source: price.source || provider,
      },
    };
    for (const [field, priceType] of Object.entries({
      market_price: "market",
      avg: "average",
      average: "average",
      low: "low",
      low_price: "low",
      high: "high",
      high_price: "high",
    })) {
      const value = finiteAmount(price[field]);
      if (value !== null)
        quotes.push({
          ...base,
          priceType,
          amount: value,
          quality: { ...base.quality, field },
        });
    }
  }
  return {
    id: `sealed:${product.id || ""}`,
    providerCardId: `sealed:${product.id || ""}`,
    providerCanonicalId: String(product.id || ""),
    externalIds: {
      pkmnpricesSealed: product.id || null,
      tcgplayer: product.tcg_player_id || null,
    },
    name: product.name || "Unknown sealed product",
    set: product.set?.name || "Set unavailable",
    setName: product.set?.name || "Set unavailable",
    setId: product.set?.id == null ? null : String(product.set.id),
    number: "",
    collectorNumber: "",
    rarity: "Sealed product",
    variant: "Sealed product",
    variants: ["Sealed product"],
    language: product.language || "en",
    productType: product.product_type || product.type || "sealed",
    cardState: "sealed",
    image: product.image_url || null,
    thumb: product.image_url || null,
    images: {
      small: product.image_url || null,
      large: product.image_url || null,
    },
    quotes,
  };
}

async function request(url, apiKey, signal) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal,
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return body;
      const error = new Error("PkmnPrices request failed");
      error.status = response.status;
      error.providerCode = String(body?.error?.code || "");
      error.providerMessage = String(body?.error?.message || "");
      error.retryable = response.status === 429 || response.status >= 500;
      error.retryAfter = response.headers.get("retry-after");
      if (!error.retryable || attempt === 2) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (signal?.aborted || (!error?.retryable && error?.status)) throw error;
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(250 * 2 ** attempt, 1000)),
    );
  }
  throw lastError;
}

async function resolveCardId(apiKey, lookup, signal) {
  const hasIdentity = Boolean(
    String(lookup.name || "").trim() ||
    String(lookup.set || lookup.setName || "").trim() ||
    String(lookup.number || "").trim(),
  );
  if (lookup.pkmnpricesId && !hasIdentity) return lookup.pkmnpricesId;
  if (lookup.pkmnpricesId) {
    const directUrl = new URL(
      `${API_URL}/cards/${encodeURIComponent(lookup.pkmnpricesId)}`,
    );
    directUrl.searchParams.set("currency", "usd");
    const direct = await request(directUrl, apiKey, signal).catch(() => null);
    if (matchesPkmnPricesIdentity(direct, lookup)) return direct.id;
  }

  const searches = [];
  if (lookup.tcgplayerId) {
    const byTcgplayer = new URL(`${API_URL}/cards`);
    byTcgplayer.searchParams.set("tcg_player_id", lookup.tcgplayerId);
    searches.push(byTcgplayer);
  }
  const byIdentity = new URL(`${API_URL}/cards`);
  byIdentity.searchParams.set("name", lookup.name);
  const number = String(lookup.number || "")
    .split("/")[0]
    .trim();
  if (number) byIdentity.searchParams.set("number", number);
  if (
    String(lookup.language || "")
      .toLowerCase()
      .startsWith("ja")
  )
    byIdentity.searchParams.set("language", "Japanese");
  searches.push(byIdentity);

  for (const search of searches) {
    search.searchParams.set("per_page", "20");
    const result = await request(search, apiKey, signal);
    const candidates = (Array.isArray(result.data) ? result.data : []).filter(
      (card) => matchesPkmnPricesIdentity(card, lookup),
    );
    const match = selectCard(candidates, lookup);
    if (match?.id) return match.id;
  }
  return null;
}

export async function fetchPkmnPricesLookup(
  apiKey,
  lookup,
  signal,
  options = {},
) {
  const cardId = await resolveCardId(apiKey, lookup, signal);
  if (!cardId) return { card: null, history: [] };

  const cardUrl = new URL(`${API_URL}/cards/${encodeURIComponent(cardId)}`);
  cardUrl.searchParams.set("currency", "usd");
  let card = await request(cardUrl, apiKey, signal);
  let eurStatus = options.includeEur ? "live" : "not_requested";
  if (options.includeEur) {
    const eurUrl = new URL(cardUrl);
    eurUrl.searchParams.set("currency", "eur");
    const eurCard = await request(eurUrl, apiKey, signal).catch((error) => {
      eurStatus = error?.status === 403 ? "plan_required" : "unavailable";
      return null;
    });
    if (eurCard)
      card = {
        ...card,
        prices: [
          ...(Array.isArray(card.prices) ? card.prices : []),
          ...(Array.isArray(eurCard.prices) ? eurCard.prices : []),
        ],
      };
  }

  let historyStatus =
    options.includeHistory === false ? "not_requested" : "live";
  let history = [];
  if (options.includeHistory !== false) {
    const historyUrl = new URL(
      `${API_URL}/cards/${encodeURIComponent(cardId)}/prices/history`,
    );
    historyUrl.searchParams.set("currency", "usd");
    historyUrl.searchParams.set("period", options.historyPeriod || "90d");
    historyUrl.searchParams.set("limit", String(options.historyLimit || 90));
    const historyResult = await request(historyUrl, apiKey, signal).catch(
      (error) => {
        if (error?.status === 403) {
          historyStatus = "plan_required";
          return { data: [] };
        }
        if (error?.status === 404) {
          historyStatus = "unavailable";
          return { data: [] };
        }
        throw error;
      },
    );
    history = Array.isArray(historyResult.data) ? historyResult.data : [];
    if (options.includeEurHistory && historyStatus === "live") {
      const eurHistoryUrl = new URL(historyUrl);
      eurHistoryUrl.searchParams.set("currency", "eur");
      const eurHistory = await request(eurHistoryUrl, apiKey, signal).catch(
        () => ({ data: [] }),
      );
      history.push(...(Array.isArray(eurHistory.data) ? eurHistory.data : []));
    }
  }

  return {
    card,
    history,
    historyStatus,
    historyPeriod: options.historyPeriod || null,
    eurStatus,
  };
}

export async function fetchPkmnPricesSales(apiKey, lookup, signal) {
  const cardId = await resolveCardId(apiKey, lookup, signal);
  if (!cardId) return { cardId: null, sales: [] };
  const listings = new URL(
    `${API_URL}/cards/${encodeURIComponent(cardId)}/listings/ebay`,
  );
  listings.searchParams.set("limit", "10");
  listings.searchParams.set("sort", "date_desc");
  if (lookup.grader)
    listings.searchParams.set("grader", String(lookup.grader).toUpperCase());
  if (lookup.grade) listings.searchParams.set("grade", String(lookup.grade));
  const result = await request(listings, apiKey, signal);
  return {
    cardId: String(cardId),
    sales: (Array.isArray(result.data) ? result.data : [])
      .map(normalizePkmnPricesSale)
      .filter(Boolean),
  };
}

export async function fetchPkmnPricesOffers(apiKey, lookup, signal) {
  const cardId = await resolveCardId(apiKey, lookup, signal);
  if (!cardId)
    return {
      cardId: null,
      offers: [],
      statuses: { tcgplayer: "unavailable", cardmarket: "unavailable" },
    };

  const fetchMarketplace = async (marketplace) => {
    const url = new URL(
      `${API_URL}/cards/${encodeURIComponent(cardId)}/listings/${marketplace}`,
    );
    if (lookup.condition) url.searchParams.set("condition", lookup.condition);
    if (lookup.language)
      url.searchParams.set("language", providerLanguage(lookup.language));
    url.searchParams.set(
      marketplace === "tcgplayer" ? "printing" : "variant",
      providerPrinting(lookup.variant),
    );
    url.searchParams.set("sort", "price_asc");
    url.searchParams.set("limit", "5");
    try {
      const result = await request(url, apiKey, signal);
      return {
        marketplace,
        status: "live",
        offers: (Array.isArray(result.data) ? result.data : [])
          .map((listing) => normalizePkmnPricesOffer(listing, marketplace))
          .filter(Boolean),
      };
    } catch (error) {
      if (error?.status === 403)
        return { marketplace, status: "plan_required", offers: [] };
      if (error?.status === 404)
        return { marketplace, status: "unavailable", offers: [] };
      if (error?.status === 429)
        return { marketplace, status: "rate_limited", offers: [] };
      throw error;
    }
  };

  const results = await Promise.all([
    fetchMarketplace("tcgplayer"),
    fetchMarketplace("cardmarket"),
  ]);
  return {
    cardId: String(cardId),
    offers: results.flatMap((result) => result.offers),
    statuses: Object.fromEntries(
      results.map((result) => [result.marketplace, result.status]),
    ),
  };
}

export async function fetchPkmnPricesSealedSearch(
  apiKey,
  query,
  language,
  signal,
  limit = 12,
) {
  const url = new URL(`${API_URL}/sealed`);
  url.searchParams.set("name", query);
  url.searchParams.set(
    "language",
    String(language || "en")
      .toLowerCase()
      .startsWith("ja")
      ? "jp"
      : "en",
  );
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("page", "1");
  const result = await request(url, apiKey, signal);
  return (Array.isArray(result.data) ? result.data : []).map((product) =>
    normalizePkmnPricesSealedProduct(product),
  );
}

export async function fetchPkmnPricesSealedProduct(apiKey, id, signal) {
  const result = await request(
    new URL(`${API_URL}/sealed/${encodeURIComponent(id)}`),
    apiKey,
    signal,
  );
  return normalizePkmnPricesSealedProduct(result);
}
