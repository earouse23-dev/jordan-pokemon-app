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

- Node suite: 609 passed, 3 skipped, zero failed.
- Relevant browser matrix (intake, detail recovery, price evidence, collection continuity): 175 passed, 2 skipped, zero failed across desktop Chromium, mobile Chromium and mobile WebKit.
- Added manual-recovery and preview-confirmation regressions: 6 passed across the same projects. They verify PSA 9 and the certificate survive through the add-copy form.
- Readable 360×782 screenshot identification regression passes while grading correctly rejects that resolution.
- Provider metadata fallback test checks an 8-row bound, Japanese language, repeat-read caching, exclusion of English cards and explicit review status.
- Lint and syntax checks passed. No migration, dependency, provider budget increase or native/store change.

## Live acceptance

Pending real-photo retest after publication. Automated fixtures do not certify recognition or external sales coverage. Original photos and private audit evidence remain excluded from Git. No customer inventory write testing is authorized.

UI/motion work in this task is a plan only: `docs/MICA_IOS_UI_MOTION_PLAN_2026-11-14.md`.

## Real-photo follow-up findings

The initial repaired build accepts both 360px screenshots and reads their Japanese/PSA identity evidence, but catalog resolution still failed. Live recovery showed Japanese printed names, `Charizard-Holo` and `Stormfront-1st Ed.` being passed as canonical catalog fields. A follow-up preserves the actually visible English label title separately, removes only known label annotations for lookup, and permits at most two observed-name metadata searches through the same budget/cache path.

Ninetales now opens the correct Dragon Frontiers 8/101 PSA 9 preview and retains printed certificate 132008880 in the add form without manual re-entry. The live price was unavailable; inspection identified delta-species title formatting differences between the catalog and provider. The follow-up normalizes that label/title equivalence for lookup and sale validation while retaining set/number/language/context exclusions. Regression tests accept the same printing with or without a delta suffix and reject a different collector number.

The sideways Topps photo is now read as Trying Out the New Toy #7 rather than a generic Mewtwo search. Catalog/provider coverage remains unconfirmed. Back-only photo produced no guessed grade or price. The final live coverage result must be recorded after follow-up deployment; these partial observations are not acceptance.

Follow-up browser subset: 30 passed, zero failures, including label-tier preservation, Japanese intake, manual recovery, preview confirmation and late-owner guards. UI no-match state retains recognized slab facts rather than implying every catalog gap needs a better photo.

## Scan-to-price handoff correction

A further live trace found that unowned graded previews loaded the reference index but did not automatically request exact sold comps. The primary value waited behind Check sales. Graded previews now start the exact-context sales lookup, keep an owner/context-bound reusable result for 24 hours, retain that value through saving, and skip a redundant legacy collection refresh for fresh graded evidence. The normal server valuation path still publishes the durable owner record; cached browser evidence does not bypass server validation.

A real non-holo lookup exposed another contract mismatch: canonical `non_holo` and `reverse_holofoil` values were rejected by the sales endpoint's text validator, and its adapter compared canonical finishes against legacy camel-case/Normal labels. Both layers now accept and normalize these supported contexts while continuing to reject another finish or unknown-attribution sale.

The printing-confirmation form starts from recognized known facts and leaves unknown choices open. Its preview copy no longer describes nonexistent purchase/correction history.

Latest Node run: 610 passed, 3 skipped. The explicit preview-to-save browser test passes on desktop Chromium, mobile Chromium and mobile WebKit: automatic sold-price load, no duplicate lookup on reopening, value retained in the new owned copy, and an independent lookup for another owner.

## Final provider-label correction

The real Rayquaza request reached the provider successfully but returned no eligible value. Its exact-attributed November 2 PSA 10 row is labelled `Unlimited`, not `Normal`. The existing matcher already treated the provider's `1st Edition` label as the non-holo edition but lacked its unlimited counterpart. Added an explicit `Unlimited` → `unlimited normal` comparison alias. Original evidence keeps the provider's original label. Holo, first edition and unknown attribution remain excluded by separate checks.

The normalized archive cache advances to v6 so previously screened-out rows can be reprocessed. Raw provider-response cache and saved owner histories remain intact; no SQL or destructive invalidation is involved. Tests reproduce the Rayquaza title/set/number match and reject another finish, edition and unknown attribution. Final Node suite: 611 passed, 3 skipped. Final UI/source matrix before this alias: 175 passed, 2 skipped; all 36 price-evidence browser cases passed again with the final alias across all three browser projects.
