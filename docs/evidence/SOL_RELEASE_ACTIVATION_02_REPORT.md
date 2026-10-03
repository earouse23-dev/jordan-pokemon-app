# SOL release activation 02 — local consent correction

**Outcome: local preflight passed; stop for Astra review. No hosted SQL, deployment, spending, commit or CLIENT-08 work occurred.** Ponytail FULL was read first and applied; AGENTS.md, roadmap/pivot, Supabase skill and the activation-01 report were read. Existing cleanup, migration tooling and preservation checks were reused. The original recovery set, historical migrations and frozen release artifacts remain intact.

## Root cause and correction

`grading_private.refresh_training_example()` checked account consent, then built and persisted research metadata before treating normal-session consent and unretained captures as eligibility exclusions. Account consent therefore permitted snapshots that session consent did not authorize. 07F's canonical-pointer backfill exposed this through the existing capture UPDATE trigger.

The new migration replaces only that shared function. Before reading outcomes or constructing capture JSON, it requires explicit research-session mode/version, valid account permission and a nonempty capture set with every capture explicitly retained. Missing/null/invalid permission fails closed. Invalid existing examples use the unchanged `delete_training_subject()` cleanup path. An unchanged source covered by a deletion tombstone cannot be recreated by a later refresh. Valid research sessions retain their existing pending/eligible workflow; this is not a research-system redesign or a customer-data cleanup migration.

Caller trace: capture and outcome INSERT/UPDATE/DELETE triggers call `refresh_training_example_trigger()` → the shared function; outcome-verification and annotation-review functions also call it directly. The consent-withdrawal UPDATE trigger uses `delete_training_subject()`; 07G's `grading_withdraw_account_training_service()` uses the same routine before the account API deletes the Auth user. Missing sessions return null during cascades. No trigger was disabled or narrowed. Existing deletion jobs, tombstones, frozen lineage, model quarantine and calibration invalidation remain in use. Historical partition lineage is intentionally retained after a previously valid subject is deleted.

## Exact revised activation sequence — requires new approval

Execute each artifact once as its own transaction, in this order, only after Astra accepts this correction and explicit hosted approval covers the revised sequence:

| Order | Exact artifact | SHA-256 |
| --- | --- | --- |
| 1 | [Consent correction](../../supabase/migrations/20261001015858_research_session_consent_boundary.sql) | `26df96999112f96e2afb72e291d5d63a5ee0546365ee6d30cf0ed91ebdbb011d` |
| 2 | [Unchanged frozen 07F](sol-client-07f/collector-upgrade.sql) | `ee45c20b673437deeab7728ce035530a58fd7eeacbdde063599e00dbba8c6fe6` |
| 3 | [Unchanged frozen 07G](sol-client-07g/retained-surface-delta.sql) | `6827663e43d47e6b40debff2625b1fa38377358736fd72e6f70cb593bb6f7162` |

The correction was generated with `supabase migration new`, not inserted into historical or frozen files. The reconciliation inventory now records 76 local migrations and 19 pending candidates. Its changed bookkeeping hash is intentional; it does not alter the frozen bundle or confer hosted approval. The migration checker passes, and an isolated unknown-migration negative check still fails. **Previous approval covers the original frozen scripts only, not this correction.** Recheck exact hashes, target and drift before any future execution; stop on error or preservation failure. No automatic retry, backfill reversal or production restore is authorized. Deployment remains a separate gate under activation-01's prepared request.

## Regression and actual-data rehearsal

[Focused SQL regression](../../tests/research-consent-boundary.sql) fails on the uncorrected retained baseline with `consent regression: no snapshot`, and passes after the correction, both before and after exact 07F/07G. It covers account-consented normal sessions (including retained=true captures), absent/null/invalid session consent, empty/unretained/mixed captures, legitimate research snapshots and outcome refresh, direct versus trigger calls, withdrawal, direct deletion and prevention of reconstruction, queued retained paths, tombstones, frozen membership preservation, quarantine/calibration invalidation and 07G account erasure. Fault injection and all SQL fixtures roll back; consent constraints were relaxed only inside that rollback test. Assertions were not weakened to accept the defect.

A fresh disposable PGDATA copy of the actual retained database ran **correction → exact 07F → exact 07G**, once each: three COMMITs, zero SQL errors. The original restored PGDATA was copied, not opened by these servers. PostgreSQL used network `none`, logging `none`, no TCP listener and scheduled jobs disabled. PostgREST ran only on container loopback; no Auth, Storage, email or provider service was started. Both owned containers were stopped and removed. Private copies and logs remain outside Git in the protected recovery directory's `consent-correction-rehearsal/`.

The unchanged aggregate assertions in [preservation.mjs](sol-release-activation-01/preservation.mjs) passed **104 original tables, zero differences**, again after all fixtures were cleaned up. Only optional container-name arguments were added. The existing exclusions remain additive columns, public `updated_at`, the approved `softwareMode` preference key and the new private attachment bucket; sequence state is not asserted.

| Retained facts | Before | Final |
| --- | ---: | ---: |
| Auth users / collection items / transactions / purchase lots / Storage objects | 2 / 14 / 16 / 14 / 2 | 2 / 14 / 16 / 14 / 2 |
| Research examples / physical-card partitions / pilot audit events | 0 / 0 / 52 | 0 / 0 / 52 |

Original ownership, financial fields and object metadata digests matched. All 83 resulting public tables have RLS; all four buckets are private. Only `refresh_training_example` changed among existing private function bodies; its owner, ACL, security-invoker status and search-path configuration stayed identical. Existing public-function differences are the frozen scripts' expected remap/report replacements. Hosted read-only schema fingerprints still match the retained baseline in all nine checked scopes. Original dump/globals hashes remain `ee02b240370b8d434d0b25643cf65390835657bce1e83b4da03acb521bbccc00` / `55af1abf787108051d573a1a3c7e4563eb7f8765f29a37dc87a55c302400fc4e`; prior non-atomic recovery/service-configuration limits remain.

## Interrupted compatibility checks completed locally

[Compatibility harness](sol-release-activation-01/deployed-compatibility.mjs) exercised the actual deployed commit `08854a6613b8cefdbe0c2e0a006f356bf8d56639`'s data module (module hash `e1f513bde869383cba55a10bdf90471938753d933c01ae8f443de256f4fc48e7`) through the installed Supabase client and real isolated PostgREST/PostgreSQL: **32 REST requests passed**. Checks cover raw/sealed/graded saves, a fresh-client reopen, owner isolation, native USD/EUR preservation, final-unit sale, ordinary corrections/profile reads and audited identity remap. The unchanged legacy final-unit sale retry returns `insufficient_quantity`; the test requires that error **and exactly one sale**, rather than claiming a successful legacy retry. The 07F graded-sale wrapper retry returns the same sale ID.

Candidate report helpers separately passed normal-session capture/report save, confirmation and replay preservation with account consent enabled and zero research examples. They are candidate compatibility evidence, not deployed-old-module coverage. JWT owners and the profile Auth identity lookup are synthetic fixtures; this does not prove a real fresh login, Storage upload, camera/native flow, live provider or browser release acceptance. No customer rows, identifiers, emails, credentials or capture payloads were published. Harness syntax checks passed.

Reproduce in an equivalently isolated restored copy: apply the three exact files above with `psql -X -v ON_ERROR_STOP=1`; run the SQL regression; run `node docs/evidence/sol-release-activation-01/deployed-compatibility.mjs` with the documented local loopback PostgREST setup; run `node docs/evidence/sol-release-activation-01/preservation.mjs mica-consent-baseline mica-consent-rehearsal`; run `npm run check:migrations`.

**Stop for Astra review. The correction and revised hosted sequence are prepared for approval, not executed.**
