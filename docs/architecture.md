# Architecture

## Client

The mobile PWA uses bundled ES modules, semantic HTML, custom CSS, Chart.js, Supabase Auth/Data API persistence, and a service-worker shell/image cache. `lib/domain.js`, `lib/portfolio.js`, and `lib/core.js` contain testable identity, valuation, FIFO, integer-money, search, and CSV rules. `app.js` handles presentation and authenticated orchestration.

Collection records never fall back to local demo storage. The browser receives only the Supabase URL and publishable key. Secret/service and provider credentials remain server-side. Selected-card sharing is generated locally from owner-visible rows and creates no public profile or server-side share record.

## Data flow

```text
Mobile PWA → Supabase Auth → ownership RLS → collection items / transactions / FIFO lots
          ↘ Vercel Functions → provider adapters → PkmnPrices / TCGdex
          ↘ authenticated AI intake → Vercel AI Gateway → OpenAI structured vision output → user confirmation
Vercel Cron → secured price sync → immutable normalized observations → charts / valuation
Authenticated client → one private daily valuation → ledger cash-flow adjustment → portfolio performance
```

PostgreSQL is the system of record. Transactional, `security invoker` RPCs create a position plus its first purchase lot, allocate sales against the oldest locked lots, split selected copies and their active grading submission without cash flow, track a raw position through its private grading-submission stages, and convert a returned raw position to its exact graded state while capitalizing the all-in grading cost across remaining lots to the cent. Every mutation derives the owner from `auth.uid()`.

## Provider boundaries

- PkmnPrices: primary current raw/graded pricing, available history, and licensed sold evidence.
- TCGdex: multilingual catalog, sets, identity, variants, images, and compatible raw TCGplayer/Cardmarket comparison.
- JustTCG: optional configured raw fallback.
- Alt and Card Ladder: disabled until licensed API access is supplied; never scraped.

UI and financial code consume normalized internal observations only. Raw/graded state, variant, finish, edition, condition, grader, grade, language, market, currency, source, and freshness remain explicit.

## Synchronization

`api/price-sync.js` is called daily by Vercel Cron. It verifies the bearer secret, reads a cursor-rotated batch of actively owned card positions with a server-only Supabase client, requests PkmnPrices using exact provider IDs when available, stores immutable deduplicated exact-context observations, and updates provider diagnostics plus the next durable cursor. Owner-scoped `position_price_observations` preserve history for live-search cards before an internal catalog UUID exists; authenticated clients can only read their own rows through an invoker function. Partial failures preserve previous valid data and advance into the next batch so one bad mapping cannot starve the rest of a large portfolio.

The existing `supabase/functions/sync-catalog` remains the resumable multilingual catalog importer. Catalog and pricing synchronization are separate jobs with separate status records.

## Security

- Email/password primary authentication and secondary magic links.
- Explicit Data API grants for authenticated tables.
- RLS on every public table.
- Ownership predicates on collection items, transactions, purchase lots, and FIFO allocations.
- Admin diagnostics use `app_metadata.role`, never user-editable metadata.
- Provider and service secrets never enter the browser bundle.
- Future transaction dates are rejected in UI validation, RPCs, and table constraints.
- Grading returns require a complete acquisition basis, preserve the prior raw condition in the ledger, and clear incompatible raw position-price observations atomically.
- Active grading submissions lock inventory-changing transactions and state changes. The estimated cost never enters basis; recording the return closes the submission before the actual cost is capitalized.
- Position splitting requires complete acquisition cost and date history, transfers selected oldest/newest remaining FIFO lots exactly, and divides an active grading submission estimate to the cent. The operation is a zero-cash-flow ledger event and never copies price observations or certification numbers.
- Selected-card showcases and sale/reference lists exclude private ledger fields by construction. Certification numbers require an explicit opt-in, market references require a live exact match, share text is bounded, and the full CSV neutralizes spreadsheet formulas.
- Grader certification actions use a fixed allowlist of official PSA, Beckett, CGC, TAG, and SGC destinations. Only conservatively recognized PSA, CGC, and TAG identifiers enter direct URLs; unexpected input never enters a URL, no grader is scraped, and the UI does not store or claim an authenticity verdict.
- Private daily portfolio snapshots retain the exact-compatible displayed total and fresh/priced/unpriced coverage. Market performance is derived against the immutable transaction ledger; backdated/unknown or zero-cost inventory additions, destructive removal, and catalog corrections restart the baseline so data-entry changes cannot masquerade as returns.
- AI intake validates the signed-in Supabase user before gateway access, sends only bounded in-memory image data, uses `store: false`, treats visible text as untrusted input, validates strict structured output, and does not write images or results to storage. Exact catalog identity and every financial or condition field still require owner confirmation.

See [implementation plan](implementation-plan-market-portfolio.md) and [security review](security-review.md).
