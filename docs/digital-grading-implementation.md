# Evidence-first grading implementation

Last updated: 2026-08-03

## Delivered in this release

### Capture and recovery

- One uninterrupted four-view camera route: front, back, alternate-light front,
  and alternate-light back. It includes permission handling, automatic capture,
  manual shutter, saved-photo fallback, retake guidance, and refresh-safe
  database sessions.
- Live Light, Focus, Frame, Level, and Steady checks make capture readiness
  visible instead of hiding quality failures after submission.
- Optional three-second hands-off shutter and Enter/Space keyboard-style remote
  shutter for tripod or stand captures. Browser security does not expose native
  phone volume buttons, so Mica does not claim those as supported.
- Optional device-motion permission on iOS and automatic gravity sensing where
  available, with a live two-axis level and a three-degree capture threshold.
- Guided-frame boundary measurement that records card bounds, aspect error,
  perspective error, edge confidence, device tilt, and capture method.
- Automatic normalization crops a passing guided capture to the detected card
  boundary while retaining the source-frame bounds in the private report.
- Deterministic printed-border measurement reports front/back left-right and
  top-bottom ratios only when a stable border is detected; otherwise it records
  why the measurement abstained.
- Measurable borders receive a separate PSA 10 guideline check using PSA's
  published approximate 55/45 front and 75/25 back limits. Incomplete
  front/back evidence is labeled incomplete rather than passed.
- Report-requested alternate-side, corner, edge, and angled-light evidence can
  be captured inside the same session and reruns both independent reviews.
- Local quality checks before a Gateway allowance is claimed.
- Prepared 3072-pixel grading evidence, per-image SHA-256 hashes, quality
  measurements, and measured guided-frame geometry.
- Idempotent session creation and usage claims. If a completed request is
  retried with the same scan ID, the API returns the saved report instead of
  calling a model again.
- Collection exposes recent owner-scoped grading sessions. Completed reports,
  abstentions, and interrupted captures no longer disappear into an invisible
  queue; attached cards can be opened or restarted directly.
- A private session is created before the first camera view. Its state advances
  from capture to analysis to completed/abstained, and analysis failures are
  retained as retryable history instead of vanishing.

### Hybrid evidence layer

- Runtime discovery of currently available image-capable Gateway models and
  verified cross-provider fallbacks.
- Versioned model-bundle and rubric identifiers. Professional-grade odds remain
  unavailable until a versioned held-out PSA calibration artifact is supplied.
- Structured quality, identity, centering, subscore, defect, and follow-up
  capture contracts.
- Evidence verification that discards claims without a supported side,
  description, confidence, and bounded region.
- Every numbered retained defect opens an on-device enlarged evidence crop with
  side, severity, confidence, and cross-review status; the crop is not
  re-uploaded or persisted.
- Up to three independent provider-family reviews run in parallel for precision
  grading. At least two must complete. Only majority-localized defects survive
  as report evidence; non-majority findings become follow-up capture requests.
- When two grade interpretations agree and a third is an outlier, the majority
  range is used with an explicit confidence penalty, the outlier remains
  visible in report metadata, and alternate front/back evidence is requested.
  If no two reviews agree within one grade, Mica abstains.
- A possible PSA 9 or 10 is held behind a high-grade verification gate. Mica
  requires alternate-light full-card front and back captures, reruns the
  independent reviews, and remains abstained until both sides are present.
- Review agreement is stored as bounded decision metadata on the owner-protected
  report. Saved reports preserve the review count, evidence threshold,
  disagreement, withheld findings, and outlier count without storing raw
  provider responses, prompts, or ordinary card photos.
- Separate front and back category ranges plus an unvalidated one-decimal Mica
  condition score. The decimal score is derived from a frozen weighted rubric
  with the weakest measured area limiting the result.
- Rubric v4 refuses a decimal score or PSA prediction when visible localized
  evidence contains a critical defect or a major crease/dent. This deliberately
  prioritizes false-high-grade prevention over completion rate.
- The same rubric abstains when any major localized corner, edge, or surface
  finding contradicts a high overall or category range instead of averaging an
  internally inconsistent result.
- Three deliberately separate report answers: Mica visible-condition score,
  professional-grade prediction, and financial submission decision. Mica never
  converts the condition score into a fabricated PSA probability distribution.
- Exact name, set, collector number, language, and variant agreement is required before
  a high-confidence result can attach to a card. A conflicting Japanese or
  English printing is blocked instead of silently saved.
- Regrades compare score movement and high-confidence defect categories with
  the saved DG assessment. A large unexplained change preserves the previous
  DG number and asks for another controlled capture rather than overwriting it.
  A smaller but material repeatable change requires explicit confirmation.

### Private data and reports

- Owner-scoped scan, capture, evidence, prediction, outcome, feedback, and
  versioned consent records.
- Normal mode retains measurements and hashes but no photo storage path.
- Recent Grading may retain one metadata-stripped, card-only JPEG thumbnail in
  a separate private bucket. Signed links expire after five minutes and the
  service worker never caches them. Normal capture photos remain transient.
- Explicit research opt-in uses a private owner-folder bucket. Revocation
  deletes retained captures and clears their training eligibility.
- Account deletion removes private research objects before deleting the auth
  identity; database rows then cascade.
- Confirmed reports are immutable to later report-save retries. Regrades retain
  previous-session lineage and monotonically increasing report versions.
- Confirmation is one owner-scoped database operation. It verifies exact raw
  identity, splits one FIFO-preserving physical copy from quantity positions,
  supersedes the prior attached report, and attaches the new report atomically.
- If exact catalog identity is proven but the card is absent, one focused action
  can create the raw copy and attach its report while leaving acquisition amount
  and date explicitly unknown.
- Saved history, scan comparison, false-defect feedback, a locally rendered
  estimate-labeled report image, Collection confirmation, Batch Grading
  compatibility, and professional-return linkage.
- Report images contain identity, condition score/range, professional-outcome
  availability,
  scan confidence, retained-finding count, four category ranges, the evidence
  method, and a permanent unofficial-estimate warning. They omit private
  purchase and account data and do not upload a new image to create the share.

### Evaluation instrumentation

- Private evaluation for agreement, calibration, repeatability, defects,
  centering, completion, latency, and cohorts.
- Cost-confirmed two-family Gateway comparison command.
- No code path publishes a grading-accuracy percentage.

## Deliberately not represented as complete

The app does not yet have a trained general-purpose physical-card segmenter,
full perspective rectifier, independently validated printed-border measurement
model, or specialized corner, edge, and surface detector. The current boundary
and border checks intentionally accept only measurable evidence from Mica's
plain-background guide. The remaining components require licensed training
data, reviewer labels, device/lighting repeat sets, and verified PSA returns.
Replacing them with confident multimodal prose would create false evidence, so
Mica abstains and records the limitation instead.

CGC, BGS, TAG, and SGC prediction remain out of scope until each grader has an
independent dataset and calibration. Pricing is kept separate from condition
prediction. Mica does not make counterfeit or authenticity claims.

## Next evidence-dependent work

1. Collect explicit-consent, pre-submission front/back/angled captures and
   returned PSA outcomes.
2. Write labeling instructions and obtain two independent defect reviews plus
   adjudication.
3. Validate the guided boundary crop and printed-border measurements against
   independently measured cards, then train and freeze a general geometry model.
4. Train specialized defect models and require localized masks from their
   outputs.
5. Run the 500-card/100-repeat internal evaluation.
6. Select the production reasoner only after the private cross-family
   benchmark.
7. Conduct the 2,000-card closed beta and keep the 5,000-card public holdout
   inaccessible to tuning.

No stage may be skipped by substituting DGC output or AI self-labels for
professional outcomes. DGC interaction patterns are a product benchmark, not
an accuracy label.
