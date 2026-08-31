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
