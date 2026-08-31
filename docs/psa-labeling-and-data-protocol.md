# PSA labeling, lineage, and consent protocol

Version: `mica-psa-label-protocol-v1`
Research consent: `mica-grading-research-v2`
Retention policy: `mica-private-research-retention-v1`

## Ground truth

The only PSA outcome ground truth is a return linked to the same physical card
that Mica captured before submission. The verified record requires the scan ID,
immutable physical-card ID, returned label, certification number, proof hash,
and proof review. Another AI grade, collector opinion, catalog image, synthetic
damage, or a photograph taken only after encapsulation is not ground truth.

Valid returned labels are numeric PSA 1; half and whole grades through 8.5; PSA
9; PSA 10; qualified numeric grades (`OC`, `PD`, `ST`, `OF`, `MK`, `MC`);
applicable PSA no-grade codes; `AUTHENTIC`; and `AUTHENTIC ALTERED`. PSA 9.5 is
invalid.

## Physical-card chain of custody

1. Create the physical-card ID before the first grading capture.
2. Append capture, submission, handling, return, proof, crack, and resubmission
   events; never rewrite an earlier event.
3. Hash every retained source and normalized capture.
4. Keep every scan, regrade, and resubmission of one physical card in the same
   dataset partition.
5. Record handling that could change condition. A card with uncertain lineage
   is excluded from exact-grade training.

## Training eligibility

An example becomes eligible only when all conditions pass:

- Research consent v2 was active at capture and includes private capture
  training plus verified-outcome linkage.
- Every required capture predates the returned outcome.
- The exact printing and finish are confirmed.
- The physical-card lineage has no unresolved gap.
- A proof artifact is attached and its hash is recorded.
- The PSA label is certificate-verified or independently verified.
- Two independent reviewers completed the condition labels, or an adjudicator
  resolved their disagreement.
- The example is assigned by physical-card ID to one partition only.

Revocation deletes retained owner captures and marks derived training examples
deleted. Frozen aggregate evaluation reports may retain non-identifying counts,
but the revoked pixels and card-level labels cannot enter a later training run.

## Annotation contract

Reviewers label identity, finish, evidence sufficiency, centering, corners,
edges, surface, structure, eye appeal, and PSA no-grade warning signals. Every
defect needs side, category, severity, pixel mask, confidence, and whether it
persists at the same coordinates across lighting views. Intentional artwork,
foil, rainbow, etched texture, glare, shadows, and compression artifacts are
explicit hard negatives.

Two reviewers work independently. They cannot see the model prediction or the
other review. Disagreements are adjudicated by a third reviewer. Model-created
labels may prioritize a review queue but cannot approve themselves.

## Cohorts

Every example records exact printing, language, era, finish, design type,
returned label, device family, lens, capture quality, lighting, and background.
The initial target is modern English and Japanese Pokémon cards on supported
phone cameras, with separate cohorts for non-holo, traditional/reverse holo,
textured full art, rainbow/hyper rare, radiant, etched, and other finishes.

No cohort receives an exact PSA prediction until its untouched holdout passes
the published accuracy, calibration, repeatability, identity, and safety gates.

## Dataset partitions

- `train`: model fitting only.
- `validation`: architecture and threshold selection.
- `calibration`: probability calibration only.
- `test`: internal frozen evaluation.
- `external_holdout`: inaccessible during development and opened once for the
  frozen release candidate.

Partition assignment is immutable after a manifest freezes. Any physical card
found in more than one partition invalidates the entire evaluation run.

## Claims policy

Mica may say `PSA prediction` only for a validated cohort and capture. It may
never say `official grade`, guarantee PSA agreement, publish accuracy without
coverage and confidence intervals, or silently lower the release gate. Cards
outside the validated envelope receive a visible-condition result and an honest
abstention.
