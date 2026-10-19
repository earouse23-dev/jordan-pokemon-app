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

Final independent CI, deployment and live observations will be recorded after release. No customer write testing, destructive migration, legal setup or new billing is included.
