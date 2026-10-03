import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCollectionImportPreview,
  chunkImportRows,
  confirmIngestionEnvelope,
  createIngestionEnvelope,
  INGESTION_CONTRACT_VERSION,
  sha256Text,
} from "../lib/ingestion.js";
import { inspectCollectionCsv, parseCollectionCsv } from "../lib/core.js";
import {
  beginCollectionImport,
  commitCollectionImport,
  previewCollectionImport,
  recordIngestionEvent,
  rollbackCollectionImport,
  stageCollectionImportRows,
} from "../lib/supabase-data.js";

test("custom CSV mapping previews unfamiliar headers before parsing", () => {
  const csv = "Card title,Owned,Expansion,Card no.\nPikachu,2,Base Set,58/102";
  const inspection = inspectCollectionCsv(csv);
  assert.equal(inspection.source, "Generic CSV");
  assert.equal(inspection.rowCount, 1);
  assert.equal(inspection.suggestedMapping.name, "");
  const parsed = parseCollectionCsv(csv, {
    mapping: {
      name: "Card title",
      quantity: "Owned",
      set: "Expansion",
      number: "Card no.",
    },
  });
  assert.equal(parsed.errors.length, 0);
  assert.deepEqual(
    {
      name: parsed.records[0].name,
      quantity: parsed.records[0].quantity,
      set: parsed.records[0].set,
      number: parsed.records[0].number,
    },
    { name: "Pikachu", quantity: 2, set: "Base Set", number: "58/102" },
  );
});

test("photo ingestion remains unconfirmed when confidence is low", () => {
  const envelope = createIngestionEnvelope({
    channel: "camera",
    item: {
      id: "tcgdex:en:base1-4",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      language: "en",
      variant: "Holofoil",
    },
    matchConfidence: 0.71,
  });
  assert.equal(envelope.version, INGESTION_CONTRACT_VERSION);
  assert.equal(envelope.requiresConfirmation, true);
  assert.ok(envelope.confirmationReasons.includes("low_confidence_match"));
  const confirmed = confirmIngestionEnvelope(
    envelope,
    "2026-09-02T12:00:00.000Z",
  );
  assert.equal(confirmed.requiresConfirmation, false);
  assert.equal(confirmed.confirmedAt, "2026-09-02T12:00:00.000Z");
});

test("import preview combines exact repeats and reports different acquisition facts", () => {
  const base = {
    name: "Pikachu",
    set: "Base Set",
    number: "58/102",
    language: "en",
    variant: "Normal",
    condition: "Near Mint",
    quantity: 1,
    cost: 5,
    purchaseDate: "2026-01-02",
    currency: "USD",
    tags: [],
  };
  const preview = buildCollectionImportPreview([
    base,
    { ...base },
    { ...base, cost: 7 },
  ]);
  assert.equal(preview.canCommit, true);
  assert.equal(preview.summary.exactDuplicates, 1);
  assert.equal(preview.summary.possibleIdentityDuplicates, 1);
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].quantity, 2);
  assert.deepEqual(preview.rows[0].sourceRows, [2, 3]);
});

test("import staging chunks are bounded and file hashes are deterministic", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({ index }));
  const chunks = chunkImportRows(rows, 200);
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [200, 200, 200, 200, 200, 1],
  );
  assert.equal(await sha256Text("same file"), await sha256Text("same file"));
  assert.notEqual(await sha256Text("same file"), await sha256Text("changed"));
});

test("a 5,000-row file remains complete through preview and bounded staging", () => {
  const csv = [
    "Name,Set,Number,Quantity,Condition,Purchase Date,Purchase Price",
    ...Array.from(
      { length: 5_000 },
      (_, index) =>
        `Card ${index + 1},Synthetic,${index + 1}/5000,1,Near Mint,2026-01-02,1.00`,
    ),
  ].join("\n");
  const parsed = parseCollectionCsv(csv, { limit: 5_000 });
  const preview = buildCollectionImportPreview(parsed.records, parsed.errors);
  assert.equal(preview.errors.length, 0);
  assert.equal(preview.rows.length, 5_000);
  assert.equal(preview.summary.totalQuantity, 5_000);
  assert.deepEqual(
    chunkImportRows(preview.rows, 200).map((chunk) => chunk.length),
    [...Array(25).fill(200)],
  );
});

test("ambiguous duplicate headers block mapping before any row can stage", () => {
  const inspection = inspectCollectionCsv("Name,Name,Quantity\nPikachu,Pika,1");
  assert.equal(inspection.rowCount, 1);
  assert.match(inspection.errors.join(" "), /duplicate column/i);
});

test("a failed staging chunk never advances to atomic commit", async () => {
  const calls = [];
  const client = {
    async rpc(name) {
      calls.push(name);
      if (name === "stage_collection_import_rows" && calls.length === 2)
        return { data: null, error: new Error("network interrupted") };
      return { data: 200, error: null };
    },
  };
  await assert.rejects(async () => {
    for (const chunk of chunkImportRows(Array(401).fill({}), 200))
      await stageCollectionImportRows(client, "job-1", chunk);
    await commitCollectionImport(client, "job-1");
  }, /network interrupted/);
  assert.deepEqual(calls, [
    "stage_collection_import_rows",
    "stage_collection_import_rows",
  ]);
});

test("import client uses the atomic staging and rollback RPC contract", async () => {
  const calls = [];
  const client = {
    async rpc(name, values) {
      calls.push({ name, values });
      if (name === "begin_collection_import")
        return { data: "job-1", error: null };
      if (name === "stage_collection_import_rows")
        return { data: 1, error: null };
      if (name === "preview_collection_import")
        return { data: { validRows: 1, invalidRows: 0 }, error: null };
      if (name === "commit_collection_import")
        return { data: { status: "committed", createdRows: 1 }, error: null };
      if (name === "record_ingestion_event")
        return { data: "event-1", error: null };
      return { data: { status: "rolled_back", removedRows: 1 }, error: null };
    },
  };
  assert.equal(
    await beginCollectionImport(client, {
      sourceName: "Mica",
      fileSha256: "a".repeat(64),
      headerSignature: "name|quantity",
      mapping: { name: "name" },
      preview: { validRows: 1 },
    }),
    "job-1",
  );
  assert.equal(
    await stageCollectionImportRows(client, "job-1", [
      { rowNumber: 2, idempotencyKey: "key", payload: {} },
    ]),
    1,
  );
  assert.equal((await previewCollectionImport(client, "job-1")).invalidRows, 0);
  assert.equal(
    (await commitCollectionImport(client, "job-1")).status,
    "committed",
  );
  assert.equal(
    (await rollbackCollectionImport(client, "job-1")).status,
    "rolled_back",
  );
  assert.equal(
    await recordIngestionEvent(client, {
      sessionId: "11111111-1111-4111-8111-111111111111",
      channel: "csv",
      stage: "committed",
      outcome: "success",
      durationMs: 100.4,
      metadata: { rowCount: 1 },
    }),
    "event-1",
  );
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "begin_collection_import",
      "stage_collection_import_rows",
      "preview_collection_import",
      "commit_collection_import",
      "rollback_collection_import_v2",
      "record_ingestion_event",
    ],
  );
});
