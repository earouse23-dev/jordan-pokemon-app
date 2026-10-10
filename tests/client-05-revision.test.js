import "./pkmnprices-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { retainedHandler as salesHandler } from "../api/sales.js";
import { exactSoldValuation } from "../lib/pricing.js";

const now = Date.parse("2026-09-24T12:00:00Z");
const card = {
  id: 123,
  name: "Pikachu",
  number: "025",
  total_set_number: 100,
  language: "English",
  set: { name: "Synthetic Violet" },
};
const baseLookup = {
  clientId: "tcgdex:en:sv-25",
  pkmnpricesId: "123",
  name: "Pikachu",
  set: "Synthetic Violet",
  number: "025/100",
  language: "en",
  variant: "Holofoil",
  finish: "holofoil",
  edition: "unlimited",
  promoType: "none",
  currency: "USD",
  grader: "BGS",
  grade: "10",
  gradeQualifier: "",
};

function row(id, amount, title, extra = {}) {
  return {
    id,
    price: amount,
    title,
    currency: "USD",
    grader: "BGS",
    grade: "10",
    grade_qualifier: null,
    variant: "Holofoil",
    attribution: "exact",
    sold_at: "2026-09-20",
    listing_url: `https://www.ebay.com/itm/${id}`,
    ...extra,
  };
}

async function withOfflineProvider(rows, run) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PKMNPRICES_API_KEY;
  process.env.PKMNPRICES_API_KEY = "offline-fixture";
  const calls = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.pkmnprices.com");
    calls.push(url);
    if (url.pathname === "/v1/cards/123")
      return new Response(JSON.stringify(card));
    assert.equal(url.pathname, "/v1/cards/123/listings/ebay");
    return new Response(JSON.stringify({ data: rows }));
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
  }
}

async function apiSale(lookup) {
  const response = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await salesHandler(
    { method: "GET", query: { lookup: JSON.stringify(lookup) } },
    response,
  );
  return response;
}

function estimate(response, lookup) {
  return exactSoldValuation(response.body.sales, estimateContext(lookup), {
    now,
    validatedContext: response.body.validatedContext,
  });
}

test("first-edition aliases survive API and adapter without pricing unlimited", async () => {
  const firstTitle =
    "Pikachu Synthetic Violet 025/100 1st Edition Holofoil PSA 10";
  const plainTitle = "Pikachu Synthetic Violet 025/100 Holofoil PSA 10";
  const rows = [
    ...[100, 120, 140].map((amount, i) =>
      row(1001 + i, amount, firstTitle, {
        grader: "PSA",
        variant: "1st Edition Holofoil",
      }),
    ),
    ...[10, 20, 30].map((amount, i) =>
      row(2001 + i, amount, plainTitle, { grader: "PSA" }),
    ),
    row(
      3001,
      999,
      "Raichu Synthetic Violet 025/100 1st Edition Holofoil PSA 10",
      {
        grader: "PSA",
        variant: "1st Edition Holofoil",
      },
    ),
    { price: null, sold_at: "2026-09-20", title: firstTitle },
  ];
  await withOfflineProvider(rows, async (calls) => {
    const first = {
      ...baseLookup,
      grader: "PSA",
      variant: "1stEditionHolofoil",
      edition: "first_edition",
    };
    const response = await apiSale(first);
    assert.equal(response.code, 200);
    assert.deepEqual(
      response.body.sales.map((sale) => sale.providerSaleId),
      ["1001", "1002", "1003"],
    );
    assert.equal(estimate(response, first).estimate, 120);
    assert.deepEqual(
      [
        response.body.receivedCount,
        response.body.acceptedCount,
        response.body.excludedCount,
      ],
      [8, 3, 5],
    );
    assert.equal(
      response.body.acceptedCount + response.body.excludedCount,
      response.body.receivedCount,
    );
    assert.deepEqual(response.body.exclusions, {
      normalizationRejected: 1,
      contextMismatch: 3,
      canonicalIdentityMismatch: 1,
    });
    assert.equal(response.body.upstreamExclusions.length, 5);
    assert.equal(response.body.upstreamExclusions.at(-1).id, "pkmnprices:3001");
    assert.equal(response.body.upstreamExclusions[0].id, null);
    assert.equal(
      calls
        .find((url) => url.pathname.endsWith("/listings/ebay"))
        .searchParams.get("variant"),
      null, // Grade pages include edition labels; exact filtering happens locally.
    );

    const unlimited = { ...first, variant: "Holofoil", edition: "unlimited" };
    const plain = await apiSale(unlimited);
    assert.equal(plain.code, 200);
    assert.deepEqual(
      plain.body.sales.map((sale) => sale.providerSaleId),
      ["2001", "2002", "2003"],
    );
    assert.equal(estimate(plain, unlimited).estimate, 20);
    assert.equal(
      exactSoldValuation(response.body.sales, estimateContext(unlimited), {
        now,
        validatedContext: plain.body.validatedContext,
      }).estimate,
      null,
    );
    assert.equal(
      exactSoldValuation(plain.body.sales, estimateContext(first), {
        now,
        validatedContext: response.body.validatedContext,
      }).estimate,
      null,
    );
    for (const edition of ["First Edition", "1st Edition"]) {
      const human = await apiSale({
        ...first,
        variant: "1st Edition Holofoil",
        edition,
      });
      assert.equal(human.code, 200);
      assert.equal(
        estimate(human, { ...first, variant: "1st Edition Holofoil", edition })
          .estimate,
        120,
      );
    }
    const spelled = await apiSale({
      ...first,
      variant: "FirstEditionHolofoil",
    });
    assert.equal(spelled.code, 200);
    assert.equal(
      estimate(spelled, { ...first, variant: "FirstEditionHolofoil" }).estimate,
      120,
    );
    assert.equal(
      (await apiSale({ ...first, edition: "first_edition<script>" })).code,
      400,
    );
  });
});

function estimateContext(lookup) {
  return {
    canonicalId: lookup.clientId,
    identityStatus: "exact",
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
}

test("title and structured BGS labels stay separate through API and estimator", async () => {
  const prefix = "Pikachu Synthetic Violet 025/100 Holofoil BGS";
  const rows = [
    ...[100, 120, 140].map((amount, i) =>
      row(4001 + i, amount, `${prefix} 10`),
    ),
    ...[500, 600, 700].map((amount, i) =>
      row(5001 + i, amount, `${prefix} 10 Black Label`, {
        grade_qualifier: "Black Label",
      }),
    ),
    row(6001, 800, `${prefix} 10 Black Label`),
    row(6002, 900, `${prefix} 10 Black Label`, {
      grade_qualifier: "Gold Label",
    }),
    row(6003, 950, `${prefix} 9.5 Gold Label`, {
      grade_qualifier: "Gold Label",
    }),
    ...[300, 320, 340].map((amount, i) =>
      row(7001 + i, amount, `${prefix} 9.5 Gold Label`, {
        grade: "9.5",
        grade_qualifier: "Gold Label",
      }),
    ),
  ];
  await withOfflineProvider(rows, async () => {
    for (const [grade, label, expectedIds, expected] of [
      ["10", "", ["4001", "4002", "4003"], 120],
      ["10", "Black Label", ["5001", "5002", "5003"], 600],
      ["9.5", "Gold Label", ["7001", "7002", "7003"], 320],
    ]) {
      const lookup = { ...baseLookup, grade, gradeQualifier: label };
      const response = await apiSale(lookup);
      assert.equal(response.code, 200);
      assert.deepEqual(
        response.body.sales.map((sale) => sale.providerSaleId),
        expectedIds,
      );
      assert.equal(estimate(response, lookup).estimate, expected);
      assert.equal(response.body.receivedCount, 12);
      assert.equal(response.body.acceptedCount, 3);
      assert.equal(response.body.excludedCount, 9);
      assert.equal(
        response.body.upstreamExclusions.some(
          (row) => row.id === "pkmnprices:6001",
        ),
        true,
      );
      assert.equal(
        response.body.upstreamExclusions.some(
          (row) => row.id === "pkmnprices:6002",
        ),
        true,
      );
      assert.equal(
        response.body.upstreamExclusions.some(
          (row) => row.id === "pkmnprices:6003",
        ),
        true,
      );
    }
  });
});
