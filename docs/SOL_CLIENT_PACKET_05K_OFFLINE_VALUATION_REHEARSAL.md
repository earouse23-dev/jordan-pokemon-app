# CLIENT-05K — Offline rehearsal of one valuation experiment

Date: 2026-09-25. Sole active Astra packet. Offline harness/test work only. No authorization to run a live experiment.

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before task work, reuse existing implementation first and choose the smallest correct change. Report if unavailable. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both Mica roadmaps, the 05J report and `docs/evidence/ASTRA_CLIENT_PACKET_05J_REVIEW.md`. Reuse `scripts/client-05b-guard.mjs`, `scripts/client-05d-transient.mjs` and their tests as appropriate; do not execute any entry point that loads environment files or enables network transport. Keep the old completed Pikachu experiment and evidence unchanged.

## Outcome

Prepare one runnable, **offline-only** rehearsal of the proposed Clefable experiment. This removes avoidable request/mapping/calculation mistakes before any separately authorized use of provider credits. Do not create a general experiment framework or a production alias system.

## Scope and acceptance

1. Freeze the 05J candidate and synthetic response fixtures: source English Jungle Clefable 1/64, detailed first-edition holo ID `3a83wf50ts0izj268xwv3crwi`, candidate provider ID 20618, proposed provider-facing name `Clefable (1)` / number `01/64`, PSA 10, empty qualifier, USD. Distinguish public observed facts from synthetic API responses and experimental grade assumptions.
2. Use injected fake transport only; any real outbound call must fail. Adapt/reuse the existing request guard with one direct-card request followed conditionally by one sold request, maximum two simulated requests/eleven simulated reserved credits. Test pre-transport rejection of wrong ID/host, redirects, search fallback, retry, pagination, third request and sample substitution. No secrets, env loading, executable live mode or automatic activation.
3. Define and test the direct-response identity gate before sale retrieval. Reject conflicting or unresolved required name/set/number/total/language/printing facts; document what is established by each source, and where missing provider fields leave uncertainty. Candidate-specific display formatting is not an approved general equivalence. Ensure the same reviewed context travels through the actual sales API/adapter and estimator without mutating TCGdex source facts or inventing API fields.
4. Rehearse a positive synthetic sample and sparse/invalid samples through the unchanged production sales path. Check first-edition versus unlimited/non-holo, wrong card/number/set, grade/qualifier, language/currency, shared attribution, duplicate/conflicting transactions, dates and outliers. Include realistic title spelling `Clefable` without the provider's `(1)` display suffix so the proposed lookup cannot silently exclude valid title forms. If the unchanged production path cannot express the mapping consistently, retain the failing case and report it; do not patch application matching in this packet.
5. Independently reconstruct included/excluded rows, deduplication, outliers, median/range/count and freshness from synthetic raw rows with a fixed clock. Do not call production selection/calculation helpers for the independent result. Match the actual existing policy precisely, including the deviation threshold when MAD is zero; never alter policy to force agreement. Freeze expected answers before running. Sparse results must remain unavailable.
6. Prepare a minimal evidence format showing which fields a future permitted private ledger would require. Use synthetic values only, with no live storage feature. Clearly separate private reproducibility permission from production display permission. If clarification remains absent, list it as an external prerequisite; do not claim this rehearsal resolves it or authorize another transient live run as a substitute.

## Deliverable and limits

Write `docs/evidence/SOL_CLIENT_PACKET_05K_REPORT.md` with runnable offline command, hashes, exact synthetic expectations/results, request-guard checks, mapping limitations, independent calculation agreement and remaining external prerequisites. Retain the smallest useful harness/tests. Run focused tests, syntax/format/diff checks; no unrelated full browser suite. Application source, schema, provider matching, valuation rules and existing completed experiment files remain unchanged.

Zero live provider/public catalog requests, zero real reserved/spent credits, no `.env` access, provider messages, database work, new dependencies, hosted changes, deployment, commit or CLIENT-06. Preserve the dirty worktree. Stop for Astra review. If ready, the report should make the later authorization concrete; it does not supply that authorization itself.
