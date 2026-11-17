# Slab acceptance follow-up

## Observed defect and repair

Replayed the owner's original photos through the live application's ordinary Choose photo flow. No mocked recognition or forced catalog identity was used. A new Charizard run failed to resolve because the observed name included the entire `2008 POKEMON JAPANESE CHARIZARD-HOLO` slab header. The existing annotation cleanup handled `Charizard-Holo`, but not year/game/language prefixes.

Catalog lookup now shares one name normalizer across internal/TCGdex parsing and PkmnPrices metadata recovery. It removes the narrowly recognized slab header and existing holo/delta annotations from the lookup name. Original observations, set, collector number, language, grade, qualifier and certificate remain separate and unchanged. Metadata recovery retains the eight-row bound, existing durable cache/budget and explicit candidate review. Tests exclude another language and number and preserve legitimate Pokémon Center Lady and year-bearing titles.

Optional price details previously described a missing provider reference as no matching graded price, contradicting the valid eBay comp above. The reference section now says Market reference / Same grade only / No matching reference quote. An empty reference no longer renders a source message implying there are no matching eBay comps. Actual sold evidence and all pricing exclusions remain intact.

## Live original-photo checks before publication

- Rayquaza: Japanese Sky's Rayquaza 003/019, PSA 10, certificate retained in the cancelled add form. Finish needed explicit non-holo confirmation; the first model response offered holofoil, so this is not automatic printing acceptance. Matched $1,776 eBay comp dated November 2. The suspicious $90 historical observation was cross-checked against eBay item 116423961846, whose ended page shows the correct 2004 Movie VS 003/019 PSA 10 identity and US$90; it was not discarded merely for being low.
- Charizard: the full-header normalization failure above was reproduced on production; post-publication replay is recorded below.
- Ninetales: Dragon Frontiers 8/101, PSA 9, correct certificate retained in the cancelled add form. Older provider quote US$453.13 from May 31. Source item 336589909441 opens the correct PSA 9 listing, showing C$625. The visible source page establishes identity and original-currency asking/ended amount, not independently verified payment or a historical FX rate.
- Sideways Topps foil: read as the 1999 movie Trying Out the New Toy slab / PSA 10 but still no catalog match. Existing catalog coverage gap remains open. No substitute TCG price was used.
- Back-only Pokémon XD photo: no catalog match, grade or price fabricated.

Original photos, transcripts and screenshots remain under ignored `benchmarks/private/slab-acceptance-followup/`. Customer inventory was not written; add forms were cancelled. Hosted save/reopen with a disposable owner and physical camera acceptance are not claimed by these read-only checks. Certificate transcription is not official authentication. No universal recognition/coverage guarantee is possible from five photos.

## Automated verification

- 616 unit tests passed, three existing skips; lint (101 source files) and syntax checks passed.
- Intake and price-evidence matrix: 145 passed, two existing skips, with three failures in the new reference-heading assertion (the wording was finalized as Market reference rather than Reference prices). Corrected that assertion and reran all 36 price-evidence cases across desktop Chromium, mobile Chromium and mobile WebKit: 36 passed, including the three affected cases. These are overlapping runs, not 181 unique passing cases.
- Exact-context sold-price caching/save handoff tests retain the value, avoid a second lookup within 24 hours, and require a new context for another owner. These synthetic write tests are distinct from live photo recognition and do not establish hosted customer save acceptance.
