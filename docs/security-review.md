# Security review

Implemented: no embedded credentials; environment files ignored except the secret-free template; HTML escaping for user/provider text; client MIME/12MB gate; formula-safe CSV; local photos are object URLs and not persisted; service-role boundary documented; ownership-scoped RLS using `TO authenticated`, `USING`, and `WITH CHECK`; ownership-consistent composite foreign keys; separate canonical and owned data; baseline Vercel response headers.

Production gates: server-side magic-byte/decoded-image/decompression validation, signed private uploads, quotas/rate limits, CSRF strategy, secure headers/CSP, cross-user RLS tests, storage policies, session revocation on deletion, audit logging without secrets/PII, SSRF prohibition on user URLs, import idempotency, virus scanning decision, database advisors, secret rotation, and dependency scanning once dependencies exist.

Supabase change review: current platform guidance separates grants from RLS, so the schema revokes inherited client access before applying explicit grants and policies. All 30 public tables have RLS. The existing `public.rls_auto_enable()` event-trigger helper remains available to PostgreSQL but execute permission is revoked from `public`, `anon`, and `authenticated`. No authorization uses mutable user metadata or `auth.role()`.

Advisor result: no externally facing warning remains. Four informational notices identify server-only operational tables with RLS and no client policies; this is intentional default-deny behavior. Cross-user policy tests and Storage policies remain launch gates.

