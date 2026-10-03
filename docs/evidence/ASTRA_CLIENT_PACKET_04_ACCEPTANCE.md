# Astra CLIENT-04 revision review — ACCEPT locally

Date: 2026-09-24. **R1–R4 closed for the authorized local software slice.** This supersedes the local REVISE decision in `ASTRA_CLIENT_PACKET_04_REVIEW.md`; retain that document as the original findings. It does not complete all of roadmap Step 4, establish real-world accuracy, authorize deployment or start CLIENT-05.

## Independent evidence

- Read the revised Sol report and inspected capture/review epochs, stream ownership/cancellation, manual shutter gating, editable source overlay, source-bound recomputation, perspective/centering abstention and uploaded-image dimensions. Reviewed the new behavioral tests and inspected `sol-client-04/desktop-chromium-adjusted-corners.png`.
- `node --test tests/capture-precision.test.js tests/grading-capture.test.js`: **21 passed, zero failed/skipped**.
- `node docs/evidence/sol-client-04/astra-review-probe.mjs`: original three diagnostics now show `reviewVisible:true`, `shutterDisabled:false`, and edited corner x `0.083857` contained by source bounds starting at `0.058857`. The probe was unchanged from the first Astra review.
- Independently exercised all **15 document-capture WebKit cases** at a 390×844 viewport using a temporary copy of the existing spec with local assets served through request interception, external hosts blocked, and no dev server. Twelve passed on the first run. Three initial failures were review-harness defects: blob image requests were incorrectly intercepted, and the standalone stream diagnostic had no routed document. After allowing local blob/data requests and supplying the diagnostic document, those three passed on a targeted rerun. No application edits were made. The stream diagnostic returned `supported:true`, `readyState:4`, `width:320`. These are synthetic desktop WebKit checks at a narrow viewport, not a real iPhone or the exact repository mobile-device configuration.
- Temporary harness: `/var/folders/2_/v5kbdt0j0p3131zbc3c78mwm0000gn/T/mica-review-kjzitj02/`. Commands: `node node_modules/@playwright/test/cli.js test --config <harness>/config.mjs`, then the same command with `--grep 'automatic session keeps manual|manual corners expand|WebKit local'`. Only imports/resource paths, screenshot destination and local asset routing were adapted; behavioral assertions and application bundle logic were retained.
- `git diff --check -- app.js lib/capture-precision.js styles.css tests/capture-precision.test.js`: passed.

Sol reports the original three-project document suite at 43 passed/2 diagnostic skips, related browser suite at 27 passed/1 skip, unit suite at 421 passed/1 guarded database skip, and lint/typecheck/build/format checks passing. I did not independently rerun those entire suites or CLIENT-03's database proof. Their reported scope remains distinct from the checks above.

## Closure decisions

| Finding | Decision and basis |
| --- | --- |
| R1: pending retake lock | Closed locally. Retake/restart invalidate prior work and reset the capture lock; manual/automatic replacement capture tests verify delivery and stale completion rejection. Late camera streams are stopped. |
| R2: missing manual recovery | Closed locally. Manual shutter remains available while automatic capture retains its sequence gate. Failed detection requires correction/review, and inventory still requires explicit save. |
| R3: stale source bounds/provenance | Closed locally. Applied corners define a protective original-image envelope, manual adjustments clear automatic confidence/perspective claims, and unverified centering abstains. Consumer tests decode the actual research blob and find the marker outside the old bounds; uploaded dimensions match the decoded evidence. Source overlay and selected corner are visible. |
| R4: local behavior coverage | Closed for the scoped synthetic checks. Switching/late-close, visibility pause/resume, full-card/detail processing and real recognition-request construction have assertions. WebKit live stream paths execute. Stubbed provider responses do not establish recognition accuracy or real certificate enrichment. |

Minor report cleanup: the older caller-map rows still say supplemental direct live cases are pending; the newer R4 section supersedes that statement for synthetic local camera/consumer coverage. The real supplemental provider/report-update and physical-device experience remain unproven. This wording inconsistency does not reopen the implementation packet.

## Remaining gates and next action

Physical iPhone capture/lifecycle/accessibility, consented real PSA/BGS images across EN/JA/DE, live-recognition accuracy and authorized official certificate records remain open. No claim of improved grading or recognition accuracy follows from this acceptance. Existing CLIENT-03 real local persistence proof is reused only for the unchanged save route; the full camera-to-real-database path has not been replayed here.

The revised benchmark's per-cohort/joint-field metrics, explicit abstentions and repeated-attempt accounting are suitable as a proposed protocol. Before execution, finalize consented samples, objective stable-frame timing and the physical-device matrix; obtain any required bounded live-recognition budget. No provider calls, new dependencies, native platform implementation or release is authorized here.

Stop implementation at the current review gate. Next is arranging the real-device/real-image validation inputs and outstanding official-access evidence, not starting CLIENT-05. Any independent next software slice requires a new Astra packet under the roadmap's scheduling rules.

## Reviewed snapshot

SHA-256:

```text
f8c77093dc138065c979045ae462c7da5b70b257c32c0b6fc2cb84daa772a464  app.js
5835a48aef55b0718bb50b0314c3f7526e75893836e3a9557364dce72fcf3522  lib/capture-precision.js
776c60241c825a53f1d324116002a189ad0ea14f6c79d94443d73cea7c182e25  tests/browser/document-capture.spec.js
```
