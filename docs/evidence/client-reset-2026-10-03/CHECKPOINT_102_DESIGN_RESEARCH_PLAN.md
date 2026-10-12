# Mica beta design research, implementation and critique

## 1. Research

Reviewed official engineering/design guidance, October 12, 2026. These are reusable principles, not claims to have inspected proprietary billion-dollar-company code. Exhausting every design trick or proving no future improvement is possible is not a meaningful acceptance gate. This release instead verifies the core Mica flows against explicit criteria.

| Primary source | Finding applied to Mica |
| --- | --- |
| [Atlassian spacing](https://atlassian.design/foundations/spacing) | Consistent 8px-based rhythm, close grouping within a task, more separation between tasks. |
| [Atlassian typography](https://atlassian.design/foundations/typography) / [IBM Carbon typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/type-sets) | Limited hierarchy, readable labels and deliberate weights. System font keeps native familiarity and avoids downloading another font. |
| [Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Persistent, predictable destinations with icon and text. Keep Home / Add card / Library, with the authorized central add action. |
| [Apple design materials](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/) | Separate floating controls from content; use restrained material only on navigation, not layers of translucent text surfaces. |
| [Stripe components](https://docs.stripe.com/stripe-apps/components) / [Shopify Polaris](https://shopify.dev/docs/api/polaris) | Reuse consistent controls and interaction states across screens; no added framework or dependency needed here. |
| [WCAG contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Test normal text at 4.5:1, large text at 3:1, focus visibly distinguished in light/dark. |
| [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24 CSS px minimum or spacing exceptions; Mica chooses 44px for principal mobile controls. |
| [Google INP](https://web.dev/articles/optimize-inp) | Measure actual interactions and minimize work before feedback. Good field INP target <=200ms at p75; local measurements cannot certify field performance. |
| [Google layout stability](https://web.dev/articles/optimize-cls) | Reserve card-image dimensions and chart space; avoid changing layouts during async loading. |
| [Google animation performance](https://web.dev/articles/animations-guide) | Prefer opacity/transform over layout animation; respect reduced motion. Show saved chart immediately instead of spending 1.2 seconds drawing it. |
| [Amazon caching](https://aws.amazon.com/builders-library/caching-challenges-and-strategies/) | Preserve owner-safe saved-first views, revision invalidation, deduplicated daily pricing, bounded retries and atomic publication from checkpoint 101. Do not introduce another caching layer or a backend rewrite without measured evidence. |

## 2. Implementation plan

1. Consolidate current Mica tokens into cleaner light/dark surfaces, preserve green value/action identity, use native sans typography with tabular financial numerals.
2. Apply consistent control, heading, card, sheet, input and focus styles to dashboard, library, search/capture entry, details and profile/auth. Remove decorative texture requests and ornamental pseudo-elements from everyday surfaces.
3. Compact portfolio chart, clearly separate saved value/P&L/positions, improve collection card grid and image proportions; retain honest incomplete-price context and exact listing titles.
4. Float labeled mobile navigation with safe-area clearance; retain one dominant floating add button on scanned results, back top-left, and no competing nav over that action.
5. Remove drawing delay and unnecessary chart work, preserve lazy image/chart loading and all existing cache/budget boundaries.
6. Verify and critique at 320/390/768/1440px, mobile WebKit/Chromium and desktop; light/dark, keyboard/reduced motion, search, details, sheets and saved loading. Fix observed defects, rerun relevant checks, publish only the verified artifact.

## 3–4. Evidence and critique

Recorded after implementation in the release report. No new feature checklist, customer-record changes, dependencies, services, provider budgets or destructive migrations are authorized by this design pass.

### Implemented and critiqued

- Unified native sans typography, tabular price numerals, 8px spacing, readable light/dark surfaces, restrained green actions, rounded controls and explicit keyboard focus.
- Reworked dashboard, library grid, search/capture entry, exact card detail, purchase sheet and profile/auth. Mobile navigation floats above the safe area; scan results retain one dominant add action with back navigation.
- Removed the 1.2-second portfolio trace reveal and about 552KB of automatic ornamental texture precaching. Image dimensions reserve layout space and dashboard thumbnails load lazily.
- Preserved saved-first portfolio, daily deduplication, owner isolation, historical database caching and atomic updates. All 18 backend artifact entries match checkpoint 101; no new dependencies, services or provider budgets.
- Critique iterations corrected inherited cream textures, competing CSS specificity, dark purchase-sheet contrast, micro-tag contrast, search focus duplication, saved-chart recoloring and dashboard currency mismatch. Saved chart render identity now includes appearance; display-currency helpers are reused for positions.

### Verification and limits

99 browser checks passed: 93 UI/portfolio plus six design/currency checks across desktop Chromium, mobile Chromium and mobile WebKit. Design widths 320/390/768/1440px passed horizontal-overflow, title/button contrast, focus and mobile CTA checks. Lint (101 files), syntax checks and 81 targeted security/portfolio/view/service unit checks passed.

The full unit suite remains 559 passed, 11 failed, three skipped. All 11 failures are existing offline pricing-harness failures reproduced against unchanged baseline source. They are recorded in checkpoint-102-test-results.json and are not presented as a green commercial-readiness gate. The baseline comparison's separate security setup lacked its CI fixture; current security checks passed.

A real isolated demo account passed saved-first reload under shipping CSP while inventory requests were held: 34ms locally and 48ms with candidate API routing on this machine. These are lab reload observations, not field INP or latency guarantees. No customer records were written; profile writes were blocked in the browser verifier. Candidate health/auth/CORS/unknown-route checks passed with zero paid provider calls. Real demo portfolio retains honest missing-price/history coverage, rather than inventing data.

Physical iPhone camera/device acceptance remains Elliott's responsibility. This design pass does not certify exhaustive accessibility, every provider's availability, or commercial readiness. No finite review can establish that no future improvement is possible; all defects found within this pass's verified core-flow criteria were resolved.

### Release

Verified staged deployment: dpl_4sSMpHt5wCQo7k3RGegkh5oX7Hri, https://jordan-pokemon-bcwpktiwy-earouse23-devs-projects.vercel.app. Frozen source/deployment manifests and archives are checkpoint-102-*; final canonical alias, cron and live-asset verification is recorded separately after promotion. Routine publication follows the owner's standing authorization. Unrelated dirty documents and private helper/account files are excluded.
