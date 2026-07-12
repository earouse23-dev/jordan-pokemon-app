# Repository audit

## Before rebuild

The repository was an existing dependency-free static PWA: `index.html`, `styles.css`, `app.js`, a manifest, service worker, icon, and one Supabase SQL file. It embedded a Supabase project URL/key, silently created anonymous accounts, stored entire card photographs as database data URLs, called Pokémon TCG API directly from the browser, and reconstructed “recent sales” from rolling average fields. There was no package manifest, automated test suite, authenticated account UI, normalized ownership model, provider boundary, or documentation set.

## Decision

The zero-build PWA architecture is retained because it is fast, installable, and highly suitable for the requested mobile product. The implementation and design were replaced. No UI library or runtime dependency was introduced. Production provider calls are moved conceptually behind typed adapter contracts and must be deployed server-side; the current client uses explicit demo fixtures.

## Reusable assets

Only the PWA hosting shape and public catalog-image convention were retained. Brand, icon, UI, data model, claims, storage behavior, and interaction model were rebuilt.

## Risks found and corrected

- Removed hard-coded external project credentials.
- Removed false “live,” “last sold,” and reconstructed-sales claims.
- Stopped storing photos inside collection rows.
- Replaced device-only anonymous ownership as the intended launch account model.
- Added partial/unpriced semantics, safe CSV logic, tests, and normalized RLS schema.

