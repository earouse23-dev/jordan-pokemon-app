# CLIENT-06B — Durable graded valuation, reuse first

2026-09-25. Sole active Astra packet within Elliott's approved CLIENT-06 scheduling exception. Complete the bounded path below, then stop for review. No new live-price or release authorization.

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before task work; reuse existing implementation first and choose the smallest correct change. Report if unavailable. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both roadmaps, the CLIENT-06 packet/revision/report and `docs/evidence/ASTRA_CLIENT_PACKET_06_REVISION_ACCEPTANCE.md`. Read the installed Supabase skill before database work and its required current documentation for features used. No third-party architecture or dependency changes.

## Concrete outcome

A saved graded copy with a server-validated exact-sold estimate can be reopened after a fresh login and retain correctly attributed dated valuation evidence. Current eligibility is reevaluated for freshness and exact context; past recorded valuations can support historical P/L without becoming current prices or inferred earlier history. Generic market indexes never enter this path. USD/EUR remain separate; ownership and evidence survive retry safely.

## First decision: prove the smallest storage path

Trace the final effective schema/constraints/grants across all migrations, not just the original table creation. Inspect `position_price_observations` including existing `quality`, canonical context and transparent-pricing provenance columns, owner read projections, aggregate snapshot writer, current sales handler and server auth patterns. Produce a concise field/constraint map for a server-validated exact-sold record. Determine whether current read adapters can use an owner-filtered existing projection instead of replacing a public RPC contract.

Do not assume a new table is necessary. Do not mislabel an estimate as an individual completed sale or shoehorn unsupported semantics into an existing type. Do not weaken RLS, allow clients to set “validated” metadata or alter legacy observations to look verified.

If existing schema can faithfully express the required contract, **implement the authenticated server write, owner read/hydration and existing-screen history integration locally in this packet**. Existing client/server dependencies and existing schema only. If a schema/constraint/RPC change is necessary, write the exact smallest proposed SQL in a clearly non-applied design artifact, plus compatibility and rollback/disable behavior. Do not put a speculative migration into the executable migrations directory or apply it. Finish independent contract/validation tests and report the precisely blocked write/read behavior for Astra review. Do not make a broad platform proposal.

## Trust and provenance contract

- Authenticate the requesting user and resolve the position from the database before provider work or writes. Bind owner, position and canonical printing/grade/qualifier/currency to that stored identity. Client-supplied price, evidence IDs, validated flag or owner ID must not create a trusted valuation. A service-role write must explicitly enforce that ownership; RLS alone does not protect a service-role client.
- Reuse the actual server adapter/estimator and frozen rule. Persist only a server-computed, context-validated result and its contributing evidence references, native amount/range/count, evaluation/retrieval times, newest sale/freshness, truncation and rule version. Preserve enough source facts for attribution/revalidation; no credentials or unrelated seller/buyer data. No fabricated verification from reference quotes.
- Prefer one explicit existing refresh action yielding the estimate and its durable write; avoid duplicate provider retrieval solely for persistence. No background polling, fan-out to the whole inventory, paid fetch on login, or automatic repeated retry. All provider transport in this packet is injected synthetic/offline. Production request budgeting and no-write-on-failed-validation must remain visible in code/tests.
- Retrying the same validated observation must not create duplicate valuation/history records. Different valid observations retain their own time/context; do not overwrite past facts or backfill holdings. Preserve old references and user transaction data.
- Identity/grade changes or account switching during an in-flight request must prevent a stale-context write or display. Recheck stored context at the persistence boundary, not just request start. Prove the behavior with a delayed response.
- On load, reconstruct the exact validated context and reject malformed/unsupported/stale-as-current evidence. Historical eligibility is tied to what was valid at its recorded evaluation time, not a manufactured current refresh timestamp. No index rows become exact just because their JSON resembles new fields; define and enforce the trusted producer/read contract.
- Aggregate portfolio snapshots must link to eligible per-position observations or remain explicitly limited. Never add in-memory graded amounts to a provenance-free total and call it durable proof. If safe aggregate linkage needs schema work, document that separately while completing feasible per-position persistence.

## Evidence required

Freeze a synthetic graded A/B/C scenario in USD and a separate EUR scenario before implementation. Use the existing estimator's qualifying synthetic sales, not direct insertion of a trusted final amount as the proof. Demonstrate authenticated server computation/write → actual disposable database → fresh owner login/read → current/history/P&L UI. Selling B preserves its past observations and realized result; A/C retain theirs. No fixture-seeded browser state can substitute for that durable chain.

Test forged browser amounts/provenance, unauthenticated and second-owner reads/writes, stale or changed context, insufficient/failed provider evidence, duplicate refresh, stale-current versus valid-historical observation, and legacy generic rows. Include explicit zero outbound requests and no writes when authorization fails. Retain the three Astra probes and original raw A/B/C regression.

Use the established separately owned disposable local Supabase harness on unused ports, existing migrations only, and generated disposable credentials kept private. Leave mica-dev and its data untouched; clean up only this run's resources. No production environment files. Browser checks on desktop Chromium/mobile Chromium/mobile WebKit must exercise fresh reload, native currencies and honest unavailable states. Label all evidence synthetic. If schema is blocked, report which tests are real database proof and which remain contract-only.

## Deliverable and verification

Write `docs/evidence/SOL_CLIENT_PACKET_06B_REPORT.md`: field/constraint reuse decision, trust-boundary flow, exact implemented changes or minimal non-applied SQL, hand-reconciled results, source hashes, enabled non-skipped database results, fresh-login browser proof and remaining boundary. Run affected unit/integration/browser checks, lint/typecheck, neutral no-env-file build and shipping exclusion as appropriate to implemented scope. Do not rerun unrelated suites repeatedly.

Private provider retention is permitted; production display/live-price gates remain unresolved and synthetic persistence cannot close them. No live provider/FX calls or credits, new dependencies, applied new migrations, hosted changes, provider messages, deployment, commit or CLIENT-07. Preserve the dirty worktree and existing records. Stop for Astra review.
