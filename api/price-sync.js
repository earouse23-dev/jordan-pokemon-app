import { createClient } from "@supabase/supabase-js";
import { normalizeRawCondition } from "../lib/domain.js";
import { serverEnvironment, validateServerEnvironment } from "../lib/env.js";
import {
  fetchPkmnPricesLookup,
  normalizePkmnPricesCard,
} from "../lib/providers/pkmnprices.js";

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
}
function observationRow(item, quote) {
  const graded = Boolean(quote.gradingCompany);
  const amount = Number(quote.amount);
  const priceField =
    {
      market: "market_price",
      average: "price_mid",
      low: "price_low",
      high: "price_high",
    }[quote.priceType] || "market_price";
  return {
    card_id: item.card_id,
    card_variant_id: item.variant_id || null,
    provider: quote.quality?.aggregator || quote.provider,
    market: quote.provider,
    currency: quote.currency,
    valuation_type:
      quote.priceType === "average"
        ? "average_sale"
        : quote.priceType === "high"
          ? "high"
          : quote.priceType === "low"
            ? "low"
            : "market",
    card_state: graded ? "graded" : "raw",
    raw_condition: graded
      ? null
      : normalizeRawCondition(quote.condition).normalized,
    provider_condition: quote.condition || null,
    grader: graded ? String(quote.gradingCompany).toUpperCase() : null,
    grade: graded ? Number(quote.grade) : null,
    grade_label: graded ? String(quote.grade) : null,
    [priceField]: amount,
    sample_size: quote.quality?.sampleSize || null,
    confidence_score: quote.quality?.confidence || null,
    observed_at: quote.observedAt || quote.retrievedAt,
    provider_updated_at: quote.observedAt || null,
    source_url: quote.providerUrl || null,
    raw_provider_payload: {
      providerVariantId: quote.providerVariantId,
      printing: quote.printing,
      quality: quote.quality,
    },
    created_at: new Date().toISOString(),
  };
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "Method not allowed" });
  }
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  const validation = validateServerEnvironment(config, {
    pricing: true,
    sync: true,
  });
  if (!validation.valid)
    return send(response, 503, {
      error: "Price sync is not configured",
      missing: validation.missing,
    });
  const database = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authorization = String(request.headers.authorization || "");
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (request.method === "GET") {
    if (bearerToken !== config.syncSecret)
      return send(response, 401, { error: "Unauthorized" });
  } else {
    if (!bearerToken)
      return send(response, 401, { error: "Authentication required" });
    const { data: identity, error: identityError } =
      await database.auth.getUser(bearerToken);
    if (identityError || !identity.user)
      return send(response, 401, { error: "Authentication required" });
    if (identity.user.app_metadata?.role !== "admin")
      return send(response, 403, { error: "Administrator access required" });
  }
  const startedAt = new Date().toISOString();
  await database
    .from("provider_sync_status")
    .upsert({ provider: "pkmnprices", enabled: true, updated_at: startedAt });
  const { data: items, error } = await database
    .from("collection_items")
    .select(
      "id,card_id,variant_id,identity_snapshot,card_state,raw_condition,grader,grade",
    )
    .eq("status", "owned")
    .not("card_id", "is", null)
    .limit(25);
  if (error)
    return send(response, 500, { error: "Could not load tracked positions" });
  const unique = [
    ...new Map((items || []).map((item) => [item.card_id, item])).values(),
  ];
  let inserted = 0,
    duplicates = 0,
    failures = 0;
  for (const item of unique) {
    const identity = item.identity_snapshot || {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const result = await fetchPkmnPricesLookup(
        config.pkmnpricesApiKey,
        {
          clientId: item.card_id,
          pkmnpricesId: identity.externalIds?.pkmnprices,
          name: identity.name,
          set: identity.set,
          number: identity.number,
        },
        controller.signal,
      );
      if (!result.card) {
        failures += 1;
        continue;
      }
      const normalized = normalizePkmnPricesCard(
        result.card,
        result.history,
        new Date().toISOString(),
        item.card_id,
        result.historyStatus,
      );
      for (const quote of normalized.quotes) {
        const row = observationRow(item, quote);
        if (
          !(
            Number(
              row.market_price ??
                row.price_mid ??
                row.price_low ??
                row.price_high,
            ) > 0
          )
        )
          continue;
        const saved = await database.from("price_observations").insert(row);
        if (saved.error?.code === "23505") duplicates += 1;
        else if (saved.error) failures += 1;
        else inserted += 1;
      }
    } catch {
      failures += 1;
    } finally {
      clearTimeout(timeout);
    }
  }
  const finishedAt = new Date().toISOString();
  await database.from("provider_sync_status").upsert({
    provider: "pkmnprices",
    enabled: true,
    last_success_at: failures === unique.length ? null : finishedAt,
    last_failure_at: failures ? finishedAt : null,
    last_error_code: failures ? "partial_failure" : null,
    updated_at: finishedAt,
  });
  return send(response, 200, {
    ok: true,
    trackedCards: unique.length,
    inserted,
    duplicates,
    failures,
    startedAt,
    finishedAt,
  });
}
