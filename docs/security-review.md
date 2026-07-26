# Security review

Implemented: no embedded credentials; environment files ignored except the secret-free template; HTML escaping for user/provider text; client MIME/12MB gate; formula-safe CSV; local photos are object URLs and not persisted; catalog scheduling uses a Vault-held single-purpose token rather than a reusable service-role credential; ownership-scoped RLS using `TO authenticated`, `USING`, and `WITH CHECK`; ownership-consistent composite foreign keys; separate canonical and owned data; baseline Vercel response headers.

Production gates: server-side magic-byte/decoded-image/decompression validation, signed private uploads, quotas/rate limits, CSRF strategy, secure headers/CSP, cross-user RLS tests, storage policies, session revocation on deletion, audit logging without secrets/PII, SSRF prohibition on user URLs, import idempotency, virus scanning decision, database advisors, secret rotation, and dependency scanning once dependencies exist.

Supabase change review: current platform guidance separates grants from RLS, so the schema revokes inherited client access before applying explicit grants and policies. All 30 public tables have RLS. The existing `public.rls_auto_enable()` event-trigger helper remains available to PostgreSQL but execute permission is revoked from `public`, `anon`, and `authenticated`. No authorization uses mutable user metadata or `auth.role()`.

Advisor result on 2026-07-25: no missing-RLS or user-data ownership warning was
reported. Seven informational notices identify server-only operational tables
with RLS and no client policies; this is intentional default-deny behavior.
The advisor also reports `claim_vision_usage` and `claim_advisor_usage` because
authenticated users can execute those `SECURITY DEFINER` functions. These are
intentional, narrow RPCs: each derives the owner only from `auth.uid()`, bounds
both arguments, uses an empty search path, touches only the caller's usage rows,
and makes count-and-claim atomic without granting clients permission to delete
their own rate-limit records. Vision and portfolio explanations have separate
budgets.

Portfolio AI receives only server-allowlisted signal keys and aggregate counts.
The endpoint does not read or write collection tables, sets `store: false`,
hashes the authenticated user ID for the Gateway safety identifier, restricts
structured output to existing action keys, and does not persist the result.

Leaked-password protection remains disabled because it is a paid Supabase Auth
feature for this project. Enable it immediately after the owner upgrades the
project, then rerun the security advisor. Cross-user policy tests and Storage
policies remain launch gates.

Live pricing review: `PRICING_PROVIDER_API_KEY` is server-only and `.env*` files are ignored. The endpoint allowlists card IDs, caps batches at 25, applies a best-effort per-IP rate limit, uses an eight-second upstream timeout, returns generic provider errors, and never serializes the key or raw provider payload.
