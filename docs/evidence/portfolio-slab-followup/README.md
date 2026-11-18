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
