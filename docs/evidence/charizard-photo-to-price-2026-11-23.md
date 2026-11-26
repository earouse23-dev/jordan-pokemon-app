# Charizard photo to visible price

Release `49e3bbac4bbb` was promoted to jordan-pokemon-app.vercel.app. The health endpoint on the public domain confirmed the revision.

## Production timing

Used Safari 26.4 in Xcode’s iPhone 17 simulator, a dedicated demo account, and the original Japanese Stormfront Charizard PSA 10 JPEG. Each release had a fresh Safari automation session with the app already open. The scanner opened one second before file selection. The selected file went through the scanner’s library input. A frame-by-frame observer recorded the first visible Charizard title and the first visible dollar price. Times exclude launching the app and choosing a photo. Provider and operating-system caches were not forcibly cleared.

| Public release and scan | Card visible | $6,500 visible | Identification and sales calls |
| --- | ---: | ---: | --- |
| Previous release, first selection | 2.807 s | 3.379 s | 1 each |
| Updated release, first selection | 1.737 s | 2.431 s | 1 each |
| Previous release, same photo again | 0.205 s | 0.205 s | 0 |
| Updated release, same photo again | 0.172 s | 0.172 s | 0 |

Both first scans used on-device label reading, a catalog match and a live sales API call. Each cell represents a single observation, so the difference includes network variability. Xcode detected no physical iPhone during the test. These observations cannot explain the full 8–10 seconds reported on the owner's phone.

## Reproduction and changes

In a separate mobile WebKit test with the same photo, a local server delayed the scanner worker download by 2.5 seconds. The previous release missed its local label-reading deadline and requested cloud identification. The update read the correct certificate locally. Catalog and sales responses in this controlled test were fixtures. Production measurements above used live services.

The update starts the reader on camera or photo-picker intent, reuses bundled reader files within each service-worker release and skips redundant preview encoding. The identification screen shows the selected photo and the actual processing stage. A longer lookup offers name search and ignores late results after navigation. The server's scan cooldown displays its retry interval and a usable alternative. In the live demo check the first attempt received HTTP 429. The successful measurements were taken after that interval.

Lint, type checks, release routing and 635 unit tests passed (three skipped). The camera, local OCR and price browser suites passed 172 cases (two skipped) across desktop Chromium, mobile Chromium and mobile WebKit. A separate WebKit cache check fetched the scanner worker twice and recorded one origin download.

## November 26 follow-up with all five supplied photos

Used the existing production release in iPhone 17 simulator Safari. Each original JPEG was selected through the scanner’s photo-library input in a fresh Safari automation session. The timer started at file selection and ended when a dollar amount, a printing-confirmation request or the final no-match message became visible. The prices are amounts displayed by Mica.

| Supplied photo | Exact card visible | First price or terminal screen |
| --- | ---: | --- |
| Japanese Stormfront Charizard #092, PSA 10 | 5.212 s | $6,500.00 at 5.945 s |
| Sky’s Rayquaza #003, PSA 10 | 3.535 s | Finish and edition confirmation at 3.535 s |
| Dragon Frontiers Ninetales δ #8, PSA 9 | 1.773 s | $453.13 at 10.363 s |
| Topps Movie Edition Trying Out/New Toy foil #7, PSA 10 | No exact match | No catalog match at 12.582 s. Recognition returned the series and PSA 10. |
| Japanese Pokémon XD Eevee collectible, no slab label | No exact match | No catalog match at 9.000 s. Recognition returned Eevee and Pokémon XD without a grade. |

Two more fresh sessions priced Charizard at 1.827 s and 1.835 s. Exact re-uploads within those sessions took 0.191 s and 0.162 s with zero new identification or sales calls. One automation attempt lost its timing hook before file selection and was discarded. On the slow Ninetales run the live sales endpoint returned at 10.330 s. On the slow Charizard run the identity endpoint returned at 5.034 s. These timings establish where the waits occurred on these runs. A physical phone was unavailable.
