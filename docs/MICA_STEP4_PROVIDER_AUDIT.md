# Mica Step 4 provider and pricing audit

Status: decision-ready read-only audit

Checked: 2026-08-31

## Audit boundary

This audit inspected Mica's pricing code, migrations, tests, documentation, and
the providers' current official public documentation. It did not create an
account, add or rotate a credential, make a paid API request, purchase a plan,
apply a production migration, or deploy code.

The recommendation is a zero-new-cost software architecture. It deliberately
does not decide Mica's pricing, business model, or marketing claims.

## Decision summary

The safest no-new-cost starting point is:

1. Keep PkmnPrices Free as the primary source only for capabilities the current
   key actually returns.
2. Keep TCGdex as the no-key catalog and compatible raw aggregate fallback, but
   do not describe its upstream market data as licensed for commercial
   redistribution until that scope is confirmed.
3. Do not use JustTCG Free in a shipped commercial product. Its current terms
   explicitly limit the free tier to personal, non-commercial use.
4. Start automatic portfolio valuation with English raw cards in the US market
   and USD. Show Cardmarket EUR observations separately when available; do not
   convert or combine currencies.
5. Treat graded prices, completed sales, marketplace asks, sealed prices,
   Japanese prices, and history as runtime capabilities. If an endpoint returns
   `403`, plan-required, or no compatible evidence, show **unsupported** or
   **unavailable** instead of substituting another asset or source.
6. Accumulate licensed, exact, immutable observations over time. Never invent
   history and never mix asking prices with completed sales.

This path costs $0, adds no provider dependency, and lets Step 4 improve the
software contract before any future provider purchase. It cannot provide the
full long-term roadmap coverage by itself.

## Current provider facts

### PkmnPrices

Official sources:

- [Developer plans](https://www.pkmnprices.com/developers)
- [API documentation](https://www.pkmnprices.com/docs)
- [Terms of Service](https://www.pkmnprices.com/terms)

The developer page currently lists:

- Free: $0/month, 100 credits/day, 60 requests/minute, one key, English cards,
  and commercial use.
- Pro: $14.99/month, 20,000 credits/day, five keys, English/Japanese/German.
- Business: $89.99/month, 200,000 credits/day and 200 requests/minute.

The same developer page lists sealed, EU, marketplace-listing, and eBay-sold
features under Free. The detailed API documentation conflicts with it: it says
Japanese/German and EUR require Pro+, and says sealed endpoints and some sealed
listing endpoints require Pro or Business. Mica's existing live entitlement
check also received plan-required responses for paid capabilities. Therefore:

- endpoint success or a real `403` is authoritative;
- `PKMNPRICES_PLAN` must never grant a capability by itself;
- the client must receive explicit capability states from the server;
- no Step 4 design may budget more than 100 returned items/day on Free;
- a production coverage promise cannot rely on the marketing matrix alone.

The terms permit API use within the subscribed limits and prohibit API-key
redistribution, limit circumvention, non-API scraping, and reverse engineering.
The developer page says Free includes commercial use, but the terms do not give
detailed caching, derived-metric, or post-termination retention rights. Mica
should store only the minimum normalized evidence needed and obtain written
clarification before treating long-term provider data retention as a release
right.

### JustTCG

Official sources:

- [Plans](https://justtcg.com/pricing)
- [Terms of Service](https://justtcg.com/terms)
- [Rate limits](https://www.justtcg.com/docs/rate-limits)
- [Quickstart](https://justtcg.com/docs/quickstart)

Current limits are:

| Plan | Price | Monthly | Daily | Per minute | Batch |
|---|---:|---:|---:|---:|---:|
| Free | $0 | 1,000 | 100 | 10 | 20 cards |
| Starter | $19 + tax | 10,000 | 1,000 | 50 | 100 cards |
| Professional | $49 + tax | 50,000 | 5,000 | 100 | 100 cards |
| Enterprise | $149 + tax | 500,000 | 50,000 | 500 | 200 cards |

The terms explicitly say Free is personal and non-commercial. Paid tiers allow
end-user display, derived analytics, server-side caching, and stored historical
points only while the subscription remains active. They prohibit raw-feed
redistribution and a competing pricing API. Consequently, JustTCG Free is not a
valid zero-cost production provider for Mica. The existing adapter can remain
unconfigured for later evaluation without influencing the current architecture.

### TCGdex

Official sources:

- [TCGdex organization and API overview](https://github.com/tcgdex)
- [Cards database license](https://github.com/tcgdex/cards-database/blob/master/LICENSE)
- [Pricing RFC](https://github.com/orgs/tcgdex/discussions/830)

The card database repository is MIT-licensed and the API requires no key in the
current integration. The pricing RFC describes provider timestamps and daily
Cardmarket synchronization; it originally listed TCGplayer as unavailable and
discussed alternative ingestion. Current API responses expose aggregate
TCGplayer/Cardmarket fields, but the public material inspected here does not
state a request quota or grant a separate license to redistribute upstream
marketplace data. The MIT license also does not grant rights to Pokémon artwork,
trademarks, or independent upstream data.

Use TCGdex as:

- the multilingual catalog and identity source;
- a no-key raw aggregate fallback with clear attribution and timestamps;
- a non-authoritative source for condition when its quote has no condition;
- never a source for graded values or completed-sale evidence.

Before a commercial release depends on TCGdex pricing, confirm the allowed API
traffic, caching, upstream price display, retention, and attribution in writing.

## Existing Mica architecture

### What is already strong

- `lib/pricing.js` normalizes source, market currency, finish, condition,
  grader, grade, price type, provider timestamp, retrieval timestamp, URL, and
  attribution.
- `lib/domain.js` rejects incompatible currency, raw/graded state, finish,
  edition, condition, grader, and grade.
- `price_observations` and `position_price_observations` preserve immutable
  normalized observations; Step 3 added the canonical `collectible_id` join.
- Asking prices, completed sales, market indices, cost basis, and portfolio
  values are modeled separately.
- Current card fetching is partial-result tolerant and falls back from
  PkmnPrices to optional JustTCG to TCGdex without mutating ownership.
- Missing purchase cost is not treated as zero. Missing compatible prices are
  excluded from totals and reported as missing.
- Provider calls are server-side, bounded, timed out, and do not expose keys.

### Gaps that Step 4 must close

1. **Freshness has conflicting definitions.** The domain selector and
   environment use a 72-hour default, while `priceEvidence` treats seven days
   as current and only calls a source stale after 30 days. The browser's
   `isStale` path adds another decision point.
2. **Capability state is partly inferred from a configured plan label.** A plan
   label can request history/EUR/Japanese even when the real key lacks access.
3. **Portfolio totals report quantity coverage but not value confidence.** The
   headline total does not show strong/moderate/limited value shares or the
   amount excluded because evidence is stale, missing, or unsupported.
4. **Missing states collapse in some client paths.** Unsupported, no provider
   match, plan-required, rate-limited, and provider failure can all end as
   `unavailable` or a blank price.
5. **Outlier infrastructure is incomplete.** The schema can record price jumps
   and provider disagreement, but automatic ingestion does not consistently
   run deterministic outlier rules or produce a human-review benchmark.
6. **Scheduled pricing is PkmnPrices-only.** It processes at most 50 positions
   per invocation with a 45-second work budget. Free's 100 daily credits cannot
   refresh a large portfolio daily, and the scheduler does not persist fallback
   TCGdex observations.
7. **Current rate protection is not durable.** `/api/cards`, offers, and sealed
   use process-local maps that reset or fragment across serverless instances;
   `/api/sales` has no equivalent application limiter.
8. **Two observation schemas overlap.** Shared catalog observations and private
   position observations differ in fields and allowed valuation types. Step 4
   should share one normalized evidence contract even if storage remains split
   for ownership and RLS.
9. **Raw provider payload policy is too broad.** `price_observations` permits a
   full JSON payload. Provider rights should default this to a small normalized
   metadata allowlist.
10. **Attribution can name the marketplace but hide the aggregator.** User rows
    must show both, for example “TCGplayer market via PkmnPrices,” rather than
    only `tcgplayer`.

## Proposed provider-neutral contract

Every value candidate should carry:

- canonical `collectible_id`;
- provider/aggregator and underlying source market;
- provider record and variant identifiers;
- market region and currency;
- card state, language, finish/printing, raw condition, grader, and grade;
- valuation type: market index, latest completed sale, comparable estimate,
  asking price, provider estimate, or user override;
- amount or range, plus fees/shipping inclusion when known;
- source-observed, provider-updated, retrieved, and expiry timestamps;
- sample/comparable count and derivation method;
- source URL and attribution;
- compatibility, freshness, confidence, anomaly, exclusion, and capability
  reasons.

The visible status must be one of:

- `live`: compatible evidence within its source-specific freshness window;
- `stale`: compatible evidence exists but is too old for automatic valuation;
- `missing`: the capability is supported but no compatible observation exists;
- `unsupported`: the provider/plan does not cover this context;
- `rate_limited`: retry may succeed after the provider reset;
- `provider_error`: an otherwise supported provider failed;
- `manual_override`: owner-entered value, never described as market evidence.

Zero is a valid amount only for an explicit owner-entered or provider-reported
record whose contract permits it. It is never a placeholder for another state.

## Freshness policy to implement

Freshness must be centralized and source-specific:

| Evidence | Live | Aging | Stale for automatic value |
|---|---:|---:|---:|
| Provider documented daily market index | <= 48h | >48h to 96h | >96h |
| Completed sale/comparable | <= 30d | >30d to 90d | >90d |
| Active asking price | <= 24h | >24h to 72h | >72h |
| Undated provider value | never | never | immediately |

These are technical defaults for review, not claims about market liquidity.
Provider-specific documented timestamps can narrow them. A fresh retrieval time
must never make an old source observation fresh.

## Confidence and comparable rules to implement

Confidence must be deterministic and explainable. It is not an AI prediction.

Hard exclusions:

- wrong canonical identity or unresolved/ambiguous mapping;
- different language, finish, edition, raw/graded state, condition when known,
  grader, grade, market, or currency;
- asking price presented as a completed sale;
- missing/invalid source timestamp where the valuation type requires one;
- non-positive automatic-market values;
- provider-marked or reviewer-excluded anomaly.

Outlier review:

- keep every valid observation immutable;
- flag, do not delete, values outside a median/MAD band when at least five
  compatible observations exist;
- use a percentage-jump rule only as a review signal, never as the sole delete
  rule;
- do not auto-exclude a unique low-liquidity sale merely because it differs;
- record the rule version, comparison cohort, measured deviation, and reviewer
  decision.

Portfolio reporting:

- quantity coverage: priced units / total units;
- value coverage: included compatible value and excluded known categories;
- confidence distribution: strong, moderate, limited, stale, missing, and
  unsupported units/value;
- oldest included observation and next eligible refresh;
- no aggregate across currencies without a named FX source and separate
  approval.

## No-cost implementation boundary

The provider-neutral schema, centralized freshness, explicit capability states,
confidence calculations, outlier benchmark, portfolio coverage UI, regression
tests, and local migration rehearsal can be implemented for $0.

The no-cost path does **not** authorize:

- a provider signup or credential change;
- production migration or deployment;
- a paid PkmnPrices or JustTCG plan;
- paid or quota-consuming benchmark calls;
- long-term retention that provider terms do not clearly allow;
- an automatic valuation for an unsupported card context.

## Approval gate

Before dependent Step 4 implementation, Elliott must approve:

1. Zero-new-cost provider path: existing PkmnPrices Free when entitled, TCGdex
   raw fallback, and JustTCG disabled.
2. Initial automatic valuation scope: English raw cards, US/TCGplayer market,
   USD; EUR/Cardmarket is a separate comparison only.
3. Explicit unsupported states for graded, sold, sealed, Japanese, and history
   whenever the current free entitlement does not return them.

No payment method is needed for this choice.
