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
  merges, account deletion, explicit grants, and immutable audit history. The
  isolated CI gate executed all 47 assertions successfully twice.
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

## Isolated CI gate passed

The Supabase organization is on the Free plan. Hosted branching would require a
Pro subscription in addition to `$0.01344/hour`, so no branch was created and no
billing method was added. The public repository can instead use a free standard
GitHub-hosted runner, following Supabase's documented CI testing workflow.

`.github/workflows/supabase-identity-gate.yml` is bounded to 30 minutes, contains
no secrets or production reference, and permits reads only from the repository.
Its PostgreSQL connection is fixed to the disposable loopback database.

The successful evidence run is [GitHub Actions run 33458418252](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/33458418252),
job `99703240838`, at commit
`27c7d41f065ef90db813eccae12a39fff25887cf`. It ran from
`2026-09-01T01:21:32Z` to `2026-09-01T01:23:54Z` (2 minutes 22 seconds), well
inside the 30-minute limit, with Supabase CLI 2.116.0 and PostgreSQL 17.

The run proved:

- the complete migration history and both Step 3 migrations apply cleanly;
- all missing-reference, parent/child mismatch, orphan, merge-cycle, and invalid
  reversal counts are zero;
- all 47 two-owner pgTAP assertions pass;
- database lint contains no errors; it retains one pre-existing unused-variable
  warning and one non-blocking unused-parameter warning;
- reset to migration `20260819194052` removes the Step 3 identity registry;
- a clean reapplication succeeds and all 47 assertions pass again;
- local migration history records both Step 3 migrations; and
- the disposable database resources stop and are deleted successfully.

The rehearsal exposed and fixed a stale-snapshot bug in same-statement identity
resolution plus ambiguous sealed-provider mapping variables. No production
database, deployment, environment variable, billing method, or private record
was changed. Step 3's exit gate is complete.
