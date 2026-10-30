# App polish audit corrections — October 29, 2026

Scope: the nine findings from the initial App Polish Audit. Source and screenshots were reviewed; customer records and account settings were not modified. This is UI/workflow polish, not a commercial-readiness or accessibility-conformance certification.

| Finding | Shared correction | Verification |
| --- | --- | --- |
| A01 | Detail return labels now include Portfolio and Search results and use Collection/Settings consistently. The existing history/context-preserving return handler is retained. | Portfolio → detail → Portfolio and Collection → detail → Collection browser checks. |
| A02 | Multi-copy raw amounts show Total; grouped slab amounts retain Each. No valuation calculation changed. | Multi-copy collection rendering and responsive captures; existing position/ranking coverage. |
| A03 | Capability-held digital grading launch buttons disappear from collection tiles. Saved reports remain available, and active grading actions still work. Repeated missing-cost tile text is removed; purchase facts remain in detail. | Held-versus-active capability check; shared collection and grading/report workflows. |
| A04 | Theme and Display currency share Preferences. Final setting rows no longer have dangling separators. Notifications and Privacy remain separate. | Light/dark screenshots and selectable controls at narrow, intermediate, wide and short viewports. |
| A05 | Redundant collection kickers are visually hidden; the floating profile control no longer repeats the page title. Its accessible label is Open settings. | Rendered Portfolio/Collection/Settings/Add cards captures. |
| A06 | Search loses its duplicated visible heading while retaining an accessible region label. Field/filter spacing is tightened; photo choice label is shorter. | Add-card layout across sizes/themes, plus photo-choice focus recovery tests. |
| A07 | Everyday counts use items/copies, performance uses gain/loss, and the ranking section says Most valuable. | Updated behavior assertions preserve counts and period semantics. |
| A08 | Gain/loss and its independently selected period sit beside the portfolio value, before the chart. | DOM/layout ordering and independent chart/performance range tests. |
| A09 | Shared detail disclosures use one title and a state-aware chevron; duplicated Open/Details words are removed. | Detail expansion/report tests and existing keyboard/reflow coverage. |

## Validation

- Lint and syntax checks pass.
- Unit suite: 598 pass, 3 intentionally skipped, 0 failures.
- Broader browser run: 255 passed initially; six assertions expected old copy/order. All six pass after updating those expectations, in a 12-test confirmation run.
- Shared polish acceptance: six checks pass across Chromium desktop/mobile and mobile WebKit; visual matrix covers 320, 390, 667, 768 and 1440 CSS-pixel widths, including short landscape and both appearances. A populated-data follow-up passes in all three projects.
- Sibling search/card-profile checks: 39 passed initially. Three copies of one old assertion expected a saved Near Mint price to disappear while researching Damaged prices. Updated it to assert the saved $10 remains separate from the $3 research quote; all three pass. This aligns verification with the earlier saved-price fix, without changing pricing code in this patch.
- Preview hash baseline regenerated and verified for the changed public assets.
- Release routing verification: nine functions, existing held routes/authentication/origin controls retained, zero real outbound provider calls.

App asset revision: 120. Theme revision: 114. Service worker shell: 134. No dependencies, database schema, pricing calculation, provider budget, cron schedule or App Store configuration changed. Git-triggered Vercel deployments remain disabled; publication uses the existing explicit prebuilt release workflow.

The initial audit's screenshot-only uncertainties (historical fixture gaps, an image failure in an older capture, full onboarding coverage and physical-device acceptance) were not treated as confirmed bugs. Native/physical-device acceptance remains separate.

Publication details are recorded after the staged release and live verification.
