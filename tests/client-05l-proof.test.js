import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cardUrl,
  soldUrl,
  source,
  sourceReady,
  directMatches,
  createGuard,
  runAttempt,
} from "../scripts/client-05l-proof.mjs";

const card = {
  id: 20618,
  name: "Clefable (1)",
  number: "01",
  total_set_number: "64",
  set: { name: "Jungle" },
  language: "English",
  prices: [{ variant: "1st Edition Holofoil", currency: "USD" }],
};
const rows = [
  {
    id: "1",
    ebay_listing_id: "1",
    title: "Clefable Jungle 01/64 1st Edition Holofoil PSA 10",
    listing_url: "https://www.ebay.com/itm/1",
    price: 100,
    currency: "USD",
    sold_at: "2026-09-24",
    ingested_at: "2026-09-25T00:00:00Z",
    attribution: "exact",
    language: "English",
    variant: "1st Edition Holofoil",
    grader: "PSA",
    grade: "10",
  },
];
const reply = (url) =>
  Response.json(
    String(url) === cardUrl
      ? card
      : { data: rows, pagination: { has_more: false } },
  );
const ledger = () => ({ requests: [], reservedCredits: 0 });

test("frozen source and direct gate reject absent or contradictory facts", () => {
  assert.equal(sourceReady(), true);
  assert.equal(sourceReady({ ...source, variants_detailed: [] }), false);
  assert.equal(directMatches(card), true);
  for (const changed of [
    { id: 20619 },
    { name: "Clefable" },
    { number: "1" },
    { total_set_number: null },
    { set: { name: "Fossil" } },
    { language: null },
    { language: "Japanese" },
    { prices: [] },
    { prices: [{ variant: "Unlimited Holofoil", currency: "USD" }] },
  ])
    assert.equal(directMatches({ ...card, ...changed }), false);
});

test("guard blocks changed sample, search, pagination, redirect, early/extra requests and retries before transport", async () => {
  let outbound = 0;
  const record = ledger();
  const guard = createGuard(
    async (url, options) => {
      outbound++;
      assert.equal(options.redirect, "error");
      return reply(url);
    },
    record,
    () => {},
  );
  for (const url of [
    soldUrl,
    cardUrl.replace("20618", "20619"),
    cardUrl.replace("api.pkmnprices.com", "example.com"),
    "https://api.pkmnprices.com/v1/cards?name=Clefable",
    `${soldUrl}&cursor=next`,
  ])
    await assert.rejects(() => guard.fetch(url), /CLIENT-05L guard/);
  await assert.rejects(
    () => guard.fetch(cardUrl, { redirect: "follow" }),
    /CLIENT-05L guard/,
  );
  assert.equal(outbound, 0);
  await guard.fetch(cardUrl);
  for (const url of [
    cardUrl,
    soldUrl.replace("limit=10", "limit=11"),
    soldUrl.replace("grade=10", "grade=9"),
    `${soldUrl}&cursor=next`,
    soldUrl.replace("20618", "20619"),
  ])
    await assert.rejects(() => guard.fetch(url), /CLIENT-05L guard/);
  assert.equal(outbound, 1);
  await guard.fetch(soldUrl);
  await assert.rejects(() => guard.fetch(soldUrl), /CLIENT-05L guard/);
  assert.equal(outbound, 2);
  assert.equal(record.reservedCredits, 11);
  assert.deepEqual(
    record.requests.map((request) => request.reservedCredits),
    [1, 10],
  );
});

test("direct failures spend the first slot and cannot unlock sale transport", async () => {
  for (const response of [
    Response.json({ ...card, language: null }),
    Response.json({}, { status: 404 }),
    Response.json({}, { status: 500 }),
    new Response("", { status: 302 }),
  ]) {
    let outbound = 0;
    const record = ledger();
    const guard = createGuard(
      async () => {
        outbound++;
        return response.clone();
      },
      record,
      () => {},
    );
    await assert.rejects(() => guard.fetch(cardUrl), /CLIENT-05L guard/);
    await assert.rejects(() => guard.fetch(soldUrl), /CLIENT-05L guard/);
    await assert.rejects(() => guard.fetch(cardUrl), /CLIENT-05L guard/);
    assert.equal(outbound, 1);
    assert.equal(record.reservedCredits, 1);
    assert.equal(record.directGate, "fail");
  }
});

test("network error and over-limit rows cannot retry or paginate", async () => {
  const failed = ledger();
  let sent = 0;
  const guard = createGuard(
    async () => {
      sent++;
      throw new Error("timeout");
    },
    failed,
    () => {},
  );
  await assert.rejects(() => guard.fetch(cardUrl), /no retry/);
  await assert.rejects(() => guard.fetch(cardUrl), /CLIENT-05L guard/);
  assert.equal(sent, 1);
  assert.equal(failed.requests[0].status, "unknown_outcome");
  const over = createGuard(
    (url) =>
      Response.json(
        String(url) === cardUrl ? card : { data: Array(11).fill(rows[0]) },
      ),
    ledger(),
    () => {},
  );
  await over.fetch(cardUrl);
  await assert.rejects(() => over.fetch(soldUrl), /exceeded ten/);
  await assert.rejects(() => over.fetch(soldUrl), /CLIENT-05L guard/);
});

test("one-shot private ledger prevents a restarted runner from spending again", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mica-client-05l-test-"));
  const result = await runAttempt({
    transport: reply,
    apiKey: "synthetic-only",
    directory,
    now: Date.parse("2026-09-25T12:00:00Z"),
  });
  assert.equal(result.ledger.requests.length, 2);
  assert.equal(result.ledger.reservedCredits, 11);
  assert.equal(result.ledger.directGate, "pass");
  assert.equal(result.ledger.rows.length, 1);
  assert.equal(result.ledger.production.status, "insufficient");
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
          return reply(cardUrl);
        },
        apiKey: "synthetic-only",
        directory,
      }),
    { code: "EEXIST" },
  );
  assert.equal(sent, 0);
});
