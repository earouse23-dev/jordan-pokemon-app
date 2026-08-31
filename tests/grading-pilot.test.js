import test from "node:test";
import assert from "node:assert/strict";
import gradingPilotHandler, {
  gradingDeletionCronHandler,
  gradingReviewerRole,
  normalizeAnnotationLabels,
} from "../lib/grading-pilot-api.js";

function responseDouble() {
  let body;
  return {
    response: {
      setHeader() {},
      status(status) {
        this.statusCode = status;
        return this;
      },
      json(value) {
        body = value;
        return value;
      },
    },
    body: () => body,
  };
}

test("pilot reviewer authority comes only from protected app metadata", () => {
  assert.equal(
    gradingReviewerRole({ app_metadata: { grading_review_role: "Reviewer" } }),
    "reviewer",
  );
  assert.equal(
    gradingReviewerRole({ user_metadata: { grading_review_role: "admin" } }),
    "",
  );
  assert.equal(
    gradingReviewerRole({ app_metadata: { grading_review_role: "owner" } }),
    "",
  );
});

test("condition annotations require the frozen evidence and defect contract", () => {
  const input = {
    identityConfirmed: true,
    finish: "rainbow_hyper_rare",
    evidence: {
      front: true,
      back: true,
      alternateFront: true,
      alternateBack: true,
      centering: true,
      corners: true,
      edges: true,
      surface: true,
      structure: true,
      sufficient: true,
    },
    condition: {
      centering: 9.5,
      corners: 9,
      edges: 8.5,
      surface: 8,
      structure: 9,
      eyeAppeal: 8.5,
    },
    noGradeSignals: [],
    defects: [
      {
        side: "back",
        category: "corner_whitening",
        severity: "minor",
        confidence: 0.9,
        persistentAcrossLight: true,
        region: { x: 0.8, y: 0.82, width: 0.1, height: 0.1 },
      },
    ],
    notes: "Small lower-right corner touch.",
  };
  const labels = normalizeAnnotationLabels(input);
  assert.equal(labels.protocolVersion, "mica-psa-label-protocol-v1");
  assert.equal(labels.condition.structure, 9);
  assert.equal(labels.defects[0].mask.length, 4);
  assert.equal(labels.defects[0].mask[2].x, 0.9);
  assert.equal(labels.notes, input.notes);
  assert.equal(
    normalizeAnnotationLabels({
      ...input,
      condition: { ...input.condition, centering: 9.3 },
    }),
    null,
  );
  assert.equal(
    normalizeAnnotationLabels({
      ...input,
      defects: [
        {
          ...input.defects[0],
          region: { x: 0.95, y: 0.82, width: 0.1, height: 0.1 },
        },
      ],
    }),
    null,
  );
});

test("pilot endpoint rejects unsupported and unauthenticated requests early", async () => {
  const unsupported = responseDouble();
  await gradingPilotHandler(
    { method: "DELETE", headers: {} },
    unsupported.response,
  );
  assert.equal(unsupported.response.statusCode, 405);

  const original = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
  });
  const unauthenticated = responseDouble();
  try {
    await gradingPilotHandler(
      { method: "GET", headers: {}, query: {} },
      unauthenticated.response,
    );
    assert.equal(unauthenticated.response.statusCode, 401);
    assert.equal(unauthenticated.body().error, "Authentication required");
  } finally {
    process.env = original;
  }
});

test("deletion cron fails closed without the Vercel cron credential", async () => {
  const original = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "server-secret",
    CRON_SECRET: "cron-secret-value",
  });
  const result = responseDouble();
  try {
    await gradingDeletionCronHandler(
      { method: "GET", headers: {} },
      result.response,
    );
    assert.equal(result.response.statusCode, 401);
    assert.equal(result.body().error, "Unauthorized");
  } finally {
    process.env = original;
  }
});
