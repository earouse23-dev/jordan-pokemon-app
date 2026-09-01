import test from "node:test";
import assert from "node:assert/strict";
import catalogHandler from "../api/catalog.js";
import {
  searchInternalCatalog,
  summarizeCatalogResolution,
} from "../lib/catalog-db.js";
import setHandler from "../api/set.js";
import {
  fetchTcgdexSet,
  parseCatalogQuery,
  searchTcgdexCards,
} from "../lib/providers/tcgdex.js";

const cards = [
  {
    id: "sv03.5-151",
    localId: "151",
    name: "Mew ex",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/151",
    rarity: "Double rare",
    variants: { holo: true },
    set: {
      id: "sv03.5",
      name: "151",
      cardCount: { official: 165, total: 207 },
      releaseDate: "2023-09-22",
    },
  },
  {
    id: "ecard1-151",
    localId: "151",
    name: "Super Scoop Up",
    image: "https://assets.tcgdex.net/en/ecard/ecard1/151",
    rarity: "Uncommon",
    variants: { normal: true },
    set: {
      id: "ecard1",
      name: "Expedition Base Set",
      cardCount: { official: 165, total: 165 },
      releaseDate: "2002-09-15",
    },
  },
  {
    id: "base1-4",
    localId: "4",
    name: "Charizard",
    image: "https://assets.tcgdex.net/en/base/base1/4",
    rarity: "Rare",
    variants: { holo: true },
    set: {
      id: "base1",
      name: "Base Set",
      cardCount: { official: 102, total: 102 },
      releaseDate: "1999-01-09",
    },
  },
  {
    id: "base4-4",
    localId: "4",
    name: "Charizard",
    image: "https://assets.tcgdex.net/en/base/base4/4",
    rarity: "Rare",
    variants: { holo: true },
    set: {
      id: "base4",
      name: "Base Set 2",
      cardCount: { official: 130, total: 130 },
      releaseDate: "2000-02-24",
    },
  },
  {
    id: "sv06-214",
    localId: "214",
    name: "Greninja ex",
    image: "https://assets.tcgdex.net/en/sv/sv06/214",
    rarity: "Special illustration rare",
    variants: { holo: true },
    set: {
      id: "sv06",
      name: "Twilight Masquerade",
      cardCount: { official: 167, total: 226 },
      releaseDate: "2024-05-24",
    },
  },
  {
    id: "sv03.5-025",
    localId: "025",
    name: "Pikachu",
    image: "https://assets.tcgdex.net/en/sv/sv03.5/025",
    rarity: "Common",
    variants: { normal: true, reverse: true },
    set: {
      id: "sv03.5",
      name: "151",
      cardCount: { official: 165, total: 207 },
      releaseDate: "2023-09-22",
    },
  },
  {
    id: "base1-58",
    localId: "58",
    name: "Pikachu",
    image: "https://assets.tcgdex.net/en/base/base1/58",
    rarity: "Common",
    variants: { normal: true },
    set: {
      id: "base1",
      name: "Base Set",
      cardCount: { official: 102, total: 102 },
      releaseDate: "1999-01-09",
    },
  },
];

function comparable(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function installCatalogFetch({ ignoreName = false } = {}) {
  const requested = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(String(rawUrl));
    requested.push(url);
    const directId = decodeURIComponent(url.pathname.split("/cards/")[1] || "");
    if (directId) {
      const card = cards.find((candidate) => candidate.id === directId);
      return new Response(JSON.stringify(card || {}), {
        status: card ? 200 : 404,
      });
    }
    const name = comparable(url.searchParams.get("name"));
    const localId = comparable(url.searchParams.get("localId"));
    const setName = comparable(url.searchParams.get("set.name"));
    const setId = comparable(url.searchParams.get("set.id"));
    const total = comparable(url.searchParams.get("set.cardCount.official"));
    const matches = cards.filter(
      (card) =>
        (!name || ignoreName || comparable(card.name).includes(name)) &&
        (!localId || comparable(card.localId) === localId) &&
        (!setName || comparable(card.set.name) === setName) &&
        (!setId || comparable(card.set.id) === setId) &&
        (!total || comparable(card.set.cardCount.official) === total),
    );
    return new Response(
      JSON.stringify(
        matches.map(({ id, localId, name, image }) => ({
          id,
          localId,
          name,
          image,
        })),
      ),
      { status: 200 },
    );
  };
  return {
    requested,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

test("exact-name search excludes unrelated cards that share a collector number", async () => {
  const mock = installCatalogFetch({ ignoreName: true });
  try {
    const results = await searchTcgdexCards("Mew ex 151/165", "en", 12);
    assert.equal(results[0].externalIds.tcgdex, "sv03.5-151");
    const unrelated = results.find(
      (card) => card.externalIds.tcgdex === "ecard1-151",
    );
    assert.equal(unrelated, undefined);
  } finally {
    mock.restore();
  }
});

test("parses mixed collector searches without treating the full query as a name", () => {
  assert.deepEqual(parseCatalogQuery("Mew ex 151/165"), {
    original: "Mew ex 151/165",
    name: "Mew ex",
    localId: "151",
    total: "165",
    setName: "",
    setCode: "",
    providerId: null,
    hints: [],
  });
  assert.equal(parseCatalogQuery("Pikachu 151").name, "Pikachu");
  assert.equal(parseCatalogQuery("Pikachu 151").setName, "151");
  assert.equal(parseCatalogQuery("Pikachu 151").localId, "");
  assert.deepEqual(parseCatalogQuery("Charizard Base Set 4/102").hints, []);
  assert.equal(
    parseCatalogQuery("Charizard holo 1st edition").hints.join("|"),
    "Holo|First edition",
  );
});

for (const [query, expectedId] of [
  ["Mew ex 151/165", "sv03.5-151"],
  ["Charizard 4/102", "base1-4"],
  ["Greninja ex 214/167", "sv06-214"],
  ["Pikachu 151", "sv03.5-025"],
]) {
  test(`ranks the exact printing first for ${query}`, async () => {
    const mock = installCatalogFetch();
    try {
      const results = await searchTcgdexCards(query, "en", 12);
      assert.equal(results[0].externalIds.tcgdex, expectedId);
      assert.match(results[0].match.confidence, /Exact|Strong/);
      assert.ok(results[0].match.reasons.length > 0);
    } finally {
      mock.restore();
    }
  });
}

test("number-only 151/165 returns localId 151 matches and includes Mew ex from 151", async () => {
  const mock = installCatalogFetch();
  try {
    const results = await searchTcgdexCards("151/165", "en", 12);
    assert.ok(results.length >= 2);
    assert.ok(results.every((card) => card.localId === "151"));
    assert.ok(
      results.some(
        (card) =>
          card.externalIds.tcgdex === "sv03.5-151" && card.set === "151",
      ),
    );
  } finally {
    mock.restore();
  }
});

test("internal resolution recommends only a unique name-and-number match", () => {
  const exact = {
    id: "tcgdex:en:swsh3.5-76",
    match: { confidence: "Exact match", score: 362 },
  };
  const alternative = {
    id: "tcgdex:en:sm3.5-76",
    match: { confidence: "Number-only alternative", score: 230 },
  };
  const named = summarizeCatalogResolution(
    [exact, alternative],
    parseCatalogQuery("Gardevoir VMAX 76/73"),
  );
  assert.equal(named.status, "exact");
  assert.equal(named.recommendedId, exact.id);
  assert.equal(named.requiresConfirmation, true);

  const numberOnly = summarizeCatalogResolution(
    [
      exact,
      {
        ...alternative,
        match: { confidence: "Exact match", score: 230 },
      },
    ],
    parseCatalogQuery("76/73"),
  );
  assert.equal(numberOnly.status, "review");
  assert.equal(numberOnly.recommendedId, null);
  assert.ok(numberOnly.ambiguity.includes("collector_number_not_unique"));
  assert.ok(numberOnly.ambiguity.includes("multiple_exact_printings"));
});

test("internal catalog lookup uses padded collector keys without duplicating provider IDs", async () => {
  const rows = [
    {
      id: "internal-card",
      name: "Pikachu",
      name_key: "pikachu",
      collector_number: "025",
      collector_key: "025",
      rarity: "Common",
      artist: null,
      language: "en",
      card_sets: {
        id: "internal-set",
        name: "151",
        release_date: "2023-09-22",
        official_count: 165,
        total_count: 207,
        set_external_ids: [{ provider: "tcgdex", external_id: "en:sv03.5" }],
      },
      card_variants: [
        { id: "variant", finish: "holofoil", edition: "", language: "en" },
      ],
      card_images: [
        {
          provider: "tcgdex",
          size: "small",
          url: "https://assets.tcgdex.net/en/sv/sv03.5/025/low.webp",
        },
      ],
      card_external_ids: [{ provider: "tcgdex", external_id: "en:sv03.5-025" }],
    },
  ];
  const database = {
    from() {
      const filters = [];
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        in(column, values) {
          filters.push((row) => values.includes(row[column]));
          return builder;
        },
        ilike(column, pattern) {
          const prefix = pattern.replace(/%+$/, "").toLowerCase();
          filters.push((row) =>
            String(row[column] || "")
              .toLowerCase()
              .startsWith(prefix),
          );
          return builder;
        },
        limit() {
          return Promise.resolve({
            data: rows.filter((row) => filters.every((filter) => filter(row))),
            error: null,
          });
        },
      };
      return builder;
    },
  };
  const result = await searchInternalCatalog(
    database,
    "Pikachu 25/165",
    "en",
    12,
  );
  assert.equal(result.cards[0].id, "tcgdex:en:sv03.5-025");
  assert.equal(result.cards[0].setId, "sv03.5");
  assert.equal(result.cards[0].number, "025/165");
  assert.equal(result.cards[0].cardId, "internal-card");
  assert.equal(result.cards[0].collectibleId, "variant");
  assert.equal(result.cards[0].variantOptions[0].id, "variant");
  assert.equal(result.resolution.status, "exact");
  assert.equal(result.resolution.recommendedCollectibleId, "variant");
});

test("catalog endpoint preserves the selected language and never serializes provider secrets", async () => {
  const mock = installCatalogFetch();
  const originalSecret = process.env.PKMNPRICES_API_KEY;
  process.env.PKMNPRICES_API_KEY = "never-return-this-secret";
  let body;
  const response = {
    setHeader() {},
    status(status) {
      this.statusCode = status;
      return this;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  try {
    await catalogHandler(
      {
        method: "GET",
        query: { q: "Pikachu 151", language: "ja", limit: "8" },
      },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.ok(
      mock.requested.every((url) => url.pathname.includes("/v2/ja/cards")),
    );
    assert.equal(body.cards[0].language, "ja");
    assert.equal(body.parsedQuery.setName, "151");
    assert.equal(
      JSON.stringify(body).includes("never-return-this-secret"),
      false,
    );
  } finally {
    mock.restore();
    if (originalSecret === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = originalSecret;
  }
});

test("set catalog returns the exact checklist and rejects invalid set identifiers", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (rawUrl) => {
    const url = new URL(String(rawUrl));
    assert.equal(url.pathname, "/v2/en/sets/base1");
    return new Response(
      JSON.stringify({
        id: "base1",
        name: "Base Set",
        releaseDate: "1999-01-09",
        cardCount: { official: 102, total: 102 },
        cards: cards
          .filter((card) => card.set.id === "base1")
          .map(({ id, localId, name, image }) => ({
            id,
            localId,
            name,
            image,
          })),
      }),
      { status: 200 },
    );
  };
  try {
    const set = await fetchTcgdexSet("base1", "en");
    assert.equal(set.name, "Base Set");
    assert.equal(set.totalCount, 102);
    assert.equal(set.cards[0].number, "4/102");
    assert.equal(set.cards[0].externalIds.tcgdex, "base1-4");
    let body;
    const response = {
      setHeader() {},
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(value) {
        body = value;
        return value;
      },
    };
    await setHandler(
      { method: "GET", query: { setId: "base1", language: "en" } },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(body.set.cards.length, 2);
    await setHandler(
      { method: "GET", query: { setId: "../secret", language: "en" } },
      response,
    );
    assert.equal(response.statusCode, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
