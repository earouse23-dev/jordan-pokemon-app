import test from "node:test";
import assert from "node:assert/strict";
import {
  claimPkmnPricesCredits,
  requestCreditBound,
  pkmnPricesRequests,
} from "../lib/pkmnprices-requests.js";
import {
  fetchPkmnPricesLookup,
  fetchPkmnPricesSealedSearch,
  fetchPkmnPricesSealedProduct,
} from "../lib/providers/pkmnprices.js";

const configuredClaim = pkmnPricesRequests.claim;
const authenticate = pkmnPricesRequests.authenticate;

test("paid reads reject absent, malformed and invalid sessions without provider traffic", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({ error: "invalid session" }, { status: 401 });
  });
  for (const authorization of [undefined, "malformed", "Bearer invalid"]) {
    let status;
    const headers = {};
    const response = {
      setHeader: (k, v) => (headers[k] = v),
      status: (v) => {
        status = v;
        return response;
      },
      json: () => {},
    };
    assert.equal(
      await authenticate({ headers: { authorization } }, response, {
        supabaseUrl: "https://fixture.supabase.co",
        supabaseSecretKey: "fixture",
      }),
      false,
    );
    assert.equal(status, 401);
    assert.equal(headers["Cache-Control"], "no-store");
  }
  assert.equal(calls, 1);
});

test("server requires verified Pro configuration and a private ledger before any outbound request", async () => {
  for (const config of [
    {},
    { pkmnpricesPlan: "pro" },
    {
      pkmnpricesPlan: "free",
      supabaseUrl: "https://fixture.supabase.co",
      supabaseSecretKey: "fixture",
    },
  ])
    await assert.rejects(
      configuredClaim(
        "https://api.pkmnprices.com/v1/cards/1",
        undefined,
        config,
      ),
      (e) => e.code === "provider_budget_unconfigured",
    );
});

test("provider bounds cover every paid endpoint and reject unknown or unlimited URLs", () => {
  for (const [path, expected] of [
    ["cards/123", 1],
    ["sealed/12", 1],
    ["cards?per_page=20", 20],
    ["sealed?per_page=12", 12],
    ["cards/123/prices/history?limit=365", 365],
    ...["ebay", "tcgplayer", "cardmarket"].map((s) => [
      `cards/123/listings/${s}?limit=10`,
      10,
    ]),
  ])
    assert.equal(
      requestCreditBound("https://api.pkmnprices.com/v1/" + path),
      expected,
    );
  for (const path of [
    "cards",
    "cards?per_page=21",
    "cards?per_page=-1",
    "cards/1/prices/history?limit=366",
    "unknown",
  ])
    assert.throws(() =>
      requestCreditBound("https://api.pkmnprices.com/v1/" + path),
    );
  assert.throws(() => requestCreditBound("https://hostile.example/v1/cards/1"));
});

test("separate request instances share compare-and-set pacing and the locked daily ledger", async (t) => {
  let clock = Date.parse("2026-10-04T00:00:00Z"),
    reserved = 0;
  const row = {
    updated_at: new Date(clock).toISOString(),
    rate_limit_resets_at: null,
  };
  const slots = [];
  t.mock.method(globalThis, "setTimeout", (callback, ms) => {
    clock += ms;
    queueMicrotask(callback);
    return 0;
  });
  const database = {
    async rpc(name, args) {
      assert.equal(name, "reserve_provider_daily_credits");
      assert.equal(args.p_daily_budget, 20_000);
      row.updated_at = new Date(clock).toISOString();
      const granted = Math.min(args.p_requested, 20_000 - reserved);
      reserved += granted;
      return { data: granted, error: null };
    },
    from(table) {
      assert.equal(table, "provider_sync_status");
      let patch, expected;
      const query = {
        eq(key, value) {
          if (key === "rate_limit_resets_at") expected = value;
          return query;
        },
        is(key, value) {
          assert.equal(key, "rate_limit_resets_at");
          expected = value;
          return query;
        },
        update(value) {
          patch = value;
          return query;
        },
        select() {
          if (!patch) return query;
          if (row.rate_limit_resets_at !== expected)
            return Promise.resolve({ data: [], error: null });
          Object.assign(row, patch);
          slots.push(Date.parse(patch.rate_limit_resets_at));
          return Promise.resolve({
            data: [{ provider: "pkmnprices" }],
            error: null,
          });
        },
        async single() {
          return { data: structuredClone(row), error: null };
        },
      };
      return query;
    },
  };
  await Promise.all([
    claimPkmnPricesCredits(database, 12),
    claimPkmnPricesCredits(database, 20),
  ]);
  assert.equal(reserved, 32);
  assert.equal(slots.length, 2);
  assert(slots[1] - slots[0] >= 1250);
  reserved = 19_999;
  await assert.rejects(
    claimPkmnPricesCredits(database, 10),
    (e) => e.code === "provider_daily_budget_reached",
  );
  assert.equal(reserved, 20_000);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    claimPkmnPricesCredits(database, 1, controller.signal),
    (e) => e.name === "AbortError",
  );
  await assert.rejects(
    claimPkmnPricesCredits({ rpc: async () => ({ error: true }) }, 1),
    (e) => e.code === "provider_budget_unavailable",
  );
});

test("cached and simultaneous identical reads spend once; errors stop and are not cached", async (t) => {
  pkmnPricesRequests.cache.clear();
  pkmnPricesRequests.pending.clear();
  let claims = 0,
    requests = 0,
    status = 200;
  t.mock.method(pkmnPricesRequests, "claim", async (url) => {
    assert.equal(requestCreditBound(url), 12);
    claims++;
  });
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return Response.json(
      status === 200 ? { data: [] } : { error: { code: "quota_exceeded" } },
      { status },
    );
  });
  await Promise.all(
    Array.from({ length: 8 }, () =>
      fetchPkmnPricesSealedSearch("fixture", "etb", "en"),
    ),
  );
  await fetchPkmnPricesSealedSearch("fixture", "etb", "en");
  assert.equal(requests, 1);
  assert.equal(claims, 1);
  status = 429;
  for (let attempt = 0; attempt < 2; attempt++)
    await assert.rejects(
      fetchPkmnPricesSealedSearch("fixture", "different product", "de"),
      (e) => e.status === 429,
    );
  assert.equal(requests, 3);
  assert.equal(claims, 3);
  status = 503;
  await assert.rejects(
    fetchPkmnPricesSealedSearch("fixture", "unavailable product", "ja"),
    (e) => e.status === 503,
  );
  assert.equal(requests, 6);
  assert.equal(claims, 6);
});

test("pacing headroom covers delayed delivery within the ten-second deadline", () => {
  // Requests delivered in any 60s can only come from slots in a 70s interval.
  const maximum = Math.floor((60_000 + 10_000) / 1250) + 1;
  assert(maximum <= 60);
});

test("sealed detail explicitly requests Cardmarket EUR and preserves returned mapped links", async (t) => {
  pkmnPricesRequests.cache.clear();
  pkmnPricesRequests.pending.clear();
  t.mock.method(pkmnPricesRequests, "claim", async (url) =>
    assert.equal(requestCreditBound(url), 1),
  );
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = new URL(input);
    assert.equal(url.pathname, "/v1/sealed/42");
    assert.equal(url.searchParams.get("currency"), "eur");
    return Response.json({
      id: 42,
      name: "Synthetic ETB",
      cardmarket_product_id: 123,
      cardmarket_url:
        "https://www.cardmarket.com/en/Pokemon/Products/Elite-Trainer-Boxes/Synthetic-ETB",
      prices: [
        {
          source: "cardmarket",
          currency: "EUR",
          market_price: 50,
          created_at: "2026-10-01",
        },
      ],
    });
  });
  const product = await fetchPkmnPricesSealedProduct("fixture", 42);
  assert.equal(product.externalIds.cardmarket, 123);
  assert.equal(product.quotes[0].currency, "EUR");
  assert.equal(product.quotes[0].providerUrl, product.cardmarketUrl);
  assert.equal(product.quotes[0].amount, 50);
});

test("quota exhaustion in EUR or history stops the complete lookup without another paid request", async (t) => {
  t.mock.method(pkmnPricesRequests, "claim", async () => {});
  for (const includeEur of [true, false]) {
    pkmnPricesRequests.cache.clear();
    pkmnPricesRequests.pending.clear();
    let outbound = 0;
    t.mock.method(globalThis, "fetch", async () => {
      outbound++;
      return outbound === 1
        ? Response.json({ id: 20618, prices: [] })
        : Response.json({ error: { code: "quota_exceeded" } }, { status: 429 });
    });
    await assert.rejects(fetchPkmnPricesLookup("fixture", { pkmnpricesId: "20618" }, undefined, { includeEur, includeEurHistory: true }), (error) => error.status === 429);
    assert.equal(outbound, 2, "no retry, next currency or history page after exhaustion");
  }
});

test("sealed EUR history uses its own bounded endpoint and keeps source aggregates separate from sold evidence", async (t) => {
  pkmnPricesRequests.cache.clear();
  const bounds = [], urls = [];
  t.mock.method(pkmnPricesRequests, "claim", async url => bounds.push(requestCreditBound(url)));
  t.mock.method(globalThis, "fetch", async input => {
    const url = new URL(input); urls.push(url);
    assert.equal(url.searchParams.get("currency"), "eur");
    if (url.pathname.endsWith("/prices/history")) {
      assert.equal(url.pathname, "/v1/sealed/5678/prices/history");
      assert.equal(url.searchParams.get("period"), "365d");
      assert.equal(url.searchParams.get("limit"), "365");
      const page = Number(url.searchParams.get("page"));
      return Response.json({ data: [{ date: page === 1 ? "2026-10-01" : "2026-10-02", avg: page * 100, source: "cardmarket", currency: "EUR", condition: "Near Mint" }], pagination: { page, total_pages: 2 } });
    }
    return Response.json({ id: 5678, name: "Fixture ETB", prices: [] });
  });
  const product = await fetchPkmnPricesSealedProduct("fixture", "5678", undefined, { includeHistory: true });
  assert.deepEqual(bounds, [1, 365, 365]);
  assert.equal(urls.length, 3);
  assert.equal(product.historyStatus, "live");
  assert.deepEqual(product.history.map(point => [point.amount, point.currency, point.finish, point.gradingCompany]), [[100, "EUR", "sealed", null], [200, "EUR", "sealed", null]]);
  assert.equal(product.history[0].quality.sourceCondition, "Near Mint");
  assert.equal(product.capabilities.completedSales, "not_requested");
  assert.equal(product.quotes.length, 0, "history does not invent a current quote");
});
