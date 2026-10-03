# CLIENT-05J — Astra review

Date: 2026-09-25. Decision: accept research/preflight for its stated scope. **No live experiment authorized and no valuation exit gate passed.**

Astra independently fetched the public TCGdex `base2-1` record and passed it through unchanged `normalizeTcgdexCard`, `collectibleIdentitySnapshot` and saved selection. The exact result was English Clefable, Jungle, 1/64, holofoil, first_edition, promoType none, source variant `3a83wf50ts0izj268xwv3crwi`; saved selection remained exact. PSA 10 is a proposed experimental context, not evidence of an owned/authenticated slab.

Astra also read the public provider card page, sold-endpoint documentation and terms. The page supports candidate card ID 20618, not an accepted API crosswalk. Its name/number differences require explicit validation. Approve `Clefable (1)` / `01/64` only as a **candidate-scoped offline hypothesis** for the next rehearsal. No global alias, production mapping or live request is approved. A future direct response must substantiate the mapping before sale retrieval. Preserve TCGdex source facts separately; do not rewrite sale titles or confuse provider display decoration with physical printing facts.

The documented sold endpoint charges by returned row and supports `limit=10`, but this does not guarantee that ten eligible exact sales exist. The two-request/eleven-credit proposal remains unexecuted and unapproved. Its cap does not transfer prior CLIENT-05D authorization to this card.

Published terms do not specify the requested field-level retention/display limits. The repository's `docs/data-rights-and-attribution.md` explicitly requires written commercial authorization and a record of retention/attribution/termination terms before release. The provider clarification drafted by Sol is appropriate; no message was sent. This is an unresolved engineering permission gate, not a claim that ordinary subscribed API use is prohibited.

Next: `docs/SOL_CLIENT_PACKET_05K_OFFLINE_VALUATION_REHEARSAL.md` prepares and checks the bounded experiment offline using existing guards and synthetic responses. It cannot close real-sale or rights gates. Once that bounded work is complete, missing external permission/authorization must be reported plainly rather than replaced by more speculative code. No CLIENT-06 is issued.

Sources reviewed: [TCGdex](https://api.tcgdex.net/v2/en/cards/base2-1), [provider candidate](https://www.pkmnprices.com/catalog/cards/20618), [sold endpoint](https://www.pkmnprices.com/docs/ebay-listings), [terms](https://www.pkmnprices.com/terms). No paid-provider requests, environment files, databases or application edits were involved in this review.
