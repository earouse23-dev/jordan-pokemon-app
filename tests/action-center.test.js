import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTION_RULE_VERSION,
  deliveryRetry,
  evaluateActionRules,
  normalizeActionThresholds,
  normalizeNotificationPreferences,
  notificationQuietAt,
  planActionDeliveries,
  stableActionFingerprint,
  transitionActionStatus,
} from "../lib/action-center.js";

const now = "2026-09-03T15:00:00.000Z";

test("action fingerprints are stable across object key order", () => {
  assert.equal(
    stableActionFingerprint({ kind: "watch", id: "one" }),
    stableActionFingerprint({ id: "one", kind: "watch" }),
  );
});

test("notification and rule preferences are bounded and safe by default", () => {
  assert.deepEqual(normalizeActionThresholds({ staleAfterHours: -1 }), {
    priceMovePercent: 10,
    comparableMovePercent: 10,
    staleAfterHours: 72,
    inventoryAgingDays: 180,
    listingStaleDays: 30,
    gradingMinimumConfidence: 0.8,
  });
  assert.deepEqual(
    normalizeNotificationPreferences({
      channels: { email: true },
      timeZone: "not/a-zone",
      mutedKinds: ["watch_target", "made_up", "watch_target"],
      dailyCap: 1000,
    }),
    {
      enabled: true,
      channels: { inApp: true, email: true, webPush: false },
      quietHours: { enabled: true, start: "21:00", end: "08:00" },
      timeZone: "UTC",
      dailyCap: 5,
      cooldownHours: 24,
      mutedKinds: ["watch_target"],
    },
  );
});

test("a fresh exact watch price creates one evidenced target action", () => {
  const actions = evaluateActionRules({
    now,
    watchlist: [
      {
        watchlistId: "watch-1",
        name: "Pikachu",
        currentPrice: 90,
        targetPrice: 100,
        currency: "USD",
        pricingStatus: "live",
        pricingUpdatedAt: "2026-09-03T14:00:00Z",
        referenceProvider: "PkmnPrices",
      },
    ],
  });
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "watch_target");
  assert.equal(actions[0].ruleVersion, ACTION_RULE_VERSION);
  assert.equal(actions[0].evidence.currentPrice, 90);
  assert.equal(actions[0].destination.route, "watchlist");
});

test("provider failures never create false buy or movement actions", () => {
  const actions = evaluateActionRules({
    now,
    watchlist: [
      {
        watchlistId: "watch-1",
        currentPrice: 1,
        targetPrice: 100,
        pricingStatus: "error",
        pricingUpdatedAt: "2026-09-03T14:00:00Z",
      },
    ],
    positions: [
      {
        uid: "position-1",
        priceMovement: {
          percent: 50,
          status: "error",
          observedAt: "2026-09-03T14:00:00Z",
        },
      },
    ],
  });
  assert.equal(
    actions.some((item) => item.kind === "watch_target"),
    false,
  );
  assert.equal(
    actions.some((item) => item.kind === "price_change"),
    false,
  );
  assert.equal(actions.length, 1);
  assert.equal(actions[0].kind, "coverage_loss");
  assert.equal(actions[0].evidence.alertSuppressed, "watch_target");
});

test("stale prices are disclosed and cannot cross a target", () => {
  const [result] = evaluateActionRules({
    now,
    thresholds: { staleAfterHours: 24 },
    watchlist: [
      {
        watchlistId: "watch-2",
        currentPrice: 20,
        targetPrice: 25,
        pricingStatus: "stale",
        pricingUpdatedAt: "2026-08-20T00:00:00Z",
      },
    ],
  });
  assert.equal(result.kind, "stale_data");
  assert.equal(result.evidence.alertSuppressed, "watch_target");
});

test("price and comparable rules require fresh live threshold evidence", () => {
  const actions = evaluateActionRules({
    now,
    thresholds: { priceMovePercent: 10, comparableMovePercent: 15 },
    positions: [
      {
        uid: "position-1",
        name: "Mew",
        priceMovement: {
          percent: -12,
          status: "live",
          observedAt: "2026-09-03T14:00:00Z",
          source: "PkmnPrices",
        },
        comparableMovement: {
          percent: 14,
          status: "live",
          observedAt: "2026-09-03T14:00:00Z",
          source: "PkmnPrices Pro contract",
        },
      },
    ],
  });
  assert.deepEqual(
    actions.map((item) => item.kind),
    ["price_change"],
  );
});

test("unsupported goal metadata and incomplete grading evidence stay silent", () => {
  const actions = evaluateActionRules({
    now,
    goals: [
      {
        id: "goal-1",
        metadataStatus: "unsupported",
        lastProgress: { complete: true },
      },
    ],
    positions: [
      {
        uid: "position-1",
        gradingOpportunity: {
          eligible: true,
          evidenceComplete: false,
          confidence: 0.99,
        },
      },
    ],
  });
  assert.deepEqual(actions, []);
});

test("goal, grading, listing, and inventory rules link to exact destinations", () => {
  const actions = evaluateActionRules({
    now,
    goals: [
      {
        id: "goal-1",
        name: "Complete 151",
        metadataStatus: "verified",
        catalogSource: "TCGdex",
        catalogVersion: "v1",
        lastProgress: { complete: true, current: 165, target: 165 },
        completedAt: "2026-09-03T14:00:00Z",
      },
    ],
    positions: [
      {
        uid: "position-1",
        name: "Charizard",
        status: "owned",
        purchaseDate: "2025-01-01",
        gradingOpportunity: {
          eligible: true,
          evidenceComplete: true,
          confidence: 0.9,
          assessmentId: "assessment-1",
        },
      },
    ],
    gradingSubmissions: [
      {
        id: "submission-1",
        status: "shipped",
        previousStatus: "prepared",
      },
    ],
    listings: [
      {
        id: "listing-1",
        name: "Mew listing",
        reviewReasons: ["asking price missing"],
        updatedAt: "2026-09-01T00:00:00Z",
      },
    ],
  });
  assert.deepEqual(
    new Set(actions.map((item) => item.kind)),
    new Set([
      "collection_goal",
      "grading_opportunity",
      "grading_status",
      "listing_review",
      "inventory_aging",
    ]),
  );
  assert.ok(actions.every((item) => item.destination.route));
});

test("quiet hours wrap midnight in the saved timezone", () => {
  const preferences = {
    timeZone: "UTC",
    quietHours: { enabled: true, start: "21:00", end: "08:00" },
  };
  assert.equal(
    notificationQuietAt(preferences, new Date("2026-09-03T23:00:00Z")),
    true,
  );
  assert.equal(
    notificationQuietAt(preferences, new Date("2026-09-03T12:00:00Z")),
    false,
  );
});

test("delivery planning deduplicates, cools down, caps, and delays optional channels", () => {
  const action = {
    actionKey: "action-1",
    kind: "watch_target",
  };
  const preferences = {
    channels: { inApp: true, email: true, webPush: true },
    timeZone: "UTC",
    quietHours: { enabled: true, start: "21:00", end: "08:00" },
  };
  const first = planActionDeliveries(
    action,
    preferences,
    [],
    new Date("2026-09-03T23:00:00Z"),
  );
  assert.equal(first.length, 3);
  assert.equal(first.find((item) => item.channel === "in_app").status, "sent");
  assert.equal(
    first.find((item) => item.channel === "email").availableAt,
    "after_quiet_hours",
  );
  assert.deepEqual(
    planActionDeliveries(action, preferences, first, new Date(now)),
    [],
  );
});

test("delivery retry stops permanently and action transitions validate snoozes", () => {
  assert.equal(deliveryRetry({ attempts: 5 }, now).status, "failed");
  assert.equal(deliveryRetry({ attempts: 1 }, now).status, "pending");
  assert.equal(
    transitionActionStatus("open", "complete", { at: now }).status,
    "completed",
  );
  assert.throws(
    () =>
      transitionActionStatus("open", "snooze", {
        at: now,
        snoozedUntil: "2026-09-03T14:00:00Z",
      }),
    /future/,
  );
});
