# CLIENT-07D — Astra bounded review

2026-09-29. **ACCEPT the implemented copy navigation, marketplace-link safety and sealed correction subset. Do not mark sealed collector-flow completion or native/backend acceptance closed.** Continue with one substantial 07E implementation batch, not another polish pass.

## Evidence checked

Astra read `SOL_CLIENT_PACKET_07D_REPORT.md` and its activation plan; inspected copy gesture handlers, marketplace URL validation, sealed matching/save behavior and the sealed browser test. Independent command:

`node --test --test-name-pattern='sealed provider refresh|marketplace|sealed' tests/identity.test.js tests/pricing.test.js tests/portfolio-history.test.js`

Result: **9 passed, zero failed/skipped**. Sol's 15 browser cases, broader 75-unit run with one DB guard skip and final native build/launch remain reported evidence, not duplicated by Astra.

## Required functional closure

1. `openSealedPositionSheet` still passes `currency: "USD"` to `createPosition`; displayed acquisition totals use the default currency. The new EUR portfolio unit test constructs EUR records directly, bypassing this form. It does not prove real EUR acquisition entry. Add native USD/EUR acquisition selection and prove it through the actual write and fresh-session read; no FX conversion is needed or authorized.
2. A local photo preview plus manual search does not implement N2's photo identification. The report correctly leaves that requirement open. Implement the reusable recognition contract and real application routing against existing vision infrastructure, with deterministic synthetic transport tests and truthful missing-live-provider status. Do not claim real-image accuracy or spend provider quota.
3. The browser “reopen” case inserts a reconstructed item into `state.items`. It is valid UI evidence but not database hydration after fresh login. Reuse the established disposable local database workflow for actual persistence/owner/retry proof, leaving mica-dev and the hosted project untouched.
4. Native external links remain untested. Use the already-working simulator to exercise WKWebView→external browser behavior and app return with safe content, not a live provider request or marketplace scrape.

The source/photo persistence expectation must use existing owner-scoped storage only where an approved path exists. No new bucket, retention policy or public image exposure by assumption. The release must not claim a saved user photo where it only stored a temporary preview.

## Release preparation

Existing Vercel/Supabase targets are now concrete in the activation plan. The owner-reported backup is not verified restore evidence. Permanent Apple identity/callback association and exact data-affecting activation still require preparation and reserved approval. No migration/deployment is authorized by this review.

Subscription model is confirmed, but prices, periods, trials, free capabilities and existing-user treatment remain client decisions. Astra requested them together. Continue software work meanwhile. The next packet should produce a reviewable minimal StoreKit/server entitlement change proposal using current official sources and exact dependency/schema/platform approval scope; do not require an extra research-only packet.

Sole active packet: `docs/SOL_CLIENT_PACKET_07E_COLLECTOR_FLOW_CLOSURE.md`. Deferred certificate/eBay archive work stays queued; these open collector requirements take precedence over cosmetic work. No CLIENT-08 or public-store submission.
