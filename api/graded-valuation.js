import { releaseHold } from "../lib/release-hold.js";
import { withNativeCors } from "../lib/native-cors.js";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "../lib/env.js";
import { exactSoldValuation } from "../lib/pricing.js";
import { fetchPkmnPricesSales } from "../lib/providers/pkmnprices.js";
import {
  exactSoldObservation,
  gradedLookup,
  storedGradedContext,
  readExactSoldObservation,
} from "../lib/graded-valuation.js";
import { pricingCreditPlan } from "./price-sync.js";

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
}

export function valuationPositionContract(position) {
  return Object.fromEntries(
    [
      "user_id",
      "id",
      "status",
      "card_state",
      "identity_snapshot",
      "grader",
      "grade",
      "currency",
      "collectible_id",
    ].map((field) => [field, position[field]]),
  );
}

export function observationId(row) {
  const facts = [
    row.user_id,
    row.collection_item_id,
    row.quality.context,
    row.source_metadata.providerCardId,
    [...row.source_metadata.sales]
      .map(({ retrievedAt, ...sale }) => sale)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    row.evidence_rule_version,
    row.source_metadata.hasMore,
  ];
  const hex = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function createGradedValuationHandler({
  createClientImpl = createClient,
  fetchSales = fetchPkmnPricesSales,
  environment = serverEnvironment,
  now = () => Date.now(),
} = {}) {
  return async function handler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return send(response, 405, { error: "Method not allowed" });
    }
    const token = String(request.headers?.authorization || "").match(
      /^Bearer (\S+)$/,
    )?.[1];
    if (!token)
      return send(response, 401, { error: "Authentication required" });
    const positionId = String(request.body?.positionId || "");
    if (!UUID.test(positionId))
      return send(response, 400, { error: "Invalid saved copy" });
    const config = environment();
    if (!config.supabaseUrl || !config.supabaseSecretKey)
      return send(response, 503, { error: "Secure valuation unavailable" });
    const database = createClientImpl(
      config.supabaseUrl,
      config.supabaseSecretKey,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const auth = await database.auth.getUser(token);
    if (auth.error || !auth.data?.user)
      return send(response, 401, { error: "Authentication required" });
    const ownerId = auth.data.user.id;
    let sessionId;
    try {
      sessionId = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
      ).session_id;
    } catch {
      return send(response, 401, { error: "Authentication required" });
    }
    if (!UUID.test(String(sessionId || "")))
      return send(response, 401, { error: "Authentication required" });
    const readPosition = () =>
      database
        .from("collection_items")
        .select(
          "id,user_id,collectible_id,identity_snapshot,card_state,grader,grade,currency,status",
        )
        .eq("id", positionId)
        .eq("user_id", ownerId)
        .maybeSingle();
    const initial = await readPosition();
    if (initial.error)
      return send(response, 500, { error: "Saved copy unavailable" });
    const position = initial.data;
    if (
      !position ||
      position.card_state !== "graded" ||
      !["owned", "listed"].includes(position.status)
    )
      return send(response, 404, { error: "Saved graded copy unavailable" });
    const context = storedGradedContext(position);
    const storedProviderId = String(
      position.identity_snapshot?.externalIds?.pkmnprices || "",
    );
    if (!/^\d{1,12}$/.test(storedProviderId))
      return send(response, 422, {
        error: "An exact provider mapping is required",
      });
    const preflight = exactSoldValuation([], context, {
      validatedContext: {
        ...gradedLookup(context, position),
        providerCardId: "preflight",
        canonicalValidated: true,
        completedSaleValidated: true,
      },
      now: now(),
    });
    if (preflight.status === "unresolved_context")
      return send(response, 422, {
        error: "Confirm the exact printing and grade first",
      });
    const persist = (observation = null) =>
      database.rpc("persist_verified_graded_valuation", {
        p_owner_id: ownerId,
        p_session_id: sessionId,
        p_position_id: positionId,
        p_expected: valuationPositionContract(position),
        p_observation: observation,
      });
    // No fallback insert: the approved atomic owner/context/session guard must
    // exist before reserving credits or requesting paid evidence.
    const writeGuard = await persist();
    if (writeGuard.error)
      return send(response, 503, {
        error: "Saved valuation is not available yet",
        code: "valuation_write_guard_unavailable",
      });
    if (!config.pkmnpricesApiKey)
      return send(response, 503, { error: "Sold-listing data unavailable" });
    // At most one card detail and ten sale rows. Reserve before provider work.
    const allowance = await database.rpc("reserve_provider_daily_credits", {
      p_provider: "pkmnprices",
      p_daily_budget: pricingCreditPlan(config.pkmnpricesPlan).dailyBudget,
      p_requested: 11,
    });
    if (allowance.error || Number(allowance.data) !== 11)
      return send(response, 429, {
        error: "Valuation request allowance unavailable",
      });
    let provider;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      provider = await fetchSales(
        config.pkmnpricesApiKey,
        gradedLookup(context, position),
        controller.signal,
        { directOnly: true, maxAttempts: 1 },
      );
    } catch {
      return send(response, 502, { error: "Sold-listing data unavailable" });
    } finally {
      clearTimeout(timeout);
    }
    if (storedProviderId && String(provider.cardId || "") !== storedProviderId)
      return send(response, 422, {
        error: "Saved provider identity did not match",
      });
    const retrievedAt = new Date(now()).toISOString();
    const { result, row } = exactSoldObservation(
      position,
      provider,
      retrievedAt,
      now(),
    );
    if (!row)
      return send(response, 200, {
        status: result.status,
        valuation: null,
        sales: provider.sales,
        validatedContext: provider.cardId
          ? {
              ...gradedLookup(context, position),
              providerCardId: provider.cardId,
              canonicalValidated: true,
              completedSaleValidated: true,
            }
          : null,
        retrievedAt,
        hasMore: provider.hasMore === true,
      });
    if (request.signal?.aborted)
      return send(response, 409, {
        error: "Saved copy changed during valuation",
      });
    row.id = observationId(row);
    const saved = await persist(row);
    if (saved.error)
      return send(
        response,
        String(saved.error.message || "").includes("valuation_context_changed")
          ? 409
          : String(saved.error.message || "").includes(
                "valuation_session_expired",
              )
            ? 401
            : 503,
        { error: "Valuation could not be saved" },
      );
    const persisted = readExactSoldObservation(saved.data, position, now());
    if (!persisted?.current)
      return send(response, 503, {
        error: "Saved valuation could not be verified",
      });
    return send(response, 200, {
      status: "ready",
      valuation: {
        id: saved.data.id,
        amount: persisted.amount,
        currency: persisted.currency,
        evaluatedAt: persisted.recordedAt,
        ruleVersion: persisted.ruleVersion,
        contributingEvidenceIds: persisted.contributingEvidenceIds,
      },
      ...persisted.saleEvidence,
    });
  };
}

export default withNativeCors(releaseHold, ["POST"]);
