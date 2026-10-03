# Sol Packet 02 revision — owner-safe draft restoration

Astra decision: **REVISE**. Read `docs/evidence/ASTRA_PACKET_02_REVIEW.md`. Fix only the restoration boundary and related tests. Preserve passing continuity paths, accepted layout, current pricing safeguards, and unrelated work.

## Required correction

Persist the originating authenticated user ID with private interrupted Add/Watch drafts and require an exact active-owner match before reopening them. Reject/clear mismatched, expired, malformed, and legacy private drafts without an owner. Do not display or submit A's data in B's session. Anonymous public catalog selections must remain distinct from private authenticated drafts.

Same-owner recovery should still restore identity, research context, entered values and the existing idempotency key. No sign-in or restoration action may write a collection/watch record automatically. An explicit sign-out must not leak the previous user's draft to the next user.

## Acceptance evidence

- Account A → session loss → account A: exact Add and Watch drafts restored, no writes, retry retains idempotency.
- Account A → session loss/sign-out → account B: A's card snapshot, purchase values and private notes never appear in B's UI; no write occurs; stale draft cannot reappear later under B.
- Missing/legacy owner, expired and malformed storage: no restoration or crash; follow the documented discard policy.
- Use mocked account-loading responses with the real `applySession` initialization path, not only direct state assignment plus the restoration helper. Assert both same-owner and different-owner behavior after account loading completes.
- Cover the initializer's onboarding branch: if onboarding must appear, retain the authorized same-owner draft until it can be resumed; do not let an unrelated sheet silently erase it. No new tutorial or confirmation screen is needed.
- Retain existing Packet 02 continuity and Packet 01 raw/graded regression checks.

## Return

Update `docs/evidence/SOL_PACKET_02_REPORT.md` with the owner-isolation policy, changed files, exact tests/results, and actual-session-path evidence. Correct any overbroad currency claim: EUR Watch evidence is supported by these tests; USD-only acquisition remains an existing limitation. Run checks proportionate to the change. Do not start Packet 03, expand providers/currencies, deploy, or change dependencies/migrations. Stop for Astra review.
