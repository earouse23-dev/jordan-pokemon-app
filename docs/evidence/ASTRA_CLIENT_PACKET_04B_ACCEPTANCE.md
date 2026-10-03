# Astra CLIENT-04B revision — ACCEPT locally

Date: 2026-09-24. **R1–R3 closed for the internal fixture workflow and shipping exclusion slice.** This supersedes the REVISE disposition in `ASTRA_CLIENT_PACKET_04B_REVIEW.md`, which remains historical evidence. It does not certify a live certificate service, durable observation persistence or a release.

## Independent checks

- Read the revised internal implementation, fixture comparison, application save hook, relevant new browser assertions and updated report. The existing form is detached/restored rather than reconstructed; its original options/closures and current inputs are retained. Conflicts no longer expose active attachment; selected unresolved records are stored separately. Snapshot details use a copy-keyed memory map.
- `node --test tests/certificate-workflows.test.js`: **3 passed**, zero failed/skipped.
- `node scripts/verify-certificate-exclusion.mjs`: **passed**, 25 existing shipping files inspected. The default shipping build's deferred-feature exclusion was previously inspected; no deployed artifact was checked.
- `node scripts/build.mjs --internal-certificates`: passed. Ran **16 focused browser checks, all passed**, against that freshly built artifact: eight scenarios each in Chromium and WebKit at 390×844. These cover populated draft correction/save, unknown acquisition flags/EUR/queue callbacks, active-association preservation, holofoil distinction, BGS qualifier conflict, cross-grader offline observation/sibling isolation, duplicate actual grader/cert pairs and partial-record reopen. The cross-grader case also repeats unresolved selection and asserts one details action.
- Browser execution used a temporary copy of the repository spec with absolute imports, a temporary screenshot destination and local built-asset request routing. External requests were blocked; no server/provider/database was started. Original behavioral assertions remained unchanged. This is desktop browser-engine execution at a narrow viewport, not a physical iPhone or exact repository mobile emulation.
- Harness: `/var/folders/2_/v5kbdt0j0p3131zbc3c78mwm0000gn/T/mica-04b-review-o1eem29k/`. Command: `MICA_INTERNAL_CERTIFICATES=1 node node_modules/@playwright/test/cli.js test --config <harness>/config.mjs --grep 'populated draft|unknown purchase|cross-grader|existing copy retains|duplicate uses|partial normalized|normal holofoil|conflicting BGS'`.
- Scoped `git diff --check -- app.js scripts/build.mjs scripts/serve.mjs`: passed.

The original Astra diagnostic intentionally targets the removed unsafe Continue action; it is not a valid passing test for the revised conflict flow. The focused replacement cases above independently establish the intended behavior. Original review/probe artifacts were not rewritten.

Sol's full 69-case internal suite, additional focused runs, complete shipping/core regressions, 424-unit-test total, lint/typecheck/build/format results remain reported evidence; Astra did not repeat those whole suites or the guarded database test.

## Closure

| Finding | Decision |
| --- | --- |
| R1: lost draft and missed live conflicts | Closed locally. Original form/state is retained; populated cost/date/grade/qualifier/printing survive lookup/retry/back. Current draft facts drive comparison; accepted matching data fills blanks. Queue callback, unknown fields and EUR preservation have passing artifact-level evidence. |
| R2: contradictory active cert | Closed locally. Conflicting grader/printing/language/grade facts become an explicitly unresolved observation or return to correction. Active PSA association and history remain unchanged by the BGS sample. Matching attachment rechecks facts and actual grader/cert duplicate identity. |
| R3: record lost on reopen | Closed for session-local internal behavior. A normalized copy-keyed snapshot retains record/source/time, optional fields, population and disposition, and reopens offline without lookup. Siblings remain isolated; fixture/user provenance stays explicit. |

## Remaining boundaries

This acceptance is deliberately limited to internal fixture workflows. Observations and fixture saves are in memory only and disappear on reload. Real provider schema/access, coverage, image/data rights, server normalization, durable observation storage, bounded live validation and an approved release remain later gates. No provider subscription is required to retain or continue testing the completed internal screens. The initial shipping scope may still omit these features under Elliott's phased-release decision.

The next planned Step 4 activity is an offline scanner benchmark using permitted real slab images from the internet, under its own bounded Astra packet. It can measure detection/cropping and recovery, not paid recognition accuracy or physical slab reflections. No CLIENT-05, platform change, paid service, hosted mutation or deployment is authorized by this acceptance.

Reviewed SHA-256 snapshot:

```text
5b294469f979e23d08101a6be4508a036dbe9453b2f76db06df1fc950b096aae  app.js
3ec31b1068f98d6e02e790600c84312ee1078a1e4a36f1bf826898d63387b32d  internal/certificates.js
6e136a82c7d674cb25a1e8474d2309eb95a6f5dee621fae9d341dae1dc1f9c6c  tests/browser/certificate-workflows.spec.js
```
