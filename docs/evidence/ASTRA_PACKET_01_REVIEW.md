# Astra review — Sol Packet 01

Date: 2026-09-17. Decision: **REVISE**. Do not begin Packet 02.

## Evidence reviewed

- Sol's full implementation report and Packet 01 requirements.
- Current profile selection, request guards, rendering and pricing-context controls in `app.js`.
- TCGdex normalization, quote selection, and the new profile browser test suite.
- Desktop and mobile after screenshots supplied by Sol.
- Current `app.js` and `styles.css` SHA-256 hashes match the report exactly.
- A direct local reproduction using the current provider normalizer and price-selection exports, described below.

Sol reports 395 unit tests, 18 packet browser cases and 80 recovery cases passing. Astra did not rerun those full suites. The findings below identify missing acceptance coverage despite those results. No application code was changed during review.

## R1 — High: unresolved finish still selects a concrete price

Relevant locations: `lib/providers/tcgdex.js:294`, `lib/pricing.js:215`, `lib/pricing.js:304`, `app.js:6773`, `app.js:7336`.

The new provider options correctly preserve independent `firstEdition` evidence with `edition: first_edition` and `finish: unknown`. However, profile pricing still passes the display variant string into `selectReferenceQuote`; the selector derives finish from that string rather than respecting the canonical unknown finish.

Local reproduction:

```js
const card = normalizeTcgdexCard({
  id: 'test', name: 'Test', variants: { firstEdition: true, holo: true }
}, 'en');
const option = card.variantOptions.find(x => x.edition === 'first_edition');
selectReferenceQuote([{
  provider: 'tcgplayer', finish: 'normal', currency: 'USD',
  condition: 'Near Mint', priceType: 'market', amount: 123
}], option.label, 'USD', { condition: 'Near Mint' });
```

Observed: `option.finish` is `unknown`, `option.label` is `firstEdition`, `finishForVariant(option.label)` returns `normal`, and the selector returns the $123 quote. Humanizing the label to `1st Edition` instead defaults to `1stEditionNormal`; it still resolves an unknown finish without evidence.

This is a reproduced helper-level defect and a traced profile exposure; Astra did not run a live-provider end-to-end reproduction. It violates the exact-context intent of P2/P3/P4. Existing tests check normalization and pricing separately, but do not join the uncertain provider selection to the rendered estimate.

Required: use structured identity compatibility or a conservative profile eligibility gate. Missing price-discriminating evidence must not be silently filled by label parsing. Keep a genuine separate reference value labeled as such only if its scope is explicit; otherwise withhold the estimate. Do not globally suppress all prices because an optional descriptive attribute is missing when an authoritative mapping already establishes the exact priced identity. Add an integration/browser regression for this boundary.

## R2 — High: prior owned value can remain under a new research context

Relevant locations: `app.js:7227`, `app.js:7280`, `app.js:7341`.

`bindDetailValuationControls` clears `state.detailPricing`, changes context, and immediately rerenders. `renderDetail` then falls back to `baseItem`, including its old `price` and `pricingStatus`. Its live-price branch prefers `item.price` before the compatible quote. For an owned raw card priced at $10, a complete PSA 10 research selection can therefore render that raw $10 under the PSA 10 heading until research evidence arrives. A failed research request can also inherit the base card's live status in `loadCardPreviewPricing` error handling.

This finding is established by source tracing; the asynchronous browser reproduction remains required. The existing owned-context test checks the final $200 response and unchanged stored raw copy; the late-response test starts from an unpriced catalog card. Neither proves the intermediate/error state for a priced owned card.

Required: bind every displayed research value and status to the active identity/context. Show loading/unavailable or matching cached evidence during the switch. Keep the owner's actual saved raw value separately in the ownership summary. Verify pending, failure and retry states without changing stored ownership.

## R3 — Medium: mobile profile hierarchy contradicts the agreed product direction

Evidence: `docs/evidence/sol-packet-01/after-profile-390.png`, `app.js:7481`, and the new identity markup/CSS.

The mobile identity panel repeats set, card number and rarity; displays both Exact variant and Finish; gives three unknown attributes separate rows; and adds a long warning paragraph. Price appears below the initial viewport. The layout technically fits the width but does not lead with the result and next useful action as required by AGENTS.md and the MVP brief.

Required: retain the immediately distinguishing facts (name, set/number, language, actual variant, and a concise relevant uncertainty cue). Move secondary printing attributes and explanations into optional details. Keep the price or honest unavailable state and raw/graded context close to the header. No loss of uncertainty data or smaller text to force a fit.

Provide ordinary viewport screenshots, including a normal card with a working fixture image and an uncertain/missing-image case. Verify sticky actions do not obscure focused controls as the page scrolls; a full-page screenshot alone is not sufficient to establish that behavior. The supplied capture shows overlap, but a full-page capture does not prove a persistent interaction defect.

## Accepted decisions / remaining limits

- Keeping catalog research separate from owned-copy mutation is correct.
- Independent first-edition evidence should remain unresolved when finish is unknown; the pricing behavior must respect that decision.
- Unknown raw condition should remain unknown; preserving the nullable persistence contract is reasonable.
- Omitting unsupported population data is correct and within the packet.
- The recorded pre-existing device-alert migration mismatch is a release blocker to track separately, not justification to expand this packet.
- Local/mock tests and emulated browsers do not establish live-provider, authenticated staging, physical-device or production acceptance.

## Acceptance disposition

P2/P3/P4/P6 are not accepted until R1/R2 are corrected and tested. P7 requires the R3 hierarchy and viewport evidence. Other reported evidence remains useful; no broad rewrite or full repeated audit is requested. Re-run directly affected tests and required checks after corrections, with no redundant repetitions once results are stable.

The next authorized implementation handoff is `docs/SOL_PACKET_01_REVISION.md`. Sol remains the sole application-code writer. Astra reviews the corrected diff, screenshots and report before issuing any later slice.
