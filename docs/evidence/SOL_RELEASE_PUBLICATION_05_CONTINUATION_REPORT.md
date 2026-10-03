# PUBLICATION-05 continuation — corrected release published, 2026-10-02

**The nine-function release is promoted at [Mica](https://jordan-pokemon-app.vercel.app), deployment `dpl_FQ1EmvSNWPFH83esaKFTW9YQT973`. Hard provider holds and deletion-only scheduling are actually live.** Elliott explicitly authorized this bounded correction/publication; no paid-plan upgrade, provider activation or Supabase SQL rerun occurred. Ponytail FULL and existing publication/release boundaries were followed. Final Git/automation verification is recorded separately below.

## Exact artifacts and delta

| Artifact | SHA-256 |
| --- | --- |
| Corrected deployment ZIP | `1c7e16abb069d3e484a85f6483478ac89f60a7c70230079d19d0e583a1c6d58d` |
| Corrected source ZIP | `ff703c3ec208ffbebab8ea67adca116da5e688bafb89d095df84d66c91fb985d` |
| Corrected manifest | `f848638c8b17fd243edbfb39ef7f071087fb2404cd82430e3c8bfb80b2602134` |
| Corrected source patch | `b53a841ca3c387b5aa992aaf88a370fa2b596863f53190f749937c7b8c60b6b5` |

Two builds reproduced all archive/manifest hashes. Original ACTIVATION-04 files and hashes are preserved. The exact manifest records 49 deployment/control files; CLI dry inventory matched the **47 upload files / 4,006,753 bytes**. Source archive has 87 explicitly selected inputs; it is not a dirty-worktree package. Generated ZIPs stay local; safe manifests, patch, build/check scripts and evidence are committed. No credentials, private recovery/customer rows, environment files, fixtures or source maps enter deployment output; 137 source/output/patch contents passed credential scans. Server secrets remain server-only and were not decrypted or pulled.

All 28 ACTIVATION-04 static output files are unchanged. Eight held function directories were replaced by one `_release-hold.func`; eight active APIs (account, capabilities/deletion, card-image, cards, catalog, FX, health, set) remain independent. The public-only cards default wrapper is rebundled to retain meaningful offline provider implementation tests; its shipping policy cannot be overridden by credentials/request input. Seven other active API bundles/configurations are unchanged. Build Output configuration adds explicit anchored case-sensitive routes, a private-handler-path 404, and per-route request-path transforms. Local control configuration retains the Git deployment guard. Source adds the shared dispatcher, retained implementation exports and explicit public build configuration; provider implementations remain disabled at HTTP shipping exports.

Current [Build Output routing documentation](https://vercel.com/docs/build-output-api/configuration#routes) supports these routes and `request.path` transforms. The dispatcher allowlists eight exact paths and ignores query/header route selectors. Ordinary methods retain the approved 503 `release_hold` behavior; native OPTIONS allows only each route's existing method list/headers. Hostile origins remain 403, responses remain private/no-store, and unknown paths stay 404. No deletion handling was consolidated into this function. `node scripts/verify-release-routing.mjs` checks actual output hashes/routing and exactly **nine functions, below the observed twelve-function limit**, with zero outbound calls.

## All 18 failures traced

| Prior failing assertions | Investigation and retained coverage |
| --- | --- |
| Offers and sealed configuration responses (2) | Default exports now hold before credentials; original implementation assertions remain against named retained handlers. Shipping checks require hold/no-store/zero calls with populated credentials. |
| JustTCG selection, PkmnPrices preference and timeout/fallback (3) | ACTIVATION-04 hardcoded public-only keys made paid tiers unreachable. Retained cards handler preserves licensed paid-tier/header/timeout assertions offline; shipping wrapper forces public-only and has a separate test with paid keys present. |
| Sold context/plan/error states, first-edition/BGS/detailed-printing attribution (6) | Held sales default bypassed implementation validation. Existing exact-context, wrong-pool, entitlement and error assertions remain against the retained sales implementation using mocked upstream responses. |
| Vision auth/body limits, maintenance cron auth and price-sync scheduled/manual auth (5) | Shipping holds precede these implementation branches. Existing 401/413/admin/cron assertions remain against retained implementations; new shipping checks assert unconditional holds and CORS boundaries. |
| Capabilities and service-worker cache version (2) | Approved public fallback/hold capabilities and explicit ACTIVATION-04 cache bump replaced prior values. Assertions now require those exact values while preserving secret exclusion and theme/cache integrity checks. |

No test was deleted or weakened to suppress a failure. Affected suite: **160/160 pass**. Full previously failing suite: **473 tests, 471 pass, zero fail, two existing database-dependent skips**. Focused shared/output tests cover every route, ordinary methods, allowed/disallowed preflight, hostile origins, unknown paths, forged selectors, no-store, public-only cards and independent deletion auth. Certificate-fixture exclusion passes. No genuine additional behavior regression remained after tracing these differences.

## Hosted verification and publication

Uploaded the exact corrected prebuilt once with `--prod --skip-domain`; candidate reached READY/STAGED with nine actual function outputs. Before promotion, 42 scoped real runtime checks passed: holds, per-route CORS/preflight, hostile origins, unknown/private paths, selector spoofing, health/capabilities and account/deletion 401. Three remote static hashes (app, service worker, public config) matched. Candidate metadata contains only deletion cron `15 5 * * *`.

Vercel moved its automatic project alias during staging despite `--skip-domain`. Investigation confirmed the **only configured production domain** is the primary app URL; it and the production/cron targets stayed old until promotion. The automatic alias and candidate were Vercel-authentication protected; no protection was disabled. This bounded staging observation was disclosed and recorded, then authorized promotion proceeded after checks. Do not assume automatic aliases stay old when using this command.

Promotion succeeded without rebuild. Live primary checks pass all eight holds, eight native preflights, eight hostile origins, unknown-path 404s, health 200 with expected private-schema access restriction, honest capabilities, account/deletion 401, public-only TCGdex lookup and three exact static hashes. The project cron assignment is now **only the authenticated deletion job**; price-sync/maintenance schedules are absent. Runtime log scan shows a Node `DEP0169` dependency deprecation warning on a successful capabilities request, not an application exception; the scan is not falsely reported as clean. No paid provider call, synthetic account, authenticated save or customer mutation was performed.

Existing Git workflows were inspected: only local quality/database checks, no hosted deployment/SQL jobs. Committed `git.deploymentEnabled: false` prevents Vercel Git auto-builds using the existing platform setting. Publication uses the existing reconciliation branch with a normal fast-forward push, preserving unrelated dirty work. Final remote SHA, workflow results, both alias records and unchanged production deployment are in [publication-final.json](sol-release-publication-05/publication-final.json).

Users receive collector/manual capture and correction, physical copy/sale/history, profile/privacy/settings, in-app action and retained pregrade surfaces with public raw pricing/catalog/FX. AI recognition/advice, paid fresh graded/sealed evidence, external email/push delivery and certificate/GemRate integration remain held/excluded. Read-only checks do not prove login/save/reopen/private-Storage/device acceptance. Native signing/callbacks, subscriptions, App Store and CLIENT-08 remain separate. **Stop for Astra review before the next feature packet.**
