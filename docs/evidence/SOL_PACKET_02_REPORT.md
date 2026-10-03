# Sol Packet 02 evidence — exact profile continuity

Date: 2026-09-17  
Implementer: Sol  
Reviewer: Astra  
Decision requested: review Packet 02 only

## Outcome

Packet 02 and Astra's owner-isolation revision are complete in the local dirty workspace. Search, Library, Watchlist, and the existing missing-set link have UI-click coverage for opening the same exact profile. The demonstrated Watchlist gaps remain fixed. Private interrupted Add/Watch drafts now carry their originating account ID, reopen only for that exact active account, and are discarded when mismatched, expired, malformed, or legacy ownerless. Authorized drafts wait behind onboarding and resume only after onboarding is explicitly completed. Restoration never writes a collection or Watch record automatically.

No sold-history expansion, deployment, migration, dependency, provider, schema, or navigation work was performed.

## Astra revision closure

- **Owner binding:** every captured private Add/Watch draft stores the authenticated owner's exact user ID. The active session must match before any draft is passed to a form.
- **Discard policy:** account mismatch, missing/legacy owner, malformed content, invalid action shape, and age of 24 hours or more remove the shared session-storage entry and return no action.
- **Same-account recovery:** the exact card snapshot, valuation context, entered fields, and Add idempotency key remain unchanged. A failed explicit Add retry reuses that key.
- **Session initializer:** revised tests mock account-loading responses and call the real `applySession` path. They no longer prove recovery by assigning `state.session` and calling the restoration helper directly.
- **Onboarding:** an authorized same-owner private draft remains stored while onboarding is visible. Completing onboarding closes that dialog and then reopens the exact draft. The action is still not submitted.
- **Anonymous selection separation:** the existing `mica:public-card` flow remains a distinct key and was not owner-bound or merged with private drafts.

## Starting workspace and before/after evidence

The repository was already broadly dirty and the Packet 01 browser specs were untracked at handoff. I preserved those files and unrelated changes. The accepted Packet 01 anchors at the start were:

- `app.js`: `ed90f4844b3f8972cb41c98d261538097bf631a3340223d6a584fa9a72b33190`
- `styles.css`: `1476cc81de5bd04a109e0f61ca6314329ee7ea4272d1c14cecdc1421cf424219`
- `lib/pricing.js`: `da38ce7da6587044f18012e62d4c657b6e99010febb575947204d26609734c93`

Pre-change verification:

- Accepted pricing regression command: `node --test --test-name-pattern='raw selection and confidence|provider-normalized unknown finish|does not mix raw quotes' tests/pricing.test.js` → **3 passed**.
- Existing affected browser command across desktop and 390px mobile → **70 passed**.
- A new pre-fix UI regression run for the two inspection leads → **3 failed as expected**:
  - raw Watchlist profile issued no price request;
  - graded Watchlist profile issued no price request;
  - the only raw watch appeared as `Edit Watch` under PSA 10 research.

After the correction:

- A watched raw or graded card starts the guarded profile pricing request and reaches matching evidence or the existing retryable/terminal state.
- Valuation context now includes currency in request guards and matching. The EUR fixture displays `€185.00`; it is never recast to USD.
- `matchingWatchEntry` requires actual state/condition or grader/grade and currency compatibility. It no longer falls back to the only watch for the printing.
- Profile Add and Watch actions snapshot their exact identity, selected context, and draft values only when an authenticated session is interrupted. Signing back in reopens the explicit action; it does not save. Add retains the same idempotency key across a failed retry.
- Search and Library behavior already met the product requirements. Their implementation was not rebuilt; targeted UI coverage was added.
- The existing set-checklist link was retained and now has a UI-click regression proving its exact TCGdex result reaches the profile.

Final anchors:

- `app.js`: `cc0d303c4e349545bb39d5a325707b08636939a275124436be6dcf106ba5d340`
- `styles.css`: unchanged at `1476cc81de5bd04a109e0f61ca6314329ee7ea4272d1c14cecdc1421cf424219`
- `lib/pricing.js`: unchanged at `da38ce7da6587044f18012e62d4c657b6e99010febb575947204d26609734c93`
- `tests/browser/card-profile.spec.js`: `f965e8f10b4a3066cbc3da0126a49a285da541172a41699058daa23e3d0fd8a8`
- `tests/browser/search-recovery.spec.js`: `4ad8533a0ae828c31fe6a2e961734cdab810364cb289f557ed7e53937b2ac8ce`

## Files changed for Packet 02

- `app.js`
  - carried currency through valuation context and guarded pricing;
  - required compatible Watch context rather than using the single-match fallback;
  - started pricing when opening a Watchlist profile;
  - preserved requested currency in Watch quote selection, persistence, label, and profile display;
  - captured interrupted profile Add/Watch drafts with the originating user ID;
  - validated the active owner before restoration and eagerly discarded mismatched or invalid private entries;
  - deferred same-owner restoration until onboarding completion, with no automatic Add/Watch write.
- `tests/browser/card-profile.spec.js`
  - added Watchlist raw/graded entry tests, EUR evidence, cross-context Watch protection, exact Library-position routing, research no-write checks, existing set-link coverage, and evidence captures;
  - replaced direct restoration-helper auth coverage with real `applySession` account-loading tests for same-owner Add/Watch, different-owner isolation, onboarding completion, and invalid-storage discard.
- `tests/browser/search-recovery.spec.js`
  - added same-name/number English Reverse Holo and Japanese Holofoil UI-click profile coverage, exact Add/Watch defaults, and Back query/language preservation.
- `docs/evidence/sol-packet-02/*.png`
  - retained eight original mocked desktop/mobile evidence screenshots and added four actual-session-path onboarding/resume screenshots.
- `docs/evidence/SOL_PACKET_02_REPORT.md`
  - this report.

`styles.css` and `lib/pricing.js` remain byte-for-byte at the accepted Packet 01 hashes.

## Acceptance criteria

| ID  | Result   | Evidence                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | **PASS** | `same-name English and Japanese close finishes open the exact clicked profile` clicks each search result, checks language/finish/variant ID, opens Add and Watch, and preserves unknown condition. `add and watch payloads retain the selected canonical identity and unknown raw condition` verifies persisted identity payloads. Both desktop and mobile passed. |
| C2  | **PASS** | `Watchlist raw row opens its saved context and reaches a matching price`; graded counterpart verifies PSA 10, EUR, and `€185.00`; `a lone raw watch never masquerades as the selected graded research context` verifies a new POST for PSA 10 rather than editing raw. Desktop/mobile passed.                                                                      |
| C3  | **PASS** | `Library row opens the chosen saved position and research does not mutate either copy` clicks a PSA 10 position among two same-printing copies, changes research to raw Lightly Played, observes zero mutations, and confirms both copies and lots are unchanged. Existing owned-loading/failure tests also keep the stored raw value separate.                    |
| C4  | **PASS** | PSA 10 Add is verified in the auth/retry payload; PSA 10 Watch is verified as a POST with exact variant identity; raw unknown Add/Watch payloads remain unknown. The different-context raw watch is not overwritten.                                                                                                                                               |
| C5  | **PASS** | Real `applySession` tests retain same-owner Add/Watch identity, context, values, and Add idempotency with zero automatic collection/watch writes. Account B cannot render or revive A's card, purchase facts, target, or private note; the mismatched entry is cleared. Search Back retains query/language; Library Back retains query/set filter.                 |
| C6  | **PASS** | The initializer discards ownerless legacy, expired, malformed, and mismatched storage without a crash. An authorized draft remains stored while onboarding is active, then resumes only after the user completes onboarding. Existing pricing races, shared-ID replacement, account-change completion, stalled/replaced search, and retry tests all pass.          |
| C7  | **PASS** | The full affected suite passed on desktop and the 390px mobile project. New viewport evidence shows onboarding before draft hydration and the accepted Watch sheet after authorized resume; no layout or stylesheet change was made.                                                                                                                               |

## Entry path → profile context → action payload matrix

| Entry path                                  | Profile context                                                                     | Add continuity                                                              | Watch continuity                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Search: English Pikachu 25/100 Reverse Holo | Exact English Reverse Holo; raw condition remains unknown                           | Exact variant UUID; raw condition remains unknown; no variant re-question   | Exact English Reverse Holo; raw unknown remains unknown                   |
| Search: Japanese Pikachu 25/100 Holofoil    | Exact Japanese Holofoil, not the close English result                               | Exact Japanese variant/language/finish in payload                           | Exact Japanese variant/language/finish in payload                         |
| Library: selected PSA 10 position           | Selected position UID; PSA 10; other raw copy and both lots remain unchanged        | Research selection can prefill a new Add; existing position is not edited   | Research selection can create a distinct watch; no mutation before submit |
| Watchlist: raw Near Mint USD                | Raw Near Mint, USD, matching `$10.00`                                               | Add receives selected raw context                                           | Existing raw watch is the editable match                                  |
| Watchlist: graded PSA 10 EUR                | PSA 10, EUR, matching `€185.00`                                                     | Add receives selected PSA 10 context                                        | Existing PSA 10 EUR watch is the editable match                           |
| PSA 10 research with one raw watch          | PSA 10 research; raw watch shown only as a different saved context                  | PSA 10 Add payload                                                          | New PSA 10 Watch POST; no PATCH/overwrite of raw watch                    |
| Existing missing-set link                   | Exact TCGdex result, English Reverse Holo                                           | Uses the same profile action path                                           | Uses the same profile action path                                         |
| Session interruption, same account          | Exact card and selected PSA 10 context retained through real account initialization | Quantity, purchase total/date, and idempotency key retained; explicit retry | Target and notes retained; reopening performs no write                    |
| Session interruption, different account     | Private entry rejected and cleared before form hydration                            | A's card and purchase facts never enter B's form                            | A's target and notes never enter B's form                                 |
| Same account requiring onboarding           | Authorized draft remains stored while onboarding owns the UI                        | Resumes after explicit onboarding completion                                | Resumes after explicit onboarding completion with exact target/notes      |

## Commands and results

Final verification:

1. Pre-fix revision regression, desktop, using the real session initializer: `npx playwright test tests/browser/card-profile.spec.js --project=desktop-chromium --workers=1 --grep='sign-in interruption|different account|waits for onboarding|initializer discards'`  
   **6 failed as expected, 1 passed**. Failures demonstrated the missing owner tag, cross-account restoration, restoration before onboarding, and retained legacy/expired/malformed storage.
2. The targeted owner-boundary command after correction on desktop and mobile, including the complementary cross-account Add purchase-draft case  
   **16 passed**.
3. `npx playwright test tests/browser/search-recovery.spec.js tests/browser/detail-recovery.spec.js tests/browser/add-save-recovery.spec.js tests/browser/collection-continuity.spec.js tests/browser/card-profile.spec.js --project=desktop-chromium --project=mobile-chromium --workers=1`  
   **118 passed, 6 skipped** in 3.7 minutes. The skips are opt-in screenshot cases.
4. `MICA_PACKET_02_REVISION_CAPTURE=revision npx playwright test tests/browser/card-profile.spec.js --project=desktop-chromium --project=mobile-chromium --workers=1 --grep='captures owner-safe onboarding'`  
   **2 passed** and produced the four revision screenshots below.
5. `npm test`  
   **397 passed, 0 failed**.
6. Accepted pricing boundary command  
   **3 passed, 0 failed**.
7. `npm run lint`  
   **PASS**, 82 source files linted.
8. `npm run typecheck`  
   **PASS**.
9. `npm run build`  
   **PASS**, production static bundle created locally in `dist/`.
10. `git diff --check -- app.js tests/browser/card-profile.spec.js` and Prettier check  
    **PASS**.

The browser tests use local fixture identities, intercepted API responses, and mocked Supabase requests. They verify UI routing and request/persistence boundaries; they do not claim live database or live-provider persistence.

## Screenshots

All captures use a 1440px desktop or 390px mobile CSS viewport and the checked-in local Pikachu/profile fixture.

| State                                            | Desktop                                                    | Mobile                                                   |
| ------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------- |
| Watched raw Near Mint, USD matching price        | [desktop](./sol-packet-02/final-watch-raw-1440.png)        | [mobile](./sol-packet-02/final-watch-raw-390.png)        |
| Watched graded PSA 10, EUR matching price        | [desktop](./sol-packet-02/final-watch-graded-1440.png)     | [mobile](./sol-packet-02/final-watch-graded-390.png)     |
| PSA 10 → Add prefill                             | [desktop](./sol-packet-02/final-action-add-1440.png)       | [mobile](./sol-packet-02/final-action-add-390.png)       |
| PSA 10 → Watch prefill                           | [desktop](./sol-packet-02/final-action-watch-1440.png)     | [mobile](./sol-packet-02/final-action-watch-390.png)     |
| Authorized draft held behind onboarding          | [desktop](./sol-packet-02/revision-onboarding-1440.png)    | [mobile](./sol-packet-02/revision-onboarding-390.png)    |
| Same-owner PSA 10 Watch resumed after onboarding | [desktop](./sol-packet-02/revision-resumed-watch-1440.png) | [mobile](./sol-packet-02/revision-resumed-watch-390.png) |

Visual inspection confirmed the accepted layout remains intact, the Watch profiles are not stuck on `Checking…`, EUR Watch evidence is displayed as EUR, and PSA/company/grade defaults are visible in both action sheets. The revision captures use mocked account data through `applySession`: onboarding exclusively owns the UI first, and the exact private Watch draft appears only after completion. No stylesheet change was needed.

## Authentication, retry, and no-unintended-write evidence

- On session loss, only an authenticated open profile Add/Watch form is copied to `sessionStorage`, with its exact originating user ID and a 24-hour freshness limit. This is a UI draft, not a persistence request.
- Restoration requires the active session's user ID to exactly equal the stored owner before card or form data is hydrated.
- Mismatched, ownerless legacy, expired, malformed, and invalid-shape private entries are removed. The documented policy is discard, not reassignment or fallback.
- Signing in/restoring the action sends **zero** collection or Watchlist writes. Completing onboarding explicitly writes only the user's profile preferences before restoration.
- Add restoration retains the exact card, variant, PSA 10 context, quantity `2`, total `27.50`, acquisition date, and the original idempotency key.
- A mocked 503 leaves the restored Add sheet editable. The next explicit click uses the same idempotency key and exact payload context.
- Watch restoration retains PSA 10, target `175`, and notes without saving.
- A → loss → A restores through successful account loading. A → loss/sign-out → B clears the stale entry before form hydration, does not display A's values, and cannot revive the entry on a later B session.
- When A still requires onboarding, the authorized draft remains in storage while onboarding is visible and reopens only after A completes onboarding.
- Research changes from an owned PSA 10 position to raw Lightly Played send no Supabase mutation and do not alter either saved position or lot.
- A PSA 10 Watch action beside an existing raw watch issues POST only; it does not PATCH the raw watch.

## Limitations and Astra review points

- No authenticated staging, live Supabase, or live pricing-provider call was used. Persistence and provider behavior remain fixture/request-boundary verified only.
- No physical-device run was performed. Mobile evidence uses Playwright's 390px Chromium project.
- Browser-agent CLI was unavailable in the workspace, so the repository's Playwright verification path was used and screenshots were manually inspected.
- The sign-in interruption snapshot uses per-tab session storage and expires after 24 hours. It intentionally restores an editable action and never auto-submits.
- EUR evidence in this packet proves preserved/displayed EUR Watch context with fixtures; it does not claim a live TCGplayer EUR source. Acquisition entry remains on its existing USD-only save path. Research-value currency and explicitly entered purchase currency remain separate facts.
- No product decisions are requested for this packet. Astra should review the owner comparison/discard boundary and the onboarding resume path in particular.

## Copy-ready summary for Astra

> Sol completed the Packet 02 revision only. Private interrupted Add/Watch drafts now store their originating user ID and restore only after an exact active-owner match through the real `applySession` account-loading path. Mismatched, legacy ownerless, expired, malformed, and invalid entries are discarded before form hydration. Same-owner Add/Watch drafts retain exact identity, context, values, notes, and Add idempotency without automatic collection/watch writes. If onboarding is required, the authorized draft waits and resumes only after completion. Accepted search, Library, Watch, layout, and Packet 01 pricing safeguards remain green; `styles.css` and `lib/pricing.js` hashes are unchanged. Verification: 397/397 unit tests; 16/16 targeted desktop/mobile owner tests; 118 affected browser cases passed with 6 opt-in capture skips; 2/2 revision captures; lint, typecheck, build, formatting, and 3/3 pricing regressions passed. Four new desktop/mobile session-path screenshots are in `docs/evidence/sol-packet-02/`. EUR is fixture-supported for Watch display only; acquisition remains USD-only. No sold-history work or deployment was performed.
