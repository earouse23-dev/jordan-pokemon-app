# Mica Step 3 verification evidence

Date: 2026-08-31
Branch: `codex/mica-baseline-reconciliation`
Production mutation: none

## Local checks passed

- Complete `npm run release:check` passed in one run on 2026-08-31.
- JavaScript syntax/type checks.
- 294/294 unit, domain, provider, grading, security, and identity tests.
- Identity benchmark: 8/8 expected outcomes, zero silent substitutions, 100%
  confirmation coverage.
- Identity migration contract verification.
- The staging-only database suite parses as PostgreSQL and contains 47
  transaction-wrapped assertions for two-owner RLS, corrections, reversals,
  merges, account deletion, explicit grants, and immutable audit history. Its
  execution remains part of the isolated-CI gate.
- PostgreSQL parse of both migrations and the read-only reconciliation script
  with `pglast`.
- Schema validation: 64 public tables, all with RLS declarations.
- Migration baseline: 66 local migrations, 9 explicitly pending, and the 51
  previously recorded timestamp mismatches unchanged.
- Configuration-neutral preview: all 22 files match the updated recorded
  hashes; the service-worker shell and app asset versions were advanced.
- 28/28 desktop/mobile Chromium checks, including the exact-version selector.
- Local browser verification: meaningful signed-out page, no error overlay, no
  browser errors, and expected interactive controls.
- `git diff --check`.

## Aggregate production preflight

Queries ran inside read-only transactions and returned counts only. No card
names, user details, images, notes, transactions, or private storage objects were
opened.

| Record group          | Rows | Safe migration path | Invalid links |
| --------------------- | ---: | ------------------: | ------------: |
| Collection items      |   14 |                  14 |             0 |
| Watchlist             |    4 |                   4 |             0 |
| Price products        |    0 |                   0 |             0 |
| Price observations    |    0 |                   0 |             0 |
| Provider mappings     |    0 |                   0 |             0 |
| Collection dependents |   63 |                  63 |             0 |
| Grading lineage       |   38 |                  38 |             0 |

All measured orphan counts were zero for collection transactions, purchase
lots, position prices, owned copies, legacy purchases and sales, digital grades,
grading submissions, physical grading cards, scan sessions, captures,
predictions, and outcomes.

## Privacy and security controls

- Shared catalog identities contain no user snapshots.
- Manual sealed and unresolved identities are owner-scoped by RLS.
- Admin authority uses protected `app_metadata`, never user-editable metadata.
- Privileged functions pin an empty search path and revoke default execution.
- Client roles cannot directly append correction or merge history.
- Provider identifiers remain mappings rather than primary identities.
- Deferred identity references preserve shared rows while allowing complete
  owner-account deletion; audit actor references cannot block deletion.

## Browser verification influence

Interactive verification caught an initial test setup that attempted to use an
authenticated-only search binding without a real session. The test was corrected
to invoke the add-card surface directly; it now proves the stable variant UUID,
two-option selector, confirmation copy, and hidden submitted value on desktop
and mobile.

## Remaining gate

The Supabase organization is on the Free plan. Hosted branching would require a
Pro subscription in addition to `$0.01344/hour`, so no branch was created and no
billing method was added. The public repository can instead use a free standard
GitHub-hosted runner, following Supabase's documented CI testing workflow.

`.github/workflows/supabase-identity-gate.yml` is bounded to 30 minutes, contains
no secrets or production reference, permits reads only from the repository, and
uses only `--local` database operations. It applies the migrations, runs the 47
assertions and database lint, resets to the pre-Step 3 schema, reapplies from a
clean database, repeats the assertions, and deletes the database volume. The
workflow run is the remaining gate. Step 3 stays incomplete until it passes.
