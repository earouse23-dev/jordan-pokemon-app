# SOL release activation 01 — preflight stop, 2026-09-30

**Outcome: stop for Astra review. Neither approved script was executed on hosted Supabase.** The exact scripts both committed in a disposable copy of the actual recovery database, but preservation checks exposed an unreviewed research-data side effect. No SQL artifact, application code, migration history, hosted configuration or deployment was changed. Ponytail FULL, AGENTS.md, roadmap/pivot, Supabase and Vercel API skills and the recovery/activation evidence were read; existing work was reused.

## Exact transactions

| Script | Verified SHA-256 | Actual-data local rehearsal | Hosted outcome |
| --- | --- | --- | --- |
| [07F](sol-client-07f/collector-upgrade.sql) | `ee45c20b673437deeab7728ce035530a58fd7eeacbdde063599e00dbba8c6fe6` | One execution; COMMIT; zero SQL errors | Not executed |
| [07G](sol-client-07g/retained-surface-delta.sql) | `6827663e43d47e6b40debff2625b1fa38377358736fd72e6f70cb593bb6f7162` | One separate execution after 07F; COMMIT; zero SQL errors | Not executed |

There are **no hosted executed hashes or successful hosted backfills** to report. Existing approval was not requested again. The packet expressly requires stopping on material unsafe effects rather than changing either frozen artifact.

## Blocking evidence and cause

07F updates `grading_captures.collectible_id` at [collector-upgrade.sql:552](sol-client-07f/collector-upgrade.sql). The retained baseline already has `refresh_training_example_from_capture`, an AFTER INSERT/UPDATE/DELETE trigger. It calls `grading_private.refresh_training_example_trigger()` → `refresh_training_example()`, which copies capture metadata into private research examples. The latter checks account-level consent but treats a non-research session as an exclusion reason **after proceeding toward insertion**, rather than preventing snapshot creation.

| Private relation | Retained baseline | After exact 07F + 07G |
| --- | ---: | ---: |
| `training_examples` | 0 | 5 |
| `physical_card_partitions` | 0 | 5 |
| `pilot_audit_events` | 52 | 66 |

All five created examples refer to scans whose `consent_mode` is **normal**. Their manifests contain **14 capture-metadata snapshots**, all marked `retained=false`; 14 new audit events are `training_example_refreshed`. Account-level consent remains valid, there are no matching deletion tombstones, and zero examples are eligible. This is not evidence that image bytes were copied or that training/provider transmission occurred. It is evidence of new research snapshots from normal-session metadata, missed by the earlier synthetic-only rehearsal. Treating that as approved would weaken the session privacy boundary.

The [runnable aggregate preservation check](sol-release-activation-01/preservation.mjs) exits **1**, identifying exactly these three changed baseline relations. It compared 104 original base tables using only aggregate row counts and digests; the other 101 matched after excluding additive columns, public `updated_at`, the approved software-mode preference key and the intentionally new Storage bucket. Those exclusions limit the preservation claim. In particular, 14 items, 16 transactions, 14 lots, 2 Auth users and 2 Storage objects remain; original financial/ownership fields and existing object metadata matched. No customer row, identifier, email, credential or capture payload was printed.

## Other preflight evidence and limits

- Verified existing target `kdkzdflrxajfdcithrfj`, `jordan-pokemon-app`, us-west-2, ACTIVE_HEALTHY, PostgreSQL 17.6. Read-only hosted counts match retained baseline: 58 migration rows, 56 public RLS tables, 14 items, 2 users, 2 collections, 2 objects / 134,532 bytes. No other active transaction was seen at the observation; that is not a lock guarantee.
- [Schema fingerprint query](sol-release-activation-01/read-only-schema.sql) matched hosted and retained baseline across columns, constraints, indexes, triggers, policies, application functions, selected role grants, complete migration-row digest and bucket rows. It covers public/grading-private schema objects and the named grant/policy scopes, not every service setting. No material drift was found in that scope. History digest: `a118a30213299da18ec61c33f12bf978`; trigger digest: `e141cfaf13fa6c91975b062d395346f6`.
- Original `postgres.dump` and `globals.sql` hashes still match the recovery report (`ee02b240370b8d434d0b25643cf65390835657bce1e83b4da03acb521bbccc00`, `55af1abf787108051d573a1a3c7e4563eb7f8765f29a37dc87a55c302400fc4e`). Copied the retained restored PGDATA into two owner-private disposable directories; the original archive and restored baseline were not opened by a database server. Both new containers used network `none`, logging `none`, no TCP listener and `cron.launch_active_jobs=off`; no Auth/Storage/email/provider service was started. Containers were stopped and removed. Copies/logs remain under the protected recovery directory's `activation-rehearsal/`; no secrets/passfile were needed.
- An attempted separate-database restore rolled back with `can only create extension in database postgres`; the complete disposable baseline instead used a second PGDATA copy. No archive normalization or frozen SQL edit was made.
- Local combined-schema checks: all 83 public tables have RLS; all 4 buckets are private; item canonical pointers are non-null. Verified-valuation EXECUTE and Auth email SELECT are denied to anon/authenticated and permitted to service_role. Owner-operation/Storage-service checks from 07G remain prior synthetic evidence; they were not rerun against these private copies after the stop. Hosted synthetic writes were not performed.
- 07F retains its 5-second lock timeout and 120-second statement timeout. It takes table locks and runs backfill/index/constraint work; a quiet observation cannot certify production contention. 07G has no explicit timeout in its frozen artifact. No timeout setting was added. Successful 07G would not reverse 07F; no automatic retry or production restore is authorized.
- Vercel read-only lookup reconfirmed production `dpl_5rZyi9juErBWXNjzKYtetDb2DYap`, project `prj_ICSEVLitTA6RdwTTy14BThiAvPEQ`, source SHA `08854a6613b8cefdbe0c2e0a006f356bf8d56639`. Retrieved that commit's `lib/supabase-data.js` through authenticated GitHub CLI into the protected directory. All 14 literal legacy RPC names are present before/after rehearsal; their aggregate definitions/ACLs are not identical. Static presence is not end-to-end compatibility proof. Further deployed-write compatibility work stopped at the privacy gate.
- Syntax check for the preservation harness passed. No unrelated full suite, native build, physical device, live provider or public-release acceptance was claimed. Existing non-atomic recovery/service-configuration limitations remain accepted only within Elliott's stated SQL authority.

## Next review and prepared deployment request

Astra must resolve the normal-session research refresh effect before any hosted activation. A safe remedy may require narrowing the existing trigger to relevant content changes or preventing refresh from materializing normal-session metadata; that is a **new reviewed SQL change**, outside this packet. No remedy was applied, no existing SQL approval was expanded, and no next packet was started.

**Prepared request, contingent on a reviewed fix, completed safe activation and Astra acceptance:** approve release of the curated 07G web/API source ZIP to the existing Vercel project, ZIP SHA-256 `391b748260cf17124cded8dc18960b23b8e020af3f178aa899d0f84d3dd33b47`, manifest SHA-256 `4e1710477b1af0846532cf906315f3f48b81878857b6b0d7c729f9970614dc58` (both reverified). Exact contents are the manifest's 84 runtime source files and 28 neutral output files: collector capture/correction/save/photo/copy-sale/history, authentication/profile/privacy/account, action/settings, pregrading entry/confirmed reports and their included API routes. Internal certificate fixtures, signing material, subscriptions and six omitted SQL migrations remain excluded. The neutral output has empty public credentials; a configured rebuild and its output hash must be reviewed before deployment. Approve only the concrete public Supabase URL/publishable-key/API-origin configuration specified in the activation bundle; server secrets stay server-only. Native callback/Auth allowlist/AASA changes still need exact Apple team/bundle inputs and their separate configured review.

Rollback boundary: restore web/API alias to `dpl_5rZyi9juErBWXNjzKYtetDb2DYap` under deployment authority; retain additive schema and user records. No automatic backfill reversal, database reset or data restore. Forward repair, service disable/configuration changes, provider spending, signed native distribution and App Store/TestFlight actions require their own authority and evidence. This request is prepared for review, **not presented as an immediately safe deployment approval**.

Stop for Astra review.
