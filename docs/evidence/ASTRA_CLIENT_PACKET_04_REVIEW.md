# Astra CLIENT-04 review — REVISE

Date: 2026-09-24. Local acceptance withheld. Physical iPhone, consented real-image, live-recognition and official-provider gates remain open separately. No CLIENT-05 authorization.

## Independently checked

- Read Sol's report, document browser tests, shared camera lifecycle, detector/projective sampler, manual correction, recognition/evidence preparation and supplemental grading caller.
- Ran `node --test tests/capture-precision.test.js tests/grading-capture.test.js`: **20 passed, zero skipped/failed**.
- Inspected `mobile-chromium-live-corrected-preview.png`: synthetic label and card are present. This is not a physical camera or recognition accuracy benchmark.
- Ran `node docs/evidence/sol-client-04/astra-review-probe.mjs` (initially from `/tmp`). The probe bundles current application code without bootstrap, serves assets through Playwright request interception, blocks external hosts, and uses synthetic canvas video/images. No dev server, provider request or database is needed. It prints diagnostic outcomes, not a passing acceptance-suite verdict.
- Did not rerun Sol's full browser/unit/lint/build checks or CLIENT-03's local database. Those remain reported/prior evidence, not independently repeated results.

## Required corrections

### R1 — Retake leaves pending capture locked (high)

`app.js:10886`, `app.js:10893`, `app.js:11317`.

`showReview` sets `captureInFlight=true`. Retake increments `reviewVersion` but does not reset that lock. The old review's `finally` then correctly avoids changing a newer version, leaving the lock true. Every subsequent camera capture returns immediately.

Independent reproduction: delay image decoding, choose a saved image, retake while correction is pending, release decoding, then press the active manual shutter. Result: `reviewVisible:false`; guidance continues, no new review. Existing retake test verifies the old review stays hidden but never proves a second shot succeeds.

Reset/invalidate capture state as one operation. An old completion must neither block the replacement shot nor unlock or overwrite newer work. Extend the regression through successful recapture and delivery, with automatic and manual paths covered.

### R2 — Automatic mode has no manual shutter recovery (high)

`app.js:10942` and the monitor's `captureButton.disabled = automatic && !cameraReady`.

Independent reproduction with an ineligible synthetic live frame: `shutterDisabled:true`, guidance `Fit the full card inside the frame`. The click handler also rejects capture whenever automatic readiness is false. Users cannot recover from detector failure by taking a photo and correcting its corners, as the packet requires. Saved-photo fallback does not replace manual shutter recovery.

Keep automatic capture quality gates, but offer an accessible manual shot in the same session. It must still go through correction/review and existing downstream grading safeguards. No inventory write or unverified grade may result from bypassing auto readiness.

### R3 — Manual corners and grading evidence disagree (high)

`app.js:11294`, `app.js:12317`, `app.js:12359`.

Corner controls mutate only `manualGeometry.corners`. Bounds, straightness, confidence and related detector metadata are retained from the old geometry. Corrected recognition uses the new corners; `sourceEvidenceCanvas` crops with the stale bounds. Independent reproduction after moving the top-left corner left: delivered corner x = **0.083857**, source bounds x = **0.169643**. The source crop excludes a region the user explicitly included in the corrected preview.

Recompute a safe source-space envelope from applied corners and invalidate unproven geometry claims after manual correction. Preserve real source pixels and a protective margin. Manual correction cannot confer verified perspective/condition eligibility. Ensure uploaded images with unverified perspective abstain from deterministic centering where needed; the current card-purpose angle blocker only checks capture metadata, not uploaded detection. Add consumer-level evidence tests, not merely a metadata string assertion.

The adjustment UI also hides the live guide and shows the source image without drawing the editable corners. Provide a visible, aligned corner/edge selection on the source preview so recovery is usable; keep keyboard controls.

### R4 — Finish locally testable acceptance coverage (medium)

The report explicitly leaves camera switching, visibility interruption, direct supplemental full-card/detail interaction and live WebKit unverified. A source-string assertion that callers exist does not verify their behavior. Add targeted synthetic tests for those lifecycle/surface boundaries and actual processed recognition request payloads. The current document browser test replaces `onPhoto` with a prefilled collection sheet; it does not traverse the real recognition consumer. Mock provider responses and inspect requests; provider budget stays zero.

For WebKit, attempt a supported local video fixture or document the specific harness failure and remaining local gate. A skip cannot be counted as passed camera coverage. Physical camera ergonomics and real-world accuracy remain separate external gates.

## Positive findings and evidence limits

The final delivery owner check addresses the reported completed-review ownership gap. Invalid quadrilateral rejection and pixel-derived synthetic detection are useful checks. The code separates projective recognition images from unwarped grading source crops in principle; R3 is needed to keep those crops consistent after correction.

No new persistence path is evident in this slice, so repeating the unchanged real database suite is not required merely to increase test counts. If revisions change persistence/ownership behavior, verify that changed boundary with the approved isolated setup.

The proposed real benchmark remains a draft. Before collecting results, define per-cohort and joint identity accuracy, eligible-frame/abstention denominators, repeated-shot handling and objective geometry/label judgments. Aggregate per-field accuracy can hide a failing grader/language cohort. Do not run paid/live recognition or collect images without the existing authorization/consent gates.

## Next action

Sol implements only `docs/SOL_CLIENT_PACKET_04_REVISION.md`, updates its report, and stops for Astra review. No deployment, hosted mutation, new dependencies/platform, provider calls, or next packet.
