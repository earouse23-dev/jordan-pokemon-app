# Production readiness checklist

- [x] Original mobile product surface, PWA shell, local core journey, testable business rules.
- [x] Provider research, capability boundaries, transparent demo data, no fabricated completed sales.
- [x] Normalized schema, ownership-consistent foreign keys, complete RLS coverage, and versioned launch migration.
- [x] Dedicated Supabase project; launch schema applied; security and performance advisors reviewed.
- [x] Service-role-only multilingual catalog importer deployed; durable price observations and hourly daily-metric rollup active.
- [x] Vercel build/output configuration and baseline response headers.
- [ ] Brand/trademark approval and legal terms review.
- [ ] Auth templates/providers, private Storage policies, and cross-user RLS tests with real test identities.
- [ ] Authorized operator secret in Vault, full catalog backfill, recurring external sync, provider approval/keys, and health/circuit alerting.
- [ ] OCR/vision evaluation dataset and measured top-1/top-3/no-match/correction/cost results.
- [ ] Production import/export jobs, idempotent outbox, account deletion, retention cleanup.
- [ ] Analytics/monitoring configuration, alert routing, incident runbook, backups and restore drill.
- [ ] Physical-device camera, offline/reconnect, screen-reader, zoom, performance, and E2E verification.
- [ ] Privacy policy, terms, provider attribution, support contacts, launch domain, and store/PWA assets.

## Provider account instructions

TCGdex requires no key for the baseline catalog and market adapter. JustTCG requires a server-only key and written commercial authorization for the enhanced tracker use case. TCGplayer/Cardmarket direct credentials cannot be assumed for new applicants. eBay requires a developer application and does not unlock restricted Insights by default. Gemini requires a paid Google AI project and retention/privacy approval. Supabase requires a dedicated organization/project and publishable/secret keys stored in correct client/server environments.

The public project has the versioned catalog-ingestion migration, active `sync-catalog` Edge Function, and internal rollup schedule. Complete the protected first import and recurring invocation using [the catalog sync runbook](catalog-sync-runbook.md). Do not weaken the service-role boundary or paste a service-role token into this repository.

## Backup and recovery

Enable Supabase scheduled backups appropriate to plan, document RPO/RTO, test restoration quarterly, export schema/migrations in CI, and keep provider snapshots reproducible where rights permit. User exports are not backups of auth/storage.

## Adding providers

Implement the relevant interface in `types/providers.ts`, map into normalized values, declare truthful capabilities, validate responses, add fixtures/fallback tests, configure terms-based cache/attribution, add health/timeout/rate handling, and never let UI consume the raw schema.
