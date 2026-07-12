# Security review

Implemented: no embedded credentials; HTML escaping for user/provider text; client MIME/12MB gate; formula-safe CSV; local photos are object URLs and not persisted; service-role boundary documented; ownership-scoped RLS using `TO authenticated`, `USING`, and `WITH CHECK`; separate canonical and owned data.

Production gates: server-side magic-byte/decoded-image/decompression validation, signed private uploads, quotas/rate limits, CSRF strategy, secure headers/CSP, cross-user RLS tests, storage policies, session revocation on deletion, audit logging without secrets/PII, SSRF prohibition on user URLs, import idempotency, virus scanning decision, database advisors, secret rotation, and dependency scanning once dependencies exist.

Supabase change review: current platform changes include tables not necessarily being exposed automatically; schema grants are explicit. No authorization uses mutable user metadata, `auth.role()`, or a public SECURITY DEFINER function.

