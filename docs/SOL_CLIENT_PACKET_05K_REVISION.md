# CLIENT-05K revision — Corroborated catalog suffix and harness compatibility

2026-09-25. Sole active Astra packet. Fix the two observed offline issues, then stop for review. This explicitly authorizes the narrow application/harness changes below, superseding 05K's read-only application boundary for these fixes only.

Provider clarification received during Astra review: read `docs/evidence/PKMNPRICES_RETENTION_CONFIRMATION_2026-09-25.md`. The private audit-ledger retention prerequisite is now satisfied on Elliott's supplied provider reply. Update the report accordingly; do not report that specific permission as still missing. Broader release-display scope remains separately recorded. This changes no request budget: this revision remains entirely offline.

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before task work. Reuse existing implementation first and choose the smallest correct change. Report if unavailable. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both Mica roadmaps, the 05J mapping decision, 05K report/test and `docs/evidence/ASTRA_CLIENT_PACKET_05K_REVIEW.md`. Trace callers of `saleMatchesCanonicalIdentity`, direct provider matching and the actual API→adapter→estimator flow before editing. Preserve all dirty work.

## R1 — Stop requiring a redundant number as a card-name word

Preserve the existing bare-title reproduction before fixing it. The current provider-facing lookup `Clefable (1)` rejects `Clefable Jungle 01/64 1st Edition Holofoil PSA 10`, despite independent collector-number evidence.

Implement the smallest provider-scoped sale-name comparison that may disregard **one terminal purely numeric parenthetical suffix** only when it is corroborated by the independently checked collector numbers of the direct provider card and requested context. Require the title's normal identity anchors and existing number/total checks; do not let the suffix supply a missing number anchor or override a conflict. If corroboration is missing/ambiguous, remain conservative. Keep original names, IDs, lookup context, titles and evidence unchanged; this is comparison logic, not rewriting stored facts.

Do not globally strip parentheses, numbers or qualifiers. Non-numeric suffixes and meaningful card-name tokens such as V, VMAX, ex, LV.X, regional forms and embedded digits must keep their existing distinctions. A contradictory numeric suffix must never be treated as redundant. Preserve direct API identity checks; no generic direct-match relaxation, new production alias mapping or normalization of all catalog names is authorized. Reuse the existing collector-number logic only where its semantics are suitable, without expanding its accepted grammar in this packet.

Convert the known-failure test to the intended successful behavior only after recording the before result: three synthetic bare-name sales 100/120/140 produce three contributors and USD 120 through the actual API/adapter/estimator, agreeing with the independent raw-row calculation. Keep the original suffixed-title case passing. Add focused negative coverage for mismatched suffix/collector number, wrong fraction total, absent number evidence, nonnumeric/multiple parentheticals, different card/set, non-holo/unlimited, wrong grade/qualifier/language/currency and shared attribution. Tests should prove matching has not become a general name-substring shortcut. No formula, threshold, freshness or outlier policy change.

## R2 — Restore the older offline harness without rewriting history

The completed 05D harness currently searches `entry.label === 'holo'`. Select its expected TCGdex detailed option by stable source ID and verify its semantic finish/metadata instead of presentation wording. Preserve `sourceMatches`, source-drift rejection, unknown edition/promo and the harness-only diagnostic mapping. Do not change the real recorded 05D outcome, replay a provider request, fabricate exact Pikachu context or weaken its tests. A small repair to `scripts/client-05d-transient.mjs` and relevant regression coverage is authorized; leave historical evidence intact and record the new source hash separately.

## Verification and limits

Run 05B, 05D and 05K offline tests together; all must pass with injected fake transport and zero live requests. Run affected provider/identity/API/valuation tests, unit suite, lint, typecheck, build and shipping certificate exclusion. Include a focused existing-screen browser regression if the changed matching path is exercised there; do not change product UI to accommodate test fixtures. Record before/after outcomes, changed hashes and why the suffix rule cannot bypass printing checks in an appended revision section of `docs/evidence/SOL_CLIENT_PACKET_05K_REPORT.md`.

No environment-file access, live catalog/provider/FX requests, credits, provider contact, database work, schema/dependency changes, deployment, commit or CLIENT-06. No new experiment framework or live runner. Missing real provider fields and broader release-display scope remain unresolved even if every offline test passes; private ledger retention is cleared as recorded above. Stop for Astra review.
