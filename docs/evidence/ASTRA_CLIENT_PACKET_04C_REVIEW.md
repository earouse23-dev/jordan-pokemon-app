# Astra CLIENT-04C review — 2026-09-24

Disposition: evidence packet closed with incomplete coverage; scanner acceptance remains open. Issue focused CLIENT-04D repair. No CLIENT-05 or release approval.

## Findings

1. **High: rejected geometry still drives downstream crops.** In `prepareVisionImage`, `detectedBounds` depends on `detected`, and `correctedCanvas` depends on detected corners, without checking `correctable`. `sourceEvidenceCanvas` actually crops to these bounds. Guarding only perspective correction would still lose source pixels. `captureGeometry` can also report normalized crop/background exclusion/boundary verification from rejected geometry. Fix the shared preparation boundary and its evidence claims together.
2. **The shipping identity caller needs coverage.** The exploratory runner demonstrates `purpose: "card"`; `openPhotoAssist` calls preparation with `purpose: "collectible"`. Existing separation/angle blockers are largely card-specific. Trace both consumers and supplemental detail before choosing fallback behavior. A rejected crop must never become a ready-to-send identity derivative through another purpose value.
3. **Real Pokémon performance is unmeasured.** The manifest contains zero eligible permitted Pokémon originals. Neither the exploratory Atari slab nor the three-slab negative closes any cohort. Manual recovery is Sol-reported exploratory evidence, not general scanner acceptance.
4. **Rights remain unresolved for the exploratory input.** Sol explicitly records that the Beckett photo's terms do not establish permission for this product research. Keeping bytes outside git does not resolve that recorded permission gap. Do not reuse/reacquire that photo for the repair without documented permission. Preserve historical text/results with their limitation; use a purpose-built synthetic regression for this deterministic control-flow defect, clearly separate from real-photo performance.

## Independent review scope

Read report, protocol, rights ledger, result excerpts, source crop implementation and all three `prepareVisionImage` call sites. Verified current SHA-256 values match the frozen manifest/report: app `5b294469f979e23d08101a6be4508a036dbe9453b2f76db06df1fc950b096aae`, capture library `5835a48aef55b0718bb50b0314c3f7526e75893836e3a9557364dce72fcf3522`, manifest `3aa30a138b0561a831709833b1626989dbcf5ca4caedbbff3d6cd3259b523e76`.

This is source and evidence review. Astra did not rerun the image benchmark, independently inspect the restricted photo, or independently reproduce the browser results. The source independently confirms the missing guard and the second bounds-crop path.

## Next gate

CLIENT-04D must demonstrate the regression failing before the fix and passing afterward, preserve accepted automatic/manual paths, and keep unsupported geometry from receiving verified evidence claims. No detector tuning or corpus-search expansion. Real-photo, physical-device, live recognition and provider gates remain open independently.
