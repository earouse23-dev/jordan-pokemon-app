import {
  fetchPkmnPricesSealedProduct,
  fetchPkmnPricesSealedSearch,
} from "../lib/providers/pkmnprices.js";

const SAFE_QUERY = /^[\p{L}\p{N} .:'&+\-/()#]{2,100}$/u;
const windows = new Map();

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

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

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed" });
  }
  if (isRateLimited(request))
    return send(
      response,
      429,
      { error: "Too many sealed-product requests. Try again shortly." },
      { "Retry-After": "60" },
    );
  const id = String(request.query?.id || "").trim();
  const query = String(request.query?.q || "").trim();
  const language = String(request.query?.language || "en").toLowerCase();
  if (!/^\d{1,12}$/.test(id) && !SAFE_QUERY.test(query))
    return send(response, 400, {
      error: "Provide a sealed product ID or a search of 2 to 100 characters.",
    });
  if (!new Set(["en", "ja", "jp"]).has(language))
    return send(response, 400, { error: "Choose English or Japanese." });
  const apiKey = process.env.PKMNPRICES_API_KEY;
  if (!apiKey)
    return send(response, 503, {
      error: "Sealed-product data is ready but PkmnPrices is not configured.",
      code: "provider_unconfigured",
      provider: "pkmnprices",
    });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    if (id) {
      const product = await fetchPkmnPricesSealedProduct(
        apiKey,
        id,
        controller.signal,
      );
      return send(
        response,
        200,
        { product, retrievedAt: new Date().toISOString() },
        {
          "Cache-Control": "s-maxage=900, stale-while-revalidate=3600",
          "CDN-Cache-Control": "max-age=900",
        },
      );
    }
    const products = await fetchPkmnPricesSealedSearch(
      apiKey,
      query,
      language,
      controller.signal,
      12,
    );
    return send(
      response,
      200,
      { products, retrievedAt: new Date().toISOString() },
      {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        "CDN-Cache-Control": "max-age=3600",
      },
    );
  } catch (error) {
    console.error("[api/sealed] provider request failed", {
      status: error?.status || null,
      name: error?.name || "Error",
    });
    if (error?.status === 403)
      return send(response, 403, {
        error: "The current PkmnPrices key cannot access sealed products.",
        code: "provider_plan_required",
        provider: "pkmnprices",
      });
    if (error?.status === 404)
      return send(response, 404, { error: "Sealed product not found." });
    const status = error?.status === 429 ? 429 : 502;
    return send(response, status, {
      error:
        status === 429
          ? "The sealed-product provider rate limit was reached."
          : "Sealed-product data is temporarily unavailable.",
      code: status === 429 ? "provider_rate_limited" : "provider_unavailable",
      provider: "pkmnprices",
    });
  } finally {
    clearTimeout(timeout);
  }
}
