import "./pkmnprices-fixture.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { createClient05bGuard } from "../scripts/client-05b-guard.mjs";
import salesHandler from "../api/sales.js";

const card = {
  id: 10195,
  name: "Pikachu",
  number: "006",
  total_set_number: "015",
  set: { name: "McDonald's Promos 2023" },
  language: "English",
};
const lookup = {
  clientId: "offline-fixture-only",
  pkmnpricesId: "10195",
  name: card.name,
  set: card.set.name,
  number: "006/015",
  language: "en",
  grader: "PSA",
  grade: "10",
  variant: "Holofoil",
  currency: "USD",
};

async function exercise(first, second) {
  const calls = [];
  const guard = createClient05bGuard(
    async (url, options) => {
      calls.push({ url: String(url), redirect: options.redirect });
      return calls.length === 1 ? first : second;
    },
    { enabled: true },
  );
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.PKMNPRICES_API_KEY;
  globalThis.fetch = guard.fetch;
  process.env.PKMNPRICES_API_KEY = "offline-fixture-key";
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader() {},
    json(body) {
      this.body = body;
      return this;
    },
  };
  try {
    await salesHandler(
      { method: "GET", query: { lookup: JSON.stringify(lookup) } },
      response,
    );
    return { calls, ledger: guard.ledger, response, guard };
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = previousKey;
  }
}

test("actual API and adapter use only two allowlisted offline transports", async () => {
  const result = await exercise(
    Response.json(card),
    Response.json({ data: [], pagination: { has_more: false } }),
  );
  assert.equal(result.response.statusCode, 200);
  assert.equal(result.response.body.providerCardId, "10195");
  assert.equal(result.response.body.receivedCount, 0);
  assert.equal(result.response.body.acceptedCount, 0);
  assert.equal(result.response.body.hasMore, false);
  assert.equal(result.ledger.outbound, 2);
  assert.equal(result.ledger.reserved, 11);
  assert.deepEqual(
    result.calls.map((call) => call.redirect),
    ["error", "error"],
  );
  assert.match(result.calls[0].url, /\/cards\/10195\?currency=usd$/);
  assert.match(
    result.calls[1].url,
    /\/cards\/10195\/listings\/ebay\?limit=10&sort=date_desc&graded=true&variant=Holofoil&grader=PSA&grade=10$/,
  );
  await assert.rejects(
    () => result.guard.fetch(result.calls[1].url),
    /request guard stopped/,
  );
});

test("retry after server error is blocked before second transport", async () => {
  const result = await exercise(
    Response.json({ error: {} }, { status: 500 }),
    null,
  );
  assert.equal(result.response.statusCode, 502);
  assert.equal(result.calls.length, 1);
  assert.equal(result.ledger.reserved, 1);
});

test("404 search fallback is blocked before second transport", async () => {
  const result = await exercise(
    Response.json({ error: {} }, { status: 404 }),
    null,
  );
  assert.equal(result.response.statusCode, 502);
  assert.equal(result.calls.length, 1);
  assert.equal(result.ledger.reserved, 1);
});

test("wrong route, larger limit and disabled live access never reach transport", async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return Response.json(card);
  };
  const disabled = createClient05bGuard(transport);
  await assert.rejects(() =>
    disabled.fetch("https://api.pkmnprices.com/v1/cards/10195?currency=usd"),
  );
  const guard = createClient05bGuard(transport, { enabled: true });
  for (const url of [
    "https://evil.example/v1/cards/10195?currency=usd",
    "https://api.pkmnprices.com/v1/cards/search?q=Pikachu",
    "https://api.pkmnprices.com/v1/cards/10195/listings/ebay?limit=11",
  ])
    await assert.rejects(() => guard.fetch(url));
  assert.equal(calls, 0);
  assert.equal(guard.ledger.reserved, 0);
});

test("first card identity conflicts stop sales before second transport", async () => {
  for (const changed of [
    { name: "Flying Pikachu V" },
    { number: "007" },
    { total_set_number: null },
    { total_set_number: "016" },
    { set: { name: "Celebrations" } },
    { language: "Japanese" },
    { id: 10196 },
  ]) {
    const result = await exercise(Response.json({ ...card, ...changed }), null);
    assert.equal(result.response.statusCode, 502);
    assert.equal(result.calls.length, 1);
    assert.equal(result.ledger.reserved, 1);
  }
});

test("missing provider language is disclosed but does not invent a contradiction", async () => {
  const result = await exercise(
    Response.json({ ...card, language: null }),
    Response.json({ data: [], pagination: { has_more: false } }),
  );
  assert.equal(result.calls.length, 2);
  assert.equal(result.response.statusCode, 200);
});
