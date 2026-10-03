# Sol CLIENT-05F — indicative USD/EUR display conversion

**Prepared, not yet active.** Begin only after Elliott explicitly approves the scope below or sends an instruction explicitly approving and executing this packet. Astra's design review alone is not that approval. No repeat confirmation is needed once that approval is present.

## Approved-on-activation scope

Use `ponytail:ponytail` in **full mode**; read its installed SKILL.md first, report unavailable honestly, reuse existing implementation and make the smallest correct change. Read AGENTS.md, both roadmaps, `docs/evidence/SOL_CLIENT_PACKET_05E_REPORT.md` and `docs/evidence/ASTRA_CLIENT_PACKET_05E_REVIEW.md`. Preserve dirty work, existing data, security, accessibility, tests and approval gates. This becomes the sole active packet upon Elliott's explicit approval.

Implement the reviewed proposal: ECB daily XML, current indicative USD/EUR equivalents only, explicit toggle on the existing sold-derived estimate card, native-only default on detail entry. Native USD/EUR sale evidence selection remains separate. No new paid service, key, production dependency or schema.

## Required implementation

- Fixed-source read-only `/api/fx`, no caller-provided upstream URL or arbitrary currency/date. Reuse existing API/error/cache patterns. Five-second timeout, no redirects, bounded streamed response (16 KiB), expected XML content and full supported structure validation. Reject DTD/entity declarations, malformed/ambiguous/duplicate date or USD records/attributes, invalid numeric/date/future data and unexpected structures. Accept harmless formatting/attribute-order differences. No partial regex match treated as complete valid XML and no general XML framework.
- Validated rate record and conversion provenance exactly as proposed: EUR base, USD per EUR, effective date distinct from UTC fetch time, source URL, content hash and rate reference. Convert USD→EUR by division and EUR→USD by multiplication. Same-currency identity needs no fetch. Keep source and conversion amounts unrounded until display; no source amount mutation or round-trip from a formatted equivalent.
- One-hour public successful-response cache, original fetch time preserved; errors no-store. Rates 0–4 UTC calendar days old may support a dated indicative equivalent; age 5+ suppresses it. Reevaluate expiry while the view stays open, including UTC date rollover, without request loops. A failed refresh preserves the native estimate and last validated rate for diagnostic provenance but does not display a fresh equivalent from that failed attempt.
- Add the small explicit equivalent toggle and loading/error/stale/retry behavior on the existing estimate card. Preserve native estimate, currency, source IDs and confidence. Disclose original market and ECB date/source in concise optional details. Source link opens normally outside a frame. No provider-price refetch on FX toggle/retry; no conversion for missing/unresolved/insufficient estimates; no extra contributors from converting mixed sale rows. FX must not improve sale confidence/freshness.
- Reuse owner/session/selection/context request guards. Use a stable native-result identity as clarified in Astra's review, not a newly generated evaluation timestamp on every render. Prevent stale requests from restoring a disabled toggle or updating another copy/account/context. Genuine native evidence refresh pairs the new native estimate with an explicit rate snapshot atomically.
- No inventory/profile/transaction writes, no persisted converted amounts, no historical buy/sell conversion and no valuation/identity policy changes. Keep provider market indexes separate and certificate modules excluded from shipping.

## Verification and evidence

Implement hand-calculated synthetic cases from CLIENT-05E: conversion directions, identity, rounding, missing/sparse estimates, UTC/weekend/holiday age boundaries, malformed/hostile/oversize/duplicate/future rates, timeout/redirect/fetch failures, cache expiry and provenance pairing. Include a view kept open across UTC midnight and an unrelated rerender while FX is pending; neither may leave an expired equivalent or start a loop.

Test the actual route with a local transport stub and actual estimate UI across desktop Chromium, mobile Chromium and mobile WebKit. Check rapid toggle/currency/copy/account/route changes, native-result refresh and no writes/no sales refetch. Block real outbound provider/ECB traffic in tests. Existing source schema evidence is enough for this implementation packet; no fresh live provider or ECB probe is required or authorized by the test plan.

Run affected pricing/FX/API tests, relevant browser suites, lint, typecheck, full unit suite, build, shipping certificate exclusion and scoped formatting/diff checks. Include new source files in existing lint/typecheck/build mechanisms as necessary. Do not alter unrelated formatting or reset/stash dirty work.

Write `docs/evidence/SOL_CLIENT_PACKET_05F_REPORT.md` with the explicit approval source, changed files, actual conversion/provenance examples, tests/counts/skips, source attribution, screenshots, and all remaining gates. Mark synthetic valuation/rate evidence as synthetic. A successful FX implementation does not validate a real sale estimate or resolve provider retention/display rights.

No deployment, commit, new dependency/service, hosted mutation, migration, paid-provider call, scanner work, certificate activation or CLIENT-06. Stop for Astra review.
