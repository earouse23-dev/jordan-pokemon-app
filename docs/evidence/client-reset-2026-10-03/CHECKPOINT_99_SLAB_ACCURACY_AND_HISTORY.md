# Checkpoint 99 — slab accuracy, retained history and controls

## Requested fixes and shipped behavior

1. EUR equivalent: share one in-flight ECB request between display and detail, retain validated rate in session and retry one transient failure. Original transaction amounts and currencies remain unchanged.
2. Daily history persistence: retain raw historical rows in provider_response_cache; a completed single-page 365-day raw history downloads only the elapsed UTC-day window thereafter. Shared exact-slab archives retain completed-sale pages across users, detail and portfolio. Once initial backfill is complete, poll once per UTC day using the provider's exclusive ingestion timestamp cursor. Short pages with has_more continue. Large archives resume bounded backfill pages rather than redownloading them.
3. Latest exact slab comp: request newest-first eBay sales, then match language, card number, finish, edition, company, grade and qualifier locally. Provider printing labels include edition, so a Holofoil query was incorrectly hiding Unlimited Holofoil sales. Seller inventory tags and harmless Clean Card OG / 100 HP wording no longer reject otherwise exact titles. Wrong card numbers and editions remain excluded. The latest matching sale supplies the headline and its linked evidence; a legitimate recent market move is not discarded solely for differing from older median prices.
4. Slab chart: all-time bounds follow actual first and last recorded sale dates, not the owner's purchase date. Continuous green line, no dots, subtle fill; multi-year axes include years. No invented historical prices.
5. Controls: rounded green primary actions, mint secondary actions, card-style eBay evidence links, accessible focus and touch targets, reduced-motion support, light/dark responsive checks.

## Live evidence

Authenticated staged reads returned: Charizard V PSA 10 $720 (2026-09-28); Umbreon VMAX PSA 10 $3,750 (2026-09-27); Blastoise Unlimited PSA 9 $1,168.20 (2026-09-07); Espeon Unlimited CGC 8.5 $291 (2026-08-17); Lugia V PSA 10 $1,250 (2026-09-29). Blastoise and Espeon archives completed; other three had resumable older pages. See live-slabs-checkpoint-99.json. Final staged server source is identical to those reads; the final build adds an explicit grade/edition headline label.

The user's visible Card Ladder comparison is Shadowless Blastoise PSA 9, last sale $5,000 on October 4. Mica's stored card is Unlimited. They must remain separate; no customer edition was changed to match a desired price.

PkmnPrices support confirmed printing-label differences and ingestion cursors. Their older records may have null sale_type and may represent asking rather than verified accepted amounts. These values remain labeled comp estimates. This release cannot create sales absent from the provider or guarantee competitor coverage. Official documentation: https://www.pkmnprices.com/docs/ebay-listings and https://www.pkmnprices.com/docs/price-history .

## Verification

- 175 focused unit tests passed: pricing, exact sold valuation, provider request/cache, history, portfolio service, current revision and security.
- 12 current browser acceptance checks passed across desktop Chromium, mobile Chromium and mobile WebKit: transient FX recovery, currency preference, atomic cached portfolio restore, latest slab evidence/chart in light and dark modes.
- Lint (101 sources), syntax/typecheck and git diff --check passed.
- Final staged health, configuration hash, auth boundaries, held routes, CORS and unknown routes passed; zero paid calls in that runtime check.
- Isolated demo GET/refresh/GET returned 200, retained raw history, real graded price and saved chart. Synthetic unpriced demo positions remain explicitly incomplete; customer purchase/copy records were not written.
- Broad legacy suite is not fully green: full unit run had 13 failures, of which 2 current revision expectations were corrected and pass. Remaining 11 frozen CLIENT-05 proof guards pin old limit=10 / variant query URLs and deny the new limit=20 locally matched archive requests. Historical browser suites also retain superseded median-price, old chart-placement/range-button and clock expectations. Historical proofs were preserved, not rewritten. Current behavior has focused replacement acceptance coverage; no claim that every legacy test passes.

## Publication boundaries

Final candidate dpl_8NcsYcYWQgNV2Bk2emJeWLDbd9yQ; publication state recorded separately after promotion. Nine functions, existing two crons and Git build suppression retained. No SQL migrations, new dependencies, services, provider budget changes or customer inventory writes. Unrelated dirty documentation excluded.

## Production acceptance

Promoted dpl_8NcsYcYWQgNV2Bk2emJeWLDbd9yQ after staged checks and source commit fc13c8a. Canonical assets match the frozen manifest; both existing cron definitions point to this deployment. Production auth/CORS/health checks passed. In the real signed-in browser, the prior saved total $9,104.27 appeared first, then one complete background update produced $9,322.47. Blastoise changed from $950 to the correct newest matching $1,168.20 comp, and its all-time chart visibly spans June 25–September 7. EUR equivalent visibly returned €1,042.48 at ECB rate dated 2026-10-09. Screenshot checkpoint-99-live-blastoise.jpg captures this production page.

The real customer's Espeon remains excluded because its stored edition is unknown. The detail correctly requests confirmation of printing/grade/label; the isolated explicit Unlimited CGC 8.5 lookup returns $291, but that does not authorize rewriting the customer's physical card as Unlimited. This is an unresolved inventory fact, not a claim that all five customer positions were priced. All four customer PSA positions visibly have prices. No customer edition/purchase/copy data was changed.
