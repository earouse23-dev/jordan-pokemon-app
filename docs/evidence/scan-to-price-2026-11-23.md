# Scan to price verification

Production app revision `288d77b` includes the printing resolution and quote retrieval changes in `44e3dfd`.

The original Japanese Charizard photo shows a PSA 10 label marked “STORMFRONT-1ST ED.” Its catalog entry supplied an empty variant list. The previous workflow treated an inferred unlimited edition as a contradiction, asked for confirmation and stopped before fetching prices. The corrected workflow preserves the supported edition from the photographed label. Contradictory or ambiguous evidence still requires review.

## Production photo uploads

The original photo reached Japanese Charizard #092/092, holofoil, first edition, PSA 10 in mobile Chromium and WebKit. Both displayed the $6,500 recorded eBay comp (August 3, 2026, item 407034319577), and five sales in the chart. The add form retained the grade and certificate. No collection write was needed.

Measured upload-to-price times were 2.46 seconds in Chromium and 2.89 seconds in WebKit on the deployed revision. Previous observed runs took 12.6 and 21.3 seconds and required edition confirmation. These are individual runs.

In a subsequent WebKit session the first upload took 2.47 seconds with one sales request. After it settled, navigating home and uploading the same photo again took 1.37 seconds with zero sales requests. Both visits showed the same price and chart without an edition prompt. Both used the on-device label reader. These browser checks used mobile viewports on a Mac. Physical iPhone camera acceptance remains open.

## Model comparison and scope

On three additional photographed slabs (Sky’s Rayquaza, Ninetales and the Topps movie foil), the mini model returned the printed grades 10, 9 and 10. Nano omitted the grade on all three. Median measured cloud-stage times were 8.41 seconds for mini and 6.42 seconds for nano. Mini remains the fallback. Correct grade recognition alone did not establish the full printing or a catalog match for every photo. The Topps foil had no confirmed catalog match.

The unit run recorded 633 passes and three skips. The focused browser workflow suites recorded 199 passes and two skips. The final certificate crop refinement was also exercised with the original photo in WebKit.
