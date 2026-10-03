# CLIENT-07B — Astra review

2026-09-29. **REVISE for one demonstrated local CORS contract gap; continue native validation in the same packet.** This is not Step 7 acceptance. Preserve prior accepted software work and retained evidence.

## Independent evidence

- Read the 07B report, CORS helper/tests/route exports, native runtime, Supabase initialization/auth helpers and Swift Keychain/bridge source.
- `node --test tests/native-cors.test.js tests/native-runtime.test.js`: 10 passed, zero failures/skips.
- `npm run verify:native`: passed, 28 copied assets. No native build or device claim follows.
- Independent in-memory wrapper probe: a cacheable response to a request without Origin has no Vary; the same handler with the native Origin sets Vary: Origin and ACAO. A handler subsequently setting Vary: Authorization removes Origin. `api/vision.js` actually sets that latter header (with no-store, so this route is evidence of header loss, not evidence of a cached vision response).
- Source contains shared-cache directives in multiple wrapped GET routes. An origin-less cached representation can lack the native ACAO header when reused by an HTTP cache. This is a reproducible response-contract defect and plausible integration failure, not a measured hosted CDN incident or authorization bypass. Actual deployment cache behavior also needs checking before activation.
- Read current Supabase PKCE documentation and the changelog index. No dependency upgrade is proposed. Current PKCE/custom storage configuration is consistent at the inspected boundary; this is not full native security acceptance.
- `xcode-select -p` remains CommandLineTools; the targeted /Applications Xcode glob had no match. No full toolchain execution occurred in this review.

Sol's 24 synthetic browser passes and three unchanged qualifier repetitions are retained as reported, not rerun by Astra. The original qualifier failure remains unresolved. Missing trace and passing repetitions do not establish its cause.

## Required correction

Ensure all variants of wrapped responses consistently retain the appropriate Vary fields, including absent Origin and rejected Origin, and preserve downstream fields such as Authorization without losing Origin. Use the smallest correct implementation. Add failing-before/fixed-after tests for no-Origin then native cache reuse and downstream header composition; retain OPTIONS no-side-effect checks and auth behavior. Verify the documented target CDN policy rather than assuming arbitrary Vary fields control every shared cache. Do not solve this by broadening origins or removing authorization.

Reference: [HTTP Vary semantics](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary); [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).

## Updated local-computer authority

Elliott explicitly asks to use his computer and available resources for Xcode and other required work. Sol must actively use CLI, computer control and applicable connected read-only tools instead of stopping merely because a GUI or local setup is needed. This authorizes obtaining/installing the free official Xcode tooling and required simulator runtime on this Mac where feasible, subject to compatibility/disk checks and preservation of existing installations. No unrelated upgrades, paid service, credential access expansion, Apple legal agreement acceptance, signing identity creation, hosted mutation or upload is implied. User-only authentication/agreement prompts require one precise handoff at the actual prompt; continue independent work meanwhile.

Sole active work remains CLIENT-07B under `docs/SOL_CLIENT_PACKET_07B_REVISION.md`. No CLIENT-08. The approximately October 2 beta target remains at risk until build, backend, signing and physical-device gates pass.
