# Follow-up audit corrections — October 26, 2026

Correction scope: `MICA_FOLLOWUP_AUDIT_2026-10-26.md`. Publication and final gate results are recorded in the accompanying verification evidence.

## Changes

1. Library favorites are excluded from the shared rule that disables pointer events on decorative card children. Existing favorite persistence and card-opening handlers are reused. Isolated tests exercise mouse/touch, keyboard activation and opening the rest of the card in both appearances, including WebKit.
2. Incomplete portfolio refreshes expose a compact Retry update action while retaining saved values and charts. Owner-scoped server responses include the existing backoff expiry; the UI disables retry until that time, then enables the action without polling the API. In-flight requests stay deduplicated. Daily provider limits remain distinct. Early server failures now mark the retained view incomplete rather than allowing a blocked retry to look complete. No saved financial history is deleted or rewritten by this correction.
3. Stale tests now measure the visible photo button, verify the current visible green primary action and its contrast, and require the timeframe above the graph. Their subsequent workflow assertions remain enabled. Static release checks now verify that rejected mode/organization UI stays absent or inert and optional delivery stays held; their data-preservation and security assertions remain. The configuration-neutral artifact baseline is versioned with this packet, preserving the historical baseline and unrelated local work.

Final live review additionally corrected a light-only hover gradient in library tabs and two existing reload defects: the release now rewrites `/profile` and `/index.html` to the served root, and navigation away from Settings clears the `/profile` pathname. The latter prevents refresh from reopening Settings after selecting the library. Unknown paths and protected API boundaries retain their existing behavior.

The browser assets advance to app v116, styles v93, themes v112 and shell cache 130 so installed clients receive the changes. No dependency, schema, grant, auth setting, provider budget or cron schedule changes are included.

## Verification boundaries

Controlled retry tests cover transient HTTP failure, retained chart/value, server waiting period, no API polling as time advances, disabled in-flight input, successful update, daily budget hold and next-day eligibility. Service tests cover owner-scoped summary retry metadata, unchanged retained financial values, daily retry limits and zero additional provider calls during backoff. Favorite write tests use intercepted isolated fixtures; customer favorites and inventory are outside write-test scope.

## Results

The core correction commit `d331abf` passed **595 unit tests / 3 skips** and **908 browser tests / 91 skips**, with zero failures or flaky passes. The independent [GitHub beta gate](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/40446385133) passed 406 browser checks plus three large-inventory checks, with 11 skips. The broader 91 skips include 69 internal-artifact-only cases, nine explicit evidence-capture cases and conditional/disposable-stack checks; those held scenarios were not activated.

The subsequently discovered hover and navigation corrections passed **27 focused browser checks** across desktop Chromium, mobile Chromium and WebKit, plus **73 security checks**. Preview hashes, release routing and the concrete hosted reload paths were reverified after those changes. The full 908-check run and successful independent gate qualify the core correction commit; they are not represented as a rerun on the later cosmetic/navigation commits. Automatic GitHub checks for the final head may still be running when this packet is recorded.

Published application source: `8a29bd83095542b6d1fb075c44c742f76093e01a`. Live geometry confirms that favorite centers hit their own buttons, with pointer events enabled in both themes at 320, 390, 760, 1024 and 1440px, without horizontal overflow. The final hosted health, shell/reload responses and restoration checks are recorded alongside this report. Customer collection values, notes and full screenshots stay out of Git.

Physical iPhone acceptance and the existing legal/signup/email/store and held-feature qualifications remain separate milestones.
