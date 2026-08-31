import test from "node:test";
import assert from "node:assert/strict";
import visionHandler, {
  visionHandler as visionHandlerWithDependencies,
} from "../api/vision.js";
import {
  buildGatewayVisionRequest,
  combineIndependentGradeAnalyses,
  extractGatewayOutput,
  normalizeVisionOutput,
  parseVisionRequest,
  requireHighGradeVerification,
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
        mode: "identify",
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
    /conservative visible-condition range, never a guaranteed or official grade/i,
  );
});

test("v3 sends an exact catalog image as a non-grade-10 design reference", () => {
  const request = buildGatewayVisionRequest({
    mode: "grade",
    images: [tinyJpeg, tinyJpeg],
    gradingReference: {
      catalogCardId: "tcgdex:en:sv3-198",
      provider: "tcgplayer",
      name: "Charizard ex",
      set: "Obsidian Flames",
      number: "198/197",
      variants: ["Holofoil"],
      url: "https://assets.tcgdex.net/en/sv/sv03/198/high.png",
    },
    model: "openai/gpt-5-mini",
    safetyIdentifier: "owner-hash",
  });
  const content = request.input.find(
    (message) => message.role === "user",
  ).content;
  const labels = content
    .filter((part) => part.type === "input_text")
    .map((part) => part.text)
    .join(" ");
  assert.equal(content.filter((part) => part.type === "input_image").length, 3);
  assert.match(labels, /PRINTING DESIGN REFERENCE/);
  assert.match(labels, /not assumed to be a professional-grade 10/);
  assert.match(request.input[0].content[0].text, /raw corresponding RGB\/hex/);
});

test("precision grading accepts bounded typed supplemental evidence", () => {
  const parsed = parseVisionRequest({
    mode: "grade",
    images: [tinyJpeg, tinyJpeg, tinyJpeg],
    captureDescriptors: [
      { type: "front", side: "front" },
      { type: "back", side: "back" },
      {
        type: "angled_surface",
        side: "front",
        reason: "Resolve a possible print line.",
      },
    ],
  });
  assert.equal(parsed.images.length, 3);
  assert.equal(parsed.captureDescriptors[2].type, "angled_surface");
  const request = buildGatewayVisionRequest({
    ...parsed,
    model: "openai/gpt-5-mini",
    safetyIdentifier: "owner-hash",
  });
  const labels = request.input[1].content
    .filter((part) => part.type === "input_text")
    .map((part) => part.text)
    .join(" ");
  assert.match(labels, /angled-light surface evidence/i);
  assert.match(labels, /possible print line/i);
  assert.throws(
    () =>
      parseVisionRequest({
        mode: "grade",
        images: [tinyJpeg, tinyJpeg, tinyJpeg],
        captureDescriptors: [
          { type: "front", side: "front" },
          { type: "back", side: "back" },
          { type: "untrusted_capture", side: "front" },
        ],
      }),
    /invalid_capture_descriptors/,
  );
  assert.throws(
    () =>
      parseVisionRequest({
        mode: "grade",
        images: Array(6).fill(tinyJpeg),
      }),
    /invalid_image_count/,
  );
});

test("precision grading keeps only cross-model defects and widens disagreement", () => {
  const base = {
    quality: { usable: true, confidence: 0.9, issues: [] },
    identity: { name: "Mew ex", confidence: 0.9 },
    searchQuery: "Mew ex 151/165",
  };
  const condition = {
    rawCondition: "near_mint",
    estimatedGradeLow: 8,
    estimatedGradeHigh: 9,
    confidence: 0.85,
    centering: {},
    blockers: [],
    captureRequests: [],
    subscores: ["centering", "corners", "edges", "surface"].map((category) => ({
      category,
      scoreLow: 8,
      scoreHigh: 9,
      frontScoreLow: 8,
      frontScoreHigh: 9,
      backScoreLow: 8,
      backScoreHigh: 9,
      confidence: 0.82,
      summary: "Visible evidence.",
    })),
    defects: [
      {
        side: "back",
        category: "corners",
        area: "top left",
        severity: "minor",
        evidence: "Small white point.",
        confidence: 0.8,
        region: { x: 0, y: 0, width: 0.15, height: 0.15 },
      },
    ],
  };
  const combined = combineIndependentGradeAnalyses([
    { ...base, model: "openai/model-a", condition },
    {
      ...base,
      model: "anthropic/model-b",
      condition: {
        ...condition,
        estimatedGradeLow: 8.5,
        estimatedGradeHigh: 9.5,
        defects: [
          {
            ...condition.defects[0],
            region: { x: 0.02, y: 0.01, width: 0.14, height: 0.14 },
          },
          {
            side: "front",
            category: "surface",
            area: "center",
            severity: "minor",
            evidence: "Possible line.",
            confidence: 0.6,
            region: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
          },
        ],
      },
    },
  ]);
  assert.equal(combined.consensus.independentReviews, 2);
  assert.equal(combined.consensus.agreedDefects, 1);
  assert.equal(combined.consensus.unconfirmedDefects, 1);
  assert.equal(combined.condition.defects.length, 1);
  assert.equal(combined.condition.estimatedGradeLow, 8);
  assert.equal(combined.condition.estimatedGradeHigh, 9.5);
  assert.match(combined.modelBundle.visionModel, /openai.*anthropic/);
});

test("three-review grading uses majority evidence and excludes one grade outlier", () => {
  const base = {
    quality: { usable: true, confidence: 0.9, issues: [] },
    identity: { name: "Mew ex", confidence: 0.9 },
    searchQuery: "Mew ex 151/165",
  };
  const makeCondition = (low, high, defects) => ({
    rawCondition: "near_mint",
    estimatedGradeLow: low,
    estimatedGradeHigh: high,
    confidence: 0.86,
    centering: {},
    blockers: [],
    captureRequests: [],
    subscores: ["centering", "corners", "edges", "surface"].map((category) => ({
      category,
      scoreLow: low,
      scoreHigh: high,
      frontScoreLow: low,
      frontScoreHigh: high,
      backScoreLow: low,
      backScoreHigh: high,
      confidence: 0.84,
      summary: "Visible evidence.",
    })),
    defects,
  });
  const corner = {
    side: "back",
    category: "corners",
    area: "top left",
    severity: "minor",
    evidence: "Small white point.",
    confidence: 0.82,
    region: { x: 0, y: 0, width: 0.15, height: 0.15 },
  };
  const combined = combineIndependentGradeAnalyses([
    {
      ...base,
      model: "openai/model-a",
      condition: makeCondition(8, 9, [corner]),
    },
    {
      ...base,
      model: "anthropic/model-b",
      condition: makeCondition(8.5, 9.5, [
        {
          ...corner,
          region: { x: 0.02, y: 0.01, width: 0.14, height: 0.14 },
        },
      ]),
    },
    {
      ...base,
      model: "google/model-c",
      condition: makeCondition(3, 4, [
        {
          side: "front",
          category: "surface",
          area: "center",
          severity: "minor",
          evidence: "Possible line.",
          confidence: 0.65,
          region: { x: 0.3, y: 0.3, width: 0.2, height: 0.2 },
        },
      ]),
    },
  ]);
  assert.equal(combined.consensus.independentReviews, 3);
  assert.equal(combined.consensus.outlierReviews, 1);
  assert.equal(combined.consensus.evidenceThreshold, 2);
  assert.equal(combined.consensus.agreedDefects, 1);
  assert.equal(combined.consensus.unconfirmedDefects, 1);
  assert.equal(combined.condition.estimatedGradeLow, 8);
  assert.equal(combined.condition.estimatedGradeHigh, 9.5);
  assert.ok(combined.consensus.gradeDisagreement <= 1);
  assert.ok(combined.consensus.overallGradeDisagreement >= 5);
  assert.match(combined.condition.summary, /excluded as an outlier/i);
  assert.ok(
    combined.condition.captureRequests.some(
      (request) => request.type === "alternate_front",
    ),
  );
});

test("three-review grading does not manufacture a majority from a tied grade chain", () => {
  const makeAnalysis = (model, low, high) => ({
    model,
    quality: { usable: true, confidence: 0.9, issues: [] },
    identity: { name: "Mew ex", confidence: 0.9 },
    searchQuery: "Mew ex 151/165",
    condition: {
      rawCondition: "near_mint",
      estimatedGradeLow: low,
      estimatedGradeHigh: high,
      confidence: 0.85,
      centering: {},
      defects: [],
      blockers: [],
      captureRequests: [],
      subscores: ["centering", "corners", "edges", "surface"].map(
        (category) => ({
          category,
          scoreLow: low,
          scoreHigh: high,
          frontScoreLow: low,
          frontScoreHigh: high,
          backScoreLow: low,
          backScoreHigh: high,
          confidence: 0.8,
          summary: "Visible evidence.",
        }),
      ),
    },
  });
  const combined = combineIndependentGradeAnalyses([
    makeAnalysis("openai/model-a", 4.5, 5.5),
    makeAnalysis("anthropic/model-b", 5.5, 6.5),
    makeAnalysis("google/model-c", 6.5, 7.5),
  ]);
  assert.equal(combined.consensus.outlierReviews, 0);
  assert.equal(combined.condition.estimatedGradeLow, 4.5);
  assert.equal(combined.condition.estimatedGradeHigh, 7.5);
  assert.ok(
    combined.condition.blockers.some((blocker) =>
      blocker.includes("differ by more than one grade"),
    ),
  );
  assert.equal(combined.psaPrediction.status, "abstained");
});

test("a possible high grade requires alternate-light full-card evidence from both sides", () => {
  const analysis = {
    quality: { usable: true, confidence: 0.9, issues: [] },
    condition: {
      estimatedGradeLow: 9,
      estimatedGradeHigh: 10,
      confidence: 0.9,
      blockers: [],
      captureRequests: [],
      defects: [],
      subscores: ["centering", "corners", "edges", "surface"].map(
        (category) => ({
          category,
          scoreLow: 9,
          scoreHigh: 10,
          confidence: 0.9,
        }),
      ),
    },
    psaPrediction: {
      status: "estimate",
      mostLikelyGrade: 9,
      confidence: 0.9,
    },
  };
  const waiting = requireHighGradeVerification(analysis, [
    { type: "front", side: "front" },
    { type: "back", side: "back" },
  ]);
  assert.equal(waiting.psaPrediction.status, "abstained");
  assert.equal(waiting.precisionGate.highGradeVerification, "required");
  assert.deepEqual(waiting.precisionGate.missingSides, ["front", "back"]);
  assert.deepEqual(
    waiting.condition.captureRequests.map((request) => request.type),
    ["alternate_front", "alternate_back"],
  );
  assert.ok(
    waiting.condition.blockers.some((blocker) =>
      blocker.includes("alternate-light"),
    ),
  );

  const passed = requireHighGradeVerification(analysis, [
    { type: "front", side: "front" },
    { type: "back", side: "back" },
    { type: "alternate_front", side: "front" },
    { type: "alternate_back", side: "back" },
  ]);
  assert.equal(passed.psaPrediction.status, "estimate");
  assert.equal(passed.precisionGate.highGradeVerification, "passed");
  assert.equal(passed.consensus.highGradeVerification, "passed");
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

test("normalization cannot invent same-side corroboration from front and back alone", () => {
  const result = normalizeVisionOutput(
    "grade",
    {
      quality: { usable: true, confidence: 0.9, issues: [] },
      identity: { name: "Vaporeon", confidence: 0.8 },
      condition: {
        rawCondition: "near_mint",
        estimatedGradeLow: 8,
        estimatedGradeHigh: 9,
        confidence: 0.8,
        subscores: [],
        defects: [
          {
            side: "front",
            area: "artwork",
            category: "holo_scratch",
            severity: "minor",
            evidence: "A reflective line appears in the artwork.",
            confidence: 0.9,
            region: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
            visualCause: "physical_damage",
            confirmedAcrossViews: true,
          },
        ],
        blockers: [],
      },
    },
    [],
    [
      { type: "front", side: "front" },
      { type: "back", side: "back" },
    ],
  );
  assert.equal(result.condition.defects.length, 0);

  const corroborated = normalizeVisionOutput(
    "grade",
    {
      quality: { usable: true, confidence: 0.9, issues: [] },
      identity: { name: "Vaporeon", confidence: 0.8 },
      condition: {
        rawCondition: "near_mint",
        estimatedGradeLow: 8,
        estimatedGradeHigh: 9,
        confidence: 0.8,
        subscores: [],
        defects: [
          {
            side: "front",
            area: "artwork",
            category: "holo_scratch",
            severity: "minor",
            evidence: "A reflective line persists in the same coordinates.",
            confidence: 0.9,
            region: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
            visualCause: "physical_damage",
            confirmedAcrossViews: true,
          },
        ],
        blockers: [],
      },
    },
    [],
    [
      { type: "front", side: "front" },
      { type: "back", side: "back" },
      { type: "angled_surface", side: "front" },
    ],
  );
  assert.equal(corroborated.condition.defects.length, 1);
  assert.equal(corroborated.condition.defects[0].sameSideViewCount, 2);
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

test("vision endpoint rejects oversized multi-view bodies before authentication", async () => {
  const response = responseRecorder();
  await visionHandler(
    {
      method: "POST",
      headers: { "content-length": "12000001" },
      body: {},
    },
    response,
  );
  assert.equal(response.result.statusCode, 413);
  assert.equal(response.result.body.code, "vision_request_too_large");
});

test("reused AI usage claims never invoke Gateway without a saved grade response", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secret: process.env.SUPABASE_SECRET_KEY,
    gateway: process.env.AI_GATEWAY_API_KEY,
    fetch: globalThis.fetch,
  };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-test-key",
    SUPABASE_SECRET_KEY: "server-test-key",
    AI_GATEWAY_API_KEY: "gateway-test-key",
  });
  let gatewayCalls = 0;
  globalThis.fetch = async () => {
    gatewayCalls += 1;
    throw new Error("Gateway must not be called for a reused claim");
  };

  const cases = [
    {
      name: "identify",
      body: {
        mode: "identify",
        images: [tinyJpeg],
        requestId: "reused-identify-request",
      },
    },
    {
      name: "match",
      body: {
        mode: "match",
        images: [tinyJpeg],
        requestId: "reused-match-request",
        candidates: [
          {
            id: "one",
            image: "https://images.pokemontcg.io/base1/1.png",
          },
          {
            id: "two",
            image: "https://images.pokemontcg.io/base1/2.png",
          },
        ],
      },
    },
    {
      name: "advisor",
      headers: { "idempotency-key": "reused-advisor-request" },
      body: {
        mode: "advisor",
        experienceLevel: "beginner",
        workspace: "guided",
        signals: [{ key: "pricing", itemCount: 1 }],
        portfolio: { positionCount: 1, watchlistCount: 0 },
      },
    },
    {
      name: "unresolved grade",
      body: {
        mode: "grade",
        images: [tinyJpeg, tinyJpeg],
        requestId: "reused-grade-request",
        scanSessionId: "11111111-1111-4111-8111-111111111111",
      },
    },
  ];

  try {
    for (const entry of cases) {
      let clientCount = 0;
      const createClient = () => {
        clientCount += 1;
        if (clientCount === 1)
          return {
            auth: {
              getUser: async () => ({
                data: { user: { id: "22222222-2222-4222-8222-222222222222" } },
                error: null,
              }),
            },
          };
        return {
          rpc: async () => ({
            data: { allowed: true, reused: true, retryAfter: 0 },
            error: null,
          }),
          from: () => ({
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        };
      };
      const response = responseRecorder();
      await visionHandlerWithDependencies(
        {
          method: "POST",
          headers: {
            authorization: "Bearer valid-test-token",
            ...(entry.headers || {}),
          },
          body: entry.body,
        },
        response,
        { createClient },
      );
      assert.equal(response.result.statusCode, 409, entry.name);
      assert.equal(
        response.result.body.code,
        "vision_request_reused",
        entry.name,
      );
      assert.equal(response.result.headers["Cache-Control"], "no-store");
    }
    assert.equal(gatewayCalls, 0);
  } finally {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previous.key;
    if (previous.secret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previous.secret;
    if (previous.gateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previous.gateway;
    globalThis.fetch = previous.fetch;
  }
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
        repeatGroup: "same-card",
        cardType: "modern",
        photoQuality: "good",
        latencyMs: 6000,
        estimatedCostUsd: 0.004,
        corrected: false,
        analysis: {
          quality: { usable: true },
          condition: {
            estimatedGradeLow: 7,
            estimatedGradeHigh: 9,
            confidence: 0.8,
          },
        },
      },
      {
        mode: "grade",
        expectedGrade: 8,
        repeatGroup: "same-card",
        cardType: "modern",
        photoQuality: "good",
        latencyMs: 5000,
        corrected: false,
        analysis: {
          quality: { usable: true },
          condition: {
            estimatedGradeLow: 8,
            estimatedGradeHigh: 8,
            confidence: 0.9,
          },
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
    {
      minimumIdentifyCases: 1,
      minimumGradeCases: 1,
      minimumRepeatGroups: 1,
    },
  );
  assert.equal(evaluation.metrics.topOneAccuracy, 1);
  assert.equal(evaluation.metrics.topThreeAccuracy, 1);
  assert.equal(evaluation.metrics.gradeRangeCoverage, 1);
  assert.equal(evaluation.metrics.exactGradeAgreement, 1);
  assert.equal(evaluation.metrics.withinOneGradeAgreement, 1);
  assert.equal(evaluation.metrics.falseGemMintRate, 0);
  assert.equal(evaluation.metrics.abstentionRate, 0);
  assert.equal(evaluation.metrics.repeatScanConsistency, 1);
  assert.equal(evaluation.metrics.byCardType.modern.cases, 2);
  assert.equal(evaluation.metrics.byPhotoQuality.good.cases, 2);
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

test("PSA holdout evaluation measures exact half-grade labels and rejects card leakage", () => {
  const cases = Array.from({ length: 60 }, (_, index) => ({
    mode: "grade",
    physicalCardId: `physical-${index}`,
    sourceHash: `hash-${index}`,
    datasetPartition: "external_holdout",
    cohortKey: "pokemon-modern-textured-en-supported-phone",
    supportedCohort: true,
    capturedBeforeOutcome: true,
    expectedReturnedLabel: "8.5",
    expectedGrade: 8.5,
    scanCompleted: true,
    analysis: {
      quality: { usable: true },
      condition: {
        estimatedGradeLow: 8,
        estimatedGradeHigh: 9,
        confidence: 0.9,
      },
      psaPrediction: {
        status: "validated",
        mostLikelyGrade: 8.5,
        probabilities: [
          { grade: 8.5, probability: 0.98 },
          { grade: 8, probability: 0.02 },
        ],
      },
    },
  }));
  const evaluation = evaluateVisionBenchmark(cases, {
    minimumIdentifyCases: 0,
    minimumGradeCases: 1,
    minimumRepeatGroups: 0,
    requirePsaValidation: true,
    minimumPsaOutcomeCases: 50,
    minimumSupportedCohortCases: 50,
  });
  assert.equal(evaluation.metrics.exactPsaLabelAgreement, 1);
  assert.ok(evaluation.metrics.exactPsaLabelWilson95.low > 0.9);
  assert.ok(evaluation.metrics.expectedCalibrationError < 0.03);
  assert.ok(evaluation.metrics.psaBrierScore < 0.001);
  assert.equal(evaluation.metrics.psaAccuracyCoverageCurve.length, 10);
  assert.equal(evaluation.metrics.psaConfusionMatrix["8.5"]["8.5"], 60);
  assert.equal(evaluation.checks.psaValidation, true);
  assert.equal(evaluation.checks.physicalCardIsolation, true);
  assert.equal(evaluation.checks.captureIsolation, true);
  assert.equal(evaluation.checks.temporalIsolation, true);
  assert.equal(evaluation.checks.supportedCohortMinimums, true);

  const leaked = evaluateVisionBenchmark(
    [cases[0], { ...cases[0], datasetPartition: "train" }],
    {
      minimumIdentifyCases: 0,
      minimumGradeCases: 1,
      minimumRepeatGroups: 0,
    },
  );
  assert.equal(leaked.checks.physicalCardIsolation, false);
  assert.equal(leaked.status, "not_ready");

  const temporalLeak = evaluateVisionBenchmark(
    [
      cases[0],
      {
        ...cases[1],
        sourceHash: cases[0].sourceHash,
        datasetPartition: "train",
        capturedBeforeOutcome: false,
      },
    ],
    {
      minimumIdentifyCases: 0,
      minimumGradeCases: 1,
      minimumRepeatGroups: 0,
      minimumSupportedCohortCases: 0,
    },
  );
  assert.equal(temporalLeak.checks.captureIsolation, false);
  assert.equal(temporalLeak.checks.temporalIsolation, false);
});
