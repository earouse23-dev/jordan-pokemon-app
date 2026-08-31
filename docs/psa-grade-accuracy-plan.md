# Mica plan for PSA-grade prediction accuracy

Status: implementation plan
Created: 2026-08-09
Target grader: PSA trading cards only

## Objective

Build a grader that predicts the outcome PSA will return for a specific physical
card, using evidence captured before submission. A single exact PSA outcome may
be shown only when an untouched, verified PSA-return evaluation proves that the
model is sufficiently accurate for that card cohort and capture quality.

This is not a promise of universal or perfect agreement. PSA states that its
centering limits are approximate, slight printing imperfections may be allowed,
and borderline decisions may depend on issue-specific eye appeal, grader
experience, and market acceptability. PSA also examines details that ordinary
phone photographs may not reveal. The product must therefore abstain whenever
the available evidence cannot support an exact prediction.

Primary standards:

- https://www.psacard.com/gradingstandards
- https://www.psacard.com/services/cardgrading
- https://www.psacard.com/articles/articleview/5212/introducing-psa-half-grades-more-precise-grading-your-cards

## Definition of success

The product has three distinct outputs:

1. **Visible-condition measurement**: what Mica can demonstrate from the
   supplied evidence.
2. **Exact PSA prediction**: a calibrated returned label, available only inside
   a validated cohort.
3. **Submission decision**: a separate financial calculation that cannot
   influence condition or grade.

The primary metric is exact returned-label agreement with a verified PSA
return, not agreement with another AI, a collector opinion, or a Digital
Grading Co result. The label space includes PSA whole grades; applicable
half-point grades from 1.5 through 8.5; qualifiers; and no-grade/altered
outcomes. PSA does not use a 9.5 card grade. Every result also carries a
complete probability distribution, but the interface leads with one outcome
only after the exact-prediction gate passes.

### Final release gates

These are minimum gates, not marketing claims:

| Measure | Exact-grade release requirement |
| --- | --- |
| Exact PSA returned-label agreement | At least 95% among exact predictions shown on the locked external holdout, with the lower bound of the 95% Wilson confidence interval at least 90% |
| Within-one-grade agreement | At least 99% |
| False PSA 10 rate | At most 0.5% of cards predicted as PSA 10 |
| Severe-defect false-negative rate | At most 1% for creases, dents, indentations, trimming/alteration signals, and structural damage |
| Probability calibration | Expected calibration error at most 0.03 and Brier score reported |
| Controlled repeatability | At least 98% of repeat captures produce the same returned-label prediction; 99.5% stay within one numeric grade |
| Exact card identity | At least 99.8% on supported printings; unresolved identity always abstains |
| Cohort safety | No supported finish, era, language, device tier, or grade band may miss its declared gate by more than 3 percentage points |
| Capture completion | At least 95% for supported devices and cards |
| Coverage | Reported alongside accuracy; never improve accuracy by hiding the abstention rate |

If the exact-agreement gate is not empirically achievable, Mica does not lower the
gate or make an exactness claim. It continues to provide condition measurement,
grade probabilities, and an honest abstention. Accuracy and coverage must
always be published together.

## Non-negotiable data rules

- The target label is a verified PSA return for the same physical card.
- Training captures must predate the PSA result and submission outcome.
- Certification number plus PSA result proof is required for the verified
  evaluation set. User-entered grades remain a separate, lower-trust cohort.
- A physical card, its rescans, regrades, and resubmissions belong to exactly
  one dataset partition. They can never cross train, validation, and test sets.
- Digital Grading Co output, another AI output, synthetic defects, and collector
  guesses may be used for product research but never as PSA ground truth.
- Model-generated defect labels may propose reviewer work but cannot approve
  their own labels.
- Research use remains explicit, revocable, versioned, and separate from normal
  grading. Training data must be private, encrypted, and service-only.
- Dataset snapshots, labels, code, weights, rubric, and calibration artifacts
  are immutable and versioned together.

## Supported-cohort matrix

Every example is labeled across the dimensions below. Release is cohort-based;
unsupported combinations abstain.

- Printing: exact catalog ID, set, collector number, language, variant, finish,
  print run when known, and manufacturing era.
- Finish: non-holo, traditional holo, reverse holo, full art, textured full art,
  rainbow/hyper rare, radiant, etched, vintage foil, and other documented
  treatments.
- Design: bordered, borderless, dark-border, light-border, asymmetrical art,
  and intentionally distressed artwork.
- Condition: every applicable PSA whole and half-point grade, no-grade/altered
  outcomes, qualifiers, and borderline resubmission outcomes.
- Evidence: device family, lens, resolution, focus score, lighting geometry,
  glare level, background, card orientation, and capture distance.
- Card characteristics: English/Japanese and later supported languages,
  vintage/modern, cardstock family, and known issue-specific print traits.

The first production model should support a narrow, well-populated Pokémon
cohort rather than weakly claim every card. Coverage expands only after each new
cohort passes the same locked evaluation.

## Target system architecture

### 1. Video evidence acquisition

The camera behaves like a document or QR scanner. It continuously analyzes a
short live stream and automatically retains the best frames without making the
user operate a shutter.

- Record a short local ring buffer rather than one isolated frame.
- Require front, back, and automatically guided changing-light evidence.
- Use phone pose and optical flow to determine when the light moved while the
  physical defect remained stationary.
- Use exposure bracketing when the browser/device supports it.
- Lock continuous focus and prefer the highest native camera resolution.
- Reject sleeves, top loaders, hands over card areas, cropped corners, motion,
  excessive compression, glare saturation, and insufficient spatial detail.
- Store the best evidence frames only after consent rules are applied; normal
  product operation may continue to keep source pixels transient.
- Produce a machine-readable evidence sufficiency record for every condition
  area. A missing area blocks exact prediction.

### 2. Geometry and canonical card registration

- Train a card boundary and four-corner keypoint model.
- Rectify perspective with a homography into one canonical card coordinate
  system.
- Detect crop, rotation, card curvature, lens distortion, and incomplete edges.
- Measure physical aspect and border ratios with uncertainty.
- Register the capture against a clean reference image of the exact printing.
- Report registration error; high error blocks downstream defect claims.

Geometry acceptance targets:

- Median corner reprojection error at most 0.25% of card width.
- 95th-percentile corner error at most 0.75%.
- Median centering error at most 0.5 percentage point and 95th percentile at
  most 1.5 percentage points against independently measured borders.

### 3. Exact-print reference layer

Create a licensed, versioned reference record for each supported printing:

- Clean front/back scans.
- Expected dimensions and border geometry.
- Artwork, text, symbols, borders, and intentional texture masks.
- Finish type and expected reflectance behavior.
- Known factory print traits and issue-specific PSA eye-appeal considerations.
- Known visually similar printings that must be distinguished.

The reference layer prevents rainbow gradients, holo patterns, etched texture,
print dots that are part of the artwork, and other intentional features from
being treated as damage.

### 4. Specialist condition models

Do not train one model to directly guess a grade from the whole image. Train
specialists whose evidence can be inspected:

- **Identity model**: exact printing and finish.
- **Capture-quality model**: whether every required feature is measurable.
- **Centering model**: front/back printed-image ratios and uncertainty.
- **Corner model**: whitening, rounding, compression, bend, and missing stock.
- **Edge model**: whitening, chipping, wear, rough cut, peeling, and alteration
  signals.
- **Surface temporal model**: scratches, holo scratches, print lines, scuffs,
  stains, residue, dents, and indentations across lighting frames.
- **Structure model**: crease, wrinkle, bend, warping, delamination, trimming,
  cleaning, recoloring, and restoration warning signals.
- **Eye-appeal model**: issue-relative presentation trained only after the
  technical evidence models are stable.

Each defect model returns a pixel mask, category, side, severity, confidence,
cross-light persistence, and reference-difference evidence. A model may not
affect the grade without a localizable finding or an explicit measurable global
feature such as centering.

### 5. Foil and rainbow disambiguation

This is a dedicated workstream, not a prompt tweak.

- Register all frames to the same physical card coordinates.
- Estimate specular motion as the card/light angle changes.
- Separate stationary surface geometry from moving reflections.
- Compare observations with the exact finish reference and intentional-texture
  mask.
- Train hard-negative examples containing pristine rainbow, textured, reverse
  holo, radiant, and vintage holo cards.
- Train paired positives where genuine scratches cross those same finishes.
- Require repeat evidence at the same coordinates before a reflective-surface
  finding becomes grade-limiting.
- If the sequence cannot separate finish from damage, request one automatic
  additional light sweep and then abstain.

### 6. PSA fusion and ordinal prediction

The PSA predictor consumes verified specialist measurements, not raw prose.

- Use an ordinal model that respects PSA 1, the applicable half-point and whole
  grades through 8.5, PSA 9, and PSA 10, plus a separate classifier for
  qualifier and no-grade/altered outcomes. There is no PSA 9.5 card label.
- Include exact-print/era cohort, defect severity, defect placement, centering,
  eye appeal, evidence sufficiency, and model uncertainties.
- Apply hard caps for severe structural findings and PSA no-grade signals.
- Learn PSA outcome probabilities with nested cross-validation.
- Calibrate probabilities on a separate calibration set using an appropriate
  held-out calibration method selected by benchmark, not preference.
- Derive exact-grade eligibility from the calibrated probability and cohort
  validation table.
- Keep financial values completely outside the condition and PSA model.

### 7. Explanation layer

A vision-language model may summarize verified evidence and explain the result.
It may not create defects, change measurements, override a hard safety cap, or
produce the final PSA probability. Every sentence must trace to structured
evidence.

OpenAI announced on May 8, 2026 that its self-service fine-tuning platform is
being wound down for new users. Mica should therefore avoid making a new OpenAI
vision fine-tune a critical dependency. Current multimodal models can remain
reviewers while the trainable core uses independently controlled specialist
computer-vision and calibration models.

Source: https://openai.com/index/introducing-vision-to-the-fine-tuning-api/

## Ground-truth program

### Capture kits

Create standardized capture protocols for ordinary supported phones and a
laboratory reference rig.

- Ordinary-phone set: the same flow customers will use.
- Controlled rig: fixed camera, diffuse lights, movable angled lights, measured
  distance, color target, and optional cross-polarized reference evidence.
- Each physical card receives repeat captures across devices, operators,
  backgrounds, and sessions before PSA submission.
- The app-generated scan ID travels with the submission record so the returned
  grade cannot be attached to the wrong card.

### Labels

Every training card should have:

- Verified identity and finish.
- Pre-submission captures and hashes.
- Two independent condition annotations.
- Adjudication for disagreements.
- Defect masks and technical measurements.
- PSA grade, cert number, return date, service context, and available grader
  notes.
- Resubmission or crossover lineage when applicable.

PSA notes are useful defect supervision where available, but the returned PSA
grade remains the outcome label.

### Dataset milestones

| Milestone | Minimum evidence | Purpose |
| --- | --- | --- |
| Instrumentation pilot | 100 cards, 20 repeat groups | Validate consent, linkage, capture, and label workflow |
| Geometry/foil pilot | 500 PSA returns, 100 repeat groups, deliberate finish coverage | Train and validate capture, registration, and foil separation |
| Specialist-model alpha | 2,000 verified returns plus adjudicated defect masks | Establish defect and condition baselines |
| PSA-model beta | 10,000 verified returns with every supported cohort populated | Train ordinal fusion and calibration |
| Locked external holdout | At least 5,000 untouched returns collected separately | Final exact-grade claim and cohort eligibility |

Minimum totals do not override cohort sample requirements. Each supported cohort
must have enough independent cards for a useful confidence interval. Rare or
underrepresented cohorts stay unsupported until populated.

### Outcome-variability study

Maintain a separate, chain-of-custody resubmission cohort for cards that are
professionally regraded without an intentional condition change. Record every
crack, handling event, and elapsed interval because resubmission itself can
change a card. This cohort estimates how often PSA returns the same label for
apparently unchanged evidence and therefore measures the practical ceiling for
an exact predictor. It is reported separately and never used to excuse model
errors. If PSA outcomes vary for visually indistinguishable evidence, Mica must
represent that uncertainty rather than learning whichever return was seen
last.

## Evaluation design

### Partitioning

- Group by immutable physical-card ID.
- Keep all scans, devices, regrades, and resubmissions of a card in one split.
- Add an artwork/printing holdout to measure generalization.
- Add a temporal holdout collected after the model freeze.
- Keep the final external holdout inaccessible to model developers and tuning
  scripts.

### Metrics

- Exact returned-label agreement—including applicable half grades, qualifiers,
  and no-grade outcomes—and its 95% confidence interval.
- Within-one agreement and mean absolute error.
- Per-grade confusion matrix, especially 8/9/10 boundaries.
- False PSA 10 and false high-grade rates.
- Brier score, log loss, expected calibration error, and reliability curves.
- Accuracy-versus-coverage curve for selective prediction.
- Repeatability across device, operator, session, and lighting.
- Defect precision, recall, localization IoU, and severity agreement.
- Critical-defect recall and no-grade/alteration warning recall.
- Centering measurement error.
- Identity accuracy and wrong-confident-match rate.
- Capture completion, retake rate, latency, device temperature, and upload size.
- Metrics by every declared cohort, not only an aggregate score.

### Baselines and ablations

Compare every candidate against:

- Current Mica cross-model review.
- Deterministic centering plus rules.
- Whole-image direct-grade baseline.
- Specialist models without exact-print references.
- Specialist models without temporal lighting.
- Single-frame versus multi-frame capture.
- Each available reviewer model family.

The foil workstream is accepted only if temporal/reference-aware processing
materially reduces false defects without materially increasing missed real
scratches.

## Phased implementation

### Phase 0 — Freeze definitions and ethics

Deliverables:

- PSA-specific label manual.
- Physical-card ID and chain-of-custody protocol.
- Research consent v2 covering model training, retention, revocation, and
  verified outcome linkage.
- Cohort taxonomy and supported-device policy.
- Exact-grade, abstention, and marketing claim policy.

Exit gate: legal/privacy review, reviewer agreement study, and ten complete
example records from scan through PSA return.

### Phase 1 — Build the private data foundation

Deliverables:

- Service-only training-example registry separated from product-facing tables.
- Immutable dataset manifests and object hashes.
- Annotation UI with two-reviewer adjudication.
- Verified PSA outcome workflow and proof review, including half grades,
  qualifiers, and no-grade codes.
- Dataset export, deletion, lineage, and audit jobs.
- Cohort-balance dashboard and leakage tests.

The existing `grading_scan_sessions`, `grading_captures`,
`grading_predictions`, `grading_feedback`, `grading_outcomes`, and versioned
research consent provide the product linkage, but training eligibility and
labels require a separate service-only layer.

Exit gate: 100-card instrumentation pilot with zero cross-owner access, zero
split leakage, and complete deletion/consent tests.

### Phase 2 — Production-grade capture and rectification

Deliverables:

- Local video ring buffer and best-sequence selection.
- Trained boundary/keypoint model and homography rectification.
- Device/lens calibration metadata.
- Evidence sufficiency map.
- Exact-card crops for reports and models.
- Controlled phone/rig validation suite.

Exit gate: geometry targets pass on the 500-card pilot and capture completion
passes on supported devices.

### Phase 3 — Reference and foil system

Deliverables:

- Exact-print reference registry and license/provenance records.
- Artwork/texture/finish masks.
- Temporal specular-motion model.
- Foil hard-negative benchmark.
- Automatic additional light-sweep recovery.

Exit gate: reflective-finish false-defect precision and real-scratch recall pass
on untouched foil cohorts; no supported foil cohort shows a severe regression.

### Phase 4 — Specialist defect models

Deliverables:

- Centering, corner, edge, surface, structure, and capture-quality models.
- Pixel-level evidence contract.
- Reviewer disagreement/adjudication reports.
- Critical-damage and alteration-warning guardrails.
- Versioned model registry with reproducible training.

Exit gate: specialist thresholds and critical-defect gates pass on the
specialist-model alpha set.

### Phase 5 — PSA fusion and calibration

Deliverables:

- Ordinal PSA prediction model.
- Per-cohort calibration artifacts.
- Exact-grade eligibility table.
- Coverage/accuracy threshold optimizer constrained by release gates.
- Frozen inference bundle with deterministic preprocessing.

Exit gate: nested validation passes before the external holdout is opened.

### Phase 6 — Shadow beta

Run the frozen candidate on real submissions without exposing the exact PSA
prediction to users. Reveal predictions internally only after PSA outcomes are
linked.

Deliverables:

- 2,000+ prospective shadow outcomes.
- Drift, device, cohort, and repeatability analysis.
- Failure review for every false PSA 10 and every error greater than one grade.
- Retrained candidate if needed; every retrain restarts the locked evaluation.

Exit gate: the candidate passes prospective gates, not merely retrospective
training data.

### Phase 7 — Independent holdout and limited launch

- Freeze code, preprocessing, weights, rubric, and calibration.
- Give the 5,000-card external holdout to an evaluator who did not build the
  candidate.
- Publish accuracy and coverage with confidence intervals and cohort tables.
- Enable exact PSA outcome predictions only for passing cohorts and supported
  capture evidence.
- Keep all other cohorts on visible-condition results and abstention.

### Phase 8 — Continuous controlled improvement

- Monitor drift and returned-grade disagreement.
- Sample false-high, false-low, foil, and low-confidence cases for adjudication.
- Recalibrate only with a new version and a fresh untouched temporal holdout.
- Canary releases, compare to champion, and provide instant rollback.
- Expand languages, eras, finishes, and graders one independently validated
  cohort at a time.

## Product behavior during development

- Keep the current digital condition result useful.
- Do not show a PSA probability chart until calibration is validated.
- Never display a placeholder PSA grade.
- Show one clear retake action when evidence is insufficient.
- Preserve every report/model version and allow professional outcomes to be
  attached later.
- Make false-defect and missed-defect reporting fast, but never treat user
  feedback as verified training truth without review.
- When exact prediction launches, display `PSA prediction`, its confidence, and
  the validated cohort/model version—not `official grade`.

## Team and operating requirements

- Computer-vision/ML engineers for geometry, temporal reflectance, defect
  segmentation, and ordinal calibration.
- Data engineer for private lineage, datasets, and reproducibility.
- Pokémon printing/finish specialist.
- Independent condition reviewers and adjudicator trained to the frozen label
  manual.
- Product/mobile engineer for capture and evidence UI.
- Security/privacy owner for consent, retention, deletion, and access audits.
- Independent statistician/evaluator for the final holdout.

## First implementation iteration

Start with the data and measurement foundation, not model training:

1. Freeze the cohort taxonomy and PSA label manual.
2. Add research consent v2 and the service-only training registry.
3. Build verified PSA-return proof review and immutable physical-card IDs.
4. Extend the evaluator with confidence intervals, calibration error,
   accuracy-versus-coverage, confusion matrices, temporal/card-level leakage
   tests, and cohort minimums.
5. Build the 100-card end-to-end instrumentation pilot.
6. Only then select training frameworks and begin the geometry/foil pilot.

This ordering prevents an expensive model from being trained on unverifiable,
leaky, or incorrectly linked labels.
