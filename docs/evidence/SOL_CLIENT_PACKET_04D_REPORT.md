# Sol CLIENT-04D — rejected geometry repair

**For Astra review.** The shared image preparation path now accepts document geometry only when correction actually succeeds. Rejected bounds and corners leave the whole source frame in the prepared evidence, preview, and identity derivative. Card grading and collectible photo assist require accepted geometry before recognition; intentional detail closeups remain usable. This is a deterministic control-flow repair, not a real-photo detector benchmark or release gate.

## Root cause and repair

`prepareVisionImage` previously derived `detectedBounds` from `detected` alone and sent that rectangle to `sourceEvidenceCanvas`. It also passed detected corners to `correctedDocumentCanvas` without requiring `correctable`. Thus the saved-photo review could reject a quadrilateral while a downstream consumer cropped away the slab label and returned crop/verification claims. Photo assist used `purpose: "collectible"`, whose existing quality blockers did not necessarily stop recognition.

The repair in `app.js` requires `correctable === true` and a successful correction canvas before using either bounds or corners. Otherwise the preparation canvas is the whole source frame, subject only to normal size/encoding limits. Rejected capture metadata is excluded from `captureGeometry`; the unaccepted observation remains in its diagnostic note. The returned provenance reports no applied crop, background exclusion, verified boundary/perspective, successful transform, or measurable centering. Document kind for a rejected observation is inferred from the retained pixels rather than the rejected detector claim. A document-edge blocker now applies to both `card` and `collectible`; photo assist disables Find matching cards and exposes **Adjust or retake**. Detail-only evidence deliberately does not require full-document geometry.

The existing camera retains the original `File` and stores accepted manual corners as source-normalized coordinates in metadata. Its corrected image is a review preview, not replacement input bytes. `prepareVisionImage` starts from those original bytes and corrects once when accepted, so manual recovery does not double-correct. A separate race guard keeps Use photo disabled if the user opens edge adjustment while an earlier automatic correction is still pending.

## Caller and output audit

| Consumer | Prepared outputs and consequences | Rejected-geometry behavior |
| --- | --- | --- |
| Precision grading (`showPrecisionGradingProcessing`) | `purpose: "card"`; prepared data, preview, identity image and geometry feed grading/identity analysis, previews and measurements. | Document-edge blocker aborts analysis; no rejected bounds crop or centering measurement. |
| Supplemental evidence (`captureSupplementalEvidence`) | Full card uses `purpose: "card"`; closeup uses `purpose: "detail"`; data and geometry feed the selected evidence upload. | Full card requires correction or retake. Detail keeps the complete intentional closeup and its supported upload path. |
| Photo assist (`showProcessing`) | `purpose: "collectible"`; preview is shown locally; `identityDataUrl` is supplied to `analyzeCardImages` only after Find matching cards. | Find matching cards is disabled and Adjust or retake opens the existing saved-photo/manual-correction path. No recognition request occurs until the user explicitly uses an accepted photo and clicks Find. |

For all purposes, `dataUrl` is the prepared evidence, `previewDataUrl` is the display image, and `identityDataUrl` is the identity derivative. The original file remains available for the current camera operation and retake. This audit covers the three `prepareVisionImage` call sites; downstream analysis uses its image and geometry fields rather than the rejected source geometry directly.

## Executable evidence

The new browser regression uses a purpose-built synthetic original with separate red label and magenta border markers. Its controlled `detected: true, correctable: false` metadata isolates the rejected-geometry branch; variants separately expose the rectangular-bounds crop and corner-based projective crop. A third variant omits the legacy `correctable` field; it is conservatively rejected. This proves preparation and consumer behavior under controlled metadata, **not** real-image detection accuracy.

The regression was run **before** the application fix. Its [saved failure log](sol-client-04d/before-fail.txt) records `Expected: > 1000; Received: 0` for decoded label pixels in the prepared evidence. After the fix, desktop Chromium, mobile Chromium and mobile WebKit each pass the bounds, corners and legacy variants for both `card` and `collectible`. The [desktop](sol-client-04d/desktop-chromium-pixels.json), [mobile Chromium](sol-client-04d/mobile-chromium-pixels.json), and [mobile WebKit](sol-client-04d/mobile-webkit-pixels.json) ledgers record, per variant, decoded evidence/display, identity pixels, blockers and provenance. Minimum label/border counts across the six non-detail cases per profile are **47,221/2,100** in evidence on Chromium (**47,166/2,100** on WebKit) and **130,416/1,818** in identity on Chromium (**130,145/1,818** on WebKit). The detail case also retains both markers with no full-document blocker. All six non-detail cases per profile have `corrected: false`, null transform, `conditionEvidence: full_source_frame`, false crop/background/verification flags and unmeasurable centering.

The actual photo-assist flow is shown in [desktop rejected](sol-client-04d/desktop-chromium-rejected-assist.png), [mobile Chromium rejected](sol-client-04d/mobile-chromium-rejected-assist.png), and [mobile WebKit rejected](sol-client-04d/mobile-webkit-rejected-assist.png) screenshots: the full synthetic document remains visible, Find matching cards is disabled, and recovery is offered. [Desktop](sol-client-04d/desktop-chromium-manual-recovery.png), [mobile Chromium](sol-client-04d/mobile-chromium-manual-recovery.png), and [mobile WebKit](sol-client-04d/mobile-webkit-manual-recovery.png) show the manually accepted path. Each test sees zero recognition requests before recovery, then one request only after explicit Use photo and Find matching cards. Recognition is a **local `/api/vision` stub**, not a live provider call; there is no inventory creation. Existing automatic, manual, orientation/label, retake, grading and detail tests remain in the full document suite.

## Verification

| Command | Result |
| --- | --- |
| `FORCE_COLOR=0 npx playwright test tests/browser/document-capture.spec.js --project=desktop-chromium --workers=1 -g 'rejected geometry'` before fix | Expected regression failure: decoded evidence label count 0; log linked above. |
| `npx playwright test tests/browser/document-capture.spec.js --workers=1 -g 'rejected geometry\|opening edge adjustment'` after fix | 6 passed, 0 failed. |
| `npx playwright test tests/browser/document-capture.spec.js --workers=1` | 49 passed, 2 existing skips, 0 failed. |
| `npx playwright test tests/browser/document-capture.spec.js --workers=1 -g 'rejected geometry\|corrected slab pixels'` after a warning-text spacing fix | 6 passed, 0 failed across all three profiles; refreshed screenshots and pixel ledgers. |
| `npx playwright test tests/browser/grading-capture-recovery.spec.js tests/browser/intake-continuity.spec.js --workers=1` | 35 passed, 1 existing skip, 0 failed. |
| `node --test tests/capture-precision.test.js tests/grading-capture.test.js` | 21 passed, 0 failed. |
| `npm run lint`; `npm run typecheck`; `npm run build` | Passed. |
| `node scripts/verify-certificate-exclusion.mjs` | Passed across 25 shipping files. |
| `npx prettier --check tests/browser/document-capture.spec.js`; `git diff --check -- app.js tests/browser/document-capture.spec.js` | Passed. |

The first post-repair full browser run exposed a race when Adjust edges was opened during pending correction. The guard and a dedicated regression were added; that intermediate run is not used as acceptance evidence. A later full run was interrupted to add the rejected document-kind assertion. The completed 49-pass run is the full-suite evidence. The only subsequent application edit was spacing between a warning heading and its text, checked by the final focused browser run plus lint, typecheck, build and shipping exclusion.

Only `app.js`, `tests/browser/document-capture.spec.js`, and this 04D evidence were changed for this packet. The dirty worktree and earlier packet artifacts were preserved. The 04C manifest still hashes to `3aa30a138b0561a831709833b1626989dbcf5ca4caedbbff3d6cd3259b523e76`; the detector library is unchanged at `5835a48aef55b0718bb50b0314c3f7526e75893836e3a9557364dce72fcf3522`. No permission-unresolved Beckett image was used or acquired.

## Remaining gates

CLIENT-04C still has **0/12** permitted eligible Pokémon slab originals. This synthetic repair cannot establish real-photo detection or accepted-crop performance, physical iPhone behavior, live recognition accuracy, official PSA/BGS certificate integration, or release readiness. No hosted provider requests, paid services, deployment, migration, commit or CLIENT-05 work occurred. Stop for Astra review.
