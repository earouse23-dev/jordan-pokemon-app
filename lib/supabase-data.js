import { deviceTimeZone, notificationTimeZone } from "./web-push-client.js";
import { createClient } from "@supabase/supabase-js";
import {
  AUTH_STORAGE_KEY,
  nativeBuild,
  nativeRuntime,
} from "./native-runtime.js";
import {
  GRADED_VALUATION_PRODUCER,
  readExactSoldObservation,
} from "./graded-valuation.js";
import { canonicalFinish } from "./identity.js";
import { normalizeSoftwareMode } from "./software-modes.js";
import {
  normalizeActionThresholds,
  normalizeNotificationPreferences,
} from "./action-center.js";

let singleton;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function createAppSupabase() {
  if (singleton) return singleton;
  if (nativeBuild) {
    if (!nativeRuntime())
      throw new Error("Native secure storage is not ready.");
    nativeRuntime().ready();
  }
  const config = globalThis.__APP_CONFIG__ || {};
  if (
    !/^https:\/\/.+\.supabase\.co$/i.test(config.supabaseUrl || "") ||
    !config.supabasePublishableKey
  )
    return null;
  singleton = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...(nativeBuild
        ? {
            storage: nativeRuntime().storage,
            storageKey: AUTH_STORAGE_KEY,
            flowType: "pkce",
            detectSessionInUrl: false,
            // Native lifecycle explicitly controls foreground refresh.
            autoRefreshToken: false,
          }
        : {}),
    },
    global: {
      headers: { "X-Client-Info": "pokemon-portfolio-pwa/1.0" },
      ...(nativeBuild
        ? {
            fetch: (input, options) =>
              nativeRuntime().supabaseFetch(input, options),
          }
        : {}),
    },
  });
  return singleton;
}

function accountReturnUrl(query = "") {
  const configuredOrigin = globalThis.__APP_CONFIG__?.authReturnOrigin;
  const origin = configuredOrigin
    ? new URL(configuredOrigin).origin
    : globalThis.location?.origin || "";
  if (configuredOrigin && !origin.startsWith("https://"))
    throw new Error("Account return URL must use HTTPS.");
  return origin ? `${origin}/${query}` : `/${query}`;
}

async function authResult(action) {
  if (!nativeBuild) return action();
  try {
    return await action();
  } catch {
    return {
      data: { user: null, session: null },
      error: new Error(
        "Secure sign-in could not finish. Restart Mica to retry.",
      ),
    };
  }
}

export async function signUpWithPassword(client, email, password) {
  return authResult(async () => {
    const returnTo = nativeBuild
      ? await nativeRuntime().returnUrl("signup")
      : accountReturnUrl();
    return client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: returnTo },
    });
  });
}

export async function resendSignupConfirmation(client, email) {
  return authResult(async () => {
    const returnTo = nativeBuild
      ? await nativeRuntime().returnUrl("signup")
      : accountReturnUrl();
    return client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: returnTo },
    });
  });
}

export async function signInWithPassword(client, email, password) {
  return authResult(async () => {
    if (nativeBuild) nativeRuntime().ready();
    return client.auth.signInWithPassword({ email, password });
  });
}
export async function sendPasswordReset(client, email) {
  return authResult(async () => {
    const returnTo = nativeBuild
      ? await nativeRuntime().returnUrl("recovery")
      : accountReturnUrl("?auth=reset");
    return client.auth.resetPasswordForEmail(email, {
      redirectTo: returnTo,
    });
  });
}
export async function updateAccountPassword(client, password) {
  return authResult(async () => {
    if (nativeBuild) nativeRuntime().ready();
    return client.auth.updateUser({ password });
  });
}
export async function signOut(client) {
  return authResult(async () => {
    try {
      return await client.auth.signOut({ scope: "local" });
    } finally {
      if (nativeBuild) {
        client.auth.stopAutoRefresh();
        try {
          await nativeRuntime().clearAuth();
        } finally {
          globalThis.dispatchEvent(new Event("mica-native-signout"));
        }
      }
    }
  });
}

const DEFAULT_PROFILE_PREFERENCES = Object.freeze({
  tradeValuePercent: 90,
  quickSalePercent: 80,
  sellingFeePercent: 0,
  otherSellingCosts: 0,
  collectorGoal: "collecting",
  experienceLevel: "beginner",
  softwareMode: "collector",
});

function boundedPercent(value, fallback) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount <= 100
    ? amount
    : fallback;
}

export function normalizeProfilePreferences(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const normalized = {
    ...DEFAULT_PROFILE_PREFERENCES,
    ...input,
    tradeValuePercent: boundedPercent(input.tradeValuePercent, 90),
    quickSalePercent: boundedPercent(input.quickSalePercent, 80),
    sellingFeePercent: boundedPercent(input.sellingFeePercent, 0),
    otherSellingCosts: Math.max(0, Number(input.otherSellingCosts) || 0),
  };
  normalized.softwareMode = normalizeSoftwareMode(input.softwareMode, input);
  return normalized;
}

export async function recordSoftwareModeEvent(
  client,
  { fromMode, toMode, source = "settings" },
) {
  const { error } = await client.from("software_mode_events").insert({
    from_mode: normalizeSoftwareMode(fromMode),
    to_mode: normalizeSoftwareMode(toMode),
    source,
  });
  if (error) throw error;
}

export async function loadProfile(client) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const user = auth?.user;
  if (!user) throw new Error("Sign in is required");
  const { data, error } = await client
    .from("profiles")
    .select(
      "id,display_name,display_currency,preferences,onboarding_completed_at",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return {
    id: user.id,
    displayName: data?.display_name || "",
    displayCurrency: data?.display_currency || "USD",
    preferences: normalizeProfilePreferences(data?.preferences),
    onboardingCompletedAt: data?.onboarding_completed_at || null,
  };
}

export async function saveProfile(client, profile = {}) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const user = auth?.user;
  if (!user) throw new Error("Sign in is required");
  if (
    profile.displayCurrency !== undefined &&
    !["USD", "EUR"].includes(profile.displayCurrency)
  )
    throw new Error("Unsupported display currency");
  const row = {
    id: user.id,
    display_name: String(profile.displayName || "").trim() || null,
    ...(profile.displayCurrency === undefined
      ? {}
      : { display_currency: profile.displayCurrency }),
    preferences: normalizeProfilePreferences(profile.preferences),
    updated_at: new Date().toISOString(),
  };
  if (profile.completeOnboarding)
    row.onboarding_completed_at = new Date().toISOString();
  const { data, error } = await client
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select(
      "id,display_name,display_currency,preferences,onboarding_completed_at",
    )
    .single();
  if (error) throw error;
  return {
    id: data.id,
    displayName: data.display_name || "",
    displayCurrency: data.display_currency || "USD",
    preferences: normalizeProfilePreferences(data.preferences),
    onboardingCompletedAt: data.onboarding_completed_at || null,
  };
}
function number(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function hydratePosition(
  row,
  transactions = [],
  lots = [],
  allocations = [],
  observations = [],
  submissions = [],
  assessments = [],
  lifecycleEvents = [],
) {
  const identity = row.identity_snapshot || {};
  const gradedValuations = observations
    .map((observation) => readExactSoldObservation(observation, row))
    .filter(Boolean);
  const savedSaleEvidence =
    gradedValuations
      .filter((point) => point.contextValidated)
      .sort((left, right) =>
        String(right.recordedAt).localeCompare(String(left.recordedAt)),
      )[0]?.saleEvidence || null;
  const purchases = transactions.filter(
    (item) => item.transaction_type === "purchase",
  );
  const sales = transactions.filter((item) => item.transaction_type === "sale");
  const activeLots = lots.filter((lot) => Number(lot.quantity_remaining) > 0);
  const costBasisKnown =
    activeLots.length > 0 &&
    activeLots.every(
      (lot) =>
        lot.cost_basis_known !== false &&
        lot.currency === row.currency &&
        Number.isFinite(number(lot.remaining_cost)) &&
        number(lot.remaining_cost) >= 0,
    );
  const costBasis = costBasisKnown
    ? activeLots.reduce((sum, lot) => sum + number(lot.remaining_cost), 0)
    : null;
  const allocatedCostKnown =
    allocations.length > 0 &&
    allocations.every((item) => {
      const lot = lots.find(
        (candidate) => candidate.id === item.purchase_lot_id,
      );
      const sale = sales.find(
        (candidate) => candidate.id === item.sale_transaction_id,
      );
      return (
        item.cost_basis_known !== false &&
        Number.isFinite(number(item.allocated_cost)) &&
        number(item.allocated_cost) >= 0 &&
        (!lot || lot.currency === row.currency) &&
        (!sale || sale.currency === row.currency)
      );
    });
  const allocatedCost = allocatedCostKnown
    ? allocations.reduce((sum, item) => sum + number(item.allocated_cost), 0)
    : null;
  const netProceeds = sales.every((item) =>
    Number.isFinite(number(item.net_proceeds)),
  )
    ? sales.reduce((sum, item) => sum + number(item.net_proceeds), 0)
    : null;
  const knownPurchaseDates = lots.length
    ? lots
        .filter((lot) => lot.acquired_at_known !== false)
        .map((lot) => lot.acquired_at)
    : purchases.map((item) => item.transaction_date);
  const gradingSubmissions = submissions
    .map((submission) => ({
      id: submission.id,
      batchId: submission.batch_id || null,
      scanSessionId: submission.scan_session_id || null,
      quantity: Number(submission.quantity),
      grader: submission.grader,
      submittedAt: submission.submitted_at,
      expectedReturnDate: submission.expected_return_date || "",
      status: submission.status,
      statusUpdatedAt: submission.status_updated_at,
      submissionReference: submission.submission_reference || "",
      estimatedTotalCost: number(submission.estimated_total_cost),
      notes: submission.notes || "",
      returnedAt: submission.returned_at || "",
      economicsSnapshot: submission.economics_snapshot || {},
      statusHistory: (submission.status_history || []).map((event) => ({
        id: event.id,
        status: event.status,
        occurredOn: event.occurred_on,
        source: event.source,
        note: event.note || "",
      })),
    }))
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  const digitalGrade =
    assessments
      .filter((assessment) => assessment.estimate_status === "confirmed")
      .sort((left, right) =>
        String(
          right.confirmed_at || right.assessed_at || right.created_at,
        ).localeCompare(
          String(left.confirmed_at || left.assessed_at || left.created_at),
        ),
      )[0] || null;
  const marketReferencesKnown =
    activeLots.length > 0 &&
    activeLots.every(
      (lot) =>
        number(lot.market_unit_price_at_purchase) !== null &&
        lot.market_price_currency === row.currency,
    );
  const marketPriceAtPurchase = marketReferencesKnown
    ? activeLots.reduce(
        (sum, lot) =>
          sum +
          Number(lot.market_unit_price_at_purchase) *
            Number(lot.quantity_remaining),
        0,
      ) /
      activeLots.reduce((sum, lot) => sum + Number(lot.quantity_remaining), 0)
    : null;
  const marketPurchaseProviders = [
    ...new Set(
      activeLots.map((lot) => lot.market_price_provider).filter(Boolean),
    ),
  ];
  return {
    id: identity.providerCardId || identity.id || row.id,
    uid: row.id,
    collectionId: row.collection_id || null,
    collectibleId: row.collectible_id || identity.collectibleId || null,
    cardId: row.card_id,
    variantId: row.variant_id || identity.variantId || null,
    name: identity.name || "Unknown item",
    set: identity.set || identity.setName || "Set unavailable",
    setId: identity.setId || "",
    number: identity.number || identity.collectorNumber || "",
    variant: identity.variant || identity.finish || "Unknown printing",
    finish: identity.finish || canonicalFinish(identity.variant),
    edition: identity.edition || "unknown",
    promoType: identity.promoType || "unknown",
    identityStatus: identity.identityStatus || "needs_review",
    variantMetadata: identity.variantMetadata || {},
    language: identity.language || "en",
    rarity: identity.rarity || null,
    release: identity.release || identity.releaseYear || "",
    artist: identity.artist || "",
    image: identity.image || identity.imageLarge || "./icons/icon.svg",
    thumb:
      identity.thumb ||
      identity.imageSmall ||
      identity.image ||
      "./icons/icon.svg",
    externalIds: identity.externalIds || {},
    productType: identity.productType || null,
    sealedVariant: identity.sealedVariant || null,
    sealedRegion: identity.sealedRegion || null,
    price: null,
    move: null,
    pricingStatus: "loading",
    cardState: row.card_state,
    condition:
      row.card_state === "sealed"
        ? "Sealed"
        : row.card_state === "graded"
          ? "Graded"
          : identity.conditionLabel ||
            String(row.raw_condition || "")
              .split("_")
              .map((part) => part[0]?.toUpperCase() + part.slice(1))
              .join(" "),
    rawCondition: row.raw_condition,
    digitalGrade: digitalGrade
      ? {
          id: digitalGrade.id,
          reportId: digitalGrade.scan_session_id || null,
          predictedGrade: number(
            digitalGrade.pregrade_score ??
              digitalGrade.condition_score ??
              digitalGrade.predicted_grade,
          ),
          low: Number(
            digitalGrade.condition_low ?? digitalGrade.predicted_grade_low,
          ),
          high: Number(
            digitalGrade.condition_high ?? digitalGrade.predicted_grade_high,
          ),
          derivedRawCondition: digitalGrade.derived_raw_condition || null,
          subscores: digitalGrade.subscores || {},
          defects: Array.isArray(digitalGrade.defects)
            ? digitalGrade.defects
            : [],
          confidence: Number(digitalGrade.confidence),
          photoQuality: digitalGrade.photo_quality || {},
          modelVersion:
            digitalGrade.model_bundle_version || digitalGrade.model_version,
          assessedAt:
            digitalGrade.confirmed_at ||
            digitalGrade.assessed_at ||
            digitalGrade.created_at,
          reportVersion: Number(digitalGrade.report_version || 1),
          professionalPredictionStatus:
            digitalGrade.professional_prediction_status || "unavailable",
          mostLikelyGrade: number(digitalGrade.most_likely_grade),
          gradeProbabilities: Array.isArray(digitalGrade.grade_probabilities)
            ? digitalGrade.grade_probabilities
            : [],
          evidenceProfile: digitalGrade.evidence_profile || {},
          stability: digitalGrade.stability || {},
          reportSnapshot: digitalGrade.report_snapshot || {},
        }
      : null,
    gradingCompany: row.grader || "",
    grade: row.grade == null ? "" : String(row.grade),
    gradeQualifier: identity.gradeQualifier || "",
    gradeClaimSource: identity.gradeClaimSource || "",
    certificationNumber: row.certification_number || "",
    quantity: Number(row.quantity),
    status: row.status,
    askingPrice: number(row.asking_price),
    listingVenue: row.listing_venue || "",
    listedAt: row.listed_at || "",
    priceReviewedAt: row.price_reviewed_at || "",
    currency: row.currency,
    notes: row.notes || "",
    location: row.storage_location || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    customFields:
      row.custom_fields && typeof row.custom_fields === "object"
        ? { ...row.custom_fields }
        : {},
    organizationVersion: row.organization_version || "mica-organization-v1",
    gradingSubmissions,
    gradingLifecycleEvents: (lifecycleEvents || []).map((event) => ({
      id: event.id,
      state: event.state,
      occurredAt: event.occurred_at,
      source: event.source,
      details: event.details || {},
      scanSessionId: event.scan_session_id || null,
      submissionId: event.submission_id || null,
    })),
    activeGradingSubmission:
      gradingSubmissions.find(
        (submission) => !["returned", "cancelled"].includes(submission.status),
      ) || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    costBasis,
    cost:
      row.quantity && costBasis !== null
        ? costBasis / Number(row.quantity)
        : null,
    realizedGain:
      sales.length && allocatedCost !== null && netProceeds !== null
        ? netProceeds - allocatedCost
        : sales.length
          ? null
          : 0,
    netSaleProceeds: netProceeds,
    allocatedSoldCost: allocatedCost,
    purchaseDate: knownPurchaseDates.sort()[0] || "",
    marketPriceAtPurchase,
    marketPriceAtPurchaseProvider:
      marketPurchaseProviders.length === 1
        ? marketPurchaseProviders[0]
        : marketPurchaseProviders.length > 1
          ? "Multiple providers"
          : "",
    transactions: transactions
      .filter(
        (item) =>
          !(
            item.transaction_type === "position_split" &&
            item.notes ===
              "Additional FIFO lot transferred during position split."
          ),
      )
      .map((item) => {
        const purchaseLot =
          item.transaction_type === "purchase"
            ? lots.find((lot) => lot.purchase_transaction_id === item.id)
            : null;
        const saleAllocations =
          item.transaction_type === "sale"
            ? allocations.filter(
                (allocation) => allocation.sale_transaction_id === item.id,
              )
            : [];
        const transactionAllocatedCost = saleAllocations.some((allocation) => {
          const lot = lots.find(
            (candidate) => candidate.id === allocation.purchase_lot_id,
          );
          return (
            allocation.cost_basis_known === false ||
            !Number.isFinite(number(allocation.allocated_cost)) ||
            number(allocation.allocated_cost) < 0 ||
            (lot && lot.currency !== item.currency)
          );
        })
          ? null
          : saleAllocations.length
            ? saleAllocations.reduce(
                (sum, allocation) => sum + number(allocation.allocated_cost),
                0,
              )
            : null;
        const purchaseCostKnown = purchaseLot?.cost_basis_known !== false;
        const purchaseDateKnown = purchaseLot?.acquired_at_known !== false;
        const transactionNetProceeds = number(item.net_proceeds);
        const transactionTotalCost = number(item.total_cost);
        return {
          id: item.id,
          type: item.transaction_type,
          date: purchaseDateKnown ? item.transaction_date : "",
          quantity: Number(item.quantity),
          unitPrice:
            item.transaction_type === "purchase" && !purchaseCostKnown
              ? null
              : number(item.unit_price),
          subtotal: number(item.subtotal),
          tax: number(item.tax),
          shipping: number(item.shipping),
          marketplaceFees: number(item.marketplace_fees),
          gradingFees: number(item.grading_fees),
          otherCosts: number(item.other_costs),
          totalCost:
            item.transaction_type === "purchase" && !purchaseCostKnown
              ? null
              : transactionTotalCost,
          netProceeds: transactionNetProceeds,
          allocatedCost: transactionAllocatedCost,
          realizedGain:
            transactionNetProceeds === null || transactionAllocatedCost === null
              ? null
              : transactionNetProceeds - transactionAllocatedCost,
          currency: item.currency,
          marketplace: item.marketplace,
          notes: item.notes,
          gradingCompany: item.grading_company || null,
          grade: item.grade == null ? null : String(item.grade),
          certificationNumber: item.certification_number || null,
          previousRawCondition: item.previous_raw_condition || null,
          costBasisKnown: purchaseCostKnown,
          acquisitionDateKnown: purchaseDateKnown,
          acquisitionMethod:
            item.acquisition_method || purchaseLot?.acquisition_method || null,
          acquisitionContext:
            item.acquisition_context || purchaseLot?.acquisition_context || {},
          marketUnitPriceAtPurchase: number(
            purchaseLot?.market_unit_price_at_purchase,
          ),
          marketPriceProvider: purchaseLot?.market_price_provider || "",
          marketPriceObservedAt: purchaseLot?.market_price_observed_at || null,
        };
      }),
    lots: lots.map((lot) => ({
      id: lot.id,
      purchaseTransactionId: lot.purchase_transaction_id,
      acquiredAt: lot.acquired_at_known === false ? "" : lot.acquired_at,
      fifoDate: lot.acquired_at,
      acquisitionDateKnown: lot.acquired_at_known !== false,
      quantityAcquired: Number(lot.quantity_acquired),
      quantityRemaining: Number(lot.quantity_remaining),
      totalCost: lot.cost_basis_known === false ? null : number(lot.total_cost),
      remainingCost:
        lot.cost_basis_known === false ? null : number(lot.remaining_cost),
      costBasisKnown: lot.cost_basis_known !== false,
      acquisitionMethod: lot.acquisition_method || null,
      acquisitionContext: lot.acquisition_context || {},
      currency: lot.currency,
      marketUnitPriceAtPurchase: number(lot.market_unit_price_at_purchase),
      marketPriceCurrency: lot.market_price_currency || "",
      marketPriceProvider: lot.market_price_provider || "",
      marketPriceObservedAt: lot.market_price_observed_at || null,
    })),
    gradedValuations,
    exactSaleEvidence: savedSaleEvidence,
    priceHistory: observations
      .filter(
        (observation) =>
          observation.quality?.producer !== GRADED_VALUATION_PRODUCER,
      )
      .map((observation) => ({
        provider: observation.provider,
        providerVariantId: observation.provider_variant_id || null,
        currency: observation.currency,
        condition: observation.provider_condition || null,
        finish: observation.finish,
        gradingCompany: observation.grader || null,
        grade:
          observation.grade_label ||
          (observation.grade == null ? null : String(observation.grade)),
        amount: Number(observation.amount),
        low: number(observation.price_low),
        high: number(observation.price_high),
        saleCount: number(observation.sales_count),
        recordedAt: observation.observed_at,
        granularity: observation.granularity,
        quality: observation.quality || {},
      })),
  };
}

export async function loadRowsInChunks(client, options) {
  const ids = [...new Set((options.ids || []).filter(Boolean))];
  if (!ids.length) return [];
  const chunkSize = Math.min(
    Math.max(Number(options.chunkSize) || 200, 1),
    500,
  );
  const concurrency = Math.min(
    Math.max(Number(options.concurrency) || 4, 1),
    8,
  );
  const chunks = [];
  for (let index = 0; index < ids.length; index += chunkSize)
    chunks.push(ids.slice(index, index + chunkSize));
  const rows = [];
  for (let index = 0; index < chunks.length; index += concurrency) {
    const results = await Promise.all(
      chunks.slice(index, index + concurrency).map((chunk) => {
        let query = client
          .from(options.table)
          .select(options.columns || "*")
          .in(options.key, chunk);
        if (options.contains)
          query = query.contains(
            options.contains.column,
            options.contains.value,
          );
        if (options.order) query = query.order(options.order);
        return query;
      }),
    );
    for (const result of results) {
      if (result.error) throw result.error;
      rows.push(...(result.data || []));
    }
  }
  return rows;
}

export async function loadRowsInPages(client, options) {
  const pageSize = Math.min(
    Math.max(Number(options.pageSize) || 1000, 1),
    1000,
  );
  const rows = [];
  for (let page = 0; page < 1000; page += 1) {
    const from = page * pageSize;
    let query = client
      .from(options.table)
      .select(options.columns || "*")
      .order(options.order || "created_at", {
        ascending: options.ascending !== false,
      });
    for (const [column, value] of Object.entries(options.equals || {}))
      query = query.eq(column, value);
    if (options.secondaryOrder)
      query = query.order(options.secondaryOrder, {
        ascending: options.ascending !== false,
      });
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) return rows;
  }
  throw new Error("Collection is too large to load safely.");
}

function groupRows(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const values = grouped.get(row[key]) || [];
    values.push(row);
    grouped.set(row[key], values);
  }
  return grouped;
}

async function loadPortfolioRows(
  client,
  ownerId = "",
  providedRows = null,
  serverOwnerRead = false,
) {
  const rows =
    providedRows ||
    (await loadRowsInPages(client, {
      table: "collection_items",
      columns:
        "id,user_id,collection_id,collectible_id,card_id,variant_id,identity_snapshot,card_state,raw_condition,grader,grade,certification_number,quantity,valuation_basis,manual_value,notes,storage_location,tags,custom_fields,organization_version,status,asking_price,listing_venue,listed_at,price_reviewed_at,currency,created_at,updated_at",
      order: "created_at",
      secondaryOrder: "id",
      ascending: false,
      equals: ownerId ? { user_id: ownerId } : {},
    }));
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const [
    transactions,
    lots,
    submissions,
    assessments,
    confirmedReports,
    lifecycleEvents,
    historyResult,
  ] = await Promise.all([
    loadRowsInChunks(client, {
      table: "collection_transactions",
      key: "collection_item_id",
      ids,
      order: "transaction_date",
    }),
    loadRowsInChunks(client, {
      table: "purchase_lots",
      key: "collection_item_id",
      ids,
      order: "acquired_at",
    }),
    loadRowsInChunks(client, {
      table: "grading_submissions",
      key: "collection_item_id",
      ids,
      order: "submitted_at",
    }),
    loadRowsInChunks(client, {
      table: "digital_grade_assessments",
      key: "collection_item_id",
      ids,
      order: "assessed_at",
    }),
    loadRowsInChunks(client, {
      table: "grading_predictions",
      key: "collection_item_id",
      ids,
      columns:
        "id,scan_session_id,collection_item_id,pregrade_score,pregrade_basis,evidence_profile,outcome_risks,condition_score,professional_prediction_status,most_likely_grade,grade_probabilities,condition_low,condition_high,subscores,confidence,stability,report_snapshot,model_bundle_version,estimate_status,confirmed_at,created_at",
      order: "created_at",
    }),
    loadRowsInChunks(client, {
      table: "grading_lifecycle_events",
      key: "collection_item_id",
      ids,
      columns:
        "id,collection_item_id,scan_session_id,submission_id,state,occurred_at,source,details",
      order: "occurred_at",
    }),
    serverOwnerRead && ownerId
      ? // Service clients have no auth.uid(): read the authenticated owner explicitly.
        loadRowsInPages(client, {
          table: "position_price_observations",
          equals: { user_id: ownerId },
          order: "observed_at",
          secondaryOrder: "id",
        }).then((data) => ({ data, error: null }))
      : providedRows
        ? Promise.resolve({ data: [], error: null })
        : client.rpc("get_portfolio_price_history", {
            p_days: 400,
            p_per_position: 60,
          }),
  ]);
  if (historyResult.error) throw historyResult.error;
  // The bounded RPC covers active positions. Sold copies retain their past
  // observations, which the owner may still read through the existing RLS table.
  const soldHistory = await loadRowsInChunks(client, {
    table: "position_price_observations",
    key: "collection_item_id",
    ids: rows.filter((row) => row.status === "sold").map((row) => row.id),
    columns:
      "collection_item_id,provider,provider_variant_id,currency,provider_condition,finish,grader,grade_label,grade,amount,price_low,price_high,sales_count,observed_at,granularity,quality",
    order: "observed_at",
  });
  const exactHistory = await loadRowsInChunks(client, {
    table: "position_price_observations",
    key: "collection_item_id",
    ids: rows.filter((row) => row.card_state === "graded").map((row) => row.id),
    columns:
      "id,user_id,collection_item_id,provider,provider_variant_id,currency,valuation_type,finish,card_state,grader,grade,grade_label,amount,price_low,price_high,sales_count,granularity,quality,observed_at,retrieved_at,provider_updated_at,market,region,language,printing,evidence_kind,derivation,capability_status,exclusion_status,evidence_rule_version,source_metadata",
    contains: {
      column: "quality",
      value: { producer: GRADED_VALUATION_PRODUCER },
    },
    order: "observed_at",
  });
  const submissionIds = submissions.map((submission) => submission.id);
  const statusEvents = await loadRowsInChunks(client, {
    table: "grading_submission_status_events",
    key: "submission_id",
    ids: submissionIds,
    columns: "id,submission_id,status,occurred_on,source,note,created_at",
    order: "occurred_on",
  });
  const statusEventsBySubmission = groupRows(statusEvents, "submission_id");
  for (const submission of submissions)
    submission.status_history =
      statusEventsBySubmission.get(submission.id) || [];
  const saleIds = transactions
    .filter((row) => row.transaction_type === "sale")
    .map((row) => row.id);
  const allocations = await loadRowsInChunks(client, {
    table: "fifo_lot_allocations",
    key: "sale_transaction_id",
    ids: saleIds,
  });
  const transactionsByPosition = groupRows(transactions, "collection_item_id");
  const lotsByPosition = groupRows(lots, "collection_item_id");
  const submissionsByPosition = groupRows(submissions, "collection_item_id");
  const lifecycleEventsByPosition = groupRows(
    lifecycleEvents,
    "collection_item_id",
  );
  const assessmentsByPosition = groupRows(
    [...assessments, ...confirmedReports],
    "collection_item_id",
  );
  const allocationsBySale = groupRows(allocations, "sale_transaction_id");
  const historyByPosition = new Map();
  for (const observation of [
    ...(historyResult.data || []),
    ...soldHistory,
    ...exactHistory,
  ]) {
    if (
      observation.quality?.producer === GRADED_VALUATION_PRODUCER &&
      !observation.source_metadata
    )
      continue;
    const history = historyByPosition.get(observation.collection_item_id) || [];
    history.push(observation);
    historyByPosition.set(observation.collection_item_id, history);
  }
  return rows.map((row) => {
    const rowTransactions = transactionsByPosition.get(row.id) || [];
    const rowAllocations = rowTransactions
      .filter((item) => item.transaction_type === "sale")
      .flatMap((item) => allocationsBySale.get(item.id) || []);
    return hydratePosition(
      row,
      rowTransactions,
      lotsByPosition.get(row.id) || [],
      rowAllocations,
      historyByPosition.get(row.id) || [],
      submissionsByPosition.get(row.id) || [],
      assessmentsByPosition.get(row.id) || [],
      lifecycleEventsByPosition.get(row.id) || [],
    );
  });
}

export async function loadPortfolio(
  client,
  ownerId = "",
  { serverOwnerRead = false } = {},
) {
  return loadPortfolioRows(client, ownerId, null, serverOwnerRead);
}

export async function loadPortfolioValuationHistory(client, ownerId = "") {
  let query = client
    .from("valuation_snapshots")
    .select(
      "id,total,currency,priced_items,unpriced_items,fresh_items,snapshot_date,observed_at",
    );
  if (ownerId) query = query.eq("user_id", ownerId);
  const { data, error } = await query
    .order("snapshot_date", { ascending: false })
    .limit(400);
  if (error) throw error;
  return (data || [])
    .map((snapshot) => ({
      id: snapshot.id,
      total: Number(snapshot.total),
      currency: snapshot.currency,
      pricedItems: Number(snapshot.priced_items),
      unpricedItems: Number(snapshot.unpriced_items),
      freshItems: Number(snapshot.fresh_items),
      date: snapshot.snapshot_date,
      observedAt: snapshot.observed_at,
    }))
    .reverse();
}

export async function recordPortfolioValuationSnapshot(client, input) {
  const { data, error } = await client.rpc(
    "record_portfolio_valuation_snapshot",
    {
      p_total: input.total,
      p_currency: input.currency || "USD",
      p_priced_items: input.pricedItems,
      p_unpriced_items: input.unpricedItems,
      p_fresh_items: input.freshItems,
    },
  );
  if (error) throw error;
  return data;
}

export function hydrateWatchlistEntry(row) {
  const identity = row.identity_snapshot || {};
  return {
    id: identity.providerCardId || row.provider_card_id,
    watchlistId: row.id,
    collectibleId: row.collectible_id || identity.collectibleId || null,
    cardId: row.card_id,
    variantId: row.variant_id || identity.variantId || null,
    name: identity.name || "Unknown card",
    set: identity.set || identity.setName || "Set unavailable",
    setId: identity.setId || "",
    number: identity.number || identity.collectorNumber || "",
    variant: identity.variant || row.variant_key || "Unknown printing",
    finish: identity.finish || canonicalFinish(identity.variant),
    edition: identity.edition || "unknown",
    promoType: identity.promoType || "unknown",
    identityStatus: identity.identityStatus || "needs_review",
    variantMetadata: identity.variantMetadata || {},
    language: identity.language || "en",
    rarity: identity.rarity || null,
    release: identity.release || "",
    artist: identity.artist || "",
    image: identity.image || identity.thumb || "./icons/icon.svg",
    thumb: identity.thumb || identity.image || "./icons/icon.svg",
    externalIds: identity.externalIds || {},
    productType: identity.productType || null,
    sealedVariant: identity.sealedVariant || null,
    sealedRegion: identity.sealedRegion || null,
    cardState: row.card_state,
    rawCondition: row.raw_condition,
    condition:
      row.card_state === "sealed"
        ? "Sealed"
        : row.card_state === "graded"
          ? "Graded"
          : String(row.raw_condition || "")
              .split("_")
              .map((part) => part[0]?.toUpperCase() + part.slice(1))
              .join(" "),
    gradingCompany: row.grader || "",
    grade: row.grade == null ? "" : String(row.grade),
    targetPrice: number(row.target_price),
    startingMarketPrice: number(row.starting_market_price),
    currentPrice: null,
    currency: row.currency,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pricingStatus: "loading",
  };
}

export async function loadWatchlist(client, ownerId = "") {
  let query = client.from("card_watchlist").select("*");
  if (ownerId) query = query.eq("user_id", ownerId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(hydrateWatchlistEntry);
}

export async function createWatchlistEntry(client, input) {
  const { data, error } = await client
    .from("card_watchlist")
    .insert({
      user_id: input.userId,
      card_id: input.cardId || null,
      variant_id: UUID_PATTERN.test(input.identity.variantId || "")
        ? input.identity.variantId
        : null,
      provider_card_id: input.identity.providerCardId,
      variant_key: input.identity.variant || "",
      identity_snapshot: input.identity,
      card_state: input.cardState,
      raw_condition:
        input.cardState === "raw" && input.rawCondition !== "unknown"
          ? input.rawCondition
          : null,
      grader: input.cardState === "graded" ? input.grader : null,
      grade: input.cardState === "graded" ? input.grade : null,
      target_price: input.targetPrice ?? null,
      starting_market_price: input.startingMarketPrice ?? null,
      currency: input.currency || "USD",
      notes: input.notes || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return hydrateWatchlistEntry(data);
}

export async function updateWatchlistEntry(client, id, input) {
  const { data, error } = await client
    .from("card_watchlist")
    .update({
      target_price: input.targetPrice ?? null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return hydrateWatchlistEntry(data);
}

export async function deleteWatchlistEntry(client, id) {
  const { error } = await client.from("card_watchlist").delete().eq("id", id);
  if (error) throw error;
}

function hydrateActionItem(row) {
  return {
    id: row.id,
    actionKey: row.action_key,
    kind: row.kind,
    ruleVersion: row.rule_version,
    subject: { type: row.subject_type, id: row.subject_id },
    title: row.title,
    reason: row.reason,
    source: row.source,
    observedAt: row.observed_at,
    confidence: Number(row.confidence),
    suggestedAction: row.suggested_action,
    destination: row.destination || { route: "dashboard" },
    evidence: row.evidence || {},
    priority: Number(row.priority),
    status: row.status,
    snoozedUntil: row.snoozed_until,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    occurrenceCount: Number(row.occurrence_count || 1),
    actedAt: row.acted_at,
  };
}

function hydrateNotificationPreferences(row = {}) {
  return {
    ...normalizeNotificationPreferences({
      enabled: row.enabled,
      channels: {
        inApp: row.in_app_enabled,
        email: row.email_enabled,
        webPush: row.web_push_enabled,
      },
      quietHours: {
        enabled: row.quiet_hours_enabled,
        start: String(row.quiet_start || "21:00").slice(0, 5),
        end: String(row.quiet_end || "08:00").slice(0, 5),
      },
      timeZone: row.time_zone || (row.user_id ? "UTC" : deviceTimeZone()),
      dailyCap: row.daily_cap,
      cooldownHours: row.cooldown_hours,
      mutedKinds: row.muted_kinds,
    }),
    thresholds: normalizeActionThresholds(row.thresholds),
  };
}

export async function loadActionCenter(client, ownerId = "") {
  let actionQuery = client
    .from("action_items")
    .select(
      "id,action_key,kind,rule_version,subject_type,subject_id,title,reason,source,observed_at,confidence,suggested_action,destination,evidence,priority,status,snoozed_until,first_seen_at,last_seen_at,occurrence_count,acted_at",
    )
    .in("status", ["open", "snoozed"])
    .order("priority")
    .order("observed_at", { ascending: false })
    .limit(250);
  let preferenceQuery = client.from("notification_preferences").select("*");
  if (ownerId) {
    actionQuery = actionQuery.eq("user_id", ownerId);
    preferenceQuery = preferenceQuery.eq("user_id", ownerId);
  }
  const [actions, preferences] = await Promise.all([
    actionQuery,
    preferenceQuery.maybeSingle(),
  ]);
  if (actions.error) throw actions.error;
  if (preferences.error) throw preferences.error;
  return {
    items: (actions.data || []).map(hydrateActionItem),
    preferences: hydrateNotificationPreferences(preferences.data || {}),
  };
}

export async function upsertActionCenterSnapshot(client, actions = []) {
  const { data, error } = await client.rpc("upsert_action_center_snapshot", {
    p_actions: actions.slice(0, 250),
  });
  if (error) throw error;
  return data || [];
}

export async function saveActionCenterPreferences(client, preferences = {}) {
  notificationTimeZone(preferences.timeZone);
  const normalized = normalizeNotificationPreferences(preferences);
  const payload = {
    ...normalized,
    thresholds: normalizeActionThresholds(preferences.thresholds),
  };
  const { data, error } = await client.rpc("save_notification_preferences", {
    p_preferences: payload,
  });
  if (error) throw error;
  return hydrateNotificationPreferences(data || {});
}

export async function transitionActionItem(
  client,
  actionId,
  transition,
  snoozedUntil = null,
) {
  const { data, error } = await client.rpc("transition_action_item", {
    p_action_id: actionId,
    p_transition: transition,
    p_snoozed_until: snoozedUntil,
  });
  if (error) throw error;
  return data;
}

export async function createPosition(client, input) {
  const { data, error } = await client.rpc(
    input.cardState === "graded"
      ? "create_graded_copy_position"
      : "create_collection_position",
    {
      p_identity: input.identity,
      p_card_id: input.cardId || null,
      p_variant_id: input.variantId || null,
      p_card_state: input.cardState,
      p_raw_condition:
        input.cardState === "raw" && input.rawCondition !== "unknown"
          ? input.rawCondition
          : null,
      p_grader: input.cardState === "graded" ? input.grader : null,
      p_grade: input.cardState === "graded" ? input.grade : null,
      p_certification_number: input.certificationNumber || null,
      p_quantity: input.cardState === "graded" ? 1 : input.quantity,
      p_transaction_date: input.transactionDate,
      p_unit_price: input.unitPrice,
      p_tax: input.tax || 0,
      p_shipping: input.shipping || 0,
      p_marketplace_fees: input.marketplaceFees || 0,
      p_grading_fees: input.gradingFees || 0,
      p_other_costs: input.otherCosts || 0,
      p_currency: input.currency || "USD",
      p_marketplace: input.marketplace || null,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey,
      p_acquisition_method: input.acquisitionMethod || "unknown",
    },
  );
  if (error) throw error;
  return data;
}

export async function createIdentifiedGradePosition(client, input) {
  const { data, error } = await client.rpc("create_identified_grade_position", {
    p_identity: input.identity,
    p_card_id: input.cardId || null,
    p_variant_id: input.variantId || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function createImportedPosition(client, input) {
  try {
    return { id: await createPosition(client, input), reused: false };
  } catch (error) {
    if (error?.code !== "23505" || !input.idempotencyKey) throw error;
    const { data, error: lookupError } = await client
      .from("collection_transactions")
      .select("collection_item_id")
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (lookupError || !data?.collection_item_id) throw error;
    return { id: data.collection_item_id, reused: true };
  }
}

export async function loadImportMappingProfile(client, headerSignature) {
  const { data, error } = await client
    .from("import_mapping_profiles")
    .select("id,source_name,header_signature,mapping,last_used_at")
    .eq("header_signature", headerSignature)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function saveImportMappingProfile(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const { data, error } = await client
    .from("import_mapping_profiles")
    .upsert(
      {
        user_id: auth.user.id,
        source_name: input.sourceName,
        header_signature: input.headerSignature,
        mapping: input.mapping || {},
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,header_signature" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function beginCollectionImport(client, input) {
  const { data, error } = await client.rpc("begin_collection_import", {
    p_source_name: input.sourceName,
    p_file_sha256: input.fileSha256,
    p_header_signature: input.headerSignature,
    p_mapping: input.mapping || {},
    p_preview: input.preview || {},
  });
  if (error) throw error;
  return data;
}

export async function stageCollectionImportRows(client, importJobId, rows) {
  const { data, error } = await client.rpc("stage_collection_import_rows", {
    p_import_job_id: importJobId,
    p_rows: rows,
  });
  if (error) throw error;
  return Number(data) || 0;
}

export async function previewCollectionImport(client, importJobId) {
  const { data, error } = await client.rpc("preview_collection_import", {
    p_import_job_id: importJobId,
  });
  if (error) throw error;
  return data || {};
}

export async function commitCollectionImport(client, importJobId) {
  const { data, error } = await client.rpc("commit_collection_import", {
    p_import_job_id: importJobId,
  });
  if (error) throw error;
  return data || {};
}

export async function rollbackCollectionImport(client, importJobId) {
  const { data, error } = await client.rpc("rollback_collection_import_v2", {
    p_import_job_id: importJobId,
  });
  if (error) throw error;
  return data || {};
}

export async function loadRecentCollectionImports(client, limit = 10) {
  const { data, error } = await client
    .from("import_jobs")
    .select(
      "id,status,source_name,totals,preview,committed_at,rolled_back_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(25, Math.max(1, Number(limit) || 10)));
  if (error) throw error;
  return data || [];
}

export async function recordIngestionEvent(client, input) {
  const { data, error } = await client.rpc("record_ingestion_event", {
    p_session_id: input.sessionId,
    p_channel: input.channel,
    p_stage: input.stage,
    p_outcome: input.outcome,
    p_duration_ms:
      input.durationMs === null || input.durationMs === undefined
        ? null
        : Math.round(Number(input.durationMs)),
    p_metadata: input.metadata || {},
  });
  if (error) throw error;
  return data;
}

export async function recordPurchaseLot(client, input) {
  const { data, error } = await client.rpc("record_collection_purchase", {
    p_collection_item_id: input.collectionItemId,
    p_transaction_date: input.transactionDate,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
    p_tax: input.tax || 0,
    p_shipping: input.shipping || 0,
    p_marketplace_fees: input.marketplaceFees || 0,
    p_grading_fees: input.gradingFees || 0,
    p_other_costs: input.otherCosts || 0,
    p_currency: input.currency || "USD",
    p_marketplace: input.marketplace || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
    p_acquisition_method: input.acquisitionMethod || "unknown",
    p_cost_basis_known: input.acquisitionCostKnown !== false,
    p_acquisition_date_known: input.acquisitionDateKnown !== false,
  });
  if (error) throw error;
  return data;
}

export async function saveDigitalGradeAssessment(client, input) {
  const { data, error } = await client.rpc("confirm_digital_grade_assessment", {
    p_collection_item_id: input.collectionItemId,
    p_predicted_grade: input.predictedGrade ?? null,
    p_predicted_grade_low: input.predictedGradeLow,
    p_predicted_grade_high: input.predictedGradeHigh,
    p_derived_raw_condition: input.derivedRawCondition || null,
    p_subscores: input.subscores || {},
    p_defects: input.defects || [],
    p_confidence: input.confidence,
    p_photo_quality: input.photoQuality || {},
    p_model_version: input.modelVersion,
  });
  if (error) throw error;
  return data;
}

export async function createGradingScanSession(client, input) {
  const { data, error } = await client.rpc("create_grading_scan_session", {
    p_collection_item_id: input.collectionItemId || null,
    p_identity_snapshot: input.identitySnapshot || {},
    p_idempotency_key: input.idempotencyKey,
    p_consent_mode: input.consentMode || "normal",
    p_consent_version:
      input.consentMode === "research" ? input.consentVersion : null,
    p_model_bundle_version: input.modelBundleVersion,
  });
  if (error) throw error;
  return data;
}

export async function updateGradingSessionWorkflow(
  client,
  ownerId,
  scanSessionId,
  status,
  errorCode = null,
) {
  if (!ownerId || !scanSessionId)
    throw new Error("A grading session is required");
  if (!["analyzing", "failed", "cancelled"].includes(status))
    throw new Error("Invalid grading workflow state");
  const { error } = await client
    .from("grading_scan_sessions")
    .update({
      workflow_status: status,
      error_code: errorCode ? String(errorCode).slice(0, 80) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scanSessionId)
    .eq("user_id", ownerId);
  if (error) throw error;
}

export async function updateGradingSessionIdentity(
  client,
  ownerId,
  scanSessionId,
  identitySnapshot,
  collectionItemId = null,
) {
  if (!ownerId || !scanSessionId)
    throw new Error("A grading session is required");
  const update = {
    identity_snapshot: identitySnapshot || {},
    updated_at: new Date().toISOString(),
  };
  if (collectionItemId) update.collection_item_id = collectionItemId;
  const { error } = await client
    .from("grading_scan_sessions")
    .update(update)
    .eq("id", scanSessionId)
    .eq("user_id", ownerId);
  if (error) throw error;
}

export async function updateGradingSessionCaptureProgress(
  client,
  ownerId,
  scanSessionId,
  progress,
) {
  if (!ownerId || !scanSessionId)
    throw new Error("A grading session is required");
  const completedCaptureTypes = Array.isArray(progress?.completedCaptureTypes)
    ? progress.completedCaptureTypes.slice(0, 8)
    : [];
  const { data, error } = await client.rpc("update_grading_capture_progress", {
    p_scan_session_id: scanSessionId,
    p_completed_capture_types: completedCaptureTypes,
    p_next_capture_type: progress?.nextCaptureType || null,
    p_total_required: Math.max(
      1,
      Math.min(8, Number(progress?.totalRequired) || 4),
    ),
  });
  if (error) throw error;
  return data;
}

export async function saveGradingScanReport(client, input) {
  const { data, error } = await client.rpc("save_grading_scan_report", {
    p_scan_session_id: input.scanSessionId,
    p_capture_metadata: input.captures || [],
    p_prediction: input.prediction,
    p_evidence: input.evidence || [],
  });
  if (error) throw error;
  return data;
}

export async function confirmGradingPrediction(client, input) {
  const { data, error } = await client.rpc("confirm_mica_grading_report", {
    p_scan_session_id: input.scanSessionId,
    p_collection_item_id: input.collectionItemId,
  });
  if (error) throw error;
  return data;
}

export async function loadGradingReports(client, collectionItemId) {
  const { data: sessions, error: sessionError } = await client
    .from("grading_scan_sessions")
    .select(
      "id,collection_item_id,identity_snapshot,workflow_status,target_grader,consent_mode,model_bundle_version,rubric_version,started_at,completed_at",
    )
    .eq("collection_item_id", collectionItemId)
    .order("started_at", { ascending: false });
  if (sessionError) throw sessionError;
  if (!(sessions || []).length) return [];
  const sessionIds = sessions.map((session) => session.id);
  const [predictionsResult, evidenceResult, outcomesResult, correctionsResult] =
    await Promise.all([
      client
        .from("grading_predictions")
        .select("*")
        .in("scan_session_id", sessionIds),
      client
        .from("grading_evidence")
        .select("*")
        .in("scan_session_id", sessionIds)
        .order("created_at"),
      client
        .from("grading_outcomes")
        .select("*")
        .in("scan_session_id", sessionIds),
      client
        .from("grading_input_corrections")
        .select(
          "id,scan_session_id,evidence_id,correction_type,original_value,corrected_value,reason,created_at",
        )
        .in("scan_session_id", sessionIds)
        .order("created_at"),
    ]);
  for (const result of [
    predictionsResult,
    evidenceResult,
    outcomesResult,
    correctionsResult,
  ])
    if (result.error) throw result.error;
  return sessions.map((session) => ({
    ...session,
    prediction: (predictionsResult.data || []).find(
      (row) => row.scan_session_id === session.id,
    ),
    evidence: (evidenceResult.data || []).filter(
      (row) => row.scan_session_id === session.id,
    ),
    outcomes: (outcomesResult.data || []).filter(
      (row) => row.scan_session_id === session.id,
    ),
    corrections: (correctionsResult.data || []).filter(
      (row) => row.scan_session_id === session.id,
    ),
  }));
}

export async function loadRecentGradingSessions(client, ownerId, limit = 8) {
  if (!ownerId) throw new Error("An account is required");
  const boundedLimit = Math.min(12, Math.max(1, Number(limit) || 8));
  const { data: sessions, error: sessionError } = await client
    .from("grading_scan_sessions")
    .select(
      "id,collection_item_id,identity_snapshot,workflow_status,error_code,model_bundle_version,rubric_version,thumbnail_path,capture_progress,previous_session_id,report_version,started_at,completed_at,updated_at",
    )
    .eq("user_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);
  if (sessionError) throw sessionError;
  if (!(sessions || []).length) return [];
  const sessionIds = sessions.map((session) => session.id);
  const [predictionsResult, evidenceResult, outcomesResult] = await Promise.all(
    [
      client
        .from("grading_predictions")
        .select(
          "scan_session_id,pregrade_score,pregrade_basis,evidence_profile,outcome_risks,condition_score,condition_status,professional_prediction_status,most_likely_grade,grade_probabilities,condition_low,condition_high,subscores,centering_measurements,confidence,estimate_status,abstention_reason,model_bundle_version,rubric_version,calibration_version,review_consensus,stability,report_snapshot,submission_decision,financial_snapshot,card_family,created_at,confirmed_at",
        )
        .eq("user_id", ownerId)
        .in("scan_session_id", sessionIds),
      client
        .from("grading_evidence")
        .select(
          "id,scan_session_id,side,defect_category,region,severity,confidence,description,verification_status,created_at",
        )
        .eq("user_id", ownerId)
        .in("scan_session_id", sessionIds)
        .order("created_at"),
      client
        .from("grading_outcomes")
        .select(
          "id,scan_session_id,collection_item_id,professional_grader,returned_grade,outcome_kind,returned_label,qualifier,no_grade_code,grader_notes,proof_storage_path,proof_sha256,submission_date,return_date,certification_number,verification_status,updated_at",
        )
        .eq("user_id", ownerId)
        .in("scan_session_id", sessionIds),
    ],
  );
  if (predictionsResult.error) throw predictionsResult.error;
  if (evidenceResult.error) throw evidenceResult.error;
  if (outcomesResult.error) throw outcomesResult.error;
  const thumbnailPaths = [
    ...new Set(
      (sessions || []).map((session) => session.thumbnail_path).filter(Boolean),
    ),
  ];
  const signedByPath = new Map();
  if (thumbnailPaths.length) {
    const { data: signed, error: signedError } = await client.storage
      .from("grading-report-thumbnails")
      .createSignedUrls(thumbnailPaths, 300);
    if (!signedError)
      (signed || []).forEach((entry, index) => {
        if (entry?.signedUrl)
          signedByPath.set(
            entry.path || thumbnailPaths[index],
            entry.signedUrl,
          );
      });
  }
  return sessions.map((session) => ({
    ...session,
    thumbnail_url: signedByPath.get(session.thumbnail_path) || "",
    prediction: (predictionsResult.data || []).find(
      (prediction) => prediction.scan_session_id === session.id,
    ),
    evidence: (evidenceResult.data || []).filter(
      (evidence) => evidence.scan_session_id === session.id,
    ),
    outcomes: (outcomesResult.data || []).filter(
      (outcome) => outcome.scan_session_id === session.id,
    ),
  }));
}

export async function uploadGradingReportThumbnail(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  if (!(input?.blob instanceof Blob) || input.blob.type !== "image/jpeg")
    throw new Error("A private JPEG thumbnail is required");
  if (input.blob.size > 180_000)
    throw new Error("The private report thumbnail is too large");
  const path = `${auth.user.id}/${input.scanSessionId}/card.jpg`;
  const { error: uploadError } = await client.storage
    .from("grading-report-thumbnails")
    .upload(path, input.blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "private, max-age=0, no-store",
    });
  if (uploadError) throw uploadError;
  const { error: updateError } = await client
    .from("grading_scan_sessions")
    .update({ thumbnail_path: path, updated_at: new Date().toISOString() })
    .eq("id", input.scanSessionId)
    .eq("user_id", auth.user.id);
  if (updateError) {
    await client.storage.from("grading-report-thumbnails").remove([path]);
    throw updateError;
  }
  return path;
}

export async function deleteGradingReportThumbnail(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const expectedPrefix = `${auth.user.id}/${input.scanSessionId}/`;
  const path = String(input.path || "");
  if (path && !path.startsWith(expectedPrefix))
    throw new Error("Invalid private thumbnail path");
  if (path) {
    const { error } = await client.storage
      .from("grading-report-thumbnails")
      .remove([path]);
    if (error) throw error;
  }
  const { error } = await client
    .from("grading_scan_sessions")
    .update({ thumbnail_path: null, updated_at: new Date().toISOString() })
    .eq("id", input.scanSessionId)
    .eq("user_id", auth.user.id);
  if (error) throw error;
}

export async function saveGradingFeedback(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const { data, error } = await client
    .from("grading_feedback")
    .insert({
      user_id: auth.user.id,
      scan_session_id: input.scanSessionId,
      evidence_id: input.evidenceId || null,
      feedback_type: input.feedbackType,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveGradingResearchConsent(client, consented) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  if (!consented) {
    const paths = [];
    for (let page = 0; page < 100; page += 1) {
      const { data: sessions, error: listError } = await client.storage
        .from("grading-research")
        .list(auth.user.id, {
          limit: 100,
          offset: page * 100,
          sortBy: { column: "name", order: "asc" },
        });
      if (listError) throw listError;
      if (!(sessions || []).length) break;
      for (const session of sessions || []) {
        const { data: captures, error: captureError } = await client.storage
          .from("grading-research")
          .list(`${auth.user.id}/${session.name}`, { limit: 100 });
        if (captureError) throw captureError;
        paths.push(
          ...(captures || []).map(
            (capture) => `${auth.user.id}/${session.name}/${capture.name}`,
          ),
        );
      }
      if ((sessions || []).length < 100) break;
    }
    for (let index = 0; index < paths.length; index += 100) {
      const { error: removeError } = await client.storage
        .from("grading-research")
        .remove(paths.slice(index, index + 100));
      if (removeError) throw removeError;
    }
    const { error: metadataError } = await client
      .from("grading_captures")
      .update({
        private_storage_path: null,
        retained_for_research: false,
      })
      .eq("retained_for_research", true);
    if (metadataError) throw metadataError;
  }
  const version = "mica-grading-research-v2";
  const now = new Date().toISOString();
  const { error } = await client.from("grading_research_consents").upsert({
    user_id: auth.user.id,
    consented: Boolean(consented),
    consent_version: consented ? version : null,
    training_allowed: Boolean(consented),
    outcome_linkage_allowed: Boolean(consented),
    retention_policy_version: consented
      ? "mica-private-research-retention-v1"
      : null,
    consent_scope: consented
      ? {
          privateCaptures: true,
          conditionModelTraining: true,
          verifiedPsaOutcomeLinkage: true,
          publicSharing: false,
        }
      : {},
    consented_at: consented ? now : null,
    revoked_at: consented ? null : now,
    updated_at: now,
  });
  if (error) throw error;
  return { consented: Boolean(consented), version };
}

export async function uploadGradingResearchCapture(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const path = `${auth.user.id}/${input.scanSessionId}/${input.captureType}.jpg`;
  const { error } = await client.storage
    .from("grading-research")
    .upload(path, input.blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "private, max-age=0",
    });
  if (error) throw error;
  return path;
}

export async function loadGradingResearchConsent(client) {
  const { data, error } = await client
    .from("grading_research_consents")
    .select(
      "consented,consent_version,consented_at,revoked_at,training_allowed,outcome_linkage_allowed,retention_policy_version,consent_scope",
    )
    .maybeSingle();
  if (error) throw error;
  return {
    consented: Boolean(data?.consented && !data?.revoked_at),
    trainingAllowed: Boolean(data?.training_allowed && !data?.revoked_at),
    outcomeLinkageAllowed: Boolean(
      data?.outcome_linkage_allowed && !data?.revoked_at,
    ),
    version: data?.consent_version || null,
    consentedAt: data?.consented_at || null,
  };
}

export async function recordProfessionalGradingOutcome(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const { data, error } = await client
    .from("grading_outcomes")
    .upsert(
      {
        user_id: auth.user.id,
        scan_session_id: input.scanSessionId,
        collection_item_id: input.collectionItemId || null,
        professional_grader: input.grader,
        returned_grade: input.returnedGrade ?? null,
        outcome_kind: input.outcomeKind || "numeric",
        returned_label: input.returnedLabel || String(input.returnedGrade),
        qualifier: input.qualifier || null,
        no_grade_code: input.noGradeCode || null,
        grader_notes: input.graderNotes || null,
        proof_storage_path: input.proofStoragePath || null,
        proof_sha256: input.proofSha256 || null,
        submission_date: input.submissionDate || null,
        return_date: input.returnDate || null,
        certification_number: input.certificationNumber || null,
        verification_status: input.certificationNumber
          ? "proof_attached"
          : "user_reported",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,scan_session_id,professional_grader" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function uploadGradingOutcomeProof(client, input) {
  const file = input?.file;
  const allowedTypes = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["application/pdf", "pdf"],
  ]);
  if (!file || !allowedTypes.has(file.type))
    throw new Error("Use a JPG, PNG, WebP, or PDF proof file");
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 10_485_760)
    throw new Error("Proof files must be 10 MB or smaller");
  if (!input.scanSessionId) throw new Error("A grading report is required");
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const path = `${auth.user.id}/${input.scanSessionId}/${sha256}.${allowedTypes.get(file.type)}`;
  const { error } = await client.storage
    .from("grading-outcome-proofs")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "private, max-age=0",
    });
  if (
    error &&
    !String(error.message || "")
      .toLowerCase()
      .includes("exists")
  )
    throw error;
  return { path, sha256 };
}

export async function deleteGradingOutcomeProof(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const expectedPrefix = `${auth.user.id}/${input.scanSessionId}/`;
  const path = String(input.path || "");
  if (!path || !path.startsWith(expectedPrefix))
    throw new Error("Invalid private proof path");
  const { error } = await client.storage
    .from("grading-outcome-proofs")
    .remove([path]);
  if (error) throw error;
}

export async function setPurchaseMarketReference(client, input) {
  const { data, error } = await client.rpc("set_purchase_market_reference", {
    p_purchase_lot_id: input.purchaseLotId,
    p_market_unit_price: input.marketUnitPrice,
    p_currency: input.currency || "USD",
    p_provider: input.provider,
    p_observed_at: input.observedAt,
  });
  if (error) throw error;
  return data;
}

export async function completeUnknownPurchaseLot(client, input) {
  const { data, error } = await client.rpc("complete_unknown_purchase_lot", {
    p_purchase_lot_id: input.purchaseLotId,
    p_total_acquisition_cost: input.totalAcquisitionCost,
    p_acquired_at: input.acquiredAt,
  });
  if (error) throw error;
  return data;
}

export async function remapCollectionPosition(client, input) {
  const { data, error } = await client.rpc("remap_collection_position", {
    p_collection_item_id: input.collectionItemId,
    p_identity: input.identity,
    p_card_id: input.cardId || null,
    p_variant_id: input.variantId || null,
  });
  if (error) throw error;
  return data;
}

export async function loadIdentityCorrections(client, collectionItemId) {
  const { data, error } = await client
    .from("identity_corrections")
    .select(
      "id,event_type,from_collectible_id,to_collectible_id,from_snapshot,to_snapshot,reason,rule_version,reverses_correction_id,created_at",
    )
    .eq("collection_item_id", collectionItemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function revertIdentityCorrection(client, correctionId) {
  const { data, error } = await client.rpc(
    "revert_collection_identity_correction",
    { p_correction_id: correctionId },
  );
  if (error) throw error;
  return data;
}

export async function splitCollectionPosition(client, input) {
  const { data, error } = await client.rpc("split_collection_position", {
    p_collection_item_id: input.collectionItemId,
    p_quantity: input.quantity,
    p_lot_order: input.lotOrder || "oldest",
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function recordGradingResult(client, input) {
  const { data, error } = await client.rpc("record_grading_result", {
    p_collection_item_id: input.collectionItemId,
    p_transaction_date: input.transactionDate,
    p_grader: input.grader,
    p_grade: input.grade,
    p_total_grading_cost: input.totalGradingCost,
    p_certification_number: input.certificationNumber || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function recordGradingSubmission(client, input) {
  const { data, error } = await client.rpc("record_grading_submission", {
    p_collection_item_id: input.collectionItemId,
    p_submitted_at: input.submittedAt,
    p_grader: input.grader,
    p_expected_return_date: input.expectedReturnDate || null,
    p_submission_reference: input.submissionReference || null,
    p_estimated_total_cost:
      input.estimatedTotalCost === "" ? null : input.estimatedTotalCost,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function updateGradingSubmission(client, input) {
  const { data, error } = await client.rpc("update_grading_submission", {
    p_submission_id: input.submissionId,
    p_status: input.status,
    p_status_updated_at: input.statusUpdatedAt,
    p_expected_return_date: input.expectedReturnDate || null,
    p_submission_reference: input.submissionReference || null,
    p_notes: input.notes || null,
  });
  if (error) throw error;
  return data;
}

export async function recordGradingSubmissionBatch(client, input) {
  const { data, error } = await client.rpc("record_grading_submission_batch", {
    p_entries: input.entries,
    p_submitted_at: input.submittedAt,
    p_grader: input.grader,
    p_service_level: input.serviceLevel,
    p_expected_return_date: input.expectedReturnDate || null,
    p_submission_reference: input.submissionReference || null,
    p_economics_snapshot: input.economicsSnapshot || {},
    p_currency: input.currency || "USD",
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function recordGradingLifecycleDecision(client, input) {
  const { data, error } = await client.rpc(
    "record_grading_lifecycle_decision",
    {
      p_collection_item_id: input.collectionItemId,
      p_state: input.state,
      p_scan_session_id: input.scanSessionId || null,
      p_reason: input.reason,
    },
  );
  if (error) throw error;
  return data;
}

export async function recordGradingInputCorrection(client, input) {
  const { data, error } = await client.rpc("record_grading_input_correction", {
    p_scan_session_id: input.scanSessionId,
    p_evidence_id: input.evidenceId || null,
    p_correction_type: input.correctionType,
    p_original_value: input.originalValue,
    p_corrected_value: input.correctedValue,
    p_reason: input.reason,
  });
  if (error) throw error;
  return data;
}

export async function loadGradingCalibrationSummary(client) {
  const { data, error } = await client.rpc("grading_calibration_summary");
  if (error) throw error;
  return (data || []).map((row) => ({
    grader: row.grader,
    captureQuality: row.capture_quality,
    outcomeCount: Number(row.outcome_count),
    meanAbsoluteError: Number(row.mean_absolute_error),
    meanBias: Number(row.mean_bias),
    exactRate: Number(row.exact_rate),
    withinOneRate: Number(row.within_one_rate),
  }));
}

export async function recordSale(client, input) {
  const { data, error } = await client.rpc(
    input.cardState === "graded"
      ? "record_graded_copy_sale"
      : "record_collection_sale",
    {
      p_collection_item_id: input.collectionItemId,
      p_transaction_date: input.transactionDate,
      p_quantity: input.quantity,
      p_unit_price: input.unitPrice,
      p_marketplace_fees: input.marketplaceFees || 0,
      p_shipping: input.shipping || 0,
      p_other_costs: input.otherCosts || 0,
      p_currency: input.currency || "USD",
      p_marketplace: input.marketplace || null,
      p_notes: input.notes || null,
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error) throw error;
  return data;
}

export async function updatePosition(client, id, values) {
  const payload = {};
  if ("notes" in values) payload.notes = values.notes;
  if ("location" in values) payload.storage_location = values.location;
  if ("certificationNumber" in values)
    payload.certification_number = values.certificationNumber;
  if ("status" in values) payload.status = values.status;
  if ("askingPrice" in values)
    payload.asking_price =
      values.askingPrice === "" ? null : values.askingPrice;
  if ("listingVenue" in values)
    payload.listing_venue = values.listingVenue || null;
  if ("listedAt" in values) payload.listed_at = values.listedAt || null;
  if ("priceReviewedAt" in values)
    payload.price_reviewed_at = values.priceReviewedAt || null;
  if ("imageOverrideUrl" in values)
    payload.image_override_url = values.imageOverrideUrl;
  if ("tags" in values) payload.tags = values.tags;
  if ("collectionId" in values) payload.collection_id = values.collectionId;
  if ("customFields" in values) payload.custom_fields = values.customFields;
  if (!Object.keys(payload).length) return;
  const { error } = await client
    .from("collection_items")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function bulkOrganizePositions(client, input) {
  const ids = [...new Set((input.ids || []).map(String).filter(Boolean))];
  if (!ids.length || ids.length > 500)
    throw new Error("Choose between 1 and 500 positions.");
  const labelMode = ["keep", "add", "remove"].includes(input.labelMode)
    ? input.labelMode
    : "keep";
  const locationMode = ["keep", "set", "clear"].includes(input.locationMode)
    ? input.locationMode
    : "keep";
  const status = ["keep", "owned", "archived"].includes(input.status)
    ? input.status
    : "keep";
  const collectionMode = ["keep", "set"].includes(input.collectionMode)
    ? input.collectionMode
    : "keep";
  const customFieldMode = ["keep", "set", "clear"].includes(
    input.customFieldMode,
  )
    ? input.customFieldMode
    : "keep";
  const label = String(input.label || "").trim();
  const location = String(input.location || "").trim();
  if (labelMode !== "keep" && (!label || label.length > 40))
    throw new Error("Enter a label with 40 characters or fewer.");
  if (locationMode === "set" && (!location || location.length > 250))
    throw new Error("Enter a storage location with 250 characters or fewer.");
  if (
    labelMode === "keep" &&
    locationMode === "keep" &&
    status === "keep" &&
    collectionMode === "keep" &&
    customFieldMode === "keep"
  )
    throw new Error("Choose at least one change.");
  const customFieldKey = String(input.customFieldKey || "").trim();
  if (
    customFieldMode !== "keep" &&
    !/^[a-z0-9][a-z0-9_-]{0,39}$/.test(customFieldKey)
  )
    throw new Error("Choose a valid custom field.");
  const { data, error } = await client.rpc(
    "bulk_organize_collection_items_v2",
    {
      p_ids: ids,
      p_label: label || null,
      p_label_mode: labelMode,
      p_location: location || null,
      p_location_mode: locationMode,
      p_status: status,
      p_collection_id: input.collectionId || null,
      p_collection_mode: collectionMode,
      p_custom_field_key: customFieldKey || null,
      p_custom_field_value:
        customFieldMode === "set" ? input.customFieldValue : null,
      p_custom_field_mode: customFieldMode,
    },
  );
  if (error) throw error;
  if (!data) throw new Error("The organization receipt was not returned.");
  return { operationId: data, updatedIds: ids };
}

export async function undoCollectionOrganization(client, operationId) {
  if (!operationId) throw new Error("Choose an organization change to undo.");
  const { data, error } = await client.rpc(
    "undo_collection_organization_operation",
    { p_operation_id: operationId },
  );
  if (error) throw error;
  return Number(data || 0);
}

export async function loadCollectionPositionCount(client, ownerId = "") {
  let query = client
    .from("collection_items")
    .select("id", { count: "exact", head: true });
  if (ownerId) query = query.eq("user_id", ownerId);
  const { count, error } = await query;
  if (error) throw error;
  return Number(count || 0);
}

export async function loadCollectionOrganization(client, ownerId = "") {
  const [
    folders,
    views,
    goals,
    goalEvents,
    operations,
    fields,
    summary,
    allPositionCount,
  ] = await Promise.all([
    client
      .from("collections")
      .select(
        "id,name,description,color,sort_order,archived_at,created_at,updated_at",
      )
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    client
      .from("saved_views")
      .select(
        "id,name,collection_id,configuration,configuration_version,created_at,updated_at",
      )
      .order("updated_at", { ascending: false }),
    client
      .from("collection_goals")
      .select(
        "id,collection_id,name,goal_type,dimension,criteria,targets,target_count,metadata_status,catalog_source,catalog_version,last_progress,archived_at,created_at,updated_at",
      )
      .is("archived_at", null)
      .order("updated_at", { ascending: false }),
    client
      .from("collection_goal_events")
      .select("id,goal_id,event_type,progress,occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(100),
    client
      .from("collection_organization_operations")
      .select(
        "id,operation_type,item_count,requested_changes,reverses_operation_id,undone_at,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    client
      .from("collection_custom_field_definitions")
      .select("id,key,name,value_type,help_text,created_at,updated_at")
      .order("name"),
    client.rpc("get_collection_organization_summary"),
    loadCollectionPositionCount(client, ownerId),
  ]);
  for (const result of [
    folders,
    views,
    goals,
    goalEvents,
    operations,
    fields,
    summary,
  ])
    if (result.error) throw result.error;
  return {
    version: "mica-organization-v1",
    folders: folders.data || [],
    savedViews: (views.data || []).map((view) => ({
      id: view.id,
      name: view.name,
      collectionId: view.collection_id || null,
      configuration: view.configuration || {},
      configurationVersion: view.configuration_version,
      createdAt: view.created_at,
      updatedAt: view.updated_at,
    })),
    goals: (goals.data || []).map((goal) => ({
      id: goal.id,
      collectionId: goal.collection_id || null,
      name: goal.name,
      goalType: goal.goal_type,
      dimension: goal.dimension,
      criteria: goal.criteria || {},
      targets: goal.targets || [],
      targetCount: goal.target_count,
      metadataStatus: goal.metadata_status,
      catalogSource: goal.catalog_source,
      catalogVersion: goal.catalog_version,
      progress: goal.last_progress || {},
      createdAt: goal.created_at,
      updatedAt: goal.updated_at,
    })),
    goalEvents: goalEvents.data || [],
    operations: operations.data || [],
    customFields: fields.data || [],
    summary: { ...(summary.data || {}), allPositionCount },
  };
}

export async function loadCollectionOrganizationSummary(client) {
  const { data, error } = await client.rpc(
    "get_collection_organization_summary",
  );
  if (error) throw error;
  return data || {};
}

export async function saveCollectionFolder(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const payload = {
    user_id: auth.user.id,
    name: String(input.name || "").trim(),
    description: String(input.description || "").trim() || null,
    color: String(input.color || "").trim() || null,
    sort_order: Number(input.sortOrder) || 0,
    updated_at: new Date().toISOString(),
  };
  if (!payload.name || payload.name.length > 100)
    throw new Error("Folder names must contain 1 to 100 characters.");
  let query = input.id
    ? client.from("collections").update(payload).eq("id", input.id)
    : client.from("collections").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data.id;
}

export async function saveCollectionView(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const name = String(input.name || "").trim();
  if (!name || name.length > 100)
    throw new Error("Saved-view names must contain 1 to 100 characters.");
  const payload = {
    user_id: auth.user.id,
    name,
    collection_id: input.collectionId || null,
    configuration: input.configuration || {},
    configuration_version: "mica-organization-v1",
    updated_at: new Date().toISOString(),
  };
  let query = input.id
    ? client.from("saved_views").update(payload).eq("id", input.id)
    : client.from("saved_views").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data.id;
}

export async function saveCollectionCustomField(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const key = String(input.key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const name = String(input.name || "").trim();
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(key))
    throw new Error(
      "Custom-field keys must use letters, numbers, dashes, or underscores.",
    );
  if (!name || name.length > 80)
    throw new Error("Custom-field names must contain 1 to 80 characters.");
  const { data, error } = await client
    .from("collection_custom_field_definitions")
    .insert({
      user_id: auth.user.id,
      key,
      name,
      value_type: ["text", "number", "boolean", "date"].includes(
        input.valueType,
      )
        ? input.valueType
        : "text",
      help_text: String(input.helpText || "").trim() || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteCollectionView(client, id) {
  const { error } = await client.from("saved_views").delete().eq("id", id);
  if (error) throw error;
}

export async function saveCollectionGoal(client, input) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  const payload = {
    user_id: auth.user.id,
    collection_id: input.collectionId || null,
    name: String(input.name || "").trim(),
    goal_type: input.goalType,
    dimension: input.dimension,
    criteria: input.criteria || {},
    targets: input.targets || [],
    target_count: input.goalType === "quantity" ? input.targetCount : null,
    metadata_status: input.metadataStatus || "incomplete",
    catalog_source: input.catalogSource || null,
    catalog_version: input.catalogVersion || null,
    updated_at: new Date().toISOString(),
  };
  let query = input.id
    ? client.from("collection_goals").update(payload).eq("id", input.id)
    : client.from("collection_goals").insert(payload);
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  return data.id;
}

export async function archiveCollectionGoal(client, id) {
  const { error } = await client
    .from("collection_goals")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function loadCollectionPositionAttachments(client, positionId) {
  const { data, error } = await client
    .from("collection_item_attachments")
    .select(
      "id,collection_item_id,kind,storage_path,filename,mime_type,byte_size,sha256,caption,created_at",
    )
    .eq("collection_item_id", positionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadCollectionPositionAttachment(client, input) {
  const file = input?.file;
  const allowed = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["application/pdf", "pdf"],
  ]);
  if (!file || !allowed.has(file.type))
    throw new Error("Use a JPG, PNG, WebP, or PDF file.");
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > 10_485_760)
    throw new Error("Files must be 10 MB or smaller.");
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth?.user) throw new Error("Sign in is required");
  if (input.ownerId && input.ownerId !== auth.user.id)
    throw new Error("Photo owner changed");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  const path = `${auth.user.id}/${input.positionId}/${sha256}.${allowed.get(file.type)}`;
  const { error: uploadError } = await client.storage
    .from("collection-item-files")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "private, max-age=0",
    });
  if (
    uploadError &&
    !String(uploadError.message || "")
      .toLowerCase()
      .includes("exists")
  )
    throw uploadError;
  const { data, error } = await client
    .from("collection_item_attachments")
    .upsert(
      {
        user_id: auth.user.id,
        collection_item_id: input.positionId,
        kind: file.type === "application/pdf" ? "document" : "photo",
        storage_path: path,
        filename: String(
          file.name || `attachment.${allowed.get(file.type)}`,
        ).slice(0, 255),
        mime_type: file.type,
        byte_size: file.size,
        sha256,
        caption: String(input.caption || "").trim() || null,
      },
      { onConflict: "user_id,storage_path", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id;
  const { data: existing, error: lookupError } = await client
    .from("collection_item_attachments")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("storage_path", path)
    .single();
  if (lookupError) throw lookupError;
  return existing.id;
}

export async function deleteCollectionPositionAttachment(
  client,
  attachment,
  ownerId,
) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (
    !ownerId ||
    auth?.user?.id !== ownerId ||
    !attachment.storage_path?.startsWith(`${ownerId}/`)
  )
    throw new Error("File owner changed");
  const { error: deleteError } = await client
    .from("collection_item_attachments")
    .delete()
    .eq("id", attachment.id);
  if (deleteError) throw deleteError;
  const { data: currentAuth, error: currentAuthError } =
    await client.auth.getUser();
  if (currentAuthError) throw currentAuthError;
  if (currentAuth?.user?.id !== ownerId) throw new Error("File owner changed");
  const { error: storageError } = await client.storage
    .from("collection-item-files")
    .remove([attachment.storage_path]);
  if (storageError) throw storageError;
}

export async function createCollectionAttachmentDownloadUrl(
  client,
  storagePath,
) {
  const { data, error } = await client.storage
    .from("collection-item-files")
    .createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function loadCollectionSearchPage(client, input = {}) {
  const { data, error } = await client.rpc("search_collection_positions", {
    p_query: String(input.query || "").trim(),
    p_filters: input.filters || {},
    p_sort: input.sort || "name",
    p_limit: Math.min(Math.max(Number(input.limit) || 100, 1), 200),
    p_after_value: input.cursor?.value || null,
    p_after_id: input.cursor?.id || null,
  });
  if (error) throw error;
  const rows = data || [];
  const last = rows.at(-1);
  const pageLimit = Math.min(Math.max(Number(input.limit) || 100, 1), 200);
  const rawPositions = rows.map((row) => row.position_row);
  const positions = await loadPortfolioRows(client, "", rawPositions);
  return {
    positions,
    totalCount: rows.length
      ? Number(rows[0].total_count || 0)
      : input.cursor
        ? null
        : 0,
    nextCursor:
      last && rows.length === pageLimit
        ? { value: last.sort_value, id: last.position_row.id }
        : null,
  };
}
export async function deletePosition(client, id) {
  const { error } = await client.rpc("delete_collection_position", {
    p_collection_item_id: id,
  });
  if (error) throw error;
}
export async function loadDiagnostics(client) {
  const [providers, anomalies, mappings] = await Promise.all([
    client.from("provider_sync_status").select("*").order("provider"),
    client
      .from("price_anomalies")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("card_provider_mappings")
      .select("id,provider,match_status,match_confidence,updated_at")
      .in("match_status", ["ambiguous", "missing"])
      .limit(50),
  ]);
  return {
    providers: providers.data || [],
    anomalies: anomalies.data || [],
    mappings: mappings.data || [],
    errors: [providers.error, anomalies.error, mappings.error].filter(Boolean),
  };
}

export async function saveWebPushSubscription(client, ownerId, subscription) {
  if (
    !ownerId ||
    !subscription?.endpoint ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  )
    throw new Error("Invalid device subscription");
  const { error } = await client.from("web_push_subscriptions").upsert(
    {
      user_id: ownerId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_secret: subscription.keys.auth,
      enabled: true,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) throw error;
}

export async function removeWebPushSubscription(client, ownerId, endpoint) {
  if (!ownerId || !endpoint) throw new Error("Missing device owner");
  const { error } = await client
    .from("web_push_subscriptions")
    .delete()
    .eq("user_id", ownerId)
    .eq("endpoint", endpoint);
  if (error) throw error;
}
