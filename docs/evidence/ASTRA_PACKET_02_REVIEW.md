# Astra review — Packet 02

Date: 2026-09-17. Decision: **REVISE**. Do not begin sold-history work.

## Review evidence

Read Sol's report; inspected draft capture/restoration, session application, and restoration tests; viewed graded EUR Watch and Add-prefill mobile screenshots. Current app, pricing and stylesheet hashes match the reported final anchors. The accepted pricing and stylesheet files remain unchanged.

Sol reports 397 unit tests and 106 affected browser cases passing, plus the recorded checks. Astra did not independently rerun those suites. Browser fallback to repository Playwright is not a reason to reject this packet; the remaining issue is application behavior.

## P2-R1 — High: interrupted private drafts are not bound to their owner

Locations: `app.js` functions `savePendingProfileAction`, `capturePendingProfileAction`, `pendingProfileAction`, `restorePendingProfileAction`, and `applySession`.

The shared `mica:pending-profile-action` session-storage entry contains the card, purchase facts or watch notes, but no source account ID. `applySession(null)` captures an authenticated user's open form. The next successful account load invokes `restorePendingProfileAction` without comparing the new account against the draft's owner.

Consequently, A → signed out → B in the same tab can reopen A's private draft in B's session. A watch absent from B's list can become a new-watch form populated with A's notes. There is no automatic write, but disclosure has already occurred and explicit save would target B. A 24-hour expiration does not prevent this.

Astra independently evaluated the actual current `restorePendingProfileAction` function in an isolated JavaScript context with synthetic fixtures: active user B and a pending watch containing `Account A private draft note`. Observed the watch-sheet callback receiving that note under B. This is a function-level reproduction plus source trace, not a live authenticated browser run. No private user data was accessed.

The new browser tests call `applySession(null)`, then manually assign `state.session` and call the restoration helper for the same account. They do not prove account switching is isolated or that successful `applySession` initialization preserves the restored form. In the actual initializer, an unfinished onboarding flow can run immediately after restoration and replace the sheet; cover that path as well.

Required: bind an authenticated interrupted draft to its original user, validate identity before reading it into any form, and clear/reject mismatched or legacy unowned private drafts. Distinguish explicit sign-out from recoverable session expiry if needed. Keep any existing anonymous catalog-selection behavior separate from private authenticated drafts. Preserve same-owner recovery and idempotency. Never carry a private draft into another account.

## Other scope observations

EUR evidence is shown as EUR in the supplied Watch screenshot. This is fixture-level evidence, not proof that a live TCGplayer EUR source exists. Acquisition entry still has an existing USD-only save path; do not describe Packet 02 as end-to-end multi-currency acquisition support. Research value currency and explicitly labeled purchase currency are distinct facts. No currency expansion is requested here.

Search/Library/Watch continuity and the retained layout are useful progress. This decision does not request a redesign or reimplementation of passing paths. C5/C6 cannot be accepted until the account-boundary regression and actual session-initialization coverage pass.

Next handoff: `docs/SOL_PACKET_02_REVISION.md`. Production, provider, physical-device and migration-baseline limitations remain unchanged.
