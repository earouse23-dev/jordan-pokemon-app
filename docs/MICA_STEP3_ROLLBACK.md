# Mica Step 3 rollback and recovery

Status: ready for isolated staging rehearsal
Production use: not approved

## Safety rule

Do not apply these migrations directly to production. First rehearse them on an
isolated Supabase branch created from the current production schema. Do not
enable the new client build until the post-migration reconciliation report is
clean.

## Before migration

1. Record the branch ID, parent project, migration history, and schema advisor
   results.
2. Confirm the branch contains no production user data.
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
5. Exercise creation, correction, reversal, merge, merge reversal, watchlist,
   pricing, and grading-lineage writes with two disposable users.

Any migration error stops the rehearsal. Do not repair partial state manually.
Reset or delete only the disposable branch and start again from the recorded
baseline.

## Application rollback

The safe application rollback is to redeploy the previous known-good build.
The added tables and columns may remain dormant; they do not replace the legacy
columns or delete historical data. This avoids a destructive down migration
during an incident.

## Database rollback

For a disposable branch, reset the branch to the migration immediately before
`canonical_collectible_identity`, or delete and recreate the branch.

For production, do not drop identity tables, columns, correction history, or
merge events during incident response. First disable the new client, preserve
an export, verify all references, and obtain separate approval for a reviewed
down migration. No destructive production down migration is included in Step 3.

## Recovery checks

After rollback or branch reset:

- the previous app build loads;
- existing collection, transactions, prices, and grading reports remain
  readable;
- no production migration-history row was added;
- no production deployment or environment variable changed;
- the disposable branch can be recreated from the same baseline.
