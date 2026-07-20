# API provider setup runbook

Checked on 2026-07-15. Do not paste provider secrets into source control, screenshots,
client-side code, or issue comments. Keys belong only in local `.env` files, Vercel
environment variables, or Supabase Vault/secrets where applicable.

## Recommended order

If you only want one paid provider, choose **PkmnPrices** first.

TCGdex can still stay in the app as the free catalog/fallback source because it
does not require a key or subscription. It is not the paid pricing backbone.

1. Use TCGdex immediately for catalog identity.
2. Use PkmnPrices as the primary paid Pokemon pricing, history, and sold-listing
   provider.
3. Treat Scrydex as the backup to test only if PkmnPrices coverage or support is
   not good enough.
4. Treat JustTCG as temporary/current-price infrastructure that is already wired,
   not the final choice unless it beats PkmnPrices in coverage and contract terms.
5. Use PriceCharting only as a graded/current-value cross-check.
6. Do not make launch dependent on direct TCGplayer API access unless TCGplayer
   approves a developer/partner key.

## Before full app integration

You need these decisions and accounts before a complete production setup:

- A production app name, domain, support email, and privacy/terms pages.
- A short description of the app: collector portfolio, not a marketplace and not
  an appraisal service.
- Written permission from each paid provider for commercial use, caching, user
  display, derived metrics, and retention/deletion rules.
- A coverage test list of 500 to 1,000 real Pokemon cards across modern,
  vintage, Japanese, reverse holo, promos, graded, and low-liquidity cards.
- A rule that the UI shows "No verified market data" instead of guessing.
- Server-only storage for API keys.

## TCGdex

Purpose: primary catalog identity and public fallback pricing fields.

Link: https://tcgdex.dev/

Setup:

1. No account or API key is required for the current app usage.
2. Keep `CATALOG_PROVIDER=tcgdex` in `.env`.
3. Leave `CATALOG_PROVIDER_API_KEY=` blank.
4. Use the existing `/api/catalog` route for search.
5. Use the existing TCGdex fallback in `/api/cards` when no paid pricing key is
   available or when the paid provider misses a card.

Important limits:

- TCGdex is excellent for identity and multilingual catalog coverage.
- It is not enough by itself for condition-specific, graded, or sold-comparable
  valuation.

## PkmnPrices

Purpose: primary paid Pokemon pricing/sales-history provider.

This is the one to set up first if you want one serious provider instead of
multiple overlapping vendors.

Links:

- Docs: https://www.pkmnprices.com/docs
- Start/dashboard: https://www.pkmnprices.com/

Setup:

1. Create a PkmnPrices account from the dashboard link.
2. Create an API key.
3. Start with Free only for smoke testing. Move to Pro before serious coverage
   testing if you need Japanese cards or higher daily volume.
4. Ask support, in writing, to confirm that your plan permits:
   - public commercial collection tracker use;
   - server-side caching;
   - displaying TCGplayer/Cardmarket/eBay-derived values to users;
   - derived metrics such as trend, median, and portfolio value;
   - retention of normalized snapshots;
   - deletion/tombstone requirements if your account ends.
5. Add the key as `PKMNPRICES_API_KEY`.

Where it goes:

- Local testing: create a private `.env` file from `.env.example` and set
  `PKMNPRICES_API_KEY=...` and `PKMNPRICES_PLAN=free`.
- Vercel: add `PKMNPRICES_API_KEY` to Production, Preview, and Development
  environments. When the subscription is upgraded, set `PKMNPRICES_PLAN=pro`
  and redeploy; the app will use the prepared Pro data path without a code or
  schema change.
- Supabase Edge Functions: add a separate secret only if a Supabase function will
  call PkmnPrices directly.

Current app status:

- `/api/cards` reads `PKMNPRICES_API_KEY` and uses PkmnPrices as the primary
  current-price/history provider.
- The provider adapter already normalizes raw and graded price rows, 365-day
  history with daily low/high/sale counts, Japanese lookups, and complete card
  metadata. `PKMNPRICES_PLAN=pro` activates the larger history window.
- `/api/sales` reads `PKMNPRICES_API_KEY` for eBay sold-listing evidence.
- `/api/offers` reads the same server-only key for exact-printing TCGplayer and
  Cardmarket seller asks. Active asks are kept separate from completed sales.
- If PkmnPrices cannot match a card, the app falls back to free TCGdex aggregate
  pricing instead of guessing.
- A sanitized live check on 2026-07-15 matched Base Set Charizard to PkmnPrices
  card `16909` and returned five current-price rows.
- The same key received `403` for price history and eBay sold evidence. The app
  exposes those as separate `plan_required` states; it does not turn an empty
  response into a flat chart or claim that no sales exist.
- Successful PkmnPrices matches return the provider card ID to the client record
  so later current-price and sales requests can use an exact ID instead of fuzzy
  name matching. The secret key is never included in normalized output.

## Scrydex

Purpose: enterprise-grade backup candidate for pricing, history, graded data,
population reports, webhooks, and image analysis.

Links:

- Docs: https://scrydex.com/docs
- Pricing: https://scrydex.com/pricing

Setup:

1. Create a Scrydex account.
2. Pick Starter for a small trial or Growth if you want a stronger coverage test.
3. Create an API key.
4. Ask support to confirm the same commercial/caching/display/retention rights
   listed for PkmnPrices.
5. Add a new server-only key name when we implement the adapter, for example
   `SCRYDEX_API_KEY`.

Current app status:

- Scrydex is not wired into this repository yet.
- To integrate it, add `lib/providers/scrydex.js`, normalize its responses into
  the same quote/history schema, then add it to `/api/cards` behind a feature flag.

## JustTCG

Purpose: current-price provider already wired in `/api/cards`.

Links:

- Docs: https://justtcg.com/docs/quickstart
- Pricing/API key: https://justtcg.com/#pricing

Setup:

1. Sign up and subscribe to a plan.
2. Create an API key.
3. Confirm in writing that your app use is allowed commercially and is not
   considered redistribution or a competing backend.
4. Add the key as `JUSTTCG_API_KEY`.

Where it goes:

- Local testing: `JUSTTCG_API_KEY=...` in private `.env`.
- Vercel: `JUSTTCG_API_KEY` in Production, Preview, and Development.

Current app status:

- `/api/cards` can still read `JUSTTCG_API_KEY`, but it is optional.
- Do not configure it while PkmnPrices is the chosen paid provider unless you
  deliberately want a paid fallback for coverage testing.

## PriceCharting

Purpose: optional current-value and graded-price cross-check.

Link: https://www.pricecharting.com/api-documentation

Setup:

1. Subscribe to a paid PriceCharting plan with API access.
2. Get the 40-character token from the subscription API/download page.
3. Add a future key such as `PRICECHARTING_API_TOKEN` only if we implement this
   adapter.

Important limits:

- The API supports current item values only.
- It does not provide historical prices or historical sales through the API.
- Use it as a secondary sanity check, not the main provider.

## Direct TCGplayer API

Purpose: only if TCGplayer grants direct developer access.

Link: https://docs.tcgplayer.com/docs/getting-started

Setup:

1. Contact TCGplayer developer/partner support and ask whether they will grant
   API access for your app.
2. If approved, request a public/private developer key pair.
3. Store the private key server-side only.
4. Implement a token exchange on the server. Do not call TCGplayer directly from
   the browser.

Important limit:

- TCGplayer's public docs currently say new API access is not being granted, so
  this should not block launch.

## Local setup checklist

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `CATALOG_PROVIDER=tcgdex`
   - `PRICING_PROVIDER=pkmnprices`
   - `SALES_PROVIDER=pkmnprices`
   - `PKMNPRICES_API_KEY=...`
   - `PKMNPRICES_PLAN=free` (change to `pro` only after the account upgrade)
3. Leave keys blank for providers you have not purchased or approved yet.
4. Start the app and search for:
   - Base Set Charizard 4/102
   - Umbreon VMAX 215/203
   - Mew ex 151/165
   - a Japanese card
   - a low-value common
5. Record whether each provider returns exact printing, finish, condition, price,
   history, and sold evidence.

## Production setup checklist

1. Add the same keys to Vercel environment variables.
2. Keep all provider calls behind `/api/*` server routes.
3. Cache provider responses according to the provider contract.
4. Store normalized quote snapshots, not raw provider payloads unless the
   contract permits raw retention.
5. Show provider name, timestamp, currency, condition, finish, and confidence in
   the UI.
6. Alert on provider failures, high unknown-pricing rates, and rate-limit errors.
7. Run a coverage test before launch and choose the primary provider by measured
   match rate, not marketing copy.
