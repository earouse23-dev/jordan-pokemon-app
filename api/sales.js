import { releaseHold } from "../lib/release-hold.js";
import { withNativeCors } from "../lib/native-cors.js";
import { fetchPkmnPricesSales } from "../lib/providers/pkmnprices.js";
import { serverEnvironment } from "../lib/env.js";

const SAFE_TEXT = /^[\p{L}\p{N} .:'&+\-/()#]{1,120}$/u;

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

function requestParameter(request, name) {
  if (request.url) {
    try {
      return new URL(request.url, "https://mica.local").searchParams.get(name);
    } catch {
      // Fall through to the test/dev request shape.
    }
  }
  const value = request.query?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseLookup(request) {
  let raw;
  try {
    raw = JSON.parse(String(requestParameter(request, "lookup") || "{}"));
  } catch {
    return null;
  }
  const lookup = {
    clientId: String(raw?.clientId || "").trim(),
    pkmnpricesId: String(raw?.pkmnpricesId || "").trim(),
    name: String(raw?.name || "").trim(),
    set: String(raw?.set || "").trim(),
    number: String(raw?.number || "").trim(),
    language: String(raw?.language || "en")
      .trim()
      .toLowerCase(),
    grader: String(raw?.grader || "")
      .trim()
      .toUpperCase(),
    grade: String(raw?.grade || "").trim(),
    variant: String(raw?.variant || "").trim(),
    finish: String(raw?.finish || "").trim(),
    edition: String(raw?.edition || "").trim(),
    promoType: String(raw?.promoType || "").trim(),
    currency: String(raw?.currency || "")
      .trim()
      .toUpperCase(),
    gradeQualifier: String(raw?.gradeQualifier || "").trim(),
  };
  const direct = /^\d{1,12}$/.test(lookup.pkmnpricesId);
  const search =
    SAFE_TEXT.test(lookup.name) &&
    (!lookup.set || SAFE_TEXT.test(lookup.set)) &&
    (!lookup.number || SAFE_TEXT.test(lookup.number));
  const context =
    (!lookup.variant ||
      /^[\p{L}\p{N} .:'&+\-/()#_·]{1,120}$/u.test(lookup.variant)) &&
    (!lookup.gradeQualifier || SAFE_TEXT.test(lookup.gradeQualifier)) &&
    [lookup.finish, lookup.promoType].every(
      (value) => !value || SAFE_TEXT.test(value),
    ) &&
    (!lookup.edition ||
      lookup.edition === "first_edition" ||
      SAFE_TEXT.test(lookup.edition)) &&
    (!lookup.currency || ["USD", "EUR"].includes(lookup.currency)) &&
    (!lookup.grader || /^[A-Z0-9 .-]{1,20}$/.test(lookup.grader)) &&
    (!lookup.grade || /^\d{1,2}(?:\.\d)?$/.test(lookup.grade)) &&
    (!lookup.grade || lookup.grader) &&
    (!lookup.gradeQualifier || lookup.grader);
  return lookup.clientId && context && (direct || search) ? lookup : null;
}

async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed" });
  }
  const lookup = parseLookup(request);
  if (!lookup)
    return send(response, 400, { error: "Provide one valid card lookup." });
  const config = serverEnvironment();
  const apiKey = config.pkmnpricesApiKey;
  if (!apiKey)
    return send(response, 503, {
      error: "Licensed sold-listing data is not configured.",
      code: "provider_unconfigured",
      provider: "pkmnprices",
      capability: "completed_sales",
      capabilityStatus: "unsupported",
    });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const result = await fetchPkmnPricesSales(
      apiKey,
      lookup,
      controller.signal,
    );
    const sales = result.sales;
    return send(
      response,
      200,
      {
        clientId: lookup.clientId,
        providerCardId: result.cardId,
        sales,
        receivedCount: result.receivedCount ?? 0,
        acceptedCount: result.acceptedCount ?? sales.length,
        excludedCount: result.excludedCount || 0,
        upstreamExclusions: result.upstreamExclusions || [],
        exclusions: result.exclusions || {
          normalizationRejected: 0,
          contextMismatch: result.excludedCount || 0,
          canonicalIdentityMismatch: 0,
        },
        hasMore: result.hasMore === true,
        conditionScope: "not_provided",
        validatedContext: result.cardId
          ? {
              ...lookup,
              providerCardId: result.cardId,
              canonicalValidated: true,
              completedSaleValidated: true,
            }
          : null,
        capability: "completed_sales",
        capabilityStatus: sales.length ? "live" : "missing",
        retrievedAt: new Date().toISOString(),
      },
      {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
        "CDN-Cache-Control": "max-age=3600",
      },
    );
  } catch (error) {
    console.error("[api/sales] provider request failed", {
      status: error?.status || null,
      name: error?.name || "Error",
    });
    const providerCode = String(error?.providerCode || "").toLowerCase();
    const providerMessage = String(error?.providerMessage || "").toLowerCase();
    const authenticationRejected =
      error?.status === 401 ||
      providerCode.includes("invalid_key") ||
      providerCode.includes("invalid_api_key") ||
      providerMessage.includes("invalid api key") ||
      providerMessage.includes("api key is invalid");
    if (authenticationRejected) {
      return send(response, 502, {
        error: "The sold-listing provider connection is unavailable.",
        code: "provider_authentication_failed",
        provider: "pkmnprices",
        capability: "completed_sales",
        capabilityStatus: "provider_error",
      });
    }
    if (error?.status === 403) {
      return send(response, 403, {
        error:
          "The current PkmnPrices key does not have access to sold-listing evidence.",
        code: "provider_plan_required",
        provider: "pkmnprices",
        capability: "completed_sales",
        capabilityStatus: "unsupported",
      });
    }
    const status = error?.status === 429 ? 429 : 502;
    return send(response, status, {
      error:
        status === 429
          ? "The sales-provider rate limit was reached."
          : "Sold-listing data is temporarily unavailable.",
      code: status === 429 ? "provider_rate_limited" : "provider_unavailable",
      provider: "pkmnprices",
      capability: "completed_sales",
      capabilityStatus: status === 429 ? "rate_limited" : "provider_error",
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Retained implementation is exercised offline; the shipping export stays held.
export { handler as retainedHandler };
export default withNativeCors(releaseHold, ["GET"]);
