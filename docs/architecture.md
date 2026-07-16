# Architecture

## Client

The mobile PWA uses bundled ES modules, semantic HTML, custom CSS, Chart.js, Supabase Auth/Data API persistence, and a service-worker shell/image cache. `lib/domain.js`, `lib/portfolio.js`, and `lib/core.js` contain testable identity, valuation, FIFO, integer-money, search, and CSV rules. `app.js` handles presentation and authenticated orchestration.

Collection records never fall back to local demo storage. The browser receives only the Supabase URL and publishable key. Secret/service and provider credentials remain server-side.

## Data flow

```text
Mobile PWA → Supabase Auth → ownership RLS → collection items / transactions / FIFO lots
          ↘ Vercel Functions → provider adapters → PkmnPrices / TCGdex
Vercel Cron → secured price sync → immutable normalized observations → charts / valuation
```

PostgreSQL is the system of record. Transactional, `security invoker` RPCs create a position plus its first purchase lot and allocate sales against the oldest locked lots. Every mutation derives the owner from `auth.uid()`.

## Provider boundaries

- PkmnPrices: primary current raw/graded pricing, available history, and licensed sold evidence.
- TCGdex: multilingual catalog, sets, identity, variants, images, and compatible raw TCGplayer/Cardmarket comparison.
- JustTCG: optional configured raw fallback.
- Alt and Card Ladder: disabled until licensed API access is supplied; never scraped.

UI and financial code consume normalized internal observations only. Raw/graded state, variant, finish, edition, condition, grader, grade, language, market, currency, source, and freshness remain explicit.

## Synchronization

`api/price-sync.js` is called daily by Vercel Cron. It verifies the bearer secret, reads actively owned canonical cards with a server-only Supabase client, requests PkmnPrices, stores immutable deduplicated observations, and updates provider diagnostics. Partial failures preserve previous valid data.

The existing `supabase/functions/sync-catalog` remains the resumable multilingual catalog importer. Catalog and pricing synchronization are separate jobs with separate status records.

## Security

- Email/password primary authentication and secondary magic links.
- Explicit Data API grants for authenticated tables.
- RLS on every public table.
- Ownership predicates on collection items, transactions, purchase lots, and FIFO allocations.
- Admin diagnostics use `app_metadata.role`, never user-editable metadata.
- Provider and service secrets never enter the browser bundle.
- Future transaction dates are rejected in UI validation, RPCs, and table constraints.

See [implementation plan](implementation-plan-market-portfolio.md) and [security review](security-review.md).
