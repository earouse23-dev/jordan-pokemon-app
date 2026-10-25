# Mica quality audit — October 25, 2026

**Verdict: the core collection loop is substantially stronger, but I would not give the whole interface final demo sign-off yet.** Four concrete interface defects remain, alongside a smaller consistency pass. No new product feature or framework is needed. Fix the defects below, then repeat the affected real screens and Elliott's physical Safari capture walkthrough.

Audited canonical production release `63571afcf89508fc1df38e46d12aee0d38a122d0`, repository head `a4b7c9c`, current database metadata/advisors and the current source's release gate. This was an audit: application source, production configuration, dependencies and deployment were not changed. Normal application loading refreshed its saved pricing. Write acceptance used only the approved isolated demo account; two test copies were archived afterward. Customer inventory and preferences were not edited.

## 1. Fix before Jordan's unrestricted walkthrough

### P1 — Dark-mode search results are almost unreadable

**Observed:** Add cards → name/set search → “Blastoise base set” returns three correct visible printing choices. In dark appearance, the result backgrounds are cream while their text uses the dark theme's pale colors. This affects the result itself, rather than an animation or loading placeholder. [Actual 320px screenshot](evidence/full-audit-2026-10-25/search-dark-320.png).

**Root cause:** `themes.css:5273–5286` gives `.quick-card-result` a hardcoded light gradient and hover decoration. Later theme rules change text tokens without replacing this specific background. The title's measured contrast against the gradient endpoints is approximately **1.04–1.12:1**; metadata and variant colors are also below 2.15:1. These are active, meaningful small-text controls. W3C's normal-text requirement is 4.5:1; the failure is not just a preference for stronger colors. [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Correct repair:** replace that old decorative rule with the existing semantic surface/text/border tokens; remove its conflicting hover lift/shadow. Inspect sibling catalog/manual/sealed result components for the same mismatch. Add one rendered contrast check covering loaded quick-search results, both appearances and hover/focus. Existing settings/sidebar contrast tests did not cover this component.

### P1 — Quick-search printing choices have identical accessible names

**Observed:** all three quick-search result buttons announce “View Blastoise from Base Set, number 2/102”. Their Add and Queue actions also omit the printing. The visible choices differ: Holofoil, 1st Edition Holofoil and Non-holo. A user navigating by accessible names cannot tell which printing an action selects.

**Root cause:** explicit labels in `app.js:19427` override the meaningful variant text inside the button. The *manual-search sheet already includes language and variant in its labels*, so the October 21 issue was repaired on one path but remains on its sibling. The current core gate's final search test expressly covers manual printing choices, which explains why a green gate missed quick search.

**Correct repair:** use the existing normalized printing summary consistently for View, Add and Queue names on both search paths. Preserve the short visible labels. Test distinct names and exact clicked identity for same-name editions/finishes/languages; do not merge the results to make the names unique.

### P1 — “Choose a photo” is skipped by keyboard navigation

**Observed:** on the Add screen, Tab after “Take a photo” moves straight to “Add unopened products”. The visible photo-library tile has `tabIndex=-1` and no button role. The associated file input is hidden. Mouse/touch activation remains available; keyboard access to this control does not.

**Root cause:** the tile is a plain label (`index.html:721`), associated with the hidden `#galleryInput` at line 860. Native labels do not become keyboard buttons simply because they look like buttons. The camera's library control already has explicit keyboard support, but this Add-screen control does not.

**Correct repair:** reuse the existing file input with a real button, or make the native input accessible using the established visually-hidden control pattern. Keep the label, focus indication and file restrictions. Test keyboard activation without requiring an actual upload. Do not solve it by removing photo-library selection.

### P1 — The UI launches digital grading that production cannot complete

**Observed:** expanding Library → Pregrading & grading history exposes an enabled “Digital grader / Open the camera / Start scan” button. Production capabilities report grading `release_hold`; the deployed vision handler rejects every POST mode except `identify`. A fresh unauthenticated grade-mode probe also returned the deliberate hold, without an image or provider execution.

**Root cause:** `beginDigitalGrading()` (`app.js:13247`) starts a durable scan session and proceeds toward capture without checking the deployed grading capability. The launch button (`index.html:644`) and raw-card grading actions (`app.js:7224`) similarly do not reflect availability. `api/vision.js:794–798` intentionally preserves the hold. Browser grading fixtures supplying successful responses do not establish that this production route is enabled.

**Correct repair for this demo:** use the existing capabilities response to prevent a new grading session before any write or capture begins, with a short unavailable state. Keep saved grading reports and required professional-grade/certificate records accessible. Apply the guard to every entry point, including raw-card actions, resumed scans and settings/tools. Do not enable a held AI surface or delete historic grading data to hide the mismatch. Live digital-grading activation remains separately qualified work.

## 2. Polish the remaining inconsistent screens

These are design recommendations, not newly proven save failures.

| Area | What still feels unfinished | Focused change |
| --- | --- | --- |
| Library grid | At 390px, the first two cards are about 430px tall. Each repeats “Position value”, a sold-estimate sentence and a full “Up … since purchase” sentence. The value label wraps beside the number. Favorites/Vintage tags add more competing labels. | Lead with art, name, compact set/number and grade, then value and one compact gain line. Keep stale/missing evidence visible; put methodology in detail. Preserve quantities and exact identity. |
| Search actions | Every result exposes View, Add and Queue; the phone has little space for all three equally visible actions. | Make the existing review/add path visually dominant and keep batch Queue secondary. No new intermediate screen and no removal of batch safety. |
| Filter sheet | The first disclosure exposes roughly twenty controls, mixing common set/grader/grade choices with basis, movement, acquisition, ranges and grouping. | Keep the client-required filters, but group less frequent ones under an optional section. Show active filters clearly and preserve them on return. Do not delete financial or legacy fields. |
| Notifications | The simple surface contains “Enable alerts”, “In Mica” and “Turn off email & push”, although delivery capabilities keep email/push on hold. The advanced section still exposes device controls and per-channel limits. | Present the available in-app choice plainly. Show opt-out controls when relevant to retained enabled preferences; avoid suggesting disabled channels are delivering. Preserve stored preferences and safe opt-out. |
| Detail/portfolio | The main hierarchy and responsive chart widths are much improved. Some optional headings still use developer-like words such as “Provider reference index” and “Value context”. | Rename only where useful, keeping source uncertainty and context accessible. Do not remove the facts necessary to distinguish a reported price from an independently verified paid amount. |

The “Free (trade)” known-zero behavior was explicitly retained by prior client work. It should not be silently reinterpreted during visual cleanup. Any later clarification must preserve entered amounts and established basis behavior.

## 3. What worked in this audit

- Fresh opening kept a saved portfolio visible while showing an incomplete update; it subsequently completed for the current day. Holdings and summary values agreed after completion. This is an observed successful recovery, not a measured refresh-time guarantee.
- Changing the graph to Month left P/L on All time. Detail reopened with today's saved slab valuation and history. No disappearing-price state was observed during this walkthrough.
- Natural card-name plus set search returned the expected three Blastoise printings. Manual search from the camera toolbar opened correctly, preserved the query, and supplied distinct accessible printing names.
- The actual detail chart resized at **320, 430, 768, 1024, 1440 and 1920 CSS pixels**, with no horizontal document overflow. Phone canvas gutters were 8px; larger layouts filled the available content width. This confirms actual canvas reflow, not just a wider surrounding panel. [Measurements](evidence/full-audit-2026-10-25/responsive-detail.json).
- Settings groups, exact-card headings, source links, the compact owned-copy action bar and responsive shell are materially cleaner than the earlier interface. Preserve that system rather than redesigning the entire app again.
- In the approved isolated account, durable add, duplicate-save retry, edit, selected-copy sale, duplicate-sale retry, sibling preservation and fresh-session reopen all passed. Anonymous inventory access was denied. The harness made **zero provider requests** and no customer writes. [Workflow evidence](evidence/full-audit-2026-10-25/isolated-core-workflow.json).
- No console errors/warnings were observed in the bounded live audit window. This is not telemetry for all users or all sessions.

Physical photo accuracy, glare/blur, autofocus, orientation, permission recovery and suspend/resume still require Elliott's actual iPhone walkthrough. The desktop camera/manual-search checks and synthetic camera tests do not replace it. Native packaging alone does not guarantee automatic capture quality.

### Workflow coverage boundaries

| Workflow | Fresh evidence | Remaining limit |
| --- | --- | --- |
| Sign-in and session recovery | Isolated account authenticated and reopened in a fresh SDK session; browser recovery checks passed. | Actual public signup/reset email delivery remains deferred, not newly qualified. |
| Scan/manual lookup/confirmation | Live camera-to-search fallback and exact printing confirmation inspected; capture/retry tests passed. | No physical-phone recognition or autofocus certification. |
| Price/history/portfolio | Live new-day refresh, cached detail, independent graph/P&L selection and actual responsive canvas checked; cache/correction/withdrawal regressions passed. | No catalog-wide sale verification or real-user latency percentiles. |
| Copies, purchase edit and sale | Real isolated-account add/edit/idempotent retries/selected-copy sale/fresh reopen; fixture copy-switch and ledger recovery checks. | Customer records stayed read-only; complete touch/device walkthrough remains. |
| Raw/sealed/local currency | Core sealed and price-evidence tests; expanded profile/currency/owner-safety tests. | These are controlled fixtures, not a new paid-provider acceptance sample for every language/currency/product. |
| Watchlist, filters and search persistence | Live library/filter UI inspected; expanded watch-context and retained-draft tests passed. | No new customer watch/alert settings were saved. |
| Photos, documents, imports and export | Upload/capture retry and CSV review tests; private storage metadata checked. | No private customer file was uploaded/exported, and hosted object restore was not rehearsed. |
| Settings, appearance and notifications | Live settings/alert surfaces inspected; both-appearance, keyboard viewport and currency-preservation tests passed. | Email/push delivery stays held; availability/wording mismatch remains above. |
| Privacy and deletion | Actual anonymous deletion denied; existing deletion safety checks passed. | No authenticated account deletion or native review/privacy qualification performed. |
| Offline/update/background behavior | Core service-worker/private-cache tests and owner-safe recovery checks passed; daily/continuation configuration inspected. | Not a physical-device offline/resume run or an unattended next-day completion proof. |

This breadth is enough to identify the next concrete work; it is not a claim that every possible state, browser extension, device or external provider failure was exercised.

## 4. Security and operating readiness

Fresh production checks found zero ordinary public tables without RLS, all four storage buckets private, and zero known vulnerabilities in the production npm dependency tree. Canonical anonymous portfolio reads, account deletion and identification requests returned 401 with non-public caching. No authenticated deletion or destructive security test was performed. The live shell has CSP, frame blocking, HSTS, nosniff and restricted camera/microphone/geolocation policy. [Security evidence](evidence/full-audit-2026-10-25/security.json), [anonymous boundaries](evidence/full-audit-2026-10-25/anonymous-boundaries.json).

Supabase still reports 21 RLS/no-policy informational findings, 14 authenticated-executable definer warnings, and disabled leaked-password protection. All 14 sampled runtime definitions have empty search paths and owner/admin guard references. That is useful evidence, **not full per-statement authorization proof**; no-policy tables are deny-by-default, not automatically leaked. Retain full function/grant review and two-owner adversarial acceptance as public-release work. No grants or security settings were changed.

The database remains about 331 MB. The database continuation cron is still inactive; the separate Vercel daily portfolio cron remains configured. One of two saved views was current-day complete; the aggregate also includes the isolated test account and does not itself prove a customer failure. No view reported pending history backfill. Unattended next-day completion, interrupted queue continuation, full target capacity and hosted restore remain operational acceptance gates before a broad commercial rollout. Do not activate recurring work or increase the existing provider budget simply to make an audit status green.

One unthrottled command-line request downloaded the compressed app bundle (303,767 bytes) in about 162ms. This is only a static-asset probe; it says nothing conclusive about phone startup or authenticated data readiness. Future speed acceptance should measure saved value usable, exact price usable, search response, interaction latency and layout shift on slow and warm paths. Google's field targets are LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at the 75th percentile; this audit does not claim field compliance. [Google measurement guidance](https://web.dev/articles/defining-core-web-vitals-thresholds).

Public signup/reset email, operator/legal/support facts, commercial hosting entitlement, native signing/store disclosures and actual App Store submission remain the previously deferred milestone. They do not justify delaying independent demo polish, and Jordan's Safari approval will not itself close those public/native requirements.

## 5. What established products do differently

The useful benchmark is consistency and trust across the whole flow, not additional floating controls or animations.

| Verified guidance or vendor claim | Mica's practical gap |
| --- | --- |
| Apple recommends a clear primary action, recognizable controls, adequate target space and feedback for slow actions. | Many primary controls already have 44px web targets; quick results, library cards and filters still compete for attention. Check actual hit areas rather than shrinking controls to fit more copy. [Apple buttons](https://developer.apple.com/design/human-interface-guidelines/buttons). |
| Stripe's chart guidance pairs a headline metric with an appropriately sized chart and reserves chart height to avoid layout shift. | Preserve Mica's responsive chart work; add complete-state visual checks for data loading, empty/stale data, range changes and both appearances. [Stripe chart layout](https://docs.stripe.com/stripe-apps/patterns/chart-layout). |
| Stripe keeps actions consistently placed and distinguishes short action feedback from persistent problems. | A held grading service should be communicated before the user starts work, not as a late analysis failure. Retain persistent retry for unresolved saves. [Actions](https://docs.stripe.com/stripe-apps/patterns/action-buttons), [state feedback](https://docs.stripe.com/stripe-apps/patterns/communicating-state). |
| Google's adaptive navigation changes with available window size, including runtime resizing. | Mica's main shell and charts now reflow; continue testing tablet/landscape/intermediate widths and keyboard-safe overlays, not just one iPhone model. [Adaptive navigation](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation). |
| Collectr advertises a short scan → exact variant → quantity/condition → tracked collection flow. | Match the clarity and recovery of that core path, without adopting its unrelated feature catalog. This is its product claim, not independently measured recognition accuracy. [Collectr scan](https://getcollectr.com/scan). |
| Card Ladder says its research team vets sales and maintains daily collection updates across a large multi-market archive. | Mica's strict provider matching and correction handling are valuable, but cannot establish equal coverage or human vetting. Sparse sale history and unknown historical offer amounts remain real data limits. Do not smooth, invent or substitute another grade to imitate a competitor chart. [Card Ladder](https://www.cardladder.com/). |

## 6. Fresh verification and its gaps

The complete `npm run beta:check` passed: lint/syntax, **595 unit passes / 3 skips**, schema and migration-baseline checks, reproducible release build/routing, **397 core browser passes / 11 skips**, and **3 large-inventory browser passes**. No retries or flaky passes were reported.

A separate expanded UI run (`ui-regression`, `mobile-workspaces`, `card-profile`) produced **201 passes / 10 skips / 2 failures**. Both failures are the same outdated assertion in `mobile-workspaces.spec.js:104`: it expects the entire identity inside `.detail-title-name`, whereas the current renderer separates name and metadata. This is not proof the full identity disappeared; live headings contain it. However, the assertion stops that test before its width sweep, so those downstream checks were **not performed** in that run. Repair it to verify both visible name and complete identity, then execute the sweep; do not simply remove its identity requirement. [Verification summary](evidence/full-audit-2026-10-25/verification.json).

The green core gate did not detect the quick-search contrast, sibling accessible labels, upload keyboard gap or production grading hold mismatch. Add checks for these actual failures instead of expanding counts with more implementation-mirroring assertions.

## 7. Smallest completion sequence

1. Repair the four P1 interface contracts using existing tokens, summaries, file input and capability response. Keep held services held and historic data intact.
2. Simplify library presentation, group advanced filters and align notification controls with available delivery. Preserve all client-required functionality and financial facts.
3. Correct the stale responsive test contract. Verify the affected real screens in both appearances, keyboard flow, intermediate widths and WebKit. Rerun the relevant release gate before publication.
4. Have Elliott complete the physical Safari capture → confirm exact printing/grade → save → reopen → selected-copy sale → portfolio walkthrough on the frozen candidate. Then show Jordan that candidate.

No paid service, new dependency, platform migration, customer cleanup or new product feature is needed for this polish pass. This audit records findings and acceptance criteria; it does not mark the proposed repairs shipped.
