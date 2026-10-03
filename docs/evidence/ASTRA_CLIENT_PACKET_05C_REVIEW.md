# Astra CLIENT-05C review and bounded mapping decision

Research accepted for its stated scope. No live valuation gate passed. Astra independently read the detailed TCGdex record, its source schema and the endpoint-specific sold-listing documentation on 2026-09-24.

Sources: [card](https://api.tcgdex.net/v2/en/cards/2023sv-6), [schema](https://raw.githubusercontent.com/tcgdex/cards-database/master/interfaces.d.ts), [sold endpoint](https://www.pkmnprices.com/docs/ebay-listings).

The card contains one `variants_detailed` record: variant ID `jr7oetx1mqug9`, holo, standard size, no subtype/stamp, alongside false first-edition and W-stamp flags. The schema represents stamps and subtypes as optional variant attributes. This supports the catalog-described base holo candidate, but is not an exhaustive certificate about every physical printing or explicit source values named `unlimited` and `none`. The sold endpoint documents `limit`; the previous generic pagination concern is resolved without a guard parameter change.

## Decision for a diagnostic experiment only

Approve the following explicit, source-scoped mapping convention in an isolated CLIENT-05D harness, not as a production catalog rule or persisted verified fact:

- Source card `tcgdex:en:2023sv-6`; source variant `jr7oetx1mqug9`; English; Pikachu; 6/15; holofoil.
- `edition:unlimited` represents the base edition described by this detailed record. It is a reviewer inference from this record, not a direct TCGdex `subtype` value.
- `promoType:none` represents no additional printing qualifier beyond the already identified McDonald's promotional set in this experiment. It does **not** mean the card is non-promotional or disprove an unrecorded stamped printing.
- Retain the real TCGdex set ID/name and the earlier provider alias “McDonald's Promos 2023” separately. The alias is provisional until the direct provider response agrees on the full identity. No fuzzy global alias or generic omission-to-exact conversion.

This is a **conditional arithmetic/path experiment**, not unconditional exact physical-printing validation. The ordinary unresolved catalog record must still yield unavailable under unchanged production rules. A separate in-memory reviewer-mapped calculation may exercise the estimator, with the mapping decision and assumptions retained in the report. Never show its result as live validated product value or claim it closes the canonical mapping/retained-evidence release gate. No user inventory or canonical record is altered.

This distinction lets us measure provider eligibility and arithmetic without guessing that the production record has become exact. If source/provider facts conflict, do not proceed with the second request. Independent reconstruction runs in memory; no restricted numeric provider ledger, screenshot or raw payload is retained while storage permissions remain unresolved. Counts, agreement booleans, methodology and limitations may be reported without publishing source amounts/URLs. The lack of retained evidence limits independent later reproduction.

Issue CLIENT-05D under the original two-request/11-credit maximum on existing included quota. No additional samples or spending. No FX, CLIENT-06 or release acceptance follows automatically.
