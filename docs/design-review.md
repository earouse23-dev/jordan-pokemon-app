# Design review

Direction: “A collector’s research ledger—grounded in the physical card, with the precision and confidence of professional inventory software.”

| Area | Result | Evidence |
|---|---|---|
| Product fit / primary task | Pass | Library is home; Add Card is in the thumb zone and header; scan and catalog search share one screen; results open a value-first card page before saving. |
| Information architecture | Pass | Four plain-language mobile destinations; card detail leads with identity, current market, trend, and recent sales; Add to Library is persistent and ownership extras are optional. |
| Distinctiveness / anti-slop | Pass | Paper/pine/copper palette, square ledger rows, restrained borders, no gradients/glows/bento/crypto patterns. |
| Typography | Pass | DM Sans for dense reading, Manrope for identity/numbers, tabular financial values. |
| Trust | Pass | Partial totals, demo labels, source currencies, no fabricated sales, explicit appraisal disclaimer. |
| States | Pass for slice | Empty, partial, unavailable, searching, processing, result, quick-add, validation, success, offline shell. Infrastructure states specified in PRD. |
| Responsive behavior | Pass | Portrait-first ledger, flexible width to 760px, safe-area header/nav, 320px fallback. |
| Accessibility | Pass with manual AT pending | Semantic landmarks, focus visibility, labels, keyboard rows, reduced motion, live toast/results. |
| Motion | Pass | Short state/spatial transitions only; reduced-motion media query. |
| Craft | Pass | Physical card provides color, restrained chrome, aligned numeric cells, no card-inside-card overuse. |

The discovery flow no longer exposes inventory jargon or a nine-field form before the user can inspect a card. Spreadsheet transfer remains available under Profile but is labeled as moving a collection or downloading a backup. Physical-device camera and screen-reader testing remains a production gate.

