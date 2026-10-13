import "./pkmnprices-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { runClient05d } from "../scripts/client-05d-transient.mjs";

const catalog = {
  id: "2023sv-6",
  localId: "6",
  name: "Pikachu",
  set: {
    id: "2023sv",
    name: "McDonald's Collection 2023",
    cardCount: { official: 15 },
  },
  variants: {
    firstEdition: false,
    holo: true,
    normal: false,
    reverse: false,
    wPromo: false,
  },
  variants_detailed: [
    { variantId: "jr7oetx1mqug9", type: "holo", size: "standard" },
  ],
};
const providerCard = {
  id: 10195,
  name: "Pikachu",
  number: "006",
  total_set_number: "015",
  set: { name: "McDonald's Promos 2023" },
};
const sale = (
  id,
  price,
  title = "2023 McDonalds Pikachu 006/015 Holofoil PSA 10",
) => ({
  id,
  ebay_listing_id: id,
  title,
  price,
  currency: "USD",
  grader: "PSA",
  grade: "10",
  grade_qualifier: null,
  variant: "Holofoil",
  attribution: "exact",
  sold_at: "2026-09-20",
  ingested_at: "2026-09-23T00:00:00Z",
  listing_url: `https://www.ebay.com/itm/${id}`,
});

test("closed historical harness keeps catalog unresolved and refuses current archive transport", async () => {
  const calls = [];
  const rows = [
    sale(9001, 100),
    sale(9002, 120),
    sale(9003, 140),
    sale(
      9004,
      1000,
      "2021 Celebrations Flying Pikachu V 006/025 Holofoil PSA 10",
    ),
  ];
  const result = await runClient05d({
    card: catalog,
    apiKey: "offline-test-key",
    now: Date.parse("2026-09-24T12:00:00Z"),
    transport: async (_url, options) => {
      calls.push(options.redirect);
      return calls.length === 1
        ? Response.json(providerCard)
        : Response.json({ data: rows, pagination: { has_more: false } });
    },
  });
  // This historical runner is intentionally still capped at its old URL/credits.
  // Current archive pagination must fail closed rather than widen that allowance.
  assert.deepEqual(calls, ["error"]);
  assert.equal(result.outbound, 1);
  assert.equal(result.reserved, 1);
  assert.equal(result.stop, "provider_unavailable");
  assert.equal(result.catalogIdentityStatus, "needs_review");

});

test("material source drift and card identity conflict prevent sale transport", async () => {
  let transports = 0;
  const transport = async () => {
    transports++;
    return Response.json({ ...providerCard, name: "Flying Pikachu V" });
  };
  const base = {
    card: catalog,
    apiKey: "offline-test-key",
    now: Date.parse("2026-09-24T12:00:00Z"),
    transport,
  };
  const drift = await runClient05d({
    ...base,
    card: { ...catalog, variants_detailed: [] },
  });
  assert.equal(drift.outbound, 0);
  assert.equal(transports, 0);
  const mismatch = await runClient05d(base);
  assert.equal(mismatch.outbound, 1);
  assert.equal(mismatch.reserved, 1);
  assert.equal(transports, 1);
});
