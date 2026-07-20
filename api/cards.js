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
      language: String(raw?.language || "en")
        .trim()
        .toLowerCase(),
    };
    if (!lookup.clientId || seen.has(lookup.clientId)) continue;
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

export default async function handler(request, response) {
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

  const pkmnPricesKey =
    process.env.PKMNPRICES_API_KEY ||
    (process.env.PRICING_PROVIDER === "pkmnprices"
      ? process.env.PRICING_PROVIDER_API_KEY
      : "");
  const justTcgKey =
    process.env.JUSTTCG_API_KEY ||
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  const retrievedAt = new Date().toISOString();
  try {
    const cardsByClientId = new Map();
    const providers = new Set();
    if (pkmnPricesKey) {
      const primary = await Promise.allSettled(
        lookups.map((lookup) =>
          fetchPkmnPricesLookup(pkmnPricesKey, lookup, controller.signal, {
            includeHistory: fullHistory,
            historyPeriod: proHistory ? "365d" : "90d",
            historyLimit: proHistory ? 365 : 90,
            includeEur: proHistory,
            includeEurHistory: fullHistory && proHistory,
          }),
        ),
      );
      primary.forEach((result, index) => {
        if (result.status !== "fulfilled" || !result.value.card) return;
        const card = normalizePkmnPricesCard(
          result.value.card,
          result.value.history,
          retrievedAt,
          lookups[index].clientId,
          result.value.historyStatus,
        );
        cardsByClientId.set(card.providerCardId, card);
        providers.add("pkmnprices");
      });
    }
    if (justTcgKey) {
      const justTcgFallbacks = lookups.filter(
        (lookup) => !cardsByClientId.has(lookup.clientId),
      );
      const fallback = await Promise.allSettled(
        justTcgFallbacks.map((lookup) =>
          fetchJustTcgLookup(justTcgKey, lookup, controller.signal),
        ),
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
    const fallbackResults = await Promise.allSettled(
      fallbacks.map((lookup) =>
        fetchTcgdexPricingLookup(lookup, controller.signal),
      ),
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
            configuredPlan: pkmnPricesPlan,
            requestedHistoryPeriod: fullHistory
              ? proHistory
                ? "365d"
                : "90d"
              : null,
            japaneseRequestsEnabled: proHistory,
            eurRequestsEnabled: proHistory,
          },
        },
      },
      {
        "Cache-Control": "s-maxage=900, stale-while-revalidate=3600",
        "CDN-Cache-Control": "max-age=900",
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
  } finally {
    clearTimeout(timeout);
  }
}
