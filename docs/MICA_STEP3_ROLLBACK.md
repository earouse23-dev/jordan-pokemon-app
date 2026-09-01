# Mica Step 3 rollback and recovery

Status: isolated CI rollback rehearsed successfully
Production use: not approved

## Safety rule

Do not apply these migrations directly to production. First rehearse them with
the pinned Supabase CLI and local PostgreSQL 17 on a fresh GitHub-hosted runner.
The repository is public, so a standard runner is free and avoids both a paid
Supabase Pro upgrade and local container installation. Do not enable the new
client build until the post-migration reconciliation report is clean.

## Before migration

1. Record the commit SHA, workflow-run ID, migration history, and local database
   advisor results.
2. Confirm the workflow has no production credentials, project reference, or
   `--linked` operation.
3. Run the aggregate preflight queries recorded in
   `docs/evidence/MICA_STEP3_VERIFICATION.md`.
4. Confirm a previous application build remains available.
5. Do not change production environment variables or deployment aliases.

## Migration rehearsal

1. Apply the foundation migration.
2. Apply the runtime/trigger migration.
3. Run `supabase/identity-reconciliation-dry-run.sql` in a read-only
   transaction.
4. Run the Supabase security and performance advisors.
5. Run `supabase/tests/database/canonical_identity.test.sql`. Its 47
   transactional assertions exercise two-owner RLS, creation, correction,
   reversal, merge, merge reversal, watchlist identity, dependent-ledger
   propagation, account deletion, grants, and audit immutability. The script
   rolls every fixture back.

6. Reset to migration `20260819194052`, prove that the Step 3 registry is absent,
   reapply all migrations, and repeat the 47 assertions.

Any migration error stops the rehearsal. Do not repair partial state manually.
The job has a 30-minute timeout and always deletes its local database volume.
The hosted runner is destroyed after the job.

## Application rollback

The safe application rollback is to redeploy the previous known-good build.
The added tables and columns may remain dormant; they do not replace the legacy
columns or delete historical data. This avoids a destructive down migration
during an incident.

## Database rollback

For an isolated CI rehearsal, reset to `20260819194052`, then recreate the
database from the complete migration history. The workflow automates both
directions before deleting its volume.

For production, do not drop identity tables, columns, correction history, or
merge events during incident response. First disable the new client, preserve
an export, verify all references, and obtain separate approval for a reviewed
down migration. No destructive production down migration is included in Step 3.

## Recovery checks

After rollback or CI reset:

- the previous app build loads;
- existing collection, transactions, prices, and grading reports remain
  readable;
- no production migration-history row was added;
- no production deployment or environment variable changed;
- the disposable database can be recreated from the same commit and migration
  baseline.
