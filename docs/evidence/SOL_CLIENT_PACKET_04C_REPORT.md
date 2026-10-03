# Sol CLIENT-04C — real-image capture pilot report

**Astra review requested: BLOCKED for the 12-photo Pokémon acceptance gate; REVISE is warranted for the demonstrated downstream crop path.** This was an offline evidence run only. The target corpus has **0/12** rights-cleared, eligible Pokémon originals, so no automatic-use or preservation percentage can be claimed. No application algorithm, shipping dependency, hosted data, or deployment changed.

## 1. Corpus, rights, and frozen protocol

I read the required ponytail full-mode skill, AGENTS.md, both Mica roadmaps, the CLIENT-04/04B acceptance reports, and the existing detector/browser harness. No consented PSA/BGS photo was present locally. Public discovery stopped at 12 candidate pages, below the 24-page cap. The [source and rights ledger](sol-client-04c/SOURCE_RIGHTS.md) records permission, exclusions, source links, dates, dimensions, hashes, and redistribution limits.

The [protocol](sol-client-04c/PROTOCOL.md) and [manifest](sol-client-04c/manifest.json) were frozen **before detector execution**. Manifest SHA-256: `3aa30a138b0561a831709833b1626989dbcf5ca4caedbbff3d6cd3259b523e76`. Application snapshot: `app.js` `5b294469f979e23d08101a6be4508a036dbe9453b2f76db06df1fc950b096aae`; `lib/capture-precision.js` `5835a48aef55b0718bb50b0314c3f7526e75893836e3a9557364dce72fcf3522`. Source-space annotations include slab corners, card and label rectangles, orientation, visible text, and uncertainty. Sol was the sole annotator; there was no second human review. Original bytes were set read-only. Ground truth was used for assessment and visible manual control movements, never passed to automatic detection.

| Target cohort | Eligible permitted Pokémon originals / target |
| --- | ---: |
| PSA EN / JA / DE | 0/2 · 0/2 · 0/2 |
| BGS EN / JA / DE | 0/2 · 0/2 · 0/2 |
| Pooled | **0/12** |

The isolated [Beckett Atari Centipede photo](https://www.flickr.com/photos/plenoxo/19296250563) is a real 674×1024 slab and supports an **exploratory** capture-path observation. It is not a Pokémon card. Its CC BY-NC terms do not establish permission for commercial-product research or evidence redistribution, so neither original nor derived image was checked into the repository; the measured file is local-only under `/tmp/mica-04c-candidates/` and cannot close any acceptance cell. The [CC BY-SA Commons photo](https://commons.wikimedia.org/wiki/File:Shohei_Ohtani_2018_Topps_Future_Stars_FS-5_Black_parallel_misidentification_comparison.png) contains three PSA baseball slabs, so it is a negative ambiguity input. It is attributed to Casey Johnston / StewieJo and reproduced in this evidence folder under CC BY-SA 4.0.

**Missing input for gate closure:** two distinct, complete, ≥600 px short-side Pokémon slab photos for each PSA/BGS × EN/JA/DE cell, with one slab per image, source/photographer permission allowing internal commercial research and any intended evidence redistribution, and sufficient visible label/card/slab boundaries. Sources can be owners' consented files or explicit commercial-use licenses; buying slabs is not required. Ideally include actual glare, transparent borders, different mats, BGS half grades, and leading-zero labels where available.

## 2. Original-image detection and crop behavior

The preserved [first-run ledger](sol-client-04c/results.json) and [corrected harness/recovery ledger](sol-client-04c/results-manual-acceptance.json) both use the frozen manifest. The first-run harness applied default manual corners even to the three-slab negative and blocked WebKit `blob:` preview URLs; those first-run UI results are diagnostic only. The later run corrected the harness, preserved the original application snapshot, allowed local `blob:` resources, and left the ambiguous photo unaccepted.

| Original, run on all three browser profiles | Automatic result | Preservation / label result | Timing, detector + preview (desktop / mobile Chromium / mobile WebKit) |
| --- | --- | --- | --- |
| Beckett Atari exploratory | Detector returned `detected: true`, `documentKind: card`, `correctable: false`, `perspectiveDelta: 0.5247` (0.787 / 0.5247 in WebKit). Saved-photo review rejected automatic use. | No automatically accepted crop. Direct `prepareVisionImage(file, {purpose:"card"})` nevertheless produced a 426×684 crop **without the entire label**; it is an unsafe downstream preparation result, not an accepted camera preview. Source label/card were visible. | First run 43.8 / 21.9 / 76.0 ms; repeat 23.5 / 15.8 / 60.0 ms. |
| Three PSA Ohtani slabs, negative | `detected: false`, reason `document_clipped`; saved-photo review disabled Use photo. | No accepted crop. The source has three slabs, so no single slab/card/label preservation claim applies. `prepareVisionImage` retained the source and reported a separation blocker. | First run 27.3 / 28.1 / 45.0 ms. |

The target automatic numerator and denominator are **0/0 in every cell and pooled**, hence the ≥90% target and 100% accepted-crop preservation target are **unmeasured**, not passed or failed. The exploratory BGS original is one automatic non-correction, not a Pokémon accuracy estimate. No label characters were lost in an accepted automatic output because there was no accepted automatic output. These are local Apple M4 arm64 desktop browser timings (Node 24.21.0, Playwright 1.58.2), not physical iPhone capture latency. `prepareVisionImage` elapsed time was 65–94 ms for the exploratory file on the repeat run; its initial result must not be treated as an accepted crop.

Likely shared cause: the foreground-component detector in [capture-precision.js](../../lib/capture-precision.js) treats the high-contrast inner game card as the document, infers `card`, and marks the skewed quadrilateral uncorrectable (near lines 240–365). [prepareDocumentPreview](../../app.js) honors `correctable` and blocks automatic use (near line 12287). The independent [prepareVisionImage](../../app.js) branch tests `detected` and corners but not `correctable` (near lines 12418–12425), so a direct saved-photo consumer can rectify the rejected inner quadrilateral and omit the label. The smallest next repair for Astra to review is a focused guard/whole-source fallback in `prepareVisionImage` when detected geometry is uncorrectable, followed by a real rights-cleared slab regression. **No repair was applied in this packet.**

## 3. Manual recovery and browser workflow

Using only the saved-photo UI, a denied camera, and four visible corner controls, the exploratory Beckett original reached a 613×963 manual preview in desktop Chromium, mobile Chromium, and mobile WebKit. I moved each corner from the default rectangle to approximately `(0.05,0.03)`, `(0.95,0.03)`, `(0.95,0.96)`, `(0.05,0.96)` using the UI's 0.01-step buttons. The full translucent slab, all four corners, the card, and the label remain visible; the protective margin is narrow at the top (about 2 source pixels, within the declared ±5 px outer-edge annotation uncertainty). The large “7,” “CENTIPEDE,” and the visible certificate line remain as readable as in the original; smaller text is soft in both and was not asserted readable. This is a **single exploratory manual recovery**, not a target-cohort pass. The output JPEG SHA-256 for desktop Chromium is `e7782e11d2e7385716012b34035c383a31891a4a996965cd068f6bfb5768b87b` and remains local-only beside the source.

Across all three profiles, Use photo was disabled after automatic rejection and while adjusting. After applying the reviewed corners it became enabled; explicit Use photo delivered a manually adjusted file to the local callback. The production `prepareVisionImage` consumer classified that accepted file as `slab`, retained the manually selected source corners, and marked photometric changes false. It also emitted an angle blocker because manual adjustment marks geometry as not straight; this grading warning was preserved, not waived. Retake removed the prior preview. For the three-slab negative, Use photo stayed disabled and Retake cleared it. No file was delivered from that negative. [Paired Commons original and review captures](sol-client-04c/) are checked in; noncommercial Beckett paired original/review/adjustment/manual images remain in `/tmp/mica-04c-candidates/` pending rights clarification, so this case has limited reproducibility from repo alone.

The harness routed every external request to abort, with `blob:` and `data:` local resources allowed. In the final run, attempted outbound requests: **0**; inventory writes: **0**; hosted recognition/provider requests: **0**. Recognition was not invoked. The Commons negative's UI reports generic “Check the document edges or retake,” rather than “more than one card,” because the detector returned `document_clipped`; the safety boundary held, but the diagnosis is less specific.

## 4. Synthetic derivatives

None were generated. The two original images were run first; transformed copies would not add independent slab coverage.

## 5. Reproduction and remaining gates

With the original files at the manifest paths and their hashes unchanged, from the repository root run:

```sh
PORT=4189 node scripts/serve.mjs
node docs/evidence/sol-client-04c/run-benchmark.mjs
```

The runner checks the frozen application and source hashes, bundles the unchanged app into the existing capture harness pattern, exercises `prepareDocumentPreview`, `prepareVisionImage`, saved-photo upload, manual corner controls, retake, and explicit Use photo. It writes `results-manual-acceptance.json`; the original first-run `results.json` remains untouched. No full unrelated test suite was run. The Beckett source must be reacquired from its cited page for reproduction, with permission clarified and the recorded SHA-256 verified; the repo intentionally contains no NC image bytes. The Commons original and its review screenshots are included with the license attribution above.

Still unproved: target Pokémon cohort performance and 90% automatic rate, real slab glare/focus and transparent edge behavior, physical iPhone camera latency/handling, live recognition accuracy, official PSA/BGS records, real provider integrations, and release readiness. CLIENT-04B remains excluded from shipping. Astra should review the rights gap and the demonstrated consumer guard issue before issuing any focused application-fix packet. Stop at this review gate; no CLIENT-05 work.
