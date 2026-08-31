# PSA accuracy foundation release — 2026-08-09

## What is live

- PSA outcome normalization accepts whole grades, applicable half grades through
  8.5, qualifiers, no-grade codes, Authentic, and Authentic Altered. It rejects
  the nonexistent PSA 9.5 label.
- Every grading session has an immutable physical-card lineage ID. Regrades reuse
  that lineage instead of becoming a new card.
- Research consent v2 separately records retention, training permission, and
  professional-outcome linkage.
- User-recorded outcomes cannot mark themselves verified. Proof hashes and
  service-side review determine higher-trust states.
- Training examples, annotations, dataset manifests, model versions,
  calibration artifacts, evaluation runs, and physical-card partitions live in
  a client-inaccessible private schema.
- A physical card can have repeat captures but cannot move between train,
  validation, calibration, test, and external-holdout partitions.
- Auto-capture waits for a stable multi-frame sequence and records evidence
  sufficiency by condition area.
- The evaluator reports exact returned-label agreement, Wilson intervals,
  within-one agreement, false PSA 10s, calibration error, multiclass Brier
  score, confusion matrices, accuracy versus coverage, cohort metrics,
  repeatability, and lineage/source/temporal leakage.

## What is intentionally not claimed

Mica does not yet have enough verified prospective PSA returns to claim an exact
PSA prediction model. A clean capture is explicitly marked ineligible for exact
PSA prediction until a frozen model and cohort-specific calibration pass the
locked external holdout. Current digital grades remain visible-condition
measurements.

## Next evidence gate

Run the 100-card instrumentation pilot. Every candidate must have capture data
that predates submission, a single physical-card lineage, research consent v2,
proof of the returned PSA result, double review with adjudication, an immutable
object hash, and a frozen dataset partition. Model selection begins only after
the pilot has zero owner-access failures, zero leakage, and complete
consent/deletion coverage.
