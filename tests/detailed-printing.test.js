import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTcgdexCard } from "../lib/providers/tcgdex.js";
import {
  collectibleIdentitySnapshot,
  selectVariantOption,
} from "../lib/identity.js";
import {
  hydratePosition,
  hydrateWatchlistEntry,
} from "../lib/supabase-data.js";
import { exactSoldValuation } from "../lib/pricing.js";
import { retainedHandler as salesHandler } from "../api/sales.js";

const source = (detailed, overrides = {}) => ({
  id: "synthetic-25",
  localId: "25",
  name: "Pikachu",
  set: {
    id: "synthetic",
    name: "Synthetic Violet",
    cardCount: { official: 100 },
  },
  variants: { holo: true, firstEdition: true },
  variants_detailed: detailed,
  ...overrides,
});
const variant = (id, overrides = {}) => ({
  variantId: id,
  type: "holo",
  size: "standard",
  subtype: "unlimited",
  stamp: [],
  ...overrides,
});
const firstVariant = (id) => ({
  variantId: id,
  type: "holo",
  size: "standard",
  stamp: ["1st-edition"],
});
const card = (detailed, overrides) =>
  normalizeTcgdexCard(source(detailed, overrides), "en");

test("detailed source facts, provenance and reordering survive normalizer, selector, snapshot and hydration", () => {
  const records = [
    variant("plain", {
      languages: ["en", "ja"],
      thirdParty: { tcgplayer: 42 },
    }),
    firstVariant("first"),
    variant("staff", { stamp: ["staff"] }),
    variant("pre", { stamp: ["pre-release"] }),
    variant("cosmos", { foil: "cosmos" }),
  ];
  const normalized = card(records);
  assert.deepEqual(
    normalized.variantOptions.map(({ edition, promoType, status }) => [
      edition,
      promoType,
      status,
    ]),
    [
      ["unlimited", "none", "exact"],
      ["first_edition", "none", "exact"],
      ["unlimited", "staff", "exact"],
      ["unlimited", "prerelease", "exact"],
      ["unlimited", "none", "exact"],
    ],
  );
  const selected = selectVariantOption(
    normalized,
    "tcgdex:en:synthetic-25:variant:staff",
  );
  assert.equal(selected.metadata.sourceVariantId, "staff");
  assert.equal(
    normalized.variantOptions[0].metadata.crossReferences.tcgplayer,
    42,
  );
  assert.deepEqual(normalized.variantOptions[0].metadata.languages, [
    "en",
    "ja",
  ]);
  assert.equal(normalized.variantOptions[4].finish, "cosmos_holofoil");
  assert.equal(normalized.variantOptions[4].metadata.foil, "cosmos");
  assert.deepEqual(
    collectibleIdentitySnapshot(normalized, normalized.variantOptions[0].id)
      .variantMetadata.languages,
    ["en", "ja"],
  );
  assert.equal(
    collectibleIdentitySnapshot(normalized, normalized.variantOptions[4].id)
      .variantMetadata.foil,
    "cosmos",
  );
  const reordered = card([...records].reverse());
  assert.equal(
    selectVariantOption(reordered, selected.id).metadata.sourceVariantId,
    "staff",
  );
  const snapshot = collectibleIdentitySnapshot(normalized, selected.id);
  assert.equal(snapshot.variantMetadata.sourceVariantId, "staff");
  assert.equal(snapshot.externalIds.pkmnprices, undefined);
  const hydrated = hydratePosition({
    id: "copy-1",
    currency: "USD",
    quantity: 1,
    status: "owned",
    card_state: "graded",
    identity_snapshot: snapshot,
    variant_id: null,
  });
  assert.equal(hydrated.variantId, selected.id);
  assert.equal(hydrated.variantMetadata.sourceVariantId, "staff");
  const existingUuid = "77777777-7777-4777-8777-777777777777";
  assert.equal(
    hydratePosition({
      id: "copy-2",
      currency: "USD",
      quantity: 1,
      status: "owned",
      card_state: "graded",
      identity_snapshot: snapshot,
      variant_id: existingUuid,
    }).variantId,
    existingUuid,
  );
});

test("saved detailed evidence survives an unloaded catalog but not an explicit removal or contradiction", () => {
  const normalized = card([variant("plain"), firstVariant("first")]);
  const id = normalized.variantOptions[0].id;
  const snapshot = collectibleIdentitySnapshot(normalized, id);
  const saved = hydratePosition({
    id: "copy-1",
    identity_snapshot: snapshot,
    variant_id: null,
    card_state: "graded",
    quantity: 1,
    status: "owned",
    currency: "USD",
  });
  const watch = hydrateWatchlistEntry({
    id: "watch-1",
    identity_snapshot: snapshot,
    variant_id: null,
    card_state: "graded",
    currency: "USD",
  });
  for (const item of [
    saved,
    watch,
    { ...saved, catalogRefreshStatus: "error" },
  ]) {
    const option = selectVariantOption(item, id);
    assert.equal(option.id, id);
    assert.equal(option.status, "exact");
    assert.deepEqual(option.metadata.stamp, []);
  }
  const reordered = card([firstVariant("first"), variant("plain")]);
  assert.equal(
    selectVariantOption(
      { ...saved, variantOptions: reordered.variantOptions },
      id,
    ).status,
    "exact",
  );
  for (const options of [
    [],
    card([firstVariant("first")]).variantOptions,
    card([]).variantOptions,
  ]) {
    const missing = selectVariantOption(
      { ...saved, variantOptions: options },
      id,
    );
    assert.equal(missing.id, id);
    assert.equal(missing.status, "needs_review");
    assert.equal(missing.metadata.identityEvidence, "missing_detailed_variant");
  }
  const unknown = card([
    { variantId: "unknown", type: "holo", size: "standard" },
  ]);
  const restricted = card([
    variant("restricted", { languages: ["ja"], foil: "masterball" }),
  ]);
  for (const candidate of [unknown, restricted]) {
    const uncertain = collectibleIdentitySnapshot(
      candidate,
      candidate.variantOptions[0].id,
    );
    const loaded = hydratePosition({ ...saved, identity_snapshot: uncertain });
    assert.equal(
      selectVariantOption(loaded, loaded.variantId).status,
      "needs_review",
    );
  }
  for (const tampered of [
    { variantMetadata: { ...saved.variantMetadata, sourceVariantId: "other" } },
    {
      variantMetadata: {
        ...saved.variantMetadata,
        foilPresent: true,
        foil: "masterball",
      },
    },
    {
      variantMetadata: {
        ...saved.variantMetadata,
        languagesPresent: true,
        languages: ["ja"],
      },
    },
    { variantMetadata: { ...saved.variantMetadata, stamp: null } },
    { finish: "reverse_holofoil" },
    { edition: "first_edition" },
    { variantMetadata: {} },
  ])
    assert.equal(
      selectVariantOption({ ...saved, ...tampered }, id).status,
      "needs_review",
    );
});

test("unknowns, conflicts, unsupported geometry and independent flags never gain exactness", () => {
  const missing = card(
    [variant("observed", { subtype: undefined, stamp: undefined })],
    {
      id: "2023sv-6",
      variants: { holo: true, firstEdition: false, wPromo: false },
    },
  );
  const observed = missing.variantOptions[0];
  assert.equal(observed.id, "tcgdex:en:2023sv-6:variant:observed");
  assert.deepEqual(
    [observed.finish, observed.edition, observed.promoType, observed.status],
    ["holofoil", "unknown", "unknown", "needs_review"],
  );
  assert.equal(observed.metadata.size, "standard");
  assert.equal(observed.metadata.stampPresent, true);
  // Previously observed public shape, reconstructed offline without a new request.
  const publicShape = normalizeTcgdexCard(
    {
      id: "2023sv-6",
      localId: "6",
      name: "Pikachu",
      set: {
        id: "2023sv",
        name: "McDonald's Collection 2023",
        cardCount: { official: 15 },
      },
      variants: {
        normal: false,
        holo: true,
        reverse: false,
        firstEdition: false,
        wPromo: false,
      },
      variants_detailed: [
        { variantId: "jr7oetx1mqug9", type: "holo", size: "standard" },
      ],
    },
    "en",
  );
  const absent = publicShape.variantOptions[0];
  assert.equal(publicShape.number, "6/15");
  assert.equal(absent.id, "tcgdex:en:2023sv-6:variant:jr7oetx1mqug9");
  assert.equal(absent.metadata.stampPresent, false);
  assert.deepEqual(
    [absent.edition, absent.promoType, absent.status],
    ["unknown", "unknown", "needs_review"],
  );
  const observedContext = {
    canonicalId: publicShape.id,
    identityStatus: absent.status,
    name: publicShape.name,
    set: publicShape.set,
    number: publicShape.number,
    language: "en",
    variant: absent.label,
    finish: absent.finish,
    edition: absent.edition,
    promoType: absent.promoType,
    grader: "PSA",
    grade: "10",
    qualifier: "",
    currency: "USD",
  };
  assert.equal(
    exactSoldValuation([], observedContext, {
      now: Date.parse("2026-09-24T12:00:00Z"),
      validatedContext: {
        ...observedContext,
        clientId: publicShape.id,
        gradeQualifier: "",
        providerCardId: "synthetic-only",
        canonicalValidated: true,
        completedSaleValidated: true,
      },
    }).status,
    "unresolved_context",
  );
  const unsupportedFoil = card([variant("masterball", { foil: "masterball" })])
    .variantOptions[0];
  assert.equal(unsupportedFoil.status, "needs_review");
  assert.equal(unsupportedFoil.metadata.foil, "masterball");
  assert.match(unsupportedFoil.label, /foil treatment unconfirmed/);
  for (const detailed of [
    [variant("jumbo", { size: "jumbo" })],
    [variant("foil", { foil: "masterball" })],
    [variant("subtype", { subtype: "shadowless" })],
    [variant("stamp", { stamp: ["mystery"] })],
    [
      {
        ...firstVariant("stamp-duplicate"),
        stamp: ["1st-edition", "1st-edition"],
      },
    ],
    [variant("language", { languages: ["ja"] })],
    [variant("language-malformed", { languages: "ja" })],
    [variant("language-conflict", { languages: ["en"], language: "ja" })],
    [variant("duplicate"), variant("duplicate")],
    [firstVariant("conflict")],
    [variant("id-conflict", { id: "other" })],
    [{ variantId: "bad", type: null, size: "standard" }],
  ]) {
    const overrides =
      detailed[0]?.variantId === "conflict"
        ? { variants: { holo: true, firstEdition: false } }
        : {};
    assert.ok(
      card(detailed, overrides).variantOptions.every(
        (option) => option.status === "needs_review",
      ),
    );
  }
  const legacy = card([], { variants: { holo: true, firstEdition: true } });
  assert.equal(legacy.variantOptions.length, 2);
  assert.ok(
    legacy.variantOptions.every((option) => option.status === "needs_review"),
  );
  const changed = card([variant("new")]);
  const unavailable = selectVariantOption(
    changed,
    "tcgdex:en:synthetic-25:0:holo",
  );
  assert.equal(unavailable.id, "tcgdex:en:synthetic-25:0:holo");
  assert.equal(unavailable.status, "needs_review");
  assert.equal(unavailable.finish, "unknown");
  for (const replacement of [[], [{ variantId: null, type: "holo" }]]) {
    const fallback = card(replacement);
    const oldSourceId = "tcgdex:en:synthetic-25:variant:plain";
    const missingSource = selectVariantOption(fallback, oldSourceId);
    assert.equal(missingSource.id, oldSourceId);
    assert.equal(missingSource.status, "needs_review");
    assert.equal(
      missingSource.metadata.identityEvidence,
      "missing_detailed_variant",
    );
  }
  assert.equal(
    selectVariantOption(
      {
        variantOptions: [{ id: "saved", finish: "holofoil", status: "exact" }],
      },
      "saved",
    ).id,
    "saved",
  );
});

test("explicit synthetic printing reaches retained sales implementation and estimator; wrong pools stay separate", async () => {
  const normalized = card([
    variant("plain", { languages: ["en"] }),
    firstVariant("first"),
    variant("staff", { stamp: ["staff"] }),
  ]);
  const option = selectVariantOption(
    normalized,
    "tcgdex:en:synthetic-25:variant:plain",
  );
  const snapshot = collectibleIdentitySnapshot(normalized, option.id);
  const lookup = {
    clientId: normalized.id,
    pkmnpricesId: "123",
    name: snapshot.name,
    set: snapshot.set,
    number: snapshot.number,
    language: snapshot.language,
    variant: snapshot.variant,
    finish: snapshot.finish,
    edition: snapshot.edition,
    promoType: snapshot.promoType,
    grader: "PSA",
    grade: "10",
    gradeQualifier: "",
    currency: "USD",
  };
  const rows = [
    ...[100, 120, 140].map((price, index) => ({
      id: 1001 + index,
      price,
      currency: "USD",
      grader: "PSA",
      grade: "10",
      variant: "Holofoil",
      attribution: "exact",
      sold_at: "2026-09-20",
      title: "Pikachu Synthetic Violet 025/100 Holofoil PSA 10",
      listing_url: `https://www.ebay.com/itm/${1001 + index}`,
    })),
    {
      id: 2001,
      price: 900,
      currency: "USD",
      grader: "PSA",
      grade: "10",
      variant: "1st Edition Holofoil",
      attribution: "exact",
      sold_at: "2026-09-20",
      title: "Pikachu Synthetic Violet 025/100 1st Edition Holofoil PSA 10",
      listing_url: "https://www.ebay.com/itm/2001",
    },
    {
      id: 2002,
      price: 800,
      currency: "USD",
      grader: "PSA",
      grade: "10",
      variant: "Staff Holofoil",
      attribution: "exact",
      sold_at: "2026-09-20",
      title: "Pikachu Synthetic Violet 025/100 Staff Holofoil PSA 10",
      listing_url: "https://www.ebay.com/itm/2002",
    },
    {
      id: 2003,
      price: 700,
      currency: "USD",
      grader: "PSA",
      grade: "10",
      language: "Japanese",
      variant: "Holofoil",
      attribution: "exact",
      sold_at: "2026-09-20",
      title: "Pikachu Synthetic Violet 025/100 Japanese Holofoil PSA 10",
      listing_url: "https://www.ebay.com/itm/2003",
    },
  ];
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PKMNPRICES_API_KEY;
  const urls = [];
  process.env.PKMNPRICES_API_KEY = "offline-fixture";
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    urls.push(url.toString());
    assert.equal(url.origin, "https://api.pkmnprices.com");
    if (url.pathname === "/v1/cards/123")
      return new Response(
        JSON.stringify({
          id: 123,
          name: "Pikachu",
          number: "25",
          total_set_number: 100,
          language: "English",
          set: { name: "Synthetic Violet" },
        }),
      );
    assert.equal(url.pathname, "/v1/cards/123/listings/ebay");
    return new Response(JSON.stringify({ data: rows }));
  };
  try {
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
    assert.equal(response.code, 200, JSON.stringify(urls));
    assert.equal(response.body.sales.length, 3);
    const result = exactSoldValuation(
      response.body.sales,
      {
        canonicalId: normalized.id,
        identityStatus: snapshot.identityStatus,
        ...lookup,
        qualifier: "",
      },
      {
        now: Date.parse("2026-09-24T12:00:00Z"),
        validatedContext: response.body.validatedContext,
        retrievedAt: response.body.retrievedAt,
      },
    );
    assert.equal(result.estimate, 120);
    assert.equal(result.distinctSaleCount, 3);
    for (const badOption of [
      card([variant("wrong-language", { languages: ["ja"] })])
        .variantOptions[0],
      card([variant("wrong-foil", { foil: "masterball" })]).variantOptions[0],
      card([variant("wrong-stamp", { stamp: ["mystery"] })]).variantOptions[0],
      card([variant("wrong-edition", { subtype: "shadowless" })])
        .variantOptions[0],
    ]) {
      assert.equal(badOption.status, "needs_review");
      const badContext = {
        ...lookup,
        canonicalId: normalized.id,
        identityStatus: badOption.status,
        variant: badOption.label,
        finish: badOption.finish,
        edition: badOption.edition,
        promoType: badOption.promoType,
        qualifier: "",
      };
      assert.equal(
        exactSoldValuation(response.body.sales, badContext, {
          now: Date.parse("2026-09-24T12:00:00Z"),
          validatedContext: response.body.validatedContext,
        }).estimate,
        null,
      );
    }
    const unknown = card([
      { variantId: "jr7oetx1mqug9", type: "holo", size: "standard" },
    ]);
    const unresolved = collectibleIdentitySnapshot(
      unknown,
      unknown.variantOptions[0].id,
    );
    assert.equal(
      exactSoldValuation(
        response.body.sales,
        {
          ...lookup,
          canonicalId: normalized.id,
          identityStatus: unresolved.identityStatus,
          edition: unresolved.edition,
          promoType: unresolved.promoType,
          qualifier: "",
        },
        {
          now: Date.parse("2026-09-24T12:00:00Z"),
          validatedContext: response.body.validatedContext,
        },
      ).estimate,
      null,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalKey;
  }
});
