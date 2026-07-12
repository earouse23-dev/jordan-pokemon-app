# Pricing foundation

## Product contract

Each card page presents identity first, then variant-specific market evidence:

- current market estimate with condition, printing, grade, currency, source and timestamps;
- low/high range and sample size where supplied;
- price chart with source and granularity controls;
- recent verified sold transactions with original links when licensed;
- active offers in a separate section clearly labeled as asking prices;
- average, median and trend metrics with the formula and observation window exposed;
- data-quality and coverage status.

No price is shown without its market context. Raw, graded, currencies, conditions, printings and asking/sold values are never silently combined.

## Valuation hierarchy

For a requested variant, the displayed estimate uses the first available method:

1. Robust sold-comparable estimate from sufficiently matched, recent transactions.
2. Licensed provider market estimate for the exact condition/printing/grade.
3. Cross-provider aggregate for equivalent quote types, after currency normalization.
4. Closest comparable clearly labeled as an estimate.
5. No verified market data.

The sold-comparable method uses a recency-weighted median after rejecting duplicates, lots, obvious card mismatches and statistical outliers. It never averages different grades or converts an asking price into a sold observation.

## Data flow

```text
TCGdex catalog ──> catalog staging ──> canonical cards/variants ──┐
                                                                │
TCGdex + JustTCG ─> provider adapters ─> immutable price quotes ─┼─> card API
                                                                │
licensed sales ──> validation/mapping ─> sold transactions ─────┤
                                                                │
scheduled rollups ────────────────────> daily metrics/charts ───┘
```

## Synchronization

- Catalog: incremental daily import plus manual backfill; reconcile removals rather than deleting.
- Current quotes: provider-plan-aware polling using `updated_after` where available; prioritize watched/owned/trending cards.
- Sold listings: cursor-based incremental ingest; deduplicate by provider listing ID.
- History: store changed observations; create daily rollups; never synthesize minute ticks.
- Failed jobs: retry with exponential backoff, record cursor and failure, resume idempotently.

## API boundaries

- `GET /api/catalog/search?q=&language=&set=&cursor=`
- `GET /api/cards/:id`
- `GET /api/cards/:id/prices?variant=&condition=&grade=`
- `GET /api/cards/:id/history?variant=&range=&granularity=`
- `GET /api/cards/:id/sales?variant=&cursor=`
- `GET /api/providers/status`

Responses use internal IDs and normalized schemas. Provider-specific fields stay inside adapters.

## Rollout gates

1. Catalog and variant identity with coverage reporting.
2. No-secret TCGdex current quotes, enhanced by JustTCG behind server-only configuration.
3. Durable history and source freshness UI.
4. Licensed sold evidence and transparent valuation.
5. Graded/population data.
6. Scan-to-candidate matching and collection portfolio analytics.

Production launch with third-party pricing requires written confirmation that the plan permits a public commercial price tracker, caching, derived analytics, and the intended display of provider data and links.
