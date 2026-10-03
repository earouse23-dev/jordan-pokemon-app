# CLIENT-05I — Astra review

Date: 2026-09-24. Decision: **REVISE for the confirmed reopen defect; real database acceptance remains BLOCKED.** The report correctly distinguishes prepared checks, offline evidence and unexecuted database assertions.

## Independent findings

1. `node docs/evidence/sol-client-05i-reopen-probe.mjs` reproduced exit 1: snapshot and hydrated identity remain exact with the same source ID, but `selectVariantOption` returns `needs_review` / `missing_detailed_variant`. `lib/identity.js` treats a saved detailed reference without loaded options as a missing source record. `app.js:selectedPrinting` consumes that state and suppresses exact valuation. This is a confirmed offline application defect, not observed database data loss.
2. Independently ran `node --test tests/detailed-printing-persistence.test.js tests/detailed-printing.test.js tests/identity.test.js tests/exact-sold-valuation.test.js tests/graded-copy-persistence.test.js`: **22 passed, 2 database skips**. These skips prove no database persistence.
3. The new adapter check manually supplies `variantId:null`; it establishes adapter serialization but does not exercise the private form's UUID decision. The prepared database test contains useful owner, retry and identity assertions but has not run. Its final selection assertion would expose the confirmed reopen defect. A fresh browser path is still needed to connect form serialization and actual detail behavior.
4. Sol reports the pre-existing `mica-dev` stack owns port 54321. Astra did not query, stop or mutate that stack or independently inventory it in this review. Preserving it was correct under the packet. The hard-coded port requirement was an unnecessarily narrow orchestration constraint, not a product or safety requirement.

## Revision decision

Issue `docs/SOL_CLIENT_PACKET_05I_REVISION.md` as the sole active packet. Permit the smallest application fix distinguishing unavailable catalog options from explicit source disappearance, while retaining all 05H restrictions and fail-closed behavior. Permit a separately owned disposable local project on unused ports, with endpoint/resource ownership verified before requests. Do not authorize access to the existing application's database.

The [official Supabase CLI configuration](https://supabase.com/docs/guides/local-development/cli/config) documents a project identifier that distinguishes projects on the same host, plus configurable API/database ports. This supports removing the fixed-54321 requirement; it does not establish that a second stack will start successfully with the installed tooling. Sol must verify its CLI and all enabled service ports before startup.

No application source, environment files, databases or providers were changed/accessed by Astra. Only offline tests, local source/document reads and public documentation research were used. Prior 05H acceptance remains limited to its tested scope; it does not cover this newly discovered fresh-reopen defect. CLIENT-06, positive real-sale valuation, provider rights, device and release gates remain open.
