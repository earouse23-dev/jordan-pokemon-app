# Astra CLIENT-05G acceptance

**Accept the single-observation ECB source proof.** Local FX implementation and this source observation are accepted; Step 5's real-sale/production identity/rights gates remain open.

Astra independently parsed the retained XML with Python's standard XML parser and verified exactly one dated record, one USD rate, 1,547 source bytes and SHA-256 `884cf9f4db126e426adf7c8690d8f0038eebd506b6539d771e1155f5214f5b78`. Date `2026-09-24` and USD-per-EUR rate `1.1367` match the retained proof and current production parser when evaluated at the recorded observation time. This offline historical check is not a new freshness assertion. `api/fx.js`, `lib/fx.js` and `app.js` hashes match the accepted CLIENT-05F snapshot.

Reviewed route proof records one outbound request and one guard attempt, first HTTP 200, second HTTP 200 with identical record/unchanged fetch time, cache header decreasing from 3600 to 3599 seconds, and no additional outbound request. These live execution counts are retained Sol evidence; Astra did not repeat live transport. Sol's two real-rate/synthetic-sale UI replay passes were not independently rerun; the preceding 12 FX browser cases were independently passed in CLIENT-05F review.

The public rate is not a real card price; replayed native sales are synthetic. No PkmnPrices numeric ledger, positive real-sale estimate or physical device proof is established. No environment file was read and no application file changed during this review.

Next: CLIENT-05H closes the concrete catalog-normalization gap identified in 05C. TCGdex detailed variant records are currently ignored. Preserve explicit source facts and stable source references in production normalization, retaining unresolved facts rather than manufacturing exact mappings. This does not authorize another live sale probe or declaring the diagnostic Pikachu mapping production-exact.
