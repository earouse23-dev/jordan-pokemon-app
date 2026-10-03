# Sol packet 01 — implementation evidence

Status: final correction implemented; ready for Astra review; not accepted.

Date: 2026-09-17

## Final correction after Astra's revision review

This section is the authoritative evidence for `docs/SOL_PACKET_01_FINAL_CORRECTION.md`. R1–R3 and the accepted compact layout were preserved. The correction changes only raw/graded quote compatibility, the completed missing-price state, the display label for the provider token `firstEdition`, their regressions, and this evidence.

The correction started from the post-revision hashes recorded below. Final hashes are:

- `app.js`: `ed90f4844b3f8972cb41c98d261538097bf631a3340223d6a584fa9a72b33190`
- `styles.css`: `1476cc81de5bd04a109e0f61ca6314329ee7ea4272d1c14cecdc1421cf424219` — unchanged from the accepted R3 revision.
- `lib/pricing.js`: `da38ce7da6587044f18012e62d4c657b6e99010febb575947204d26609734c93`
- `tests/pricing.test.js`: `3f28574d1ac00ff60fade07b30a8e374107f87fde6d2781782cb9b0282c61de8`
- `tests/browser/card-profile.spec.js`: `0bf85afa3aeed1aa9d714a51148cae12e835e762f2866d4c7c54f46bc12d8dee`

### Final-correction files changed

- `lib/pricing.js` — introduces one shared graded-context predicate. Every raw selector branch now excludes quotes carrying either a grading company or a grade before exact/condition-neutral selection. The same predicate is used by confidence/evidence calculation.
- `app.js` — treats `missing`, `unavailable`, and `unsupported` as completed terminal states instead of pending; matching-source copy explicitly states that raw pricing did not use graded evidence; displays the provider token `firstEdition` as `1st Edition` without changing the underlying identity.
- `tests/pricing.test.js` — adds the selector/evidence regression for null, absent, and empty condition representations, mixed raw/graded ordering, condition-neutral raw aggregates, and exact PSA selection.
- `tests/browser/card-profile.spec.js` — adds the rendered raw-to-graded regression, terminal-state and source-row assertions, confidence-copy exclusion, label assertion, and opt-in screenshot capture.
- `docs/evidence/sol-packet-01/final-correction-terminal-390.png` — ordinary 390×844 terminal-state screenshot.
- `docs/evidence/SOL_PACKET_01_REPORT.md` — this final-correction record.

No layout stylesheet, provider, dependency, migration, deployment configuration, or unrelated application path changed.

### R4 — raw requests reject graded evidence

Result: **PASS in selector, confidence, and rendered-profile coverage.**

- `raw selection and confidence exclude graded-only evidence in every condition shape` supplies PSA/BGS quotes whose condition is `null`, absent, or an empty string. A raw Near Mint request returns no quote, and `priceEvidence` reports `unavailable`, zero supporting sources, and an empty evidence list.
- The same unit regression mixes a valid condition-neutral raw aggregate with the graded quotes in both orders. Raw selection always returns the `$80` raw aggregate and confidence counts only that raw source. An exact PSA 10 request still returns the `$200` slab quote.
- `raw profile rejects graded-only evidence, then prices the matching slab context` returns only a PSA 10 `$200` quote to the rendered Holofoil profile. After the raw Near Mint response completes, the hero shows `Price unavailable` and `No matching price found for this card version`; it contains neither `$200`, pending `Checking` copy, nor `Limited evidence`. The Matching prices panel states that graded evidence was not used and contains no slab value. Switching to PSA 10 then shows `$200.00`.
- The rendered regression passes in desktop Chromium, 390px mobile Chromium, and 390px mobile WebKit.

### Terminal-state and label corrections

- Completed `missing`, `unavailable`, and `unsupported` states now receive terminal copy. `Checking this card version` and the loading panel remain reserved for an actual pending request; error/rate-limit retry behavior is unchanged.
- The existing provider-normalized first-edition browser test now asserts the primary variant label is `1st Edition` and does not expose `firstEdition`. Its Add/Watch assertions continue to prove the canonical `variantId`, unknown finish, and first-edition identity are unchanged.

### Terminal-state screenshot

- [Raw result with graded-only evidence withheld — 390×844](./sol-packet-01/final-correction-terminal-390.png)

The capture uses the working local Holofoil card fixture and a completed response containing only PSA 10 `$200` evidence. It shows the compact accepted identity layout, `Price unavailable`, the terminal `No matching price found for this card version` message, raw Near Mint controls, and reachable primary actions. It was visually inspected after capture. SHA-256: `e424a92079de41330f42d7fb2c5c9ecd0dc8489d0ebf492369896fdca8dddd65`.

### Final-correction verification log

- `node --test --test-name-pattern='raw selection and confidence|provider-normalized unknown finish|does not mix raw quotes' tests/pricing.test.js` — 3 passed, 0 failed.
- `npx playwright test tests/browser/card-profile.spec.js -g "raw profile rejects graded-only|provider-normalized first-edition" --project=desktop-chromium --project=mobile-chromium --project=mobile-webkit --workers=1` — 6 passed, 0 failed.
- `MICA_CARD_PROFILE_CAPTURE=final-correction npx playwright test tests/browser/card-profile.spec.js -g "raw profile rejects graded-only" --project=mobile-chromium --workers=1` — 1 passed and wrote the terminal-state screenshot.
- `npx playwright test tests/browser/card-profile.spec.js --project=desktop-chromium --project=mobile-chromium --project=mobile-webkit --workers=1` — 30 functional cases passed; 3 evidence-only cases skipped as designed.
- `npm test` — 397 passed, 0 failed.
- `npm run lint` — 82 source files linted.
- `npm run typecheck` — passed.
- `npm run build` — production static bundle created in `dist/`.
- `git diff --check` — passed.

### Final-correction limitations

- The new quote boundary and UI flow use deterministic normalized fixtures, not a live provider or authenticated staging account.
- Mobile verification remains browser emulation, not physical iOS/Android hardware.
- The previously documented migration-baseline mismatch remains outside Packet 01; this correction adds and edits no migration.
- Astra still owns acceptance. Packet 02 has not begun and no deployment occurred.

## Revision after Astra's REVISE decision

This section is the authoritative evidence for `docs/SOL_PACKET_01_REVISION.md`. It preserves the original Packet 01 baseline and records only the correction work performed after Astra's review. No provider, dependency, migration, deployment, Packet 02 work, or production mutation was added.

Revision baseline copies were saved before editing in `/tmp/sol-packet01-revision.63dvOF`. The revision started from these hashes:

- `app.js`: `bacae4bba47a46c5d5a4b22212818132043c74148779a11634bb257dc57b1395`
- `styles.css`: `4ab9ae0f3bbf66f9cf38d6433fb85cb2a448826b9071fb37ef4fa658da38b0c4`
- `lib/pricing.js`: `4b8954089ec7d3d2860053c4740a33809a200063602a040c499a0ebfba5484b4`
- `tests/pricing.test.js`: `37aa793970906f647de669a71421d49f8f491d52133809631421bd5575a6087a`
- `tests/browser/card-profile.spec.js`: `7824b5eca03566d01449b11be7a78d0598b56661e825047938f328342d77b574`

The corresponding post-revision hashes are:

- `app.js`: `4ed979ceab65ef9983133c415d77e20467c086db7ffe687494333c94adf9b534`
- `styles.css`: `1476cc81de5bd04a109e0f61ca6314329ee7ea4272d1c14cecdc1421cf424219`
- `lib/pricing.js`: `e6b98be8a109cb8bee66d0bcc229ee2cd6a2d8acd27328e50ac8fd6fe052541c`
- `tests/pricing.test.js`: `082298fbc3c284ac0867fc29d358d9df4fc1332a7a3d2f29eca17791347c2024`
- `tests/browser/card-profile.spec.js`: `a6e5d2b0811287431aa16cf877a14357c1d7ac05578ba1145c987205bf607647`

### Revision files changed

- `lib/pricing.js` — quote compatibility now prefers an explicitly supplied structured finish/edition. An own `finish: "unknown"` is a conservative no-match, so display-label parsing cannot turn missing evidence into normal or first-edition non-holo. Callers without a structured finish retain the established fallback behavior.
- `app.js` — profile requests carry the selected printing's structured finish/edition; rendered research evidence is neutral until evidence matching the active identity and context exists; provider failure no longer inherits an owned card's old live status; saved ownership remains a separate summary; valuation focus is restored and scrolled above the sticky action bar.
- `styles.css` — primary identity is reduced to name, one set/number line, language, and variant; printing facts and explanation move behind one optional details disclosure; mobile spacing/image sizing keeps the result and controls near the header without smaller body text.
- `tests/pricing.test.js` — joins real TCGdex normalization to quote selection for the first-edition/unknown-finish regression and confirms a mapped holo printing still selects its compatible quote.
- `tests/browser/card-profile.spec.js` — adds provider-normalized R1 coverage, R2 pending/failure/retry and late-condition coverage, R3 focus/overflow assertions, a working local SVG fixture, and ordinary normal/uncertain viewport captures.
- `docs/evidence/sol-packet-01/revision-after-normal-1440.png`
- `docs/evidence/sol-packet-01/revision-after-normal-390.png`
- `docs/evidence/sol-packet-01/revision-after-uncertain-1440.png`
- `docs/evidence/sol-packet-01/revision-after-uncertain-390.png`
- `docs/evidence/SOL_PACKET_01_REPORT.md` — this revision record.

### R1 — unresolved identity remains unpriced

Result: **PASS in deterministic unit and rendered-profile coverage.**

- `provider-normalized unknown finish cannot inherit a label-derived price` creates a card with the real TCGdex normalizer, selects its independent `firstEdition` option (`edition: first_edition`, `finish: unknown`), offers normal `$123`, first-edition-normal `$234`, and holo `$345` quotes, and receives no exact quote. The same test confirms the provider-normalized, explicitly mapped holo option selects `$345`.
- `provider-normalized first-edition uncertainty stays unpriced through add and watch` exercises that option in the rendered profile across desktop Chromium, 390px Chromium, and 390px WebKit. The market result remains unavailable for all three offered prices. Optional printing details retain `Finish: Unknown` and `Edition / stamp: 1st Edition`.
- The Add and Watch assertions retain the selected unresolved `variantId`, `finish: unknown`, `edition: first_edition`, and `promoType: unknown`. Because the fixture's provider variant ID is intentionally not a database UUID, both schema-facing `variant_id` fields remain `NULL` while the canonical identity snapshot remains exact.
- The normal reverse-holo profile still renders its compatible `$10` quote, so the fix does not globally suppress authoritative mappings.

### R2 — research evidence is isolated from saved ownership

Result: **PASS including pending, failure, retry, late response, and no-mutation evidence.**

`owned raw value stays separate through graded loading, failure, and retry` begins with an owned raw Near Mint card whose saved value is `$10`:

1. Selecting PSA 10 while holding the provider response renders `Checking…`; the research result does not contain `$10`, while the separate owned summary continues to show `$10.00 each`.
2. Returning HTTP 500 renders `Price unavailable` and `Could not check a live price`; the research result still does not contain `$10`, and the owned summary remains `$10.00 each`.
3. Retrying with matching PSA 10 evidence renders `$200.00`.
4. The stored position remains raw/Near Mint with price `$10`, no grader or grade, and the route spy observes no collection mutation.

`late raw-condition evidence cannot replace a newer owned research context` changes the same owned card from Lightly Played to Damaged while holding both requests. A late `$7` Lightly Played response is ignored; the active context stays pending until the matching `$3` Damaged response arrives, while the owned summary remains `$10`. The existing raw-to-graded late-response test also continues to prove that a late `$10` raw response cannot replace active `$200` PSA 10 evidence.

### R3 — concise mobile identity and viewport evidence

Result: **PASS in ordinary 390×844 viewports and desktop viewports.**

- The initial mobile viewport contains the concise identity panel, the price or honest unavailable result, the valuation state control and condition control, and the persistent Watch/Add actions. The test asserts the title, market result, context control, and Add action intersect the viewport and that horizontal overflow is zero.
- Secondary finish, edition, promo, and treatment facts remain available behind `Printing details`; the uncertain state uses a short `Printing details incomplete` cue instead of the former long warning.
- `focused valuation controls stay visible above the sticky actions` changes controls through the app's rerender path, asserts focus is restored, and compares each focused control's bounding box with the sticky action bar. It passes in desktop Chromium, 390px Chromium, and 390px WebKit.
- The normal screenshots use a working local SVG card fixture. The uncertain screenshots intentionally exercise the labeled missing-image state.

Revision screenshots:

- [Normal desktop — 1440px](./sol-packet-01/revision-after-normal-1440.png) — working local card image, compatible `$10` result, controls, and actions.
- [Normal mobile — 390×844](./sol-packet-01/revision-after-normal-390.png) — concise identity, working image, price, context controls, and primary action in the initial viewport.
- [Uncertain desktop — 1440px](./sol-packet-01/revision-after-uncertain-1440.png) — first-edition/unknown-finish identity with price withheld.
- [Uncertain mobile — 390×844](./sol-packet-01/revision-after-uncertain-390.png) — compact uncertainty cue, unavailable result, controls, and action in the initial viewport.

Screenshot SHA-256 values:

- normal desktop: `12f3e53a7990000756bbfc33c91d6969f1b701de3944a7c32b46bd7b512e2307`
- normal mobile: `bee5196075cec0ffa6bc4fc8122dbbd5c18ccc2fa381e20140ed1bcf088ed1e7`
- uncertain desktop: `0fb59b169b5ba167189e1883782209947efe1b49df769ed575736466c10d1170`
- uncertain mobile: `d30fac1c61c93a19aa87511c367f98a3f1f3692738c4fe7d6cf4ff9901eb80e9`

### Revision verification log

- `node --test tests/pricing.test.js tests/identity.test.js tests/domain.test.js tests/price-history.test.js` — 133 passed, 0 failed.
- `npm test` — 396 passed, 0 failed.
- `npm run lint` — 82 source files linted.
- `npm run typecheck` — passed.
- `npm run test:schema` — 83 public tables validated; RLS enabled on every table.
- `npm run evaluate:identity` — 8/8 exact outcomes, 0 silent substitutions, full confirmation coverage.
- `npm run build` — production static bundle created in `dist/`.
- `npx playwright test tests/browser/card-profile.spec.js --project=desktop-chromium --project=mobile-chromium --project=mobile-webkit --workers=1` — 27 functional cases passed; 3 capture-only cases skipped as designed.
- `npx playwright test tests/browser/detail-recovery.spec.js tests/browser/price-evidence.spec.js --project=desktop-chromium --project=mobile-chromium --workers=1` — 24 passed.
- `MICA_CARD_PROFILE_CAPTURE=revision-after npx playwright test tests/browser/card-profile.spec.js -g "captures revised" --project=desktop-chromium --project=mobile-chromium --workers=1` — 2 passed and wrote the four revision screenshots.
- `git diff --check` — passed.

### Revision limitations

- Pricing, provider normalization, ownership separation, and mutations are verified with deterministic local route fixtures; no authenticated staging or live-provider acceptance run was performed.
- Mobile verification uses 390×844 Chromium and WebKit emulation at normal zoom, not physical iOS/Android hardware.
- The existing migration-baseline mismatch described later in this report remains outside Packet 01; this revision adds and edits no migration.
- Astra still owns acceptance. This report does not mark Packet 01 accepted and no Packet 02 work has begun.

## Summary and baseline

Mica's existing search-to-profile flow now keeps the selected printing and valuation context separate and explicit. The profile shows the card's catalog identity, preserves unknown printing facts, asks for a raw condition before showing a raw estimate, supports PSA/BGS research without editing an owned raw card, rejects stale price responses, and carries the exact canonical identity into the existing Add and Watch persistence paths.

The implementation started from repository HEAD `88c10ed6d2bde92632def81182f48f0e4d192e00` plus the extensive pre-existing dirty worktree. Nothing was stashed, reset, committed, or broadly formatted. Relevant working files were copied before editing at 2026-09-17 13:06 local time. The two principal baseline hashes were:

- `app.js`: `2a2f9a5de271acb6cbaf29323f41f9c981b62cdbd9dc807610c1449fc3125b4c`
- `styles.css`: `8a83041ef3b61a41b07756e93c7ec6d251c8b64d702d848c7fe098145805d316`

The initial implementation pass ended with these pre-revision hashes:

- `app.js`: `bacae4bba47a46c5d5a4b22212818132043c74148779a11634bb257dc57b1395`
- `styles.css`: `4ab9ae0f3bbf66f9cf38d6433fb85cb2a448826b9071fb37ef4fa658da38b0c4`

The before screenshots are rendered from those saved baseline files with the same deterministic card and pricing fixture used for the after screenshots.

## Files changed by this packet

- `app.js` — exact profile selection, valuation context controls, honest missing/error states, request guards, focus restoration, and exact Add/Watch handoff.
- `styles.css` — responsive identity, missing-image, uncertainty, and valuation-context presentation.
- `lib/providers/tcgdex.js` — evidence-preserving TCGdex variant options; independent first-edition evidence no longer fabricates a first-edition holo combination.
- `lib/domain.js` — recognizes the explicit UI value `unknown` without mapping it to Near Mint.
- `lib/supabase-data.js` — hydrates finish/edition/promo/status and persists the UI's unknown raw condition as the schema's existing `NULL` representation.
- `playwright.config.js` — includes the packet suite in mobile WebKit coverage.
- `tests/identity.test.js` — EN/JA and holo/reverse canonical snapshot distinctions.
- `tests/pricing.test.js` — TCGdex unknown-edition/promo and unresolved first-edition regression assertions.
- `tests/domain.test.js` — unknown raw-condition normalization assertion.
- `tests/browser/card-profile.spec.js` — focused profile, pricing-context, stale-response, persistence, accessibility, and edge-state regression suite.
- `docs/evidence/sol-packet-01/before-profile-1440.png`
- `docs/evidence/sol-packet-01/before-profile-390.png`
- `docs/evidence/sol-packet-01/after-profile-1440.png`
- `docs/evidence/sol-packet-01/after-profile-390.png`
- `docs/evidence/SOL_PACKET_01_REPORT.md` — this report.

No initial-pass change was made to `index.html`, `themes.css`, `lib/identity.js`, `lib/pricing.js`, `lib/price-history.js`, `api/catalog.js`, or `api/cards.js`; any working-tree differences there pre-dated the initial pass. The scoped revision above subsequently changes `lib/pricing.js`.

## Acceptance evidence

| ID | Result | Evidence |
| --- | --- | --- |
| P1 | PASS | `profile action snapshots keep language, finish, and unknown distinctions exact` creates four distinct EN/JA × holo/reverse snapshots. The browser profile exercises EN reverse holo; `add and watch payloads retain the selected canonical identity and unknown raw condition` exercises the same-name/number JA holo printing through detail, Add RPC, and Watch insert on desktop Chromium, mobile Chromium, and mobile WebKit. Existing `search-recovery.spec.js` shared-ID replacement tests also pass. |
| P2 | PASS | The R1 unit/browser regressions join provider normalization to rendered quote selection: first-edition plus unknown finish remains unpriced against normal, first-edition-normal, and holo quotes, while its unresolved identity remains available in optional details and Add/Watch snapshots. |
| P3 | PASS | The original raw/graded matching cases still pass. The R2 regression additionally proves an owned raw/NM/$10 value never appears as pending or failed PSA 10 research, retry resolves to $200, the owned summary remains $10, and no ownership write occurs. |
| P4 | PASS | The profile browser test asserts source, observed date, and `Limited evidence`; the screenshot shows those facts together. It also verifies no condition produces `Price unavailable`, not zero. Unit tests `freshness uses the provider timestamp instead of making old data fresh when retrieved` and the compatible-evidence tests pass. |
| P5 | PASS | The JA-holo browser test asserts the exact `card_id`, `variant_id`, collectible identity, language, finish, unknown edition/promo, and schema-compatible `NULL` raw condition in both Add and Watch mutations. The existing add-save recovery suite verifies retained drafts, identical retry/idempotency behavior, and no duplicate write after a saved mutation (18 tests across desktop/mobile within the 80-test recovery run). |
| P6 | PASS | `late raw pricing cannot replace the newly selected graded context` still passes. The revision adds the analogous owned-condition sequence: late Lightly Played evidence cannot replace active Damaged research, and neither context inherits the saved Near Mint value. |
| P7 | PASS | The four revision screenshots show normal and uncertain states at 1440px and an ordinary 390×844 viewport. The packet suite proves no horizontal overflow, initial result/control/action reachability, and focused-control clearance above the sticky actions in desktop Chromium, mobile Chromium, and mobile WebKit. |
| P8 | PASS | Dedicated Trainer and Energy cases render without a Pokémon character and use a labeled missing-image fallback. The profile test covers empty price/unknown condition; existing detail/price recovery tests cover provider errors, empty evidence, stalled requests, and retry. No population capability exists, so the optional population section is omitted rather than fabricated. |
| P9 | PASS | Revision totals: 396 unit tests, lint, type/syntax, schema, build, identity benchmark, 27 packet browser cases, and 24 directly affected detail/price recovery cases pass. The unrelated migration-baseline failure remains isolated below and was present in the initial dirty worktree. |

## Original pass screenshots

All four images use local deterministic fixtures, not live provider or private user data. The fixture is the same Pikachu `025/100` selection and dated provider quote in each before/after pair.

- [Desktop before — 1440px](./sol-packet-01/before-profile-1440.png): baseline profile; selected reverse holo but incomplete identity disclosure and a raw price shown without an explicit condition selector.
- [Desktop after — 1440px](./sol-packet-01/after-profile-1440.png): exact identity facts, explicit unknown distinctions, selected Near Mint context, dated/source-labeled evidence, and persistent Watch/Add actions.
- [Mobile before — 390px](./sol-packet-01/before-profile-390.png): baseline compact profile and sticky actions.
- [Mobile after — 390px](./sol-packet-01/after-profile-390.png): responsive exact identity, missing-image label, valuation context, evidence, optional tools, and sticky actions with no horizontal overflow.

Screenshot SHA-256 values:

- after desktop: `7af137fef63e70565d8bdb9f2e3695428003f988bd97ce3327adfd5648c3d2ba`
- after mobile: `0e24c2ebc1126deb614fed8ccf701ddf7f149e4e11c4b3a97706a5f60b62ccaa`
- before desktop: `330b778b81dcd501f72b72352f4886f5e0d5441fcce14699ff15875d6bc13afa`
- before mobile: `1ba63166ce19e58a17e8d82b21bd44e36e07d23158f06e52cd6d43f2b424b849`

## Identity and valuation trace

1. A selected catalog result enters `openCardDetail` as the displayed card. Catalog entry points no longer silently replace it with a same-printing owned copy; collection entry points explicitly opt into the owned position.
2. The profile records an exact selection key from provider/catalog identity plus language, finish, edition, and promo distinctions. The catalog facts and owned-copy state remain separate.
3. Each price request is keyed by both exact selection and valuation context. Raw requests include only the selected condition; graded requests include only company and grade. A request version prevents a previous card/context response from rendering after a switch.
4. Add resolves the already-selected variant without another confirmation and sends the exact `cardId`, `variantId`, and identity snapshot. Watch locks the same printing and writes the same canonical fields.
5. The UI value `unknown` remains visible as “Not sure yet,” blocks pricing, and is persisted as `NULL`, the existing database representation for unknown raw condition. It is never converted to Near Mint.

The browser fixture asserts a JA Holofoil payload distinct from the EN Reverse Holo profile fixture:

```text
selected result: Pikachu / Exact Test Set / 025/100 / ja / holofoil
profile: Japanese / Holofoil / edition unknown / promo unknown
add: card_id + JA-holo variant_id + identical identity snapshot + raw_condition NULL
watch: same card_id + same variant_id + identical identity snapshot + raw_condition NULL
```

No private user data appears in tests, screenshots, or this trace.

## Verification log

### Passing checks

- Baseline prerequisite: `node --test tests/identity.test.js tests/pricing.test.js tests/price-history.test.js` — 59 passed, 0 failed.
- `node --test tests/identity.test.js tests/pricing.test.js tests/domain.test.js tests/price-history.test.js` — 132 passed, 0 failed.
- `npm test` — 395 passed, 0 failed.
- `npm run lint` — 82 source files linted.
- `npm run typecheck` — passed.
- `npm run test:schema` — 83 public tables validated; RLS enabled on every table.
- `npm run evaluate:identity` — 8/8 exact outcomes, 0 silent substitutions, full confirmation coverage.
- `npm run verify:identity-migration` — passed, including 47 transactional integration assertions.
- `npm run verify:pricing-migration` — passed.
- `npm run build` — production static bundle created.
- `npx playwright test tests/browser/card-profile.spec.js --project=desktop-chromium --project=mobile-chromium --project=mobile-webkit --workers=1` — 18 passed, 3 evidence-only cases skipped as designed.
- Final changed-case reruns across all three browser projects: JA-holo Add/Watch — 3 passed; source/date/confidence valuation case — 3 passed.
- `npx playwright test tests/browser/search-recovery.spec.js tests/browser/detail-recovery.spec.js tests/browser/price-evidence.spec.js tests/browser/add-save-recovery.spec.js --project=desktop-chromium --project=mobile-chromium --workers=1` — 80 passed.
- Before screenshot command — 2 passed.
- After screenshot command — 2 passed, then 2 passed again after the final 12px accessibility correction.
- `git diff --check` on tracked packet files and the new browser test — passed.

### Failed or non-gating checks

- The first sandboxed Playwright attempt could not bind `127.0.0.1:4189` (`EPERM`). The identical tests passed after granting the local test-server permission; this was an execution-environment restriction, not an application failure.
- An intermediate `npm test` run found three new 11px labels in the packet CSS. They were corrected to 12px; the final result is 395/395 passing.
- `npm run check:migrations` fails because the pre-existing, untracked `20260908144828_deliver_device_alerts.sql` name is absent from the already-modified reconciliation baseline. The initial task snapshot already contained that file; this packet adds no migration and does not edit either migration reconciliation document.
- An exploratory direct `npx prettier --check ...` was not clean because several large dirty-worktree files were already not Prettier-clean, and the invocation included SQL for which this setup has no inferred parser. The repository's required `npm run lint`, syntax checks, build, and whitespace checks pass. No broad formatting was applied, preserving existing work.

## Limitations and Astra review points

- Provider, Supabase, and account mutation evidence is deterministic/local. No staging or production credentials were used, and no deployment occurred.
- Mobile coverage is browser emulation at 390px in Chromium and WebKit, not a physical iPhone/Android device.
- Mica has no live population-report capability in the inspected profile path. This packet deliberately omits population rather than constructing a new pipeline or implying availability.
- TCGdex exposes `firstEdition` independently from finish. The implementation preserves `edition: first_edition` with `finish: unknown` until an exact combined printing is evidenced. Astra should confirm that this conservative unresolved presentation is the desired product treatment.
- No schema migration or production dependency is required. Unknown raw condition uses the existing nullable schema contract.
- The pre-existing `deliver_device_alerts` migration reconciliation mismatch still needs its owning roadmap packet to resolve; it is not part of this card-profile packet.

## Concise patch summary

- Preserve exact result identity through detail, price refresh, Add, and Watch.
- Surface finish/edition/promo/treatment uncertainty instead of inventing Unlimited, non-promo, or combined first-edition variants.
- Require an explicit raw condition before raw pricing; allow PSA/BGS research without mutating ownership.
- Scope asynchronous evidence by exact printing and context; restore focus after rerenders.
- Add responsive missing-image and Trainer/Energy-safe profile states.
- Reuse the existing nullable raw-condition database contract; no migration or dependency change.

## Copy-ready summary for Astra

```text
SOL_PACKET_01 final correction is implemented and ready for Astra review (not accepted). R1–R3 remain closed and the accepted compact layout is unchanged. R4 now excludes every graded observation from raw exact and condition-neutral selection, and the confidence calculation uses the same boundary. Unit coverage proves PSA/BGS-only data with null, absent, or empty condition fields cannot price or support confidence for raw; mixed quote ordering still selects the valid raw aggregate; exact PSA 10 selection still works. The rendered profile likewise withholds a PSA-only $200 quote from raw Near Mint, shows a completed unavailable state with no slab source/confidence, then shows $200 after switching to PSA 10.

The small presentation corrections are also complete: missing/unavailable/unsupported responses use terminal copy rather than `Checking this card version`, and the provider token `firstEdition` displays as `1st Edition` without changing canonical identity or Add/Watch payloads.

Evidence: 397/397 unit tests pass; lint, typecheck, build, and diff checks pass; 30 functional profile cases pass across desktop Chromium, 390px Chromium, and 390px WebKit. The targeted selector/evidence run is 3/3 and the targeted cross-browser UI run is 6/6. The 390×844 terminal-state screenshot is `docs/evidence/sol-packet-01/final-correction-terminal-390.png`.

No stylesheet/layout, migration, dependency, provider, deploy, Packet 02 work, or production mutation was added. Verification remains local/mock and browser-emulated; no live-provider/authenticated-staging or physical-device acceptance was performed. The pre-existing deliver_device_alerts migration-baseline mismatch remains outside this packet. Stopped for Astra's review.
```
