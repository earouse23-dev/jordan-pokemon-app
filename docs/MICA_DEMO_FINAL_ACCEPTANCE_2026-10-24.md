# Mica final demo acceptance — October 24, 2026

Scope: Elliott approved pricing correction handling, collector workflow verification, failure recovery, responsive layouts and a frozen release gate for Jordan's Safari demonstration. Public signup/email/legal facts, physical camera acceptance, commercial-scale qualification and App Store submission remain separate. No feature expansion, new service, paid plan, provider allowance increase, schema migration or customer inventory/settings write.

## 1. Pricing corrections

PkmnPrices documents separate ingestion and correction streams: [eBay listings](https://www.pkmnprices.com/docs/ebay-listings). The existing shared archive now polls updated_since in addition to since, within the same four-page/12-second bounded work and credit ledger. It retains an independent cursor, fixed poll boundary and completed watermark; short pages do not end pagination. Unexpired archives remain cached for 24 hours. Existing archive keys and retained pages are preserved.

Correction requests omit grade/printing filters so a sale moved to another grade is returned and excluded locally. Matching corrections replace prior amounts by provider sale ID; rejected regrades remove the formerly eligible sale. Ordinary conflicting ingestion rows still survive for the valuation layer's conflict checks. Persisted corrected IDs prevent retained old pages from resurrecting superseded rows. Primary price and daily median are recalculated from eligible evidence.

The owned-copy refresh endpoint now uses the same shared archive as detail/portfolio instead of a separate ten-row fetch. Correction metadata travels through server observations, portfolio publication and detail retention. Confirmed withdrawals may clear an invalid old price; delayed invalid/failed responses still preserve matching valid saved evidence. Old recorded valuation fallbacks cannot restore a corrected comp.

Limits: provider deletion tombstones are unavailable, and a sale moved entirely to another card only appears in the destination card's correction stream. This is not a claim that every historical sale or undisclosed source correction can be independently verified. Unknown older Best Offer amounts retain their optional provenance; no fabricated older prices.

Tests cover replacement, withdrawal, cursor retry after quota failure, short-page continuation, no same-day repeat, stale-page suppression, a server portfolio withdrawal, and browser invalid-response/cache/withdrawal handling. Live candidate sample passed Umbreon PSA 10, Blastoise PSA 9, Espeon CGC 8.5 and Blastoise BGS 9.5. All returned rows match requested grader/grade/currency, exact attribution and Unlimited edition checks. Sparse older CGC/BGS coverage remains stale rather than borrowing another grade. See [pricing sample](evidence/demo-final-2026-10-24/pricing-sample.json).

## 2. Real isolated-account collector workflow

Used only the approved demo account and public client credentials with normal owner authentication. Created independent graded copies; retried the same add key; edited notes; sold only the selected copy; retried the sale key; preserved its sibling; reopened with a fresh session; checked anonymous access denial. All passed. Four test-only records across the initial and final harness attempts were archived afterward; production read-only verification found zero unarchived acceptance records. The initial harness expected an empty anonymous result, but production denies table access with 42501; the harness was corrected to accept this stronger denial. No customer write or provider call was involved in this backend workflow check. See [workflow evidence](evidence/demo-final-2026-10-24/isolated-core-workflow.json).

Browser acceptance separately exercises the actual app's search/add/save/edit/copy/sale/reload flows, interrupted saves, stable operation IDs, account changes, rejected requests and preserved input. This distinguishes real backend persistence from fixture browser checks and does not claim a physical-photo scan took place.

## 3. Responsive verification

Expanded the existing complete-screen check to 320×640, 390×844, 768×1024, 1024×768, 1440×900 and 1920×1080 in both appearances across Chromium and WebKit. Library, add/search, settings and detail render without page overflow. Screenshots were visually reviewed at small-phone, tablet and desktop widths. Existing chart tests preserve wide responsive plots, selected ranges, median-only solid lines, original dated evidence and cached reopening.

The candidate read-only saved-dashboard harness also passed 375, 430, 1440, 1920 and 2560px layouts. Phone plots have 8px gutters; desktop plots grow with content width. Saved value, holdings and P/L render before held inventory reads and remain coherent after hydration. Mutation/provider paths deliberately blocked by that harness produce expected 503s; they are not claimed as successful live pricing or provider failures. See [layout evidence](evidence/demo-final-2026-10-24/staged-readonly-layouts.json).

## 4. Security and existing-service boundaries

A fresh production audit identified the October 23 update to [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), an oversized-collection validation resource-exhaustion issue. Updated the existing transitive Zod resolution to 4.6.6 through an npm override; no new dependency was introduced. Production dependency audit now reports zero vulnerabilities. Three pre-existing development-tool moderate findings remain outside the shipped production graph.

Read-only production metadata: zero public ordinary tables without RLS, zero public storage buckets. Existing Supabase advisories remain: deny-by-default service tables without client policies; 14 authenticated security-definer functions previously reviewed for owner/admin guards; and [leaked-password checking disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No broad grants or paid-plan changes were made. Anonymous test inventory reads were denied. This targeted review does not claim a new independent penetration test or public-scale certification.

## 5. Focus and continuation corrections found during final review

A source-candidate CI run needed a retry for manual set-filter focus. A deterministic new test reproduced the root cause without relying on timing: a sheet's delayed autofocus could focus its Close button after an explicitly focused filter was replaced by a loading state. The shared sheet helper now remembers explicit focus during that frame, so its delayed default cannot override it. The regression fails before the fix and passed 27 repeated Chromium/WebKit checks afterward.

Older recovery tests were updated to enter secondary price/attachment tools through the existing More options button, preserve keyboard/disclosure checks, and assert that sales are unavailable while a card is at a grading company. The upload-retry fixture now sets the same authenticated owner in both app state and its mocked auth response; production's account-change guard remains intact. The test no longer requires the removed, inaccurate claim that photos are never saved. Added detail-recovery coverage to WebKit. Twelve focused recovery checks passed.

A bounded history pass can finish ingestion with no next cursor while correction work is still pending. The portfolio service now respects hasMore as well as legacy cursor state, preserving the continuation flag and resuming same-day work instead of falsely declaring it complete. A server test covers same-day pending work followed by an authoritative comp withdrawal.

The responsive matrix is parameterized by screen size instead of putting all 48 screenshots into one 30-second test. UI assertions are unchanged. Forty-two repeated layout/provider-retry checks passed. A transient WebKit pointer-action timeout in the earlier combined suite did not reproduce across repeated focused retry checks; the final complete suite is required below rather than treating that failed run as acceptance.

A stronger final portfolio regression first proved the old $500 comp was included in the saved total, then exposed a second retention bug: publication kept that total after the underlying comp was authoritatively withdrawn. Publication now rebuilds from retained per-item facts when a correction withdraws a price, rather than treating it as a transient outage. The strengthened test failed before this fix and passed afterward; ordinary failure-retention tests still pass.

The withdrawal regression proves the saved $500 was included before removing it. A deterministic interruption check holds three active pricing jobs, withdraws their comp and aborts before a fourth card is visited; that untouched card keeps its $500 saved value. Both regressions failed against their respective old implementations and pass with the final source.

## 6. Saved-price hydration found in the live demo

Read-only canonical reopening exposed a legacy-record race after the first candidate was published: the provider ID had been enriched while edition/promo metadata was still unresolved. That hybrid key matched neither the original nor the fully resolved cache key, so the client ignored its valid saved price. The cache matcher now accepts only input/resolved values already present in the saved record; different cards, provider IDs, editions, graders, grades and currencies remain rejected. The inventory-change guard accepts this validated enrichment while retaining quantity, lot and transaction checks. Active detail selection follows the restored printing, so stale in-flight results cannot replace it.

The deterministic browser regression failed against the prior source and passes in Chromium/WebKit. It now also starts a portfolio refresh before opening the old slab: detail waits for that owner/session's saved pricing, restores the price/chart and makes zero sales requests. A brief loading state replaces false unavailable/no-history copy. Account/selection changes still cancel stale callbacks. Thirty repeated reopening/correction checks passed; 24 final targeted checks passed after the wait/repaint correction; skipped disposable-database cases are not counted as passes.

The actual Jordan record was reopened without changing inventory/settings: Unlimited PSA 10, $3,400, October 22 comp, visible median-only solid chart. Returning through Dashboard reuses the price immediately; cold reload briefly restores saved pricing. A final request-log window contained 16 requests, zero sales requests and zero failed requests. This is bounded observed evidence, not a general latency guarantee. See [published read-only check](evidence/demo-final-2026-10-24/published-readonly-check.json).

## 7. Publication and verification

Published to https://jordan-pokemon-app.vercel.app/ from source 63571afcf89508fc1df38e46d12aee0d38a122d0, deployment dpl_2vF9koXGp347451zWsEzEnCYowZL. Shell cache 124. Served app SHA-256 bf82812c8abff686962a88ae5086c3280dd07f9dce34d62d7ac35f023d3822f8 matches the reviewed prebuilt artifact. No cron, provider budget, database schema, hosting platform or customer inventory/settings changes. Git-triggered Vercel builds remain disabled; publication used the explicit 99-file source/9-function release artifact.

Final local unit suite: 595 passed, 3 skipped. Lint, syntax, schema, migration-baseline and release-routing checks passed. Final expanded workflow suite: 280 passed, 1 skipped. The [independent final-source beta gate](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/40068339091) passed: 595 unit checks, 397 core browser checks (11 environment-dependent cases skipped) and three large-inventory checks. No retries/flaky passes. Final expanded workflow suite separately passed 280 checks (one skipped).

Final candidate saved-data canary reused the same daily view on repeated refresh; read-only responsive harness preserved totals/holdings/P&L before and after held inventory reads. CLI elapsed times include CLI/network startup and do not establish instantaneous API latency. Phone/desktop screenshot checks used actual rendered layouts, with temporary viewport overrides reset afterward.

This qualifies the controlled Safari demonstration. Physical camera/device acceptance, public signup/email/legal facts, 100-account commercial load qualification, native signing and App Store submission remain separate owner-approved gates.

Published visual evidence: [phone layout](evidence/demo-final-2026-10-24/published-phone.png), [solid median chart](evidence/demo-final-2026-10-24/published-chart.png). [Local verification](evidence/demo-final-2026-10-24/local-verification.json) and [independent gate](evidence/demo-final-2026-10-24/independent-gate.json) retain source identities and scoped results.
