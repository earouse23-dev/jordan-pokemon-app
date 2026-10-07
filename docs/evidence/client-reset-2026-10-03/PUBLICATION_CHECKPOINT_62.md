# Safari dashboard and pricing correction — checkpoint62, October 6, 2026

Live: https://jordan-pokemon-app.vercel.app. Deployment: dpl_84wFDPRAUryX27AsptDBLYC5Fv5k. Previous production checkpoint61 and frozen artifacts are preserved. No SQL replay, customer writes, new dependency, provider purchase or AI activation.

## Shipped correction

Portfolio defaults to value rather than profit/loss after login. Solid continuous lines retain truthful gaps/partial coverage; a leading dot follows the 1.2-second native ChartJS trace and disappears at completion. Reduced motion skips tracing. Independent all-time-default P/L remains underneath, green/red by sign. Collection and activity are visible below the graph instead of inside collapsed money details. No stored customer records were rewritten.

Shared PkmnPrices identity matching now accepts numeric padding (2 versus 002), a matching provider number suffix in names, and documented provider set prefixes/151 naming. Wrong numbers, totals, languages, Shadowless/Celebrations and alphanumeric prefixes remain distinct. This repairs every adapter caller without choosing the first ambiguous result. Saved graded cards automatically read authenticated exact-context comps; only explicit refresh persists valuation. Reusing valuationContextForItem fixes the legacy Graded-condition response-key mismatch without weakening owner/context guards.

Official docs consulted: [Cards](https://www.pkmnprices.com/docs/cards), [eBay listings](https://www.pkmnprices.com/docs/ebay-listings), [price history](https://www.pkmnprices.com/docs/price-history). Card-list responses are identity results; detail responses contain raw-condition prices. Graded sold estimates use matching graded listings, never raw or asking-price substitution.

## Actual provider evidence and limits

Authenticated staged public-card diagnostics return Blastoise Base Set2/102 → provider12933, raw Near Mint USD222.49; Mew ex151 193/165 → provider30485, raw Near Mint USD27.07, both observed October6. Requested PSA9 Blastoise comps return10 records,4 eligible, estimate USD950; newest matching sale August31 makes it stale. Diagnostics requested a specific printing and do not establish saved legacy customers' printing facts. Missing edition/promo/variant data and needs_review remain unresolved. Current graded value cannot be guaranteed by a Pro subscription; old sold data remains dated, not fresh portfolio value. No automatic portfolio-wide graded fan-out or customer writes were introduced. Bounded Pro public-data diagnostics used existing allowance; paid AI calls zero.

## Tests, package and live verification

Full native-isolated unit suite531 passed,0 failed,3 skipped. Dashboard/history60 passed in desktop Chromium/mobile WebKit. Physical-copy44 passed,2 database-dependent skips. Two additional focused visual checks pass. Initial failures are preserved: unauthenticated automatic fetching was fixed with the session guard; context mismatch was fixed at the shared helper; fixture grade corrected to its actual value. Existing preservation/privacy assertions were not removed or weakened.

Two clean curated builds reproduce identical hashes:

- Deployment ZIP SHA-256: 292dcd9970edc6f650b4811cd35fb8c144ac4baefef23f0255e40035256da17a
- Source ZIP SHA-256: bbba913b9b4c69620f79a919ac49d7773ee358ca18bddf85d35d2e1404e2ddbb
- Exact manifest SHA-256: c71079fff32c0e94b0b8fee61be6f29a40bf55c7c0fdc673e1bbc79f48ea7b3a

90 source entries,49 output entries,nine functions. Product delta from61: app.js, lib/providers/pkmnprices.js, themes.css. Output delta: static/app.js, static/themes.css, api/cards.func/index.mjs, _release-hold.func/index.mjs. Shared adapter changes the held bundle without enabling held providers. All routes, public configuration and deletion-only scheduling retained. Credential/private-data scans and certificate-fixture exclusion pass; unrelated dirty work excluded.

Candidate uploaded once without production domains, verified READY, then promoted once. Staged and live configuration-hash/health/capabilities checks pass; held routes503/no-store, Pro unauthenticated401, deletion401, allowed native CORS204, hostile origins403 and unknown endpoints404 pass. Authoritative canonical alias and cron deployment point to62. Sole schedule remains /api/capabilities?surface=grading-deletion at15 5 * * *. Existing Git ignored-build command exit0 and committed deployment suppression prevent Git builds replacing the prebuilt release. Existing workflows inspect quality/local identity only. No paid cron enabled.

Bounded 30-minute runtime review contains three existing DEP0169 URL-parser deprecation warnings, no uncaught/unhandled payloads. It is not exhaustive acceptance and warnings remain unsuppressed. Read-only hosted checks do not prove login/save/Storage/device workflows; checkpoint61's bounded real demo proofs are reused.

## Remaining beta gates

Unresolved customer printing confirmation and representative raw/graded/language/sealed displayed coverage remain open; no customer repair is inferred. Real recognition/pregrading/advisor stay held pending the separate AI allowance. Official PSA/Beckett/GemRate access is missing. Owner iPhone camera/library acceptance and recovery → new-password/sign-in acceptance remain open. Native extension/signing/subscriptions/App Store remain separate. This release fixes the reported dashboard and demonstrated matching bugs; it is not a claim that every beta requirement is operational.

Publication and final remote/alias proof accompany this report. Source provenance uses the existing curated release builder, not the dirty worktree. See checkpoint62 manifest, build-preflight, staged-provider, staged/live-runtime, production-state and final-publication evidence.

Product and focused test commit: bbdca62110148e8f0a8da512f51d9d13028cd907. Final visual captures wait for tracing completion; the temporary leading dot is absent in the completed graph.
