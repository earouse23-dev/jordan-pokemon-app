import { loadEnvFile } from "node:process";

try {
  loadEnvFile(new URL("../.env", import.meta.url));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const apiKey = process.env.PKMNPRICES_API_KEY;
const baseUrl = "https://api.pkmnprices.com";
const results = [];

function result(feature, status, detail, response = null) {
  results.push({
    feature,
    status,
    detail,
    creditsCharged: response?.headers.get("x-credits-charged") || null,
    creditsLimit: response?.headers.get("x-credits-limit") || null,
    rateRemaining: response?.headers.get("x-rate-remaining") || null,
  });
}

async function probe(feature, path, { authenticated = true } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        ...(authenticated ? { "X-API-Key": apiKey } : {}),
      },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      result(feature, "verified", "Live request succeeded.", response);
      return body;
    }
    const providerMessage = String(body?.error?.message || "").slice(0, 160);
    if (response.status === 403) {
      result(
        feature,
        "plan_required",
        providerMessage ||
          "The connected account does not permit this feature.",
        response,
      );
      return null;
    }
    if (response.status === 401) {
      result(
        feature,
        "invalid_key",
        "The provider rejected PKMNPRICES_API_KEY.",
        response,
      );
      return null;
    }
    result(
      feature,
      "failed",
      `Provider returned HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : "."}`,
      response,
    );
    return null;
  } catch (error) {
    result(
      feature,
      "failed",
      error?.name === "AbortError"
        ? "Request timed out after 8 seconds."
        : "Provider could not be reached.",
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

await probe("provider_health", "/health", { authenticated: false });

if (!apiKey) {
  result(
    "authentication",
    "setup_required",
    "Set PKMNPRICES_API_KEY in a private .env file or the deployment environment.",
  );
} else {
  const search = await probe(
    "english_catalog",
    "/v1/cards?name=Mew%20ex&number=151&per_page=1",
  );
  const cardId = Array.isArray(search?.data) ? search.data[0]?.id : null;
  if (!cardId) {
    result(
      "exact_card",
      "failed",
      "The smoke-test card could not be resolved, so card-specific checks were skipped.",
    );
  } else {
    await probe("current_usd_prices", `/v1/cards/${cardId}?currency=usd`);
    await probe("cardmarket_eur_prices", `/v1/cards/${cardId}?currency=eur`);
    await probe(
      "price_history",
      `/v1/cards/${cardId}/prices/history?period=1d&limit=1`,
    );
    await probe(
      "ebay_sold_listings",
      `/v1/cards/${cardId}/listings/ebay?limit=1`,
    );
    await probe(
      "tcgplayer_offers",
      `/v1/cards/${cardId}/listings/tcgplayer?limit=1`,
    );
    await probe(
      "cardmarket_offers",
      `/v1/cards/${cardId}/listings/cardmarket?limit=1`,
    );
  }

  const sealed = await probe(
    "sealed_catalog",
    "/v1/sealed?name=Elite%20Trainer%20Box&per_page=1",
  );
  const sealedId = Array.isArray(sealed?.data) ? sealed.data[0]?.id : null;
  if (sealedId) {
    await probe("sealed_prices", `/v1/sealed/${sealedId}?currency=usd`);
  }
}

const failed = results.some((entry) =>
  ["failed", "invalid_key", "setup_required"].includes(entry.status),
);
const planLimited = results.some((entry) => entry.status === "plan_required");
const summary = {
  checkedAt: new Date().toISOString(),
  declaredPlan: String(process.env.PKMNPRICES_PLAN || "free").toLowerCase(),
  overall: failed ? "failed" : planLimited ? "upgrade_required" : "verified",
  note: "No API key value or provider response payload is printed.",
  results,
};

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  process.stdout.write(`PkmnPrices readiness: ${summary.overall}\n`);
  for (const entry of results) {
    process.stdout.write(
      `${entry.status.padEnd(15)} ${entry.feature.padEnd(24)} ${entry.detail}\n`,
    );
  }
}

if (failed) process.exitCode = 1;
