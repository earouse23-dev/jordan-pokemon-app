import { comparableSalePrinting } from "./providers/pkmnprices.js";

const TCG_PRICE_TYPES = ["market", "low", "mid", "high", "directLow"];
const CARDMARKET_PRICE_TYPES = {
  trendPrice: "trend",
  lowPrice: "low",
  averageSellPrice: "average",
  avg1: "average",
  avg7: "average",
  avg30: "average",
  reverseHoloTrend: "trend",
  reverseHoloLow: "low",
  reverseHoloSell: "average",
  reverseHoloAvg1: "average",
  reverseHoloAvg7: "average",
  reverseHoloAvg30: "average",
};

export const PRICE_EVIDENCE_RULE_VERSION = "mica-price-evidence-v1";
export const EXACT_SOLD_RULE_VERSION = "mica-exact-sold-v1";

export const PRICE_FRESHNESS_POLICY = Object.freeze({
  market_index: Object.freeze({ liveHours: 48, staleHours: 96 }),
  completed_sale: Object.freeze({ liveHours: 30 * 24, staleHours: 90 * 24 }),
  asking_price: Object.freeze({ liveHours: 24, staleHours: 72 }),
  manual_override: Object.freeze({ liveHours: null, staleHours: null }),
});

const CAPABILITY_STATUS_ALIASES = Object.freeze({
  live: "live",
  available: "live",
  not_requested: "not_requested",
  loading: "missing",
  unsupported: "unsupported",
  plan_required: "unsupported",
  provider_plan_required: "unsupported",
  unconfigured: "unsupported",
  provider_unconfigured: "unsupported",
  missing: "missing",
  unavailable: "missing",
  manual: "manual_override",
  manual_override: "manual_override",
  rate_limited: "rate_limited",
  provider_rate_limited: "rate_limited",
  error: "provider_error",
  provider_error: "provider_error",
  provider_unavailable: "provider_error",
});

function finiteTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sourceTimestamp(observation) {
  return (
    observation?.providerUpdatedAt ||
    observation?.provider_updated_at ||
    observation?.observedAt ||
    observation?.observed_at ||
    observation?.soldAt ||
    observation?.sold_at ||
    null
  );
}

export function priceEvidenceKind(observation) {
  const explicit = String(
    observation?.evidenceKind || observation?.evidence_kind || "",
  ).toLowerCase();
  if (Object.hasOwn(PRICE_FRESHNESS_POLICY, explicit)) return explicit;
  const type = String(
    observation?.valuationType ||
      observation?.valuation_type ||
      observation?.priceType ||
      "",
  ).toLowerCase();
  if (
    ["last_sold", "completed_sale", "average_sale", "median_sale"].includes(
      type,
    )
  )
    return "completed_sale";
  if (["listing", "asking", "asking_price"].includes(type))
    return "asking_price";
  if (["manual", "manual_override", "user_override"].includes(type))
    return "manual_override";
  return "market_index";
}

export function priceFreshness(
  observation,
  { now = Date.now(), policy = PRICE_FRESHNESS_POLICY } = {},
) {
  const kind = priceEvidenceKind(observation);
  const window = policy[kind] || policy.market_index;
  if (kind === "manual_override")
    return {
      kind,
      band: "manual",
      status: "manual_override",
      ageHours: null,
      observedAt: sourceTimestamp(observation),
      expiresAt: null,
      reason: "owner_entered",
    };
  const observedAt = sourceTimestamp(observation);
  const timestamp = finiteTimestamp(observedAt);
  if (timestamp === null)
    return {
      kind,
      band: "undated",
      status: "stale",
      ageHours: null,
      observedAt,
      expiresAt: null,
      reason: "source_timestamp_missing",
    };
  const ageHours = Math.max(0, (Number(now) - timestamp) / 3_600_000);
  const liveHours = Number(window.liveHours);
  const staleHours = Number(window.staleHours);
  const band =
    ageHours <= liveHours ? "live" : ageHours <= staleHours ? "aging" : "stale";
  return {
    kind,
    band,
    status: band === "live" ? "live" : "stale",
    ageHours,
    observedAt,
    expiresAt: new Date(timestamp + liveHours * 3_600_000).toISOString(),
    reason:
      band === "live"
        ? "within_source_window"
        : band === "aging"
          ? "outside_live_window"
          : "outside_stale_window",
  };
}

export function normalizePriceCapabilityStatus(value, fallback = "missing") {
  const input = String(value || fallback).toLowerCase();
  return {
    status: CAPABILITY_STATUS_ALIASES[input] || "provider_error",
    reason: input,
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function reviewComparableOutliers(
  observations,
  {
    minimumSample = 5,
    robustZThreshold = 3.5,
    minimumDeviationPercent = 40,
  } = {},
) {
  const rows = (observations || [])
    .map((observation, index) => ({
      observation,
      index,
      amount: Number(observation?.amount ?? observation?.marketPrice),
    }))
    .filter((row) => Number.isFinite(row.amount) && row.amount > 0);
  const cohortMedian = median(rows.map((row) => row.amount));
  const deviations = rows.map((row) => Math.abs(row.amount - cohortMedian));
  const mad = median(deviations);
  return rows.map((row) => {
    const deviationPercent = cohortMedian
      ? (Math.abs(row.amount - cohortMedian) / cohortMedian) * 100
      : null;
    const robustZScore = mad
      ? (0.6745 * Math.abs(row.amount - cohortMedian)) / mad
      : null;
    const enoughEvidence = rows.length >= minimumSample;
    const flagged = Boolean(
      enoughEvidence &&
      deviationPercent >= minimumDeviationPercent &&
      (robustZScore === null || robustZScore > robustZThreshold),
    );
    return {
      ...row.observation,
      outlierReview: {
        ruleVersion: PRICE_EVIDENCE_RULE_VERSION,
        cohortSize: rows.length,
        median: cohortMedian,
        mad,
        deviationPercent,
        robustZScore,
        flagged,
        reason: !enoughEvidence
          ? "insufficient_comparables"
          : flagged
            ? "robust_price_outlier"
            : "within_review_band",
      },
    };
  });
}

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function observedAt(value) {
  return value ? String(value).replaceAll("/", "-") : null;
}

export function finishForVariant(variant) {
  const value = String(variant || "").toLowerCase();
  if (value.includes("sealed")) return "sealed";
  if (value.includes("1st edition") && value.includes("holo"))
    return "1stEditionHolofoil";
  if (value.includes("1st edition")) return "1stEditionNormal";
  if (value.includes("reverse")) return "reverseHolofoil";
  if (value.includes("holo")) return "holofoil";
  return "normal";
}

function finishForPricingContext(variant, context = {}) {
  if (!Object.prototype.hasOwnProperty.call(context, "finish"))
    return finishForVariant(variant);
  const finish = String(context.finish || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!finish || finish === "unknown") return null;
  const mapped =
    {
      normal: "normal",
      nonholo: "normal",
      holo: "holofoil",
      holofoil: "holofoil",
      reverse: "reverseHolofoil",
      reverseholo: "reverseHolofoil",
      reverseholofoil: "reverseHolofoil",
      sealed: "sealed",
      firsteditionnormal: "1stEditionNormal",
      firsteditionholofoil: "1stEditionHolofoil",
    }[finish] || null;
  if (!mapped) return null;
  const edition = String(context.edition || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (edition !== "firstedition") return mapped;
  if (mapped === "normal") return "1stEditionNormal";
  if (mapped === "holofoil") return "1stEditionHolofoil";
  return null;
}

function hasGradedContext(quote = {}) {
  const company = String(quote.gradingCompany || "").trim();
  const grade =
    quote.grade === null || quote.grade === undefined
      ? ""
      : String(quote.grade).trim();
  return Boolean(company || grade);
}

export function safeMarketSourceUrl(value, market) {
  const domains = {
    tcgplayer: ["tcgplayer.com"],
    cardmarket: ["cardmarket.com"],
    ebay: ["ebay.com", "ebay.co.uk", "ebay.ca", "ebay.de", "ebay.fr", "ebay.it", "ebay.es", "ebay.com.au"],
  }[String(market || "").toLowerCase()];
  if (!domains) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizeCard(card, retrievedAt = new Date().toISOString()) {
  const quotes = [];
  for (const [finish, prices] of Object.entries(
    card?.tcgplayer?.prices || {},
  )) {
    for (const priceType of TCG_PRICE_TYPES) {
      const value = amount(prices?.[priceType]);
      if (value === null) continue;
      quotes.push({
        provider: "tcgplayer",
        aggregator: "pokemon_tcg_api",
        market: "tcgplayer",
        providerProductId: card.id,
        currency: "USD",
        region: "US",
        condition: null,
        finish,
        gradingCompany: null,
        grade: null,
        priceType: priceType === "directLow" ? "low" : priceType,
        amount: value,
        observedAt: observedAt(card.tcgplayer.updatedAt),
        retrievedAt,
        providerUrl: safeMarketSourceUrl(card.tcgplayer.url, "tcgplayer"),
        attribution: "TCGplayer pricing via Pokémon TCG API",
        quality: { direct: true, field: priceType },
      });
    }
  }

  for (const [field, priceType] of Object.entries(CARDMARKET_PRICE_TYPES)) {
    const value = amount(card?.cardmarket?.prices?.[field]);
    if (value === null) continue;
    const windowDays =
      /^.*Avg(1|7|30)$/.exec(field)?.[1] ||
      /^avg(1|7|30)$/.exec(field)?.[1] ||
      null;
    quotes.push({
      provider: "cardmarket",
      aggregator: "pokemon_tcg_api",
      market: "cardmarket",
      providerProductId: card.id,
      currency: "EUR",
      region: "EU",
      condition: field === "lowPriceExPlus" ? "EX+" : null,
      finish: field.startsWith("reverseHolo") ? "reverseHolofoil" : "normal",
      gradingCompany: null,
      grade: null,
      priceType,
      amount: value,
      observedAt: observedAt(card.cardmarket.updatedAt),
      retrievedAt,
      providerUrl: safeMarketSourceUrl(card.cardmarket.url, "cardmarket"),
      attribution: "Cardmarket pricing via Pokémon TCG API",
      quality: {
        direct: true,
        field,
        windowDays: windowDays ? Number(windowDays) : null,
      },
    });
  }

  return {
    providerCardId: card.id,
    name: card.name,
    setName: card.set?.name || "",
    collectorNumber: card.number || "",
    rarity: card.rarity || null,
    artist: card.artist || null,
    releaseDate: card.set?.releaseDate || null,
    images: {
      small: card.images?.small || null,
      large: card.images?.large || null,
    },
    quotes,
  };
}

export function selectReferenceQuote(
  quotes,
  variant,
  currency = "USD",
  context = {},
) {
  const finish = finishForPricingContext(variant, context);
  if (!finish) return null;
  const compatible = (quotes || []).filter(
    (quote) => quote.currency === currency && quote.finish === finish,
  );
  if (context.gradingCompany) {
    const company = String(context.gradingCompany).toUpperCase();
    const grade = String(context.grade ?? "");
    return (
      compatible.find(
        (quote) =>
          String(quote.gradingCompany || "").toUpperCase() === company &&
          String(quote.grade ?? "") === grade,
      ) || null
    );
  }
  for (const provider of currency === "EUR" ? ["cardmarket"] : ["justtcg", "tcgplayer"]) {
    const fromProvider = compatible.filter(
      (quote) => quote.provider === provider && !hasGradedContext(quote),
    );
    for (const priceType of ["market", "mid", "low"]) {
      if (context.condition && context.condition !== "Graded") {
        const exact = fromProvider.find(
          (candidate) =>
            candidate.priceType === priceType &&
            candidate.condition === context.condition,
        );
        if (exact) return exact;
        const conditionNeutral = fromProvider.find(
          (candidate) =>
            candidate.priceType === priceType && candidate.condition == null,
        );
        if (conditionNeutral) return conditionNeutral;
        continue;
      }
      const nearMint = fromProvider.find(
        (candidate) =>
          candidate.priceType === priceType &&
          candidate.condition === "Near Mint",
      );
      if (nearMint) return nearMint;
      const conditionNeutral = fromProvider.find(
        (candidate) =>
          candidate.priceType === priceType && candidate.condition == null,
      );
      if (conditionNeutral) return conditionNeutral;
    }
  }
  return null;
}

export function priceEvidence(
  quotes,
  variant,
  currency = "USD",
  context = {},
  now = Date.now(),
) {
  const finish = finishForPricingContext(variant, context);
  const grader = String(
    context.gradingCompany || context.grader || "",
  ).toUpperCase();
  const grade =
    context.grade === null || context.grade === undefined
      ? ""
      : String(context.grade);
  const condition = String(context.condition || "");
  const priority = new Map([
    ["market", 0],
    ["average", 1],
    ["trend", 2],
    ["mid", 3],
    ["low", 4],
    ["high", 5],
  ]);
  const compatible = (quotes || []).filter((quote) => {
    if (
      quote.currency !== currency ||
      quote.finish !== finish ||
      !Number.isFinite(Number(quote.amount)) ||
      Number(quote.amount) <= 0 ||
      quote.anomalous ||
      quote.excluded ||
      quote.outlierReview?.excluded
    )
      return false;
    if (grader)
      return (
        String(quote.gradingCompany || "").toUpperCase() === grader &&
        String(quote.grade ?? "") === grade
      );
    if (hasGradedContext(quote)) return false;
    return (
      !condition || quote.condition === condition || quote.condition == null
    );
  });

  const bySource = new Map();
  for (const quote of compatible) {
    const market = String(quote.market || quote.provider || "unknown");
    const sourceKey = `${market}|${quote.currency}`;
    const current = bySource.get(sourceKey);
    const exactCondition = Boolean(condition && quote.condition === condition);
    const currentExact = Boolean(
      current && condition && current.condition === condition,
    );
    const quotePriority = priority.get(quote.priceType) ?? 99;
    const currentPriority = priority.get(current?.priceType) ?? 99;
    if (
      !current ||
      (exactCondition && !currentExact) ||
      (exactCondition === currentExact && quotePriority < currentPriority)
    )
      bySource.set(sourceKey, quote);
  }

  const evidence = [...bySource.values()].map((quote) => {
    const freshness = priceFreshness(quote, { now });
    const aggregator = String(
      quote.aggregator ||
        quote.quality?.aggregator ||
        quote.provider ||
        "unknown",
    );
    const market = String(quote.market || quote.provider || "unknown");
    return {
      provider: aggregator,
      aggregator,
      market,
      amount: Number(quote.amount),
      currency: quote.currency,
      priceType: quote.priceType,
      observedAt: freshness.observedAt,
      retrievedAt: quote.retrievedAt || null,
      ageHours: freshness.ageHours,
      ageDays:
        freshness.ageHours === null
          ? null
          : Math.floor(freshness.ageHours / 24),
      freshness,
      condition: quote.condition || null,
      attribution: quote.attribution || null,
      providerUrl: quote.providerUrl || null,
    };
  });
  if (!evidence.length)
    return {
      ruleVersion: PRICE_EVIDENCE_RULE_VERSION,
      level: "unavailable",
      label: "Not enough evidence",
      summary: "No compatible price source covers this exact context.",
      confidenceScore: 0,
      sourceCount: 0,
      liveSourceCount: 0,
      spreadPercent: null,
      medianAmount: null,
      rangeLow: null,
      rangeHigh: null,
      freshestAt: null,
      staleSources: 0,
      agingSources: 0,
      valuationEligible: false,
      evidence: [],
    };

  const amounts = evidence.map((item) => item.amount).sort((a, b) => a - b);
  const midpoint = median(amounts);
  const spreadPercent =
    amounts.length > 1 && midpoint > 0
      ? ((amounts.at(-1) - amounts[0]) / midpoint) * 100
      : null;
  const dated = evidence.filter((item) => item.ageHours !== null);
  const staleSources = evidence.filter(
    (item) => item.freshness.status === "stale",
  ).length;
  const agingSources = evidence.filter(
    (item) => item.freshness.band === "aging",
  ).length;
  const liveSources = evidence.filter(
    (item) => item.freshness.status === "live",
  );
  const allLive = liveSources.length === evidence.length;
  const freshest =
    dated.sort((left, right) => left.ageHours - right.ageHours)[0] || null;
  let level = "limited";
  if (!liveSources.length) level = "stale";
  else if (evidence.length >= 2 && allLive && spreadPercent <= 15)
    level = "strong";
  else if (evidence.length >= 2 && spreadPercent <= 30) level = "moderate";
  const label =
    level === "strong"
      ? "Strong evidence"
      : level === "moderate"
        ? "Moderate evidence"
        : level === "stale"
          ? "Stale evidence"
          : "Limited evidence";
  const summary = !liveSources.length
    ? "Compatible evidence exists, but none is fresh enough for the automatic portfolio value."
    : evidence.length === 1
      ? "Only one compatible market source is available. Review recent completed sales for high-value decisions."
      : staleSources
        ? `${evidence.length} compatible market sources are available, but ${staleSources} ${staleSources === 1 ? "is" : "are"} outside the live freshness window.`
        : spreadPercent > 30
          ? `${evidence.length} compatible market sources differ materially. Review the source rows before deciding.`
          : `${evidence.length} compatible market sources are reasonably aligned for this exact context.`;
  return {
    ruleVersion: PRICE_EVIDENCE_RULE_VERSION,
    level,
    label,
    summary,
    confidenceScore:
      level === "strong"
        ? 0.9
        : level === "moderate"
          ? 0.7
          : level === "limited"
            ? 0.45
            : 0.2,
    sourceCount: evidence.length,
    liveSourceCount: liveSources.length,
    spreadPercent,
    medianAmount: midpoint,
    rangeLow: amounts[0],
    rangeHigh: amounts.at(-1),
    freshestAt: freshest?.observedAt || null,
    staleSources,
    agingSources,
    valuationEligible: liveSources.length > 0,
    evidence,
  };
}

const PORTFOLIO_PRICE_CATEGORIES = Object.freeze([
  "strong",
  "moderate",
  "limited",
  "stale",
  "missing",
  "unsupported",
  "rate_limited",
  "provider_error",
  "manual_override",
  "other_currency",
]);

function emptyCoverageCategory() {
  return { positions: 0, units: 0, value: 0, referenceValue: 0 };
}

function missingPriceCategory(status) {
  return normalizePriceCapabilityStatus(status || "missing").status;
}

export function portfolioPriceCoverage(
  items,
  { now = Date.now(), currency = "USD" } = {},
) {
  const categories = Object.fromEntries(
    PORTFOLIO_PRICE_CATEGORIES.map((category) => [
      category,
      emptyCoverageCategory(),
    ]),
  );
  let totalPositions = 0;
  let totalUnits = 0;
  let automaticValue = 0;
  let manualValue = 0;
  let oldestIncludedAt = null;
  for (const item of items || []) {
    const quantity = Math.max(0, Number(item?.quantity) || 0);
    if (!quantity) continue;
    totalPositions += 1;
    totalUnits += quantity;
    const amount = Number(item?.price);
    const hasAmount =
      item?.price !== null &&
      item?.price !== undefined &&
      item?.price !== "" &&
      Number.isFinite(amount) &&
      amount >= 0;
    let category;
    let report = null;
    if (
      item?.currency &&
      String(item.currency).toUpperCase() !== String(currency).toUpperCase()
    )
      category = "other_currency";
    else if (["manual", "manual_override"].includes(item?.pricingStatus))
      category = "manual_override";
    else if (item?.pricingStatus === "stale") category = "stale";
    else if (!hasAmount) category = missingPriceCategory(item?.pricingStatus);
    else {
      report = priceEvidence(
        item?.quotes || [],
        item?.variant,
        item?.currency || "USD",
        item,
        now,
      );
      category =
        item?.pricingStatus === "stale"
          ? "stale"
          : report.level === "unavailable"
            ? "limited"
            : report.level;
    }
    if (!Object.hasOwn(categories, category)) category = "provider_error";
    const row = categories[category];
    row.positions += 1;
    row.units += quantity;
    const referenceAmount = Number(
      item?.referencePrice ?? item?.stalePrice ?? item?.price,
    );
    if (Number.isFinite(referenceAmount) && referenceAmount >= 0)
      row.referenceValue += referenceAmount * quantity;
    if (
      hasAmount &&
      !["stale", "provider_error", "other_currency"].includes(category)
    ) {
      row.value += amount * quantity;
      if (category === "manual_override") manualValue += amount * quantity;
      else automaticValue += amount * quantity;
      const observedAt = report?.freshestAt;
      if (
        observedAt &&
        (!oldestIncludedAt ||
          new Date(observedAt).getTime() < new Date(oldestIncludedAt).getTime())
      )
        oldestIncludedAt = observedAt;
    }
  }
  const pricedUnits = [
    "strong",
    "moderate",
    "limited",
    "manual_override",
  ].reduce((sum, category) => sum + categories[category].units, 0);
  const liveAutomaticUnits = ["strong", "moderate", "limited"].reduce(
    (sum, category) => sum + categories[category].units,
    0,
  );
  const automaticValueByConfidence = Object.fromEntries(
    ["strong", "moderate", "limited"].map((category) => [
      category,
      {
        value: categories[category].value,
        percent: automaticValue
          ? (categories[category].value / automaticValue) * 100
          : 0,
      },
    ]),
  );
  return {
    ruleVersion: PRICE_EVIDENCE_RULE_VERSION,
    reportingCurrency: String(currency).toUpperCase(),
    totalPositions,
    totalUnits,
    pricedUnits,
    liveAutomaticUnits,
    unpricedUnits: Math.max(0, totalUnits - pricedUnits),
    quantityCoveragePercent: totalUnits ? (pricedUnits / totalUnits) * 100 : 0,
    automaticCoveragePercent: totalUnits
      ? (liveAutomaticUnits / totalUnits) * 100
      : 0,
    automaticValue,
    manualValue,
    displayedValue: automaticValue + manualValue,
    oldestIncludedAt,
    categories,
    automaticValueByConfidence,
  };
}

export function selectCardmarketReference(quotes, variant) {
  const finish = finishForVariant(variant);
  const requestedFinish =
    finish === "sealed"
      ? "sealed"
      : finish === "normal" || finish === "1stEditionNormal"
        ? "normal"
        : "holofoil";
  const compatible = (quotes || []).filter(
    (quote) =>
      quote.provider === "cardmarket" &&
      quote.currency === "EUR" &&
      quote.finish === requestedFinish,
  );
  return (
    compatible.find((quote) => quote.priceType === "trend") ||
    compatible.find((quote) => quote.priceType === "average") ||
    compatible.find((quote) => quote.priceType === "low") ||
    null
  );
}

export function gradedPriceLadder(quotes, variant, currency = "USD") {
  const finish = finishForVariant(variant);
  const priority = new Map([
    ["market", 0],
    ["average", 1],
    ["mid", 2],
    ["low", 3],
    ["high", 4],
  ]);
  const rows = new Map();
  for (const quote of quotes || []) {
    if (
      !quote.gradingCompany ||
      quote.grade == null ||
      quote.currency !== currency ||
      quote.finish !== finish
    )
      continue;
    const grader = String(quote.gradingCompany).toUpperCase();
    const grade = String(quote.grade);
    const key = `${grader}:${grade}`;
    const current = rows.get(key);
    if (
      !current ||
      (priority.get(quote.priceType) ?? 99) <
        (priority.get(current.priceType) ?? 99)
    )
      rows.set(key, {
        grader,
        grade,
        amount: Number(quote.amount),
        currency: quote.currency,
        priceType: quote.priceType,
        provider: quote.provider,
        observedAt: quote.observedAt || quote.retrievedAt || null,
      });
  }
  return [...rows.values()]
    .filter((row) => Number.isFinite(row.amount) && row.amount > 0)
    .sort(
      (left, right) =>
        left.grader.localeCompare(right.grader) ||
        Number(right.grade) - Number(left.grade),
    );
}

export function mergePriceHistory(...sources) {
  const unique = new Map();
  for (const point of sources.flat()) {
    const amount = Number(point?.amount);
    const timestamp = point?.recordedAt
      ? new Date(point.recordedAt).getTime()
      : NaN;
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(timestamp))
      continue;
    const recordedAt = new Date(timestamp).toISOString();
    const normalized = { ...point, amount, recordedAt };
    const key = [
      point.provider,
      point.providerVariantId,
      point.currency,
      point.condition,
      point.finish,
      recordedAt,
      amount,
    ].join("|");
    unique.set(key, normalized);
  }
  return [...unique.values()].sort(
    (left, right) => new Date(left.recordedAt) - new Date(right.recordedAt),
  );
}

export function priceMovement(
  points,
  { days = 30, asOf = null, currentAmount = null } = {},
) {
  const periodDays = Number(days);
  if (!Number.isFinite(periodDays) || periodDays <= 0) return null;

  const observations = (points || [])
    .map((point) => ({
      amount: Number(point?.amount),
      recordedAt: point?.recordedAt,
      timestamp: point?.recordedAt ? new Date(point.recordedAt).getTime() : NaN,
    }))
    .filter(
      (point) =>
        Number.isFinite(point.amount) &&
        point.amount > 0 &&
        Number.isFinite(point.timestamp),
    )
    .sort((left, right) => left.timestamp - right.timestamp);
  if (observations.length < 2) return null;

  const requestedAsOf = asOf ? new Date(asOf).getTime() : NaN;
  const endTimestamp = Number.isFinite(requestedAsOf)
    ? requestedAsOf
    : observations.at(-1).timestamp;
  const eligible = observations.filter(
    (observation) => observation.timestamp <= endTimestamp,
  );
  if (eligible.length < 2) return null;

  const cutoff = endTimestamp - periodDays * 24 * 60 * 60 * 1000;
  const baseline = eligible
    .filter((observation) => observation.timestamp <= cutoff)
    .at(-1);
  if (!baseline) return null;

  const latest = eligible.at(-1);
  const suppliedCurrent = Number(currentAmount);
  const endingAmount =
    currentAmount !== null &&
    currentAmount !== undefined &&
    Number.isFinite(suppliedCurrent) &&
    suppliedCurrent >= 0
      ? suppliedCurrent
      : latest.amount;
  const changeAmount = endingAmount - baseline.amount;

  return {
    days: periodDays,
    fromAmount: baseline.amount,
    toAmount: endingAmount,
    changeAmount,
    changePercent: (changeAmount / baseline.amount) * 100,
    fromDate: new Date(baseline.timestamp).toISOString(),
    toDate: new Date(endTimestamp).toISOString(),
  };
}

// A descriptive summary of retrieved sales, never an official market quote.
export function summarizePsaSales(sales, grade, now = Date.now()) {
  const seen = new Set();
  const rows = (Array.isArray(sales) ? sales : [])
    .filter((sale) => {
      if (
        !sale ||
        sale.attribution !== "exact" ||
        sale.gradingCompany !== "PSA" ||
        String(sale.grade) !== String(grade) ||
        sale.gradeQualifier ||
        sale.currency !== "USD" ||
        typeof sale.amount !== "number" ||
        !Number.isFinite(sale.amount) ||
        sale.amount <= 0 ||
        !Number.isFinite(Date.parse(sale.soldAt)) ||
        Date.parse(sale.soldAt) > now ||
        new Date(sale.soldAt).toISOString().slice(0, 10) !==
          String(sale.soldAt).slice(0, 10)
      )
        return false;
      try {
        const url = new URL(sale.sourceUrl);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          !/^(?:www\.)?ebay\.(?:com|co\.uk|ca|de|fr|it|es|com\.au)$/.test(
            url.hostname,
          )
        )
          return false;
        const listingId = url.pathname.match(
          /^\/itm\/(?:[^/]+\/)?(\d+)\/?$/,
        )?.[1];
        if (!listingId) return false;
        const key = `ebay:${listingId}`;
        const id = sale.providerSaleId ? `id:${sale.providerSaleId}` : key;
        if (seen.has(key) || seen.has(id)) return false;
        seen.add(key);
        seen.add(id);
        return true;
      } catch {
        return false;
      }
    })
    .sort((a, b) => Date.parse(b.soldAt) - Date.parse(a.soldAt));
  const amounts = rows
    .filter((row) => !row.outlierReview?.flagged)
    .map((row) => row.amount)
    .sort((a, b) => a - b);
  const middle = Math.floor(amounts.length / 2);
  return {
    rows,
    count: amounts.length,
    excluded: rows.length - amounts.length,
    median: amounts.length
      ? amounts.length % 2
        ? amounts[middle]
        : (amounts[middle - 1] + amounts[middle]) / 2
      : null,
  };
}

// The sales API supplies this envelope only after its canonical-title and
// exact-printing filters. Provider "exact" attribution alone is insufficient.
export function exactSoldValuation(sales, context, options = {}) {
  const now = Number(options.now ?? Date.now());
  const evaluatedAt = Number.isFinite(now) ? new Date(now).toISOString() : null;
  const currency = String(context?.currency || "").toUpperCase();
  const grade = Number(context?.grade);
  const required = [
    context?.canonicalId,
    context?.name,
    context?.set,
    context?.number,
    context?.language,
    context?.variant,
    context?.finish,
    context?.edition,
    context?.promoType,
    context?.grader,
  ];
  const envelope = options.validatedContext;
  const same = (left, right) =>
    String(left ?? "")
      .trim()
      .toLowerCase() ===
    String(right ?? "")
      .trim()
      .toLowerCase();
  const contextReady =
    evaluatedAt &&
    context?.identityStatus === "exact" &&
    required.every(
      (value) => value && String(value).trim().toLowerCase() !== "unknown",
    ) &&
    comparableSalePrinting(context.variant) &&
    typeof context.qualifier === "string" &&
    Number.isFinite(grade) &&
    grade >= 1 &&
    grade <= 10 &&
    /^[A-Z]{3}$/.test(currency) &&
    ["USD", "EUR"].includes(currency) &&
    envelope?.currency === currency &&
    envelope?.canonicalValidated === true &&
    envelope?.completedSaleValidated === true &&
    envelope?.providerCardId &&
    same(context.canonicalId, envelope.clientId) &&
    [
      "name",
      "set",
      "number",
      "language",
      "variant",
      "finish",
      "edition",
      "promoType",
    ].every((field) => same(context[field], envelope[field])) &&
    same(context.grader, envelope.grader) &&
    Number(envelope.grade) === grade &&
    same(context.qualifier, envelope.gradeQualifier);
  const excluded = [];
  const candidates = [];
  const input = Array.isArray(sales) ? sales : [];
  const identifier = (sale) =>
    String(
      sale?.evidenceId ||
        (sale?.providerSaleId
          ? `${sale.provider || "provider"}:${sale.providerSaleId}`
          : sale?.sourceUrl || "unidentified"),
    );
  const reject = (sale, reason) =>
    excluded.push({ id: identifier(sale), reason });
  const validDate = (value) => {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(
        value,
      )
    )
      return null;
    const time = Date.parse(value);
    const date = value.slice(0, 10);
    const dateTime = Date.parse(`${date}T00:00:00Z`);
    return Number.isFinite(time) &&
      Number.isFinite(dateTime) &&
      new Date(dateTime).toISOString().slice(0, 10) === date
      ? time
      : null;
  };
  const transaction = (sale) => {
    try {
      const url = new URL(sale.sourceUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.port)
        return null;
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const market = String(
        sale.source || sale.marketplace || "",
      ).toLowerCase();
      if (market === "ebay") {
        if (!/^ebay\.(?:com|co\.uk|ca|de|fr|it|es|com\.au)$/.test(host))
          return null;
        const id = url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
        return id ? { key: `ebay:${id}`, market: "ebay" } : null;
      }
      // Other markets need a transaction ID, not a product or asking-listing URL.
      const domain = {
        cardmarket: "cardmarket.com",
        tcgplayer: "tcgplayer.com",
      }[market];
      const id = String(sale.marketplaceTransactionId || "").trim();
      return domain &&
        (host === domain || host.endsWith(`.${domain}`)) &&
        url.pathname !== "/" &&
        /^[\w-]{4,100}$/.test(id)
        ? { key: `${market}:${id}`, market }
        : null;
    } catch {
      return null;
    }
  };
  if (!contextReady)
    return {
      ruleVersion: EXACT_SOLD_RULE_VERSION,
      status: "unresolved_context",
      estimate: null,
      currency,
      evaluatedAt,
      evidence: [],
      contributingEvidenceIds: [],
      excluded: input.map((row) => ({
        id: identifier(row),
        reason: "unverified_context",
      })),
      distinctSaleCount: 0,
      sourceMarketCount: 0,
      newestSoldAt: null,
      newestRetrievedAt: options.retrievedAt || null,
      rangeLow: null,
      rangeHigh: null,
      medianBeforeOutliers: null,
      medianAfterOutliers: null,
      confidence: { level: "unavailable", factors: ["context_unverified"] },
      hasMore: options.hasMore === true,
    };
  const language = (value) =>
    ({ en: "english", ja: "japanese", de: "german" })[
      String(value || "").toLowerCase()
    ] || String(value || "").toLowerCase();
  for (const sale of input) {
    if (!sale || sale.attribution !== "exact") {
      reject(sale, "attribution_not_exact");
      continue;
    }
    if (
      (sale.evidenceKind && sale.evidenceKind !== "completed_sale") ||
      (sale.saleType &&
        !["sold", "completed", "completed_sale"].includes(sale.saleType))
    ) {
      reject(sale, "not_completed_sale");
      continue;
    }
    if (
      !same(sale.gradingCompany, context.grader) ||
      Number(sale.grade) !== grade ||
      !same(sale.gradeQualifier, context.qualifier) ||
      comparableSalePrinting(sale.printing) !==
        comparableSalePrinting(context.variant) ||
      (sale.language && language(sale.language) !== language(context.language))
    ) {
      reject(sale, "context_mismatch");
      continue;
    }
    if (sale.currency !== currency) {
      reject(sale, "currency_mismatch");
      continue;
    }
    if (
      typeof sale.amount !== "number" ||
      !Number.isFinite(sale.amount) ||
      sale.amount <= 0
    ) {
      reject(sale, "invalid_amount");
      continue;
    }
    const sold = validDate(sale.soldAt);
    if (sold === null || sold > now) {
      reject(sale, "invalid_or_future_sold_at");
      continue;
    }
    if (sold < now - 90 * 86400000) {
      reject(sale, "outside_90_day_window");
      continue;
    }
    const source = transaction(sale);
    if (!source) {
      reject(sale, "missing_transaction_source");
      continue;
    }
    candidates.push({
      ...sale,
      evidenceId: identifier(sale),
      transactionKey: source.key,
      sourceMarket: source.market,
      soldTime: sold,
      retrievedAt: sale.retrievedAt || options.retrievedAt || null,
    });
  }
  const groups = new Map();
  for (const sale of candidates) {
    const rows = groups.get(sale.transactionKey) || [];
    rows.push(sale);
    groups.set(sale.transactionKey, rows);
  }
  const distinct = [];
  for (const rows of groups.values()) {
    rows.sort(
      (a, b) =>
        String(b.retrievedAt || "").localeCompare(
          String(a.retrievedAt || ""),
        ) ||
        a.evidenceId.localeCompare(b.evidenceId) ||
        a.sourceUrl.localeCompare(b.sourceUrl),
    );
    if (
      rows.some(
        (row) =>
          row.amount !== rows[0].amount || row.soldTime !== rows[0].soldTime,
      )
    ) {
      rows.forEach((row) => reject(row, "conflicting_duplicate"));
      continue;
    }
    distinct.push(rows[0]);
    rows.slice(1).forEach((row) => reject(row, "duplicate_transaction"));
  }
  distinct.sort((a, b) => a.transactionKey.localeCompare(b.transactionKey));
  const reviewed = reviewComparableOutliers(distinct);
  const contributors = reviewed.filter((row) => !row.outlierReview.flagged);
  reviewed
    .filter((row) => row.outlierReview.flagged)
    .forEach((row) => reject(row, "robust_price_outlier"));
  const amounts = contributors.map((row) => row.amount).sort((a, b) => a - b);
  const estimate = amounts.length >= 3 ? median(amounts) : null;
  const newest = contributors.reduce(
    (latest, row) => (!latest || row.soldTime > latest.soldTime ? row : latest),
    null,
  );
  const ageDays = newest ? (now - newest.soldTime) / 86400000 : null;
  const markets = new Set(contributors.map((row) => row.sourceMarket));
  const spread =
    estimate && amounts.length > 1
      ? ((amounts.at(-1) - amounts[0]) / estimate) * 100
      : null;
  const level =
    estimate === null
      ? "insufficient"
      : ageDays > 30
        ? "stale"
        : options.hasMore === true
          ? "limited"
          : amounts.length >= 7 && markets.size >= 2 && spread <= 15
            ? "strong"
            : amounts.length >= 5 && markets.size >= 2 && spread <= 30
              ? "moderate"
              : "limited";
  excluded.sort(
    (a, b) => a.id.localeCompare(b.id) || a.reason.localeCompare(b.reason),
  );
  return {
    ruleVersion: EXACT_SOLD_RULE_VERSION,
    status:
      options.providerStatus === "error"
        ? "refresh_failed"
        : estimate === null
          ? "insufficient"
          : ageDays > 30
            ? "stale"
            : "ready",
    estimate,
    currency,
    evaluatedAt,
    evidence: reviewed.map(({ soldTime, ...row }) => row),
    contributingEvidenceIds: contributors.map((row) => row.transactionKey),
    excluded,
    distinctSaleCount: contributors.length,
    sourceMarketCount: markets.size,
    newestSoldAt: newest?.soldAt || null,
    newestRetrievedAt:
      contributors
        .map((row) => row.retrievedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ||
      options.retrievedAt ||
      null,
    rangeLow: amounts[0] ?? null,
    rangeHigh: amounts.at(-1) ?? null,
    medianBeforeOutliers: median(distinct.map((row) => row.amount)),
    medianAfterOutliers: median(amounts),
    confidence: {
      level,
      factors: [
        `${contributors.length}_sales`,
        `${markets.size}_markets`,
        ageDays === null
          ? "no_sale_date"
          : ageDays > 30
            ? "older_than_30_days"
            : "within_30_days",
        spread === null ? "no_range" : `range_${Math.round(spread)}_percent`,
        ...(options.hasMore === true ? ["recent_sample_truncated"] : []),
      ],
    },
    hasMore: options.hasMore === true,
  };
}
