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


## Live replay exposed a second observed-name variation

The first published replay returned `2008 POKEMON JAPANESE CHARIZARD-HOLO STORMFRONT-1ST ED.` in the card-name field and still failed catalog resolution. Header removal alone was insufficient. The shared lookup normalizer now removes an appended set only when it exactly matches the separately observed set name (after the known first-edition suffix cleanup). It requires a word/separator boundary and a nonempty remaining name. Tests preserve Detective Pikachu when card and set names are identical, partial word suffixes, and a mismatching set. Original observed fields remain unchanged. This follow-up is verified separately below; the first deployment is not represented as a successful live Charizard replay.

Fresh eBay cross-checks also show a source-coverage limitation: exact Charizard PSA 10 first-edition auctions appear at $6,300 (Nov 10, item 800872709991), $6,700 (Nov 3, item 117488624706) and $6,805 (Oct 29, item 900030567361), while Mica's eligible provider history ends with the older reported $6,500 row. That linked ended page (407034319577) currently displays $7,999; a displayed asking/ended amount does not establish a Best Offer paid amount, so the provider's $6,500 was not replaced with it.

For Ninetales, exact holo PSA 9 item 287652924798 shows Sold Oct 25, $1,175 and 27 bids in eBay search, while Mica retains the older $453.13 comp because the provider's newer row is marked unknown attribution and lacks full context. This is a material pricing-coverage gap, not closed acceptance. It requires trustworthy provider attribution/metadata; this task does not weaken exact identity checks, import handpicked browser rows into customers' histories, or claim a stale quote equals today's market value. These source pages verify public listing representations, not buyer payments.

## Edition handoff regression

After catalog recovery succeeded, the live model returned the observed edition abbreviation `1st Ed`. The shared canonical edition function accepted `1st Edition` but not this common abbreviation, leaving confirmation unselected and generating an invalid pricing context. It now recognizes `first/1st ed[ition]` on word boundaries, including punctuated/combined label text, while retaining unlimited and unrelated edition distinctions. Browser tests run the scan → candidate → printing-confirmation flow and assert first_edition and holofoil are prefilled on desktop Chromium, mobile Chromium and mobile WebKit. All three pass. An initial test-harness race checked for the candidate before recognition completed; replaced that check with the locator's normal action wait and reran all three successfully.

Final unit suite after these follow-ups: 619 passed, three existing skips. Lint and syntax checks passed. Original photographed certificates remain unverified observations; no official certificate service was added.

## Ordinary PSA label description

The next live inference returned `GEM MT` in gradeQualifier for PSA 10, which would incorrectly create a separate comp context. Identification now treats PSA 10 GEM MT/GEM MINT and PSA 9 MINT as ordinary grade descriptions, consistent with [PSA's grading standards](https://www.psacard.com/gradingstandards). It does not remove OC, Pristine, Black Label, unknown labels, or a descriptor inconsistent with the numeric grade. The identification instructions explicitly distinguish these grade descriptions from qualifiers. Final unit suite: 620 passed, three existing skips; lint and syntax checks passed. This is identification normalization only, not a new grader integration or certificate verification.

## Final publication and live replay

Final published source `ca3e84b` includes preceding source commits `3bcd796`, `fd9b7fc`, `1af2ab9` and `e13e5ab`. Production deployment `dpl_BwAZt3pyRap346ygPTbCG1S7J8YT` is READY at https://jordan-pokemon-app.vercel.app/. Client cache version is 153; the final PSA-description correction is server-side only. Production assets match the frozen artifact, health returns healthy, and unauthenticated pricing/portfolio routes return 401. Routing checks passed with nine functions and no outbound calls. Existing main production branch, team/project, cron schedules and provider budgets are unchanged.

The final unchanged Charizard photo was uploaded through the live app after applying its normal Reload update. It resolves to Japanese Charizard, Intense Fight in the Destroyed Sky 092/092, PSA 10. The version-confirmation sheet prefilled Holofoil, 1st Edition, no promo marking and no qualifier. Confirming those existing selections required no field corrections. The add form retained the printed certificate and PSA 10; it was cancelled without creating inventory. Returning to detail shows the eligible older US$6,500 comp and the recorded grade-specific history. Private proof: `charizard-final-preview.png` and `charizard-final-save-handoff.png` under the ignored follow-up directory.

The final source passed 620 unit tests (three existing skips), lint and syntax checks. Final focused scan/recovery/price/save-cache matrix passed 18 cases across desktop Chromium, mobile Chromium and mobile WebKit, in addition to the earlier 36 price-evidence cases and broad intake checks described above; runs overlap and are not summed. The final server-only ordinary-label normalization has a dedicated unit regression preserving real qualifiers and unknown/conflicting labels.

This closes the app-side reproduced title/header, edition alias, ordinary PSA label and contradictory reference-copy defects. It does not close the Topps catalog gap, the materially stale Ninetales valuation caused by excluded uncertain provider evidence, official certificate authentication, a hosted disposable-owner save/reopen check, or physical camera acceptance. See PROVIDER_DATA_QUALITY.md for exact source cases. No customer inventory write or new paid service was used.
