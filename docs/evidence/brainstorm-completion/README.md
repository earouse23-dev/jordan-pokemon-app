# Brainstorm implementation and acceptance receipt

The checklist is [MICA_BRAINSTORM_COMPLETION.md](../../MICA_BRAINSTORM_COMPLETION.md). Each item is mapped to an implemented behavior, verified existing behavior, conditional capability, or explicit external acceptance. This receipt does not declare physical-camera or provider coverage complete.

## Published changes

Source `af1dd05` adds stable collection price/photo patches and value-sort handling; fresh scan-preview price reuse on save; private saved slab imagery; bounded cache-only public catalog trends; compact phone identity/value layouts; honest empty states; first-context chart reveal, touch dismissal and reduced-motion-aware real-value feedback. Existing haptic support is absent, so that conditional suggestion introduces no new native dependency.

Hosted acceptance found a final omission: the post-save route renders detail directly, bypassing the ordinary attachment loader. The shared detail renderer now starts the bounded photo read itself, and successful photo upload invalidates a previous empty-photo result. A regression fails before this correction and passes afterward in all three browser engines.

Final runtime correction: `0db1d6f`, production deployment `dpl_GriStURyEeLu5DuzBydWxZjQNcba`, shell cache 155. The frozen release passed nine-function routing checks with zero real outbound provider calls; production asset hashes, health and unauthenticated boundaries passed. Source and receipt were pushed to the existing repository.

## Actual hosted acceptance

Only two isolated acceptance accounts were used; no customer inventory was written. The owner's original Rayquaza photo went through the ordinary live photo chooser and recognition flow. The app identified Japanese Sky's Rayquaza 003/019, PSA 10; non-holo was explicitly confirmed. Saving with a synthetic $1,000 purchase cost created exactly one copy, retained the certificate, saved the photo privately, and showed the $1,776 eligible exact sold record (November 2, 2026, eBay 366763283580).

A full reload immediately restored the saved $1,776 portfolio value. Subsequent database reads retained the original quote `checkedAt`, rather than renewing it merely because the app reopened. The signed photo appears on the saved collection/detail view; URLs are absent from persisted item/price snapshots. A second isolated account returned zero first-owner inventory, attachment and portfolio rows, and Storage denied signing the first owner's photo. Redacted database assertions are in [hosted-acceptance.json](hosted-acceptance.json). Private screenshots, credentials and original-photo derivatives are excluded from Git. A fresh post-publication tab at 393 × 852 visibly retained the actual slab photo, PSA 10 context and $1,776. Browser control then rejected further taps before dispatch; the final detail-click replay is not claimed. The earlier live detail reopen and the final direct-detail regression are separate evidence.

Other original-photo recognition and external source checks are recorded in [slab-acceptance-followup](../slab-acceptance-followup/README.md). Recognition is not official certificate authentication, and an uncertain printing still needs confirmation.

## Repeatable demo acceptance

1. Use an isolated account and a small representative saved collection. Open cold, then navigate portfolio → collection → exact copy → collection. The saved amount must appear before background work; search, sort, focus and return position must survive.
2. Upload an original slab photo. Check name, set/number, language, finish/edition, grader/grade and certificate separately. Confirm uncertainty; save once; reload and reopen the same copy. The source link and amount must refer to the same eligible record.
3. Block the price response, then test timeout, quota, empty refresh and response loss. Retain legitimate saved values and drafts; positively invalidated evidence must remain removable. Repeated save must create one copy.
4. Repeat add/edit/lot/sale/import and native interrupted-save/relaunch recovery. Check retained input and exact copy counts.
5. Exercise collection controls while a background price changes or value sort reorders. A pressed/focused card must remain actionable; failed artwork must not repeatedly reload.
6. Inspect both themes at narrow phone, larger phone/tablet and desktop widths, plus long international identities, large text, zero/unknown cost, sold, filtered-empty, broken artwork and missing FX states. Verify no horizontal overflow, clipped actions or color-only trend meaning.
7. Change portfolio and card ranges, inspect dates/values by touch, dismiss outside/Escape, and repeat with Reduce Motion. A range/background update must not replay the first-draw animation or invent values.
8. Profile 1,000 distinct copies: retain existing 100-row paging and responsive controls, with no per-tile paid provider fanout. Test saved-value restoration independently of network completion.
9. Switch isolated owners and sign out. Confirm private prices, drafts and photo URLs do not leak. Verify protected pricing/portfolio routes reject unauthenticated requests.
10. Owner-only physical acceptance: camera permission/recovery, library cancel, glare/low light, background/resume, keyboard/rotation/large text, and actual VoiceOver traversal. Browser fixtures cannot close this step.

## Verification

- Unit suite: 626 total, 623 passed, three explicit environment skips, no failures. Lint and syntax checks passed.
- Combined browser matrix: 618 total, 611 passed, seven explicit environment/disposable-database skips, no failures, across desktop Chromium, mobile Chromium and mobile WebKit. Later focused checks cover fallback-image, pressed-card sorting and empty portfolio corrections.
- Final photo correction: direct-entry regression demonstrated the failure before editing; private-photo checks pass across all three engines. The final save/collection/native recovery matrix passed all 117 cases across the three browser engines.
- Schema validation: 83 public tables with RLS enabled. Hosted second-owner denial was additionally checked; table count alone is not security certification.
- [local-performance.json](local-performance.json) records local fixture timings: saved restore about 5–8ms; paint-ready about 20–32ms with network blocked; 1,000-copy rendering about 15–20ms with 100 rendered rows. These are Mac browser measurements, not physical iPhone or production-network latency promises.
- [production-verification.json](production-verification.json) identifies the actual deployment and verifies public asset hashes, health and authenticated-route boundaries against its frozen artifact.

## Unclosed external acceptance

Physical iPhone/VoiceOver acceptance remains with the owner. The prepared [provider data-quality cases](../slab-acceptance-followup/PROVIDER_DATA_QUALITY.md) remain unsent pending explicit email authorization: Ninetales newer-sale attribution, Japanese Charizard archive freshness, and the non-TCG Topps catalog gap. Do not hide these gaps with unrelated comps, active asking prices or manual customer-value overrides.

No new production dependency, migration, paid service, provider budget or platform integration was added. App Store submission and legal/commercial release are outside this acceptance.
