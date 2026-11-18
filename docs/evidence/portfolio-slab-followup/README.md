# Portfolio and slab follow-up

- Portfolio history keeps dated purchase lots when another lot in the same card entry has no known date. Earlier points show known coverage, completed sales use existing lot allocations, and today's endpoint shows the current inventory value. Legacy sales without usable allocations remain partial when membership cannot be reconstructed.
- Slab history uses straight daily-median segments with gaps after 30 days. Sales counts and the dates behind the displayed change remain visible. Card previews label shorter observation spans in days.
- Portfolio valuation dates and per-copy quote checks use separate labels. A retained quote checked in the last 24 hours is fresh.
- Refresh compares eligible daily observations with the published snapshot and rebuilds from the earliest changed date. Ordinary reopens reuse the saved snapshot. The v5 history upgrade uses matching retained evidence when available.
- Scan review focuses the disputed printing field and keeps filled details editable. A conflicting scan waits for confirmation before requesting an exact price, including when the user starts from Add card.

The automated checks include mixed purchase dates, allocated sales, unchanged and corrected history, quote freshness across UTC midnight, sparse chart rendering, raw preview recovery, copy-selector focus, and grade/certificate retention in the scan review.

## Slab benchmark

Run `npm run evaluate:vision -- /path/to/private-manifest.json --slabs --output /tmp/mica-slab-results.json`. For a live run, add `--live` and use the existing isolated test account's authorization and configured Mica URL. Label expected facts from the visible slab. Keep original photos, certificate values and per-photo results private. Record any exact price verification separately.

Use `expectedLabel` for individual expected fields, `expectedCatalogId` for the correct match or null for an expected no-match, and `priceCoverage` for separately verified eligible, older, unavailable or untested evidence. Live identification leaves price coverage untested. Include unseen cards and avoid putting other views of an already used slab in the held-out set.

A replay of four previously documented photo outcomes measured the intended distinctions. The grader and grade agreed in all four. The two recorded finish checks included the known Rayquaza mismatch. Three catalogued slabs had a matching candidate, and the Topps photo remained outside the catalog. The three matched cases had one eligible and two older comps when reviewed. [Earlier photo review](../slab-acceptance-followup/README.md).

The first live run of three previously unseen public PSA scans read all three names, grades, and cert numbers. It read one of three full collector numbers and found one of three catalog candidates. The other two outputs preserved the individual card numbers and abbreviated expansion codes. The recovery checks those facts against one scoped catalog record and presents the result for manual selection. Both previously rejected observations recovered the expected candidate in a replay against the live catalog. [Dragonair](https://www.psacard.com/cert/100954855/psa), [Team Rocket’s Mimikyu](https://www.psacard.com/cert/160356005/psa), [Snover](https://www.psacard.com/cert/144250291/psa).

The final production rerun returned the correct review candidate for all three photos, with zero false exact matches. Names, grades, cert numbers, grading company, language and ordinary grade qualifiers all matched. Two outputs returned the label's short number only. Mica displayed the full collector numbers from the catalog candidates. This run used uploaded photos. Physical iPhone camera capture remains unverified.

A separate production sold-listing check used the confirmed English holofoil printing and PSA 10 grade. Dragonair returned 22 sale records and passed current valuation checks. The licensed sold-listing lookup did not validate a provider identity for Mimikyu or Snover, so Mica had no eligible comp price to show for either case. These results measure coverage through Mica's current pricing feed.

## Release verification

- Source revision `2b4dd58` was pushed and published to the existing Mica project. Its production HTML, JavaScript, service worker and styles matched the reviewed release artifact. The health route responded and the portfolio, sold listings and graded valuation routes rejected unauthenticated requests. [Production check](production-verification.json).
- 628 unit tests and 535 browser checks passed. Three unit and eight browser checks were skipped by the suite. Browser coverage included desktop Chromium, mobile Chromium, and mobile WebKit. Lint, typecheck and schema validation passed. The prebuilt release contained nine functions and the routing test made zero outbound provider calls.
- The isolated hosted account loaded its saved $1,776 Rayquaza value. Both portfolio and card chart controls switched between one month and all time. The card showed six recorded sales in all time and one in the last month. The saved portfolio advanced to snapshot version 5 with the original quote-check timestamp intact.
