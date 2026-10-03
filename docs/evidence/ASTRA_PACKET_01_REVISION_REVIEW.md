# Astra review of Packet 01 revision

Date: 2026-09-17. Decision: **REVISE — one remaining pricing blocker**.

## Reviewed evidence and closed findings

Reviewed the revision report, current pricing/profile code, revision diff for `lib/pricing.js`, new browser assertions, normal mobile/desktop screenshots, and uncertain mobile screenshot. `app.js` and `styles.css` hashes match Sol's post-revision report.

- R1: closed for the reported unknown-finish path. Structured finish now reaches research quote selection. Astra independently ran `node --test --test-name-pattern='provider-normalized unknown finish' tests/pricing.test.js`: 1 passed, 0 failed.
- R2: closed based on source review and the reported pending/failure/retry coverage. Research evidence starts without an inherited owned value and error handling no longer inherits its live status. Astra did not independently rerun the browser suite.
- R3: accepted. The revised ordinary viewport screenshots bring the result, context and actions into view and move secondary printing facts into optional details. Do not redesign this again.

Sol reports 396 unit tests, 27 functional browser cases, 24 related recovery cases and the other recorded checks passing. Those full suites were not independently rerun during this review.

## R4 — High: raw pricing can select a graded-only quote

Location: `lib/pricing.js`, `selectReferenceQuote`, raw provider/price-type branch and `conditionNeutral` fallback. Profile call path: `loadCardPreviewPricing` passes the selected raw context to this helper, then `quotePricingFields` turns its returned amount into the displayed value.

Independent local reproduction against current code:

```js
selectReferenceQuote([{
  provider: 'tcgplayer', currency: 'USD', finish: 'holofoil',
  condition: null, gradingCompany: 'PSA', grade: '10',
  priceType: 'market', amount: 200
}], 'Holofoil', 'USD', {
  condition: 'Near Mint', finish: 'holofoil', edition: 'unlimited'
});
```

Observed result: the PSA 10 quote with amount 200. Required result: no compatible raw quote.

The raw path filters finish/currency/provider but does not exclude graded evidence before treating a null raw-condition field as a condition-neutral raw quote. Graded quotes naturally have no raw condition. The existing browser fixture supplies raw quotes before graded quotes, which masks this missing-raw case.

This is a reproduced selector defect with a traced rendered-profile path, not a newly executed live-provider/browser reproduction. The fallback predates the revision; it nevertheless violates the original P3 requirement and the profile's current promise. This review does not attribute its introduction to Sol.

Required correction: exclude graded evidence from all raw selection branches, including condition-neutral fallback. Preserve legitimate condition-neutral raw aggregates under the existing policy. Verify null, absent and empty condition representations, mixed quote ordering, and raw-versus-graded selection. Inspect confidence/evidence reporting for consistency so it cannot count excluded graded records as raw support.

## Small presentation corrections

The uncertain screenshot shows a completed unavailable result with `Checking this card version` beneath it. `quotePricingFields` can return `missing`, while the renderer only gives a terminal message to `unavailable`. Map missing/unsupported terminal results to concise terminal copy; reserve checking copy for an actual pending request. Add an assertion after the response completes.

The same screenshot exposes the provider token `firstEdition`; display it as `1st Edition` without modifying the underlying identity. These are scoped state/label corrections, not a further layout redesign.

## Next action

Execute `docs/SOL_PACKET_01_FINAL_CORRECTION.md`, then return evidence for Astra. Do not begin Packet 02. Live-provider, authenticated staging, physical-device, and migration-baseline limitations remain unchanged. No application code was edited during this review.
