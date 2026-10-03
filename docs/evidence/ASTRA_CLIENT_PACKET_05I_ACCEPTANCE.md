# CLIENT-05I revision — Astra local acceptance

Decision: **Accept the local saved-printing fix and reported synthetic persistence proof.** This supersedes the revision/block decision in `ASTRA_CLIENT_PACKET_05I_REVIEW.md` for those boundaries only.

The selector now distinguishes unloaded options from an explicit option set that omits the saved source. It reconstructs a saved candidate through the existing TCGdex normalizer and compares saved facts/metadata before retaining eligibility. Unknown or contradictory facts do not become exact. Watchlist hydration now retains the source reference as portfolio hydration already did. No price methodology, production schema or provider entitlement changed.

## Independent checks

- Unchanged `node docs/evidence/sol-client-05i-reopen-probe.mjs`: passed; snapshot, hydrated and selected status exact, source ID unchanged.
- Unchanged `node docs/evidence/sol-client-05h-astra-probe.mjs`: all four cases passed.
- `node --test tests/detailed-printing-persistence.test.js tests/detailed-printing.test.js tests/identity.test.js tests/exact-sold-valuation.test.js tests/graded-copy-persistence.test.js`: **23 passed, 2 guarded database skips**. These skips are not independent persistence proof.
- Reviewed the production selection/reconstruction path, focused regression cases, guarded endpoint ownership checks, owner RPC/fresh-client test and browser form/fresh-login assertions.
- Compared the eight revision source/test hashes against Sol's final table; all match.

## Reported real local evidence and limits

Sol reports the enabled database run passed **2 tests with no skips**, and actual form save → new browser context login → persisted-row detail passed in desktop Chromium and mobile WebKit. The inspected harness uses production application/form code with test-only exports, forwards browser Supabase requests to the verified disposable local origin, and uses synthetic catalog/API responses. It checks the stored UUID/source-reference distinction independently through an authenticated owner client. The fresh browser obtains its item from the database rather than seeded item memory. This supports the bounded persistence claim; it is not a live catalog, numeric price, physical-device or deployed-browser test.

Sol reports the disposable stack/users/volumes/workdir were removed and mica-dev was untouched. Astra did not recreate that stack or independently rerun the database/browser cases. The retained executable assertions and detailed report are the reviewed evidence; the deleted temporary launcher and lack of an independent rerun limit reproduction of the original execution. Sol's 443 unit passes, 110 browser passes/10 skips and build/lint/typecheck results remain attributed to Sol.

## Next boundary

No further save/reopen changes are issued. Step 5 still lacks a positive, independently reconstructable real-sale numeric result and resolved production retention/display rights. The diagnostic Pikachu's unresolved identity and CLIENT-05D's insufficient two-contributor result must not be promoted into accepted valuation evidence.

Issue `docs/SOL_CLIENT_PACKET_05J_VALUATION_PREFLIGHT.md` as the sole active packet: prepare one evidence-backed candidate and a concrete rights/budget-aware validation plan, without paid-provider requests or application changes. No CLIENT-06, deployment or release acceptance is implied.
