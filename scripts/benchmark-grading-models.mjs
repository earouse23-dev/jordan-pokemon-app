import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { generateText, gateway, jsonSchema, Output } from "ai";

const manifestPath = process.argv[2];
const confirmed = process.argv.includes("--confirm-cost");
const outputFlag = process.argv.indexOf("--output");
const outputPath =
  outputFlag >= 0
    ? process.argv[outputFlag + 1]
    : "grading-model-benchmark.json";
const models = String(
  process.env.MICA_GRADING_BENCHMARK_MODELS ||
    "openai/gpt-5.4,anthropic/claude-sonnet-5",
)
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

if (!manifestPath) {
  console.error(
    "Usage: npm run benchmark:grading-models -- <private-manifest.json> --confirm-cost [--output private-report.json]",
  );
  process.exit(1);
}
if (
  models.length < 2 ||
  new Set(models.map((model) => model.split("/")[0])).size < 2
) {
  throw new Error(
    "MICA_GRADING_BENCHMARK_MODELS must contain at least two provider families.",
  );
}
if (!confirmed) {
  console.error(
    `This benchmark will send private card images to ${models.length} models and incur Gateway usage. Re-run with --confirm-cost after reviewing the manifest.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8"));
const cases = Array.isArray(manifest) ? manifest : manifest.cases;
if (!Array.isArray(cases) || !cases.length)
  throw new Error("The private benchmark manifest has no cases.");

function mediaType(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  throw new Error(`Unsupported benchmark image: ${path}`);
}

const benchmarkSchema = jsonSchema({
  type: "object",
  additionalProperties: false,
  required: ["gradable", "conditionLow", "conditionHigh", "findings"],
  properties: {
    gradable: { type: "boolean" },
    conditionLow: { anyOf: [{ type: "number" }, { type: "null" }] },
    conditionHigh: { anyOf: [{ type: "number" }, { type: "null" }] },
    findings: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["side", "category", "description"],
        properties: {
          side: { type: "string", enum: ["front", "back"] },
          category: {
            type: "string",
            enum: ["centering", "corners", "edges", "surface"],
          },
          description: { type: "string", maxLength: 240 },
        },
      },
    },
  },
});

async function benchmarkCase(entry, model) {
  const frontPath = resolve(entry.front);
  const backPath = resolve(entry.back);
  const [front, back] = await Promise.all([
    readFile(frontPath),
    readFile(backPath),
  ]);
  const startedAt = Date.now();
  const result = await generateText({
    model: gateway(model),
    output: Output.object({ schema: benchmarkSchema }),
    messages: [
      {
        role: "system",
        content:
          "Compare only visible condition evidence. Do not authenticate the card and do not infer hidden damage. Refuse a condition range when glare, blur, perspective, sleeves, or missing evidence make it unreliable.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "The first image is the front and the second is the back. Return a conservative 1–10 condition range and concise visible findings.",
          },
          { type: "file", mediaType: mediaType(frontPath), data: front },
          { type: "file", mediaType: mediaType(backPath), data: back },
        ],
      },
    ],
  });
  return {
    caseId: entry.id,
    cohort: entry.cohort || null,
    expectedPsaGrade: entry.expectedPsaGrade ?? null,
    model,
    latencyMs: Date.now() - startedAt,
    usage: result.usage,
    output: result.output,
  };
}

const results = [];
for (const entry of cases) {
  if (!entry?.id || !entry.front || !entry.back)
    throw new Error("Every case requires id, front, and back.");
  for (const model of models) results.push(await benchmarkCase(entry, model));
}

const summary = models.map((model) => {
  const rows = results.filter((row) => row.model === model);
  const labeled = rows.filter(
    (row) =>
      row.expectedPsaGrade != null &&
      row.output?.conditionLow != null &&
      row.output?.conditionHigh != null,
  );
  const absoluteErrors = labeled.map((row) => {
    const midpoint =
      (Number(row.output.conditionLow) + Number(row.output.conditionHigh)) / 2;
    return Math.abs(midpoint - Number(row.expectedPsaGrade));
  });
  return {
    model,
    cases: rows.length,
    completed: rows.filter((row) => row.output?.gradable).length,
    meanAbsoluteError:
      absoluteErrors.length > 0
        ? absoluteErrors.reduce((sum, value) => sum + value, 0) /
          absoluteErrors.length
        : null,
    averageLatencyMs:
      rows.reduce((sum, row) => sum + row.latencyMs, 0) / rows.length,
  };
});

await writeFile(
  resolve(outputPath),
  `${JSON.stringify(
    {
      evaluatedAt: new Date().toISOString(),
      privateEvaluation: true,
      warning:
        "This model comparison is not a validated grading-accuracy report and must not be used in marketing.",
      models,
      summary,
      results,
    },
    null,
    2,
  )}\n`,
  { mode: 0o600 },
);
process.stdout.write(
  `Private model benchmark completed: ${resolve(outputPath)}\n`,
);
