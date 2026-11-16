# Collector-led interface redesign

Scope: Elliott approved a visibly more substantial Unslop pass after the earlier consistency work left the composition largely unchanged. This pass changes presentation across existing screens; it adds no feature, dependency, provider integration, database migration or store action.

## Direction and observed defects

Mica is a collector's ledger for identifying slabs, retaining copies and tracking their value. Character: calm, precise, tactile. World: card binder and financial ledger. Moments: actual artwork and the primary value chart. Signature: grader and grade together.

The baseline showed excessive boxed chrome, equally weighted collection tiles on phones, a small detail image beside dense identity text, disconnected search/photo panels, boxed settings groups and separate financial figures with uneven spacing. Before screenshots are in `test-results-design-baseline`; live demo screenshots stay in ignored `benchmarks/private/design-2026-11-16`.

## Applied passes

1. Spacing: 4px rhythm, consolidated financial header, closer chart controls, aligned settings rows and search/photo workspace.
2. Color: quieter neutral canvas and darker surface hierarchy, one green accent, restrained separators rather than borders around every card.
3. Icons: existing SVG vocabulary and mark retained. The optional digital-grade action has a compact, accessible card/check icon on narrow collection rows.
4. Copy: search prompt names accepted input directly; no new marketing or explanatory paragraphs. Missing/stale prices, uncertain identity and source details remain truthful.
5. Type: native system family, 400/500 roles, tabular figures, larger deliberate screen/detail titles and financial figures.
6. Layout: desktop collection gallery and mobile ledger; a larger card image stage; paired portfolio value/performance on wide screens; capture and search inside one responsive workspace; settings labels and controls aligned in columns on desktop and stacked on phones. Existing section order and destinations remain.
7. Details: quiet selection surfaces, coherent rounded controls, clear keyboard focus and retained 44px targets. No overlay placement or form state logic was replaced.
8. Visuals: card artwork and actual charts carry color. No generated decorative asset, invented data, spline change or cosmetic price smoothing.
9. Motion: retain the existing 300ms chart draw, 120ms feedback, brief sheet entry and reduced-motion handling. No decorative movement or dependency.

Visual review caught and corrected an inherited `top` offset on the photo panel; panels are now contained by their shared workspace, with a regression assertion across both themes and eight widths. Account header depth and navigation icon treatment were also corrected after the first render. The real live Add screen exposed a further grid defect: omitting the existing results area from the phone template created an implicit column. The template now includes the existing results area explicitly, and a width assertion prevents that column from returning. Results remain in normal layout so loading/error/retry states cannot be hidden by a dynamic ancestor selector. Final dark-mode live review also caught a legacy white camera-icon color on the light primary action; icon ink now inherits the button foreground, covered in both themes. Search-recovery tests exercise populated results separately.

## Verification

- Responsive matrix: 320, 390, 430, 667 landscape, 768, 1024, 1440 and 1920 CSS px; light/dark; portfolio, collection, detail, add, settings, auth, filters, editing, recovery and onboarding.
- 76 Chromium/WebKit UI checks passed: keyboard, enlarged text, 16px input floor, contrast, overlay containment, retained drafts, accessible controls and legacy-feature boundaries.
- 8 targeted Chromium/WebKit checks passed: exact-card layout, settings persistence, actual chart resizing without remount, chart drawing and reduced motion.
- Final Add-grid correction: all 58 Chromium/WebKit responsive and search-recovery cases passed, including populated results, retry controls, language/printing identity and phone workspace width.
- Final icon correction: all four Chromium/WebKit light/dark viewport matrices passed, including icon foreground checks at each width.
- Unit suite: 612 passed, 3 skipped. Lint: 101 source files. Syntax checks passed.
- Scan/pricing/design run: 107 passed, 1 skipped; two failures asserted the superseded side-by-side phone layout. The new stacked artwork is explicitly approved composition. Its first render also put price too low on short screens: the image stage was reduced, and the updated checks now require the entire price above the bottom actions and a full-width chart. Both corrected Chromium/WebKit cases passed. Final affected subset: all 34 Chromium/WebKit pricing and responsive cases passed after the correction.
- Xcode Simulator build compiled and launched with the retained isolated demo session on the existing 6.3-inch iPhone 17. Native portfolio rendering was inspected. Simulator computer-control timed out; native tapping and physical camera acceptance are not claimed.

Fixture screenshots use synthetic prices and placeholder art. They prove layout, not recognition or price accuracy. Actual demo screenshots are separate. Customer inventory was not used for write testing. Existing Topps catalog and physical camera acceptance limits remain. No Canva update is included.

Process adapted from [Unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), [@heydamir](https://x.com/heydamir), CC BY 4.0.
