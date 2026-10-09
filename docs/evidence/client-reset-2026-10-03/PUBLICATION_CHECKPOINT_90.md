# Checkpoint90 — atomic portfolio value and history

Portfolio pricing formerly rendered after each raw batch and graded group; each render rebuilt the chart and restarted its trace. History required exact-day records and connected incomplete subtotals, producing misleading low historical values. A second home renderer overwrote restored totals/labels.

The dashboard now restores the last complete saved checkpoint, refreshes all owned contexts in a shared background batch, and publishes one computed result. Fresh 15-minute history is reused; returning to a stale web session uses the same refresh. Detail callers await the shared refresh. Failed lookups preserve previously validated prices within existing freshness rules; edits/additions/deletions made during refresh are preserved. Reloaded saved positions keep validated same-identity/context pricing. Complete aggregates alone replace the checkpoint. Large accounts retain the existing 500-position paging boundary and whole-account reporting safeguard.

History follows dated lots, quantities and sales, with daily points and only earlier observations carried within the existing raw96h / validated exact-sold90day limits. Unknown membership or missing prices leave gaps; future prices never backfill old dates. Portfolio value completeness is separate from cost completeness/P&L. Native amounts and coverage remain in optional details. Aggregate checkpoints include validated exact-sold graded values but are never per-card evidence. Existing customer records and historical unknown facts were not rewritten.

The large green total leads above the existing solid green investment-style chart. All time remains default; P/L is separate and the collection remains visible below. Unchanged chart data retains its canvas; the trace runs once per account opening. Visual review caught an invalid color variable and the competing label writer before promotion; both corrected.

## Verification

547 unit passes/3 skips; 9 portfolio workflow checks across desktop/mobile Chromium and mobile WebKit; 93 previously affected card-profile passes reused. Lint98 sources and syntax pass. Focused coverage includes delayed batches/single publication, concurrent request sharing/foreground event, retained failed values, fresh reuse, stable chart, green color/total label, past-only bounded carry, quantities/unknown membership/cost, currency conversion, and exact graded evidence exclusions. Historical assertion changes reflect the approved bounded past carry and full-total gaps; no privacy/identity checks removed.

Compiled final candidate with shipping CSP and real demo authentication plus a synthetic two-copy inventory used the real staged API: current total equals twice the matching quote; full history loaded; old checkpoint visible until batch completion; one request; stable canvas/value; no fresh foreground refetch or uncaught errors. Staged provider request took 9081ms. Canonical check took 1412ms; physical device, actual full customer inventory, and save acceptance are not established by these read-only checks. Browser writes were blocked. Some bootstrap attempts returned401 on an unrelated secondary collection_goals read before pricing; cause remains unestablished, final staged/live acceptance results are reported separately. No universal availability or five-second promise.

Curated frozen-release overlay changes only app.js, lib/portfolio.js, themes.css and sw.js; two builds identical. Nine functions, 65 output /96 source entries; 161 entries scanned with zero private findings. Failed intermediate candidates remain preserved locally. No SQL, customer writes, new dependencies/budgets/provider implementations or paid jobs. Existing grade/advisor/match/sealed-AI holds and sole deletion cron remain.

## Published artifact

- Deployment ZIP: `7be9a32e1b390b5e1b06c067bd88c1b24491c65382ddde689173f7cc222a452a`
- Source ZIP: `9d59b3574a05af8b65ae8d48a2ef7b016f3c8e1d5cf2f56df19829be67cdd2a7`
- Manifest: `a857d1a34abe18a4250f7525dc348e58733e63da44f1480185b5ab5ae9a42984`
- Public configuration: `65b310fcb5dd0692eddd945de91ca439995bce48a040cccd1afa4bf8602e745f`
- READY deployment: `dpl_GEyTv64piFssSPg2iaqkUDCXGE1n`
- Live: https://jordan-pokemon-app.vercel.app

The previous canonical89 alias/cron state was rechecked before promotion. Staged and live configuration, holds, CORS/hostile-origin rejection, unknown-path404 and authenticated deletion boundary checks pass. Git deployment suppression and hosted ignored-build exit0 protect the prebuilt release; deletion schedule remains15 5 * * * at /api/capabilities?surface=grading-deletion. Remote commit/final post-push state recorded next.

## Remote publication

Source/tests published as [ca076ab](https://github.com/earouse23-dev/jordan-pokemon-app/commit/ca076aba52c57fdb9263b0acfa1a32fb2fc46393); remote branch hash verified. Post-push canonical deployment/asset hashes, Git guards and deletion-only cron still match. Final runtime inventory contains two cards200 and no cards failure; three error-level entries are the existing Node URL-parser deprecation on health/auth-related or successful requests, not an observed pricing failure. Expected holds503 and auth/CORS denial statuses are included in the sanitized runtime summary.
