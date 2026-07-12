# Data rights and attribution

## Release gates

- Obtain written commercial authorization from every paid price/sales provider for a public tracker, caching, derived metrics and display to end users.
- Record contract version, allowed fields, attribution, retention, refresh limits and termination behavior per provider.
- Confirm rights for card imagery separately from database/code licensing.
- Use official APIs, licensed feeds or user-provided data. Do not scrape marketplaces or competitors.
- Register affiliate/deep-link programs before adding monetized outbound links.

## Required behavior

- Keep credentials in server-only environment variables and rotate any credential committed or exposed to a client.
- Store canonical facts separately from provider IDs, quotes, images, URLs and raw payloads.
- Every quote retains provider, provider product/variant ID, currency, region, condition, finish, grade, quote type, provider-updated time, retrieved time, URL, attribution and quality state.
- Every sold record retains the source listing ID, sold time, amount, currency, condition/grade interpretation, match confidence and original URL.
- An active listing is an asking price. It is never labeled sold, sale, realized value or last sold.
- Missing prices are unknown, not zero.
- Derived values identify their sources, formula, sample size and observation window.
- Delete or tombstone provider data when required by contract without deleting the user’s collection identity.

## Known legal findings

- JustTCG’s free tier is non-commercial and its terms restrict competing products and redistribution. A written enterprise exception is required before it becomes the public tracker’s production backend.
- Scrydex similarly restricts use as a substitute backend for a competing commercial product without written authorization.
- PkmnPrices advertises commercial use, but its brief terms do not expressly define redistribution, retention or derived-data rights; confirm those in writing.
- TCGdex’s database repository is MIT-licensed, but that does not grant ownership of Pokémon trademarks or card artwork.
- TCGCSV permits automated download within published limits, but it is an export of upstream TCGplayer data; permissive access is not proof of commercial redistribution rights.
- PriceCharting’s API requires a paid subscription and does not provide historical prices or sales through the API.

This file records engineering release gates, not legal advice.
