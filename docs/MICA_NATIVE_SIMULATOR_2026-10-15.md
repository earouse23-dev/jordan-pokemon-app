# Installed iOS simulator setup — 15 October 2026

Elliott explicitly requested an installed app, not simulator Safari. Reused the existing Capacitor iOS project and existing dependencies. Source bundle: `1902cc48c0f5b263dd2fcfa9d11758e7b4443b12`. No production web, database, account settings, Apple account or App Store change. No customer collection was edited; form inspection did not save a copy.

## Local setup

- Xcode 26.4.1, developer directory scoped per command: `/Users/elliottrouse/Downloads/Xcode.app/Contents/Developer`.
- Isolated source/project: `/tmp/mica-ios-simulator-20261015/ios/App/App.xcodeproj`. Existing public configuration points to Mica's existing backend; no service secret is bundled.
- Dedicated simulator: Mica iPhone SE (3rd gen), iOS 26.4 label, UDID `E9377444-423C-4733-B0F2-F2F7C67BEF7D`.
- Installed app: `dev.mica.client07.local`, Xcode-managed ad hoc simulator signing. Artifact: `/tmp/mica-ios-local-derived/Build/Products/Debug-iphonesimulator/App.app`. Temporary paths are not durable release storage; rebuild if removed.
- SwiftPM's original binary download stalled. Downloaded the exact upstream Capacitor/Cordova 8.5.2 archives directly and verified both against their pinned SHA-256 checksums. Only the isolated copy uses local binary targets, following the already documented CLIENT-07C fallback. Source package configuration and versions were preserved. The ordinary remote-resolution path is not qualified by this fallback build.

Native runtime tests: 7/7; native artifact verifier: 44 assets; built app public resources: 46/46 byte-matched to copied source including the two empty Cordova compatibility files. Xcode build succeeded.

## Computer-use walkthrough

Used computer use against Simulator and opened the copied project in Xcode. Existing isolated demo account sign-in passed. Portfolio/chart displayed; collection images loaded after retry; PSA 10 Mew ex 193/165 displayed sold evidence, EUR conversion and a price-history chart. Add-copy form opened without saving. Terminating/relaunching the app retained authentication. Camera opened with simulator synthetic feed and cancelled. Blastoise Base Set search returned Base Set 2/102 Holofoil. The installed app was left on its dashboard.

## Open acceptance items

The first collection load failed and retry recovered; root cause remains unproved and needs diagnosis. Native keyboard focus briefly allowed content under the status bar; review inset/keyboard behavior. Computer-use touch-drag attempts did not scroll, while keyboard Page Down did; this does not establish whether the app or automation caused the gesture failure. Simulator exposes little web-content accessibility state to this computer-use surface, so screenshots/coordinates were required. Do not infer VoiceOver failure from this alone.

This is a working installed hybrid iOS test build, not a SwiftUI rewrite or App Store release. Physical camera quality, automatic capture, real photo identification, purchase/save/sell mutations, interrupted-network persistence, notification/auth-return flows and the full native regression matrix remain unqualified. Simulator synthetic camera cannot qualify a real card capture. No claim of full commercial readiness.

Evidence: `docs/evidence/native-simulator-2026-10-15/verification.json` and `installed-app.png`.
