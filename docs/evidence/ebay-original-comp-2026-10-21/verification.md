# Original eBay comp link correction

## Reproduction

Live Chrome navigation on 2026-10-22 UTC reproduced the reported mismatch:

- Saved comp: `https://www.ebay.com/itm/128082935445` (Umbreon VMAX 215/203, PSA 10, September 27, 2026, reported $3,750).
- Bare URL redirected to `https://www.ebay.com/p/24048923237`, a generic product page featuring a different Beckett 9/Korean active listing, item 187553730663, at $1,925.99.
- `https://www.ebay.com/itm/128082935445?nordt=true&orig_cvip=true&rt=nc` remained on the original item and visibly showed “2021 Pokemon SWSH Evolving Skies Umbreon VMAX #215/203 PSA 10 GEM MINT”, sold September 27 at $3,750.

The saved comp and its source item ID were correct in this reproduction. eBay's ended-item redirect produced the apparent wrong-grade comp.

## Correction

The existing marketplace URL validator adds original-listing parameters to eBay item URLs at rendering time. Main raw/graded comp links, individual sale rows, grade evidence, and expanded valuation evidence all use it. Marketplace HTTPS/host/credential guards remain intact; other marketplaces and eBay search URLs retain their behavior. Stored source evidence and values are untouched. Previously saved comps gain the fix without provider calls or database rewrites. Shell cache version advances to 113.

An expired or removed listing may still become unavailable on eBay. These parameters do not verify accepted Best Offer paid amounts, improve comp coverage, or change the pricing estimate algorithm.

## Verification

- Lint and syntax checks passed.
- Unit suite: 589 passed, 3 skipped, 0 failures.
- Regression checks cover original item IDs, titled international URLs, conflicting redirect flags, idempotence, unsafe hosts/credentials, and unchanged other marketplace URLs.
- Browser checks exercise the main graded comp, expanded evidence, cached reopening, external popup URL, and raw sale links across desktop Chromium, mobile Chromium and mobile WebKit. Pricing request count remains one after cached reopening and following the link.
- Initial popup fixture lacked a UTF-8 charset; corrected the fixture response encoding without changing application behavior.
- Final browser and publication outcomes are recorded below after release verification.
- The broader 120-case run exposed an existing fake-clock FX fixture failure at an unnecessary dynamic import (`Execution context was destroyed`). The test now reuses its already retained module handle for the same render operation and keeps every behavioral assertion. This is test-only; no FX application behavior changed.
