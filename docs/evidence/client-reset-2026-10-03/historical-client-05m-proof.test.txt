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
import { soldUrl } from "../scripts/client-05l-proof.mjs";

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
const directUrl = "https://api.pkmnprices.com/v1/cards/20618?currency=usd";

test("immutable 05L proof and documented English list filter are frozen", () => {
  const old = verify05l();
  assert.equal(
    old.hash,
    "4a6a33dc3f54167d6e3b50c48a9e460a9ffb32a2497a2b6f42513bec332d1603",
  );
  assert.equal(old.direct.id, 20618);
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
    verify05l(),
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
      verify05l(),
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
    verify05l(),
  );
  await assert.rejects(() => guard.fetch(listUrl), /no retry/);
  await assert.rejects(() => guard.fetch(listUrl), /CLIENT-05M guard/);
  assert.equal(sent, 1);
  assert.equal(state.requests[0].status, "unknown_outcome");
});

test("actual API/adapter and estimator run under fake transport, then restart is refused", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mica-client-05m-test-"));
  const result = await runAttempt({
    transport: fake,
    apiKey: "synthetic-only",
    directory,
    now: Date.parse("2026-09-25T12:00:00Z"),
  });
  assert.equal(result.ledger.membershipGate, "pass");
  assert.equal(result.ledger.requests.length, 2);
  assert.equal(result.ledger.cachedDirectUses, 1);
  assert.equal(result.ledger.apiStatus, 200);
  assert.equal(result.ledger.api.receivedCount, 1);
  assert.equal(result.ledger.production.status, "insufficient");
  assert.equal(result.ledger.production.distinctSaleCount, 1);
  assert.equal(
    readFileSync(result.path, "utf8").includes("synthetic-only"),
    false,
  );
  let sent = 0;
  await assert.rejects(
    () =>
      runAttempt({
        transport: async () => {
          sent++;
          return fake(listUrl);
        },
        apiKey: "synthetic-only",
        directory,
      }),
    { code: "EEXIST" },
  );
  assert.equal(sent, 0);
});
