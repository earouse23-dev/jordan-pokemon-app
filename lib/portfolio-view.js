import { convertIndicative } from "./fx.js";
import {
  portfolioProfitLoss,
  portfolioProfitLossHistory,
} from "./portfolio.js";
import {
  finishForVariant,
  selectReferenceQuote,
  mergePriceHistory,
} from "./pricing.js";
import { normalizeRawCondition } from "./domain.js";

export function portfolioCondition(item) {
  const normalized = normalizeRawCondition(
    item.rawCondition || item.condition,
  ).normalized;
  return (
    {
      near_mint: "Near Mint",
      lightly_played: "Lightly Played",
      moderately_played: "Moderately Played",
      heavily_played: "Heavily Played",
      damaged: "Damaged",
    }[normalized] || ""
  );
}
export const PORTFOLIO_VIEW_VERSION = 2;
export function portfolioPricingKey(item) {
  return JSON.stringify([
    item.id,
    item.externalIds?.pkmnprices,
    item.variant,
    item.language,
    item.condition,
    item.rawCondition,
    item.currency,
    item.cardState,
    item.gradingCompany,
    item.grade,
    item.gradeQualifier,
    item.finish,
    item.edition,
    item.promoType,
  ]);
}
export function matchingPortfolioHistory(item) {
  if (item.gradingCompany || item.cardState === "graded")
    return (item.matchedHistory || []).filter(
      (p) =>
        p.verifiedExactSold &&
        p.contextValidated &&
        p.currency === item.currency,
    );
  const quote = selectReferenceQuote(
    item.quotes || [],
    item.variant,
    item.currency,
    { ...item, condition: portfolioCondition(item) },
  );
  const candidates = (item.priceHistory || []).filter(
    (p) =>
      p.currency === item.currency &&
      p.finish ===
        (item.cardState === "sealed"
          ? "sealed"
          : finishForVariant(item.variant)) &&
      !p.gradingCompany &&
      (!p.condition ||
        normalizeRawCondition(p.condition).normalized ===
          normalizeRawCondition(portfolioCondition(item)).normalized),
  );
  const provider =
    quote?.provider || (item.currency === "EUR" ? "cardmarket" : "tcgplayer");
  const preferred = candidates.filter((p) => p.provider === provider);
  // A single market series throughout; do not switch between low/mid/market sources by date.
  return mergePriceHistory(
    preferred.length
      ? preferred
      : candidates.filter((p) => p.provider === candidates[0]?.provider),
  );
}
export function buildPortfolioView(
  items,
  now = new Date().toISOString(),
  { previousView = null, recalculateFrom = null } = {},
) {
  const today = now.slice(0, 10);
  const valued = items.map((item) => ({
    ...item,
    matchedHistory: matchingPortfolioHistory(item),
  }));
  const currencies = [
    ...new Set(
      valued.length ? valued.map((i) => i.currency || "USD") : ["USD"],
    ),
  ];
  const summaries = currencies.map((currency) => {
    const subset = valued.filter((i) => i.currency === currency);
    const total = portfolioProfitLoss(subset, currency);
    // Ownership defines the timeline. Missing market evidence makes a day's
    // total unavailable; it must not remove the holding or shorten All time.
    const historySubset = subset.filter(
      (i) =>
        i.lots?.length && (i.lots || []).every(
          (l) => l.acquiredAt && l.acquisitionDateKnown !== false,
        ),
    );
    const historyTotal = portfolioProfitLoss(historySubset, currency);
    const historyPositions = historySubset
      .map((i) => [i.uid, portfolioPricingKey(i)])
      .sort();
    const previous = previousView?.summaries?.find(
      (s) => s.currency === currency,
    );
    const retain =
      previousView?.version === PORTFOLIO_VIEW_VERSION &&
      previous?.history?.length &&
      !previousView.historyBackfillPending &&
      JSON.stringify(previous.historyPositions) ===
        JSON.stringify(historyPositions);
    const from =
      retain && recalculateFrom !== "0001-01-01"
        ? recalculateFrom ||
          new Date(Date.parse(previousView.updatedAt.slice(0, 10)) + 86_400_000)
            .toISOString()
            .slice(0, 10)
        : null;
    const retained = retain
      ? previous.history.filter((p) => p.date < from && p.date < today)
      : [];
    let history = from
      ? []
      : portfolioProfitLossHistory(historySubset, currency, true).filter(
          (p) => p.date <= today,
        );
    if (from)
      for (
        let day = Date.parse(from);
        day < Date.parse(today);
        day += 86_400_000
      )
        history.push(
          portfolioProfitLoss(
            historySubset,
            currency,
            new Date(day).toISOString().slice(0, 10),
          ),
        );
    const acquired = subset
      .flatMap((i) =>
        (i.lots || [])
          .filter((l) => l.acquisitionDateKnown !== false && l.acquiredAt)
          .map((l) => l.acquiredAt.slice(0, 10)),
      )
      .sort()[0];
    if (acquired) history = history.filter((p) => p.date >= acquired);
    let dated = portfolioProfitLoss(historySubset, currency, today);
    if (
      !dated.unknownMembershipUnits &&
      dated.pricedUnits + dated.missingUnits ===
        historyTotal.pricedUnits + historyTotal.missingUnits &&
      historyTotal.valueComplete
    )
      dated = {
        ...dated,
        valueMinor: historyTotal.valueMinor,
        pricedUnits: historyTotal.pricedUnits,
        missingUnits: 0,
        valueComplete: true,
      };
    if (!from && history.length)
      for (
        let day = Date.parse(history.at(-1).date) + 86_400_000;
        day < Date.parse(today);
        day += 86_400_000
      )
        history.push(
          portfolioProfitLoss(
            historySubset,
            currency,
            new Date(day).toISOString().slice(0, 10),
          ),
        );
    if (history.at(-1)?.date === today) history[history.length - 1] = dated;
    else history.push(dated);
    // Keep missing days as null, never zero or a later price carried backward.
    if (!historySubset.length) history = [];
    return {
      currency,
      historyPositions,
      acquiredAt: acquired || null,
      total: total.valueComplete ? total.valueMinor / 100 : null,
      knownTotal: total.pricedUnits ? total.valueMinor / 100 : null,
      missingUnits: total.missingUnits,
      unknownDates: portfolioProfitLoss(subset, currency, today)
        .unknownMembershipUnits,
      historyExcludedPositions: subset.length - historySubset.length,
      history: [
        ...retained,
        ...history.map((p) => ({
          date: p.date,
          total: p.valueComplete ? p.valueMinor / 100 : null,
          knownTotal: p.pricedUnits ? p.valueMinor / 100 : null,
          pricedItems: p.pricedUnits,
          unpricedItems: p.missingUnits,
        })),
      ],
      historyStartsAt: acquired || retained[0]?.date || history[0]?.date || null,
    };
  });
  return {
    version: PORTFOLIO_VIEW_VERSION,
    updatedAt: now,
    summaries,
    positionValues: valued.map((i) => {
      const p = portfolioProfitLoss([i], i.currency);
      return {
        uid: i.uid,
        quantity: i.quantity,
        currency: i.currency,
        total: p.valueComplete ? p.valueMinor / 100 : null,
      };
    }),
  };
}

// Reuse the app's indicative display conversion; keep all stored source prices native.
export function displayPortfolioView(view, currency, rate, now = Date.now()) {
  if (!view?.summaries?.length) return null;
  const sources = view.summaries;
  if (sources.length === 1 && sources[0].currency === currency)
    return sources[0];
  const factors = sources.map((s) =>
    convertIndicative(1, s.currency, currency, rate, now),
  );
  const result = {
    currency,
    total: null,
    knownTotal: null,
    missingUnits: sources.reduce((n, s) => n + s.missingUnits, 0),
    history: [],
    historyStartsAt: null,
    acquiredAt: sources.map(s => s.acquiredAt).filter(Boolean).sort()[0] || null,
    historyExcludedPositions: sources.reduce(
      (n, s) => n + (s.historyExcludedPositions || 0),
      0,
    ),
    converted: true,
  };
  if (factors.some((f) => f === null))
    return { ...result, fxUnavailable: true };
  const sum = (field) =>
    Math.round(
      sources.reduce((n, s, i) => n + (s[field] || 0) * factors[i], 0) * 100,
    ) / 100;
  result.total = sources.every((s) => s.total !== null) ? sum("total") : null;
  result.knownTotal = sources.some((s) => s.knownTotal !== null)
    ? sum("knownTotal")
    : null;
  const maps = sources.map(
    (s) => new Map(s.history.map((p) => [p.date, p.total])),
  );
  const dates = [
    ...new Set(sources.flatMap((s) => s.history.map((p) => p.date))),
  ].sort();
  const history = dates.map((date) => {
    const values = sources.map((s, i) =>
      s.acquiredAt && date < s.acquiredAt ? 0 : maps[i].get(date),
    );
    return {
      date,
      total: values.every((v) => Number.isFinite(v))
        ? Math.round(values.reduce((n, v, i) => n + v * factors[i], 0) * 100) /
          100
        : null,
    };
  });
  result.history = history;
  result.historyStartsAt = result.history[0]?.date || null;
  return result;
}

export function hasPortfolioValue(view) {
  return Boolean(
    view?.summaries?.some(
      (s) => Number.isFinite(s.total) || Number.isFinite(s.knownTotal),
    ),
  );
}

// The initial paint needs totals/dates, not thousands of underlying sale rows.
export function compactPortfolioView(view) {
  if (!view) return null;
  const { pricing, pendingPricing, inventoryKey, ...display } = view;
  return {
    ...display,
    summaries: (view.summaries || []).map(
      ({ historyPositions, ...summary }) => summary,
    ),
  };
}
