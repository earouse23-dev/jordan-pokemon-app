import test from "node:test";
import assert from "node:assert/strict";
import { toMinorUnits, positionPerformance } from "../lib/portfolio.js";
import { exactSoldValuation } from "../lib/pricing.js";

const now = Date.parse("2026-09-24T12:00:00Z");
const context = {
  canonicalId: "canonical-pikachu-025",
  identityStatus: "exact",
  name: "Pikachu",
  set: "Synthetic Violet",
  number: "025/100",
  language: "en",
  variant: "Holofoil",
  finish: "holofoil",
  edition: "unlimited",
  promoType: "none",
  grader: "PSA",
  grade: "10",
  qualifier: "",
  currency: "USD",
};
const validatedContext = {
  ...context,
  clientId: context.canonicalId,
  gradeQualifier: "",
  providerCardId: "10195",
  canonicalValidated: true,
  completedSaleValidated: true,
};
const sale = (id, amount, soldAt = "2026-09-20", extra = {}) => ({
  provider: "pkmnprices",
  providerSaleId: String(id),
  source: "ebay",
  sourceUrl: `https://www.ebay.com/itm/${id}`,
  title: "Pikachu Synthetic Violet 025/100 Holofoil PSA 10",
  attribution: "exact",
  gradingCompany: "PSA",
  grade: "10",
  gradeQualifier: null,
  printing: "Holofoil",
  language: "English",
  currency: "USD",
  amount,
  soldAt,
  ingestedAt: "2026-09-23T00:00:00Z",
  ...extra,
});
const options = { now, validatedContext, retrievedAt: "2026-09-24T00:00:00Z" };
const evaluate = (rows, extra = {}) =>
  exactSoldValuation(rows, context, { ...options, ...extra });

test("frozen odd/even medians and sparse threshold keep source amounts intact", () => {
  const rows = [
    sale(1001, 100),
    sale(1002, 120, "2026-09-18"),
    sale(1003, 140, "2026-09-15"),
    sale(1004, 160, "2026-09-10"),
  ];
  for (const count of [0, 1, 2]) {
    const result = evaluate(rows.slice(0, count));
    assert.equal(result.estimate, null);
    assert.equal(result.distinctSaleCount, count);
    assert.equal(result.confidence.level, "insufficient");
  }
  assert.equal(evaluate(rows.slice(0, 3)).estimate, 120);
  const even = evaluate(rows);
  assert.equal(even.estimate, 130);
  assert.deepEqual([even.rangeLow, even.rangeHigh], [100, 160]);
  assert.deepEqual(even.contributingEvidenceIds, [
    "ebay:1001",
    "ebay:1002",
    "ebay:1003",
    "ebay:1004",
  ]);
  assert.equal(rows[0].amount, 100);
});

test("exact printing, grade, label, language and currency are independent pools", () => {
  const base = [sale(1001, 100), sale(1002, 120), sale(1003, 140)];
  const wrong = [
    sale(2001, 900, "2026-09-20", { gradingCompany: "BGS" }),
    sale(2002, 800, "2026-09-20", { gradingCompany: "BGS", grade: "9.5" }),
    sale(2003, 1100, "2026-09-20", {
      gradingCompany: "BGS",
      gradeQualifier: "Black Label",
    }),
    sale(2004, 70, "2026-09-20", { grade: "9" }),
    sale(2005, 200, "2026-09-20", { language: "Japanese" }),
    sale(2006, 300, "2026-09-20", { printing: "Reverse Holofoil" }),
    sale(2007, 400, "2026-09-20", { printing: "1st Edition Holofoil" }),
    sale(2008, 500, "2026-09-20", { attribution: "shared" }),
    sale(2009, 90, "2026-09-20", { currency: "EUR" }),
  ];
  const result = evaluate([...base, ...wrong]);
  assert.equal(result.estimate, 120);
  assert.equal(result.distinctSaleCount, 3);
  assert.equal(result.excluded.length, wrong.length);
  assert.equal(
    result.excluded.find((row) => row.id === "pkmnprices:2009")?.reason,
    "currency_mismatch",
  );
  const eur = exactSoldValuation(
    [
      sale(3001, 90, "2026-09-20", { currency: "EUR" }),
      sale(3002, 110, "2026-09-20", { currency: "EUR" }),
      sale(3003, 130, "2026-09-20", { currency: "EUR" }),
    ],
    { ...context, currency: "EUR" },
    { ...options, validatedContext: { ...validatedContext, currency: "EUR" } },
  );
  assert.equal(eur.estimate, 110);
  assert.equal(eur.currency, "EUR");
  assert.equal(
    exactSoldValuation(base, { ...context, edition: "unknown" }, options)
      .status,
    "unresolved_context",
  );
  assert.equal(evaluate(base, { validatedContext: null }).estimate, null);
  assert.equal(
    evaluate(base, {
      validatedContext: { ...validatedContext, clientId: "another-printing" },
    }).status,
    "unresolved_context",
  );
  const firstEditionContext = {
    ...context,
    variant: "1st Edition Holofoil",
    edition: "first",
  };
  const firstEditionEnvelope = {
    ...validatedContext,
    variant: firstEditionContext.variant,
    edition: "first",
  };
  assert.equal(
    exactSoldValuation(
      [
        sale(3101, 100, "2026-09-20", { printing: "firsteditionholofoil" }),
        sale(3102, 120, "2026-09-20", { printing: "1st Edition Holofoil" }),
        sale(3103, 140, "2026-09-20", { printing: "1st Edition Holofoil" }),
      ],
      firstEditionContext,
      { ...options, validatedContext: firstEditionEnvelope },
    ).estimate,
    120,
  );
  const bgsContext = { ...context, grader: "BGS", grade: "9.5", qualifier: "" };
  const bgsEnvelope = { ...validatedContext, grader: "BGS", grade: "9.5" };
  assert.equal(
    exactSoldValuation(
      [
        sale(3201, 200, "2026-09-20", { gradingCompany: "BGS", grade: "9.5" }),
        sale(3202, 220, "2026-09-20", { gradingCompany: "BGS", grade: "9.5" }),
        sale(3203, 240, "2026-09-20", { gradingCompany: "BGS", grade: "9.5" }),
      ],
      bgsContext,
      { ...options, validatedContext: bgsEnvelope },
    ).estimate,
    220,
  );
  const blackContext = { ...context, grader: "BGS", qualifier: "Black Label" };
  const blackEnvelope = {
    ...validatedContext,
    grader: "BGS",
    gradeQualifier: "Black Label",
  };
  assert.equal(
    exactSoldValuation(
      [
        sale(3301, 1000, "2026-09-20", {
          gradingCompany: "BGS",
          gradeQualifier: "Black Label",
        }),
        sale(3302, 1100, "2026-09-20", {
          gradingCompany: "BGS",
          gradeQualifier: "Black Label",
        }),
        sale(3303, 1200, "2026-09-20", {
          gradingCompany: "BGS",
          gradeQualifier: "Black Label",
        }),
      ],
      blackContext,
      { ...options, validatedContext: blackEnvelope },
    ).estimate,
    1100,
  );
});

test("one marketplace transaction deduplicates aliases and adapters in any order", () => {
  const base = [sale(1001, 100), sale(1002, 120), sale(1003, 140)];
  assert.equal(
    evaluate([
      sale(1001, 100, "2026-09-20T23:00:00-05:00"),
      sale(1002, 120),
      sale(1003, 140),
    ]).estimate,
    120,
  );
  const alias = sale(1001, 100, "2026-09-20", {
    provider: "other-feed",
    providerSaleId: "alias",
    sourceUrl: "https://www.ebay.co.uk/itm/Pikachu-PSA-10/1001?track=1",
  });
  const rows = [...base, alias, sale(1004, 160)];
  const first = evaluate(rows);
  const reversed = evaluate([...rows].reverse());
  assert.equal(first.estimate, 130);
  assert.equal(first.distinctSaleCount, 4);
  assert.equal(first.sourceMarketCount, 1);
  assert.deepEqual(
    first.contributingEvidenceIds,
    reversed.contributingEvidenceIds,
  );
  assert.deepEqual(first.excluded, reversed.excluded);
  assert.equal(first.excluded[0].reason, "duplicate_transaction");
  assert.equal(first.confidence.level, "limited");
  const conflict = evaluate([...base, sale(1001, 999)]);
  assert.equal(conflict.estimate, null);
  assert.equal(
    conflict.excluded.filter((row) => row.reason === "conflicting_duplicate")
      .length,
    2,
  );
});

test("outlier review, zero MAD and independent marketplaces are disclosed", () => {
  const rows = [90, 100, 110, 120, 1000].map((amount, index) =>
    sale(4001 + index, amount),
  );
  const result = evaluate(rows);
  assert.equal(result.medianBeforeOutliers, 110);
  assert.equal(result.medianAfterOutliers, 105);
  assert.equal(result.estimate, 105);
  assert.deepEqual([result.rangeLow, result.rangeHigh], [90, 120]);
  assert.equal(
    result.excluded.find((row) => row.id === "pkmnprices:4005")?.reason,
    "robust_price_outlier",
  );
  assert.equal(
    evaluate(
      [100, 100, 100, 100, 1000].map((amount, index) =>
        sale(5001 + index, amount),
      ),
    ).estimate,
    100,
  );
  const independent = [100, 101, 102, 103, 104, 105, 106].map(
    (amount, index) =>
      index === 6
        ? sale(6007, amount, "2026-09-20", {
            source: "cardmarket",
            marketplaceTransactionId: "sale-6007",
            sourceUrl: "https://www.cardmarket.com/sales/sale-6007",
          })
        : sale(6001 + index, amount),
  );
  assert.equal(evaluate(independent).confidence.level, "strong");
  assert.equal(
    evaluate(independent, { hasMore: true }).confidence.level,
    "limited",
  );
  assert.equal(evaluate(independent.slice(0, 5)).sourceMarketCount, 1);
  assert.equal(evaluate(independent.slice(0, 5)).confidence.level, "limited");
});

test("sold-date freshness, provenance and provider errors remain distinct", () => {
  const old = [
    sale(7001, 100, "2026-08-20"),
    sale(7002, 120, "2026-08-19"),
    sale(7003, 140, "2026-08-18"),
  ];
  assert.equal(evaluate(old).estimate, 120);
  assert.equal(evaluate(old).status, "stale");
  assert.equal(
    evaluate(old, { retrievedAt: "2026-09-24T11:59:00Z" }).status,
    "stale",
  );
  const beyond = [
    sale(7101, 100, "2026-06-01"),
    sale(7102, 120, "2026-06-02"),
    sale(7103, 140, "2026-06-03"),
  ];
  assert.equal(evaluate(beyond).estimate, null);
  assert.ok(
    evaluate(beyond).excluded.every(
      (row) => row.reason === "outside_90_day_window",
    ),
  );
  const base = [sale(1001, 100), sale(1002, 120), sale(1003, 140)];
  const invalid = [
    sale(8001, 10, "2026-09-25"),
    sale(8002, 10, "2026-02-30"),
    sale(8003, 0),
    sale(8004, 10, "2026-09-20", {
      sourceUrl: "https://www.ebay.com/sch/i.html?q=pikachu",
    }),
    sale(8005, 10, "2026-09-20", { evidenceKind: "asking_price" }),
    sale(8006, 10, "2026-09-20", { evidenceKind: "market_index" }),
  ];
  const result = evaluate([...base, ...invalid], {
    hasMore: true,
    providerStatus: "error",
  });
  assert.equal(result.estimate, 120);
  assert.equal(result.status, "refresh_failed");
  assert.equal(result.excluded.length, invalid.length);
  assert.ok(result.confidence.factors.includes("recent_sample_truncated"));
  assert.equal(result.newestSoldAt, "2026-09-20");
  assert.equal(result.newestRetrievedAt, options.retrievedAt);
});

for (const currency of ["USD", "EUR"]) test(currency + " real cent prices produce a cent-safe median and purchase performance", () => {
  const amounts=[225,215,230.2,219,220.46,220,222.5,260,209.99,190];
  const rows=amounts.map((amount,index)=>sale(9000+index,amount,"2026-09-20",{currency}));
  const result=exactSoldValuation(rows,{...context,currency},{...options,validatedContext:{...validatedContext,currency}});
  assert.equal(result.status,"ready");
  assert.equal(result.estimate,220.23);
  assert.equal(toMinorUnits(result.estimate),22023);
  assert.equal(positionPerformance({quantityOwned:1,remainingCostBasisMinor:20000,currentUnitPrice:result.estimate}).unrealizedGainMinor,2023);
  assert.deepEqual(rows.map(row=>row.amount),amounts);
});
