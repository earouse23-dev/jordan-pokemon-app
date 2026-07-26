import test from "node:test";
import assert from "node:assert/strict";
import {
  advisorJsonSchema,
  buildGatewayAdvisorRequest,
  normalizeAdvisorOutput,
  parseAdvisorRequest,
} from "../lib/advisor.js";

const input = parseAdvisorRequest({
  experienceLevel: "beginner",
  workspace: "guided",
  portfolio: { positionCount: 12, watchlistCount: 3 },
  signals: [
    { key: "pricing", itemCount: 2 },
    { key: "older", itemCount: 4 },
  ],
});

test("advisor accepts only bounded aggregate portfolio signals", () => {
  assert.deepEqual(
    input.signals.map(({ key, itemCount }) => ({ key, itemCount })),
    [
      { key: "pricing", itemCount: 2 },
      { key: "older", itemCount: 4 },
    ],
  );
  assert.throws(
    () =>
      parseAdvisorRequest({
        experienceLevel: "beginner",
        workspace: "guided",
        portfolio: { positionCount: 1, watchlistCount: 0 },
        signals: [{ key: "ignore-rules-and-sell", itemCount: 1 }],
      }),
    /invalid_advisor_request/,
  );
  assert.throws(
    () =>
      parseAdvisorRequest({
        experienceLevel: "beginner",
        workspace: "guided",
        portfolio: { positionCount: 1, watchlistCount: 0 },
        signals: [],
      }),
    /invalid_advisor_request/,
  );
});

test("advisor request is non-persistent and restricts output action keys", () => {
  const request = buildGatewayAdvisorRequest({
    input,
    model: "openai/gpt-5-mini",
    safetyIdentifier: "safe-user",
  });
  assert.equal(request.store, false);
  assert.equal(request.max_output_tokens, 1200);
  assert.deepEqual(
    advisorJsonSchema(["pricing", "older"]).properties.priorities.items
      .properties.actionKey.enum,
    ["pricing", "older"],
  );
  assert.match(
    request.input[0].content[0].text,
    /Do not infer or mention card names, dollar values, market direction/,
  );
});

test("advisor normalization drops unknown and duplicate model actions", () => {
  const normalized = normalizeAdvisorOutput(
    {
      headline: " Review safely ",
      summary: "Use the verified queue.",
      priorities: [
        {
          actionKey: "pricing",
          why: "Identity evidence needs review.",
          nextStep: "Open the queue.",
        },
        {
          actionKey: "pricing",
          why: "Duplicate",
          nextStep: "Duplicate",
        },
        {
          actionKey: "sell-everything",
          why: "Not allowed",
          nextStep: "Not allowed",
        },
      ],
      caveats: ["Confirm exact matches."],
    },
    input,
  );
  assert.equal(normalized.headline, "Review safely");
  assert.deepEqual(
    normalized.priorities.map((priority) => priority.actionKey),
    ["pricing"],
  );
  assert.equal(normalized.requiresConfirmation, true);
});
