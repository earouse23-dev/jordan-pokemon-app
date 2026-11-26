# First-slab beta verification · November 26, 2026

Measured from delivery of each original photo to the running scanner in iPhone 17 Simulator Safari. These are individual observations with live provider reads. Starting the camera, choosing a photo and physical-device network latency are outside the timer. Separate fresh sessions can hit shared provider caches.

| Original photo | Previous release | Candidate |
| --- | --- | --- |
| Japanese first-edition Charizard PSA 10 | $6,500 at 3.0 s | $6,500 at 9.4 s, identity at 8.7 s |
| Dragon Frontiers Ninetales PSA 9 | $453.13 at 3.5 s | $453.13 at 3.1 s |
| Japanese Sky’s Rayquaza PSA 10 | Printing confirmation at 1.7 s | Non-Holo, Unlimited, $1,776 at 7.6 s |
| Sideways Topps Movie Edition foil PSA 10 | Catalog miss at 19.8 s | Catalog miss at 1.8 s, with scene, number and grade retained |
| Pokémon XD Eevee with no slab label | Catalog miss at 7.8 s | Catalog miss at 9.7 s, no grade assigned |

The Rayquaza rule matches the numbered Japanese deck printing and PSA label together. A conflicting variant still goes to review. The [catalog entry for that printing](https://vaultedmarket.com/cards/japanese-movie-commemoration-vs-pack-sky-splitting-deoxys-sky-s-rayquaza-003-unlisted-non-holo-unlimited-75155) records its finish and edition. The Charizard and Ninetales values above are amounts displayed by Mica, linked respectively to [the Charizard comp](https://www.ebay.it/itm/407034319577?nordt=true&rt=nc&orig_cvip=true) and [the Ninetales comp](https://www.ebay.com/itm/336589909441?nordt=true&rt=nc&orig_cvip=true).

## Regressions checked

- Opening an empty portfolio immediately after first confirmation offers scan, photo library and name search. No camera permission is requested before the user chooses the camera.
- Exact-context saved portfolio prices survive pending and failed refreshes and reload. Raw preview prices remain visible across the rolling 24-hour boundary. Switching owners clears preview data.
- A disposable local Supabase account completed signup via its local mailbox, reopened a saved collection entry and private photo, reset its password via a fresh mail link, then signed in with the replacement password. A second account on the same browser saw its own empty collection.
- An isolated restore reconciled quantity, cost, transactions, dated prices, portfolio totals and exact private-photo bytes. The second account had no access to the restored owner's data.
- The portfolio chart test now measures plot width after reserving space for exterior currency labels and checks tooltip legibility across six sizes.

A post-promotion Charizard run exposed an intermittent local OCR failure. The isolated set-line crop included a vertical slab edge before the fully readable words “STORMFRONT-1ST ED.” The parser now accepts a single separated border character before a known set. The same original yielded the exact first edition, grade 10 and certificate in 0.55 seconds in a fresh iPhone 17 Simulator OCR-only probe. That timing excludes catalog lookup and pricing. A separate WebKit run used the first-card photo picker, actual OCR, a fixture catalog response and a disposable local database. It saved the slab once, restored its private photo on reload, reopened the correct graded copy, and completed recovery and account switch.

The external beta gate used an unsupported default Ubuntu image for the repository's Playwright release. Its runner is now pinned to Ubuntu 24.04. Production provider limits remain active. Repeated demo scans eventually hit the existing scan limit, and the app offered manual search with the returned retry time.

Physical camera acquisition, delivery to an external inbox, production backup availability and offsite restoration remain separate acceptance checks. The two catalog misses have no verified price. Billing and App Store submission are outside this release.
