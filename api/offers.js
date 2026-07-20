import { fetchPkmnPricesOffers } from "../lib/providers/pkmnprices.js";

const SAFE_TEXT = /^[\p{L}\p{N} .:'&+\-/()#]{1,120}$/u;
const windows = new Map();

function isRateLimited(request) {
  const forwarded = String(request.headers?.["x-forwarded-for"] || "")
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
  return current.count > 20;
}

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

function parseLookup(request) {
  let raw;
  try {
    raw = JSON.parse(String(request.query?.lookup || "{}"));
  } catch {
    return null;
  }
  const lookup = {
    clientId: String(raw?.clientId || "").trim(),
    pkmnpricesId: String(raw?.pkmnpricesId || "").trim(),
    tcgplayerId: String(raw?.tcgplayerId || "").trim(),
    name: String(raw?.name || "").trim(),
    set: String(raw?.set || "").trim(),
    number: String(raw?.number || "").trim(),
    language: String(raw?.language || "en").trim().toLowerCase(),
    condition: String(raw?.condition || "").trim(),
    variant: String(raw?.variant || "Normal").trim(),
  };
  const direct =
    /^\d{1,12}$/.test(lookup.pkmnpricesId) ||
    /^\d{1,12}$/.test(lookup.tcgplayerId);
  const search =
    SAFE_TEXT.test(lookup.name) &&
    (!lookup.set || SAFE_TEXT.test(lookup.set)) &&
    (!lookup.number || SAFE_TEXT.test(lookup.number));
  const filters =
    /^[a-z-]{2,8}$/.test(lookup.language) &&
    (!lookup.condition || SAFE_TEXT.test(lookup.condition)) &&
    SAFE_TEXT.test(lookup.variant);
  return lookup.clientId && filters && (direct || search) ? lookup : null;
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
      { error: "Too many marketplace requests. Try again shortly." },
      { "Retry-After": "60" },
    );
  const lookup = parseLookup(request);
  if (!lookup)
    return send(response, 400, { error: "Provide one valid card lookup." });
  const apiKey = process.env.PKMNPRICES_API_KEY;
  if (!apiKey)
    return send(response, 503, {
      error: "Live marketplace offers are not configured.",
      provider: "pkmnprices",
    });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const result = await fetchPkmnPricesOffers(
      apiKey,
      lookup,
      controller.signal,
    );
    return send(
      response,
      200,
      {
        clientId: lookup.clientId,
        providerCardId: result.cardId,
        offers: result.offers,
        statuses: result.statuses,
        retrievedAt: new Date().toISOString(),
      },
      {
        "Cache-Control": "s-maxage=900, stale-while-revalidate=3600",
        "CDN-Cache-Control": "max-age=900",
      },
    );
  } catch (error) {
    console.error("[api/offers] provider request failed", {
      status: error?.status || null,
      name: error?.name || "Error",
    });
    const status = error?.status === 429 ? 429 : 502;
    return send(response, status, {
      error:
        status === 429
          ? "The marketplace-provider rate limit was reached."
          : "Marketplace offers are temporarily unavailable.",
      code: status === 429 ? "provider_rate_limited" : "provider_unavailable",
      provider: "pkmnprices",
    });
  } finally {
    clearTimeout(timeout);
  }
}
