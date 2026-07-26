import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { evaluateVisionBenchmark } from "../lib/vision-evaluation.js";

const manifestPath = process.argv[2];
const live = process.argv.includes("--live");
const outputFlag = process.argv.indexOf("--output");
const outputPath =
  outputFlag >= 0 ? process.argv[outputFlag + 1] : "vision-evaluation.json";
const baseUrl = String(
  process.env.MICA_EVAL_BASE_URL || "http://localhost:3011",
).replace(/\/$/, "");
const accessToken = process.env.MICA_EVAL_ACCESS_TOKEN;

if (!manifestPath) {
  console.error(
    "Usage: npm run evaluate:vision -- <private-manifest.json> [--live] [--output report.json]",
  );
  process.exit(1);
}
if (live && !accessToken) {
  console.error("MICA_EVAL_ACCESS_TOKEN is required for a live benchmark.");
  process.exit(1);
}

const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const cases = Array.isArray(manifest) ? manifest : manifest.cases;
if (!Array.isArray(cases) || !cases.length)
  throw new Error("The benchmark manifest has no cases.");

function imageDataUrl(path) {
  const extension = extname(path).toLowerCase();
  const mime =
    extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : ["jpg", "jpeg"].includes(extension.slice(1))
          ? "image/jpeg"
          : null;
  if (!mime) throw new Error(`Unsupported benchmark image: ${path}`);
  return readFile(resolve(path)).then(
    (bytes) => `data:${mime};base64,${bytes.toString("base64")}`,
  );
}

async function runCase(entry) {
  const startedAt = Date.now();
  const images = await Promise.all((entry.images || []).map(imageDataUrl));
  const response = await fetch(`${baseUrl}/api/vision`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ mode: entry.mode, images }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      `${entry.id || "unnamed"}: vision endpoint returned ${response.status} (${body.code || body.error || "unknown error"})`,
    );

  let candidateIds = [];
  if (entry.mode === "identify" && body.analysis?.searchQuery) {
    const catalog = await fetch(
      `${baseUrl}/api/catalog?q=${encodeURIComponent(body.analysis.searchQuery)}&language=${encodeURIComponent(entry.language || "en")}`,
      { headers: { Accept: "application/json" } },
    );
    const catalogBody = await catalog.json().catch(() => ({}));
    candidateIds = (catalogBody.cards || []).map((card) => card.id);
  }
  return {
    ...entry,
    images: undefined,
    analysis: body.analysis,
    candidateIds,
    latencyMs: body.metrics?.latencyMs || Date.now() - startedAt,
    inputTokens: body.metrics?.inputTokens ?? null,
    outputTokens: body.metrics?.outputTokens ?? null,
    estimatedCostUsd: null,
    model: body.model,
  };
}

const evaluatedCases = live
  ? await cases.reduce(async (pending, entry) => {
      const completed = await pending;
      completed.push(await runCase(entry));
      return completed;
    }, Promise.resolve([]))
  : cases;
const evaluation = evaluateVisionBenchmark(evaluatedCases, manifest.thresholds);
const report = {
  evaluatedAt: new Date().toISOString(),
  source: live ? baseUrl : "recorded-results",
  evaluation,
  cases: evaluatedCases,
};

await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, {
  mode: 0o600,
});
process.stdout.write(
  `Vision benchmark: ${evaluation.status} (${evaluation.metrics.cases} cases). Private report: ${resolve(outputPath)}\n`,
);
if (evaluation.status !== "pass") process.exitCode = 2;
