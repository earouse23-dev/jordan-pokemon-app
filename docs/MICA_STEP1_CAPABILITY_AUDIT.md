# Mica Step 1 capability audit

**Audit date:** 2026-08-31
**Repository branch:** `codex/mica-baseline-reconciliation`
**Production URL:** <https://jordan-pokemon-app.vercel.app/>
**Scope:** Software implementation only. No production data, deployment, provider, or configuration was changed.

## Locked decisions

- Reconcile the existing working tree into a clean, traceable baseline.
- Use a dedicated, disposable staging environment for authenticated verification.
- Retain evidence-based, non-official grading estimates and the grading-to-sale lifecycle.
- Retain the static PWA architecture documented in `docs/adr/0001-retain-static-pwa.md`.

## Architecture map

- `index.html`, `app.js`, `styles.css`, and `themes.css` provide the static PWA interface.
- `lib/` contains domain, portfolio, pricing, grading, catalog, provider, and Supabase client modules.
- `api/` contains Vercel Functions for health, catalog, pricing, offers, sales, sealed products, AI, synchronization, capabilities, images, and deletion.
- `supabase/` contains PostgreSQL migrations, RLS policies, Storage contracts, and the `sync-catalog` Edge Function.
- Vercel hosts the static bundle and Node 24 Functions. Supabase supplies Auth, PostgreSQL 17, Data API, private Storage, and scheduled database work.
- TCGdex is the catalog and free pricing fallback. PkmnPrices is the primary market provider, but production reports the free plan. JustTCG is optional. Alt and Card Ladder are disabled.
- Vercel AI Gateway handles identification, grading consensus, registered-reference comparison, and portfolio explanations.

## Route and capability matrix

| Flow | Owner/code path | Data/provider dependency | Status | Verification result |
|---|---|---|---|---|
| Authentication and recovery | `index.html`, `app.js`, `lib/supabase-data.js` | Supabase Auth | Partial/unverified | UI and session logic exist; no real signed-in browser journey has run. |
| Onboarding | `app.js`, `profiles` | Supabase profile preferences | Partial | Preferences persist, but they do not currently change workflows. |
| Dashboard | `/#dashboard`, `app.js` | Portfolio, price, valuation, transaction data | Partial/misleading | Account-load failure can leave stale values visible. |
| Collection/raw/graded/set progress | `/#collection`, `app.js` | Collection, catalog, pricing, grading tables | Partial/unverified | CRUD and filters are implemented; persistence was not exercised with a safe account. |
| Catalog search/manual entry | `/#scan`, `api/catalog.js` | Internal catalog, TCGdex | Operational public path | Production returned exact candidates with confirmation required. |
| Photo identification and pre-grading | `app.js`, `api/vision.js`, grading modules | Supabase Auth/usage, AI Gateway, private Storage with consent | Partial/unverified | Extensive tests exist; physical camera, provider retention, and persistence remain unverified. |
| Sealed products | Add workspace, `api/sealed.js` | PkmnPrices paid entitlement | Disconnected in production | Enabled UI leads to `provider_plan_required`; no manual fallback exists. |
| Purchases and sales | Collection detail, portfolio modules/RPCs | Purchase lots, transactions, FIFO allocations | Partial/unverified | Unit tests pass; no authenticated end-to-end evidence. |
| Trades | `/#trade`, `app.js` | Pricing only | Partial/disconnected | Calculator works in memory but records no ledger transaction. |
| Watchlist and alerts | Collection/watchlist, `app.js` | Watchlist rows, price refresh, local notifications | Partial | Watch entries persist; delivery is foreground-only and device-local. |
| CSV import | Settings/import, `app.js`, import RPC | Supabase portfolio mutations | Partial/high risk | Idempotent retries exist; no mapped-row preview, dry run, or whole-import rollback. |
| Reports and exports | Settings, `lib/core.js` | Browser-generated files | Mixed | CSV/insurance/share/export exist; “Complete account backup” omits several account domains. |
| Profile/settings | `/profile`, `app.js`, `vercel.json` | Static SPA routing | Broken in production | Direct load and refresh return 404; the local rewrite is not deployed. |
| Privacy and account deletion | `api/account.js`, deletion RPCs/Storage | Supabase Auth admin, private Storage, deletion functions | Release-blocked | Current source calls a production-missing RPC. |
| PWA/offline | `sw.js`, manifest | Browser cache/network | Partial | Shell is offline-capable; private data remains network-only. Optional imagery can delay installation. |
| Admin/grading pilot | Protected capability route and grading pilot API | Reviewer/admin `app_metadata`, grading-private schema | Hidden/protected | V3 source depends on seven unapplied migrations. |
| Action center/business tools | Hidden `#insightsData` content | Portfolio calculations and AI advisor | Hidden/disconnected | Code renders the tools, but the parent surface remains permanently hidden. |
| Analytics/observability | Configuration and runbooks | No connected event or monitoring service | Missing/partial | No product event pipeline, external uptime monitor, proven restore, or alert routing. |

## Ranked findings

### P1 — release blockers

1. Production is not reproducible from Git. The deployed core asset hashes match neither commit `08854a6` nor the reconciliation working tree.
2. The database and runtime contracts have drifted. Local source has 64 migrations; production has 58 history rows representing 57 names. Seven local migrations are pending and 51 shared names use different versions.
3. Current account-deletion source cannot run against production because `grading_withdraw_account_training_service` is absent. Live deletion jobs also lack a recovery lease.
4. AI privacy copy says photos are sent once, while precision grading can make several provider-family requests plus registered-reference comparisons.
5. Production `/profile` refresh is broken, sealed entry is a dead end, account-load failure can show stale dashboard values, and CSV imports cannot roll back as a unit.
6. The green release gate does not test real authentication, persistence/reload, two-user isolation, deletion, migration application, or provider failure recovery.
7. Public paid-provider proxies use absent or process-local rate limiting and can consume provider capacity without a durable quota.

### P2 — stabilization work

- Onboarding goals and workspace mode do not change behavior.
- Trades do not persist and display currency is a no-op control.
- Multilingual manual search is hidden in the legacy scan view.
- Health checks do not validate entitlement, Storage, deletion queues, cron freshness, or a real AI request.
- Vercel Functions and Supabase are cross-region and no latency budget is enforced.
- QA, performance, architecture, provider, and product-strategy documentation has drifted from source and production.

## Confirmed strengths

- No critical RLS bypass was found; inspected live tables have RLS enabled.
- Internal no-policy tables expose no client grants and fail closed.
- Private Storage paths are owner-bound; research storage additionally requires consent.
- Browser and server secrets are separated and the tracked/untracked source scan found no opaque credential candidate.
- Unsupported, missing, stale, and zero prices are generally kept distinct.
- Focus containment/restoration, reduced motion, labeled controls, keyboard behavior, and narrow layouts are covered by source and browser tests.
- `npm audit --omit=dev` reports no production dependency vulnerability.

## Reconciliation evidence

- `docs/evidence/MICA_BASELINE_FILES.sha256` records the pre-reconciliation file hashes.
- `docs/evidence/MICA_PRODUCTION_MIGRATIONS.json` records the read-only production migration history.
- `docs/evidence/MICA_MIGRATION_RECONCILIATION.json` records the seven approved pending migrations, 51 known version mismatches, and duplicated production migration name.
- `npm run check:migrations` fails if the recorded migration relationship changes unexpectedly.
- The local `sync-catalog` language allowlist now matches live Edge Function v9: English, French, Spanish, German, Italian, Portuguese, Japanese, Traditional Chinese, Indonesian, and Thai.

### Static bundle hashes

| Asset | Reconciliation build | Production |
|---|---|---|
| `index.html` | `de7e18024bc144087c4db5b8faa7a210a514959e9f9729b4cce0764f6b6bb99c` | `7a8903f34c145d63303ea2486d9eb5c8df77498ee98ec848bbe29b5685b5c0f5` |
| `app.js` | `6cd8be19c0a26982b5eb2f5a0db1bd55bb17e198c2ea2867fdb510ee15158caa` | `9c37ca13ca9cabd851ab90b3aa46d225d4899e05f6d3a54f82ca547c9c45ce6f` |
| `styles.css` | `10003480df9d3187ad41a219b916fc49d1f9bf6526bf8b8d217c4f67cc2f7a57` | `9e4d1759c0bc483705ee024e117a16b4efd04b3530e2d7228aef8ffb3a1c6d06` |
| `themes.css` | `cb848458e4a85dfc29afc0f6c2c790b9352857858126b51159ddc3feacb13f9b` | `8ba6aa7eb1993fe1258c3687aecf7cf434f44252c86e721b1b4fd9660c3a0d68` |
| `sw.js` | `ebe933adc307a415fe005d507475daba3a5f3d66d51cf32e69402bd8ee2a6627` | `a9a00329c3d09e07978db740e97e2ca2ed63b7eaa4d06390d60e1c25157548d9` |
| `manifest.webmanifest` | `2db940851dc90775bea5a33dc838fc518481839de996f6503a1f06545c8f9bbe` | same |

## Current verification and remaining exit gate

The local release checks pass, but Step 1 is not closed until an isolated staging environment supports:

- real sign-up/sign-in/recovery and two-user isolation;
- catalog → add → edit → purchase → sale → reload;
- profile direct-load and refresh;
- sealed-product unsupported/manual recovery behavior;
- CSV interruption, retry, duplicate handling, and documented partial-commit behavior;
- grading capture, consent, report persistence, withdrawal, and deletion recovery;
- watch alerts, exports, complete account deletion, and provider-outage recovery;
- iPhone Safari, Android Chrome, desktop keyboard/screen-reader, and physical-camera checks.

No production deployment or migration is permitted from this branch. Step 2 begins only after this exit gate passes and Elliott approves continuation.
