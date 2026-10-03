# SOL release recovery 01 — local export and isolated restore

**Status for Astra review:** The approved read-only database/Auth and Storage-byte recovery set was exported to Elliott's FileVault-protected Mac and restored locally. The restore checks below passed. This is not proof of one atomic database/Storage point in time, a configured Supabase service restore, or release readiness. Hosted SQL and deployment remain separate approvals.

## Authority and source

- Source: existing Supabase project `kdkzdflrxajfdcithrfj` (`jordan-pokemon-app`), PostgreSQL 17.6. Elliott approved one reset of its existing `postgres` database password for this recovery task. He completed the dashboard step and entered the new password in a hidden Mac prompt. A TLS-required session-pooler connection then succeeded. The initial `aws-0` pooler attempt returned `tenant/user not found`; the dashboard's actual `aws-1-us-west-2` host worked. That first error did not establish a password failure.
- The password was never placed in chat, a URL, process arguments, logs, or a repository/environment file. A mode-`0600` libpq passfile on the protected destination was used for `pg_dump`/`pg_dumpall` and then deleted. Elliott retains the new password in his password manager. The password reset was the only authorized hosted setting change; there was no hosted data write, migration, deployment, write pause, credential-role creation, or provider call.
- Before export, FileVault and the Data volume's encrypted state were verified. The recovery directory and subdirectories are mode `0700`, and retained dump, manifest and log files are mode `0600`. Private bytes, logs and the stopped restore data directory are outside Git at `/Users/elliottrouse/Mica Recovery/20260930T014818Z-kdkzdflrxajfdcithrfj/`. The local Docker image and `pg_dump` are PostgreSQL 17.6. No shared `mica-dev` container or data was changed.

## Retained artifacts and checksums

| Protected path under the recovery directory | Coverage | SHA-256 |
| --- | --- | --- |
| `database/postgres.dump` | 30,921,337-byte custom-format full database archive, completed 2026-09-30 15:01 UTC | `ee02b240370b8d434d0b25643cf65390835657bce1e83b4da03acb521bbccc00` |
| `database/globals.sql` | 5,801-byte roles/globals export with role passwords omitted | `55af1abf787108051d573a1a3c7e4563eb7f8765f29a37dc87a55c302400fc4e` |
| `database/toc.txt` | Archive table of contents, 1,447 entries including 109 table-data entries | `873ae34a8d9cc6fa8436202efa6cbfe48eab3e5c39b5f96bc0046ce3b91b33e1` |
| `metadata/storage-manifest.json` | Original private per-object path, byte size and SHA-256 manifest | `90460a1ddba71412bc4022be7fecc4417209caa1c31af4eeb38e84bc50975ca7` |
| `metadata/verification-summary.json` | Original redacted Storage verification | `142debe623b4c6c40166a619383ad02204136afd6f372440f89cf48a0bbf29f6` |
| `metadata/database-restore-summary.json` | New redacted database and restore verification | `ec417c1d81f628cbbf4970c0cc4b6176b4b396648fe841e19c56929b56a2c3b6` |

The original Storage export contains all 2 objects in the project's 3 private buckets, totaling 134,532 bytes. Both retained files were read back and their SHA-256 values matched the private manifest. The hosted ordered path/size and path/eTag digests still matched the retained bytes after the database export: `f2dc77300bf159717564960f23595164` and `de2acb3e9aebacc59b9c7ebbabfbbb5a`. The restored `storage.objects` metadata produced those same digests. Each restored metadata path was joined to its protected local object file; size, SHA-256 and source eTag/file-MD5 matched for both objects. No private object name or byte payload appears here.

## Database and isolated restore proof

The archive includes all 27 `auth` tables, 8 `storage` tables, 56 `public` tables, 12 `grading_private` tables and the migration-history table, with their table-data entries. It also includes policies, functions and extensions. `pg_dump` and `pg_dumpall` exited zero with empty export logs. The custom archive provides one database snapshot; it does not make Storage atomic with that snapshot.

The restore ran in a uniquely named PostgreSQL container with Docker network mode `none`, no container logging, no TCP listener, and `cron.launch_active_jobs=off`. No Auth, Storage, email or external provider service was started. The `pg_net` extension was preloaded to restore its schema, but the container's disabled network prevented outbound webhook/provider traffic. Role definitions were loaded locally without passwords. The unmodified globals script logged 21 local-role/grantor errors: the fresh cluster already had `postgres`, and its `GRANTED BY supabase_admin` clauses could not be replayed by that grantor. A local-only copy of the 19 membership grants without grantor attribution then applied successfully. The database archive restored with `--single-transaction --exit-on-error` and zero errors in 7.8 seconds. The local role/grantor normalization is a recovery procedure limitation; the original export remains intact.

| Check | Hosted aggregate | Restored local result |
| --- | ---: | ---: |
| Auth users | 2 | 2 |
| Migration-history rows | 58 | 58 |
| Storage buckets / objects / bytes | 3 / 2 / 134,532 | 3 / 2 / 134,532 |
| Relevant application/Auth/Storage tables | 104 | 104 |
| Policies / functions / public RLS tables | 66 / 83 / 56 | 66 / 83 / 56 |

The hosted and restored Auth-row digest matched (`faf95c55a5d29f2e179865f7954c9ccb`); the migration-history digest matched (`1ec29ed49cd27e6d50af5a8a414b1a6c`). These are aggregate comparisons; no customer row, identifier, password hash or session was printed. A local transaction created two **synthetic** Auth owners and one collection for each. Under the `authenticated` role, owner A saw 1 synthetic collection, owner B saw 1, and an unrelated synthetic identity saw 0. The transaction rolled back; the restored Auth and collection row counts returned to 2 and 2. No real customer authenticated or was impersonated.

The restore container was stopped and removed. Its encrypted-at-rest, mode-`0700` data directory remains under `restore/pgdata/` for Elliott's recovery review: 1,690 files, 379,772,470 bytes, tree SHA-256 `53710ad8631e3b155d8a7b15ca8dcc54428cae706826709900b802fdddcf950d`. The synthetic-only initialization directory was removed. The temporary password passfile is absent. No off-site copy was made.

## Limits and next approval boundary

- Storage bytes were captured around 01:50–01:59 UTC and the database archive around 15:01 UTC on 2026-09-30. Repeated hosted inventory and byte-hash checks found no observed Storage drift, but there was no hosted write pause; a single cross-service atomic recovery point is **unproved**. A write pause would require separate approval. Public application rows could also have changed between independent observations.
- Auth tables and password hashes are in the protected database archive, but a configured local Auth service, real-user sign-in, OAuth/SMTP settings, API keys, project encryption/Vault root keys, and a Storage API restore were not tested or captured. The role export intentionally excludes login passwords. Vault ciphertext may need the original project encryption root to become usable. These configuration/secret dependencies must be supplied through a separately approved secure path for a full service recovery. FileVault protects the local set while the volume is locked; it is not an independently encrypted off-site copy.
- The password reset can affect dormant direct/pooler clients using the old password. Repository and Vercel configuration-name inspection found no direct DSN consumer, and current read-only Supabase metadata/API queries succeeded, but that cannot rule out unknown external clients. If one breaks, stop old-password retries and repair that client's configuration through its own approved path. The old password is unavailable.
- This local evidence is not native/backend activation, physical-device, live-provider, subscription, or public-release proof.

**Concrete next hosted-activation request, after Astra accepts this report:** Approve the exact, data-preserving hosted SQL sequence for project `kdkzdflrxajfdcithrfj`: first [07F collector-upgrade.sql](sol-client-07f/collector-upgrade.sql) SHA-256 `ee45c20b673437deeab7728ce035530a58fd7eeacbdde063599e00dbba8c6fe6`, then [07G retained-surface-delta.sql](sol-client-07g/retained-surface-delta.sql) SHA-256 `6827663e43d47e6b40debff2625b1fa38377358736fd72e6f70cb593bb6f7162`. Before execution, Astra and Elliott must either accept the documented non-atomic cross-service recovery limit or separately approve a bounded write pause and recapture. Re-read the then-current hosted schema/migration history and assess existing-record backfill effects against the retained archive; abort the transaction on error. A successful data backfill has no promised automatic reversal. Separately review the disable/rollback procedure and request **later deployment approval** for the curated [07G release ZIP](sol-client-07g/release-snapshot.zip) SHA-256 `391b748260cf17124cded8dc18960b23b8e020af3f178aa899d0f84d3dd33b47` and [manifest](sol-client-07g/release-manifest.json) SHA-256 `4e1710477b1af0846532cf906315f3f48b81878857b6b0d7c729f9970614dc58`. No SQL or deployment approval is inferred from this recovery work.

Stop for Astra review.
