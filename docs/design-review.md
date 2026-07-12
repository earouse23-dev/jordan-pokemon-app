# Design review

Direction: “A collector’s research ledger—grounded in the physical card, with the precision and confidence of professional inventory software.”

| Area | Result | Evidence |
|---|---|---|
| Product fit / primary task | Pass | Collection is home; scan is reachable at thumb zone; candidate confirmation is mandatory. |
| Information architecture | Pass | Four stable mobile destinations; detail preserves back context; ownership/source sections are distinct. |
| Distinctiveness / anti-slop | Pass | Paper/pine/copper palette, square ledger rows, restrained borders, no gradients/glows/bento/crypto patterns. |
| Typography | Pass | DM Sans for dense reading, Manrope for identity/numbers, tabular financial values. |
| Trust | Pass | Partial totals, demo labels, source currencies, no fabricated sales, explicit appraisal disclaimer. |
| States | Pass for slice | Empty, partial, unavailable, processing, candidate, validation, success, offline shell. Infrastructure states specified in PRD. |
| Responsive behavior | Pass | Portrait-first ledger, flexible width to 760px, safe-area header/nav, 320px fallback. |
| Accessibility | Pass with manual AT pending | Semantic landmarks, focus visibility, labels, keyboard rows, reduced motion, live toast/results. |
| Motion | Pass | Short state/spatial transitions only; reduced-motion media query. |
| Craft | Pass | Physical card provides color, restrained chrome, aligned numeric cells, no card-inside-card overuse. |

No critical design failures remain in the local slice. Physical-device camera and screen-reader testing remains a production gate.

