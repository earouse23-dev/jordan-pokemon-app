# Competitive analysis

Research checked 2026-07-20. Competitor behavior is used as product inspiration, not copied design or data.

| Product | Strong pattern | Foundation lesson |
|---|---|---|
| Card Ladder | Searchable sales evidence, original sale links, human-vetted records, transparent excluded sales, population reports, compare tools and alerts | Evidence and methodology should be inspectable, not hidden behind a single number |
| Collectr | Fast scan/add flow, portfolio value over time, sealed/raw/graded coverage, filters and export | Collection workflows must be fast while valuation remains variant-specific |
| PriceCharting | Grade-specific values, visible sold comparables and documented outlier/recency methodology | Show condition tiers and disclose how bad or mismatched sales are filtered |
| TCGplayer | Strong condition/printing taxonomy and marketplace-specific market price | Never collapse finish or condition into one ambiguous price |
| Cardmarket | European currency/condition context | Preserve source currency and region; conversion is a separate derived view |

## July 20 competitive rotation

Current consumer-scale evidence makes Collectr the most useful mainstream benchmark: its Google Play listing shows 1M+ downloads, a 4.8 rating, and more than 37,000 reviews, while Collectr says the product serves more than two million users. Its strongest patterns are fast camera-led intake, a clean stock-portfolio metaphor, raw/graded/sealed coverage, and a five-year Pro history/export path.

The review pattern also exposes an opening. Users praise Collectr's interface and scanner, but repeatedly report incorrect printing matches, limited condition handling, and a headline market value that does not represent likely seller take-home after discounts and fees. TCGplayer's official scanner documentation acknowledges that visually similar printings can be misidentified and require manual confirmation. PriceCharting differentiates with historic collection value, realized sales/profit, folders, and grading recommendations.

Sources checked:

- [Collectr Google Play listing](https://play.google.com/store/apps/details?id=com.collectrinc.collectr)
- [Collectr product site](https://www.getcollectr.com/)
- [Collectr Pro](https://www.getcollectr.com/pro)
- [TCGplayer app FAQ](https://help.tcgplayer.com/hc/en-us/articles/115009506407-TCGplayer-App-FAQ)
- [PriceCharting collection tracker](https://www.pricecharting.com/page/collection-tracker)
- [PriceCharting sales tracking](https://blog.pricecharting.com/2026/03/track-sales-from-your-collection.html)

## Three-persona critique

| User | Main risk in a typical tracker | Mica response in v61 |
|---|---|---|
| New collector | Too many professional controls and confusion between market value and cash value | Guided workspace keeps the essentials visible and explains the boundary; seller tools remain one tap away |
| Side-hustle seller | Headline value ignores selling discount, venue fee, shipping, and basis | Portfolio take-home planner shows reference, expected gross, fees/costs, net, profit, ROI, break-even, and coverage |
| Full-time dealer | Slow repeated intake and low information density | Pro desk uses denser inventory rows; raw, graded, and sealed saves include a rapid “Save + add another” path |

## Mica versus Collectr

| Capability | Collectr advantage | Mica advantage / response |
|---|---|---|
| Camera recognition | Mature scanner and high-volume consumer usage | Photo assist stays private and Mica refuses to claim recognition until a licensed, measurable service exists |
| Repeated intake | Fast scan/add loop | v61 returns directly to the correct card or sealed search after each saved item |
| Portfolio presentation | Highly polished stock-style overview | Exact-context evidence, honest missing-price coverage, entry points, and durable owner-scoped history |
| Seller economics | Users report the displayed value can overstate realizable cash | v61 take-home scenario converts reference value into editable gross, fee, cost, net, profit, ROI, and break-even views |
| User range | One broadly consumer-oriented interface | Guided, Growing seller, and Pro desk depths use the same underlying ledger without changing calculations |
| Business records | Collection tracking and export | FIFO lots, realized profit, transaction reporting, sale planning, inventory aging, and CSV/JSON portability |

Mica should not try to beat Collectr by copying its visual design or pretending a photo preview is a scanner. The defensible product position is a lower-friction, evidence-first operating ledger: fast enough for intake, understandable to a beginner, and materially more useful when money, grading, inventory age, and selling costs matter.

## Product principles

1. **Evidence first:** the estimate links to observations that explain it.
2. **Exact variant first:** card identity includes language, printing, condition and grade.
3. **Honest freshness:** source-updated and checked times are visible.
4. **Portfolio clarity:** cost basis, market value, realized profit and unrealized change remain separate.
5. **Useful uncertainty:** sample size, range, confidence and missing-data states are first-class.
6. **Fast discovery:** search by name, set, number, language, variant and external ID.
7. **No false precision:** daily sources produce daily charts, not cosmetic minute candles.

## Differentiation opportunity

The app can outperform opaque trackers by combining multilingual catalog coverage with explicit mappings, source-level freshness, reproducible valuation rules, and an audit trail for every number. The quality dashboard should publish coverage by language, variant and source so “complete” is measurable.
