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
        providerUrl: card.tcgplayer.url || null,
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
      providerUrl: card.cardmarket.url || null,
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
  const finish = finishForVariant(variant);
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
  for (const provider of ["justtcg", "tcgplayer"]) {
    const fromProvider = compatible.filter(
      (quote) => quote.provider === provider,
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
  const finish = finishForVariant(variant);
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
    if (quote.gradingCompany) return false;
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
