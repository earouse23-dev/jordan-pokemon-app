# Core demo polish — October 21, 2026

Owner approved the existing-flow polish plan and emphasized quality over additional features. Reused existing camera/search, title generation, pricing evidence, saved portfolio and save/recovery code. No new dependency, provider endpoint, schema, subscription, notification or operating-budget change.

## Scope and staged acceptance

1. Camera: library/shutter/search controls. Search closes the sensitive camera sheet and stops its stream, then opens the existing catalog search with keyboard focus. Return preserves the original capture configuration/callback and refuses a stale owner/session. Permission denial still leaves search available. Synthetic live/denied tests cover cleanup, return, target size/order and no price/inventory writes (ordinary ingestion diagnostics remain).
2. Detail: retain the complete generated identity and add a full-title clipboard action with an honest manual-copy fallback. Keep name dominant, constrain secondary facts, emphasize the actual selected professional grade, and show date/amount on the existing validated eBay source link. Unknown prices use smaller result text. No change to exact-sale eligibility or valuation.
3. Add/save: preserve the existing confirmation, repeat-entry/search and idempotent recovery flows. No additional confirmation screen or batch feature. Verify interrupted saves, preview-price handoff, duplicate prevention, stale sessions, photos and quantities with existing workflow tests.
4. Portfolio: show top holdings by total position value, converting only with an available compatible display rate and placing unpriced/unconvertible positions last. Compute each ranking value once per render. Align update status with the total and remove empty status space. Keep chart dimensions, history, acquisition dates, estimates, ranges and independent P/L semantics.
5. Speed/recovery: retain current-price-first and saved-history-first paths. No additional pricing requests for copy-title, camera/search switching or ranking. Verify repeated chart renders, atomic refresh and saved pricing reuse rather than adding another cache.
6. Interface review: inspect actual rendered phone/desktop screenshots; cover 375px SE dimensions, light/dark/reflow and WebKit through the existing browser checks. Synthetic camera tests are not physical camera/glare acceptance. Elliott remains responsible for the physical iPhone walkthrough.

Service-worker shell and theme URL advance together so existing Safari installations receive the CSS update. The app module URL remains compatible with the current bundle/tests. Existing runtime cache, routing and crons stay unchanged.

## Verification and publication

Lint (101 source files), syntax/type checks and all 585 active unit checks passed (three explicit environment skips). The final six-file browser run passed 351 checks and skipped three; its three failures were the old assumption that the first unpriced dashboard row must be Charizard. Ranking now changes that order. The test now explicitly opens the preserved Charizard row and passes in all three browser projects, giving 354 accepted browser cases. An earlier run also exposed the obsolete “Your cards” heading expectation. No product failure was hidden or assertion removed: the inventory count, unpriced total, acquisition facts, routing and ownership assertions remain.

Focused checks verify the camera search and return with both live synthetic video and denied permission, stopped tracks, separate 44px-or-larger targets, no pricing requests or inventory writes, exact copied identity, visible grade, total-position ranking, repeated-entry language/query continuity, uncertain-save recovery, source validation, existing chart/cache behavior and preview-price reuse. Synthetic screenshots were visually reviewed and retained beside this report. The missing-price screenshot intentionally uses a placeholder image and no provider evidence; it is not a real pricing demonstration.

Deployment evidence is appended after staging. This work is a core Safari-demo polish pass, not a public commercial release or App Store submission.
