# Saved history coverage audit

Owner request: distinguish missing source coverage from incomplete collection, preserve history, and make the normal new-account workflow start on the entered acquisition date. Read-only production inspection; no customer writes or new provider requests.

The portfolio shown by the owner has saved-view model 3, checked day October 20, and no pending history backfill. All nine ungraded positions retain aggregate observations beginning April 13, 2026. Matching slab archives are:

| Card | Context | First accepted sale | Retained matching sales | Remaining cursor |
| --- | --- | --- | --- | --- |
| Blastoise | PSA 9 | June 25, 2026 | 28 | None |
| Charizard V | PSA 10 | July 18, 2026 | 94 | None |
| Espeon | CGC 8.5 Unlimited | May 13, 2026 | 4 | None |
| Umbreon VMAX | PSA 10 | July 20, 2026 | 113 | None |
| Lugia V | PSA 10 | July 24, 2026 | 172 | None |

Every accepted archived slab sale is represented in the saved matched history. The completed current-context archives have no remaining backfill cursor. Older incomplete cache entries also exist, but they are not the current-context archives used by this portfolio; their existence alone does not mean this account has unfinished backfill.

Stored raw Espeon CGC 8.5 responses distinguish four Unlimited sales beginning May 13, one 1st Edition sale dated February 24, and two rows without a variant. The earlier First Edition observation cannot fill Unlimited history. Unknown-edition rows cannot establish an exact edition match. Existing safeguards correctly preserve that distinction.

This establishes the contents and completion state of the retained downloads, not a guarantee that the upstream provider has never collected any additional older data. No fresh provider request was made to independently revalidate upstream coverage. A new provider correction or confirmed missing exact sale should be ingested through the existing retained archive rather than repeatedly redownloading the completed history.

No source change is justified by this audit. Current behavior already requests a 365-day aggregate backfill, resumes pending pages, retains old rows, uses incremental day windows and graded ingestion watermarks, and reuses complete same-day portfolio views. Acquisition dates, rather than account creation, define ownership. New holdings entered with today's acquisition date start today; explicitly backdated holdings receive historical prices where retained and purchase-cost estimates otherwise. Dashed aggregate segments mean at least one holding is estimated, not that every holding lacks market evidence.

Verification: `node --test tests/pkmnprices-requests.test.js tests/portfolio-service.test.js tests/portfolio-view.test.js` passed all 30 checks with no skips. Coverage includes retained pagination recovery, graded short-page continuation, incremental ingestion, daily cache reuse, revision invalidation, historical acquisition/sale accounting and purchase-cost handoff. Existing publication remains unchanged; this is a documentation-only audit.
