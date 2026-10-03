# CLIENT-07B — bounded local acceptance

2026-09-29. **ACCEPT the CORS correction and reported isolated compile/simulator-launch milestone. Step 7 and beta acceptance remain open.** Next packet is CLIENT-07C within the same numbered Step 7, not CLIENT-08.

## What Astra checked

- Read all dated continuations in `SOL_CLIENT_PACKET_07B_REPORT.md`, inspected the changed CORS helper and tests, and independently ran the native/CORS suite: **12 passed, zero failures/skips**. The missing-Origin and current downstream vision Vary defects are closed for the inspected source. No deployed cache proof is claimed.
- Ran process-scoped Xcode version check: **26.4.1, 17E202** at `/Users/elliottrouse/Downloads/Xcode.app`.
- Viewed the retained simulator screenshot: the app renders its secure-start failure. Its SHA-256 matches the reported `3bb181becbd74fdf06a482eba6f2885f70d55b17c5e97ec5a5b7e28ca4ca303e`.
- Inspected the retained isolated build and local-artifact package manifest under `/tmp/mica07b-native.KWuGml`. Its clean build exists; the Keychain Swift source hash equals repository source (`0e2942dcc9c33cb3e94ed0d53db5e45762b419ca18f33fc288b40a0ddd49a0ab`). `codesign` inspection produced no entitlements for the clean simulator executable.
- Did not independently rebuild, rerun simulator bridge diagnostics, or reproduce OSStatus -34018. Those remain Sol's reported native measurements. Binary archive checksums and successful build exits are reported provenance; a screenshot alone cannot prove them. Preserve a concise reproducible manifest and sanitized logs in the next packet before temporary artifacts disappear.

## Findings and remaining uncertainty

The isolated compile using checksum-verified pinned artifacts is useful evidence that the Swift integration can compile. It is not an ordinary unmodified-project dependency-resolution success. The actual simulator launch and fail-closed screen are a real advance beyond browser mocks. They do not prove Keychain persistence, authentication, collector flow or physical-device behavior.

Do not promote one failed hand-authored ad-hoc signing experiment into a requirement for paid enrollment or a new Apple signing identity. First inspect Xcode's normal simulator build settings, generated simulated entitlements, executable/signature and actual launch rejection. The clean build explicitly used CODE_SIGNING_ALLOWED=NO. Simulator development signing/entitlement handling is a separate local investigation from physical-device provisioning and distribution. No success is promised.

Apple's [missing entitlement guidance](https://developer.apple.com/documentation/security/errsecmissingentitlement) directs diagnosis toward the app's effective entitlements. Its [Keychain access-group guidance](https://developer.apple.com/documentation/security/sharing-access-to-keychain-items-among-a-collection-of-apps) describes the application identifier/default group relationship. Preserve the app's origin/key allowlists and real OS Keychain boundary throughout.

The ordinary build, successful native Keychain get/set/remove/relaunch, configured backend, physical device, camera, auth return and collector-loop gates remain open. The original qualifier flake remains unresolved. Approximately October 2 remains an at-risk target, not a release commitment.

Sole next packet: `docs/SOL_CLIENT_PACKET_07C_SIMULATOR_STORAGE.md`. Existing computer-use authority remains active. No provider calls, hosted mutation, account/enrollment/agreement action, signing identity creation, distribution or CLIENT-08.
