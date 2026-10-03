# CLIENT-05K — Astra review

2026-09-25. Decision: accept the offline diagnostic evidence; issue a focused revision. The proposed live experiment remains unready and unauthorized.

Astra independently ran `node --test tests/client-05k-offline.test.js tests/client-05b-guard.test.js tests/client-05d-transient.test.js`: **15 passed, 2 failed**. The passing bare-title test asserts the known failure, rather than correct product behavior. `saleMatchesCanonicalIdentity` tokenizes the provider-facing name `Clefable (1)` and requires token `1` in a title whose collector number is `01/64`. The separately checked fraction does not satisfy that redundant name token. This is a conservative false rejection, not evidence of accepting the wrong printing.

The two 05D failures occur before fake transport. `scripts/client-05d-transient.mjs` selects an option by display label `holo`; the detailed normalizer now uses `Holofoil`. Its existing source and unknown-edition/promo guards still matter. Repair the selection by stable source identity and semantic facts, not by relaxing those guards or changing historical evidence.

Authorize only the bounded revision in `docs/SOL_CLIENT_PACKET_05K_REVISION.md`: collector-number corroborated numeric display-suffix handling for sale-title comparison, plus compatibility repair of the old offline harness. No generic alias table, catalog rewrite, source-name stripping or new live entitlement follows. A real provider mapping remains unverified; this fixes the demonstrated offline path only.

No application changes, environment-file reads, database operations or live requests were made during this review. Provider rights clarification, positive real numeric evidence and CLIENT-06 remain outstanding.
