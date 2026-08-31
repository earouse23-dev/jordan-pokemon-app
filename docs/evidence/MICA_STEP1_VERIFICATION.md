# Mica Step 1 verification record

**Verified:** 2026-08-31  
**Branch:** `codex/mica-baseline-reconciliation`  
**Starting commit:** `6245f8aa7ddb76e0fedd2870ef7ec2f0aa932f1a`

This record closes the read-only audit gate in Step 1 of
`docs/MICA_SOFTWARE_ROADMAP.md`. It records observations and audit artifacts;
it does not certify the later authenticated release gate.

## Repository verification

`npm run release:check` passed in the reconciled working tree:

- 59 source files passed lint.
- JavaScript syntax/type checks passed.
- 279 deterministic tests passed.
- The schema validator found 56 public tables and an RLS declaration for every
  table.
- The migration-baseline check verified 64 local files, 58 production-history
  rows, seven approved pending migrations, and 51 recorded version mismatches.
- The production build completed.
- The 22-file preview artifact matched its recorded baseline.
- All 26 desktop/mobile Chromium regression tests passed.

Additional checks:

- `npm audit --omit=dev`: zero known production-dependency vulnerabilities.
- `git diff --check`: passed.
- Prettier check for the Step 1 Markdown artifacts: passed after formatting.
- All 22 files in `MICA_STEP1_VISUAL_EVIDENCE.md` matched their recorded
  SHA-256 digests.

## Public production observations

Read-only public requests on 2026-08-31 produced:

| Request                                         | Result | Meaning                                                                                                  |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| `/`                                             | 200    | Public shell available.                                                                                  |
| `/profile`                                      | 404    | Direct profile load/refresh is broken in the deployed build.                                             |
| `/api/health`                                   | 200    | Shallow configured-service health check passed.                                                          |
| `/api/capabilities`                             | 200    | Catalog is active; paid pricing capabilities report `upgrade_required`; push reports `development_only`. |
| Exact catalog query for Mew ex 151/165, English | 200    | Public exact catalog path returned candidates and retained confirmation.                                 |
| Sealed search for Charizard, English            | 403    | Production provider plan does not support the visible sealed workflow.                                   |

Single-request timings are recorded in
`docs/MICA_STEP1_COMPLETION_APPENDIX.md`; they are connectivity samples, not
latency percentiles.

## Connected service metadata

Read-only Supabase metadata inspection listed 56 public and 12
`grading_private` tables with RLS enabled. Policy definitions for owner-bound
private Storage were inspected. These findings do not replace runtime two-user
isolation tests.

Vercel deployment metadata and public asset hashes showed that production
matches neither its reported Git commit nor the reconciled preview artifact.
No deployment was promoted or changed.

## Mutation boundary

Step 1 made no production database write, Auth mutation, Storage mutation,
migration application, provider purchase/call that consumes a paid benchmark,
configuration change, or deployment. Repository changes are limited to audit
documentation, before-state images, preservation/reproducibility records, and
the concise roadmap instruction.

## Unverified by design

Real authentication, persistence/reload, two-user isolation, deletion,
provider/model behavior, physical cameras/devices, screen readers, migration
rehearsal, backup/restore, and rollback remain unverified. They are named as
dependencies for later implementation and release steps rather than counted as
passes.

## Exit-gate conclusion

Step 1 passes because every visible feature now has an owner/code path, data
dependency, status, and verification result; production data was not changed;
and critical broken or misleading flows are ranked before feature work. The
authoritative detail is in `docs/MICA_STEP1_COMPLETION_APPENDIX.md`.
