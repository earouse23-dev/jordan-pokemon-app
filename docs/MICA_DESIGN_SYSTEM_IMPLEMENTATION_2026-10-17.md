# Mica interface implementation — staged review

Owner request: apply the researched mobile UI/UX principles across the existing app, in stages, then inspect the rendered experience. No new dependency, paid service, schema, data retention policy, business feature or platform was introduced. Customer records are outside write-test scope.

## Stages and exit checks

1. **Shared foundations.** Existing Mica tokens and components remain. Align typography, tabular prices, form labels, button feedback, focus outlines, secondary/destructive actions, dialog/sheet controls, readable empty states, toast surfaces and dark surfaces. Reuse the shared selectors so account, collection, search, card, purchase, sealed and secondary tools benefit together. Initial cross-browser shell checks: six passed.
2. **Loading and interaction.** Trace saved portfolio → currency conversion → rendering independently of inventory. Request the rate when a saved view requires it, retain its native history, keep conversion failure/retry distinct from missing market history. Use the browser/WKWebView visual viewport to size and position form sheets when the keyboard reduces usable space. Initial saved-portfolio/owner/refresh checks: nine passed; final checks extend conversion failure and one-value states.
3. **Screen content and consistency.** Shorten settings/import/export, scan/capture helpers, recovery, motion preferences, purchase dates and source labels. Preserve uncertainty and privacy/legal facts. Device appearance is the default; saved explicit Light/Dark choices remain authoritative. Stage check: 230 passed, three explicit environment skips, one WebKit timeout during a workstation sleep/resume interval. The timed-out account/selection race case then passed in all three projects without a product change.
4. **Critique and correction.** Inspect the installed SE app and rendered phone/desktop screens. Remove developer setup prose from the certificate field while retaining user-entered/unverified status and leading-zero handling. Put the saved portfolio range below the graph. A single observation displays its actual value/date instead of claiming history is absent or inventing a line. Keep currency error text visible while inventory is still loading. Recheck affected flows and publish only the verified source.

## Research-to-implementation coverage

| Principle | Existing behavior reused or change made |
| --- | --- |
| Hierarchy and density | Existing value-first card/library layout and full-width phone charts retained; quieter controls and secondary text use consistent styling. |
| Typography and spacing | System font, shared field/heading sizes, spacing/radius tokens, tabular numeric values, wrapping labels. |
| Restrained color and depth | Existing green preserved; semantic light/dark surfaces, quieter secondary actions, restrained shadows and destructive action differentiation. |
| Navigation continuity | Existing owner-bound collection scroll/filter restoration retained; visible navigation labels and back actions remain. |
| Button states and accessibility | Shared press feedback, focus-visible outlines, 44px close/action targets; no replacement of labels with ambiguous icons. |
| Loading and performance | Saved-view first paint, background refresh and atomic publication retained; fix rate initialization with no inventory. No added provider polling. |
| Charts and financial meaning | Historical evidence and missing-data boundaries retained; range below saved graph; honest single-observation and FX states. |
| Price provenance | Existing compact date/confidence/source summary and expanded evidence retained; no raw-value substitution for slabs. |
| Forms | Existing draft recovery, stable save retries, labels, numeric inputs and explicit free/trade zero semantics retained; shorter helper copy and keyboard viewport handling. |
| Search | Existing parsed name/set/number/language matching, suggestions, pagination and recovery retained and regression-tested; no search-engine replacement. |
| Motion | Existing device/app motion preferences retained; shared reduced-motion override covers added transitions. |
| Appearance | Device default plus explicit persisted override, including live device appearance changes. |
| Secondary screens | Shared styling reaches profile, settings, authentication/recovery dialogs, import/export, notifications and optional tools; no new primary features. |

Sources: [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/), [Material typography](https://m3.material.io/styles/typography/applying-type), [Linear review](https://linear.app/now/behind-the-latest-design-refresh), [Airbnb DLS](https://medium.com/airbnb-design/building-a-visual-language-behind-the-scenes-of-our-airbnb-design-system-224748775e4e), [Carbon loading](https://carbondesignsystem.com/patterns/loading-pattern/), [Baymard input fields](https://baymard.com/blog/input-fields), [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

## Acceptance limits

This is an implementation and verification pass, not proof of a flawless product. Simulator/browser checks cannot establish physical camera, glare, haptic feel or every assistive-technology/device combination. Existing provider coverage and unverified certificate facts remain truthful. No App Store submission or commercial launch readiness is implied. Final source, checks, screenshots and publication evidence follow below.
