import { exactSoldValuation, EXACT_SOLD_RULE_VERSION } from "./pricing.js";

export const GRADED_VALUATION_PRODUCER = "mica-server-exact-sold-v1";
const CONTEXT_FIELDS = [
  "canonicalId",
  "identityStatus",
  "name",
  "set",
  "number",
  "language",
  "variant",
  "finish",
  "edition",
  "promoType",
  "grader",
  "grade",
  "qualifier",
  "currency",
];

function sameContext(left, right) {
  return CONTEXT_FIELDS.every(
    (field) => String(left?.[field] ?? "") === String(right?.[field] ?? ""),
  );
}

export function storedGradedContext(position) {
  const identity = position.identity_snapshot || {};
  return {
    canonicalId: identity.providerCardId || "",
    identityStatus: identity.identityStatus || "needs_review",
    name: identity.name || "",
    set: identity.set || identity.setName || "",
    number: identity.number || identity.collectorNumber || "",
    language: identity.language || "",
    variant: identity.variant || "",
    finish: identity.finish || "",
    edition: identity.edition || "",
    promoType: identity.promoType || "",
    grader: position.grader || "",
    grade: position.grade,
    qualifier: identity.gradeQualifier || "",
    currency: position.currency || "",
  };
}

export function gradedLookup(context, position) {
  return {
    clientId: context.canonicalId,
    pkmnpricesId: position.identity_snapshot?.externalIds?.pkmnprices || "",
    name: context.name,
    set: context.set,
    number: context.number,
    language: context.language,
    variant: context.variant,
    finish: context.finish,
    edition: context.edition,
    promoType: context.promoType,
    grader: context.grader,
    grade: String(context.grade || ""),
    gradeQualifier: context.qualifier,
    currency: context.currency,
  };
}

function envelope(context, providerCardId) {
  return {
    ...gradedLookup(context, { identity_snapshot: {} }),
    providerCardId,
    canonicalValidated: true,
    completedSaleValidated: true,
  };
}

const SALE_FIELDS = [
  "attribution",
  "evidenceKind",
  "saleType",
  "provider",
  "providerSaleId",
  "evidenceId",
  "source",
  "marketplace",
  "marketplaceTransactionId",
  "sourceUrl",
  "soldAt",
  "retrievedAt",
  "amount",
  "currency",
  "gradingCompany",
  "grade",
  "gradeQualifier",
  "printing",
  "language",
];

export function exactSoldObservation(
  position,
  providerResult,
  retrievedAt,
  now = Date.now(),
) {
  const context = storedGradedContext(position);
  const orderedSales = [...providerResult.sales].sort((a, b) =>
    String(a.providerSaleId || a.evidenceId).localeCompare(
      String(b.providerSaleId || b.evidenceId),
    ),
  );
  const result = exactSoldValuation(orderedSales, context, {
    validatedContext: envelope(context, providerResult.cardId),
    retrievedAt,
    hasMore: providerResult.hasMore,
    now,
  });
  if (result.status !== "ready") return { result, row: null };
  const sales = result.evidence.map((sale) =>
    Object.fromEntries(
      SALE_FIELDS.filter((field) => sale[field] !== undefined).map((field) => [
        field,
        sale[field],
      ]),
    ),
  );
  const row = {
    user_id: position.user_id,
    collection_item_id: position.id,
    collectible_id: position.collectible_id,
    aggregator: "pkmnprices",
    provider: "pkmnprices",
    provider_variant_id: String(providerResult.cardId),
    currency: context.currency,
    valuation_type: "provider_estimate",
    finish: context.finish,
    card_state: "graded",
    raw_condition: "",
    grader: context.grader,
    grade: Number(context.grade),
    grade_label: String(context.grade),
    amount: result.estimate,
    price_low: result.rangeLow,
    price_high: result.rangeHigh,
    sales_count: result.distinctSaleCount,
    granularity: "observation",
    quality: { producer: GRADED_VALUATION_PRODUCER, context },
    observed_at: result.evaluatedAt,
    retrieved_at: retrievedAt,
    provider_updated_at: result.newestSoldAt,
    market: "ebay",
    region: context.currency === "EUR" ? "EU" : "US",
    language: context.language,
    printing: context.variant,
    evidence_kind: "completed_sale",
    derivation: "aggregated",
    capability_status: "live",
    exclusion_status: "included",
    evidence_rule_version: EXACT_SOLD_RULE_VERSION,
    source_metadata: {
      producer: GRADED_VALUATION_PRODUCER,
      providerCardId: String(providerResult.cardId),
      sales,
      contributingEvidenceIds: result.contributingEvidenceIds,
      newestSoldAt: result.newestSoldAt,
      hasMore: result.hasMore,
    },
  };
  return { result, row };
}

export function readExactSoldObservation(row, position, now = Date.now()) {
  const metadata = row?.source_metadata;
  const context = row?.quality?.context;
  if (
    row?.quality?.producer !== GRADED_VALUATION_PRODUCER ||
    metadata?.producer !== GRADED_VALUATION_PRODUCER ||
    row?.provider !== "pkmnprices" ||
    row?.valuation_type !== "provider_estimate" ||
    row?.evidence_kind !== "completed_sale" ||
    row?.derivation !== "aggregated" ||
    row?.evidence_rule_version !== EXACT_SOLD_RULE_VERSION ||
    row?.card_state !== "graded" ||
    row?.capability_status !== "live" ||
    row?.exclusion_status !== "included" ||
    row?.user_id !== position.user_id ||
    row?.collection_item_id !== position.id ||
    !Array.isArray(metadata?.sales) ||
    !metadata?.providerCardId ||
    !context ||
    !Number.isFinite(Date.parse(row.observed_at)) ||
    Date.parse(row.observed_at) > now
  )
    return null;
  const historical = exactSoldValuation(metadata.sales, context, {
    validatedContext: envelope(context, metadata.providerCardId),
    retrievedAt: row.retrieved_at,
    hasMore: metadata.hasMore === true,
    now: Date.parse(row.observed_at),
  });
  if (
    historical.status !== "ready" ||
    Number(row.amount) !== historical.estimate ||
    Number(row.price_low) !== historical.rangeLow ||
    Number(row.price_high) !== historical.rangeHigh ||
    Number(row.sales_count) !== historical.distinctSaleCount ||
    JSON.stringify(metadata.contributingEvidenceIds) !==
      JSON.stringify(historical.contributingEvidenceIds) ||
    String(row.currency) !== historical.currency ||
    String(row.provider_variant_id) !== String(metadata.providerCardId) ||
    String(row.grader) !== String(context.grader) ||
    Number(row.grade) !== Number(context.grade) ||
    String(row.finish) !== String(context.finish) ||
    String(row.language) !== String(context.language) ||
    String(row.printing) !== String(context.variant) ||
    Date.parse(row.provider_updated_at) !== Date.parse(historical.newestSoldAt)
  )
    return null;
  const currentContext = storedGradedContext(position);
  const contextMatches = sameContext(currentContext, context);
  const active =
    ["owned", "listed"].includes(position.status) &&
    Number(position.quantity ?? 1) > 0;
  const current =
    contextMatches && active
      ? exactSoldValuation(metadata.sales, context, {
          validatedContext: envelope(context, metadata.providerCardId),
          retrievedAt: row.retrieved_at,
          hasMore: metadata.hasMore === true,
          now,
        })
      : null;
  const contributing = historical.evidence.filter((sale) =>
    historical.contributingEvidenceIds.includes(sale.transactionKey),
  );
  const oldestContributor = Math.min(
    ...contributing.map((sale) => Date.parse(sale.soldAt)),
  );
  const currentUntil = Math.min(
    Date.parse(historical.newestSoldAt) + 30 * 86400000,
    oldestContributor + 90 * 86400000,
  );
  return {
    amount: historical.estimate,
    currency: historical.currency,
    recordedAt: row.observed_at,
    provider: "pkmnprices completed sales",
    verifiedExactSold: true,
    contextValidated: contextMatches,
    current:
      current?.status === "ready"
        ? { ...current, contextValidated: true }
        : null,
    currentUntil,
    saleEvidence: contextMatches
      ? {
          salesStatus: "live",
          sales: metadata.sales,
          validatedContext: envelope(context, metadata.providerCardId),
          retrievedAt: row.retrieved_at,
          recordedAt: row.observed_at,
          hasMore: metadata.hasMore === true,
        }
      : null,
    contributingEvidenceIds: historical.contributingEvidenceIds,
    ruleVersion: historical.ruleVersion,
  };
}
