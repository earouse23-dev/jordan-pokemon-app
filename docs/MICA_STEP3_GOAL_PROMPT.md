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

Create or connect an isolated Supabase staging branch after Elliott explicitly
approves its cost. Apply the two Step 3 migrations there only. Run the read-only
reconciliation report, Supabase advisors, and two-user integration checks.

## Constraints

- Do not apply a migration to production.
- Do not deploy the client to production.
- Do not inspect private record contents.
- Do not add a paid service or dependency without approval.
- Preserve unresolved identities explicitly; never guess a variant.
- Keep manual/unresolved identities owner-scoped.
- Keep all correction and merge history append-only and reversible.

## Completion criteria

- Both migrations apply cleanly to isolated staging.
- Every identity-bearing row has a non-null canonical identity.
- All parent/child identity mismatches, orphan counts, and merge cycles are zero.
- Owner isolation passes with two disposable accounts.
- Correction and merge reversal pass.
- Security and performance advisor results are recorded.
- Rollback/reset is rehearsed successfully.

Stop before Step 4 unless every criterion passes.
