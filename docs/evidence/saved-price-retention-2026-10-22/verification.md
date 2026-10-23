# Saved graded-price retention — 2026-10-22

## Diagnosis

Read-only production inspection confirmed that the affected Umbreon PSA 10 context still had 117 saved matching sales and a validated live envelope in `portfolio_views`. No customer rows were changed. The client could prefer an incomplete/in-flight detail response over that saved envelope; the exact-context validator then correctly returned unresolved, but the UI incorrectly treated that as absence of saved data. An inventory reload also omitted restoring the published resolved printing/pricing snapshot.

A regression reproduced the masking before the fix: after a valid fixture snapshot arrived during a pending detail request, the page displayed `Estimate unavailable` instead of its saved $110 price. The corrected test waits for an invalid delayed response to finish and verifies retained evidence, chart, portfolio total and reopening without another read.

## Implementation

- Shared evidence selection uses the existing strict canonical/printing/grader/grade/qualifier/currency evaluator. Valid saved evidence remains visible while loading or after an incomplete/invalid response; a newer valid response replaces it.
- Late responses recheck the current owned identity/context before changing its evidence. Researching another currency or grade does not redirect a refresh to the owned copy.
- Reopening a matching saved snapshot less than 24 hours old reuses it, including across UTC midnight and when older history pages are marked incomplete. No automatic card-price or sales read is made by that reopen.
- Owned graded detail avoids the redundant reference-card request when its saved slab evidence is fresh, including after awaiting a background portfolio refresh.
- Portfolio valuation accepts retained validated evidence after request failures; it no longer drops a saved value solely because the last read failed.
- Inventory reload restores the published resolved printing/pricing snapshot using existing pricing-key guards.
- Existing server daily publication, append/retained historical storage, authentication/owner isolation and explicit refresh remain. No schema migration, dependency, provider-budget or cron change. No historical cache invalidation or customer write-test.
- Shell cache version 117 delivers the corrected app.

## Checks

- Lint, syntax/type checks, whitespace check: passed.
- Unit tests on final source: 590 passed, 3 existing skips.
- Full graded-copy browser suite: 90 passed, 6 existing optional/live-provider skips across desktop Chromium, mobile Chromium and mobile WebKit. It covers exact printing, context changes, refresh errors, evidence exclusions, FX, copy switching, save/reload and chart behavior.
- Final targeted acceptance after the last guard refinements: 12 passed across those three browser projects, including delayed invalid response, retained portfolio value, 24-hour midnight reuse with zero card/sales requests, and independent grade/currency pricing.
- The broader price-evidence/card-profile run passed its 147 checks (9 skips). Its seven physical-copy failures exposed old copy assertions plus an initial overly broad research-context guard; those were corrected and the complete physical-copy suite rerun as above. No failed assertions were removed.
- Production build and routing verified: 99 source entries, 64 deployment entries, 9 functions. All release source committed; unrelated dirty documentation and private recovery data excluded.

## Publication

- Source: `42d414450caebb79264c02fab6f9a7a75739ad98`.
- Staged production: https://jordan-pokemon-j92jz50dw-earouse23-devs-projects.vercel.app
- Deployment: `dpl_2TABKYd8fqe7SUgDBrBJkaKzSc4i`.
- Canonical: https://jordan-pokemon-app.vercel.app/
- Staged and canonical health: healthy, release `42d414450cae`.
- Staged served app matches the prebuilt SHA-256 `c36a83ccbbf6806b0c53b5d26171aca48bc0b58b25a4dbde362e7d81377dac64`.
- Actual user browser: reproduced missing price/history before publication; after publication Umbreon displayed $3,763 and its chart, retained both through Month → All time, dashboard navigation and reopening. No manual sales refresh or inventory/settings mutation was performed.
- `before.png` and `published.png` are live browser captures. Regression market values are synthetic fixtures; they do not establish physical-device camera acceptance.
