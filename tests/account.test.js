import assert from "node:assert/strict";
import test from "node:test";
import { listPrivateBucketPaths } from "../api/account.js";

test("account storage inventory includes root files and recursively paginates folders", async () => {
  const rootFiles = Array.from({ length: 101 }, (_, index) => ({
    id: `root-${index}`,
    name: `root-${String(index).padStart(3, "0")}.jpg`,
  }));
  const listings = new Map([
    ["owner", [...rootFiles, { id: null, name: "scan" }]],
    ["owner/scan", [{ id: null, name: "nested" }]],
    ["owner/scan/nested", [{ id: "deep", name: "capture.jpg" }]],
  ]);
  const list = async (prefix, { limit, offset }) => ({
    data: (listings.get(prefix) || []).slice(offset, offset + limit),
    error: null,
  });
  const database = {
    storage: { from: () => ({ list }) },
  };

  const inventory = await listPrivateBucketPaths(
    database,
    "owner",
    "grading-research",
  );

  assert.equal(inventory.paths.length, 102);
  assert.ok(inventory.paths.includes("owner/root-000.jpg"));
  assert.ok(inventory.paths.includes("owner/root-100.jpg"));
  assert.ok(inventory.paths.includes("owner/scan/nested/capture.jpg"));
});

test("unrelated profile saves preserve an existing currency; explicit supported changes are bounded", async () => {
  const { saveProfile } = await import("../lib/supabase-data.js");
  const stored = { id: "fixture-owner", display_currency: "EUR", preferences: {} };
  const payloads = [];
  const query = {
    upsert(row) { payloads.push(row); Object.assign(stored, row); return query; },
    select() { return query; },
    async single() { return { data: { ...stored }, error: null }; },
  };
  const client = { auth: { getUser: async () => ({ data: { user: { id: stored.id } } }) }, from: table => { assert.equal(table, "profiles"); return query; } };
  const saved = await saveProfile(client, { displayName: "Fixture name", preferences: {} });
  assert.equal(saved.displayCurrency, "EUR");
  assert.equal(Object.hasOwn(payloads[0], "display_currency"), false);
  assert.equal((await saveProfile(client, { displayCurrency: "USD" })).displayCurrency, "USD");
  await assert.rejects(saveProfile(client, { displayCurrency: "invalid" }), /Unsupported display currency/);
  assert.equal(payloads.length, 2, "invalid currency never reaches persistence");
});
