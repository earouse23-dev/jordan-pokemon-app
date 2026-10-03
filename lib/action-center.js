const ACTION_DESTINATIONS = new Set([
  "dashboard",
  "collection",
  "watchlist",
  "goals",
  "grading",
  "listings",
  "sales",
  "settings",
]);

const ACTION_KINDS = new Set([
  "watch_target",
  "price_change",
  "comparable_change",
  "coverage_loss",
  "stale_data",
  "collection_goal",
  "grading_opportunity",
  "grading_status",
  "listing_review",
  "inventory_aging",
]);

const OPTIONAL_CHANNELS = new Set(["email", "web_push"]);
const ALL_CHANNELS = new Set(["in_app", ...OPTIONAL_CHANNELS]);

export const ACTION_RULE_VERSION = "mica-actions-v1";
export const DEFAULT_ACTION_THRESHOLDS = Object.freeze({
  priceMovePercent: 10,
  comparableMovePercent: 10,
  staleAfterHours: 72,
  inventoryAgingDays: 180,
  listingStaleDays: 30,
  gradingMinimumConfidence: 0.8,
});
export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  enabled: true,
  channels: Object.freeze({ inApp: true, email: false, webPush: false }),
  quietHours: Object.freeze({ enabled: true, start: "21:00", end: "08:00" }),
  timeZone: "UTC",
  dailyCap: 5,
  cooldownHours: 24,
  mutedKinds: Object.freeze([]),
});

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

function safeText(value, maximum = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, maximum);
}

function validTime(value, fallback) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""))
    ? String(value)
    : fallback;
}

function validTimeZone(value) {
  const candidate = safeText(value, 100) || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "UTC";
  }
}

export function normalizeActionThresholds(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  return {
    priceMovePercent: boundedNumber(input.priceMovePercent, 10, 1, 500),
    comparableMovePercent: boundedNumber(
      input.comparableMovePercent,
      10,
      1,
      500,
    ),
    staleAfterHours: boundedNumber(input.staleAfterHours, 72, 1, 720),
    inventoryAgingDays: boundedNumber(input.inventoryAgingDays, 180, 1, 3650),
    listingStaleDays: boundedNumber(input.listingStaleDays, 30, 1, 365),
    gradingMinimumConfidence: boundedNumber(
      input.gradingMinimumConfidence,
      0.8,
      0.5,
      1,
    ),
  };
}

export function normalizeNotificationPreferences(value = {}) {
  const input = value && typeof value === "object" ? value : {};
  const channelInput =
    input.channels && typeof input.channels === "object" ? input.channels : {};
  const quietInput =
    input.quietHours && typeof input.quietHours === "object"
      ? input.quietHours
      : {};
  const mutedKinds = [
    ...new Set(
      (Array.isArray(input.mutedKinds) ? input.mutedKinds : [])
        .map((kind) => safeText(kind, 50))
        .filter((kind) => ACTION_KINDS.has(kind)),
    ),
  ].sort();
  return {
    enabled: input.enabled !== false,
    channels: {
      inApp: channelInput.inApp !== false,
      email: channelInput.email === true,
      webPush: channelInput.webPush === true,
    },
    quietHours: {
      enabled: quietInput.enabled !== false,
      start: validTime(quietInput.start, "21:00"),
      end: validTime(quietInput.end, "08:00"),
    },
    timeZone: validTimeZone(input.timeZone),
    dailyCap: Math.round(boundedNumber(input.dailyCap, 5, 1, 50)),
    cooldownHours: Math.round(boundedNumber(input.cooldownHours, 24, 1, 720)),
    mutedKinds,
  };
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function stableActionFingerprint(value) {
  const text = JSON.stringify(canonicalValue(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `mica_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function storageKeyPart(value) {
  return safeText(value, 200).replace(/[^A-Za-z0-9_.-]+/g, "_") || "current";
}

export function actionStorageKey(kind, subject, occurrence = "current") {
  return [
    ACTION_RULE_VERSION,
    storageKeyPart(kind),
    storageKeyPart(subject?.type || "account"),
    storageKeyPart(subject?.id || "account"),
    storageKeyPart(occurrence),
  ].join(":");
}

function timestamp(value) {
  const date = new Date(value || "");
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function ageHours(observedAt, now) {
  const observed = new Date(observedAt || "").getTime();
  const current = new Date(now || "").getTime();
  return Number.isFinite(observed) && Number.isFinite(current)
    ? Math.max(0, (current - observed) / 3_600_000)
    : Infinity;
}

function daysBetween(from, to) {
  const start = new Date(from || "").getTime();
  const end = new Date(to || "").getTime();
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.floor((end - start) / 86_400_000))
    : null;
}

function subjectId(value, fallback) {
  return safeText(value || fallback, 200);
}

function destination(value = {}) {
  const route = ACTION_DESTINATIONS.has(value.route)
    ? value.route
    : "dashboard";
  return {
    route,
    view: safeText(value.view, 60) || null,
    id: safeText(value.id, 200) || null,
  };
}

function action(input) {
  const kind = ACTION_KINDS.has(input.kind) ? input.kind : "stale_data";
  const subject = {
    type: safeText(input.subject?.type, 50) || "account",
    id: subjectId(input.subject?.id, "account"),
  };
  const actionKey = actionStorageKey(
    kind,
    subject,
    safeText(input.occurrence, 200) || "current",
  );
  return {
    actionKey,
    kind,
    ruleVersion: ACTION_RULE_VERSION,
    subject,
    title: safeText(input.title, 120),
    reason: safeText(input.reason, 1_000),
    source: safeText(input.source, 120) || "Mica",
    observedAt: timestamp(input.observedAt),
    confidence: boundedNumber(input.confidence, 0.5, 0, 1),
    suggestedAction: safeText(input.suggestedAction, 300),
    destination: destination(input.destination),
    evidence:
      input.evidence && typeof input.evidence === "object"
        ? canonicalValue(input.evidence)
        : {},
    priority: Math.round(boundedNumber(input.priority, 5, 1, 10)),
  };
}

function pricingEvidence(item, now, staleAfterHours) {
  const amount = Number(item.currentPrice ?? item.price);
  const observedAt = timestamp(
    item.priceObservedAt || item.pricingUpdatedAt || item.observedAt,
  );
  const status = safeText(item.pricingStatus || item.priceStatus, 50);
  const liveStatus = ["live", "fresh", "active"].includes(status);
  return {
    amount,
    observedAt,
    status,
    source: safeText(
      item.referenceProvider || item.priceProvider || item.provider,
      120,
    ),
    usable:
      liveStatus &&
      Number.isFinite(amount) &&
      amount >= 0 &&
      Boolean(observedAt) &&
      ageHours(observedAt, now) <= staleAfterHours,
  };
}

function positionDestination(item) {
  return destination({
    route: "collection",
    id: item.uid || item.positionId || item.id,
  });
}

function watchDestination(item) {
  return destination({
    route: "watchlist",
    id: item.watchlistId || item.id,
  });
}

function evaluateWatchlist(actions, watchlist, thresholds, now) {
  for (const item of watchlist || []) {
    const id = subjectId(item.watchlistId || item.id, "unknown-watch");
    const price = pricingEvidence(item, now, thresholds.staleAfterHours);
    const target = Number(item.targetPrice);
    if (Number.isFinite(target) && target >= 0 && price.usable) {
      if (price.amount <= target) {
        actions.push(
          action({
            kind: "watch_target",
            subject: { type: "watchlist", id },
            occurrence: `target:${target}`,
            title: `${safeText(item.name, 80) || "Watched item"} reached your target`,
            reason: `The verified matching price is at or below your saved ${item.currency || "USD"} target.`,
            source: price.source || "verified matching price",
            observedAt: price.observedAt,
            confidence: 1,
            suggestedAction:
              "Review the exact variant and current market evidence.",
            destination: watchDestination(item),
            evidence: {
              currency: safeText(item.currency, 3) || "USD",
              currentPrice: price.amount,
              targetPrice: target,
              pricingStatus: price.status,
              provider: price.source || null,
            },
            priority: 1,
          }),
        );
      }
    } else if (
      Number.isFinite(target) &&
      target >= 0 &&
      ["error", "unsupported", "unavailable", "stale"].includes(price.status)
    ) {
      actions.push(
        action({
          kind: price.status === "stale" ? "stale_data" : "coverage_loss",
          subject: { type: "watchlist", id },
          occurrence: price.status,
          title: `${safeText(item.name, 80) || "Watched item"} needs price evidence`,
          reason:
            price.status === "stale"
              ? "The last matching observation is too old to compare with your target."
              : "The matching provider could not supply a supported price, so Mica did not claim the target was reached.",
          source: price.source || "pricing capability",
          observedAt: price.observedAt || now,
          confidence: 1,
          suggestedAction: "Check the identity and refresh the matching price.",
          destination: watchDestination(item),
          evidence: {
            targetPrice: target,
            pricingStatus: price.status || "unavailable",
            alertSuppressed: "watch_target",
          },
          priority: 3,
        }),
      );
    }
  }
}

function verifiedMovement(item, field, thresholds, now) {
  const movement = item[field];
  if (!movement || typeof movement !== "object") return null;
  const percent = Number(movement.percent);
  const observedAt = timestamp(movement.observedAt);
  const status = safeText(movement.status, 50);
  const required =
    field === "comparableMovement"
      ? thresholds.comparableMovePercent
      : thresholds.priceMovePercent;
  if (
    status !== "live" ||
    !Number.isFinite(percent) ||
    Math.abs(percent) < required ||
    !observedAt ||
    ageHours(observedAt, now) > thresholds.staleAfterHours
  )
    return null;
  return {
    percent,
    observedAt,
    source: safeText(movement.source, 120) || "verified market observations",
    previousObservedAt: timestamp(movement.previousObservedAt),
  };
}

function evaluatePositions(actions, positions, thresholds, now) {
  for (const item of positions || []) {
    const id = subjectId(
      item.uid || item.positionId || item.id,
      "unknown-item",
    );
    const name = safeText(item.name, 80) || "Collection item";
    for (const [field, kind, label] of [
      ["priceMovement", "price_change", "matching price"],
      ["comparableMovement", "comparable_change", "comparable sales"],
    ]) {
      const movement = verifiedMovement(item, field, thresholds, now);
      if (!movement) continue;
      actions.push(
        action({
          kind,
          subject: { type: "position", id },
          occurrence: `${movement.observedAt}:${movement.percent >= 0 ? "up" : "down"}`,
          title: `${name} ${label} moved ${Math.abs(movement.percent).toFixed(1)}%`,
          reason: `Verified ${label} moved ${movement.percent >= 0 ? "up" : "down"} beyond your saved threshold.`,
          source: movement.source,
          observedAt: movement.observedAt,
          confidence: 1,
          suggestedAction: "Review the underlying observations before acting.",
          destination: positionDestination(item),
          evidence: movement,
          priority: 2,
        }),
      );
    }

    const opportunity = item.gradingOpportunity;
    if (
      opportunity?.eligible === true &&
      opportunity?.evidenceComplete === true &&
      Number(opportunity.confidence) >= thresholds.gradingMinimumConfidence
    ) {
      actions.push(
        action({
          kind: "grading_opportunity",
          subject: { type: "position", id },
          occurrence: safeText(opportunity.assessmentId, 200) || "current",
          title: `${name} has a grading review opportunity`,
          reason:
            "Complete capture evidence passed the deterministic confidence and value thresholds.",
          source: safeText(opportunity.source, 120) || "Mica grading evidence",
          observedAt: opportunity.observedAt || now,
          confidence: Number(opportunity.confidence),
          suggestedAction:
            "Review the evidence and costs; Mica’s estimate is not an official grade.",
          destination: { route: "grading", id },
          evidence: {
            assessmentId: opportunity.assessmentId || null,
            estimatedValueAdded: opportunity.estimatedValueAdded ?? null,
            evidenceComplete: true,
          },
          priority: 3,
        }),
      );
    }

    if (item.status === "owned" && item.purchaseDate) {
      const heldDays = daysBetween(item.purchaseDate, now);
      if (heldDays !== null && heldDays >= thresholds.inventoryAgingDays) {
        actions.push(
          action({
            kind: "inventory_aging",
            subject: { type: "position", id },
            occurrence: `threshold:${thresholds.inventoryAgingDays}`,
            title: `${name} reached your inventory-age threshold`,
            reason: `This position has been held for ${heldDays} days; the saved review threshold is ${thresholds.inventoryAgingDays} days.`,
            source: "collection transaction history",
            observedAt: now,
            confidence: 1,
            suggestedAction: "Review whether to hold, grade, reprice, or sell.",
            destination: positionDestination(item),
            evidence: {
              heldDays,
              thresholdDays: thresholds.inventoryAgingDays,
              purchaseDate: item.purchaseDate,
            },
            priority: 5,
          }),
        );
      }
    }
  }
}

function evaluateGoals(actions, goals, now) {
  for (const goal of goals || []) {
    if (
      goal.metadataStatus !== "verified" ||
      goal.lastProgress?.complete !== true
    )
      continue;
    const id = subjectId(goal.id, "unknown-goal");
    actions.push(
      action({
        kind: "collection_goal",
        subject: { type: "goal", id },
        occurrence:
          timestamp(goal.completedAt || goal.updatedAt) || "current-completion",
        title: `${safeText(goal.name, 80) || "Collection goal"} is complete`,
        reason:
          "Verified owned variants now satisfy the saved goal definition.",
        source: safeText(goal.catalogSource, 120) || "owned collection",
        observedAt: goal.completedAt || goal.updatedAt || now,
        confidence: 1,
        suggestedAction: "Review the exact completion evidence.",
        destination: { route: "goals", id },
        evidence: {
          catalogVersion: goal.catalogVersion || null,
          current: goal.lastProgress.current,
          target: goal.lastProgress.target,
          metadataStatus: goal.metadataStatus,
        },
        priority: 2,
      }),
    );
  }
}

function evaluateSubmissions(actions, submissions, now) {
  for (const submission of submissions || []) {
    const status = safeText(submission.status, 50);
    if (!status || status === safeText(submission.previousStatus, 50)) continue;
    const id = subjectId(submission.id, "unknown-submission");
    actions.push(
      action({
        kind: "grading_status",
        subject: { type: "grading_submission", id },
        occurrence: status,
        title: `Grading submission is now ${status.replaceAll("_", " ")}`,
        reason: "The saved submission status changed.",
        source: safeText(submission.source, 120) || "grading submission record",
        observedAt: submission.observedAt || submission.updatedAt || now,
        confidence: Number(submission.confidence ?? 1),
        suggestedAction:
          "Open the submission timeline and review the next step.",
        destination: { route: "grading", id },
        evidence: {
          previousStatus: submission.previousStatus || null,
          status,
          trackingCodePresent: Boolean(submission.trackingCode),
        },
        priority: 2,
      }),
    );
  }
}

function evaluateListings(actions, listings, thresholds, now) {
  for (const listing of listings || []) {
    const id = subjectId(listing.id, "unknown-listing");
    const issues = Array.isArray(listing.reviewReasons)
      ? listing.reviewReasons
          .map((value) => safeText(value, 80))
          .filter(Boolean)
      : [];
    const age = daysBetween(listing.lastReviewedAt || listing.updatedAt, now);
    if (age !== null && age >= thresholds.listingStaleDays)
      issues.push("review is stale");
    const uniqueIssues = [...new Set(issues)].sort();
    if (!uniqueIssues.length) continue;
    actions.push(
      action({
        kind: "listing_review",
        subject: { type: "listing", id },
        occurrence: uniqueIssues.join("|"),
        title: `${safeText(listing.name, 80) || "Listing"} needs review`,
        reason: uniqueIssues.join(" · "),
        source: "saved listing state",
        observedAt: listing.updatedAt || now,
        confidence: 1,
        suggestedAction: "Repair the listing details before relying on it.",
        destination: { route: "listings", id },
        evidence: { issues: uniqueIssues, daysSinceReview: age },
        priority: 3,
      }),
    );
  }
}

export function evaluateActionRules(input = {}) {
  const now = timestamp(input.now) || new Date().toISOString();
  const thresholds = normalizeActionThresholds(input.thresholds);
  const actions = [];
  evaluateWatchlist(actions, input.watchlist, thresholds, now);
  evaluatePositions(actions, input.positions, thresholds, now);
  evaluateGoals(actions, input.goals, now);
  evaluateSubmissions(actions, input.gradingSubmissions, now);
  evaluateListings(actions, input.listings, thresholds, now);
  return actions.sort(
    (left, right) =>
      left.priority - right.priority ||
      String(right.observedAt || "").localeCompare(
        String(left.observedAt || ""),
      ) ||
      left.actionKey.localeCompare(right.actionKey),
  );
}

function zonedMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

function minutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function notificationQuietAt(preferences, at = new Date()) {
  const normalized = normalizeNotificationPreferences(preferences);
  if (!normalized.quietHours.enabled) return false;
  const start = minutes(normalized.quietHours.start);
  const end = minutes(normalized.quietHours.end);
  if (start === end) return false;
  const current = zonedMinutes(new Date(at), normalized.timeZone);
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

function channelEnabled(preferences, channel) {
  if (channel === "in_app") return preferences.channels.inApp;
  if (channel === "email") return preferences.channels.email;
  if (channel === "web_push") return preferences.channels.webPush;
  return false;
}

export function planActionDeliveries(
  actionItem,
  preferences,
  previousDeliveries = [],
  at = new Date(),
) {
  const normalized = normalizeNotificationPreferences(preferences);
  if (!normalized.enabled || normalized.mutedKinds.includes(actionItem.kind))
    return [];
  const now = new Date(at);
  const quiet = notificationQuietAt(normalized, now);
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const recentCutoff = now.getTime() - normalized.cooldownHours * 3_600_000;
  return [...ALL_CHANNELS]
    .filter((channel) => channelEnabled(normalized, channel))
    .flatMap((channel) => {
      const idempotencyKey = `${actionItem.actionKey}:${channel}`;
      const sameDelivery = previousDeliveries.find(
        (delivery) =>
          delivery.channel === channel &&
          delivery.idempotencyKey === idempotencyKey &&
          ["pending", "processing", "sent"].includes(delivery.status),
      );
      if (sameDelivery) return [];
      const sentForChannel = previousDeliveries.filter(
        (delivery) =>
          delivery.channel === channel &&
          delivery.status === "sent" &&
          new Date(delivery.sentAt || delivery.updatedAt || 0) >= dayStart,
      ).length;
      if (sentForChannel >= normalized.dailyCap) return [];
      const sameKindRecently = previousDeliveries.some(
        (delivery) =>
          delivery.channel === channel &&
          delivery.kind === actionItem.kind &&
          delivery.status === "sent" &&
          new Date(delivery.sentAt || 0).getTime() >= recentCutoff,
      );
      if (sameKindRecently) return [];
      const delayed = quiet && OPTIONAL_CHANNELS.has(channel);
      return [
        {
          actionKey: actionItem.actionKey,
          kind: actionItem.kind,
          channel,
          idempotencyKey,
          status: channel === "in_app" ? "sent" : "pending",
          availableAt: delayed ? "after_quiet_hours" : now.toISOString(),
        },
      ];
    });
}

export function deliveryRetry(input = {}, at = new Date()) {
  const attempts = Math.max(0, Math.round(Number(input.attempts) || 0));
  if (input.permanent === true || attempts >= 5)
    return { status: "failed", availableAt: null };
  const delayMinutes = Math.min(360, 2 ** attempts * 5);
  return {
    status: "pending",
    availableAt: new Date(
      new Date(at).getTime() + delayMinutes * 60_000,
    ).toISOString(),
  };
}

export function transitionActionStatus(
  current,
  transition,
  { at = new Date().toISOString(), snoozedUntil = null } = {},
) {
  const status = safeText(current, 20) || "open";
  if (!["dismiss", "snooze", "complete", "reopen"].includes(transition))
    throw new Error("Unsupported action transition");
  if (transition === "snooze") {
    const until = timestamp(snoozedUntil);
    if (!until || new Date(until) <= new Date(at))
      throw new Error("Snooze must end in the future");
    return {
      status: "snoozed",
      snoozedUntil: until,
      occurredAt: timestamp(at),
    };
  }
  const next = {
    dismiss: "dismissed",
    complete: "completed",
    reopen: "open",
  }[transition];
  if (next === status && transition !== "reopen")
    throw new Error("Action already has that status");
  return { status: next, snoozedUntil: null, occurredAt: timestamp(at) };
}

export function actionRuleKinds() {
  return [...ACTION_KINDS];
}
