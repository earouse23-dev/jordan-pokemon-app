# Mica Step 3 canonical identity design

Status: complete; isolated CI migration rehearsal passed
Date: 2026-08-31
Dependencies: Steps 1 and 2 complete

## Outcome

Mica now has one provider-neutral identity contract for catalog printings,
variants, sealed products, owned positions, prices, transactions, watch entries,
and grading lineage. A provider identifier is evidence about an identity; it is
never Mica's primary identity.

The implementation is additive. It does not delete or rewrite production data,
and it has not been deployed.

## Identity layers

| Layer                    | Stable identifier                    | Meaning                                                                 |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------------- |
| Card printing            | Existing `cards.id`                  | Set, collector number, and language when no exact variant is known yet. |
| Exact card variant       | Existing `card_variants.id`          | Printing plus finish, edition, language, and promo metadata.            |
| Sealed product           | New `sealed_products.id`             | Provider-neutral identity for an unopened product.                      |
| Unresolved collectible   | New owner-scoped UUID                | Explicit review state when an exact identity cannot be proven.          |
| Owned position           | Existing `collection_items.id`       | Quantity and current ownership state tied to one collectible.           |
| Physical grading lineage | Existing `grading_physical_cards.id` | The same physical copy across scans, submission, return, and regrade.   |

Raw condition, grading company, grade, certification, ownership, and financial
facts remain context on the owned, pricing, and grading records. They do not
change the underlying collectible printing. This prevents a PSA return or
condition update from silently becoming a different catalog item.

## Database contract

The migrations are:

- `20260831235837_canonical_collectible_identity.sql`
- `20260901002305_canonical_identity_runtime.sql`

They add:

- `collectible_identities`
- `sealed_products`
- `collectible_provider_mappings`
- `identity_match_rule_versions`
- `identity_match_decisions`
- `identity_corrections`
- `identity_merge_proposals`
- `identity_merge_events`

Every identity-bearing portfolio, pricing, scanning, and grading table receives
a non-null `collectible_id`. Triggers derive that value from the authoritative
parent record and reject mismatched card/variant pairs. Correcting an owned
position propagates the identity through its transactions, lots, prices, owned
copies, submissions, and grading lineage.

New Data API tables use explicit grants and RLS. Shared catalog identities are
readable by signed-in users. Manual sealed and unresolved identities are visible
only to their owner or an administrator. Their registry metadata contains no
card snapshot, name, notes, or other private record contents.

Owner-created identity rows cascade away during account deletion. References
use deferred `NO ACTION` checks so the same deletion transaction can remove the
owner's portfolio and identity rows without weakening protection for shared
catalog identities. Historical admin actor references become null instead of
blocking account deletion.

## Matching contract

`lib/identity.js` implements `identity-match-v1` with normalized:

- set and card name;
- collector number, including padded numeric forms;
- language;
- finish;
- edition;
- promo type;
- sealed product type;
- grader and grade when comparing graded evidence.

Conflicting identity discriminators disqualify a candidate. Missing fields,
tied candidates, or multiple close variants return a review state. Every result
requires user confirmation, including an exact recommendation.

The current client catalog API remains deliberately limited to English and
Japanese. The normalizer accepts the ten languages already shown by the manual
entry interface so future catalog coverage does not require an identity-schema
rewrite. Expanding live catalog coverage remains a separate provider and product
decision.

## User workflow

Catalog results retain their stable internal variant UUID instead of collapsing
variants to display labels. When a card has multiple variants, the add sheet
shows an exact-version selector and explains which fields differ. The chosen
UUID is saved with the identity snapshot and watchlist record.

Identity corrections now append an immutable event, preserve the financial
ledger, clear only incompatible position-price observations, and expose an Undo
action for the latest correction. Reversal appends another event; history is
never erased.

## Duplicate and merge workflow

Administrators can propose, accept, reject, and reverse an identity merge.
Acceptance turns the source into an alias of the target rather than rewriting
or deleting history. Resolution follows aliases with a bounded cycle guard.
Owner-specific identities can merge into a shared canonical identity, but
cannot merge across owners.

## Benchmark

`tests/fixtures/identity-benchmark-v1.json` covers:

- common English non-holo;
- Japanese printing;
- Black Star promo;
- reverse holo;
- parallel printing;
- PSA graded context;
- sealed Elite Trainer Box;
- an intentionally ambiguous finish.

The current result is 8/8 expected outcomes, zero silent substitutions, and
100% confirmation coverage. The fixture is a deterministic engineering gate,
not a claim of complete real-world catalog coverage. Elliott's difficult-card
and import examples should be added before expanding language or provider
coverage.

## Exit gate passed

Read-only production preflight found 119 current portfolio, watchlist,
dependent, and grading rows with safe migration paths and zero invalid identity
links or orphaned parent relationships. No private record contents were read.

GitHub Actions run `33458418252` applied the complete migration history to
PostgreSQL 17, returned zero reconciliation errors, passed all 47 transactional
integration assertions, passed database lint without errors, reset to the
pre-Step 3 migration, reapplied every migration, and passed all 47 assertions a
second time. The disposable database was deleted after 2 minutes 22 seconds.

Step 3 is complete. No production migration or deployment occurred.
