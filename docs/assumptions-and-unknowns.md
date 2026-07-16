# Assumptions and unknowns

## Confirmed assumptions

- Mica is a temporary original name pending brand approval.
- Launch is a responsive PWA optimized for portrait mobile; a native wrapper is deferred.
- English cards and USD display are the initial product defaults.
- Users must confirm an exact printing before save unless a future measured threshold is approved.
- A missing price never blocks a collection record.

## Unknowns requiring commercial or legal decisions

- Approved product name, domain, and trademark clearance.
- Paid PkmnPrices plan level, production quotas, and billing approval. The current key can return current prices but is plan-limited for history and sold evidence.
- Licensed commercial provider for graded prices or transaction history.
- Whether Pokémon TCG API and linked pricing fields meet the client’s commercial redistribution terms at intended scale.
- Required regions/languages at launch and exchange-rate provider.
- Gemini billing project, retention configuration, and privacy approval.

## Current implementation boundaries

- UI is a complete local product slice with Vercel API adapters, not a fully connected production service.
- Authentication screens, provider edge functions, actual OCR/vision calls, background sync, and durable import execution require configured infrastructure.
- Preview prices are fixtures and visibly labeled not live; loading, unavailable, stale, provider-error, and plan-limited states remain separate.

