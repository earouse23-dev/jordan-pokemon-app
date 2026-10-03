# CLIENT-06B — Astra review

2026-09-25. Accept the bounded read/history implementation and documented fail-closed write state. **The secure write path is not yet accepted.**

Astra reviewed `api/graded-valuation.js`, `lib/graded-valuation.js` and the proposed SQL, and independently ran `node --test tests/graded-valuation.test.js tests/portfolio-history.test.js`: **13 passed**. These are mocked write-contract and calculator tests, not execution of the proposed SQL. Sol's enabled database/read/browser result remains attributed to Sol; its independent fixture insert is accurately distinguished from an authenticated route write.

The additive function is a proportionate way to close the demonstrated check/insert race: existing table and columns, service-only execution, fixed search path, session lock, owner-bound position lock and a repeated context comparison before insertion. Existing browser write grants remain absent. Source context/evidence is computed by the authenticated server, not trusted from browser input. The proposal must still compile and prove these properties in the effective database, including row-lock behavior, permission/revocation and duplicate semantics.

Approve **local validation only** in `docs/SOL_CLIENT_PACKET_06C_ATOMIC_WRITE_VALIDATION.md`. Sol may apply the reviewed function to a newly created disposable database using existing tooling, and make narrowly necessary corrections revealed by executable validation. This does not approve a hosted migration, production activation or a new provider request. If validated, a single additive migration artifact can be authored for subsequent review; it must not be applied to an existing/shared/hosted database.

Special checks: `ON CONFLICT(id) DO NOTHING` must not report success for an unrelated/conflicting record; retry responses must preserve the stored observation's identity/time rather than falsely implying a second write. Prove that duplicated/reordered evidence and later reevaluation obey the intended observation identity semantics. The mocked “session active” model must be replaced by actual Auth-session behavior and independent database transactions.

CLIENT-06 remains incomplete until the secure path is proven. Aggregate graded snapshot provenance remains a separately documented boundary; do not quietly promote old aggregate rows. Step 5 live-price/display and physical-device/release gates stay open; CLIENT-07 is unissued.
