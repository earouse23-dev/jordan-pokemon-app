import { pkmnPricesRequests } from "../pkmnprices-requests.js";
import { canonicalFinish } from "../identity.js";
const API_URL = "https://api.pkmnprices.com/v1";
const MAX_RETRY_DELAY_MS = 2_000;

function finiteAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function comparable(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
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
  const unique = [
    ...new Map(cards.map((card) => [String(card.id), card])).values(),
  ];
  // Matching printed facts must identify one provider card, never a first-result guess.
  return unique.length === 1 ? unique[0] : null;
}

export function matchesPkmnPricesIdentity(card, lookup) {
  if (!card || !lookup) return false;
  const number = (value) =>
    comparable(String(value || "").split("/")[0]).replace(/^0+(?=\d)/, "");
  const name = (value, printedNumber, total, printedName = false) => {
    const suffix = /\s+-\s+(\d+)\/(\d+)$/.exec(String(value || ""));
    const text = String(
      suffix &&
        number(suffix[1]) === number(printedNumber) &&
        number(suffix[2]) === number(total)
        ? String(value).slice(0, suffix.index)
        : value || "",
    );
    const printed = text.replace(/\s+\((\d+)\)$/, (suffix, n) =>
      number(n) === number(printedNumber) ? "" : suffix,
    );
    return comparable(
      printedName
        ? printed.replace(
            /\s+\((?:Alternate Full Art|Alternate Art Secret|Full Art|Secret)\)$/i,
            "",
          )
        : printed,
    );
  };
  const set = (value) =>
    comparable(
      String(value || "")
        .replace(/^(?:SV\d*|SWSH\d*|SM\d*|XY\d*)\s*(?::| -)\s*/i, "")
        .replace(/^Scarlet\s*&\s*Violet\s+(?=151$)/i, ""),
    );
  const wantedName = name(
    lookup.name,
    lookup.number,
    String(lookup.number || "").split("/")[1],
  );
  const wantedSet = set(lookup.set || lookup.setName);
  const wantedNumber = number(lookup.number);
  const cardName = name(card.name, card.number, card.total_set_number);
  const cardSet = set(card.set?.name || card.set_name);
  const cardNumber = number(card.number);
  if (!wantedName && !wantedSet && !wantedNumber) return true;
  if (wantedNumber && cardNumber !== wantedNumber) return false;
  if (wantedSet && cardSet !== wantedSet) return false;
  const wantedTotal = comparable(
    String(lookup.number || "").split("/")[1],
  ).replace(/^0+(?=\d)/, "");
  const cardTotal = comparable(
    card.total_set_number || String(card.number || "").split("/")[1],
  ).replace(/^0+(?=\d)/, "");
  if (wantedTotal && cardTotal && wantedTotal !== cardTotal) return false;
  // Provider art annotations aren't printed names; exact set/number/total and
  // the caller's unique-candidate check still identify the card.
  if (
    wantedName &&
    cardName !== wantedName &&
    !(
      wantedSet &&
      wantedNumber &&
      wantedTotal &&
      cardTotal === wantedTotal &&
      name(card.name, card.number, card.total_set_number, true) === wantedName
    )
  )
    return false;
  if (
    lookup.language &&
    card.language &&
    providerCardLanguage(lookup.language) !==
      providerCardLanguage(card.language)
  )
    return false;
  return true;
}

function safeSaleUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const ebayDomains = [
      "ebay.com",
      "ebay.ca",
      "ebay.de",
      "ebay.fr",
      "ebay.it",
      "ebay.es",
      "ebay.at",
      "ebay.be",
      "ebay.ch",
      "ebay.ie",
      "ebay.nl",
      "ebay.pl",
      "ebay.co.uk",
      "ebay.com.au",
    ];
    const trusted = ebayDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    return url.protocol === "https:" && trusted ? url.toString() : null;
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

function providerCardLanguage(value) {
  const language = providerLanguage(value);
  return ["English", "Japanese", "German"].includes(language)
    ? language
    : "English";
}

function providerSealedLanguage(value) {
  const language = String(value || "en").toLowerCase();
  if (language === "ja" || language === "jp" || language === "japanese")
    return "jp";
  if (language === "de" || language === "german") return "de";
  return "en";
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
  capabilityStatuses = {},
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
      aggregator: "pkmnprices",
      market: provider,
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
    if (!point || typeof point !== "object") continue;
    const amount = finiteAmount(
      point.avg ?? point.average ?? point.market_price,
    );
    const date =
      typeof point.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(point.date)
        ? new Date(`${point.date}T00:00:00Z`)
        : null;
    const recordedAt =
      date &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === point.date
        ? date.toISOString()
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
      recordedAt,
      granularity: "day",
      quality: {
        aggregator: "pkmnprices",
        // History rows are daily snapshots, not completed-sale observations.
        // PkmnPrices removed sale_count because it was commonly misread as
        // sales volume, so deliberately do not normalize or persist it.
        sampleSize: null,
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
    variantOptions: [
      ...new Set((card.prices || []).map((p) => p.variant).filter(Boolean)),
    ].map((variant) => ({
      id: `pkmnprices:${card.id}:${variant}`,
      label: variant,
      finish: canonicalFinish(variant),
      edition: /\b(?:1st|first)\s*edition\b/i.test(variant)
        ? "first_edition"
        : /shadowless/i.test(variant)
          ? "shadowless"
          : "unlimited",
      promoType: /\bpromos?\b/i.test(card.set?.name || "") ? "promo" : "none",
      language: card.language || "English",
      status: "exact",
      metadata: { identityEvidence: "pkmnprices_printing" },
    })),
    historyStatus,
    capabilities: {
      current: quotes.length ? "live" : "missing",
      raw: quotes.some((quote) => !quote.gradingCompany) ? "live" : "missing",
      graded: quotes.some((quote) => quote.gradingCompany) ? "live" : "missing",
      history: historyStatus,
      eur:
        capabilityStatuses.eur ||
        (quotes.some((quote) => quote.currency === "EUR") ? "live" : "missing"),
      completedSales: "not_requested",
      askingPrices: "not_requested",
      sealed: "not_requested",
    },
  };
}

export function normalizePkmnPricesSale(sale) {
  const amount = finiteAmount(sale?.price);
  if (amount === null || !sale?.sold_at) return null;
  const currency = String(sale.currency || "")
    .trim()
    .toUpperCase();
  return {
    provider: "pkmnprices",
    source: "ebay",
    providerSaleId: String(sale.ebay_listing_id || sale.id || ""),
    title: String(sale.title || ""),
    amount,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    soldAt: String(sale.sold_at),
    gradingCompany: sale.grader || null,
    grade: sale.grade == null ? null : String(sale.grade),
    gradeQualifier: String(sale.grade_qualifier || "").trim() || null,
    language: String(sale.language || "").trim() || null,
    printing: sale.variant || null,
    attribution: ["exact", "shared", "unknown"].includes(sale.attribution)
      ? sale.attribution
      : "unknown",
    ingestedAt: sale.ingested_at || null,
    conditionScope: "not_provided",
    saleType: sale.sale_type || null,
    sourceUrl: safeSaleUrl(sale.listing_url),
  };
}

export function comparableSalePrinting(value) {
  const printing = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_·-]+/g, " ")
    .replace(/\s+/g, " ");
  // Only explicit aliases are equivalent. Do not collapse stamps or other
  // special printings into the ordinary holo or reverse-holo finish.
  const aliases = {
    normal: "normal",
    "non holo": "normal",
    nonholo: "normal",
    holo: "holofoil",
    holofoil: "holofoil",
    reverse: "reverse holofoil",
    "reverse holo": "reverse holofoil",
    "reverse holofoil": "reverse holofoil",
    reverseholofoil: "reverse holofoil",
    "1st edition holofoil": "1st edition holofoil",
    "1steditionholofoil": "1st edition holofoil",
    "first edition holofoil": "1st edition holofoil",
    firsteditionholofoil: "1st edition holofoil",
    "1st edition": "1st edition normal",
    "1st edition normal": "1st edition normal",
    "1steditionnormal": "1st edition normal",
    "first edition normal": "1st edition normal",
    firsteditionnormal: "1st edition normal",
  };
  if (!printing || ["unknown", "unknown version"].includes(printing))
    return null;
  return aliases[printing] || printing;
}

export function saleMatchesLookup(sale, lookup) {
  if (!sale.sourceUrl || !sale.currency || sale.attribution !== "exact")
    return false;
  if (lookup.finish) {
    const requestedFinish = String(lookup.finish).toLowerCase();
    const variantFinish = finishFromVariant(lookup.variant)
      .toLowerCase()
      .replace(/^1stedition/, "");
    if (requestedFinish !== variantFinish) return false;
  }
  if (
    sale.language &&
    providerLanguage(sale.language) !== providerLanguage(lookup.language)
  )
    return false;
  const printing = comparableSalePrinting(lookup.variant);
  if (!printing || comparableSalePrinting(sale.printing) !== printing)
    return false;
  const saleWords = `${sale.printing || ""} ${sale.title || ""}`.toLowerCase();
  const edition = String(lookup.edition || "").toLowerCase();
  const firstEdition = /\b(?:1st|first)\s*edition\b/i.test(saleWords);
  if (edition === "unlimited" && firstEdition) return false;
  if (
    ["first", "1st", "first edition", "1st edition", "first_edition"].includes(
      edition,
    ) &&
    !firstEdition
  )
    return false;
  const promoType = String(lookup.promoType || "")
    .trim()
    .toLowerCase();
  if (
    promoType &&
    promoType !== "none" &&
    !comparable(saleWords).includes(comparable(promoType))
  )
    return false;
  const titleGrades = [
    ...String(sale.title || "").matchAll(
      /\b(PSA|BGS|CGC|SGC|TAG)\s*(\d{1,2}(?:\.\d)?)\b/gi,
    ),
  ];
  if (
    titleGrades.some(
      (match) =>
        match[1].toUpperCase() !==
          String(sale.gradingCompany || "").toUpperCase() ||
        Number(match[2]) !== Number(sale.grade) ||
        match[1].toUpperCase() !== String(lookup.grader || "").toUpperCase() ||
        (lookup.grade && Number(match[2]) !== Number(lookup.grade)),
    )
  )
    return false;
  const titleLabels = [
    ...String(sale.title || "").matchAll(/\b(black|gold|silver)\s+label\b/gi),
  ].map((match) => comparable(match[0]));
  if (new Set(titleLabels).size > 1) return false;
  const titleQualifier =
    titleLabels[0] ||
    comparable(sale.title?.match(/\b(pristine|perfect)\b/i)?.[0]);
  if (
    titleQualifier &&
    (!sale.gradeQualifier ||
      titleQualifier !== comparable(sale.gradeQualifier) ||
      titleQualifier !== comparable(lookup.gradeQualifier))
  )
    return false;
  const grader = String(lookup.grader || "").toUpperCase();
  if (!grader)
    return !sale.gradingCompany && !sale.grade && !sale.gradeQualifier;
  return (
    String(sale.gradingCompany || "").toUpperCase() === grader &&
    (!lookup.grade || String(sale.grade) === String(lookup.grade)) &&
    String(sale.gradeQualifier || "").toLowerCase() ===
      String(lookup.gradeQualifier || "").toLowerCase()
  );
}

function identityWords(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function collectorNumber(value) {
  const match = String(value || "")
    .trim()
    .match(/^(?:[a-z]+)?0*(\d+[a-z]?)(?:\s*\/\s*0*(\d+))?$/i);
  return match
    ? { number: match[1].toLowerCase(), total: match[2] || null }
    : { number: null, total: null };
}

export function saleMatchesCanonicalIdentity(sale, card, lookup = {}) {
  if (!sale?.title || !card) return false;
  const title = identityWords(sale.title);
  const titleText = title.join(" ");
  const expected = collectorNumber(lookup.number || card.number);
  const expectedTotal =
    expected.total || collectorNumber(card.total_set_number).number;
  if (!expected.number) return false;
  const fractions = [
    ...String(sale.title).matchAll(/\b0*(\d+[a-z]?)\s*\/\s*0*(\d+)\b/gi),
  ].map((match) => ({
    number: match[1].toLowerCase(),
    total: match[2],
  }));
  if (
    fractions.length &&
    !fractions.every(
      (fraction) =>
        fraction.number === expected.number &&
        (!expectedTotal || fraction.total === expectedTotal),
    )
  )
    return false;

  const taggedNumbers = [
    ...String(sale.title).matchAll(/#\s*0*(\d+[a-z]?)\b/gi),
  ].map((match) => match[1].toLowerCase());
  if (taggedNumbers.some((number) => number !== expected.number)) return false;

  if (
    /\b(?:bundle|lot|pair|playset|assorted|multi[- ]card)\b/i.test(
      sale.title,
    ) ||
    /\bset\s+of\s+\d+\b/i.test(sale.title)
  )
    return false;

  const name = String(lookup.name || card.name).trim();
  const suffix = /^(.+?)\s+\((\d+)\)$/.exec(name);
  const requested = collectorNumber(lookup.number);
  const providerNumber = collectorNumber(card.number);
  const providerTotal = collectorNumber(card.total_set_number);
  const suffixNumber = suffix ? collectorNumber(suffix[2]).number : null;
  if (
    suffix &&
    ((requested.number && suffixNumber !== requested.number) ||
      (providerNumber.number && suffixNumber !== providerNumber.number) ||
      (requested.total &&
        providerTotal.number &&
        requested.total !== providerTotal.number))
  )
    return false;
  const redundantNumber = Boolean(
    suffix &&
    !/[()]/.test(suffix[1]) &&
    comparable(lookup.name) === comparable(card.name) &&
    requested.number &&
    requested.total &&
    providerNumber.number === requested.number &&
    (!providerNumber.total || providerNumber.total === requested.total) &&
    providerTotal.number === requested.total &&
    suffixNumber === requested.number,
  );
  const nameWords = identityWords(redundantNumber ? suffix[1] : name);
  if (!nameWords.length || !nameWords.every((word) => title.includes(word)))
    return false;
  if (redundantNumber) {
    const parentheticals = [...String(sale.title).matchAll(/\(([^()]*)\)/g)];
    if (
      parentheticals.length > 1 ||
      parentheticals.some(
        (match) =>
          !/^\d+$/.test(match[1]) ||
          collectorNumber(match[1]).number !== requested.number,
      )
    )
      return false;
  }

  const requestedLanguage = providerLanguage(lookup.language);
  const explicitLanguages = {
    English: ["english", "eng"],
    Japanese: ["japanese"],
    German: ["german", "deutsch", "deutsche"],
  };
  for (const [language, markers] of Object.entries(explicitLanguages)) {
    if (
      language !== requestedLanguage &&
      markers.some((marker) => title.includes(marker))
    )
      return false;
  }

  const ignoredSetWords = new Set([
    "pokemon",
    "tcg",
    "set",
    "collection",
    "collections",
    "promo",
    "promos",
    "cards",
    "card",
  ]);
  const setWords = identityWords(lookup.set || lookup.setName || card.set?.name)
    .filter((word) => word.length > 1 && !ignoredSetWords.has(word))
    .filter((word) => !/^\d{4}$/.test(word));
  const hasSetAnchor = setWords.some((word) => title.includes(word));
  if (
    redundantNumber &&
    (!hasSetAnchor ||
      (!fractions.length && !taggedNumbers.includes(expected.number)))
  )
    return false;

  const canonicalYearText = [
    lookup.set,
    lookup.setName,
    card.set?.name,
    card.year,
    card.releaseDate,
    card.set?.release_date,
    card.set?.releaseDate,
  ]
    .filter(Boolean)
    .join(" ");
  const canonicalYears = new Set(
    [...canonicalYearText.matchAll(/\b(?:19|20)\d{2}\b/g)].map(
      (match) => match[0],
    ),
  );
  const titleYears = [
    ...String(sale.title).matchAll(/\b(?:19|20)\d{2}\b/g),
  ].map((match) => match[0]);
  if (
    canonicalYears.size &&
    titleYears.some((year) => !canonicalYears.has(year))
  )
    return false;

  const ignoredTitleWords = new Set([
    ...ignoredSetWords,
    "psa",
    "bgs",
    "cgc",
    "sgc",
    "gem",
    "mint",
    "graded",
    "grade",
    "holo",
    "holofoil",
    "reverse",
    "rare",
    "english",
    "japanese",
    "german",
    "deutsch",
    "deutsche",
    "ebay",
    "pop",
    "low",
    "confetti",
    "label",
    "black",
    "gold",
    "silver",
    "pristine",
    "perfect",
    "en",
    "jp",
    "ja",
    "de",
    "the",
    "of",
    ...([
      "first",
      "1st",
      "first edition",
      "1st edition",
      "first_edition",
    ].includes(String(lookup.edition || "").toLowerCase())
      ? ["first", "1st", "edition"]
      : []),
  ]);
  // The resolved provider identity has already matched the requested card. Its
  // full set/rarity spelling explains legitimate abbreviations in sale titles.
  const identityContext = new Set([
    ...nameWords,
    ...setWords,
    ...identityWords(card.name),
    ...identityWords(card.set?.name),
    ...identityWords(card.rarity),
  ]);
  if (/alternate|full art/i.test(card.name || ""))
    for (const word of ["alt", "fa"]) ignoredTitleWords.add(word);
  if (/SWSH\d+/i.test(card.set?.name || ""))
    for (const word of ["swsh", "sword", "shield"]) ignoredTitleWords.add(word);
  if (requestedLanguage === "English") ignoredTitleWords.add("eng");
  if (lookup.edition === "unlimited") ignoredTitleWords.add("unlimited");
  if (/\b(?:ultra|illustration|secret) rare\b/i.test(card.rarity || "")) {
    ignoredTitleWords.add("full");
    ignoredTitleWords.add("art");
  }
  const unexplainedIdentityWords = title.filter(
    (word) =>
      !identityContext.has(word) &&
      !ignoredTitleWords.has(word) &&
      !/^\d+$/.test(word) &&
      !/^(?:psa|bgs|cgc|sgc)\d+(?:\.\d+)?$/.test(word) &&
      !/^[a-z]\d{1,3}$/.test(word),
  );
  if (unexplainedIdentityWords.length) return false;

  if (fractions.length) return true;
  const escapedNumber = String(expected.number || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const hasNumberAnchor = escapedNumber
    ? new RegExp(`(?:#|\\b)0*${escapedNumber}\\b`, "i").test(titleText)
    : false;
  return hasSetAnchor && hasNumberAnchor;
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
      aggregator: "pkmnprices",
      market: provider,
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
      providerUrl:
        provider === "cardmarket"
          ? safeCardmarketUrl(product.cardmarket_url)
          : null,
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
      cardmarket: product.cardmarket_product_id || null,
    },
    cardmarketUrl: safeCardmarketUrl(product.cardmarket_url),
    name: product.name || "Unknown sealed product",
    set: product.set?.name || "Set unavailable",
    setName: product.set?.name || "Set unavailable",
    setId: product.set?.id == null ? null : String(product.set.id),
    number: "",
    collectorNumber: "",
    rarity: "Sealed product",
    variant: "Sealed product",
    variants: ["Sealed product"],
    language: product.language || null,
    productType: product.product_type || product.type || "sealed",
    sealedVariant: product.variant || null,
    sealedRegion: product.region || null,
    cardState: "sealed",
    image: product.image_url || null,
    thumb: product.image_url || null,
    images: {
      small: product.image_url || null,
      large: product.image_url || null,
    },
    quotes,
    capabilities: {
      current: quotes.length ? "live" : "missing",
      raw: "unsupported",
      graded: "unsupported",
      history: "not_requested",
      eur: quotes.some((quote) => quote.currency === "EUR")
        ? "live"
        : "missing",
      completedSales: "not_requested",
      askingPrices: "not_requested",
      sealed: quotes.length ? "live" : "missing",
    },
  };
}

function abortError(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error("The provider request was aborted");
  error.name = "AbortError";
  return error;
}

function retryAfterMs(value, now = Date.now()) {
  const text = String(value || "").trim();
  if (!text) return null;
  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function pkmnPricesRetryDelayMs(error, attempt, now = Date.now()) {
  const exponential = Math.min(250 * 2 ** attempt, MAX_RETRY_DELAY_MS);
  const requested = retryAfterMs(error?.retryAfter, now);
  return Math.min(
    MAX_RETRY_DELAY_MS,
    requested === null ? exponential : Math.max(exponential, requested),
  );
}

async function waitForRetry(delayMs, signal) {
  if (signal?.aborted) throw abortError(signal);
  await new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeout);
      reject(abortError(signal));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function request(input, apiKey, signal, options = {}) {
  signal?.throwIfAborted();
  const url = new URL(input);
  const canonical = new URL(url);
  canonical.searchParams.sort();
  const key = apiKey + "\0" + canonical.href;
  const memory = pkmnPricesRequests.cache.get(key);
  const cached =
    memory?.expires > Date.now()
      ? memory
      : (await pkmnPricesRequests.readCache(key)) || memory;
  if (cached?.expires > Date.now()) return structuredClone(cached.body);
  if (pkmnPricesRequests.pending.has(key)) {
    const body = await pkmnPricesRequests.pending.get(key);
    signal?.throwIfAborted();
    return structuredClone(body);
  }
  const pending = (async () => {
    const token = await pkmnPricesRequests.claimCache(key, signal);
    if (!token) {
      const shared = await pkmnPricesRequests.readCache(key);
      if (shared?.expires > Date.now()) return structuredClone(shared.body);
      throw new Error("Shared price cache changed during read");
    }
    try {
      const incremental =
        cached?.body?.pagination?.total_pages === 1 &&
        /\/prices\/history$/.test(url.pathname) &&
        url.searchParams.get("period") === "365d" &&
        url.searchParams.get("page") === "1";
      const outbound = new URL(url);
      if (incremental) {
        const days = Math.min(
          365,
          Math.max(
            2,
            Math.ceil((Date.now() - cached.fetchedAt) / 86_400_000) + 1,
          ),
        );
        outbound.searchParams.set("period", `${days}d`);
        // One exact currency/condition/printing has at most one row per day.
        if (
          outbound.searchParams.has("condition") &&
          outbound.searchParams.has("variant")
        )
          outbound.searchParams.set("limit", String(days));
      }
      const body = await uncachedRequest(outbound, apiKey, signal, options);
      if (
        incremental &&
        body.pagination?.total_pages === 1 &&
        Array.isArray(body.data)
      ) {
        const rows = new Map();
        for (const row of [...cached.body.data, ...body.data])
          rows.set(
            JSON.stringify([
              row.date || row.recorded_at,
              row.condition,
              row.variant,
              row.currency,
            ]),
            row,
          );
        body.retainedHistory = true;
        body.data = [...rows.values()].sort((a, b) =>
          String(b.date).localeCompare(String(a.date)),
        );
      }
      await pkmnPricesRequests.saveCache(key, body, token);
      return body;
    } catch (error) {
      await pkmnPricesRequests.releaseCache(key, token);
      throw error;
    }
  })();
  pkmnPricesRequests.pending.set(key, pending);
  try {
    const body = await pending;
    pkmnPricesRequests.cache.delete(key);
    pkmnPricesRequests.cache.set(key, {
      body: structuredClone(body),
      fetchedAt: Date.now(),
      expires: Math.min(
        Date.now() + 15 * 60_000,
        (Math.floor(Date.now() / 86_400_000) + 1) * 86_400_000,
      ),
    });
    // ponytail: 200 responses per warm instance; cold instances still share the durable budget/rate gate.
    if (pkmnPricesRequests.cache.size > 200)
      pkmnPricesRequests.cache.delete(
        pkmnPricesRequests.cache.keys().next().value,
      );
    return body;
  } finally {
    pkmnPricesRequests.pending.delete(key);
  }
}

async function uncachedRequest(url, apiKey, signal, { maxAttempts = 3 } = {}) {
  // Bound claim-to-delivery lag as well as provider I/O on every caller/retry.
  signal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
    : AbortSignal.timeout(10_000);
  const attempts = Math.min(3, Math.max(1, Math.trunc(maxAttempts)));
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const creditDay = new Date().toISOString().slice(0, 10);
      await pkmnPricesRequests.claim(url, signal);
      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal,
      });
      const body = await response.json().catch(() => ({}));
      await pkmnPricesRequests.recordUsage(
        url,
        response.status,
        body,
        body?.error?.code,
        creditDay,
      );
      if (response.ok) return body;
      const error = new Error("PkmnPrices request failed");
      error.status = response.status;
      error.providerCode = String(body?.error?.code || "");
      error.providerMessage = String(body?.error?.message || "");
      // Credentials, entitlement and quota/rate failures stop immediately.
      error.retryable = response.status >= 500;
      error.retryAfter = response.headers.get("retry-after");
      if (!error.retryable || attempt === attempts - 1) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (signal?.aborted || (!error?.retryable && error?.status)) throw error;
      if (attempt === attempts - 1) throw error;
    }
    await waitForRetry(pkmnPricesRetryDelayMs(lastError, attempt), signal);
  }
  throw lastError;
}

async function resolveCard(
  apiKey,
  lookup,
  signal,
  {
    requireLanguageMatch = false,
    directOnly = false,
    maxAttempts = 3,
    detailCurrency = "usd",
  } = {},
) {
  const hasIdentity = Boolean(
    String(lookup.name || "").trim() ||
    String(lookup.set || lookup.setName || "").trim() ||
    String(lookup.number || "").trim(),
  );
  if (lookup.pkmnpricesId && !hasIdentity && !requireLanguageMatch)
    return { id: lookup.pkmnpricesId, card: null };
  if (lookup.pkmnpricesId) {
    const directUrl = new URL(
      `${API_URL}/cards/${encodeURIComponent(lookup.pkmnpricesId)}`,
    );
    if (detailCurrency) directUrl.searchParams.set("currency", detailCurrency);
    let direct;
    try {
      direct = await request(directUrl, apiKey, signal, { maxAttempts });
    } catch (error) {
      if (error?.status !== 404) throw error;
      direct = null;
    }
    const identityMatches = matchesPkmnPricesIdentity(direct, lookup);
    const languageMatches =
      !requireLanguageMatch ||
      !lookup.language ||
      (direct?.language &&
        providerCardLanguage(direct.language) ===
          providerCardLanguage(lookup.language)) ||
      (!direct?.language && hasIdentity && identityMatches);
    if (languageMatches && (!hasIdentity || identityMatches))
      return { id: direct.id, card: direct };
    if (!hasIdentity) return null;
  }

  if (directOnly) return null;

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
  const totalSetNumber = String(lookup.number || "")
    .split("/")[1]
    ?.trim();
  if (totalSetNumber)
    byIdentity.searchParams.set("total_set_number", totalSetNumber);
  byIdentity.searchParams.set(
    "language",
    providerCardLanguage(lookup.language),
  );
  searches.push(byIdentity);

  for (const search of searches) {
    search.searchParams.set("per_page", "20");
    const result = await request(search, apiKey, signal, { maxAttempts });
    const candidates = (Array.isArray(result.data) ? result.data : []).filter(
      (card) => matchesPkmnPricesIdentity(card, lookup),
    );
    const match = selectCard(candidates, lookup);
    if (match?.id)
      return {
        id: match.id,
        card: {
          ...match,
          language: match.language || providerCardLanguage(lookup.language),
        },
      };
  }
  return null;
}

async function resolveCardId(apiKey, lookup, signal, options) {
  const resolved = await resolveCard(apiKey, lookup, signal, options);
  return resolved?.id || null;
}

async function fetchPriceHistory(
  apiKey,
  resource,
  cardId,
  lookup,
  signal,
  options,
) {
  let historyStatus =
    options.includeHistory === false ? "not_requested" : "live";
  const history = [];
  if (options.includeHistory !== false) {
    const statuses = [];
    for (const currency of options.currencies ||
      (options.includeEurHistory ? ["usd", "eur"] : ["usd"])) {
      let status = "live";
      const limit = Math.max(
        1,
        Math.min(365, Number(options.historyLimit) || 90),
      );
      for (let page = 1; page <= 4; page += 1) {
        const url = new URL(
          `${API_URL}/${resource}/${encodeURIComponent(cardId)}/prices/history`,
        );
        url.searchParams.set("currency", currency);
        url.searchParams.set("period", options.historyPeriod || "90d");
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("page", String(page));
        if (lookup.variant) {
          const matching = (options.currentPrices || []).filter(
            (price) =>
              String(price.currency).toLowerCase() === currency &&
              comparableSalePrinting(price.variant) ===
                comparableSalePrinting(lookup.variant),
          );
          const variants = [...new Set(matching.map((price) => price.variant))];
          url.searchParams.set(
            "variant",
            variants.length === 1 ? variants[0] : lookup.variant,
          );
        }
        if (lookup.condition)
          url.searchParams.set("condition", lookup.condition);
        let result;
        try {
          result = await request(url, apiKey, signal);
        } catch (error) {
          if (error?.status === 401 || error?.status === 429 || signal?.aborted)
            throw error;
          status = error?.status === 403 ? "plan_required" : "unavailable";
          break;
        }
        if (!Array.isArray(result.data)) {
          status = "unavailable";
          break;
        }
        history.push(
          ...(result.retainedHistory
            ? result.data
            : result.data.slice(0, limit)),
        );
        if (result.data.length > limit && !result.retainedHistory) {
          status = "partial";
          break;
        }
        const pages = result.pagination?.total_pages;
        if (pages == null && result.data.length < limit) break;
        if (
          !Number.isInteger(pages) ||
          pages < page ||
          (result.pagination?.page != null && result.pagination.page !== page)
        ) {
          status = "partial";
          break;
        }
        if (page >= pages) break;
        if (!result.data.length || page === 4) {
          status = "partial";
          break;
        }
      }
      statuses.push(status);
    }
    historyStatus = statuses.every((status) => status === "live")
      ? "live"
      : history.length
        ? "partial"
        : statuses.includes("plan_required")
          ? "plan_required"
          : "unavailable";
  }

  return { history, historyStatus };
}

export async function fetchPkmnPricesLookup(
  apiKey,
  lookup,
  signal,
  options = {},
) {
  // One detail request includes every permitted currency on Pro. Reuse the
  // validated detail instead of fetching it again after identity resolution.
  const resolved = await resolveCard(apiKey, lookup, signal, {
    detailCurrency: options.includeEur ? null : "usd",
  });
  if (!resolved) return { card: null, history: [] };
  const cardId = resolved.id;
  const cardUrl = new URL(`${API_URL}/cards/${encodeURIComponent(cardId)}`);
  if (!options.includeEur) cardUrl.searchParams.set("currency", "usd");
  const detail = Array.isArray(resolved.card?.prices)
    ? resolved.card
    : await request(cardUrl, apiKey, signal);
  const card = { ...detail, language: providerCardLanguage(lookup.language) };
  const eurStatus = options.includeEur ? "live" : "not_requested";

  // Optional history must not discard an already validated card/current quote.
  let history = [],
    historyStatus = "unavailable";
  try {
    ({ history, historyStatus } = await fetchPriceHistory(
      apiKey,
      "cards",
      cardId,
      lookup,
      signal,
      { ...options, currentPrices: card.prices },
    ));
  } catch (error) {
    historyStatus = error?.status === 429 ? "rate_limited" : "unavailable";
  }

  return {
    card,
    history,
    historyStatus,
    historyPeriod: options.historyPeriod || null,
    eurStatus,
  };
}

export async function fetchPkmnPricesSales(
  apiKey,
  lookup,
  signal,
  options = {},
) {
  const resolved = await resolveCard(apiKey, lookup, signal, {
    ...options,
    requireLanguageMatch: Boolean(lookup.language),
  });
  const cardId = resolved?.id || null;
  if (!cardId) return { cardId: null, sales: [] };
  const listings = new URL(
    `${API_URL}/cards/${encodeURIComponent(cardId)}/listings/ebay`,
  );
  listings.searchParams.set(
    "limit",
    String(Math.min(20, Math.max(1, Number(options.limit) || 10))),
  );
  if (options.cursor) listings.searchParams.set("cursor", options.cursor);
  if (options.since) listings.searchParams.set("since", options.since);
  listings.searchParams.set("sort", "date_desc");
  listings.searchParams.set("graded", String(Boolean(lookup.grader)));
  const printing = comparableSalePrinting(lookup.variant);
  if (printing)
    listings.searchParams.set(
      "variant",
      {
        normal: "Normal",
        holofoil: "Holofoil",
        "reverse holofoil": "Reverse Holofoil",
        "1st edition normal": "1st Edition",
        "1st edition holofoil": "1st Edition Holofoil",
      }[printing] || lookup.variant,
    );
  if (lookup.grader)
    listings.searchParams.set("grader", String(lookup.grader).toUpperCase());
  if (lookup.grade) listings.searchParams.set("grade", String(lookup.grade));
  const result = await request(listings, apiKey, signal, options);
  const received = Array.isArray(result.data) ? result.data : [];
  const upstreamExclusions = [];
  const rejected = (raw, reason) => {
    const rawId = String(raw?.ebay_listing_id || raw?.id || "").trim();
    upstreamExclusions.push({
      id: /^[\w-]{1,100}$/.test(rawId) ? `pkmnprices:${rawId}` : null,
      reason,
    });
  };
  const candidates = received.flatMap((raw) => {
    const sale = normalizePkmnPricesSale(raw);
    if (!sale) rejected(raw, "normalization_rejected");
    return sale ? [sale] : [];
  });
  const contextMatches = candidates.filter((sale) => {
    const matches = saleMatchesLookup(sale, lookup);
    if (!matches) rejected({ id: sale.providerSaleId }, "context_mismatch");
    return matches;
  });
  const canonicalRequired = Boolean(
    lookup.language ||
    lookup.name ||
    lookup.set ||
    lookup.setName ||
    lookup.number,
  );
  const sales = canonicalRequired
    ? contextMatches.filter((sale) => {
        const matches = saleMatchesCanonicalIdentity(
          sale,
          resolved.card,
          lookup,
        );
        if (!matches)
          rejected({ id: sale.providerSaleId }, "canonical_identity_mismatch");
        return matches;
      })
    : contextMatches;
  return {
    cardId: String(cardId),
    sales,
    receivedCount: received.length,
    acceptedCount: sales.length,
    excludedCount: upstreamExclusions.length,
    upstreamExclusions,
    exclusions: {
      normalizationRejected: received.length - candidates.length,
      contextMismatch: candidates.length - contextMatches.length,
      canonicalIdentityMismatch: contextMatches.length - sales.length,
    },
    nextCursor:
      typeof result.pagination?.next_cursor === "string"
        ? result.pagination.next_cursor
        : null,
    highestIngestedAt:
      received
        .map((row) => row.ingested_at)
        .filter(
          (value) =>
            typeof value === "string" && Number.isFinite(Date.parse(value)),
        )
        .sort()
        .at(-1) || null,
    hasMore: result.pagination?.has_more === true,
    conditionScope: "not_provided",
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
  const requestedLanguage = providerSealedLanguage(language);
  url.searchParams.set("language", requestedLanguage);
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("page", "1");
  const result = await request(url, apiKey, signal);
  return (Array.isArray(result.data) ? result.data : []).map((product) =>
    normalizePkmnPricesSealedProduct({
      ...product,
      language: product.language || requestedLanguage,
    }),
  );
}

export async function fetchPkmnPricesSealedProduct(
  apiKey,
  id,
  signal,
  { includeHistory = false, currencies = ["usd", "eur"] } = {},
) {
  const result = await request(
    new URL(`${API_URL}/sealed/${encodeURIComponent(id)}`),
    apiKey,
    signal,
  );
  const product = normalizePkmnPricesSealedProduct(result);
  if (includeHistory) {
    let history = [],
      historyStatus = "unavailable";
    try {
      ({ history, historyStatus } = await fetchPriceHistory(
        apiKey,
        "sealed",
        id,
        {},
        signal,
        { currencies, historyPeriod: "365d", historyLimit: 365 },
      ));
    } catch (error) {
      historyStatus = error?.status === 429 ? "rate_limited" : "unavailable";
    }
    product.history = normalizePkmnPricesCard({ id }, history).history.map(
      (point) => ({
        ...point,
        providerVariantId: `${id}:${point.provider}:sealed`,
        finish: "sealed",
        condition: null,
        quality: { ...point.quality, sourceCondition: point.condition },
      }),
    );
    product.historyStatus = historyStatus;
    product.capabilities.history = historyStatus;
  }
  return product;
}
