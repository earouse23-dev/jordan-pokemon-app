# Mica Step 4 goal prompt

Status: PkmnPrices Pro approved — implementation and verification in progress

## Goal

Build transparent pricing and valuation infrastructure so every displayed value
explains its source, market, condition, freshness, comparable evidence, and
confidence.

## Context

- Steps 1 through 3 are complete.
- Read `docs/MICA_SOFTWARE_ROADMAP.md`, the Step 1 audit, the Step 2 competitor
  benchmark, and `docs/evidence/MICA_STEP3_VERIFICATION.md`.
- The provider-neutral collectible identity contract is the only valid join key
  for new pricing work.
- Existing production migration drift remains unresolved; do not deploy or
  mutate production.

## Required first action

Perform a read-only audit of current pricing providers, entitlements, licensing
constraints, markets, currencies, freshness, rate limits, caching, scheduled
updates, normalization, failure behavior, and every user-visible valuation.
Verify time-sensitive provider facts against official sources. Do not make paid
provider calls.

Prepare a provider architecture decision with explicit cost, licensing,
coverage, reliability, and implementation tradeoffs. Elliott approved
PkmnPrices Pro on 2026-08-31. Treat the real key response as authoritative even
when a configured plan label says Pro.

Audit result: `docs/MICA_STEP4_PROVIDER_AUDIT.md`

## Constraints

- Do not purchase, upgrade, subscribe to, or connect a service without approval.
- Do not add or rotate credentials.
- Do not call a paid endpoint for benchmarking without approval.
- Do not apply production migrations or deploy a production client.
- Never mix asking prices with completed sales.
- Never mix raw and graded values, conditions, grades, languages, variants,
  markets, or currencies.
- Missing, stale, unsupported, and zero values must remain distinct.
- Provider failure must never mutate ownership or cost-basis data.

## Completion criteria

- Every displayed value has provenance.
- Missing and unsupported values remain visibly different from zero.
- Outlier rules pass a human-reviewed benchmark.
- Portfolio totals show coverage and confidence.
- Provider failure cannot corrupt stored ownership data.
- Provider costs, licenses, initial markets, and currencies are explicitly
  approved before any dependent implementation.
