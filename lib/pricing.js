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
      timestamp: point?.recordedAt
        ? new Date(point.recordedAt).getTime()
        : NaN,
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
  const baseline = eligible.filter(
    (observation) => observation.timestamp <= cutoff,
  ).at(-1);
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
