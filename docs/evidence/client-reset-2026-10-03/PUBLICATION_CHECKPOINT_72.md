# Green actions and faster collection pricing — October 7, 2026

Primary Add/Save actions are a stronger green; secondary actions and history controls use a green tint with a green selected state. The existing layouts, accessibility and destructive-action styles remain.

Collection pricing previously waited for every batch, graded group and snapshot write before displaying results. Each successful raw batch and graded group now renders immediately; final rendering precedes snapshot persistence. Raw metadata requests exclude graded copies, which retain their independent exact sold-evidence valuation. Duplicate raw identities still share their lookup. Initial owned pricing runs before Watch pricing to avoid competing for the same existing provider rate slots. No provider budget, deadline, API contract or hosted setting changes.

A successful matching raw history with a fresh quote is reused in memory for up to 15 minutes. Owner, account-load version, identity and valuation context must match. Expired, unsuccessful or mismatched results refetch, and late responses must match both current account and detail guards. Page reload starts fresh. Cold provider requests still depend on provider latency and existing rate limits; this is not a claim that every first lookup is instantaneous.

Runnable regression coverage is in tests/browser/collector-home.spec.js: hold the second batch while verifying the first prices already display, exclude graded copies from raw lookups, preserve missing-printing boundaries, and test history reuse/context changes/expiry/owner changes. The Add action's actual green style is asserted and mobile WebKit rendering visually inspected. Across the three affected browser files, 207 distinct checks pass and nine existing conditional checks are skipped. Six original failures traced to two earlier approved interface simplifications: price details now require More options, and acquisition method is hidden for graded intake with an honest unknown default. Tests now follow those interfaces; their exact pricing, resumed draft, costs/date and idempotent-save assertions remain. All 538 unit tests pass, three existing skips.

Two final clean curated builds reproduce identical hashes, changing only app.js and themes.css from checkpoint71. The initial pre-style-specificity candidate is preserved locally under checkpoint-72 filenames and was never deployed; checkpoint-72-final files identify the shipped release. Nine functions, 49 output files, 90 source files. Routing/count/auth/CORS/holds/deletion checks and certificate exclusion across 31 shipping files pass. Scan of 139 source/output files found zero credentials or private demo identifiers. Original archives, unrelated dirty documentation and local private recovery data remain intact.

- Deployment ZIP SHA-256: 1e522eaebfa5ebe668a6061b7c989bd30f1d83eab0c6ce1b2693a8c03408e675
- Source ZIP SHA-256: 8133b440a013b31a6e778a420610faaf6c9a194a2893b04e05bd571989bb6be6
- Manifest SHA-256: 419cba170f913e6b2e3aac944acec05396df517249fb183168f3067201fd3931
- Deployment: dpl_5ZmeUJuDruMqhA8DCay9sv7bcwvK
- Unique URL: https://jordan-pokemon-e4iwpg0be-earouse23-devs-projects.vercel.app
- Canonical URL: https://jordan-pokemon-app.vercel.app
- Prior canonical deployment: dpl_BicjoVqkyqt5tTuMdyU6QxphKa22

Uploaded once prebuilt with production/skip-domain. READY and protected runtime checks passed before promotion; canonical alias remained on checkpoint71 during staging, while Vercel assigned its secondary platform alias. Final verification matches shipped app/config hashes, READY, canonical alias, sole deletion cron /api/capabilities?surface=grading-deletion at 15 5 * * *, ignored-build exit0 and source deploymentEnabled:false. Existing Git workflow paths do not deploy this branch change. Health/public configuration/held responses/authentication/hostile-origin/unknown-route checks pass. No Supabase SQL, customer inventory edits, new demo records, dependency changes or paid AI calls. A bounded runtime sample showed three existing DEP0169 deprecation warnings and no application exception.

Remaining gates: owner facts for five incomplete graded identities; separate AI recognition allowance; Elliott's physical iPhone Safari camera/library and password-reset acceptance. Those gaps are not solved by this performance/presentation correction.

Live existing-demo verification: raw current price and 101 recorded history days display; returning to that matching card renders its chart in 55 ms with zero additional full-history requests. No graded copy received a raw lookup and no browser exception occurred. This is one warm reopen observation, not a general network latency benchmark. Existing demo authentication was used; no new demo or customer record was created. Safe aggregate proof is browser-speed-checkpoint-72.json; credentials and financial screenshots are excluded.
