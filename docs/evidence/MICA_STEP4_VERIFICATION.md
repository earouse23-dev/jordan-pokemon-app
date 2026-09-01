# Mica Step 4 verification

Status: implementation complete; external approval gates remain

Checked: 2026-08-31

## Locked provider decision

- PkmnPrices Pro is Mica's approved primary pricing tier.
- The account owner purchases Pro and supplies the key outside Git and chat.
- A configured `pro` label requests the Pro scope but never proves an
  entitlement. Each live endpoint response remains authoritative.
- TCGdex remains the attributed public catalog/raw fallback.
- JustTCG remains disabled unless a separate commercial license is approved.
- USD/TCGplayer and EUR/Cardmarket evidence remain separate. The portfolio
  headline is USD-only until an FX source receives separate approval.

## Implemented

- One centralized freshness policy distinguishes current market indices,
  completed sales, active asks, undated evidence, and owner overrides.
- Every normalized price carries aggregator, underlying market, currency,
  context, source time, retrieval time, attribution, and explicit capability
  state.
- Stale, missing, unsupported, rate-limited, provider-error, manual, and
  other-currency values are excluded or reported separately instead of becoming
  zero.
- The collection dashboard reports automatic coverage and strong, moderate,
  limited, manual, and excluded units. Stale evidence is reference-only and does
  not enter current value or profit.
- Comparable outliers are flagged for review by a versioned median/MAD rule;
  they are never silently deleted or excluded. Completed-sale rows expose the
  review warning.
- The additive database migration extends shared and private observations,
  anomaly review, provenance, runtime entitlement snapshots, and RLS tests.
- The price scheduler atomically reserves a conservative daily returned-item
  allowance in PostgreSQL. Pro permits at most 25 full-history identity groups
  per UTC day under the 20,000-credit budget. Repeated and concurrent runs share
  the same reservation.
- Provider configuration is shown as unverified until a real feature request
  succeeds. JustTCG requires an explicit commercial-license switch.

## Automated evidence

- Canonical Node 24 `npm run release:check`: passed.
- Unit, security, provider, domain, grading, and identity tests: 303 passed.
- Desktop/mobile Chromium UI regression tests: 28 passed.
- Pricing outlier benchmark: 8/8 expected outcomes passed; owner review remains
  pending.
- Disposable local Supabase PostgreSQL 17 verification: all 67 repository
  migrations applied cleanly; the transparent-pricing pgTAP suite passed 32/32,
  and the complete database suite passed 79/79 across two files.
- Local database lint completed without an error-level finding. It reported two
  warning-level unused-code findings in older identity/grading functions; neither
  is introduced by Step 4.
- Static pricing-migration verifier: passed, including additive schema,
  constraints, indexes, owner isolation, service-only atomic credit reservation,
  and transactional pgTAP coverage.
- Schema validator: 64 public tables, all with RLS declarations.
- Migration baseline: 67 local files, 58 production history rows, 10 approved
  pending migrations, and 51 recorded version mismatches.
- Reproducible neutral preview: 22/22 files matched the updated hash baseline.
- Manual local browser gut check: meaningful sign-in content, no error overlay,
  no captured console errors, and expected accessible controls.
- `git diff --check`: passed.

## Verification limitations

- No provider subscription, key, paid/quota-consuming request, production
  migration, deployment, or production record mutation occurred.
- The database proof used checksum-verified, user-local Lima, Colima, and Docker
  CLI tooling. The explicitly disposable `mica-step4` VM, containers, volumes,
  and test records were stopped and deleted immediately after verification. No
  `sudo`, Homebrew ownership change, or metered cloud branch was used.
- The linked remote migration dry run stopped before applying anything because
  the already-recorded production/local migration history differs.
- Live Pro entitlements remain unverified until the account owner connects the
  Pro key in an isolated environment.

## Approval gates

Step 4 closes only after the two remaining external gates pass:

1. Elliott approves or revises the eight human-readable outlier benchmark cases
   in `tests/fixtures/pricing-outlier-benchmark.json`.
2. **Passed 2026-08-31:** the additive migration applied and all 32 pricing
   pgTAP assertions passed in a disposable local Supabase environment.
3. The connected PkmnPrices Pro key proves the required current, history,
   graded, sealed, EUR/Cardmarket, marketplace-offer, eBay-sold, Japanese, and
   German capabilities without a production deployment.

Do not begin Step 5 until these gates are recorded as passed or Elliott
explicitly changes the gate.
