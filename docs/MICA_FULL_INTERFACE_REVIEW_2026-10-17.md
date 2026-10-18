# Mica full interface redesign

Owner direction: apply the researched interaction and visual rules across the whole existing app. This replaces the earlier control/copy-only pass with screen composition and flow changes. Keep existing green, source uncertainty, raw/sealed records, certification access, recovery and data boundaries. No new feature, dependency, schema or provider policy.

## Sequential stages

1. Shared layout and control rules: compact mobile chrome, meaningful spacing/type, one primary action, quiet secondary controls, visible focus, comfortable targets, device appearance and reduced motion.
2. Primary flows: saved portfolio; artwork-first collection; exact card identity and value; capture/search; purchase-first entry and copy editing. Review complete flows rather than counting CSS selectors.
3. Secondary surfaces: settings/preferences, data/import/export, privacy, watching/alerts, grading, sales/purchase evidence, sealed entry, authentication/recovery, empty/loading/error states. Preserve uncommon capabilities through labeled disclosures.
4. Verify: inspect phone/desktop and both appearances; check overflow, field/save recovery, free/trade zero, exact identity, copy switching, saved charts and keyboard behavior. Review the installed SE app, then publish only verified source.

## Screen and state coverage

| Surface | Composition or shared rule | Verification required |
|---|---|---|
| Portfolio | Compact heading, large value before freshness, no repeated visible value label, responsive chart, range below chart, independent P/L | Saved view, refresh/failure, conversion, one/multiple observations |
| Collection | Artwork before identity/value on phones, concise grade/tags, remove acquisition completeness and paid/provenance paragraphs from tiles | Find/open/back, groups/copies, filters, empty and unavailable |
| Item detail | Distinct name and identity context, prominent exact value, compact source actions, flat supporting disclosures | Raw/slab/sealed, stale/missing evidence, conversion, source links |
| Physical copies | Single copy facts behind Your copy; multiple copy navigation retained | Grade/cert/date/cost retained; switch/sell correct copy |
| Add card | Paid/date first, known identity in editable disclosure, notes secondary, currency alongside amount | Required grade correction, unknown cost, free/trade, save failure/retry/draft |
| Capture/search | Capture before search in DOM and phone layout; desktop two-column arrangement; concise results/recovery | Tracking, file picker, search recovery, keyboard order |
| Sealed | Shared amount/currency, form/actions and concise capture controls | Product/version/currency/save/reopen |
| Settings | Flat grouped rows; specialist grading and selling controls collapsed | Preferences save, appearance, larger text, privacy and data access |
| Watch/alerts | Shared fields, concise actions and recovery | Save/edit/remove, late responses |
| Purchases/sales | Shared money fields, sticky sheet actions and evidence disclosures | Currency/quantity/amount preservation and failure |
| Import/export/data | Shared dialog, field, row and feedback rules | Mapping/review/recovery; no customer writes during visual review |
| Auth/recovery | Shared typography, controls, focus and dialog rules | Sign-in/reset failures, safe session boundaries |
| All surfaces | 16px phone inputs; reduced motion; light/dark tokens; error status and uncertainty kept | Widths 320–1440; desktop Chromium and phone WebKit/Chromium |

## Research basis

- [Linear: calmer interface](https://linear.app/now/behind-the-latest-design-refresh): supporting chrome recedes; reduce visual structure.
- [Linear: complete UI redesign](https://linear.app/now/how-we-redesigned-the-linear-ui): evaluate environment, appearance and hierarchy across complete screens.
- [NN/G: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/): show frequent decisions first, keep occasional controls discoverable.
- [NN/G: visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/): guide attention with scale, grouping and contrast.
- [Baymard: buttons](https://baymard.com/blog/button-design): clear affordances, tap targets and action feedback.

Research recommendations are applied where they fit the existing collector workflow, not treated as a mandate to add every pattern or feature. Automated pass counts do not establish visual quality or flawless usability. Physical camera/haptics/VoiceOver acceptance remains a device check.

## Verification and publication

Pending final review. Screenshots use synthetic/isolated demo accounts; no customer write tests.

### Review findings addressed

- Amount and currency initially still stacked: grouped them in the existing acquisition fields, including sealed products.
- Ambiguous versions must not disappear in a closed panel: open identity editing when several versions exist or a required grade is missing; expand invalid fields before focus.
- A smaller tile must not conceal whether a number is per-copy: retain the Price each / Position value label.
- Stale values retain an older-price warning; valid prices retain a compact update date. Full source facts remain available on item detail.
- Removed duplicate visible portfolio/currency labels; conversion rate/date remains in Portfolio details and source context.
- Authentication now leads with sign-in; public search remains a quiet secondary action.
- Native simulator review exposed a test-build signing error: unsigned builds could not use secure session storage. Rebuilt with normal simulator signing; the existing account/draft restored. No authentication/storage protections were weakened and no diagnostic code ships.
- Simulator coordinate input still returns noWindowsAvailable; keyboard review works. Browser tests cover broader navigation/forms. This is not a claim of complete native touch acceptance.
- Bumped the shell/style cache version to 103 so installed web shells receive the new design. Native builds bundle the same source.

Local evidence: 583 unit checks passed (3 explicit skips), initial 603-case cross-browser run passed 573 with 16 explicit environment skips and 14 outdated presentation expectations. The corrected 33-case follow-up passed 32 (one desktop-only skip), retaining identity/currency/history/save assertions. An earlier 318-case run passed 309 with 3 skips; its six presentation failures were corrected and rechecked. No provider/database logic was changed to satisfy presentation tests. Exact source CI/publication evidence follows after release checks.
