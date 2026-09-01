# Mica Step 3 goal prompt

## Goal

Complete and verify the canonical collectible identity system without mutating
production.

## Context

- Steps 1 and 2 are complete.
- Read `docs/MICA_SOFTWARE_ROADMAP.md`,
  `docs/MICA_STEP3_IDENTITY_DESIGN.md`, and
  `docs/MICA_STEP3_ROLLBACK.md`.
- Local implementation and aggregate production preflight pass.
- Production still has the migration drift documented in Step 1.

## Required next action

Push `codex/mica-baseline-reconciliation` and let
`.github/workflows/supabase-identity-gate.yml` run the pinned Supabase CLI on a
disposable GitHub-hosted runner. It must apply the full migration history to
local PostgreSQL 17, run the read-only reconciliation report and database lint,
execute the transactional 47-assertion two-user integration test, reset to the
pre-Step 3 migration, reapply every migration, and repeat the integration test.

## Constraints

- Do not apply a migration to production.
- Do not deploy the client to production.
- Do not inspect private record contents.
- Do not add a paid service or dependency without approval.
- Preserve unresolved identities explicitly; never guess a variant.
- Keep manual/unresolved identities owner-scoped.
- Keep all correction and merge history append-only and reversible.

## Completion criteria

- Both migrations apply cleanly to isolated PostgreSQL 17.
- Every identity-bearing row has a non-null canonical identity.
- All parent/child identity mismatches, orphan counts, and merge cycles are zero.
- Owner isolation passes with two disposable accounts.
- Correction and merge reversal pass.
- Security and performance advisor results are recorded.
- Rollback/reset is rehearsed successfully.
- The disposable runner stops within 30 minutes and leaves no database running.

Stop before Step 4 unless every criterion passes.
