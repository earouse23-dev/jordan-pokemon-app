import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createGradedValuationHandler,
  valuationPositionContract,
} from "../api/graded-valuation.js";
import {
  exactSoldObservation,
  readExactSoldObservation,
} from "../lib/graded-valuation.js";
import { portfolioProfitLossHistory } from "../lib/portfolio.js";
import { fetchPkmnPricesSales } from "../lib/providers/pkmnprices.js";

const at = Date.parse("2026-09-25T12:00:00Z");
const owner = randomUUID();
const other = randomUUID();
const position = (id = randomUUID(), currency = "USD") => ({
  id,
  user_id: owner,
  collectible_id: randomUUID(),
  status: "owned",
  card_state: "graded",
  grader: "PSA",
  grade: 10,
  currency,
  identity_snapshot: {
    providerCardId: `synthetic-${id}`,
    identityStatus: "exact",
    name: "Clefable",
    set: "Synthetic Jungle",
    number: "017/064",
    language: "en",
    variant: "Holofoil",
    finish: "holofoil",
    edition: "unlimited",
    promoType: "none",
    gradeQualifier: "",
    externalIds: { pkmnprices: "20618" },
  },
});
const sales = (currency = "USD", amounts = [100, 120, 140], suffix = 0) =>
  amounts.map((amount, index) => ({
    provider: "pkmnprices",
    providerSaleId: String(6000 + suffix + index),
    source: "ebay",
    sourceUrl: `https://www.ebay.com/itm/${6000 + suffix + index}`,
    attribution: "exact",
    evidenceKind: "completed_sale",
    gradingCompany: "PSA",
    grade: "10",
    gradeQualifier: "",
    printing: "Holofoil",
    language: "English",
    currency,
    amount,
    soldAt: "2026-09-20",
  }));

function harness({
  person = owner,
  rows = [position()],
  returnedSales = sales(),
  delayed = null,
  allowance = 11,
  providerError = false,
  beforeWrite = null,
  guardAvailable = true,
} = {}) {
  const stored = new Map(rows.map((row) => [row.id, row]));
  const observations = new Map();
  const session = { active: true };
  const calls = { provider: 0, reserve: 0, write: 0, auth: 0, read: 0 };
  const database = {
    auth: {
      getUser: async () => {
        calls.auth += 1;
        return { data: { user: person ? { id: person } : null }, error: null };
      },
    },
    from(table) {
      if (table === "collection_items") {
        let id, userId;
        const query = {
          select() {
            return query;
          },
          eq(column, value) {
            if (column === "id") id = value;
            if (column === "user_id") userId = value;
            return query;
          },
          async maybeSingle() {
            calls.read += 1;
            const row = stored.get(id);
            return {
              data: row?.user_id === userId ? structuredClone(row) : null,
              error: null,
            };
          },
        };
        return query;
      }
      throw new Error(`Unexpected direct write/read table: ${table}`);
    },
    async rpc(name, args) {
      if (name === "persist_verified_graded_valuation") {
        if (!guardAvailable)
          return { data: null, error: { message: "function missing" } };
        if (!session.active)
          return {
            data: null,
            error: { message: "valuation_session_expired" },
          };
        if (args.p_observation && beforeWrite) beforeWrite(stored);
        const latest = stored.get(args.p_position_id);
        if (
          !latest ||
          latest.user_id !== args.p_owner_id ||
          JSON.stringify(valuationPositionContract(latest)) !==
            JSON.stringify(args.p_expected)
        )
          return {
            data: null,
            error: { message: "valuation_context_changed" },
          };
        const row = args.p_observation;
        if (row) {
          calls.write += 1;
          assert.equal(row.user_id, owner);
          if (!observations.has(row.id))
            observations.set(row.id, structuredClone(row));
        }
        return { data: row ? observations.get(row.id) : null, error: null };
      }
      assert.equal(name, "reserve_provider_daily_credits");
      assert.equal(args.p_requested, 11);
      calls.reserve += 1;
      return { data: allowance, error: null };
    },
  };
  const handler = createGradedValuationHandler({
    createClientImpl: () => database,
    environment: () => ({
      supabaseUrl: "http://127.0.0.1",
      supabaseSecretKey: "synthetic",
      pkmnpricesApiKey: "synthetic",
      pkmnpricesPlan: "pro",
    }),
    now: () => at,
    fetchSales: async (_key, lookup) => {
      calls.provider += 1;
      assert.equal(lookup.pkmnpricesId, "20618");
      if (delayed) await delayed();
      if (providerError) throw new Error("synthetic provider failure");
      return { cardId: "20618", sales: returnedSales, hasMore: false };
    },
  });
  async function request(id, body = {}) {
    let status, result;
    const response = {
      setHeader() {},
      status(code) {
        status = code;
        return response;
      },
      json(value) {
        result = value;
        return response;
      },
    };
    await handler(
      {
        method: "POST",
        headers: {
          authorization: `Bearer synthetic.${Buffer.from(JSON.stringify({ session_id: owner })).toString("base64url")}.synthetic`,
        },
        body: { positionId: id, ...body },
      },
      response,
    );
    return { status, result };
  }
  return { request, calls, stored, observations, session };
}

test("server ignores forged browser amounts and source flags; retry is idempotent", async () => {
  const row = position();
  const returnedSales = sales();
  const run = harness({ rows: [row], returnedSales });
  const forged = {
    amount: 90000,
    validated: true,
    evidenceIds: ["fake"],
    ownerId: other,
  };
  const first = await run.request(row.id, forged);
  const second = await run.request(row.id, forged);
  assert.equal(first.status, 200);
  assert.equal(first.result.valuation.amount, 120);
  assert.equal(second.status, 200);
  assert.equal(run.observations.size, 1);
  assert.equal([...run.observations.values()][0].amount, 120);
  assert.equal(run.calls.provider, 2);
  assert.equal(run.calls.reserve, 2);
  returnedSales[0].amount = 110;
  assert.equal((await run.request(row.id)).status, 200);
  assert.equal(
    run.observations.size,
    2,
    "new valid evidence retains the prior immutable observation",
  );
});

test("authentication, ownership, exact identity, allowance and failed evidence gate provider and writes", async () => {
  const row = position();
  for (const options of [
    { person: null, rows: [row], expected: 401 },
    { person: other, rows: [row], expected: 404 },
    {
      rows: [
        {
          ...row,
          identity_snapshot: { ...row.identity_snapshot, edition: "unknown" },
        },
      ],
      expected: 422,
    },
    { rows: [row], allowance: 0, expected: 429 },
    { rows: [row], guardAvailable: false, expected: 503 },
    { rows: [row], returnedSales: sales().slice(0, 2), expected: 200 },
    { rows: [row], providerError: true, expected: 502 },
  ]) {
    const run = harness(options);
    const response = await run.request(row.id);
    assert.equal(response.status, options.expected);
    assert.equal(run.calls.write, 0);
    if (
      options.expected === 401 ||
      options.expected === 404 ||
      options.expected === 422 ||
      options.expected === 429 ||
      options.guardAvailable === false
    )
      assert.equal(run.calls.provider, 0);
    if (
      [401, 404, 422].includes(options.expected) ||
      options.guardAvailable === false
    )
      assert.equal(run.calls.reserve, 0);
  }
});

test("changed stored grade during provider delay prevents write", async () => {
  const row = position();
  let release;
  const run = harness({
    rows: [row],
    delayed: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const pending = run.request(row.id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  run.stored.set(row.id, { ...row, grade: 9 });
  release();
  assert.equal((await pending).status, 409);
  assert.equal(run.observations.size, 0);
});

test("correction at the final persistence boundary cannot leave a stale-context row", async () => {
  const row = position();
  const run = harness({
    rows: [row],
    beforeWrite: (stored) => stored.set(row.id, { ...row, grade: 9 }),
  });
  const response = await run.request(row.id);
  assert.equal(response.status, 409);
  assert.equal(run.observations.size, 0);
});

test("revoked authenticated session during provider delay prevents persistence", async () => {
  const row = position();
  let release;
  const run = harness({
    rows: [row],
    delayed: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const pending = run.request(row.id);
  await new Promise((resolve) => setTimeout(resolve, 0));
  run.session.active = false;
  release();
  assert.equal((await pending).status, 401);
  assert.equal(run.observations.size, 0);
});

test("stored producer and source facts revalidate historical and current valuation", () => {
  const row = position();
  const computed = exactSoldObservation(
    row,
    { cardId: "20618", sales: sales(), hasMore: false },
    "2026-09-25T12:00:00Z",
    at,
  );
  assert.equal(computed.result.estimate, 120);
  const stored = readExactSoldObservation(computed.row, row, at);
  assert.equal(stored.amount, 120);
  assert.equal(stored.current.estimate, 120);
  assert.equal(
    readExactSoldObservation({ ...computed.row, amount: 900 }, row, at),
    null,
  );
  assert.equal(
    readExactSoldObservation(
      { ...computed.row, quality: { context: computed.row.quality.context } },
      row,
      at,
    ),
    null,
  );
  assert.equal(
    readExactSoldObservation(
      { ...computed.row, valuation_type: "market" },
      row,
      at,
    ),
    null,
  );
  assert.equal(
    readExactSoldObservation(computed.row, { ...row, grade: 9 }, at).current,
    null,
  );
  const later = readExactSoldObservation(
    computed.row,
    row,
    Date.parse("2026-11-01T00:00:00Z"),
  );
  assert.equal(later.amount, 120);
  assert.equal(later.current, null);
});

test("synthetic graded A/B/C USD and separate EUR reconcile dated sales without backfill", () => {
  const make = (name, price, cost, bought, sale = null) => {
    const row = position(randomUUID());
    const observation = exactSoldObservation(
      row,
      {
        cardId: "20618",
        sales: sales(
          "USD",
          [price - 20, price, price + 20],
          name.charCodeAt(0) * 10,
        ),
      },
      "2026-09-25T12:00:00Z",
      at,
    ).row;
    const verified = readExactSoldObservation(observation, row, at);
    return {
      cardState: "graded",
      currency: "USD",
      quantity: sale ? 0 : 1,
      lots: [
        {
          acquiredAt: bought,
          acquisitionDateKnown: true,
          quantityAcquired: 1,
          quantityRemaining: sale ? 0 : 1,
          totalCost: cost,
          remainingCost: sale ? 0 : cost,
          costBasisKnown: true,
          currency: "USD",
        },
      ],
      transactions: sale
        ? [
            {
              type: "sale",
              date: sale,
              quantity: 1,
              currency: "USD",
              netProceeds: 300,
              allocatedCost: cost,
            },
          ]
        : [],
      matchedHistory: [verified],
      soldValuation: verified.current,
    };
  };
  const items = [
    make("A", 150, 100, "2026-09-01"),
    make("B", 250, 200, "2026-09-05", "2026-09-25"),
    make("C", 70, 50, "2026-09-20"),
  ];
  const point = portfolioProfitLossHistory(items)[0];
  assert.equal(point.date, "2026-09-01");
  const last = portfolioProfitLossHistory(items).at(-1);
  assert.deepEqual(
    [last.valueMinor, last.unrealizedMinor, last.realizedMinor],
    [22000, 7000, 10000],
  );
  const eur = position(randomUUID(), "EUR");
  const euroObservation = exactSoldObservation(
    eur,
    { cardId: "20618", sales: sales("EUR", [90, 110, 130], 900) },
    "2026-09-25T12:00:00Z",
    at,
  ).row;
  assert.equal(readExactSoldObservation(euroObservation, eur, at).amount, 110);
});

test("actual adapter uses one direct identity request plus one ten-row sales request, with no retry/fallback", async () => {
  const row = position();
  row.identity_snapshot = {
    ...row.identity_snapshot,
    name: "Clefable (1)",
    set: "Jungle",
    number: "01/64",
    variant: "1st Edition Holofoil",
    edition: "first_edition",
  };
  const lookup = {
    clientId: row.identity_snapshot.providerCardId,
    pkmnpricesId: "20618",
    name: "Clefable (1)",
    set: "Jungle",
    number: "01/64",
    language: "en",
    variant: "1st Edition Holofoil",
    finish: "holofoil",
    edition: "first_edition",
    promoType: "none",
    grader: "PSA",
    grade: "10",
    gradeQualifier: "",
    currency: "USD",
  };
  const card = {
    id: 20618,
    name: "Clefable (1)",
    number: "01",
    total_set_number: "64",
    set: { name: "Jungle" },
    language: "English",
    prices: [{ variant: "1st Edition Holofoil", currency: "USD" }],
  };
  const rawSales = [100, 120, 140].map((price, index) => ({
    id: String(7000 + index),
    ebay_listing_id: String(7000 + index),
    title: "Clefable Jungle 01/64 1st Edition Holofoil PSA 10",
    price,
    currency: "USD",
    grader: "PSA",
    grade: "10",
    grade_qualifier: null,
    variant: "1st Edition Holofoil",
    attribution: "exact",
    language: "English",
    sold_at: "2026-09-20",
    listing_url: `https://www.ebay.com/itm/${7000 + index}`,
  }));
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (input) => {
      const url = new URL(input);
      calls.push(url.href);
      assert.equal(url.origin, "https://api.pkmnprices.com");
      if (calls.length === 1) {
        assert.equal(url.pathname, "/v1/cards/20618");
        return Response.json(card);
      }
      assert.equal(calls.length, 2);
      assert.equal(url.pathname, "/v1/cards/20618/listings/ebay");
      assert.equal(url.searchParams.get("limit"), "10");
      return Response.json({ data: rawSales, pagination: { has_more: true } });
    };
    const evidence = await fetchPkmnPricesSales(
      "synthetic",
      lookup,
      undefined,
      { directOnly: true, maxAttempts: 1 },
    );
    assert.equal(calls.length, 2);
    assert.equal(
      exactSoldObservation(row, evidence, "2026-09-25T12:00:00Z", at).result
        .estimate,
      120,
    );
    calls.length = 0;
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return Response.json({ error: "synthetic failure" }, { status: 503 });
    };
    await assert.rejects(
      fetchPkmnPricesSales("synthetic", lookup, undefined, {
        directOnly: true,
        maxAttempts: 1,
      }),
    );
    assert.equal(calls.length, 1);
    calls.length = 0;
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return Response.json({ ...card, name: "Raichu" });
    };
    assert.equal(
      (
        await fetchPkmnPricesSales("synthetic", lookup, undefined, {
          directOnly: true,
          maxAttempts: 1,
        })
      ).cardId,
      null,
    );
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
