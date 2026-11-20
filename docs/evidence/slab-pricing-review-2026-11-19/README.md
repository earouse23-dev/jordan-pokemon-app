# Slab workflow release and code review

Production source `185febe`, deployment `dpl_5LZw5D4cgEkSota8RrTbYtXiFf6M`. Verified November 19, 2026, US Central time, against [Mica](https://jordan-pokemon-app.vercel.app/).

## Production photo upload

A mobile Chromium browser used the app's photo upload and a disposable demo login. Each photo opened the correct English PSA 10 catalog entry. The tester confirmed the regular holo printing and absence of a promo marking, opened Comps, and checked that its first price matched the displayed valuation. The amounts are provider-reported eBay comps.

| Slab | Photo to candidate | Confirmation to price | Price and comp date | Eligible records displayed |
| --- | ---: | ---: | --- | ---: |
| Dragonair, 151, 181/165 | 1.84 s | 0.87 s | [$190.00, Nov 6](https://www.ebay.com/itm/960158638638?nordt=true&orig_cvip=true&rt=nc) | 22 |
| Team Rocket’s Mimikyu, Ascended Heroes, 238/217 | 0.83 s | 1.79 s | [$147.99, Nov 19](https://www.ebay.com/itm/257794493399?nordt=true&orig_cvip=true&rt=nc) | 57 |
| Snover, Mega Evolution, 140/132 | 1.33 s | 1.17 s | [$33.00, Nov 6](https://www.ebay.com/itm/307269137423?nordt=true&orig_cvip=true&rt=nc) | 20 |

There were zero cloud vision requests across the three scans. Quote timings are from a warmed shared provider cache. In the first protected-release check, Mimikyu and Snover each returned nine matching sales with older pages pending. The baseline returned zero for both. Subsequent production visits loaded the larger archive.

## Code review

- **Provider identity.** Mica rejected the provider’s ME and ME01 set prefixes. The sale paths also dropped the saved TCGplayer ID. Detail, grade lookup and portfolio pricing now retain it. Regression cases reject the wrong set, denominator and language.
- **Recognition.** Supported modern English PSA headers are read locally. A coherent header, grade and certificate plus an exact catalog identity produce a candidate for the collector to confirm. Other layouts use the existing recognizer. Official certificate authentication remains a separate integration. See the [previous vintage and Topps results](../slab-intake-2026-11-14/README.md).
- **Sale evidence.** A disclosure beside the price lists eligible comps, with dates, amounts and marketplace links. The screen distinguishes incomplete printing details from a missing provider record. The review also caught a short-screen layout issue in which the extra control pushed the chart down. The corrected layout passed mobile Chromium and WebKit checks.
- **Freshness and archive.** Opening an owned copy hydrates saved evidence before starting chargeable reads. The quote can return after current sales and correction checks while a bounded continuation resumes older pages. Cached archive reads preserve the retrieval time. Tests cover cache reuse, corrections, account changes and delayed responses.
- **Portfolio.** A partial update retains the saved valuation and explains outstanding matches, exhausted budget or connection failure. Selected-period details distinguish recorded purchases and sales from price changes on holdings owned throughout. The server saves a native-currency breakdown alongside the summary. A synthetic 10,001-position test reproduced all 10,001 purchases and the correct top-three dollar changes. Earlier saved summaries gain the breakdown on their next successful rebuild.
- **Spreadsheet intake.** Add cards opens the existing import preview. On production mobile, the review opened with commit disabled before the dry check. The portfolio export action explicitly says export. Fixture tests covered mapping, retry and commit.

## Verification and limits

- Frozen-source lint and syntax passed. Node suite had 631 passes and 3 skips. Schema checks covered 83 RLS-enabled public tables. The migration baseline and eight-case identity and pricing-outlier benchmarks passed.
- Capture, physical copies, comp evidence, import, OCR and portfolio browser checks had 312 passes and 8 skips. The final portfolio, collector home, evidence and import suite had 254 passes. The suites overlap.
- Production HTML, JavaScript, theme CSS and service worker matched the frozen release hashes. Production health returned HTTP 200. Anonymous portfolio and sale lookups returned HTTP 401. The release artifact passed its routing and authentication checks.
- Reviewed all 18 changed files and the affected callers. No remaining blocker was found in these six workflows. Three desktop-hosted mobile uploads establish sample recognition accuracy. Physical iPhone camera acceptance remains with Elliott. The verification used a demo login and did not write collection records.
