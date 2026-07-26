import test from "node:test";
import assert from "node:assert/strict";
import visionHandler from "../api/vision.js";
import {
  buildGatewayVisionRequest,
  extractGatewayOutput,
  normalizeVisionOutput,
  parseVisionRequest,
  visionLimits,
} from "../lib/vision.js";
import { evaluateVisionBenchmark } from "../lib/vision-evaluation.js";

const tinyJpeg = `data:image/jpeg;base64,${Buffer.from("image bytes").toString("base64")}`;

function responseRecorder() {
  const result = { statusCode: null, body: null, headers: {} };
  return {
    result,
    setHeader(name, value) {
      result.headers[name] = value;
    },
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
}

test("vision intake accepts only expected modes, image types, sizes, and counts", () => {
  assert.deepEqual(
    parseVisionRequest({ mode: "identify", images: [tinyJpeg] }),
    {
      mode: "identify",
      images: [tinyJpeg],
    },
  );
  assert.throws(
    () => parseVisionRequest({ mode: "unknown", images: [tinyJpeg] }),
    /invalid_mode/,
  );
  assert.throws(
    () => parseVisionRequest({ mode: "grade", images: [tinyJpeg] }),
    /invalid_image_count/,
  );
  assert.throws(
    () =>
      parseVisionRequest({
        mode: "receipt",
        images: ["data:image/svg+xml;base64,AAA="],
      }),
    /invalid_image_type/,
  );
  const oversized = `data:image/png;base64,${"A".repeat(
    Math.ceil((visionLimits.maxImageBytes * 4) / 3) + 8,
  )}`;
  assert.throws(
    () => parseVisionRequest({ mode: "identify", images: [oversized] }),
    /image_too_large/,
  );
});

test("raw grading sends two high-detail images without provider persistence", () => {
  const request = buildGatewayVisionRequest({
    mode: "grade",
    images: [tinyJpeg, tinyJpeg],
    model: "openai/gpt-5-mini",
    safetyIdentifier: "anonymous-hash",
  });
  const userContent = request.input.find(
    (message) => message.role === "user",
  ).content;
  const imageParts = userContent.filter((part) => part.type === "input_image");
  assert.equal(request.store, false);
  assert.equal(request.safety_identifier, "anonymous-hash");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.equal(imageParts.length, 2);
  assert.ok(imageParts.every((part) => part.detail === "high"));
  assert.match(
    request.input[0].content[0].text,
    /conservative grade range, never a guaranteed or official grade/i,
  );
});

test("identity mode requests only printed identity and a bounded output", () => {
  const request = buildGatewayVisionRequest({
    mode: "identify",
    images: [tinyJpeg],
    model: "openai/gpt-5-mini",
    safetyIdentifier: "owner-hash",
  });
  assert.equal(request.max_output_tokens, 1800);
  assert.equal(request.text.format.name, "mica_identity_analysis");
  assert.deepEqual(Object.keys(request.text.format.schema.properties).sort(), [
    "identity",
    "quality",
    "requiresConfirmation",
  ]);
  assert.doesNotMatch(
    JSON.stringify(request.text.format.schema),
    /rawCondition|estimatedGrade|subscores|defects/,
  );
  assert.match(
    request.input[0].content[0].text,
    /preserve both sides such as 76\/73/i,
  );
  assert.match(
    request.input[1].content
      .filter((part) => part.type === "input_text")
      .map((part) => part.text)
      .join(" "),
    /device-prepared evidence sheet/i,
  );
});

test("optional visual comparison is allowlisted, bounded, and may abstain", () => {
  const candidates = [
    {
      id: "tcgdex:en:base1-4",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      rarity: "Rare Holo",
      variant: "holofoil",
      image: "https://assets.tcgdex.net/en/base/base1/4/high.png",
    },
    {
      id: "tcgdex:en:base4-4",
      name: "Charizard",
      set: "Base Set 2",
      number: "4/130",
      rarity: "Rare Holo",
      variant: "holofoil",
      image: "https://images.pokemontcg.io/base4/4_hires.png",
    },
  ];
  const parsed = parseVisionRequest({
    mode: "match",
    images: [tinyJpeg],
    candidates,
  });
  assert.equal(parsed.candidates.length, 2);
  assert.throws(
    () =>
      parseVisionRequest({
        mode: "match",
        images: [tinyJpeg],
        candidates: [
          candidates[0],
          { ...candidates[1], image: "https://example.com/card.png" },
        ],
      }),
    /invalid_candidates/,
  );
  const request = buildGatewayVisionRequest({
    ...parsed,
    model: "openai/gpt-5-mini",
    safetyIdentifier: "owner-hash",
  });
  assert.equal(request.max_output_tokens, 1200);
  assert.equal(request.text.format.name, "mica_candidate_match");
  assert.equal(
    request.input[1].content.filter((part) => part.type === "input_image")
      .length,
    3,
  );
  const abstained = normalizeVisionOutput(
    "match",
    {
      selectedCandidateId: "not-an-allowed-id",
      confidence: 0.9,
      reason: "The number is hidden.",
      distinguishingEvidence: [],
    },
    parsed.candidates,
  );
  assert.equal(abstained.selectedCandidateId, null);
  assert.equal(abstained.requiresConfirmation, true);
});

test("vision output is conservative, bounded, and always requires confirmation", () => {
  const result = normalizeVisionOutput("grade", {
    quality: { usable: true, confidence: 5, issues: [] },
    identity: {
      isPokemonCard: true,
      name: " Charizard ",
      setName: "Base Set",
      collectorNumber: "4/102",
      cardState: "raw",
      grader: "PSA",
      grade: 12,
      certificationNumber: "123",
      confidence: 0.8,
    },
    condition: {
      rawCondition: "near_mint",
      estimatedGradeLow: 9,
      estimatedGradeHigh: 7,
      confidence: 0.6,
      subscores: [],
      defects: [],
      blockers: [],
    },
    searchQuery: "Charizard Base Set 4/102",
    requiresConfirmation: false,
  });
  assert.equal(result.identity.name, "Charizard");
  assert.equal(result.identity.grader, null);
  assert.equal(result.identity.grade, null);
  assert.equal(result.condition.estimatedGradeLow, 7);
  assert.equal(result.condition.estimatedGradeHigh, 9);
  assert.equal(result.quality.confidence, 0);
  assert.equal(result.requiresConfirmation, true);
});

test("identity normalization derives a search without condition analysis", () => {
  const result = normalizeVisionOutput("identify", {
    quality: { usable: true, confidence: 0.9, issues: [] },
    identity: {
      isPokemonCard: true,
      name: "Mew ex",
      setName: "151",
      collectorNumber: "151/165",
      language: "English",
      rarity: "Double Rare",
      printingHints: ["holo"],
      cardState: "raw",
      grader: null,
      grade: null,
      certificationNumber: null,
      confidence: 0.92,
    },
    condition: {
      rawCondition: "near_mint",
      estimatedGradeLow: 10,
    },
  });
  assert.equal(result.searchQuery, "Mew ex 151 151/165");
  assert.equal("condition" in result, false);
  assert.equal(result.requiresConfirmation, true);
});

test("receipt extraction preserves unallocated order value instead of guessing", () => {
  const result = normalizeVisionOutput("receipt", {
    quality: { usable: true, confidence: 0.9, issues: [] },
    vendor: "Card Shop",
    purchaseDate: "2026-07-20",
    currency: "usd",
    totalAmount: 115,
    shippingAmount: 10,
    taxAmount: 5,
    lineItems: [
      {
        description: "Pikachu 025",
        quantity: 1,
        unitAmount: 100,
        lineTotal: 100,
        searchQuery: "Pikachu 025",
        confidence: 0.9,
      },
    ],
    requiresConfirmation: false,
  });
  assert.equal(result.currency, "USD");
  assert.equal(result.knownLineTotal, 100);
  assert.equal(result.unallocatedAmount, 15);
  assert.equal(result.lineItems[0].lineTotal, 100);
  assert.equal(result.requiresConfirmation, true);
});

test("gateway output parser reads only structured assistant output", () => {
  assert.deepEqual(
    extractGatewayOutput({
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: '{"quality":{"usable":true}}' },
          ],
        },
      ],
    }),
    { quality: { usable: true } },
  );
  assert.throws(
    () => extractGatewayOutput({ output: [] }),
    /empty_model_output/,
  );
});

test("vision endpoint rejects unauthenticated requests before any AI call", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  const response = responseRecorder();
  try {
    await visionHandler({ method: "POST", headers: {}, body: {} }, response);
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previous.key;
  }
  assert.equal(response.result.statusCode, 401);
  assert.equal(response.result.body.error, "Authentication required");
  assert.equal(response.result.headers["Cache-Control"], "no-store");
});

test("vision benchmark measures exact matching, conservative grade coverage, and latency", () => {
  const evaluation = evaluateVisionBenchmark(
    [
      {
        mode: "identify",
        expectedCatalogId: "sv3pt5-151",
        candidateIds: ["sv3pt5-151", "other"],
        latencyMs: 4000,
        estimatedCostUsd: 0.002,
        corrected: false,
        analysis: {
          quality: { usable: true },
          identity: { confidence: 0.95 },
        },
      },
      {
        mode: "grade",
        expectedGrade: 8,
        latencyMs: 6000,
        estimatedCostUsd: 0.004,
        corrected: false,
        analysis: {
          quality: { usable: true },
          condition: { estimatedGradeLow: 7, estimatedGradeHigh: 9 },
        },
      },
      {
        mode: "identify",
        expectedAbstain: true,
        latencyMs: 3000,
        corrected: false,
        analysis: {
          quality: { usable: false },
          identity: { confidence: 0.2 },
        },
      },
    ],
    { minimumIdentifyCases: 1, minimumGradeCases: 1 },
  );
  assert.equal(evaluation.metrics.topOneAccuracy, 1);
  assert.equal(evaluation.metrics.topThreeAccuracy, 1);
  assert.equal(evaluation.metrics.gradeRangeCoverage, 1);
  assert.equal(evaluation.metrics.abstentionAccuracy, 1);
  assert.equal(evaluation.metrics.p95LatencyMs, 6000);
  assert.equal(evaluation.metrics.totalEstimatedCostUsd, 0.006);
  assert.equal(evaluation.status, "pass");
});

test("vision benchmark fails closed when sample evidence is missing", () => {
  const evaluation = evaluateVisionBenchmark([]);
  assert.equal(evaluation.status, "not_ready");
  assert.equal(evaluation.checks.identifySample, false);
  assert.equal(evaluation.metrics.topOneAccuracy, null);
});
