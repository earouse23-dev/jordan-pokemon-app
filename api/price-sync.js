import { createClient } from "@supabase/supabase-js";
import { normalizeRawCondition } from "../lib/domain.js";
import { serverEnvironment, validateServerEnvironment } from "../lib/env.js";
import {
  PRICE_EVIDENCE_RULE_VERSION,
  finishForVariant,
  priceEvidenceKind,
  priceFreshness,
  selectReferenceQuote,
} from "../lib/pricing.js";
import {
  fetchPkmnPricesLookup,
  normalizePkmnPricesCard,
} from "../lib/providers/pkmnprices.js";

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
}
function observationRow(item, quote) {
  const observedAt =
    quote.providerUpdatedAt || quote.observedAt || quote.soldAt || null;
  if (!observedAt || !Number.isFinite(new Date(observedAt).getTime()))
    return null;
  const graded = Boolean(quote.gradingCompany);
  const amount = Number(quote.amount);
  const freshness = priceFreshness(quote);
  const confidence = Number(quote.quality?.confidence);
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
    aggregator: quote.aggregator || quote.quality?.aggregator || quote.provider,
    market: quote.market || quote.provider,
    source_record_id: quote.providerProductId || null,
    source_variant_id: quote.providerVariantId || null,
    currency: quote.currency,
    region: quote.region || "unknown",
    language: quote.language || "unknown",
    finish: quote.finish || "unknown",
    printing: quote.printing || null,
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
    confidence_score:
      Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
        ? confidence
        : null,
    confidence_reason: {
      direct: quote.quality?.direct === true,
      field: quote.quality?.field || null,
      sampleSize: quote.quality?.sampleSize || null,
    },
    observed_at: observedAt,
    provider_updated_at: quote.providerUpdatedAt || quote.observedAt || null,
    retrieved_at: quote.retrievedAt || new Date().toISOString(),
    expires_at: freshness.expiresAt,
    evidence_kind: priceEvidenceKind(quote),
    derivation: quote.derivation || "aggregated",
    fees_included: quote.feesIncluded === true,
    shipping_included: quote.shippingIncluded === true,
    capability_status: "live",
    exclusion_status: quote.excluded
      ? "excluded"
      : quote.anomalous || quote.outlierReview?.flagged
        ? "flagged"
        : "included",
    exclusion_reason:
      quote.exclusionReason || quote.outlierReview?.reason || null,
    evidence_rule_version: PRICE_EVIDENCE_RULE_VERSION,
    outlier_review: quote.outlierReview || {},
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
  const observedAt =
    point.recordedAt || point.providerUpdatedAt || point.observedAt || null;
  const observation = { ...point, valuationType };
  const freshness = priceFreshness(observation);
  const confidence = Number(point.quality?.confidence);
  return {
    user_id: item.user_id,
    collection_item_id: item.id,
    aggregator: point.quality?.aggregator || "pkmnprices",
    provider: point.provider,
    market: point.market || point.provider,
    provider_variant_id: point.providerVariantId || "",
    source_record_id: point.providerProductId || null,
    source_url: point.providerUrl || null,
    currency: point.currency,
    region:
      point.region ||
      (point.provider === "cardmarket" || point.currency === "EUR"
        ? "EU"
        : "US"),
    language: point.language || item.identity_snapshot?.language || "unknown",
    valuation_type: valuationType,
    finish: point.finish,
    printing: point.printing || null,
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
    provider_updated_at:
      point.providerUpdatedAt || point.recordedAt || point.observedAt || null,
    retrieved_at: point.retrievedAt || new Date().toISOString(),
    expires_at: freshness.expiresAt,
    evidence_kind: priceEvidenceKind(observation),
    derivation: point.derivation || "aggregated",
    fees_included: point.feesIncluded === true,
    shipping_included: point.shippingIncluded === true,
    capability_status: "live",
    exclusion_status: point.excluded
      ? "excluded"
      : point.anomalous || point.outlierReview?.flagged
        ? "flagged"
        : "included",
    exclusion_reason:
      point.exclusionReason || point.outlierReview?.reason || null,
    evidence_rule_version: PRICE_EVIDENCE_RULE_VERSION,
    confidence_score:
      Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
        ? confidence
        : null,
    confidence_reason: {
      direct: point.quality?.direct === true,
      sampleSize: point.quality?.sampleSize || point.saleCount || null,
      granularity: point.granularity || "observation",
    },
    outlier_review: point.outlierReview || {},
    source_metadata: {
      providerVariantId: point.providerVariantId || null,
      field: point.quality?.field || null,
      saleCount: point.saleCount || null,
    },
    observed_at: observedAt,
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
const SYNC_WORK_BUDGET_MS = 45_000;
const UUID_CURSOR =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function pricingCreditPlan(plan) {
  const normalizedPlan = String(plan).toLowerCase();
  const expanded = ["pro", "business"].includes(normalizedPlan);
  return {
    dailyBudget:
      normalizedPlan === "business"
        ? 200_000
        : normalizedPlan === "pro"
          ? 20_000
          : 100,
    // Conservative returned-item upper bound: direct validation, two searches,
    // current USD/EUR cards, and USD/EUR daily history. The provider charges
    // by returned item, so reserving the upper bound fails safely.
    upperBoundPerGroup: expanded ? 800 : 50,
    expanded,
  };
}

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

export function completedPriceSyncCursor(
  items,
  completedLookupKeys,
  fallbackCursor = null,
) {
  let cursor = fallbackCursor;
  for (const item of items || []) {
    if (!completedLookupKeys.has(priceSyncLookupKey(item))) break;
    cursor = item.id;
  }
  return cursor;
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
  if (quote && (quote.providerUpdatedAt || quote.observedAt || quote.soldAt))
    points.push({
      ...quote,
      recordedAt: quote.providerUpdatedAt || quote.observedAt || quote.soldAt,
      granularity: "observation",
    });
  const rows = [
    ...new Map(
      points
        .filter(
          (point) =>
            Number(point.amount) > 0 &&
            point.provider &&
            (point.recordedAt || point.providerUpdatedAt || point.observedAt),
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
    if (bearerToken !== config.cronSecret)
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
  const startedAtMs = Date.now();
  const startedAt = new Date(startedAtMs).toISOString();
  const creditPlan = pricingCreditPlan(config.pkmnpricesPlan);
  const dailyCreditBudget = creditPlan.dailyBudget;
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
  const creditReservation = await database.rpc(
    "reserve_provider_daily_credits",
    {
      p_provider: "pkmnprices",
      p_daily_budget: dailyCreditBudget,
      p_requested: groups.size * creditPlan.upperBoundPerGroup,
    },
  );
  if (creditReservation.error)
    return send(response, 500, {
      error: "Could not reserve the provider credit allowance",
    });
  const reservedCredits = Math.max(0, Number(creditReservation.data) || 0);
  const permittedGroupCount = Math.min(
    groups.size,
    Math.floor(reservedCredits / creditPlan.upperBoundPerGroup),
  );
  const permittedGroups = [...groups.entries()].slice(0, permittedGroupCount);
  const creditBudgetReached = permittedGroupCount < groups.size;
  let inserted = 0,
    duplicates = 0,
    failures = 0,
    successfulGroups = 0;
  let deadlineReached = false;
  let checkpointCursor = cursorResult.data?.sync_cursor || null;
  const attemptedLookupKeys = new Set();
  const observedEntitlements = {
    declaredPlan: config.pkmnpricesPlan,
    current: "not_checked",
    history: "not_requested",
    eur: "not_requested",
  };
  const proHistory = creditPlan.expanded;
  for (const [lookupKey, groupedItems] of permittedGroups) {
    if (Date.now() - startedAtMs >= SYNC_WORK_BUDGET_MS) {
      deadlineReached = true;
      break;
    }
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
      if (!result.card) throw new Error("provider_card_not_found");
      observedEntitlements.current = "live";
      observedEntitlements.history = result.historyStatus || "not_requested";
      observedEntitlements.eur = result.eurStatus || "not_requested";
      const normalized = normalizePkmnPricesCard(
        result.card,
        result.history,
        new Date().toISOString(),
        item.card_id,
        result.historyStatus,
        { eur: result.eurStatus },
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
          const row = observationRow(position, quote);
          if (!row) continue;
          const saved = await database.from("price_observations").insert(row);
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
    attemptedLookupKeys.add(lookupKey);
    checkpointCursor = completedPriceSyncCursor(
      items,
      attemptedLookupKeys,
      checkpointCursor,
    );
    const checkpoint = await database.from("provider_sync_status").upsert({
      provider: "pkmnprices",
      enabled: true,
      sync_cursor: checkpointCursor,
      updated_at: new Date().toISOString(),
    });
    if (checkpoint.error) failures += 1;
  }
  const finishedAt = new Date().toISOString();
  const statusUpdate = await database.from("provider_sync_status").upsert({
    provider: "pkmnprices",
    enabled: true,
    last_success_at:
      groups.size === 0 || successfulGroups > 0 ? finishedAt : null,
    last_failure_at:
      failures || deadlineReached || creditBudgetReached ? finishedAt : null,
    last_error_code: creditBudgetReached
      ? "daily_credit_budget_reached"
      : deadlineReached
        ? "deadline_reached"
        : failures
          ? successfulGroups
            ? "partial_failure"
            : "full_failure"
          : null,
    sync_cursor: checkpointCursor,
    daily_credit_budget: dailyCreditBudget,
    entitlement_snapshot: observedEntitlements,
    entitlement_checked_at:
      observedEntitlements.current === "not_checked" ? null : finishedAt,
    updated_at: finishedAt,
  });
  if (statusUpdate.error)
    return send(response, 500, {
      ok: false,
      error: "Could not persist pricing sync status",
    });
  const fullFailure = permittedGroups.length > 0 && successfulGroups === 0;
  const responseStatus =
    creditBudgetReached && permittedGroups.length === 0
      ? 429
      : fullFailure
        ? 502
        : 200;
  return send(response, responseStatus, {
    ok: !deadlineReached && !creditBudgetReached && failures === 0,
    trackedCards: groups.size,
    trackedPositions: items?.length || 0,
    attemptedGroups: attemptedLookupKeys.size,
    deferredGroups: groups.size - attemptedLookupKeys.size,
    creditBudgetReached,
    dailyCreditBudget,
    reservedCredits,
    creditUpperBoundPerGroup: creditPlan.upperBoundPerGroup,
    inserted,
    duplicates,
    failures,
    cursor: checkpointCursor,
    wrapped: batch.wrapped,
    startedAt,
    finishedAt,
  });
}
