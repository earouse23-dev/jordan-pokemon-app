# Settings redesign

Client request: research established app settings and rebuild the complete settings page. Uses existing Mica controls and data flows; no new dependency, service, provider budget or platform change.

## Research applied

- [Apple: Find settings on iPhone](https://support.apple.com/guide/iphone/find-settings-iph079e1fe9d/ios): organize settings by the area they affect. Mica uses account, appearance, collection preferences, notifications, data, device and privacy groups.
- [Notion: account settings and preferences](https://www.notion.com/help/account-settings): distinguish personal account information from preferences, with explicit System/Light/Dark appearance choices. Mica shows saved display name plus email, a separate appearance group and a dedicated account action area.
- [Linear: preferences](https://linear.app/docs/account-preferences): group interface/theme, desktop behavior and workflow preferences instead of mixing them. Mica separates local device appearance from saved collection currency/fees and installation.

These are shared interaction/layout patterns applied to Mica's existing identity and capabilities, not a claim to reproduce one vendor's complete product.

## Implemented

- Consistent, bounded desktop column; same-width rounded groups, quiet separators, right-aligned values, native choice controls and concise headings. Mobile uses full available width with readable text and 44px+ targets.
- Fixed the account heading being replaced with a long sentence. Saved preferred name is now respected; email appears as secondary text. Removed redundant beta badge from the visible account card.
- Theme and motion in Appearance; replaced the cyclic motion button with System/Reduced/Full native selection. Uses existing preference storage; local selections do not write the account profile. Removed unnecessary motion-change toasts.
- Currency and optional selling-fee settings retain explicit Save changes and live save status. Existing spreading of hidden preferences, failure recovery, owner guards and backend persistence are retained.
- Installation is separate and hidden when already installed, including native builds. Notifications show a concise daily limit; the existing alert sheet retains detailed channels and quiet-hour controls.
- Import/export/backup tools retain their existing handlers and constraints. Secondary insights/grading stay collapsed and stored legacy data remains accessible.
- Privacy, retention and deletion entry points remain; the affiliation notice is under About Mica. Existing legal wording is preserved. Sign out is a separate final action, retaining push-detach and authentication behavior.

Visual critique corrections: forced consistent card widths after desktop flex alignment allowed content-sized cards; removed duplicate bottom dividers; restored selection chevrons on iOS; kept long email wrapping; removed duplicate helper paragraphs and moved the sign-out action away from everyday settings.

## Verification

Initial complete local UI/card-profile run after the functional refactor: 195 passed, 9 environment skips. Subsequent final correction suite: 18 passed across desktop Chromium, mobile Chromium and mobile WebKit. New settings checks cover saved account identity, equal card widths, accessible direct theme/motion controls, motion storage, no profile writes from appearance changes, closed/open About content, separated sign-out action, and both appearances. Existing tests verify currency save/reload and hidden preference preservation. Lint, syntax checks and 583 unit tests passed (3 explicit skips); native runtime tests and normal simulator build passed.

Installed native app reviewed in the iPhone SE third-generation simulator through the actual profile button, not Safari. Native review includes account wrapping, appearance controls, scroll layout and hiding redundant installation. Exported screenshots use synthetic accounts; private demo email is not copied to public evidence. Physical iPhone touch/VoiceOver acceptance remains separate.

Final independent CI, deployment and live observations are recorded below. No customer write testing, destructive migration, legal setup or new billing is included.

## Published release

Runtime source: 858a341c3017936b4d65ebd7ab558d5339861a12. [Release CI](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/39191705282): 583 unit passed / 3 explicit skips; 361 browser passed / 8 environment skips; 3 large-inventory passed. No flaky/retry result was reported. The expanded selling-fee check exposed joined label/help text; corrected with a two-column row and separate helper, then added to the permanent settings check. Final fee/persistence checks passed 9 tests across all three browser projects.

[Published deployment](https://jordan-pokemon-4i1sva2il-earouse23-devs-projects.vercel.app), ID dpl_8MESfqSBM44P3sm3H4cjLbtQPHBt, promoted to [Mica](https://jordan-pokemon-app.vercel.app). Health reports source 858a341c3017. Existing crons, provider budgets and nine-function footprint retained; no SQL or provider activation changes. Prior health holds remain unchanged (vision release hold; paid-pricing live acceptance is outside this UI task).

Read-only isolated demo review against both stage and production: 5 saved rows loaded; settings groups align at 343px within a 375px phone viewport and 728px within a 1440px desktop viewport; zero horizontal overflow and no uncaught browser errors. The harness deliberately blocked provider/background-write paths, yielding documented 503 responses. These are not production endpoint failures, and this review does not claim live provider-price verification. No customer records were written.

Native build succeeded and installed; all four bundled UI input hashes match the runtime source. Actual simulator profile navigation and settings layout were observed. Later native touch attempts encountered the computer-use service's intermittent noWindowsAvailable error; exhaustive native touch/VoiceOver acceptance is not claimed. Browser WebKit checks cover direct controls, fee expansion, appearance and persisted currency behavior. Private demo email is kept out of repository screenshots.

Evidence: [publication](evidence/settings-redesign-2026-10-18/publication.json), [production observation](evidence/settings-redesign-2026-10-18/production-settings-observation.json), [phone settings](evidence/settings-redesign-2026-10-18/mobile-webkit-light-viewport-fixture.png), [desktop settings](evidence/settings-redesign-2026-10-18/desktop-chromium-light-fixture.png), [expanded fee](evidence/settings-redesign-2026-10-18/mobile-webkit-expanded-fee-fixture.png). Screenshots are synthetic fixtures, including their reserved example.test email address.
