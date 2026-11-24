# Slab identification and price charts

Released `3a21abd8e650` to jordan-pokemon-app.vercel.app on November 23, 2026 (Chicago time). The public health check returned this release.

## Photo upload checks

Used the gallery input, the three original photos supplied for testing and an isolated demo account. Times run from file selection to the visible identity or match review. Each cell is one observation on a Mac running Playwright with a phone-sized viewport. Physical iPhone timing is still open.

| Photo | Previous public Chromium | Updated public Chromium | Updated staged WebKit |
| --- | ---: | ---: | ---: |
| Sky’s Rayquaza, Japanese #003, PSA 10 | 18.60 s | 2.23 s | 3.05 s |
| Ninetales δ, Dragon Frontiers #8, PSA 9 | 15.85 s | 1.57 s | 2.76 s |
| Charizard, Japanese #092, 1st Edition, PSA 10 | — | 1.50 s | 2.43 s |

Rayquaza and Ninetales formerly fell through to cloud vision. The red-border detector missed the former and the foil texture interfered with reading the latter. All three updated scans resolved their identity through local label reading and catalog lookup, with zero milliseconds in cloud inference. Rayquaza still requires finish and edition confirmation for exact pricing. Charizard’s exact re-upload took 78 ms in the same public Chromium session with zero new identification requests. This test measures identity and does not benchmark sold-price retrieval.

A separate public WebKit check showed the Ninetales price after lookup. Two further identification attempts returned HTTP 429 after repeated demo scans, confirmed in deployment logs. The existing account limits remain in effect.

## Chart checks

Checked portfolio, collection and catalog previews with saved matches, older histories and mismatched printings. A preview uses real dated observations for the same printing and grade. When recent sales are sparse it can show a longer available history labeled All. Fewer than two matching dates leave the trend empty. Covered positive, negative and flat trends, dense histories, endpoint retention and preview rendering without additional provider requests.

Examined narrow and wide layouts and both themes. Full charts use quieter grid lines and reserve space for currency labels. Chart guidance came from [Apple’s chart design session](https://developer.apple.com/videos/play/wwdc2022/110342/) and [Charts in the Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/charts).

Unit suite passed 635 with three skips. The selected browser suites passed 214 with two skips across desktop Chromium, mobile Chromium and mobile WebKit. Lint, type checking, release build and route checks passed.
