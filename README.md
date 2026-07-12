# Mica — collection ledger

Mica is a mobile-first, installable collection ledger for trading-card collectors. It turns a physical card into an editable owned-copy record, keeps price context attributable, and remains useful when pricing or recognition is unavailable.

This repository is a dependency-free PWA product slice. It runs locally with explicitly labeled fallback fixtures and includes live TCGdex catalog/market adapters, an enhanced JustTCG adapter, a licensed sold-evidence boundary, and a normalized Supabase schema. It does **not** claim appraisal value or automated condition grading.

## Run

Requires Node 20+.

```bash
npm run dev
```

Open `http://localhost:4173`. The first load uses six preview records; local edits persist in `localStorage`. Use Collection options → Restore preview records to reset.

## Verify

```bash
npm test
npm run test:schema
npm run typecheck
npm run lint
npm run build
```

`npm run build` produces the deployable static bundle in `dist/`.

## What works in the product slice

- Mobile collection ledger with valuation, cost basis, gain/loss, partial-pricing disclosure, search, saved view modes, and sorting.
- Card detail with identity, owned-copy metadata, transparent source/type/currency context, and honest unavailable states.
- Camera/library capture with MIME and size gates, truthful pipeline stages, multiple candidates, confirmation, retake, and manual-search fallback.
- Add/edit quantity, condition, grading company, grade, cost, purchase date, tags, notes, and location.
- Formula-injection-safe CSV export and a validation-only import preview.
- Offline shell, card-image caching, local persistence, reduced-motion support, and installable PWA metadata.
- Provider-neutral TypeScript contracts and an ownership-scoped Supabase schema with RLS.
- Server-side live pricing through TCGdex with compatible TCGplayer USD and Cardmarket EUR quotes kept separate, plus optional condition-level JustTCG pricing.

## Live pricing

No secret is required for the public TCGdex market-price fallback. For enhanced condition × printing quotes and daily history, set `JUSTTCG_API_KEY` as a **Sensitive** Vercel environment variable for Production, then redeploy. The key is read only by `api/cards.js`, sent upstream in the documented `x-api-key` header, and never included in browser code or API responses.

The collection requests normalized quotes for its card IDs. TCGplayer market is preferred only when the finish matches the owned record. Missing or incompatible prices remain explicitly unpriced, while provider outages fall back to clearly labeled preview values.

## Production setup

1. Create a dedicated Supabase project and configure email/password, email verification, password reset, and Google OAuth if approved.
2. Apply the versioned migrations in `supabase/migrations/` to a **fresh** project, deploy the JWT-protected `supabase/functions/sync-catalog` Edge Function, then run Supabase database advisors and cross-user RLS tests. `supabase/schema.sql` mirrors the resulting schema for review.
3. Create a private scan bucket with per-user object policies and a 24-hour cleanup job.
4. Configure the included server-side pricing adapter. Deploy catalog search and identification adapters as authenticated server/edge functions. Do not expose provider or Gemini secrets in the browser.
5. Copy `.env.example`, add only server-side secrets to the deployment environment, and configure rate limits.
6. Replace demo fixtures after approved provider accounts and data rights are confirmed.

The importer is deliberately service-role-only. Use the [catalog sync runbook](docs/catalog-sync-runbook.md) for the protected multilingual backfill, coverage checks, and recurring schedule; never expose a service-role token to the client.

TCGdex is the initial multilingual catalog and no-secret market-price bridge. JustTCG is the enhanced quote source after commercial authorization. New direct TCGplayer and Cardmarket API access is not currently available, and ordinary eBay Browse access does not provide completed sales. See [provider research](docs/provider-research.md).

## Deployment

Deploy `dist/` to any HTTPS static host. `vercel.json` runs `npm run build`, publishes `dist/`, prevents stale service-worker caching, and adds baseline security headers. Camera access and service workers require HTTPS outside localhost. A production data-connected release also needs authenticated server functions; the static bundle alone intentionally does not make third-party pricing calls.

## Documentation

Start with [architecture](docs/architecture.md), [PRD](docs/prd.md), [provider research](docs/provider-research.md), and [production readiness](docs/production-readiness.md).

Mica is independent and is not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures, Game Freak, TCGplayer, Cardmarket, eBay, PSA, CGC, Beckett, or Card Ladder.

