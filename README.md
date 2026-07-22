# Mica — Pokémon card portfolio

Mica is a mobile-first, installable portfolio for exact Pokémon card printings. Authenticated collectors can record raw or graded positions, preserve individual purchase lots, track FIFO cost basis and sales, compare compatible provider values, and see acquisitions on real price history without invented data.

The product name is presentation-only. Domain models, provider adapters, and database structures do not depend on “Mica.”

## Run

Requires Node 20+.

1. Copy `.env.example` to `.env`.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser authentication.
3. Configure `SUPABASE_SECRET_KEY` only for server-side synchronization.
4. Configure `PKMNPRICES_API_KEY` for primary market pricing. Set `PKMNPRICES_PLAN=pro` after upgrading so Mica requests the prepared 365-day history, Japanese, marketplace-offer, and sealed-product paths.
5. AI card/receipt intake uses Vercel AI Gateway. On Vercel, OIDC supplies authentication automatically; for local or non-Vercel use, configure `AI_GATEWAY_API_KEY`. Keep the default `VISION_MODEL` or choose another approved OpenAI vision model.
6. Apply the migrations in `supabase/migrations/` to the linked Supabase project.
7. Run:

```bash
npm run dev
```

The app opens on the port printed by the local server. It does not fall back to local demo collection storage when Supabase is missing or unavailable.

## Authentication and persistence

- Email/password is the primary sign-up and sign-in method.
- Magic link is a secondary sign-in option.
- Supabase Auth sessions automatically attach JWTs to Data API requests.
- Collection items, transactions, purchase lots, FIFO allocations, and portfolio data persist in Supabase.
- Ownership RLS uses `(select auth.uid()) = user_id` for reads and writes.
- Mutation RPCs use `security invoker`, derive ownership from `auth.uid()`, and cannot accept a caller-supplied user ID.
- The browser receives only the Supabase URL and publishable key. Secret/service and provider keys remain server-only.

## Portfolio rules

- Raw conditions normalize to Near Mint, Lightly Played, Moderately Played, Heavily Played, or Damaged while preserving provider labels.
- Supported graders are PSA, BGS, CGC, TAG, and SGC, with an extensible `OTHER` normalization value.
- Grades retain decimal precision such as BGS 9.5.
- Raw and graded values are never combined. Graders, grades, variants, editions, finishes, languages, and currencies must remain compatible.
- Purchases remain separate lots. Partial sales allocate the oldest remaining lots first using FIFO.
- A returned raw card can become graded in place: the original purchase and FIFO lots remain auditable, the all-in grading cost is capitalized to the remaining basis, and no fake sale or repurchase is created.
- Raw positions can be tracked through a private grading pipeline from sent through returned. Submission estimates remain planning data; active positions cannot be sold, traded, archived, or have inventory state changed until the submission is cancelled or the result is recorded.
- Owned slabs can open allowlisted official PSA, Beckett, CGC, TAG, or SGC certification lookups. Mica provides a comparison checklist but never treats a database match as proof of authenticity.
- Additional copies can be recorded against an existing position without merging purchase lots or replacing their original costs.
- The portfolio timeline defaults to cash-adjusted market change: purchases and grading costs are money added, net sales are money removed, and fresh complete price coverage is required before Mica reports a return. The separate total-value view intentionally includes collection additions and removals.
- Future acquisition and transaction dates are rejected in the client, transactional RPC, and table constraints.
- Application money math uses integer minor units; Postgres stores money as `numeric(14,2)`.
- Missing compatible prices remain unavailable, never `$0`.

## Provider behavior

1. PkmnPrices is the primary source for compatible raw and graded prices and history.
2. TCGdex supplies catalog identity, sets, variants, images, and compatible TCGplayer/Cardmarket raw comparisons.
3. JustTCG remains an optional configured raw-price fallback.
4. Alt and Card Ladder adapters are present but disabled. They require authorized API or licensed data access; the app does not scrape them.

Provider responses are normalized before reaching portfolio calculations or UI components. Current observations, history, source, market, currency, condition/grader/grade, and freshness remain explicit. Provider disagreements are shown separately and are not averaged by default.

## AI-assisted intake

Authenticated users can photograph a card or slab for identity suggestions, add front and back photos for a conservative raw-grade range, or scan a receipt/order confirmation for purchase facts. Images are resized and converted on-device, sent once through the server-only Vercel AI Gateway path, and are not written to Supabase, object storage, application logs, or portfolio records. The upstream request sets `store: false`.

AI output is an untrusted draft. Mica always requires the user to choose the exact catalog printing and confirm raw/graded state, condition or grader/grade, certification, quantity, and total acquisition cost before saving. Grade ranges are planning estimates—not professional grades—and cannot rule out defects hidden by sleeves, glare, lighting, focus, or angle. Receipt extraction never invents allocation of tax, shipping, fees, discounts, or unclear order value.

The endpoint requires a valid Supabase access token, atomically claims a durable owner-scoped usage allowance, accepts only bounded JPEG/PNG/WebP data URLs, uses strict structured output, hashes the user identifier before sending a safety identifier, and returns `no-store` responses. See [AI vision runbook](docs/ai-vision-runbook.md).

The PkmnPrices account currently configured in this workspace can return current prices. Historical price and linked sold-listing endpoints may report `plan_required`; the app preserves that state rather than inventing history.

## Scheduled synchronization

Vercel calls `GET /api/price-sync` daily at 05:00 UTC. The endpoint requires the exact bearer value in `PRICE_SYNC_SECRET` or `CRON_SECRET`, loads a rotating 50-position batch of actively owned cards, requests PkmnPrices server-side, and inserts immutable normalized observations. A durable UUID cursor wraps through the full active collection without increasing the daily provider budget, and imported TCGplayer Product IDs are preferred over name-only matching. Position-scoped history works even when a searched card has not yet been mapped to an internal catalog UUID. Duplicate observations are retained once through a database unique constraint; partial failures update provider diagnostics without deleting prior valid data. Pro and Business plans backfill up to 365 days of exact compatible history; the free plan still accumulates genuine current observations over time.

Users whose Supabase `app_metadata.role` is `admin` receive a protected profile action for provider health, ambiguous or missing mappings, open anomalies, and manual re-sync. The manual `POST /api/price-sync` path validates the caller's Supabase access token and admin role on the server; the cron secret is never sent to the browser.

Vercel Cron runs only for production deployments. Alt and Card Ladder are not scheduled while disabled.

## Environment variables

See `.env.example`. Important values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `PKMNPRICES_API_KEY`
- `PKMNPRICES_PLAN` (`free`, `pro`, or `business`; defaults to `free`)
- `TCGDEX_BASE_URL`
- `PRICE_SYNC_SECRET` or Vercel `CRON_SECRET`
- `PRICE_STALE_AFTER_HOURS`
- `PRICE_ANOMALY_THRESHOLD_PERCENT`
- `AI_GATEWAY_API_KEY` (local/non-Vercel fallback; do not expose to the browser)
- `VISION_MODEL` (defaults to `openai/gpt-5.6-luna`)
- `VISION_MAX_PER_HOUR` (defaults to `20` per authenticated user)
- disabled `ALT_*` and `CARD_LADDER_*` values

Do not commit credentials. Do not add `SUPABASE_SECRET_KEY`, provider keys, or synchronization secrets to public/browser-prefixed variables.

## Verify

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run test:schema
npm run build
```

The deterministic tests do not call live providers. They cover identity normalization, variants, conditions, graders, grades, immutable observation selection, provider fallback, stale/missing/currency states, integer money, FIFO partial sales, future dates, RLS ownership, authenticated mutation functions, and secured synchronization.

## Database deployment and troubleshooting

Apply migrations before testing authenticated persistence. After applying them:

1. Run Supabase database advisors.
2. Verify the new tables have explicit Data API grants; Supabase no longer exposes new public tables automatically.
3. Test with two accounts and confirm neither can select, update, or delete the other account’s collection, transactions, lots, or allocations.
4. Enable email/password and magic-link providers and add the production URL to Auth redirect URLs.
5. Confirm Vercel has the public Supabase variables at build time and server-only values at function runtime.
6. Run the required PSA 10 and raw Near Mint acceptance flows.

If a value is unavailable, inspect exact identity/variant mapping, state, condition or grader/grade, currency, provider entitlement, and freshness before changing valuation logic.

## Documentation

- [Implementation plan and audit](docs/implementation-plan-market-portfolio.md)
- [Architecture](docs/architecture.md)
- [Provider setup](docs/provider-setup-runbook.md)
- [Pricing foundation](docs/pricing-foundation.md)
- [Catalog synchronization](docs/catalog-sync-runbook.md)
- [Continuous product improvement log](docs/continuous-improvement-2026-07-20.md)
- [Security review](docs/security-review.md)
- [AI vision runbook](docs/ai-vision-runbook.md)

Mica is independent and is not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures, Game Freak, TCGplayer, Cardmarket, eBay, PSA, CGC, Beckett, SGC, Alt, or Card Ladder.
