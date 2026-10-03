# Astra CLIENT-05 review — REVISE

Date: 2026-09-24. Local acceptance withheld pending R1–R3. No live valuation, FX or release acceptance.

## Findings

### R1 — High: title label contradiction can contaminate BGS valuation

`saleMatchesLookup` compares structured qualifier fields only; missing provider qualifier becomes null/empty. `saleMatchesCanonicalIdentity` ignores the words black/gold/label. A row titled `Pikachu Synthetic Violet 025/100 Holofoil BGS 10 Black Label` with missing structured qualifier passes both stages for an ordinary unqualified BGS 10 request. That result can receive the API's validated envelope and enter the normal BGS 10 valuation pool. This violates the required separation of label contexts. Conflicting title facts must cause exclusion/uncertainty, not be ignored or silently promoted to authoritative structured facts.

### R2 — High: canonical first-edition flow is rejected at two boundaries

The app sends `selectedPrinting(item).edition`, whose canonical value can be `first_edition`. `api/sales.js` validates edition through SAFE_TEXT, which disallows underscores, returning HTTP 400. Separately, a matching `1st Edition Holofoil` title passes `saleMatchesLookup` but fails canonical matching because edition words are treated as unexplained identity words. The calculator's constructed first-edition test bypasses these real adapter/API boundaries. Fix both without weakening wrong-edition, bundle or wrong-identity safeguards.

### R3 — Medium: upstream exclusions disappear from the evidence UI

The adapter removes wrong-context/canonical rows and returns only aggregate exclusions. The API returns those counts, but `loadSales` drops them; the estimator/UI can describe only exclusions among the already accepted rows. Thus real adapter rejections are invisible in the new traceable exclusion panel. Carry safe stable rejected-row references/reasons through the actual path, distinguish adapter rejection from valuation-window/currency/outlier exclusion, and reconcile counts without double counting. Do not turn rejected rows into valid evidence or expose unsafe source links. If normalization cannot identify a row, report that limitation explicitly rather than fabricate its identifier.

## Independent evidence

`node --test tests/exact-sold-valuation.test.js tests/pricing.test.js`: **58 passed**. Additional offline executable probe `node docs/evidence/sol-client-05/astra-review-probe.mjs`: **three failed assertions**, confirming R1 and both R2 boundaries. The probe does not contact providers. R3 is source-traced through adapter, API, `loadSales` and `renderExactSoldValue`; no independent browser claim is made. Sol's 108 browser passes and wider checks were not repeated because these earlier boundary failures already require revision.

Reviewed hashes:

- `lib/pricing.js`: `878984d5cd1f9b03761034be32670ab701e604054afb4014a9d3113725242fa9`
- `lib/providers/pkmnprices.js`: `fae628da1d60bc147d23675daf0f1eb1b07c36a50d63e28401815ed6e572891e`
- `api/sales.js`: `c1ba12aaa4d8e1206e95a39f970bc94dde7d393433e24abcc41f3c7e14c7aa47`
- `app.js`: `c9ef700c2ef00698421b13d907cd25626dd26c4108d2bc8f15af92c2ec0258ba`

The median/window/currency implementation and request guards are promising, but exact valuation requires both positive and negative end-to-end adapter evidence. Preserve the frozen numeric policy; these findings do not request a different algorithm, provider call or broader feature scope.
