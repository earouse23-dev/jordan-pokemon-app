import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPkmnPricesSaleEvidence,
  createCreditBudget,
  numericResponseHeader,
  providerFailureKind,
  runPkmnPricesReadiness,
} from "../lib/pkmnprices-readiness.js";

test("readiness keeps missing numeric headers unknown", () => {
  const response = new Response("{}");
  assert.equal(numericResponseHeader(response, "x-credits-charged"), null);
  assert.equal(
    numericResponseHeader(
      new Response("{}", { headers: { "x-credits-charged": "0" } }),
      "x-credits-charged",
    ),
    0,
  );
});

test("readiness recognizes invalid credentials even when provider uses 403", () => {
  assert.equal(
    providerFailureKind(403, {
      error: { code: "invalid_key", message: "Invalid API key" },
    }),
    "invalid_key",
  );
  assert.equal(
    providerFailureKind(403, { error: { code: "forbidden" } }),
    "entitlement_denied",
  );
  assert.equal(providerFailureKind(429), "rate_limited");
});

test("readiness stops after authentication rejection and retains unknown charges", async () => {
  const requests = [];
  const result = await runPkmnPricesReadiness({
    apiKey: "synthetic-secret",
    liveAuthorized: true,
    fetchImpl: async (url) => {
      requests.push(url);
      if (String(url).endsWith("/health")) return new Response("{}");
      return new Response(JSON.stringify({ error: { code: "invalid_key" } }), {
        status: 403,
      });
    },
    now: () => new Date("2026-09-17T12:00:00Z"),
  });
  assert.equal(requests.length, 2);
  assert.equal(result.overall, "blocked_authentication");
  assert.equal(result.stopReason, "invalid_key");
  assert.equal(result.creditBudget.plannedUpperBound, 1);
  assert.equal(result.creditBudget.reportedCharges, null);
  assert.equal(JSON.stringify(result).includes("synthetic-secret"), false);
  assert.equal(
    result.coverage.every((cell) => cell.status === "skipped_invalid_key"),
    true,
  );
});

test("readiness budget blocks pagination or retry reservation before overspend", () => {
  const budget = createCreditBudget(5);
  assert.equal(budget.reserve(3), true);
  assert.equal(budget.reserve(3), false);
  assert.equal(budget.snapshot().plannedUpperBound, 3);
  assert.equal(budget.snapshot().requestedMaximum, 5);
  assert.equal(createCreditBudget(400).snapshot().requestedMaximum, 40);
});

test("readiness classifies identity ambiguity separately from provider attribution", () => {
  const card = {
    name: "Pikachu",
    number: "1",
    total_set_number: 10,
    set: { name: "Test Set" },
  };
  const base = {
    price: 125.5,
    currency: "USD",
    grader: "PSA",
    grade: "10",
    variant: "Holofoil",
    attribution: "exact",
    sold_at: "2026-09-15T00:00:00Z",
    ingested_at: "2026-09-16T00:00:00Z",
    listing_url: "https://www.ebay.com/itm/123",
  };
  assert.equal(
    classifyPkmnPricesSaleEvidence(
      { ...base, title: "Pikachu 1/10 Holofoil graded card" },
      card,
      "en",
      "PSA",
    ).status,
    "accepted",
  );
  assert.equal(
    classifyPkmnPricesSaleEvidence(
      { ...base, title: "Flying Pikachu 2/10 Holofoil graded card" },
      card,
      "en",
      "PSA",
    ).reason,
    "canonical_identity_mismatch_or_ambiguous",
  );
  assert.equal(
    classifyPkmnPricesSaleEvidence(
      {
        ...base,
        title: "Pikachu 1/10 Holofoil graded card",
        attribution: "shared",
      },
      card,
      "en",
      "PSA",
    ).reason,
    "non_exact_attribution",
  );
});

test("readiness separates endpoint access, nonempty rows, and exact normalization", async () => {
  let catalogId = 100;
  const result = await runPkmnPricesReadiness({
    apiKey: "synthetic-secret",
    liveAuthorized: true,
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname === "/health") return new Response("{}");
      if (parsed.pathname === "/v1/cards") {
        catalogId += 1;
        return new Response(
          JSON.stringify({
            data: [
              {
                id: catalogId,
                name: "Pikachu",
                number: "1",
                total_set_number: 10,
                set: { name: "Test Set" },
              },
            ],
          }),
          { headers: { "x-credits-charged": "1" } },
        );
      }
      const grader = parsed.searchParams.get("grader");
      const exact = {
        id: `${grader}-1`,
        price: 125.5,
        currency: grader === "BGS" ? "EUR" : "USD",
        grader,
        grade: grader === "BGS" ? "9.5" : "10",
        grade_qualifier: grader === "BGS" ? "Gold Label" : null,
        variant: "Holofoil",
        title: "Pikachu 1/10 Holofoil graded card",
        attribution: "exact",
        sold_at: "2026-09-15T00:00:00Z",
        ingested_at: "2026-09-16T00:00:00Z",
        listing_url: "https://www.ebay.com/itm/123",
      };
      const wrongIdentity = {
        ...exact,
        id: `${grader}-2`,
        title: "Flying Pikachu 2/10 Holofoil graded card",
      };
      const shared = {
        ...exact,
        id: `${grader}-3`,
        attribution: "shared",
      };
      return new Response(
        JSON.stringify({ data: [exact, wrongIdentity, shared] }),
        {
          headers: { "x-credits-charged": "3" },
        },
      );
    },
    now: () => new Date("2026-09-17T12:00:00Z"),
  });
  assert.equal(result.overall, "verified");
  assert.equal(result.coverage.length, 6);
  assert.equal(
    result.coverage.every(
      (cell) =>
        cell.endpointAccessible &&
        cell.nonempty &&
        cell.receivedCount === 3 &&
        cell.acceptedCount === 1 &&
        cell.excludedCount === 2 &&
        cell.exactEligibleCount === 1 &&
        cell.exclusionReasons.canonical_identity_mismatch_or_ambiguous === 1 &&
        cell.exclusionReasons.non_exact_attribution === 1,
    ),
    true,
  );
  assert.deepEqual(result.halfGradeOrLabelCase, {
    grade: "9.5",
    qualifier: "Gold Label",
    variant: "Holofoil",
  });
  assert.equal(result.applicationCase.applicationNormalized, true);
  assert.equal(result.creditBudget.plannedUpperBound, 21);
  assert.equal(result.creditBudget.observedReturnedItems, 21);
  assert.equal(result.creditBudget.reportedCharges, 21);
});
