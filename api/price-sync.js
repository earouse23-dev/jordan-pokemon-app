import { createClient } from "@supabase/supabase-js";
import { normalizeRawCondition } from "../lib/domain.js";
import { serverEnvironment, validateServerEnvironment } from "../lib/env.js";
import { finishForVariant, selectReferenceQuote } from "../lib/pricing.js";
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

const POSITION_HISTORY_CONFLICT = [
  "collection_item_id",
  "provider",
  "provider_variant_id",
  "currency",
  "valuation_type",
  "card_state",
  "raw_condition",
  "grader",
  "grade_label",
  "observed_at",
  "amount",
].join(",");

export function compatibleHistory(item, history) {
  const identity = item.identity_snapshot || {};
  const finish = finishForVariant(identity.variant || identity.finish);
  return (history || []).filter((point) => {
    if (point.finish !== finish || point.currency !== item.currency)
      return false;
    if (item.card_state === "graded")
      return (
        String(point.gradingCompany || "").toUpperCase() === item.grader &&
        Number(point.grade) === Number(item.grade)
      );
    return (
      !point.gradingCompany &&
      (!point.condition ||
        normalizeRawCondition(point.condition).normalized ===
          item.raw_condition)
    );
  });
}

export function positionObservationRow(
  item,
  point,
  valuationType = "average_sale",
) {
  const graded = item.card_state === "graded";
  return {
    user_id: item.user_id,
    collection_item_id: item.id,
    aggregator: point.quality?.aggregator || "pkmnprices",
    provider: point.provider,
    provider_variant_id: point.providerVariantId || "",
    currency: point.currency,
    valuation_type: valuationType,
    finish: point.finish,
    card_state: item.card_state,
    raw_condition: item.card_state === "raw" ? item.raw_condition : "",
    provider_condition: point.condition || null,
    grader: graded ? item.grader : "",
    grade: graded ? Number(item.grade) : null,
    grade_label: graded ? String(item.grade) : "",
    amount: Number(point.amount),
    price_low: Number.isFinite(Number(point.low)) ? Number(point.low) : null,
    price_high: Number.isFinite(Number(point.high)) ? Number(point.high) : null,
    sales_count: Number.isFinite(Number(point.saleCount))
      ? Number(point.saleCount)
      : null,
    granularity: point.granularity === "day" ? "day" : "observation",
    quality: point.quality || {},
    observed_at: point.recordedAt || point.observedAt || point.retrievedAt,
  };
}

export function priceSyncLookupKey(item) {
  const identity = item.identity_snapshot || {};
  return JSON.stringify([
    identity.externalIds?.pkmnprices || "",
    identity.externalIds?.tcgplayer || "",
    identity.name || "",
    identity.set || identity.setName || "",
    identity.number || identity.collectorNumber || "",
    identity.language || "en",
  ]);
}

const SYNC_BATCH_SIZE = 50;
const UUID_CURSOR =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function activePositionQuery(database) {
  return database
    .from("collection_items")
    .select(
      "id,user_id,card_id,variant_id,identity_snapshot,card_state,raw_condition,grader,grade,currency",
    )
    .in("status", ["owned", "listed"])
    .neq("card_state", "sealed")
    .order("id", { ascending: true });
}

export async function loadPriceSyncBatch(
  database,
  savedCursor,
  batchSize = SYNC_BATCH_SIZE,
) {
  const limit = Math.min(Math.max(Number(batchSize) || 1, 1), 200);
  const cursor = UUID_CURSOR.test(String(savedCursor || ""))
    ? String(savedCursor)
    : null;
  let primaryQuery = activePositionQuery(database);
  if (cursor) primaryQuery = primaryQuery.gt("id", cursor);
  const primary = await primaryQuery.limit(limit);
  if (primary.error) throw primary.error;
  const items = [...(primary.data || [])];
  let wrapped = false;
  if (cursor && items.length < limit) {
    const beginning = await activePositionQuery(database)
      .lte("id", cursor)
      .limit(limit - items.length);
    if (beginning.error) throw beginning.error;
    const seen = new Set(items.map((item) => item.id));
    for (const item of beginning.data || []) {
      if (!seen.has(item.id)) items.push(item);
    }
    wrapped = (beginning.data || []).length > 0;
  }
  return {
    items,
    wrapped,
    nextCursor: items.at(-1)?.id || cursor,
  };
}

export function positionHistoryRows(position, normalized) {
  const context = {
    condition:
      position.card_state === "raw"
        ? String(position.raw_condition || "")
            .split("_")
            .map((part) => part[0]?.toUpperCase() + part.slice(1))
            .join(" ")
        : null,
    gradingCompany: position.card_state === "graded" ? position.grader : "",
    grade: position.card_state === "graded" ? position.grade : "",
  };
  const variant =
    position.identity_snapshot?.variant ||
    position.identity_snapshot?.finish ||
    "Normal";
  const quote = selectReferenceQuote(
    normalized.quotes,
    variant,
    position.currency,
    context,
  );
  const points = compatibleHistory(position, normalized.history);
  if (quote)
    points.push({
      ...quote,
      recordedAt: quote.observedAt || quote.retrievedAt,
      granularity: "observation",
    });
  const rows = [
    ...new Map(
      points
        .filter(
          (point) =>
            Number(point.amount) > 0 &&
            point.provider &&
            (point.recordedAt || point.observedAt || point.retrievedAt),
        )
        .map((point) => {
          const row = positionObservationRow(
            position,
            point,
            point.granularity === "day"
              ? "average_sale"
              : quote?.priceType === "low"
                ? "low"
                : quote?.priceType === "high"
                  ? "high"
                  : "market",
          );
          return [
            POSITION_HISTORY_CONFLICT.split(",")
              .map((field) => row[field])
              .join("|"),
            row,
          ];
        }),
    ).values(),
  ];
  return { quote, rows };
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
  const cursorResult = await database
    .from("provider_sync_status")
    .select("sync_cursor")
    .eq("provider", "pkmnprices")
    .maybeSingle();
  if (cursorResult.error)
    return send(response, 500, { error: "Could not load pricing cursor" });
  let batch;
  try {
    batch = await loadPriceSyncBatch(database, cursorResult.data?.sync_cursor);
  } catch {
    return send(response, 500, { error: "Could not load tracked positions" });
  }
  const items = batch.items;
  const groups = new Map();
  for (const item of items || []) {
    const key = priceSyncLookupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  let inserted = 0,
    duplicates = 0,
    failures = 0,
    successfulGroups = 0;
  const proHistory = ["pro", "business"].includes(config.pkmnpricesPlan);
  for (const groupedItems of groups.values()) {
    const item = groupedItems[0];
    const identity = item.identity_snapshot || {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const result = await fetchPkmnPricesLookup(
        config.pkmnpricesApiKey,
        {
          clientId: identity.providerCardId || identity.id || item.id,
          pkmnpricesId: identity.externalIds?.pkmnprices,
          tcgplayerId: identity.externalIds?.tcgplayer,
          name: identity.name,
          set: identity.set || identity.setName,
          number: identity.number || identity.collectorNumber,
          language: identity.language || "en",
        },
        controller.signal,
        {
          includeHistory: proHistory,
          historyPeriod: "365d",
          historyLimit: 365,
          includeEur: proHistory,
          includeEurHistory: proHistory,
        },
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
      for (const position of groupedItems) {
        const { quote, rows } = positionHistoryRows(position, normalized);
        for (let start = 0; start < rows.length; start += 200) {
          const batch = rows.slice(start, start + 200);
          const saved = await database
            .from("position_price_observations")
            .upsert(batch, {
              onConflict: POSITION_HISTORY_CONFLICT,
              ignoreDuplicates: true,
            })
            .select("id");
          if (saved.error) failures += 1;
          else {
            inserted += saved.data?.length || 0;
            duplicates += batch.length - (saved.data?.length || 0);
          }
        }
        if (position.card_id && quote) {
          const saved = await database
            .from("price_observations")
            .insert(observationRow(position, quote));
          if (saved.error?.code === "23505") duplicates += 1;
          else if (saved.error) failures += 1;
          else inserted += 1;
        }
      }
      successfulGroups += 1;
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
    last_success_at:
      groups.size === 0 || successfulGroups > 0 ? finishedAt : null,
    last_failure_at: failures ? finishedAt : null,
    last_error_code: failures ? "partial_failure" : null,
    sync_cursor: batch.nextCursor,
    updated_at: finishedAt,
  });
  return send(response, 200, {
    ok: true,
    trackedCards: groups.size,
    trackedPositions: items?.length || 0,
    inserted,
    duplicates,
    failures,
    cursor: batch.nextCursor,
    wrapped: batch.wrapped,
    startedAt,
    finishedAt,
  });
}
