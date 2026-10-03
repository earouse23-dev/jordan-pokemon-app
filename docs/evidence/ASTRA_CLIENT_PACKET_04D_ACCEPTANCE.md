# Astra CLIENT-04D acceptance — 2026-09-24

**Accepted locally for the rejected-geometry repair.** No blocking defect found within this packet's scope. This does not pass the real-photo or release gates and does not issue CLIENT-05.

## Reviewed behavior

The shared preparation path requires explicitly correctable geometry and a successful correction canvas before applying either source bounds or projective correction. Otherwise it retains the available source frame, emits an actionable document blocker for card/collectible purposes, and removes crop/verification claims. Intentional detail evidence remains supported. All three callers were inspected, including photo-assist readiness and its retry handler. The pending-correction guard prevents automatic completion from enabling Use photo while manual adjustment is open.

The photo-assist retry opens the existing camera/upload flow; the tested recovery reselects the source file and applies manual corners before explicit Use photo and Find matching cards. This evidence does not claim the retry automatically preloads the earlier file.

## Independent verification

- 9 browser tests passed: rejected geometry pixel/provenance checks and manual recovery, pending-correction adjustment race, and corrected slab pixels reaching stubbed recognition; each on desktop Chromium, mobile Chromium and mobile WebKit.
- 21 capture precision/grading capture unit tests passed.
- Shipping certificate exclusion passed across 25 existing build files. Astra did not rebuild the artifact.
- Visually inspected the independently generated mobile Chromium rejected-photo screenshot: source label/border present, recognition disabled, recovery visible.
- Detector library and CLIENT-04C manifest hashes remain unchanged.

Browser verification used a temporary copy of the existing test file and configuration, a dedicated local server on port 4197, blocked external browser requests, and existing local API stubs. Only import/resource paths, output directories and isolation setup were changed in the copied harness. Sol's checked-in evidence was not overwritten. Temporary results: `/var/folders/2_/v5kbdt0j0p3131zbc3c78mwm0000gn/T/mica-04d-astra-0c7uy03x/`. Selected browser run: 9 passed in 15.6 seconds. These are simulated captures/providers, not live service or physical-device tests.

Sol's broader 49-pass/2-skip document suite, 35-pass/1-skip related suite, lint, typecheck and build are reported evidence; Astra did not repeat them. The reported pre-fix failure was inspected in the evidence narrative, not independently rerun against an earlier source snapshot.

Reviewed SHA-256:

| File | Hash |
| --- | --- |
| `app.js` | `15535c9b11fff5cedef9c9da21568b2a8f4c7baa6ce28b5dc112be0384a8de1d` |
| `tests/browser/document-capture.spec.js` | `097d4669b13c922118e25469cf4790ffcdde2568b6f10032190d6bab2dd5158e` |
| `lib/capture-precision.js` | `5835a48aef55b0718bb50b0314c3f7526e75893836e3a9557364dce72fcf3522` |
| CLIENT-04C manifest | `3aa30a138b0561a831709833b1626989dbcf5ca4caedbbff3d6cd3259b523e76` |

## Remaining gates

Eligible permitted Pokémon photo coverage remains 0/12. Synthetic pixel checks establish this safety branch, not automatic slab detection performance. Physical iPhone/slab behavior, live recognition and relevant provider/persistence/release gates remain open. Deferred certificate integration stays excluded from the initial shipping build under Elliott's phased release decision. No additional speculative detector tuning is requested. Next scanner evidence requires permitted real originals; no slab purchase is required.

Application code was not changed during Astra review. No provider call, hosted mutation, deployment or commit was performed. Preserve the dirty worktree and stop at this gate pending a separately issued packet.
