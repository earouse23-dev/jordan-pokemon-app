# Client pricing and compact interface correction — October 7, 2026

Live app: https://jordan-pokemon-app.vercel.app. Final deployment: dpl_5GdUqK6HMHSzxAVPAc9N7dZmfq66. Product commits: bd57121b89afecb1690e45018989b313d74b79be and a7dea6e (full remote evidence accompanies publication). Checkpoints 68 and 69 were verified intermediate releases; their archives and evidence remain intact. Supabase activation was not rerun.

## Root fixes and intentional changes

Legacy collection loading replaced an explicitly saved Holofoil/holo label with unknown finish. The shared position and watchlist hydrators now use the existing canonical finish parser when the explicit finish field is absent. Explicit unknown values remain unknown. No records, editions, stamps, qualifiers, quantities or costs were automatically changed. This restores selection of returned raw quotes across collection, detail and portfolio.

Collection requests now batch two identities using the existing bounded API contract. Thirteen entries require seven requests rather than thirteen; the existing per-IP, account-wide rate and 20,000-credit daily budget guards remain. Short client/server sold-evidence deadlines were inconsistent with the durable provider queue. Read and durable valuation server deadlines are 45 seconds; clients allow 55 seconds and still expose a bounded retry with the same context.

The provider catalog adds art annotations to printed card names. The shared matcher accepts only the known Full Art/Alternate Full Art/Secret annotations when set, printed number and total all match; language and unique-candidate checks remain. Explicit contradictory names, different numbers/totals/sets/languages, edition labels and ambiguous identities still fail. This restores Giratina history through PkmnPrices instead of relying on the current-price fallback. Official public reference: https://www.pkmnprices.com/catalog/cards/16577.

The portfolio tooltip contains a large green value and a short gray date. Existing coverage facts remain in the caption and accessible details. The chart remains a solid flowing trace with one moving leading dot that disappears on completion. Collection remains visible below it. A native Avenir/system sans-serif stack replaces the old display font; card spacing and grading history are compact. Price details, comparison and attachments are removed from the primary layout and retained behind More options so saved evidence and required secondary capabilities remain accessible.

The intake camera uses the full viewport without the decorative scan line or numeric pseudo-progress. Status appears only when a real card frame is detected. A stable valid frame delivers the corrected image once, closes the camera and stops streams without an extra Use photo step. Manual capture/library fallback and correction remain. Identification and inventory saving are still distinct; no unconfirmed card is automatically saved.

## Verification and limits

538 unit tests pass, zero failures, three existing skips. Affected desktop Chromium/mobile Chromium/mobile WebKit suites: 187 passes, two skips. Additional desktop copy/account tests: 54 passes and one skip; a navigation-context failure passed unchanged on desktop and WebKit rerun. Two focused mobile layout/tooltip checks and four bounded deadline/retry checks pass. Focused regressions cover legacy finish hydration, all thirteen raw entries through seven bounded requests, source matching exclusions, secondary attachment access, automatic single capture/stream cleanup and exact value/date tooltip format. No assertion was removed to obtain a pass.

Actual customer UI reads confirm every raw entry has its position value; the portfolio displays the sum for priced holdings and explicitly excludes five graded copies with incomplete printing facts. Charizard detail shows current price and 104 dated history days. Private amounts, screenshots and record identifiers remain outside Git. Actual authenticated isolated-demo browser checks confirm raw current price, 101 history rows, PSA10 completed-sale value and nine sale dates, both purchase-performance displays, EUR conversion and dashboard value/visible collection, with no uncaught browser error. The two proof entries were created in an earlier authorized checkpoint; none were added in this task.

Real Pro endpoint evidence: all eight requested public raw card identities have matching quotes; known Mew PSA10 has ten accepted completed sales and USD220.23 estimate. Final staged Giratina proof returns provider16577, USD847.55 and 104 history rows. These are bounded samples, not guarantees of recent sales or daily history for every grade/card. Full licensed payloads and credentials are excluded.

Failed probes were traced: simultaneous verification and collection reads hit the existing request limit; a cold FX response was temporarily unavailable; the old browser harness incorrectly asserted complete history as soon as the initial one-price table appeared. The final harness waits for the completed history and retains its 101-row and graded assertions. No freshness, currency, printing or budget guard was weakened.

## Artifact and publication evidence

Two clean curated builds reproduce the frozen source overlay over unchanged ACTIVATION-04 provenance. Ninety source entries, forty-nine outputs, nine functions within the observed twelve-function limit. Final hashes:

- Deployment ZIP: b3fdc30fd3fe58ac9e5140303cc5bd2987078f0c81a5c0b3ecbc484facefa2a6
- Source ZIP: 6a8ff652d1362747ba485664060c0f08b9b417292e78e2d81f9e67a44d3587db
- Exact manifest: e0cc522c11f290ed9180ce2f9b8526b0f8ff7517543e66e00e6498773a333915
- Public configuration asset: 65b310fcb5dd0692eddd945de91ca439995bce48a040cccd1afa4bf8602e745f

Current delta from checkpoint67: app.js, themes.css, lib/supabase-data.js, api/sales.js, api/graded-valuation.js and lib/providers/pkmnprices.js. Source/configuration provenance, provider holds and deletion-only routing remain. No dependency, platform or subscription change. Routing/count and certificate-fixture exclusion checks pass; the 139-entry artifact scan has zero credential/private-demo findings. Historical archives remain local; only safe selected source/tests/manifests/aggregate evidence are published.

Each candidate was uploaded once, verified READY and checked through protected routes before promotion. Exact live assets, canonical alias, health/capabilities, held503/no-store, active authentication401, CORS204/hostile403, unknown404 and deletion401 are checked. The sole production cron remains /api/capabilities?surface=grading-deletion at 15 5 * * *. Git ignored-build exit0 and source deploymentEnabled:false remain, and existing workflows do not deploy this release. Final remote/alias proof follows the push. Intermediate runtime error-level samples contain only existing DEP0169 deprecation warnings; final sample records warnings separately from application exceptions.

The aggregate items/transactions/attachments counts and digests match the pre-change baseline (19/23/2). Customer inventory was not edited; no SQL replay or automatic production restore occurred. Ordinary authenticated app reads may record valuation history through existing behavior and are not represented as a database-wide no-write claim.

## Remaining gates

Five saved graded copies need factual edition/stamp/qualifier confirmation through the existing audited owner correction UI. The graded pricing engine works for confirmed identities; guessing those missing facts would produce misleading values. Awaiting Elliott's answer, preserve them unchanged.

Automatic image capture is implemented and checked locally. AI card-name recognition/pregrading/advisor calls remain held pending an explicit separate allowance; PkmnPrices Pro covers pricing, not photo recognition. The pending request is at most twenty recognition checks, capped at USD1 on the existing provider, without a top-up or subscription. Elliott performs physical iPhone Safari camera/library and reset-link/new-password acceptance. No native signing, App Store or subscription acceptance is claimed. This report does not declare all beta requirements operational.
