# Pricing and valuation foundation

## Product contract

Each card position presents exact identity, compatible current market evidence, provider comparison, source and freshness, available historical observations, acquisition markers, FIFO cost basis, current value, unrealized and realized gain/loss, return, and explicit unavailable states.

No price is shown without market context. Raw, graded, currencies, conditions, graders, grades, languages, printings, asking prices, and sold values are never silently combined.

## Deterministic valuation order

1. Match the exact canonical card and variant.
2. Match raw or graded state.
3. For raw cards, match the requested condition when the provider supplies condition detail.
4. For graded cards, match the exact grader and grade.
5. Require the same currency; no undeclared conversion is performed.
6. Prefer fresh PkmnPrices observations for compatible graded and raw contexts.
7. Use compatible TCGdex/TCGplayer raw data as fallback; show Cardmarket separately as EUR comparison.
8. Exclude flagged anomalous observations from automatic selection.
9. Return unavailable instead of substituting another asset.

The implementation does not average providers by default or use a closest-but-different grade, grader, edition, finish, language, currency, or condition. Provider disagreement remains visible as separate observations and can be flagged when it exceeds the configured threshold.

## History

Provider history is imported only when the connected plan supplies it. Otherwise, the daily scheduled job begins accumulating immutable observations from launch. The app never fabricates earlier data or expands sparse daily data into artificial ticks.

Charts support 1 month, 3 months, 6 months, 1 year, and all available history. Purchase transactions are scatter markers with date, unit price, quantity, marketplace, and total cost. Remaining cost basis appears as a reference series when applicable.

## Cost basis

Purchase total cost is:

```text
unit price × quantity + tax + shipping + marketplace fees + grading fees + other acquisition costs
```

Purchases remain distinct lots. Sales allocate the oldest remaining purchase lots first under FIFO. Each allocation records its lot, sale, quantity, and allocated cost. Remaining cost basis, realized gain/loss, and transaction history remain auditable.

Application math uses integer minor units. Postgres uses `numeric(14,2)`. Return is unavailable when cost basis is zero, and current value is unavailable when no compatible price exists.

## Anomalies

The schema and domain layer support price jumps, provider disagreement, mapping changes, and disappeared prices. Anomalous observations are retained for review rather than deleted.
