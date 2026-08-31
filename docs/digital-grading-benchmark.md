# Mica digital grading benchmark

Last reviewed: 2026-08-03

## What the evidence supports

Digital Grading Co is a product-capability benchmark, not verified ground truth.
Its current product demonstrates guided phone capture, category condition
analysis, decimal results, front/back defect markers, market context, report
sharing, and collection tools. Its company-authored paper describes a
79,390-card mixed-grader dataset, but the public material does not establish
physical-card leakage controls, grader-specific calibration, cohort results,
repeat-scan consistency, confidence intervals, or independent replication.

Sources reviewed:

- Current listing and release history:
  https://apps.apple.com/us/app/digital-grading-co/id1594172751
- Current interface captures:
  https://mwm.ai/apps/digital-grading-co/1594172751
- Company-authored paper:
  https://www.ijirset.com/upload/2024/october/4_Digital.pdf
- Company accuracy claim:
  https://www.digitalgrading.ai/blog/how-accurate-is-ai-grading-breaking-down-the-data-behind-deepmint-ai
- Third-party test with internally inconsistent headline/table:
  https://tcgtalk.com/guides/digital-grading-company-review
- Google Play reviews:
  https://play.google.com/store/apps/details?id=com.dominicapps.dgc
- Collector discussion:
  https://www.reddit.com/r/PokeGrading/comments/1tritij/thoughts_on_digital_grading_company_app/
- Current camera/false-whitening discussion:
  https://www.reddit.com/r/PokeGrading/comments/1tf9pkx/digital_grading_co_app_am_i_doing_something_wrong/
- Current implausible-high-score discussion:
  https://www.reddit.com/r/PokeGrading/comments/1v9ic3d/thoughts_on_grading/
- Privacy policy:
  https://www.digitalgrading.ai/priv-policy
- Official PSA grade and centering standards:
  https://www.psacard.com/gradingstandards

The recurring failure risks are inconsistent rescans, shadows or reflections
becoming false defects, missed scratches and creases, capture failures, and
lost results. No independently labeled evidence supporting a 98% accuracy
claim was found. Mica must not publish that number or claim DGC equivalence.

## July 2026 capability re-audit

The current App Store release is 2.9.7. Public release notes show a redesigned
instant grading/capture flow in 2.7.1 and front/back defect mapping plus revised
grading engines in 2.8.1. Current store screenshots show:

- a decimal overall condition result;
- separate front and back values inside centering, corner, edge, and surface
  categories;
- numbered defect markers that open an evidence detail view;
- named model stages during processing;
- a permanent report number and report actions.

This is useful capability evidence, not accuracy evidence. Current Google Play
reviews describe the same card producing different results, changing defects,
missed scratches or print errors, false whitening, failed scans, and reports
disappearing. Current collector threads also show unclear phone captures,
missed visible back whitening, and an 8.9 output on a card commenters place
much lower because of structural wear. Third-party review material likewise
contains severe-card/high-score examples and contradictory accuracy summaries.
Mica therefore treats repeatability, major-damage fail-safes, immutable
model/rubric versions, report durability, and cross-review defect agreement as
release requirements.

## Mica’s implemented baseline

Mica now:

- requires front, back, alternate-light front, and alternate-light back photos
  in one uninterrupted default route;
- checks local brightness, contrast, sharpness, glare, shadow, resolution, and
  camera stability before spending an AI allowance;
- displays a live two-axis device level when the browser exposes gravity
  sensors, requires a three-degree parallel-camera tolerance for automatic
  capture, and stores the measured tilt with the report;
- detects the card boundary inside the guided frame, rejects incomplete or
  trapezoidal captures, and records aspect and perspective deltas;
- provides an optional three-second hands-off shutter plus keyboard-style
  remote shutter support to reduce movement on tripod or stand setups;
- crops guided captures to the verified card boundary before analysis and
  measures printed-border left/right and top/bottom ratios when a consistent
  border is actually detectable;
- requests removal of sleeves and cases and a plain contrasting background;
- preserves up to a 3072-pixel prepared capture instead of forcing all grading
  evidence into a 2048-pixel whole image;
- sends structured, no-storage Gateway requests and verifies currently
  available image-capable models before fallback;
- rejects unsupported findings and requires each retained finding to have a
  side, visible description, confidence, and normalized region;
- withholds PSA probability output unless a versioned held-out calibration
  artifact is explicitly validated; the visible-condition score remains useful
  without turning it into invented professional-grade odds;
- runs up to three independent provider-family Gateway reviews in parallel for
  precision grading, promotes only majority-localized defects, uses the closest
  agreeing grade interpretations, exposes any excluded outlier, and abstains
  when no two reviews agree within one grade;
- persists bounded review-agreement metadata with the private report so the
  reviewer count, evidence threshold, withheld mentions, disagreement, and any
  excluded outlier remain inspectable after refresh without storing raw model
  output;
- reports a one-decimal Mica condition measurement, its range, front/back
  category values, and a warning that decimal display is not professional-grade
  certainty;
- blocks a numerical condition score and PSA prediction when localized evidence
  contains a critical finding or a major crease/dent, preventing a severe card
  from receiving a deceptively confident high result;
- evaluates measurable left/right borders against PSA's published approximate
  PSA 10 front (55/45) and back (75/25) guidance, labels incomplete checks, and
  links the official standard while preserving PSA's stated eye-appeal
  discretion;
- turns uncertain findings into guided alternate-side, corner, edge, or
  angled-light capture actions, then reruns the independent reviews inside the
  same private report;
- refuses to finalize a possible PSA 9 or 10 from the first lighting setup:
  alternate-light full-card front and back captures must both survive the
  independent-review pipeline before the provisional high-grade prediction is
  shown;
- stores an immutable versioned report, measurements, hashes, findings, model
  identity, and later professional return under owner-scoped RLS;
- lists recent completed, abstained, failed, and interrupted sessions in
  Collection so a report cannot silently vanish from the user experience;
- blocks a result whose exact name, set, collector number, language, or variant conflicts
  with the card being graded;
- preserves the prior DG number when a regrade moves by more than the safe
  tolerance or radically changes high-confidence defect categories;
- keeps normal photos transient, stores at most one private card-only recent
  thumbnail behind a five-minute signed URL, and provides separate, revocable
  research consent for private retained captures;
- lets users compare scans, report a false defect, generate a locally rendered
  estimate-labeled report image, confirm a result for Collection, and link a
  professional return.

Current geometry is a conservative guided-frame boundary crop, not a trained
general-purpose card segmenter or full perspective rectifier. Printed-border
centering uses deterministic gradient consistency and abstains for borderless
or visually ambiguous artwork; it has not yet been validated against
independent physical measurements. Current corner, edge, and surface findings
come from cross-model localized multimodal output, not specialized production
detectors. Professional-grade odds are deliberately labeled
`psa-held-out-calibration-required-v1` and remain unavailable until validated.

## Private evaluation

`npm run evaluate:vision -- <private-manifest.json>` evaluates recorded output.
Add `--live` only with a private access token and approved Gateway usage.

`npm run benchmark:grading-models -- <private-manifest.json> --confirm-cost`
compares at least two provider families through Vercel AI Gateway. The command
requires an explicit cost acknowledgement, writes a private mode-0600 report,
and does not convert the comparison into a public accuracy claim.

The evaluator measures exact agreement, within-one agreement, mean absolute
error, Brier score, grade-range coverage, false PSA-10 recommendations,
abstention, completion, repeat-scan consistency, defect precision/recall,
centering error, latency, and declared cohorts. Private photos, manifests, and
reports stay outside version control.

## Dataset and release gates

The following are evidence collection milestones, not completed claims:

1. Internal engineering: at least 500 verified PSA returns and 100 repeat-scan
   groups.
2. Closed beta: at least 2,000 verified PSA outcomes with meaningful cohort
   coverage.
3. Public report: an independently protected 5,000-card holdout reviewed by an
   evaluator who did not build the final model.

Beta requires at least 95% within one PSA grade, at least 95% repeat scans
within 0.5 Mica condition points, at most 5% false positives among
high-confidence PSA-10 recommendations, at least 90% supported-workflow scan
completion, no severe cohort regression, and visible localized evidence for
every reported defect. Until those gates pass, every result remains a private
estimate and no accuracy percentage may appear in product or marketing copy.
