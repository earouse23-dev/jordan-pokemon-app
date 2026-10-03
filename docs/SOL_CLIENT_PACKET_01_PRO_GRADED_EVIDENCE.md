# Sol CLIENT-01 — Pro readiness and exact graded evidence

## Task

Implement one narrow data-readiness slice for the client's graded-Pokémon beta: verify PkmnPrices Pro access and prove that the existing application path returns exact graded sold evidence truthfully. This is roadmap Step 1 only, not the whole pivot.

## Read first

1. `AGENTS.md` and `docs/MICA_SOFTWARE_ROADMAP.md`.
2. `docs/MICA_CLIENT_PIVOT_2026-09-17.md` (current priorities).
3. `docs/MICA_PKMNPRICES_PRO_REVIEW_2026-09-17.md`.
4. Latest Packet 01 acceptance, Packet 02 review/revision/report, current provider adapter and affected tests.

Preserve all dirty work. Astra is orchestrator; you choose implementation details within this packet. Do not infer production readiness from earlier local passes.

## Required

- First rerun the focused Packet 02 owner-isolation/session-initializer regressions and report them separately. Do not rework its accepted layout. Its final Astra review remains pending.
- Inspect private key/plan availability without printing values. Astra's local production-file key was rejected; default `.env` had none. Stop live probing on authentication failure and request private credential configuration, not a key in chat. Do not change hosted environment settings.
- Improve the bounded verification harness: missing numeric headers remain unknown, stop on invalid credentials, distinguish entitlement/HTTP success from nonempty exact sold coverage, and report requested maximum versus observed charges. Keep keys/payload-sensitive fields out of reports.
- Maximum 40 returned-item credits for this packet's live probe, including pagination/retries; track upper bounds before requests. Cache results. No background refresh, broad catalog harvest or automatic retry storms. If this budget cannot establish coverage, report unknown rather than exceed it.
- With working access, sample PSA and BGS across EN/JA/DE using explicit printing IDs and at least one half-grade/label-sensitive case if available. Select known catalog matches, not guessed IDs. Report card ID, language, grader/grade/qualifier, request time, result count, exact eligible count, currency and newest sold date. Mark unsupported/empty cells explicitly. This is sampled coverage, not a claim about all cards.
- Demonstrate at least one real exact graded sold-evidence result through the existing app API/normalizer, not just a direct provider request. Keep credentials server-side. If no eligible evidence is available, demonstrate the truthful unavailable state and report the live acceptance gate blocked.
- Verify provider row currencies, grade strings/half-grades, qualifiers, attribution, source link and sold-versus-ingested timestamps survive normalization. Shared/unknown evidence, wrong language/variant/grader/grade and raw evidence cannot support an exact slab estimate.
- Confirm aggregate history/active offers cannot contribute sale volume or completed-sale confidence. Trace the legacy `sale_count` field and remove misleading use narrowly, without deleting historical user data.
- Retain sanitized real-response fixtures only to the extent permitted, keeping provenance and capture time. Label constructed fixtures synthetic. Never label provider-reported sales independently verified.

## Do not build

No new market-value algorithm, FX provider, portfolio graph, navigation redesign, scan overhaul, certificate scraper, iOS framework, schema migration, new provider/dependency, paid service, deployment, billing or CLIENT-02 implementation. Sealed access may be documented but does not need more quota spent for this graded beta. Do not delete legacy raw/sealed inventory or pregrading.

## Acceptance criteria

1. Valid Pro access is evidenced independently of the local plan label; a rejected key or 403 cannot appear as ready.
2. Coverage matrix separates advertised, endpoint-accessible, nonempty, exact-eligible and application-normalized results.
3. At least one real exact graded case passes end to end through existing data plumbing, or the gate is explicitly BLOCKED rather than mock-accepted.
4. Regression fixtures cover wrong language/variant/grader/grade/qualifier, half-grades, shared attribution, mixed USD/EUR rows, no raw fallback, no snapshot sale-volume support, empty response, auth/rate failures and pagination budget.
5. Sparse data yields unavailable/limited evidence, not an invented price. Existing Packet 01 separation and Packet 02 owner boundaries remain intact.
6. Relevant unit/API tests, lint/typecheck and diff checks pass. Run browser cases only for affected behavior; do not spend the review budget rerunning unrelated suites or capturing unchanged screens.

## Return and stop

Write `docs/evidence/SOL_CLIENT_PACKET_01_REPORT.md` with files changed, checks/results, credential/plan status (no secrets), sanitized request/coverage ledger, credit ceiling/usage, existing-app real-case evidence, limitations, and exact decisions needed. Attach screenshots only if user-facing behavior changed. Separate mock, live-provider, live-persistence and physical-device claims. Do not repeat the entire old audit.

If credentials block live work, complete the safe harness/regression work and identify the minimal private setup needed. Do not mark the overall gate accepted. Stop for Astra's ACCEPT, REVISE or BLOCKED decision. Do not begin the next roadmap step.
