import { RAW_CONDITIONS } from "../lib/domain.js";
import { pkmnPricesRequests } from "../lib/pkmnprices-requests.js";
import { withNativeCors } from "../lib/native-cors.js";
import {
  fetchJustTcgLookup,
  normalizeJustTcgCard,
} from "../lib/providers/justtcg.js";
import {
  fetchPkmnPricesLookup,
  normalizePkmnPricesCard,
} from "../lib/providers/pkmnprices.js";
import {
  fetchTcgdexPricingLookup,
  normalizeTcgdexPricingCard,
} from "../lib/providers/tcgdex.js";

const windows = new Map();
const SAFE_TEXT = /^[\p{L}\p{N} .:'&+\-/()#]{1,120}$/u;
const PROVIDER_TIMEOUT_MS = Object.freeze({
  pkmnprices: 45_000,
  justtcg: 2_000,
  tcgdex: 2_000,
});

async function settleProviderTier(items, timeoutMs, operation) {
  if (!items.length) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.allSettled(
      items.map((item) => operation(item, controller.signal)),
    );
  } finally {
    clearTimeout(timeout);
  }
}

function isRateLimited(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const key = forwarded || request.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    windows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  if (windows.size > 1000) {
    for (const [entry, value] of windows)
      if (now - value.startedAt >= 60_000) windows.delete(entry);
  }
  return current.count > 15;
}

function send(response, status, body, headers = {}) {
  response.setHeader("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

function parseLookups(request) {
  let input;
  try {
    input = JSON.parse(String(request.query.lookups || "[]"));
  } catch {
    return null;
  }
  if (!Array.isArray(input) || !input.length || input.length > 8) return null;
  const seen = new Set();
  const lookups = [];
  for (const raw of input) {
    const lookup = {
      clientId: String(raw?.clientId || "").trim(),
      pkmnpricesId: String(raw?.pkmnpricesId || "").trim(),
      justtcgId: String(raw?.justtcgId || "").trim(),
      tcgplayerId: String(raw?.tcgplayerId || "").trim(),
      tcgdexId: String(raw?.tcgdexId || "").trim(),
      name: String(raw?.name || "").trim(),
      set: String(raw?.set || "").trim(),
      number: String(raw?.number || "").trim(),
      variant: String(raw?.variant || "").trim(),
      condition: RAW_CONDITIONS.includes(raw?.condition) && raw.condition !== "unknown"
        ? raw.condition.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
        : String(raw?.condition || "").trim(),
      currency: String(raw?.currency || "").toUpperCase(),
      language: String(raw?.language || "en")
        .trim()
        .toLowerCase(),
    };
    if (lookup.currency && !["USD", "EUR"].includes(lookup.currency)) return null;
    if (!lookup.clientId || seen.has(lookup.clientId)) continue;
    if (
      (lookup.variant && !SAFE_TEXT.test(lookup.variant)) ||
      (lookup.condition && !SAFE_TEXT.test(lookup.condition))
    )
      return null;
    const hasDirectId =
      /^\d{1,12}$/.test(lookup.pkmnpricesId) ||
      /^[A-Za-z0-9-]{1,100}$/.test(lookup.justtcgId) ||
      /^\d{1,12}$/.test(lookup.tcgplayerId) ||
      /^[A-Za-z0-9.-]+-[A-Za-z0-9.-]+$/.test(lookup.tcgdexId);
    const hasSearch =
      SAFE_TEXT.test(lookup.name) &&
      (!lookup.set || SAFE_TEXT.test(lookup.set)) &&
      (!lookup.number || SAFE_TEXT.test(lookup.number));
    if (!hasDirectId && !hasSearch) return null;
    seen.add(lookup.clientId);
    lookups.push(lookup);
  }
  return lookups.length ? lookups : null;
}

export async function retainedHandler(request, response, publicOnly = false, proOnly = false) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed" });
  }
  if (isRateLimited(request))
    return send(
      response,
      429,
      { error: "Too many pricing requests. Try again shortly." },
      { "Retry-After": "60" },
    );

  const lookups = parseLookups(request);
  if (!lookups)
    return send(response, 400, { error: "Provide 1 to 8 valid card lookups." });

  // The shipping wrapper enables the verified Pro integration, not other paid adapters.
  const pkmnPricesKey = publicOnly
    ? ""
    : process.env.PKMNPRICES_API_KEY ||
      (process.env.PRICING_PROVIDER === "pkmnprices"
        ? process.env.PRICING_PROVIDER_API_KEY
        : "");
  if (
    pkmnPricesKey &&
    !(await pkmnPricesRequests.authenticate(request, response))
  )
    return;
  const justTcgApproved =
    String(
      process.env.JUSTTCG_COMMERCIAL_LICENSE_APPROVED || "",
    ).toLowerCase() === "true";
  const justTcgKey =
    publicOnly || proOnly || !justTcgApproved
      ? ""
      : process.env.JUSTTCG_API_KEY ||
        (process.env.PRICING_PROVIDER === "justtcg"
          ? process.env.PRICING_PROVIDER_API_KEY
          : "");
  const configuredPlan = String(
    process.env.PKMNPRICES_PLAN || "free",
  ).toLowerCase();
  const pkmnPricesPlan = ["free", "pro", "business"].includes(configuredPlan)
    ? configuredPlan
    : "free";
  const proHistory = ["pro", "business"].includes(pkmnPricesPlan);
  const fullHistory = String(request.query?.history || "") === "full";

  const retrievedAt = new Date().toISOString();
  try {
    const cardsByClientId = new Map();
    const providers = new Set();
    if (pkmnPricesKey) {
      const primary = await settleProviderTier(
        lookups,
        PROVIDER_TIMEOUT_MS.pkmnprices,
        (lookup, signal) =>
          fetchPkmnPricesLookup(pkmnPricesKey, lookup, signal, {
            includeHistory: fullHistory,
            historyPeriod: proHistory ? "365d" : "90d",
            historyLimit: proHistory ? 365 : 90,
            includeEur: proHistory,
            includeEurHistory: fullHistory && proHistory,
            currencies: fullHistory && lookup.currency ? [lookup.currency.toLowerCase()] : undefined,
          }),
      );
      // A local allowance failure is not a missing card or an upstream outage.
      if (primary.length && primary.every(result => result.status === "rejected" && result.reason?.status === 429)) {
        const daily = primary.some(result => result.reason?.code === "provider_daily_budget_reached");
        return send(response, 429, { error: daily ? "Today's pricing allowance is exhausted." : "The pricing request limit was reached.", code: daily ? "provider_daily_budget_reached" : "provider_rate_limited" });
      }
      primary.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value.card) return;
        const card = normalizePkmnPricesCard(
          result.value.card,
          result.value.history,
          retrievedAt,
          lookups[index].clientId,
          result.value.historyStatus,
          { eur: result.value.eurStatus },
        );
        cardsByClientId.set(card.providerCardId, card);
        providers.add("pkmnprices");
      });
    }
    if (justTcgKey) {
      const justTcgFallbacks = lookups.filter(
        (lookup) => !cardsByClientId.has(lookup.clientId),
      );
      const fallback = await settleProviderTier(
        justTcgFallbacks,
        PROVIDER_TIMEOUT_MS.justtcg,
        (lookup, signal) => fetchJustTcgLookup(justTcgKey, lookup, signal),
      );
      fallback.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value.card) return;
        const card = normalizeJustTcgCard(
          result.value.card,
          retrievedAt,
          justTcgFallbacks[index].clientId,
        );
        cardsByClientId.set(card.providerCardId, card);
        providers.add("justtcg");
      });
    }
    const fallbacks = lookups.filter(
      (lookup) => !cardsByClientId.has(lookup.clientId),
    );
    const fallbackResults = await settleProviderTier(
      fallbacks,
      PROVIDER_TIMEOUT_MS.tcgdex,
      (lookup, signal) => fetchTcgdexPricingLookup(lookup, signal),
    );
    fallbackResults.forEach((result, index) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const card = normalizeTcgdexPricingCard(
        result.value,
        retrievedAt,
        fallbacks[index].clientId,
      );
      cardsByClientId.set(card.providerCardId, card);
      providers.add("tcgdex");
    });
    const cards = [...cardsByClientId.values()];
    const unavailable = lookups
      .filter((lookup) => !cardsByClientId.has(lookup.clientId))
      .map((lookup) => lookup.clientId);
    if (!cards.length)
      return send(response, 502, {
        error: "No pricing provider responded.",
        providers: ["pkmnprices", "justtcg", "tcgdex"],
        unavailable,
      });
    return send(
      response,
      200,
      {
        cards,
        unavailable,
        retrievedAt,
        providers: [...providers],
        partial: unavailable.length > 0,
        capabilities: {
          pkmnprices: {
            declaredPlan: pkmnPricesPlan,
            authority: "runtime_endpoint_response",
            requestedHistoryPeriod: fullHistory
              ? proHistory
                ? "365d"
                : "90d"
              : null,
            requestedLanguages: proHistory ? ["en", "ja", "de"] : ["en"],
            requestedCurrencies: proHistory ? ["USD", "EUR"] : ["USD"],
          },
        },
      },
      {
        "Cache-Control": pkmnPricesKey
          ? "no-store"
          : "s-maxage=900, stale-while-revalidate=3600",
        "CDN-Cache-Control": pkmnPricesKey ? "no-store" : "max-age=900",
      },
    );
  } catch (error) {
    console.error("[api/cards] provider request errored", {
      name: error?.name || "Error",
    });
    return send(response, 502, {
      error: "The pricing providers did not respond in time.",
      providers: ["pkmnprices", "justtcg", "tcgdex"],
    });
  }
}

export default withNativeCors(
  (request, response) => retainedHandler(request, response, false, true),
  ["GET"],
);
