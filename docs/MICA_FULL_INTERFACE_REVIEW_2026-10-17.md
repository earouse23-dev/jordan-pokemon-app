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

Final verification and publication follow below. Browser screenshots use synthetic holdings; native captures use the isolated demo account. No customer write tests.

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


### Independent correction gate

The first independent candidate gate (39089812796) passed 358 browser checks with eight explicit skips, but failed the three phone-chart checks: the new item plot was 260px high against the existing 290px minimum. The implementation was corrected to retain 300px item plots; the acceptance threshold was preserved. All three targeted project checks passed. A subsequent native SE review also found the iOS date control painting past its field. Disabling the control's default appearance retained its native date type/picker and contained the border. The shared date style applies throughout the app; all six combined purchase-form/chart checks passed.

Final runtime source: 402224d08e5609aa8d6ec3e623aa0634f18169ee. The installed native input files and CSS match that source. The final staged authenticated demo check showed the saved chart before 25 delayed inventory reads in 66ms, with no uncaught browser errors and customer writes blocked. This is a controlled observation, not a field percentile. Existing provider/database behavior and cron schedules remain intact.

Release procedure correction: the artifact builder clears its staging directory, including the local Vercel link. An initial staging command therefore created an unused separate project. It was removed, the existing Mica project was explicitly relinked and its project/team IDs asserted after rebuilding. Subsequent candidates use only project prj_ICSEVLitTA6RdwTTy14BThiAvPEQ. The canonical production site was not switched to the unintended project. Future releases must relink/verify after artifact generation.

The runtime log sample contained the existing Node dependency url.parse deprecation warning on a successful HTTP 200 response. No failed application response was observed in that sample; this is not a guarantee of zero production errors.

### Final publication

[Independent gate 39090807686](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/39090807686) passed on final runtime source `402224d08e5609aa8d6ec3e623aa0634f18169ee`: 583 unit checks passed (three explicit skips); 360 browser checks passed, one FX case passed on retry, eight environment checks skipped; all three large-inventory checks passed. The FX case initially lost its browser execution context during evaluation; it passed on CI retry and six further local repetitions (two per browser project). This is recorded as a flaky test, not concealed as a clean first-pass run.

The tested production candidate `dpl_7a2TRsDiYhxrQ9rpRYWEe9yV4XHP` was promoted to https://jordan-pokemon-app.vercel.app. Canonical health returned healthy with release `402224d08e56`. The authenticated demo saved-chart check passed on the canonical site in 324ms before delayed inventory reads, with no uncaught browser errors; customer writes were blocked. Production HTML, version-103 styles and service-worker cache version match the reviewed artifact. The final deployment's sampled error-log query returned no rows.

The installed SE build uses the same reviewed source and passed normal signed simulator startup. Actual native screenshots cover portfolio and purchase-first intake, including the corrected date width. Browser coverage includes full flows and both appearances; simulator coordinate automation remained unavailable. Physical camera, haptics and full assistive-technology acceptance are not certified by these checks. No App Store submission, schema change, new dependency, provider budget or business/legal policy change shipped.
