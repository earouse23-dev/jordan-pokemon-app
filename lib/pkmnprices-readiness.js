import {
  normalizePkmnPricesSale,
  saleMatchesCanonicalIdentity,
  saleMatchesLookup,
} from "./providers/pkmnprices.js";

const DEFAULT_BASE_URL = "https://api.pkmnprices.com";
const LANGUAGES = [
  ["en", "English"],
  ["ja", "Japanese"],
  ["de", "German"],
];
const GRADERS = ["PSA", "BGS"];

export function numericResponseHeader(response, name) {
  const raw = response?.headers?.get(name);
  if (raw === null || raw === undefined || String(raw).trim() === "")
    return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function providerFailureKind(status, body = {}) {
  const code = String(body?.error?.code || body?.code || "").toLowerCase();
  const message = String(
    body?.error?.message || body?.message || "",
  ).toLowerCase();
  if (
    status === 401 ||
    code.includes("invalid_key") ||
    code.includes("invalid_api_key") ||
    message.includes("invalid api key") ||
    message.includes("api key is invalid")
  )
    return "invalid_key";
  if (status === 403) return "entitlement_denied";
  if (status === 429) return "rate_limited";
  return "http_failure";
}

export function createCreditBudget(requestedMaximum = 40) {
  const parsed = Number(requestedMaximum);
  const maximum = Number.isInteger(parsed)
    ? Math.min(40, Math.max(1, parsed))
    : 40;
  let plannedUpperBound = 0;
  let observedReturnedItems = 0;
  let reportedCharges = 0;
  let chargedHeaderCount = 0;
  let missingChargedHeaderCount = 0;
  return {
    maximum,
    reserve(upperBound) {
      const amount = Math.max(0, Number(upperBound) || 0);
      if (plannedUpperBound + amount > maximum) return false;
      plannedUpperBound += amount;
      return true;
    },
    observe(response, body) {
      observedReturnedItems += Array.isArray(body?.data) ? body.data.length : 0;
      const charged = numericResponseHeader(response, "x-credits-charged");
      if (charged === null) missingChargedHeaderCount += 1;
      else {
        chargedHeaderCount += 1;
        reportedCharges += charged;
      }
    },
    snapshot() {
      return {
        requestedMaximum: maximum,
        plannedUpperBound,
        observedReturnedItems,
        reportedCharges:
          missingChargedHeaderCount === 0 ? reportedCharges : null,
        reportedChargeHeadersKnown: chargedHeaderCount,
        reportedChargeHeadersMissing: missingChargedHeaderCount,
      };
    },
  };
}

export function classifyPkmnPricesSaleEvidence(row, card, language, grader) {
  const sale = normalizePkmnPricesSale(row);
  if (!sale) return { status: "excluded", reason: "invalid_sale_row" };
  if (!sale.currency)
    return { status: "excluded", reason: "missing_currency", sale };
  if (!sale.ingestedAt)
    return { status: "excluded", reason: "missing_ingested_at", sale };
  if (!sale.grade) return { status: "excluded", reason: "missing_grade", sale };
  if (!sale.printing)
    return { status: "excluded", reason: "missing_printing", sale };
  if (!sale.sourceUrl)
    return { status: "excluded", reason: "missing_source_link", sale };
  if (sale.attribution !== "exact")
    return { status: "excluded", reason: "non_exact_attribution", sale };
  const lookup = {
    language,
    name: card?.name,
    set: card?.set?.name,
    number:
      card?.number && card?.total_set_number
        ? `${card.number}/${card.total_set_number}`
        : card?.number,
    variant: sale.printing,
    grader,
    grade: sale.grade,
    gradeQualifier: sale.gradeQualifier || "",
  };
  if (!saleMatchesLookup(sale, lookup))
    return {
      status: "excluded",
      reason: "exact_context_mismatch",
      sale,
      lookup,
    };
  if (!saleMatchesCanonicalIdentity(sale, card, lookup))
    return {
      status: "excluded",
      reason: "canonical_identity_mismatch_or_ambiguous",
      sale,
      lookup,
    };
  return { status: "accepted", reason: null, sale, lookup };
}

function sanitizedSaleReview(classification) {
  const sale = classification.sale || {};
  return {
    title: sale.title || null,
    disposition: classification.status,
    reason: classification.reason,
    attribution: sale.attribution || null,
    grader: sale.gradingCompany || null,
    grade: sale.grade || null,
    qualifier: sale.gradeQualifier || null,
    variant: sale.printing || null,
    currency: sale.currency || null,
    soldAt: sale.soldAt || null,
    ingestedAt: sale.ingestedAt || null,
    sourceLinkPresent: Boolean(sale.sourceUrl),
  };
}

export async function runPkmnPricesReadiness({
  apiKey,
  liveAuthorized = false,
  maxCredits = 40,
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  now = () => new Date(),
} = {}) {
  const budget = createCreditBudget(maxCredits);
  const results = [];
  const coverage = [];
  const catalog = new Map();
  let stopReason = null;
  let firstExact = null;

  const record = (entry) => results.push(entry);
  const probe = async (
    feature,
    path,
    { authenticated = true, maxReturnedItems = 1 } = {},
  ) => {
    if (authenticated && stopReason) return null;
    if (authenticated && !budget.reserve(maxReturnedItems)) {
      record({
        feature,
        status: "budget_skipped",
        httpStatus: null,
        endpointAccessible: false,
        nonempty: null,
        maxReturnedItems,
      });
      return null;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        headers: {
          Accept: "application/json",
          ...(authenticated ? { "X-API-Key": apiKey } : {}),
        },
        signal: controller.signal,
      });
      const body = await response.json().catch(() => ({}));
      if (authenticated) budget.observe(response, body);
      const rows = Array.isArray(body?.data) ? body.data : null;
      if (!response.ok) {
        const status = providerFailureKind(response.status, body);
        if (
          ["invalid_key", "entitlement_denied", "rate_limited"].includes(status)
        )
          stopReason = status;
        record({
          feature,
          status,
          httpStatus: response.status,
          endpointAccessible: false,
          nonempty: null,
          maxReturnedItems,
        });
        return null;
      }
      record({
        feature,
        status: "accessible",
        httpStatus: response.status,
        endpointAccessible: true,
        nonempty: rows ? rows.length > 0 : null,
        returnedItems: rows?.length ?? null,
        maxReturnedItems,
      });
      return body;
    } catch (error) {
      record({
        feature,
        status: error?.name === "AbortError" ? "timeout" : "network_failure",
        httpStatus: null,
        endpointAccessible: false,
        nonempty: null,
        maxReturnedItems,
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  await probe("provider_health", "/health", {
    authenticated: false,
    maxReturnedItems: 0,
  });

  if (!apiKey) {
    stopReason = "setup_required";
    record({
      feature: "authentication",
      status: stopReason,
      httpStatus: null,
      endpointAccessible: false,
      nonempty: null,
      maxReturnedItems: 0,
    });
  } else if (!liveAuthorized) {
    stopReason = "authorization_required";
    record({
      feature: "authenticated_probe",
      status: stopReason,
      httpStatus: null,
      endpointAccessible: false,
      nonempty: null,
      maxReturnedItems: 0,
    });
  } else {
    for (const [language, providerLanguage] of LANGUAGES) {
      const query = new URLSearchParams({
        name: "Pikachu",
        language: providerLanguage,
        per_page: "1",
      });
      const body = await probe(
        `catalog_${language}`,
        `/v1/cards?${query.toString()}`,
      );
      const card = Array.isArray(body?.data) ? body.data[0] : null;
      if (card?.id) catalog.set(language, card);
      if (stopReason) break;
    }

    for (const [language] of LANGUAGES) {
      for (const grader of GRADERS) {
        const card = catalog.get(language) || null;
        const cardId = card?.id == null ? null : String(card.id);
        const cell = {
          cardId,
          language,
          grader,
          canonicalIdentity: card
            ? {
                name: card.name || null,
                set: card.set?.name || null,
                number:
                  card.number && card.total_set_number
                    ? `${card.number}/${card.total_set_number}`
                    : card.number || null,
              }
            : null,
          advertised: true,
          endpointAccessible: false,
          nonempty: false,
          receivedCount: 0,
          acceptedCount: 0,
          excludedCount: 0,
          exclusionReasons: {},
          rowReviews: [],
          exactEligibleCount: 0,
          resultCount: 0,
          requestTime: null,
          contexts: [],
          currencies: [],
          newestSoldDate: null,
          applicationNormalized: false,
          status: cardId ? "not_requested" : "catalog_match_unavailable",
        };
        if (cardId && !stopReason) {
          const query = new URLSearchParams({
            graded: "true",
            grader,
            limit: "3",
            sort: "date_desc",
          });
          cell.requestTime = now().toISOString();
          const body = await probe(
            `sold_${language}_${grader.toLowerCase()}`,
            `/v1/cards/${encodeURIComponent(cardId)}/listings/ebay?${query.toString()}`,
            { maxReturnedItems: 3 },
          );
          const rows = Array.isArray(body?.data) ? body.data : [];
          const classified = rows.map((row) =>
            classifyPkmnPricesSaleEvidence(row, card, language, grader),
          );
          const exact = classified.filter(
            (classification) => classification.status === "accepted",
          );
          cell.endpointAccessible = Boolean(body);
          cell.nonempty = rows.length > 0;
          cell.receivedCount = rows.length;
          cell.acceptedCount = exact.length;
          cell.excludedCount = classified.length - exact.length;
          cell.exclusionReasons = classified
            .filter((classification) => classification.status === "excluded")
            .reduce((counts, classification) => {
              counts[classification.reason] =
                (counts[classification.reason] || 0) + 1;
              return counts;
            }, {});
          cell.rowReviews = classified.map(sanitizedSaleReview);
          cell.resultCount = rows.length;
          cell.exactEligibleCount = exact.length;
          cell.status = !body
            ? stopReason || "unavailable"
            : exact.length
              ? "exact_evidence_available"
              : rows.length
                ? "no_exact_eligible_rows"
                : "empty";
          cell.contexts = exact.map(({ sale }) => ({
            grade: sale.grade,
            qualifier: sale.gradeQualifier,
            variant: sale.printing,
          }));
          cell.currencies = [
            ...new Set(exact.map(({ sale }) => sale.currency)),
          ];
          cell.newestSoldDate =
            exact
              .map(({ sale }) => sale.soldAt)
              .filter(Boolean)
              .sort()
              .at(-1) || null;
          if (!firstExact && exact[0]) {
            const { sale, lookup } = exact[0];
            firstExact = {
              cardId,
              name: card.name || null,
              set: card.set?.name || null,
              number:
                card.number && card.total_set_number
                  ? `${card.number}/${card.total_set_number}`
                  : card.number || null,
              language,
              grader: lookup.grader,
              grade: lookup.grade,
              qualifier: lookup.gradeQualifier || null,
              variant: lookup.variant,
              currency: sale.currency,
              soldAt: sale.soldAt,
              ingestedAt: sale.ingestedAt,
              attribution: sale.attribution,
              sourceLinkPresent: Boolean(sale.sourceUrl),
              applicationNormalized: true,
            };
            cell.applicationNormalized = true;
          }
        } else if (stopReason) {
          cell.status = `skipped_${stopReason}`;
        }
        coverage.push(cell);
      }
    }
  }

  const halfGradeOrLabel = coverage
    .flatMap((cell) => cell.contexts)
    .find(
      (context) =>
        String(context.grade || "").includes(".") || Boolean(context.qualifier),
    );
  const overall = firstExact
    ? "verified"
    : stopReason === "invalid_key"
      ? "blocked_authentication"
      : stopReason === "entitlement_denied"
        ? "blocked_entitlement"
        : stopReason === "rate_limited"
          ? "blocked_rate_limited"
          : stopReason === "setup_required"
            ? "blocked_setup"
            : stopReason === "authorization_required"
              ? "authorization_required"
              : "blocked_no_exact_evidence";

  return {
    checkedAt: now().toISOString(),
    overall,
    stopReason,
    liveAuthorized,
    creditBudget: budget.snapshot(),
    results,
    coverage,
    applicationCase: firstExact,
    halfGradeOrLabelCase: halfGradeOrLabel || null,
    note: "Sanitized summary only; no key or raw provider payload is retained.",
  };
}
