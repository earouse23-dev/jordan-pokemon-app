# Mica — collection ledger

Mica is a mobile-first, installable collection ledger for trading-card collectors. It turns a physical card into an editable owned-copy record, keeps price context attributable, and remains useful when pricing or recognition is unavailable.

This repository is a dependency-free PWA product slice. It runs locally with realistic, explicitly labeled demo data and includes production-oriented provider contracts plus a normalized Supabase schema. It does **not** claim live pricing, completed sales, appraisal value, or automated condition grading.

## Run

Requires Node 20+.

```bash
npm run dev
```

Open `http://localhost:4173`. The first load uses six preview records; local edits persist in `localStorage`. Use Collection options → Restore preview records to reset.

## Verify

```bash
npm test
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

## Production setup

1. Create a dedicated Supabase project and configure email/password, email verification, password reset, and Google OAuth if approved.
2. Apply `supabase/schema.sql` to a **fresh** project, then run Supabase database advisors and cross-user RLS tests.
3. Create a private scan bucket with per-user object policies and a 24-hour cleanup job.
4. Deploy catalog, pricing, and identification adapters as authenticated server/edge functions. Do not expose provider or Gemini secrets in the browser.
5. Copy `.env.example`, add only server-side secrets to the deployment environment, and configure rate limits.
6. Replace demo fixtures after approved provider accounts and data rights are confirmed.

The Pokémon TCG API is the recommended initial catalog/price-field bridge. New direct TCGplayer and Cardmarket API access is not currently available, and ordinary eBay Browse access does not provide completed sales. See [provider research](docs/provider-research.md).

## Deployment

Deploy `dist/` to any HTTPS static host. Camera access and service workers require HTTPS outside localhost. A production data-connected release also needs authenticated server functions; the static bundle alone intentionally does not make third-party pricing calls.

## Documentation

Start with [architecture](docs/architecture.md), [PRD](docs/prd.md), [provider research](docs/provider-research.md), and [production readiness](docs/production-readiness.md).

Mica is independent and is not affiliated with or endorsed by The Pokémon Company, Nintendo, Creatures, Game Freak, TCGplayer, Cardmarket, eBay, PSA, CGC, Beckett, or Card Ladder.

