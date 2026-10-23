import { convertIndicative } from "./fx.js";
const DAY = 86_400_000;

// One dated representative per currency, while retaining every validated sale.
export function completedSalePriceHistory(result, previous = null) {
  const ids = new Set(
    result.eligibleEvidenceIds || result.contributingEvidenceIds,
  );
  const sales = result.evidence.filter((sale) => ids.has(sale.transactionKey));
  const sourceKey = JSON.stringify(
    sales
      .map((sale) => [
        sale.transactionKey,
        sale.soldAt,
        sale.amount,
        sale.currency,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  if (
    previous?.version === "daily-median-v1" &&
    previous.sourceKey === sourceKey &&
    Array.isArray(previous.points)
  )
    return previous;
  const days = new Map();
  for (const sale of sales) {
    const recordedAt = `${new Date(sale.soldAt).toISOString().slice(0, 10)}T00:00:00Z`;
    const key = `${sale.currency}|${recordedAt}`;
    if (!days.has(key)) days.set(key, []);
    days.get(key).push({
      recordedAt: sale.soldAt,
      amount: sale.amount,
      currency: sale.currency,
      providerVariantId: sale.transactionKey,
    });
  }
  const points = [...days.values()]
    .map((observations) => {
      observations.sort(
        (a, b) =>
          a.recordedAt.localeCompare(b.recordedAt) ||
          b.providerVariantId.localeCompare(a.providerVariantId),
      );
      const values = observations
        .map((point) => point.amount)
        .sort((a, b) => a - b);
      const middle = Math.floor(observations.length / 2);
      const median =
        values.length % 2
          ? values[middle]
          : (values[middle - 1] + values[middle]) / 2;
      return {
        recordedAt: `${new Date(observations[0].recordedAt).toISOString().slice(0, 10)}T00:00:00Z`,
        amount: median,
        currency: observations[0].currency,
        low: values[0],
        high: values.at(-1),
        saleCount: observations.length,
        provider: "eBay daily median",
        granularity: "daily_median",
        saleIds: observations.map((point) => point.providerVariantId),
      };
    })
    .sort(
      (a, b) =>
        a.recordedAt.localeCompare(b.recordedAt) ||
        a.currency.localeCompare(b.currency),
    );
  return { version: "daily-median-v1", sourceKey, points };
}

// Re-express recorded prices at one dated reference rate; never invent historical FX.
export function displayHistoryCurrency(model, currency, rate, now = Date.now()) {
  const factor = convertIndicative(1, model.currency, currency, rate, now);
  // Keep recorded native amounts visible when optional display conversion fails.
  if (factor === null) return { ...model, nativeCurrency: model.currency, rateRef: null, conversionUnavailable: true, points: model.points.map(point => ({ ...point, nativeAmount: point.amount, nativeCurrency: model.currency })), observations: (model.observations || []).map(point => ({ ...point, nativeAmount: point.amount, nativeCurrency: model.currency })) };
  const convert = value => value === null || value === undefined || factor === null ? null : value * factor;
  return {
    ...model,
    currency,
    nativeCurrency: model.currency,
    rateRef: model.currency !== currency && factor !== null ? rate.rateRef : null,
    conversionUnavailable: factor === null,
    points: factor === null ? [] : model.points.map(point => ({ ...point, nativeAmount: point.amount, nativeCurrency: model.currency, amount: convert(point.amount), low: convert(point.low), high: convert(point.high) })),
    observations: (model.observations || []).map(point => ({ ...point, nativeAmount: point.amount, nativeCurrency: model.currency, amount: convert(point.amount) })),
    purchases: factor === null ? [] : model.purchases.map(point => ({ ...point, y: convert(point.y) })),
    basis: convert(model.basis),
    summary: { ...model.summary, average: convert(model.summary.average), low: convert(model.summary.low), high: convert(model.summary.high), change: convert(model.summary.change), days: factor === null ? 0 : model.summary.days, changePercent: factor === null ? null : model.summary.changePercent },
  };
}
const ranges = { "1d": 1, "1w": 7, "1m": 31, "3m": 93, "6m": 186, "1y": 366 };

function timestamp(value) {
  if (typeof value !== "string") return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!match) return NaN;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (date.toISOString().slice(0, 10) !== value.slice(0, 10)) return NaN;
  return Date.parse(value);
}

function amount(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    typeof value === "boolean"
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

// Receives an already matched provider series; never fills missing dates/prices.
export function cardPriceHistoryWindow(
  item,
  history,
  range = "all",
  now = Date.now(),
) {
  const selectedRange = Object.hasOwn(ranges, range) ? range : "all";
  const cutoff =
    selectedRange === "all" ? -Infinity : now - ranges[selectedRange] * DAY;
  const currency = item.currency || "USD";
  const points = history
    .flatMap((point) => {
      const x = timestamp(point.recordedAt);
      const y = amount(point.amount);
      if (
        !Number.isFinite(x) ||
        x < (point.granularity === "daily_median" ? Math.floor(cutoff / DAY) * DAY : cutoff) ||
        x > now ||
        y === null ||
        point.currency !== currency
      )
        return [];
      return [{ ...point, x, amount: y }];
    })
    .sort((left, right) => left.x - right.x);
  const purchases = (item.transactions || [])
    .flatMap((transaction) => {
      const x = timestamp(transaction.date);
      const total = amount(transaction.totalCost);
      const quantity = Number(transaction.quantity);
      if (
        transaction.type !== "purchase" ||
        transaction.currency !== currency ||
        transaction.costBasisKnown === false ||
        transaction.acquisitionCostKnown === false ||
        transaction.acquisitionDateKnown === false ||
        !Number.isFinite(x) ||
        x < cutoff ||
        x > now ||
        total === null ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      )
        return [];
      return [{ x, y: total / quantity, transaction }];
    })
    .sort((left, right) => left.x - right.x);
  const values = points.map((point) => point.amount);
  const observations = points.flatMap(point => point.observations || []).map(point => ({ ...point, x: timestamp(point.recordedAt) })).filter(point => Number.isFinite(point.x) && point.x <= now && point.currency === currency);
  const bounds = points
    .flatMap((point) => [point.amount, amount(point.low), amount(point.high)])
    .filter((value) => value !== null);
  const first = points[0];
  const last = points.at(-1);
  const paid = amount(item.costBasis);
  const quantity = Number(item.quantity);
  const knownLots = (item.lots || [])
    .filter((lot) => Number(lot.quantityRemaining) > 0)
    .every(
      (lot) =>
        lot.costBasisKnown !== false &&
        (!lot.currency || lot.currency === currency),
    );
  const basis =
    paid !== null && quantity > 0 && Number.isFinite(quantity) && knownLots
      ? paid / quantity
      : null;
  // Ownership dates belong to the portfolio, not the card's market-history axis.
  const earliest = first?.x ?? now;
  const end = selectedRange === "all" ? (last?.x ?? now) : now;
  const start =
    selectedRange === "all"
      ? Math.min(earliest, end - (earliest === end ? DAY : 0))
      : first
        ? Math.min(earliest, end - DAY)
        : cutoff;
  return {
    range: selectedRange,
    currency,
    points,
    observations,
    purchases,
    basis,
    start,
    end,
    summary: {
      average: values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null,
      low: bounds.length ? Math.min(...bounds) : null,
      high: bounds.length ? Math.max(...bounds) : null,
      days: new Set(
        points.map((point) => new Date(point.x).toISOString().slice(0, 10)),
      ).size,
      change: points.length >= 2 ? last.amount - first.amount : null,
      changePercent:
        points.length >= 2 && first.amount > 0
          ? ((last.amount - first.amount) / first.amount) * 100
          : null,
    },
  };
}
