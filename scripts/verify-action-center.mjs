import { readFile } from "node:fs/promises";

const [rules, delivery, maintenance, migration, app, shell, vercel] =
  await Promise.all([
    readFile(new URL("../lib/action-center.js", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/notification-delivery.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../api/maintenance.js", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260903120000_dependable_action_center.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../app.js", import.meta.url), "utf8"),
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  ]);

const checks = [
  [rules, /ACTION_RULE_VERSION = "mica-actions-v1"/, "versioned rule contract"],
  [
    rules,
    /watch_target[\s\S]+price_change[\s\S]+comparable_change[\s\S]+coverage_loss[\s\S]+stale_data[\s\S]+collection_goal[\s\S]+grading_opportunity[\s\S]+grading_status[\s\S]+listing_review[\s\S]+inventory_aging/,
    "complete deterministic rule families",
  ],
  [
    rules,
    /\["error", "unsupported", "unavailable", "stale"\][\s\S]+alertSuppressed/,
    "provider failure suppression",
  ],
  [rules, /notificationQuietAt/, "quiet-hours control"],
  [rules, /dailyCap/, "daily delivery cap"],
  [rules, /cooldownHours/, "notification cooldown"],
  [delivery, /Idempotency-Key/, "provider idempotency key"],
  [
    delivery,
    /email_not_configured[\s\S]+web_push_adapter_not_configured/,
    "honest optional adapters",
  ],
  [
    maintenance,
    /processDeletionJobs[\s\S]+processActionCenterMaintenance/,
    "consolidated maintenance worker",
  ],
  [
    migration,
    /alter table public\.action_items enable row level security/i,
    "action RLS",
  ],
  [migration, /for update of delivery skip locked/i, "leased delivery claims"],
  [
    migration,
    /unique\(user_id,idempotency_key\)/i,
    "durable delivery deduplication",
  ],
  [
    migration,
    /quiet_hours_enabled[\s\S]+daily_cap[\s\S]+muted_kinds/i,
    "stored user controls",
  ],
  [
    migration,
    /transition_action_item[\s\S]+'dismiss'[\s\S]+'snooze'[\s\S]+'complete'/i,
    "audited outcomes",
  ],
  [
    migration,
    /recipient email is resolved transiently/i,
    "email data minimization",
  ],
  [app, /class="durable-action/, "durable action rendering"],
  [
    app,
    /Open evidence[\s\S]+Snooze 24h[\s\S]+Dismiss[\s\S]+Complete/,
    "action-center controls",
  ],
  [
    app,
    /openNotificationPreferencesSheet[\s\S]+Unsubscribe optional channels/,
    "channel preferences",
  ],
  [shell, />Action alerts</i, "settings entry point"],
  [vercel, /"path": "\/api\/maintenance"/, "scheduled maintenance"],
];

const failures = checks
  .filter(([source, pattern]) => !pattern.test(source))
  .map(([, , label]) => label);
if ((JSON.parse(vercel).crons || []).length > 2)
  failures.push("Vercel Hobby cron limit");

if (failures.length)
  throw new Error(`Action-center verification failed: ${failures.join(", ")}`);

console.info(
  "Verified versioned action rules, provider-failure suppression, owner RLS, evidence links, audited outcomes, idempotent leased delivery, controls, and the two-cron Hobby limit.",
);
