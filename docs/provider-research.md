# Provider research

Research checked 2026-07-12 against provider documentation and published terms. A marketing use of “real time” is not treated as a freshness guarantee.

## Decision

Live entitlement check on 2026-07-12: the supplied PkmnPrices key successfully returned five Charizard catalog records, but the eBay sold-listing endpoint returned HTTP `403` with `Listings require Pro or higher`. Card search is therefore verified; linked sold evidence is not enabled on the current plan.

No single provider supplies a complete multilingual catalog, condition- and printing-specific raw and graded prices, minute-resolution history, and verified sold-listing links for every Pokémon card ever released.

The production foundation therefore separates four capabilities:

1. **Canonical catalog:** TCGdex, imported into our own database with stable internal IDs.
2. **Current market quotes:** public TCGdex TCGplayer/Cardmarket fields as the no-secret baseline; JustTCG condition × printing quotes when the supplied `tcg_…` key is configured and commercially authorized.
3. **Sold evidence:** a separately licensed provider such as PkmnPrices or Scrydex; never relabel asking prices as sales.
4. **History and analytics:** immutable snapshots and verified transactions stored in Supabase, with transparent derivations.

## Provider matrix

| Provider | Catalog | Current prices | History | Sold links | Freshness | Commercial position | Decision |
|---|---|---|---|---|---|---|---|
| [TCGdex](https://tcgdex.dev/) | 10+ languages, sets, cards, variants, images; public database aims for every officially released language | TCGplayer/Cardmarket aggregates | Cardmarket 1/7/30-day aggregates, not transaction history | No | TCGplayer hourly-to-daily; Cardmarket daily | Database repository is MIT-licensed; Pokémon artwork/trademarks remain third-party IP | Primary catalog and no-secret current-price baseline |
| [JustTCG](https://justtcg.com/docs/quickstart) | Large multi-game catalog with stable UUIDs and marketplace IDs | Condition × printing prices, stats and trends | Daily materialized history, up to one year on supported plans | No documented transaction records | Quote objects expose `lastUpdated`; history is daily | Free plan is non-commercial; terms restrict competing products and redistribution, so written authorization is a release gate | Enhanced exact-condition adapter after authorization |
| [PkmnPrices](https://www.pkmnprices.com/docs) | 54K+ English/Japanese Pokémon cards and sealed products | TCGplayer, Cardmarket and graded tiers | Daily averages/highs/lows and sale counts | Recent eBay sold records with URLs | Site explicitly says prices update daily | Pricing page states commercial use; provenance and redistribution rights still require written confirmation | Preferred sold-evidence pilot after contract review |
| [Scrydex](https://scrydex.com/docs) | English/Japanese Pokémon catalog, variants and population reports | Raw and graded tiers | Trend windows and history | Sold-listing records with source URL | Pricing docs say values change at most daily; webhooks notify changes | Terms prohibit use as a competing backend without written authorization | Alternative enterprise catalog/sales provider |
| [TCGCSV](https://tcgcsv.com/docs) | Cached TCGplayer categories, groups and products | TCGplayer market/low/mid/high by printing | Daily archives from 2024-02-08 | No | Exactly once daily, potentially ~24h old | Hobby project exporting upstream data; obtain upstream/rightsholder approval before production redistribution | Free validation/fallback ingest only, not a sales source |
| [Pokémon TCG API](https://docs.pokemontcg.io/api-reference/cards/card-object/) | Strong English catalog | TCGplayer USD and Cardmarket EUR aggregates | No | No | Provider date fields; no minute SLA | Terms/image rights need release review | English mapping and regression fixture source |
| [PriceCharting](https://www.pricecharting.com/api-documentation) | Pokémon products and grades | Current item values | API explicitly excludes historic prices and historic sales | No via API | Bulk CSV generated daily | Paid subscription required | Graded-price cross-check only |
| TCGplayer direct | English catalog and market aggregates | Yes | No public history | No | Varies | Official docs say new API access is not being granted | Do not make launch dependent on it |
| Cardmarket direct | European catalog and aggregates | Yes | No general sold feed | No | Varies | New API applications are not currently accepted | Do not make launch dependent on it |
| eBay Browse | Active listings | Asking prices | No general completed-sales history | Active URLs only | Live listings | Completed-sale access is restricted; follow API/affiliate terms | Outbound active listings only |

## What “up to the minute” means

The UI must never claim that a daily source is minute-resolution. It will show:

- **Source updated:** the provider’s timestamp.
- **Checked:** when our server retrieved the record.
- **Freshness:** fresh, aging, or stale using provider-specific thresholds.
- **Next refresh:** derived from the provider plan and rate budget.

Webhooks or frequent polling can reduce ingestion delay, but they cannot create new marketplace observations. Daily observations are charted as daily points. Intraday points are stored only when the source actually returns a changed quote.

## Coverage definition

“Every card” is a measurable target, not an unqualified promise. Coverage is tracked by:

- language and region;
- set, promo series and release;
- card face/number and artwork;
- printing/finish such as normal, holo, reverse, first edition, shadowless, stamped and promotional;
- raw condition;
- grading company and grade;
- price-source mapping and last successful observation.

Errors, unofficial cards, test prints, trophy cards, jumbo cards, vending releases and other exceptional products require explicit catalog classes and may have no liquid market price. Missing prices display **No verified market data**, never `$0`.

## Reliability rules

- Provider credentials are server-only environment variables.
- Each adapter has a timeout, schema validation, bounded retries with jitter, a circuit breaker and rate-budget accounting.
- Internal card and variant IDs never equal a provider ID.
- Mapping confidence and mapping method are stored and reviewable.
- Quotes are immutable observations; the current quote is a database view/query, not an overwritten history row.
- A provider outage returns partial results with explicit source status.
- Raw provider payloads are not retained unless the provider contract permits it.
