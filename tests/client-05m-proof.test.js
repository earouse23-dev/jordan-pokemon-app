import "./pkmnprices-fixture.mjs";
import salesHandler from "../api/sales.js";
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createGuard,
  listMatches,
  listUrl,
  runAttempt,
  verify05l,
} from "../scripts/client-05m-proof.mjs";
import { soldUrl, lookup, valuationFromApi } from "../scripts/client-05l-proof.mjs";

const row = {
  id: 20618,
  name: "Clefable (1)",
  number: "1",
  total_set_number: "64",
  set: { name: "Jungle" },
};
const membership = {
  data: [row],
  pagination: { page: 1, per_page: 1, total: 1, total_pages: 1 },
};
const sale = {
  id: "91001",
  ebay_listing_id: "91001",
  title: "Clefable Jungle 01/64 1st Edition Holofoil PSA 10",
  listing_url: "https://www.ebay.com/itm/91001",
  price: 100,
  currency: "USD",
  sold_at: "2026-09-24",
  ingested_at: "2026-09-25T00:00:00Z",
  attribution: "exact",
  language: "English",
  variant: "1st Edition Holofoil",
  grader: "PSA",
  grade: "10",
};
const response = (body, status = 200, charge = "1") =>
  Response.json(body, { status, headers: { "x-credits-charged": charge } });
const fake = (url) =>
  String(url) === listUrl
    ? response(membership)
    : response({ data: [sale], pagination: { has_more: false } }, 200, "1");
const ledger = () => ({
  requests: [],
  reservedCredits: 0,
  cachedDirectUses: 0,
  membershipGate: "not_run",
});
// Synthetic direct identity for the pure bounded transport guard; never a live crosswalk.
const syntheticOld = {
  observedAt: "2026-09-25T00:00:00Z",
  direct: { ...row, number: "01", set: "Jungle", prices: [{ variant: "1st Edition Holofoil", currency: "USD" }] },
};
const directUrl = "https://api.pkmnprices.com/v1/cards/20618?currency=usd";

test("immutable 05L proof and documented English list filter are frozen", () => {
  assert.throws(() => verify05l(), /frozen file changed|ENOENT/);
  assert.match(readFileSync("scripts/client-05m-proof.mjs", "utf8"), /4a6a33dc3f54167d6e3b50c48a9e460a9ffb32a2497a2b6f42513bec332d1603/);
  assert.equal(syntheticOld.direct.id, 20618);
  const url = new URL(listUrl);
  assert.equal(url.pathname, "/v1/cards");
  assert.deepEqual(
    [...url.searchParams.entries()],
    [
      ["name", "Clefable (1)"],
      ["number", "01"],
      ["total_set_number", "64"],
      ["language", "English"],
      ["per_page", "1"],
      ["page", "1"],
    ],
  );
  assert.equal(listMatches(membership), true);
  for (const changed of [
    { data: [] },
    { data: [row, row] },
    { data: [{ ...row, id: 20619 }] },
    { data: [{ ...row, name: "Clefable" }] },
    { data: [{ ...row, number: "02" }] },
    { data: [{ ...row, total_set_number: null }] },
    { data: [{ ...row, set: { name: "Fossil" } }] },
    { data: [{ ...row, language: "Japanese" }] },
    { data: [{ ...row, set: { ...row.set, language: "Japanese" } }] },
    { pagination: null },
  ])
    assert.equal(listMatches({ ...membership, ...changed }), false);
  assert.equal(
    listMatches({ ...membership, data: [{ ...row, language: "English" }] }),
    true,
  );
});

test("guard has one membership request, one replayed direct read and one sale request", async () => {
  let outbound = 0;
  const state = ledger();
  const guard = createGuard(
    async (url, options) => {
      outbound++;
      assert.equal(options.redirect, "error");
      return fake(url);
    },
    state,
    () => {},
    syntheticOld,
  );
  for (const url of [
    soldUrl,
    directUrl,
    listUrl.replace("language=English", "language=Japanese"),
    listUrl.replace("per_page=1", "per_page=2"),
    `${listUrl}&id=20618`,
  ])
    await assert.rejects(() => guard.fetch(url), /CLIENT-05M guard/);
  await assert.rejects(
    () => guard.fetch(listUrl, { redirect: "follow" }),
    /CLIENT-05M guard/,
  );
  assert.equal(outbound, 0);
  await guard.fetch(listUrl);
  await assert.rejects(() => guard.fetch(listUrl), /CLIENT-05M guard/);
  await assert.rejects(() => guard.fetch(soldUrl), /CLIENT-05M guard/);
  assert.equal((await (await guard.fetch(directUrl)).json()).id, 20618);
  assert.equal(outbound, 1);
  await assert.rejects(() => guard.fetch(directUrl), /CLIENT-05M guard/);
  await guard.fetch(soldUrl);
  for (const url of [
    soldUrl,
    `${soldUrl}&cursor=next`,
    soldUrl.replace("grade=10", "grade=9"),
  ])
    await assert.rejects(() => guard.fetch(url), /CLIENT-05M guard/);
  assert.equal(outbound, 2);
  assert.equal(state.reservedCredits, 11);
  assert.equal(state.cachedDirectUses, 1);
  assert.deepEqual(
    state.requests.map((r) => r.stage),
    ["membership", "sales"],
  );
});

test("membership errors, contradictions and timeout cannot unlock direct replay or sales", async () => {
  for (const first of [
    response({ ...membership, data: [{ ...row, id: 20619 }] }),
    response({ data: [], pagination: membership.pagination }),
    response({}, 500),
    new Response("", { status: 302 }),
  ]) {
    let sent = 0;
    const state = ledger();
    const guard = createGuard(
      async () => {
        sent++;
        return first.clone();
      },
      state,
      () => {},
      syntheticOld,
    );
    await assert.rejects(() => guard.fetch(listUrl), /CLIENT-05M guard/);
    for (const url of [listUrl, directUrl, soldUrl])
      await assert.rejects(() => guard.fetch(url), /CLIENT-05M guard/);
    assert.equal(sent, 1);
    assert.equal(state.reservedCredits, 1);
  }
  let sent = 0;
  const state = ledger();
  const guard = createGuard(
    async () => {
      sent++;
      throw new Error("timeout");
    },
    state,
    () => {},
    syntheticOld,
  );
  await assert.rejects(() => guard.fetch(listUrl), /no retry/);
  await assert.rejects(() => guard.fetch(listUrl), /CLIENT-05M guard/);
  assert.equal(sent, 1);
  assert.equal(state.requests[0].status, "unknown_outcome");
});

test("current API/adapter uses the bounded fake transport; closed historical runner refuses reuse", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "mica-client-05m-test-"));
  let sent = 0;
  const closedAttempt = () => runAttempt({
    transport: async () => { sent++; return fake(listUrl); },
    apiKey: "synthetic-only", directory,
    now: Date.parse("2026-09-25T12:00:00Z"),
  });
  await assert.rejects(closedAttempt, /frozen file changed|ENOENT/);
  await assert.rejects(closedAttempt, /frozen file changed|ENOENT/);
  assert.equal(sent, 0);
  const state = ledger();
  const guard = createGuard(fake, state, () => {}, syntheticOld);
  await guard.fetch(listUrl);
  t.mock.method(globalThis, "fetch", guard.fetch);
  const previousKey = process.env.PKMNPRICES_API_KEY;
  process.env.PKMNPRICES_API_KEY = "synthetic-only";
  t.after(() => {
    if (previousKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = previousKey;
  });
  const output = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await salesHandler({ method: "GET", query: { lookup: JSON.stringify(lookup) }, headers: { authorization: "Bearer synthetic-only" } }, output);
  const production = valuationFromApi(output.body, "2026-09-25T12:00:00Z", false);
  assert.equal(state.membershipGate, "pass");
  assert.equal(state.requests.length, 2);
  assert.equal(state.cachedDirectUses, 1);
  assert.equal(output.statusCode, 200);
  assert.equal(output.body.receivedCount, 1);
  assert.equal(production.status, "insufficient");
  assert.equal(production.distinctSaleCount, 1);
  assert.equal(JSON.stringify(state).includes("synthetic-only"), false);
  for (const url of [listUrl, directUrl, soldUrl])
    await assert.rejects(() => guard.fetch(url), /CLIENT-05M guard/);
});
