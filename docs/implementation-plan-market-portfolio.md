# Market data and portfolio implementation plan

## Repository audit

- Runtime: dependency-light mobile PWA, bundled for Vercel with ES modules.
- Package manager: npm with a committed lockfile.
- Authentication: Supabase schema existed, but the shipped client still used local preview storage. This implementation replaces that path with Supabase email/password authentication and a secondary magic-link flow.
- Database: Supabase Postgres with ownership RLS. Existing catalog and pricing tables are retained and extended rather than rebuilt.
- Server APIs: Vercel Functions under `api/`; provider secrets remain server-only.
- Providers: PkmnPrices is the primary price/history/sales adapter; TCGdex is catalog and compatible raw-price fallback; JustTCG remains an optional fallback. Alt and Card Ladder remain disabled legal-access placeholders.
- Charts: Chart.js is bundled locally and receives only normalized observations.
- Tests: Node's built-in test runner plus schema and build validation.
- Deployment: Vercel static output and Functions, with one authenticated daily Cron endpoint.

## Resolved product rules

- Email/password is the primary sign-in method; magic link is secondary.
- User collection, transaction, and portfolio records persist in Supabase. There is no local demo collection fallback.
- Purchases remain distinct FIFO lots. Partial sales allocate oldest available quantity first.
- Future acquisition dates are rejected with no override.
- Money is parsed and calculated as integer minor units in application code and `numeric(14,2)` in Postgres.
- Raw and graded assets, graders, grades, languages, editions, and finishes are never cross-valued.
- Missing compatible pricing is unavailable, never zero.

## Implementation sequence

1. Add canonical identity, condition/grader/grade normalization, deterministic valuation selection, anomaly checks, and integer-money portfolio calculations.
2. Extend the Supabase schema with provider mappings, immutable observations, collection transactions, FIFO purchase lots, allocation records, sync diagnostics, explicit grants, and ownership RLS.
3. Add password and magic-link auth, authenticated persistence, and transactional RPCs for position creation and FIFO sales.
4. Extend card detail, add-position, portfolio, comparison, chart, entry markers, filtering, and diagnostics states.
5. Add daily secured Vercel synchronization and disabled Alt/Card Ladder adapters.
6. Run lint, type checks, tests, schema validation, production build, and mobile/desktop browser QA before publication.

## Known external gates

- PkmnPrices history and sold evidence depend on the connected plan. The UI reports `plan_required` rather than fabricating history.
- Alt and Card Ladder require licensed API access and remain disabled.
- The committed migration must be applied to the linked Supabase project before authenticated persistence can work in production.
