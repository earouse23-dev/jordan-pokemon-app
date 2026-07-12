# Architecture

## Current slice

Dependency-free ES modules, semantic HTML, custom CSS, localStorage, service-worker shell/image cache, and deterministic fixtures. `lib/core.js` contains testable valuation/search/CSV rules; `app.js` handles presentation and local orchestration.

## Production target

Static/PWA client → authenticated Supabase functions → provider-neutral catalog/identification/pricing adapters → external providers. PostgreSQL is the system of record; private Storage holds temporary captures; scheduled functions sync catalog/prices and delete expired scans.

UI never consumes provider response schemas. Functions validate normalized output, enforce entitlements/rate limits, cache by provider/product/window, log structured health without PII, and return partial results.

## Modules

- `types/providers.ts`: normalized provider capabilities and contracts.
- `supabase/schema.sql`: identity, catalog, collection/copies, scans/candidates, pricing, valuations, jobs, health, and RLS.
- `lib/core.js`: pure financial, search, freshness, and CSV safety functions.
- `tests/`: unit verification independent of live APIs.

See ADR 0001 for why the existing PWA stack was retained.

