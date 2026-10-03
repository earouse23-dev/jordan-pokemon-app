import { performance } from "node:perf_hooks";
import { inspectCollectionCsv, parseCollectionCsv } from "../lib/core.js";
import {
  buildCollectionImportPreview,
  chunkImportRows,
  sha256Text,
} from "../lib/ingestion.js";

const rowCount = 5_000;
const header =
  "Name,Set,Number,Language,Variant,Quantity,Condition,Purchase Date,Purchase Price,Currency";
const rows = Array.from({ length: rowCount }, (_, index) => {
  const number = index + 1;
  return `Benchmark Card ${number},Synthetic Set,${number}/5000,en,Normal,1,Near Mint,2026-01-02,1.00,USD`;
});
const csv = [header, ...rows].join("\n");

const startedAt = performance.now();
const inspection = inspectCollectionCsv(csv);
const parsed = parseCollectionCsv(csv, { limit: rowCount });
const preview = buildCollectionImportPreview(parsed.records, parsed.errors);
const digest = await sha256Text(csv);
const chunks = chunkImportRows(
  preview.rows.map((row, index) => ({ rowNumber: index + 2, payload: row })),
  200,
);
const durationMs = performance.now() - startedAt;

const result = {
  fixture: "synthetic-5000-row-csv",
  rows: inspection.rowCount,
  stagedRows: preview.rows.length,
  blockingErrors: preview.errors.length,
  chunks: chunks.length,
  sha256: digest,
  durationMs: Number(durationMs.toFixed(2)),
  rowsPerSecond: Number((rowCount / (durationMs / 1_000)).toFixed(2)),
  scope:
    "Local parse, mapping, duplicate review, hashing, and chunk preparation only; excludes network and competitor speed.",
};

if (
  result.rows !== rowCount ||
  result.stagedRows !== rowCount ||
  result.blockingErrors !== 0 ||
  result.chunks !== 25 ||
  durationMs > 5_000
) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
