# Mica: next polish ideas

Owner request: add saved price-history previews, then brainstorm improvements across reliability, efficiency, workflows, quality of life, UI, UX and motion. Only the previews are implemented in this task. The ideas below are proposals to validate, not a claim that every listed defect currently exists, and not authorization to add all of them.

## What shipped with this task

Collection entries and both quick/manual catalog search surfaces have a compact three-month price trend: green up, red down, neutral unchanged. The line uses saved matching history, daily median values, elapsed dates and a signed percentage. Purchase P/L remains distinct. The SVGs do not fetch prices, create chart-library instances or run decorative animations.

Slabs use validated exact sold evidence or validated exact historical records for their grading context. Raw catalog references explicitly say NM (Near Mint); they may reuse only a matching saved raw Near Mint printing or an owner-scoped preview cache. No raw/PSA/CGC substitution. Missing history remains a dash: an unseen catalog card cannot truthfully acquire a trend without a source. These previews do not add a paid history request for every search result.

## Recommended order

| Priority | Improvement | Why it matters | Acceptance evidence |
| --- | --- | --- | --- |
| Before demo | Repeat the client's complete slab journey with the supplied photos | Correct set, language, printing, grade and certificate matter more than visual extras | Upload → recognize → correct when uncertain → save once → reopen with retained price; compare eligible exact sold records. Keep the non-TCG catalog gap explicit. |
| Before demo | Prove cold/warm/offline pricing behavior across screens and tabs | Prevent regression of the blank-price and repeated-credit problems | Cached value survives provider timeout, quota response and empty refresh; fresh quotes are not repurchased; a real correction can replace invalid evidence. |
| Before demo | Verify return position and focus | Collectors repeatedly enter/leave card pages while browsing | Return to the same collection row, filters, sort, search and focus, including after a background price update. Source already preserves some scroll/search state; extend tests before changing it. |
| Before demo | Test the actual physical camera lifecycle | Simulator/web fixtures cannot prove focus, exposure, permission and interruption behavior | On a real iPhone: permission denied, photo library cancel, phone call/background, camera in use, repeated capture and low light. Retain the existing photo/search escape routes. |
| Before demo | One interruption test for every save path | A polished app must preserve work under weak connectivity | Pending save, lost response, retry, route change and sign-in expiry retain the draft and create one copy. Reuse current idempotency and recovery behavior. |

## Reliability and pricing

- **Exact-comp audit trail:** keep price/evidence/grade/printing together. Opening a source should refer to the same recorded sale; relocated or expired marketplace pages should not silently validate another card. Build on the existing sold-link repair and matching checks.
- **Corrections versus temporary failures:** test explicitly that a known bad sale is removable while a timeout cannot erase the last good quote. “Always retain” must never mean retaining evidence that has been positively disproven.
- **Sparse history honesty:** keep a concise coverage fact in optional details. Do not add zeros, purchase cost or interpolated daily observations to a card's market history. The portfolio's identified purchase-price fallback is a different series.
- **Duplicate certificate check:** consider a quiet “Already saved” result when the exact same grader/certificate appears twice. It should lead to the saved copy; allow correction of an OCR mistake without destroying either record. Validate the need before adding a confirmation screen.
- **No surprise state resets:** add tests for price refresh while a user has a filter, disclosure, keyboard field or chart range active. Patch the changed node when a whole-list replacement causes an observed interruption.

## Speed and efficiency

- **A cache-only catalog batch read:** if broad catalog preview coverage is needed, return a small public/reference trend summary from the existing saved market cache with search results. Keep private owner positions out of public search. Do not fan out one paid provider request per tile. This task deliberately does not add that backend workflow.
- **Measure cold start separately from warm navigation:** record when the first saved value appears, when controls become usable and when background refresh settles. A spinner finishing is not the same as the app responding quickly.
- **Profile the existing large-collection paging:** use the agreed 1,000-copy account scenario before introducing virtualization. Keep thumbnails lazy, reserve their dimensions, and avoid recomputing complete sold archives or rebuilding unchanged rows during scrolling.
- **Prove shared refresh deduplication:** test two open tabs and detail/collection/portfolio transitions against the current server cache and request guards. Add coordination only if duplicate calls are demonstrated.
- **Resume backfills:** continue stored history cursors/checkpoints after an interrupted job, with the existing budget guard. Never restart a paid history download merely because the app reopened.

## UI and UX

- **Prefer the saved slab photo where available:** explore showing the collector's actual slab image instead of only raw catalog artwork, using existing private-photo access. Keep catalog artwork as a fallback. This makes the same collection view feel more specific to a slab collector without adding a new destination.
- **Separate market trend from personal return:** keep 3M movement beside the miniature chart and purchase P/L explicitly labeled. Neither should inherit the other's color or calculation.
- **Chart inspection by touch:** review thumb placement, scrubbing, date/value readouts and dismissal on the main charts. Critical price and direction must remain visible without long press. Mini previews should stay static and open the existing detail page.
- **One card identity hierarchy:** audit name → set/number → grader/grade → finish/edition/language in collection, search, scan review and detail. Long names should wrap predictably; exact copyable titles stay available.
- **A concise failure vocabulary:** distinguish no recorded history, older saved quote, temporary refresh failure and uncertain identity with short wording. Put provider mechanics and lengthy explanations in optional details.
- **Finish the smallest states:** empty collection, filtered-empty collection, zero cost, sold copies, missing purchase date, image failure, huge prices, long German/Japanese identities and unavailable currency conversion should be intentional layouts, not generic paragraphs.

## Quality of life

- **Review existing defaults rather than adding screens:** preserve currency and deliberate acquisition choices; keep the current date as the normal acquisition default. Never reuse a previous card's grade/certificate as a new card's identity.
- **Make rapid entry predictable:** after saving, offer the existing “add another” path without clearing useful search context. Avoid automatically reopening a camera or adding copies twice after a slow response.
- **Physical-phone keyboard acceptance:** ensure price/date/notes inputs and the save action remain reachable when the keyboard opens, after rotation and with larger text.
- **Screen-reader pass through the real workflows:** announce the card, exact grade, price and trend without duplicate date/currency chatter. Test focus after capture, save, retry and returning to a list, beyond automated accessibility names.

## Motion and feedback

- **Small, purposeful transitions:** retain brief press feedback and sheet motion; let navigation and chart selection remain interruptible. Avoid animating every miniature chart as it scrolls into view.
- **Background-price change feedback:** consider one subtle, brief emphasis on the changed value only; preserve layout and selected chart range. Do not roll through fake intermediate dollar values.
- **Chart transitions:** keep first draw distinct from range changes. A range switch should preserve context without blanking, replaying a long intro or visually morphing unrelated prices into invented transactions.
- **Native haptics, only on meaningful completion:** consider a light existing-platform confirmation for a successful save, not for every tap or failed request. Verify supported native capability first; no new plugin or platform change is implied.
- **Reduce Motion throughout:** the same information and success/failure feedback must remain available with all motion disabled.

## Security and release polish

- **Owner-isolation acceptance:** test cached previews, photos, logout/login, two accounts and recovery with dedicated fixtures. A faster cache must not expose another owner's collection or certificate data.
- **Keep optional integrations quiet:** unavailable certificate authentication, push or catalog coverage must not look active. OCR and a saved certificate string are not official authentication.
- **One repeatable demo acceptance script:** run a small representative collection, all supported screen classes, both themes, cold/warm loading and an interrupted save before showing Jordan. Record failures and residual limits. Passing infrastructure tests alone is insufficient.

## Research basis

These are Mica-specific engineering proposals, informed by public guidance, not claims about Komp's private architecture. The supplied Komp screenshot is a visual reference, not proof of its pricing methodology.

- Apple recommends clear chart hierarchy, compact plot space, accessible descriptions and alternatives to color-only meaning: [Charts](https://developer.apple.com/design/human-interface-guidelines/charts).
- Apple recommends purposeful motion that respects system/accessibility behavior: [Motion](https://developer.apple.com/design/human-interface-guidelines/motion).
- Accessibility should be built into the workflow and checked across interaction modes: [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
- Google's performance guidance prioritizes measured interaction latency and reducing work that blocks input/rendering. Use the 200ms INP threshold as a measurement target, not an unmeasured claim about Mica: [Optimize INP](https://web.dev/articles/optimize-inp).

All suggestions should use the existing stack and included credits first. Purchases, new production dependencies, destructive migrations and store/platform actions retain their existing approval boundaries.
