# CLIENT-07 — iPhone beta integration

Prepared 2026-09-25; approval recorded 2026-09-26 in `docs/evidence/sol-client-07/NATIVE_SETUP_APPROVAL.md`. CLIENT-06 local gate is accepted and native setup is approved. Feasible implementation was reported on 2026-09-29; continuation is now `SOL_CLIENT_PACKET_07B_NATIVE_VALIDATION.md`. Do not request the same native approval again. The original target was a usable beta in about one week; this is a delivery target, not a verified release date.

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before work; reuse existing implementation first and choose the smallest correct change. Report if unavailable. Do not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read AGENTS.md, both roadmaps, CLIENT-02's approved Capacitor direction (certificate scope is superseded by Elliott's deferred-feature decision), `docs/evidence/ASTRA_CLIENT_PACKET_06C_ACCEPTANCE.md` and the validated migration report. Read relevant installed Supabase skill for native auth/session integration. Verify current official Capacitor/Apple docs and installed tools rather than relying on old packet version assumptions.

## Concrete native approval scope

Proposed: bundled Capacitor 8 iOS project, iOS 15+; only `@capacitor/core`, `@capacitor/ios`, `@capacitor/app`, `@capacitor/preferences` plus development-only `@capacitor/cli`, compatible exact pins and lockfile; app-local Swift Keychain bridge, no third-party storage package. No Camera/Network plugin unless a measured device limitation receives separate review. This is the existing approved architectural direction made concrete. No Apple enrollment payment, account creation, terms acceptance, signing identity creation, hosted change or TestFlight upload is included.

## Preflight — do immediately

Inspect installed Xcode/version/developer directory, SDK/simulator availability and existing native files without reading secrets. Astra found CommandLineTools selected and no usable simctl; check for an already installed Xcode using process-scoped `DEVELOPER_DIR` before proposing an installation. Do not change global toolchain selection, install full Xcode or accept Apple licenses without separate user action/approval. Record exact blockers early; finish independent code/test work instead of repeatedly attempting an unavailable build.

Create one short beta critical-path checklist: native build/toolchain, client-owned bundle ID/team/signing, physical iPhone, HTTPS API/auth callback configuration, reviewed database migration activation, provider display/coverage decision and TestFlight handoff. Identify precisely which require Elliott; do not ask for passwords/private keys. Reuse existing nonsecret documented values where approved. Use clearly temporary development identity/configuration until permanent values are supplied, never register it remotely.

## Implementation after native approval

1. Bundle the existing shipping web artifact inside the iOS project; no remote `server.url` shell. Preserve the web/PWA build. Exclude deferred certificate/GemRate UI/fixtures/styles from bundled shipping assets. Keep all service-role/provider secrets server-side. Include only public configuration from explicit build inputs; no `.env.production.local` access or blind environment-file bundling.
2. Add the native API-origin boundary so `/api/*` reaches one explicit HTTPS backend, preserving authorization and error handling. Do not assume the existing deployed backend includes the new 06C RPC. Missing activation stays clearly unavailable. Test with local controlled transport; no hosted writes, provider calls or live migration. Keep CORS/auth origin configuration changes as exact pending server changes if required, not automatic deployments.
3. Implement Supabase session storage through the local Keychain bridge in native builds, with sign-out/account deletion clearing the correct keys and no localStorage token fallback on native storage failure. Preferences are for small non-secret state only; owner-bind drafts and clear/suppress previous-account data. Retain existing web behavior.
4. Wire App lifecycle and cold/warm auth callback handling using the existing auth flow. Allowlist the expected callback and validate auth state/PKCE; do not accept arbitrary URLs as trusted. Prepare Associated Domains/AASA/redirect configuration as concrete artifacts, but do not deploy or change hosted allowlists. Use approved local test callbacks where available; report untested production callback separately.
5. Preserve current live document camera and manual recovery in WKWebView; add truthful camera usage copy/permissions. Stop/restart streams correctly across background/foreground, denial and interruption, preserving owner-bound drafts and full-source safety. Do not replace live-frame detection with a still-photo plugin without evidence/approval. Disable service-worker registration only in the native shell and preserve offline shell/network retry behavior.
6. Polish only issues blocking the collector loop: login → capture/manual add → identity confirmation → saved physical copy → app relaunch → inventory/detail → selected-copy sale → portfolio/history. Keep unknown price/coverage honest. No redesign, new product features or fabricated live/demo prices in a release build.

## Verification and deliverable

Build and launch in an available simulator once tooling exists; use simulator evidence for lifecycle/layout/auth where valid, not physical camera proof. Test native storage failure, expired session, signout/account switch, offline/reconnect, interrupted draft and relaunch. Reuse existing browser/domain checks for unaffected behavior rather than rerunning everything after each edit. Complete native asset secret/exclusion scans and verify versions/lockfile reproducibility.

When a consented physical iPhone is available, perform the collector loop and permission/background/network cases with synthetic test records against an authorized test backend only. No sign-in to someone's personal collection or uncontrolled hosted mutations. If unavailable, finish the build/code/evidence and provide the exact small device checklist; do not mark Step 7 complete from mobile WebKit screenshots.

Write `docs/evidence/SOL_CLIENT_PACKET_07_REPORT.md` with implemented files, reproducible native build command, exact simulator/device results, screenshots, all untested boundaries and one consolidated remaining-action list toward the one-week beta. Prepare the concrete configuration/deployment/migration/signing changes needed next so approval is for a reviewable result. Do not spend this packet on another pricing sample.

No new provider spending, shared/hosted migration, production configuration changes, paid Apple enrollment, upload/deployment, commit or CLIENT-08 release. Preserve dirty work and existing data. Stop for Astra review after all authorized feasible work; keep work blocked by missing Xcode/device/signing distinct from software defects.
