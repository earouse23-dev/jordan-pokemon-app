import { loadEnvFile } from "node:process";
import { normalizeTcgdexCard } from "../lib/providers/tcgdex.js";
import { exactSoldValuation, EXACT_SOLD_RULE_VERSION } from "../lib/pricing.js";
import salesHandler from "../api/sales.js";
import { createClient05bGuard } from "./client-05b-guard.mjs";

const sourceUrl = "https://api.tcgdex.net/v2/en/cards/2023sv-6";
const providerSet = "McDonald's Promos 2023";
const lookup = Object.freeze({
  clientId: "tcgdex:en:2023sv-6",
  pkmnpricesId: "10195",
  name: "Pikachu",
  set: providerSet,
  number: "006/015",
  language: "en",
  variant: "Holofoil",
  finish: "holofoil",
  edition: "unlimited", // Astra's source-scoped diagnostic inference.
  promoType: "none", // No extra printing qualifier beyond the promo set.
  grader: "PSA",
  grade: "10",
  gradeQualifier: "",
  currency: "USD",
});

function sourceMatches(card) {
  const variant = card?.variants_detailed;
  return (
    card?.id === "2023sv-6" &&
    card?.name === "Pikachu" &&
    String(card?.localId) === "6" &&
    card?.set?.id === "2023sv" &&
    card?.set?.name === "McDonald's Collection 2023" &&
    Number(card?.set?.cardCount?.official) === 15 &&
    card?.variants?.holo === true &&
    card?.variants?.normal === false &&
    card?.variants?.reverse === false &&
    card?.variants?.firstEdition === false &&
    card?.variants?.wPromo === false &&
    Array.isArray(variant) &&
    variant.length === 1 &&
    variant[0]?.variantId === "jr7oetx1mqug9" &&
    variant[0]?.type === "holo" &&
    variant[0]?.size === "standard" &&
    !Object.hasOwn(variant[0], "subtype") &&
    !Object.hasOwn(variant[0], "stamp")
  );
}

function middle(values) {
  if (!values.length) return null;
  const ordered = values.toSorted((a, b) => a - b);
  const index = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[index]
    : (ordered[index - 1] + ordered[index]) / 2;
}

function independentSales(rawRows, now) {
  const reasons = {};
  const reject = (reason) => {
    reasons[reason] = (reasons[reason] || 0) + 1;
  };
  const byTransaction = new Map();
  for (const row of rawRows) {
    const title = String(row?.title || "");
    const words = title.toLowerCase();
    const amount = Number(row?.price);
    const sold = Date.parse(row?.sold_at);
    const date = String(row?.sold_at || "").slice(0, 10);
    let url;
    try {
      url = new URL(row?.listing_url);
    } catch {
      url = null;
    }
    const listing = url?.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
    if (row?.attribution !== "exact") reject("attribution_not_exact");
    else if (
      !/\bPikachu\b/i.test(title) ||
      /\b(Flying|Celebrations|bundle|lot|playset|pair|staff|stamp)\b/i.test(
        title,
      ) ||
      !/McDonald/i.test(title) ||
      !/\b2023\b/.test(title) ||
      !/(?:\b0*6\s*\/\s*0*15\b|#\s*0*6\b)/i.test(title)
    )
      reject("title_identity_or_printing_uncertain");
    else if (
      String(row.variant || "").toLowerCase() !== "holofoil" ||
      String(row.grader || "").toUpperCase() !== "PSA" ||
      Number(row.grade) !== 10 ||
      String(row.grade_qualifier || "").trim() ||
      (row.language &&
        !["en", "english"].includes(String(row.language).toLowerCase()))
    )
      reject("grade_finish_label_or_language_mismatch");
    else if (String(row.currency || "").toUpperCase() !== "USD")
      reject("currency_mismatch");
    else if (!Number.isFinite(amount) || amount <= 0) reject("invalid_amount");
    else if (
      !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(row.sold_at || "")) ||
      !Number.isFinite(sold) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date ||
      sold > now ||
      sold < now - 90 * 86400000
    )
      reject("invalid_or_outside_window");
    else if (
      url?.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !/^(?:www\.)?ebay\.(?:com|co\.uk|ca|de|fr|it|es|com\.au)$/.test(
        url.hostname,
      ) ||
      !listing
    )
      reject("missing_transaction_source");
    else {
      const existing = byTransaction.get(listing) || [];
      existing.push({ amount, sold, soldAt: row.sold_at });
      byTransaction.set(listing, existing);
    }
  }
  const distinct = [];
  for (const rows of byTransaction.values()) {
    if (
      rows.some(
        (row) => row.amount !== rows[0].amount || row.sold !== rows[0].sold,
      )
    ) {
      rows.forEach(() => reject("conflicting_duplicate"));
    } else {
      distinct.push(rows[0]);
      rows.slice(1).forEach(() => reject("duplicate_transaction"));
    }
  }
  const baseline = middle(distinct.map((row) => row.amount));
  const mad = middle(distinct.map((row) => Math.abs(row.amount - baseline)));
  const contributing = distinct.filter((row) => {
    const percent = (Math.abs(row.amount - baseline) / baseline) * 100;
    const robustZ = mad
      ? (0.6745 * Math.abs(row.amount - baseline)) / mad
      : null;
    const outlier =
      distinct.length >= 5 &&
      percent >= 40 &&
      (robustZ === null || robustZ > 3.5);
    if (outlier) reject("robust_price_outlier");
    return !outlier;
  });
  const amounts = contributing
    .map((row) => row.amount)
    .toSorted((a, b) => a - b);
  return {
    reasons,
    count: contributing.length,
    sufficient: contributing.length >= 3,
    estimate: contributing.length >= 3 ? middle(amounts) : null,
    rangeLow: amounts[0] ?? null,
    rangeHigh: amounts.at(-1) ?? null,
    before: baseline,
    after: middle(amounts),
    newestSoldAt:
      contributing.toSorted((a, b) => b.sold - a.sold)[0]?.soldAt || null,
  };
}

function mockResponse() {
  return {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

export async function runClient05d({ card, transport, apiKey, now }) {
  if (!sourceMatches(card))
    return { stop: "public_source_drift", outbound: 0, reserved: 0 };
  if (!apiKey)
    return { stop: "credential_unconfigured", outbound: 0, reserved: 0 };
  const catalog = normalizeTcgdexCard(card, "en");
  const option = catalog.variantOptions.find(
    (entry) => entry.metadata?.sourceVariantId === "jr7oetx1mqug9",
  );
  if (
    catalog.id !== lookup.clientId ||
    catalog.number !== "6/15" ||
    option?.id !== "tcgdex:en:2023sv-6:variant:jr7oetx1mqug9" ||
    option?.finish !== "holofoil" ||
    option?.metadata?.sourceCardId !== "2023sv-6" ||
    option?.metadata?.type !== "holo" ||
    option?.metadata?.size !== "standard" ||
    option?.metadata?.subtypePresent !== false ||
    option?.metadata?.stampPresent !== false ||
    option?.status !== "needs_review" ||
    option?.edition !== "unknown" ||
    option?.promoType !== "unknown"
  )
    return { stop: "normalizer_drift", outbound: 0, reserved: 0 };

  let rawRows = null;
  const guard = createClient05bGuard(
    async (url, options) => {
      const response = await transport(url, options);
      if (String(url).includes("/listings/ebay") && response.ok) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        rawRows = Array.isArray(body?.data) ? body.data : null;
      }
      return response;
    },
    { enabled: true },
  );
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.PKMNPRICES_API_KEY;
  globalThis.fetch = guard.fetch;
  process.env.PKMNPRICES_API_KEY = apiKey;
  const response = mockResponse();
  try {
    await salesHandler(
      { method: "GET", query: { lookup: JSON.stringify(lookup) } },
      response,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = previousKey;
  }
  const ledger = guard.ledger;
  const charges = ledger.observed.map((row) => row.charge);
  const summary = {
    stop:
      response.statusCode === 200
        ? null
        : response.body?.code || "provider_unavailable",
    outbound: ledger.outbound,
    reserved: ledger.reserved,
    statuses: ledger.observed.map((row) => row.status),
    reportedCharge: charges.every((value) => value !== null)
      ? charges.reduce((sum, value) => sum + value, 0)
      : null,
    evaluatedAt: new Date(now).toISOString(),
    ruleVersion: EXACT_SOLD_RULE_VERSION,
    catalogIdentityStatus: option.status,
    catalogEdition: option.edition,
    catalogPromoType: option.promoType,
  };
  if (response.statusCode !== 200 || !rawRows) return summary;

  const body = response.body;
  const context = {
    canonicalId: lookup.clientId,
    identityStatus: "exact", // Harness assertion under Astra's reviewed mapping only.
    name: lookup.name,
    set: lookup.set,
    number: lookup.number,
    language: lookup.language,
    variant: lookup.variant,
    finish: lookup.finish,
    edition: lookup.edition,
    promoType: lookup.promoType,
    grader: lookup.grader,
    grade: lookup.grade,
    qualifier: lookup.gradeQualifier,
    currency: lookup.currency,
  };
  const options = {
    now,
    validatedContext: body.validatedContext,
    retrievedAt: body.retrievedAt,
    hasMore: body.hasMore,
  };
  const unresolved = exactSoldValuation(
    body.sales,
    {
      ...context,
      identityStatus: option.status,
      set: catalog.set,
      number: catalog.number,
      variant: option.label,
      edition: option.edition,
      promoType: option.promoType,
    },
    options,
  );
  const application = exactSoldValuation(body.sales, context, options);
  const independent = independentSales(rawRows, now);
  const equal = (left, right) =>
    left === right || (left === null && right === null);
  return {
    ...summary,
    apiStatus: response.statusCode,
    received: body.receivedCount,
    accepted: body.acceptedCount,
    excluded: body.excludedCount,
    upstreamReasons: body.exclusions,
    hasMore: body.hasMore,
    unresolvedStatus: unresolved.status,
    unresolvedEstimateAbsent: unresolved.estimate === null,
    independentReasons: independent.reasons,
    independentSufficient: independent.sufficient,
    applicationStatus: application.status,
    applicationSufficient: application.estimate !== null,
    applicationCount: application.distinctSaleCount,
    agreement: {
      amount: equal(independent.estimate, application.estimate),
      range:
        equal(independent.rangeLow, application.rangeLow) &&
        equal(independent.rangeHigh, application.rangeHigh),
      count: independent.count === application.distinctSaleCount,
      freshness: equal(independent.newestSoldAt, application.newestSoldAt),
      beforeOutliers: equal(
        independent.before,
        application.medianBeforeOutliers,
      ),
      afterOutliers: equal(independent.after, application.medianAfterOutliers),
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  if (process.argv.length !== 3 || process.argv[2] !== "--allow-live") {
    process.stdout.write(
      "CLIENT-05D live probe disabled; pass --allow-live only for the authorized single attempt.\n",
    );
    process.exitCode = 1;
  } else {
    const evaluatedAt = Date.now();
    try {
      const sourceResponse = await fetch(sourceUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(8_000),
      });
      if (!sourceResponse.ok) throw new Error("source_unavailable");
      const card = await sourceResponse.json();
      loadEnvFile(new URL("../.env.local", import.meta.url));
      const nativeFetch = globalThis.fetch.bind(globalThis);
      const result = await runClient05d({
        card,
        transport: nativeFetch,
        apiKey: process.env.PKMNPRICES_API_KEY,
        now: evaluatedAt,
      });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      if (result.stop) process.exitCode = 1;
    } catch {
      process.stdout.write('{"stop":"preflight_or_transport_failed"}\n');
      process.exitCode = 1;
    }
  }
}
