# Slab intake correction

## Root causes and repairs

- Identification shared grading's 600px minimum, rejecting the supplied 360px-wide readable screenshots. Identification now accepts sources at least 256px on their short edge; grading retains its stricter limit. Recognition quality can still request a better photo.
- The model's separate name, set and number were concatenated and then reparsed through a limited known-set list. Structured observations now reach catalog resolution directly. Bare slab-label numbers become explicit searchable numbers without inventing denominators; the delta species marker no longer prevents an exact Ninetales title comparison.
- Identification retains the full source as evidence even if document isolation finds only the inner card. The slab evidence panel includes the whole card rather than incorrectly labelling a bottom-only crop as the card.
- The model instructions explicitly cover rotated labels, label facts when card text is cropped, printed language, non-TCG titles and back-only negative evidence. OCR observations are not certificate authentication.
- If local/TCGdex catalog coverage is absent, a bounded metadata-only PkmnPrices lookup uses the existing durable request cache, budget and rate guard. Candidate results require user confirmation. No unsupported printing or price is invented.
- Manual search recovery retains owner/session-bound slab grade, qualifier, certificate and photo. Direct match and manual selection share the same detail handoff. Fresh uploads, account changes and saved-copy resets clear pending recovery state.
- Catalog previews can confirm printing before owning the card. Previously the confirmation action only existed for owned copies. Confirmation retains the scan context without writing an inventory entry.
- Price-response rerenders retain the focused valuation input's draft instead of replacing typed text.

## Automated verification before publication

- Node suite: 605 passed, 3 skipped, zero failed.
- Relevant browser matrix (intake, detail recovery, price evidence, collection continuity): 175 passed, 2 skipped, zero failed across desktop Chromium, mobile Chromium and mobile WebKit.
- Added manual-recovery and preview-confirmation regressions: 6 passed across the same projects. They verify PSA 9 and the certificate survive through the add-copy form.
- Readable 360×782 screenshot identification regression passes while grading correctly rejects that resolution.
- Provider metadata fallback test checks an 8-row bound, Japanese language, repeat-read caching, exclusion of English cards and explicit review status.
- Lint and syntax checks passed. No migration, dependency, provider budget increase or native/store change.

## Live acceptance

Pending real-photo retest after publication. Automated fixtures do not certify recognition or external sales coverage. Original photos and private audit evidence remain excluded from Git. No customer inventory write testing is authorized.

UI/motion work in this task is a plan only: `docs/MICA_IOS_UI_MOTION_PLAN_2026-11-14.md`.
