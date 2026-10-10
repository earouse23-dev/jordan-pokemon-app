# Checkpoint 100 — exact profile, search and retained history

## Changes

- Reuse the existing name/set query parser for Base shorthand, Base Set 2, Neo Discovery, Brilliant Stars, Lost Origin, Silver Tempest, Shining Legends and Surging Sparks. Name-plus-set no longer becomes a single Pokémon name. Live pre-fix query Blastoise base returned zero; Blastoise Base Set already returned the correct 2/102 record.
- Listing title includes known release year, name, set, collector number, finish, edition, language, grading company, grade and qualifier. Unknown printing facts remain explicit, never inferred from a target price.
- Remove the gameplay Card information accordion (HP, attacks, ability, flavor text). Stored metadata is retained.
- Retain validated saved exact-sale graph while a refresh is pending or fails. Same-day complete saved evidence is reused on detail reopen. Existing shared database archives and daily ingestion cursors are unchanged.

## Provider investigation

PkmnPrices support confirms the eBay endpoint has no age cap, historical rows can reach 2016, exact variant labels matter, and daily updates use highest ingested_at as exclusive since. The complete saved archive for Blastoise Unlimited PSA 9 has 38 received / 26 accepted rows, first matching sale June 25, last September 7, has_more false. Espeon Unlimited CGC 8.5 has six received / four matching rows, May 13 to August 17, has_more false. These coverage boundaries are source availability, not a three-month UI cap. Different editions and unknown editions are excluded from each exact slab estimate.

User supplied https://www.ebay.com/itm/366720545676 as the 599.99 example. Direct signed-in browser inspection on October 10 found the correct Neo Discovery 1/75 CGC 8.5, currently USD650 or Best Offer, Buy It Now and Add to cart available, listed in last three days. It is an active asking offer, not evidence of a completed sale. No transaction was performed.

Official TCGplayer listings endpoint supplies active offers, not graded completed sales: https://www.pkmnprices.com/docs/tcgplayer-listings . Raw TCGplayer aggregates remain distinct from exact graded eBay sold comps. Mixing those would invent slab comparability. Older sale_type null rows remain reported estimates; accepted-offer paid amounts are unavailable for those rows.

## Verification

208 focused unit checks pass, plus 15 portfolio history/view checks pass (one separately configured live database test skipped). Lint 101 sources and syntax/typecheck pass. Three browser projects (desktop Chromium, mobile Chromium, mobile WebKit) verify exact title, removed gameplay section, retained graph while loading, one sales read across same-day reopen, correct date bounds, no overflow and light/dark controls. One initial browser attempt hit a navigation/context race; rerun all three passed.

Staged auth/health/CORS/configuration/held routes/unknown path checks pass. Isolated demo GET/POST/GET all return 200; real graded value, 90+ raw history rows, and whole saved portfolio chart persist. No customer inventory writes. Four authenticated cached reads for complete Blastoise and Espeon archives left provider reservation at 803, unchanged timestamp: zero extra credits. Full historical pages are not fetched on repeat visits. Existing archive tests cover short cursor pages, cross-user reuse and next-day exclusive since.

Candidate dpl_AcjNr3vA2QccA4vaBm5jhokndcWb. No SQL migrations, new dependencies/services, provider budget changes or unrelated dirty documentation included. Standing publication applies; production acceptance recorded after promotion. Broad historical proof-suite limitations remain as documented in checkpoint 99; no claim that every legacy test passes.

## Production acceptance

Source de0fa20 pushed; dpl_AcjNr3vA2QccA4vaBm5jhokndcWb promoted. Canonical assets match frozen manifest, both existing crons point to this deployment, Git-triggered builds remain suppressed. Production runtime checks pass. Public live searches Blastoise base and Blastoise Base Set both return Blastoise Base Set 2/102. Signed-in browser restores saved portfolio USD9,322.47 and chart, then opens exact Holofoil Unlimited English PSA9 title and USD1,168.20 comp with archived June25–September7 graph. Gameplay accordion absent. Customer Espeon edition remains unconfirmed, so no unverified edition was assigned.
