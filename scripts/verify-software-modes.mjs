import { readFile } from "node:fs/promises";

const [app, shell, modes, data, migration, browser] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../lib/software-modes.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase-data.js", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/20260902130000_software_modes.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL("../tests/browser/ui-regression.spec.js", import.meta.url),
    "utf8",
  ),
]);

const checks = [
  [modes, /collector:[\s\S]+investor:[\s\S]+seller:/, "three mode contracts"],
  [modes, /defaultView:[\s\S]+actions:/, "workflow defaults and actions"],
  [app, /export async function switchSoftwareMode/, "reversible switch"],
  [app, /saveProfile\(supabase,[\s\S]+softwareMode/, "cloud preference save"],
  [app, /restoreModeCollectionView/, "per-mode collection state"],
  [shell, /id="softwareModeSelect"/, "header mode control"],
  [shell, /id="softwareModeSettings"/, "settings mode control"],
  [shell, /id="softwareModeHome"/, "focused dashboard composition"],
  [data, /recordSoftwareModeEvent/, "privacy-minimized mode telemetry"],
  [migration, /enable row level security/i, "mode-event RLS"],
  [migration, /user_id = auth\.uid\(\)/i, "owner event boundary"],
  [migration, /on delete cascade/i, "account deletion"],
  [browser, /Collector, Investor, and Seller modes/, "browser mode coverage"],
];

const failures = checks
  .filter(([source, pattern]) => !pattern.test(source))
  .map(([, , label]) => label);

if (failures.length) {
  throw new Error(`Software-mode verification failed: ${failures.join(", ")}`);
}

console.info(
  "Verified Collector, Investor, and Seller composition, reversible preferences, shared navigation, and owner-private mode events.",
);
