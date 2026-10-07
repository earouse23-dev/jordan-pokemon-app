# Pricing correction publication — checkpoint67, October7,2026

App: https://jordan-pokemon-app.vercel.app. Deployment:dpl_6pxc7X4P5zs4fjR1Xsr4KdHieTqD. Product commits97d2481be81946d560399db3b2c777c3915b9836 and94fb157f577d5c49ea8e9da1b3e54b19411c5382; final remote/alias proof accompanies this report. Historical62–66 artifacts and failed probes are preserved.

## Root fixes

The shared PkmnPrices sale matcher rejected correct PSA listings containing the full provider set name, rarity descriptors and matching English abbreviation. Resolve those words from the validated provider identity; retain wrong card/number/total/set/language/printing/grade/qualifier exclusions. Raw EUR selects exact-condition Cardmarket quotes; history translates known display aliases into actual provider printing labels and requests the selected original currency. Graded detail/context changes read completed sales; grade charts use eligible actual sale dates, not fabricated daily grade history. Collection refresh reads one sale context per identical graded identity, retaining owner/session and provider-allowance guards.

Two late metadata issues overwrote graded price fields/newer evidence; preserve the current entry during metadata updates. The real remaining P/L defect was monetary precision: the median220.23000000000002 failed the existing strict two-decimal money parser. Round only the final USD/EUR estimate to cents in the shared valuation function. Original sale amounts, eligibility, outlier review and statistical median remain intact; money output intentionally becomes220.23. Interim65's extra evidence-holder fallback did not fix the real failure and was removed. Assertions were retained and exercised with the actual ten-sale prices.

Unknown legacy printing has a direct required-choice confirmation action using the existing audited owner correction RPC. Preserve quantities, purchases, sales and notes. An intentional identity correction archives the previous identity's price history; the UI explains it and retains choices on failure. No guessed edition/promo/qualifier, automatic customer repair or SQL replay.

Official contracts: [cards](https://www.pkmnprices.com/docs/cards), [history](https://www.pkmnprices.com/docs/price-history), [completed eBay listings](https://www.pkmnprices.com/docs/ebay-listings).

A failed HTTP lookup for one older synthetic demo entry previously aborted collection refresh and discarded successful results.67 isolates that entry, marks it as an error, preserves its records, and continues valid raw/graded cards under the existing rate limit. The upstream failed identity remains unavailable; no substitute price is invented. Commit2b601652f2fbec5e0eb22d50e36115b03a4a938a completes this correction.

## Proof and package

Actual authenticated Pro evidence: Mew ex151/165 Holofoil Near Mint USD6.41/EUR6.00 with101 returned history rows; Mew ex193/165 PSA10 USD220.23 with10 of10 accepted sales, latest October3. Grade chart has nine distinct sale dates. Provider queries are reused because their request/matching changes were unchanged after63; final browser checks exercise67. Public evidence contains aggregates, not licensed response dumps/customer records. Two synthetic entries were added once to the existing isolated demo account with a private dispatch/idempotency ledger. No customer or existing demo entry was rewritten. Real browser proof covers login, displayed raw current/history, PSA estimate/sale chart, P/L and dashboard value/visible collection. Prior bounded demo save/photo/sale proof is reused; runtime reads alone do not prove those workflows or device acceptance.

536 unit passes,0 failures,3 skips. Full affected browser run156 passes/3 database-dependent skips in desktop Chromium/mobile Chromium/mobile WebKit. Final grade/race checks, including real cent-price/original integer-price cases and failed per-card requests,12 passes across those engines. Explicit-printing/no-durable-valuation-write/account boundaries remain runnable. Failed interim real P/L probes drove the precision fix. A cold browser probe hit transient FX unavailability; the endpoint subsequently returned a valid October6 ECB rate. Final browser evidence records retry use. No assertion was deleted or weakened.

Two clean curated builds reproduce:

- Deployment ZIP:7d01272281f2984579b5196a6248e4ec52645c047c7880baf90bdafa826172d9
- Source ZIP:14c252c6ce0555f7499ea0ff653f169063c42ea3c37bcce05627ff13636f74e2
- Manifest:c54ac63ff39496bc2e69c0477701e3fee18719ed06471ad674f8c742372c14ef

90 source entries,49 outputs,nine functions. Product delta from62:app.js,api/cards.js,lib/pricing.js,lib/providers/pkmnprices.js,scripts/build-release.mjs. Relevant output delta:static/app.js,api/cards.func/index.mjs,_release-hold.func/index.mjs. Shared active Pro code in the routed bundle does not enable held providers. Routing/count/certificate-exclusion checks and139-file actual credential/private-demo-value scan pass. Existing public configuration, source provenance and unrelated dirty work are preserved. Private backups/customer/runtime files and response dumps are excluded from Git.

READY and staged route checks precede promotion. Final exact live app/config hashes, canonical alias, health/capabilities, auth401, held503/no-store, CORS204, hostile403, unknown404 and deletion401 pass. The sole live cron is /api/capabilities?surface=grading-deletion at15 5 * * *. Existing ignored Git build exit0/source deployment suppression prevent Git replacing the prebuilt release or enabling paid jobs; verify remote and final aliases after push. Bounded runtime review records existing DEP0169 warnings separately from application errors. No new dependency, paid AI activation, provider purchase, SQL replay or platform/store action.

## Remaining acceptance

Unknown customer printing requires factual owner confirmation. Pro cannot guarantee recent grade sales or a daily/year-long history for every card; sparse/stale/missing evidence stays explicit. Separate AI recognition/pregrading/advisor allowance and authoritative certificate/population access remain gates. Elliott tests physical iPhone Safari camera/library and recovery→new-password/sign-in. Native extensions/signing/subscriptions/App Store remain separate. This is bounded verified pricing publication, not a claim that every beta requirement is operational.

Final browser proof:raw price/history,PSA estimate/history/P/L(+10.1%),known dashboard value and visible collection pass,zero uncaught browser errors. Two background HTTP502 pricing responses remain for unavailable older synthetic demo records;67 keeps them isolated instead of poisoning validated cards. Final browser FX conversion succeeded without retry. Bounded hosted runtime sample:four existing DEP0169 warnings,no uncaught/unhandled application log payloads.
