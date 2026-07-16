# QA report

Verified 2026-07-15 in the local workspace.

```bash
npm test
npm run test:schema
npm run typecheck
npm run lint
npm run build
```

Results: 28/28 unit tests passed; JavaScript checks passed; custom source lint passed across 13 files; production bundle built successfully to `dist/`; and `git diff --check` found no patch errors. Pricing tests cover normalization, currency/finish/condition/grade compatibility, preferred price selection, history deduplication, server-only key forwarding, normalized output, cache headers, and explicit history/sold-provider entitlement failures. Search tests cover parsing, ranking, number-only queries, set-name ambiguity, selected language, and secret exclusion. Portfolio tests also verify that a missing purchase cost stays unknown and is excluded from gain/loss coverage instead of being treated as free. CSV tests verify safe export and backup round-trip import without converting blank costs to zero.

The dedicated Supabase project now has seven versioned migrations, 37 public tables with RLS, version 2 of the active JWT-protected catalog Edge Function, an active Vault-backed dispatcher cron, and an active hourly price-metric cron job. A proposed custom-token dispatcher was not deployed because changing the platform JWT boundary was not authorized; the follow-up migration restores the original JWT dispatcher. Ten language targets remain pending while the service-role JWT is absent. The supplied PkmnPrices key returned five current-price rows for exact Base Set Charizard card ID `16909`; price history and sold evidence both returned verified plan-limit responses.

The failing Vercel deployment was traced to `STATIC_BUILD_NO_OUT_DIR`: the project expected `public/` while the build emits `dist/`. Repository-owned `vercel.json` now sets the build command and output directory explicitly.

The first attempt to use the default Node test runner was blocked by sandbox process-spawn permissions (`EPERM`). The identical `node:test` cases were then run in-process with `node tests/core.test.js` and all passed. On this Windows host, use `npm.cmd` if PowerShell execution policy blocks `npm.ps1`.

Live TCGdex acceptance checks passed for `Mew ex 151/165`, `151/165`, `Charizard 4/102`, `Greninja 214/167`, and `Pikachu 151`; the intended printing ranked first in every case. The Mew provider ID was the real `sv03.5-151`.

Browser QA passed at 320×700, 390×844, 768×1024, and 1280×800. There was no document-level horizontal overflow; the app stayed capped at 760px on wide screens; practical visible controls met 44px sizing; inactive views had both `hidden` and `aria-hidden`; and the sheet moved focus to Close, hid the app shell from assistive technology, trapped focus, and restored it on close. The verified journey was Library → Add card → search → result review → exact-printing detail → Add to Library → default Near Mint copy saved → back to preserved search text/results. Static preview hosting cannot run `/api/*`, so browser search exercised the honest offline fallback while live adapter checks covered provider ranking. The only captured console error came from the browser extension message channel, not Mica source.

The final friction loop verified Library → owned detail → edit → sheet closed with browser Back → detail returned with browser Back; Favorites and Graded views; arrow-key tab movement; conditional graded fields; blank-cost quick add; delete confirmation and return; and two-step preview-library reset. Sheets now participate in browser history, destructive actions are confirmed, record deletion is available, filters include favorites/set/condition, and live pricing refresh batches every collection record instead of silently stopping after eight.

The photo path was corrected during this loop. The preview has no image-recognition service, so it now presents the photo as an on-device reference and directs the collector to exact-printing search. It no longer animates a false identification pipeline or opens the first fixture as a supposed best match.

Not browser-automated: native camera/file chooser upload, download confirmation, physical-device permissions, screen-reader speech, and a full Vercel-runtime provider request rendered in the UI. The local Vercel runtime could not start without an interactive Vercel login. Live read-only TCGdex acceptance checks still verified exact Mew ex `sv03.5-151` search and normalized current pricing metadata. Those remaining checks are device/infrastructure checks.

Not yet executable end to end: protected full catalog backfill (requires an authorized service-role JWT in Vault), licensed sold-data ingestion, cross-user RLS integration with test identities, Auth/OAuth, private signed upload, Gemini identification, scheduled cleanup, provider outage integration, and production monitoring.
