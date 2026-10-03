# Astra CLIENT-04B review — REVISE

Date: 2026-09-24. Build exclusion is supported by the inspected evidence, but complete internal workflows are not yet accepted. Paid access, real provider integration and real persistence remain deferred; none is required to fix these local defects.

## Independent checks

- Read Sol's report, the full internal UI/fixture modules, application integration, build/serve changes, exclusion scanner and both browser specs. Inspected `internal-conflict.png`.
- `node --test tests/certificate-workflows.test.js`: **2 passed**, zero failed/skipped.
- `node scripts/verify-certificate-exclusion.mjs`: **passed**, 25 existing shipping files scanned. Inspected compile-time import elimination and separate internal output with neutral configuration. Did not inspect a deployed artifact.
- `node scripts/build.mjs --internal-certificates`: passed. Reproduced R1 and R2 in Chromium against that freshly built artifact, using local file routing and blocked external requests. Runnable probe: `node docs/evidence/sol-client-04b/astra-review-probe.mjs`. It prints diagnostic outcomes, not an acceptance-suite verdict.
- Scoped `git diff --check -- app.js scripts/build.mjs scripts/serve.mjs`: passed.
- Full browser/unit/lint/typecheck/format results remain Sol-reported. Did not repeat all suites or a real database run. No application code was edited during review.

## R1 — Lookup loses the active draft and misses its conflicts (high)

`internal/certificates.js:315`, `internal/certificates.js:180`, `internal/certificates.js:273`; `app.js:9014`.

The Add-card entry passes only the original catalog card. Lookup compares against that object rather than the current form, then recreates the form with only certificate-related prefill. Acquisition fields, user edits, original options/queue context and the original retry identity are not carried through.

Built-artifact reproduction:

```text
Before: total paid 87.65; acquisition date 2026-09-01; PSA grade 9
Lookup: PSA 00012345, grade 10
Comparison: "Matches the available current card facts."
After Continue: total paid empty; date empty; grade 10
```

Preserve the existing owner-bound draft across lookup, cancel/back, failure/retry and accepted result. Compare against the user's current values. Apply only explicitly accepted enrichment fields; retain variant, acquisition facts/unknown flags, currency, callbacks/queue context and idempotency key. Do not recreate a second ingestion model. Test actual entered values, not only an empty form.

## R2 — Conflict acknowledgment creates a contradictory certificate identity (high)

`internal/certificates.js:114–130`.

`attachExisting` checks duplicates against the lookup record's grader, then writes only its certificate string to the copy. The copy's grader and printing remain unchanged. Built-artifact reproduction: lookup BGS `00054321` (Japanese set, grade 9.5), accept the conflict on an English PSA 9 copy. The saved object still says `gradingCompany: PSA`, `language: en`, `grade: 9`, but now contains BGS certificate `00054321`. Reopening lookup defaults to PSA for that BGS cert; the conflict/source association is lost.

A checkbox must not make incompatible certificate facts a coherent attachment. Retaining current printing/grade is correct, but in that branch retain the existing active certificate association too. Permit returning to correct/select the matching item or keep the lookup as an explicitly unresolved observation, separate from the active cert. Only activate a matching association or an explicitly reviewed coherent correction through existing identity mechanisms. Do not silently rewrite canonical printing/history to make it fit. Duplicate checks must use the grader/certificate pair actually being stored. Test both new-copy and existing-copy cases, including cross-language/printing, grader, grade/qualifier and leading zeros.

## R3 — Attachment does not retain a reopenable record (medium)

`attachExisting` and `saveNew` retain certificate strings, user claim provenance and `internalCertificateSample:true`, but no selected normalized record/observation. Observed source/time, identity, subgrades, permitted sample image, population and unresolved differences disappear with the lookup sheet. Current reopen coverage checks only `.copy-row` certificate text. The user asked for complete workflows now so paid activation will not require rebuilding them.

Retain an isolated normalized fixture observation associated with the correct copy and provide a details/reopen action that renders it, with fixture labeling, source/as-of and missing states. Retained facts must not become official provenance or mutate financial history. Demonstrate reopen after navigating away and with the lookup adapter unavailable, without issuing a fresh lookup to reconstruct the attachment. In-memory session storage remains acceptable for this packet; do not add hosted or real database persistence just to close this finding. Report reload persistence as still deferred.

## Required revision gate

Implement `docs/SOL_CLIENT_PACKET_04B_REVISION.md`. Prove the corrected workflows against the internal artifact, retain shipping exclusions and core behavior, update the report, then stop for Astra review. Do not infer live integration readiness from these tests or proceed to CLIENT-05.
