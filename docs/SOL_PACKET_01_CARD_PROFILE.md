# Sol packet 01 — exact card identity and profile

Owner: Astra. Implementer: GPT-5.6 Sol. Status: ready for handoff, not implemented or accepted.

## Task

Improve Mica's existing search-to-card-profile flow so a collector can identify the exact Pokémon printing, inspect its selected valuation context, and start adding or watching that same card. Implement this packet only, then return evidence to Astra. Do not execute the entire MVP brief or continue into later roadmap steps automatically.

## Context and authority

Read `AGENTS.md`, the entire `docs/MICA_SOFTWARE_ROADMAP.md`, and `docs/MICA_MVP_BRIEF_2026-09-17.md`. Elliott has assigned Astra product direction and Sol technical implementation; this packet is the current implementation scope. Preserve the existing roadmap's data safety and dependency gates. This is a focused refinement of Steps 3/4/5, not a new greenfield app.

The repo has extensive pre-existing uncommitted work. Start with git status and a relevant diff baseline. Do not discard, stash, commit, format broadly, or overwrite that work. A new worktree at HEAD alone omits it. You are the single application-code writer; Astra edits only coordination documents during this packet.

First verify the relevant identity/pricing prerequisites with current evidence. Historical completion documents are context, not fresh test results. If a failed prerequisite blocks safe work, address a small directly related regression within this packet or report the precise dependency; do not expand into a full-repository audit.

## Existing entry points

- `app.js`: `openCardDetail`, detail rendering, metadata, preview/owned pricing, add and watch actions.
- `index.html`, `styles.css`, `themes.css`: existing detail view and responsive presentation.
- `lib/identity.js`: canonical snapshots, variant choices/differences, matching.
- `lib/pricing.js`, `lib/price-history.js`: existing evidence/freshness/compatibility logic.
- `api/catalog.js`, `api/cards.js`: inspect only as necessary to trace selected identity.
- `tests/identity.test.js`, identity benchmark fixtures, and browser `search-recovery.spec.js`, `detail-recovery.spec.js`, `price-evidence.spec.js`.

Sol chooses implementation details and the smallest maintainable change. Reuse the current app architecture and test patterns. Avoid a new framework, parallel profile screen, replacement pricing engine, schema overhaul, or provider integration.

## Required behavior

1. Show image with useful fallback, printed name, set, collector number, language, rarity, and exact variant. Support Trainer and Energy cards; do not require a Pokémon character name.
2. Show finish/edition/printing treatment/promo distinctions where supported by evidence. Unknown attributes stay unknown. Do not invent variant combinations.
3. Open the exact selected card from search; preserve that identity across navigation, back, price refresh, retries, add and watch. Where existing entry paths open owned positions, clearly retain their ownership context.
4. Distinguish catalog facts from owned-copy state. Show raw condition or company/grade explicitly. Unknown raw condition must remain available without defaulting to Near Mint. Browsing a graded context must not edit an owned raw position.
5. Present the existing compatible value with source/date and concise evidence-strength labeling; offer deeper evidence as optional detail. Missing/stale/unsupported/error states must remain honest and useful.
6. Retain existing sold-history and population presentation if supported. If no live population/source capability exists, use an honest missing/unavailable state or omit that optional section. Do not build either data pipeline in this packet.
7. Keep Add to collection and Watch easy to find and connected to existing persistence. Preserve selected identity and user-entered values across sign-in or failed save where these flows already support it; fix directly related loss of context. No new extra confirmation when the selection is already exact.
8. Support loading, missing image, empty evidence, ambiguous identity, failure and retry on mobile and desktop. Keep useful existing detail tools accessible; no broad navigation redesign.

## Concrete risk checks

- Blank edition currently maps to unlimited and blank promo to none in `lib/identity.js`. Trace provider → normalized card → profile → persistence to determine when missing evidence can be mislabeled. Add a regression fixture for any demonstrated defect. Do not globally rewrite historical identities to fix a display symptom.
- `openCardDetail` can choose an owned match from a catalog card. Verify finish/language/edition and raw/graded/condition context cannot change silently, especially with multiple owned copies.
- Ensure stale asynchronous pricing or a shared-ID cache update cannot replace the current selection's variant, language, grade or value.
- Treat first-edition stamp and shadowless/printing treatment carefully. If the current model cannot express a required combination, preserve an explicit unresolved distinction and document the minimal follow-up; do not fabricate a canonical match.

## Acceptance criteria

| ID | Required evidence |
| --- | --- |
| P1 | EN/JA same-name/number and holo/reverse-holo fixtures stay visibly distinct from result to detail to add/watch payload. |
| P2 | Unknown edition/finish stays visibly uncertain; an ambiguous result cannot silently become unlimited, non-promo or another exact identity. |
| P3 | Raw unknown condition, confirmed raw condition, PSA 10 and BGS 9.5 use only matching evidence. A grade selector never mutates ownership. |
| P4 | Every estimate shows source, date/freshness and understandable confidence. No price is unavailable rather than zero; old evidence cannot look newly sold because it was just fetched. |
| P5 | Add/watch use the selected canonical identity. Failure retains selection/input and offers retry; relevant mutation retries do not duplicate records. |
| P6 | Switching profile/context during an in-flight request cannot render the previous card's evidence as the new card's evidence. Back preserves the prior search/filter context. |
| P7 | 390px mobile and 1440px desktop screenshots show readable identity, price state, and next actions; keyboard navigation, focus restoration, and overflow checks pass. |
| P8 | Trainer/Energy, missing image, empty sales, missing population, provider error and retry have usable states without developer/configuration instructions on everyday screens. |
| P9 | Existing relevant recovery checks pass and changed behavior has regression coverage. Baseline failures and unverified live behavior are explicitly separated. |

## Do not build

Marketplace checkout, payments, subscriptions, social sharing, advanced indexes, trade matching, new alerts, bulk import, full navigation changes, population ingestion, new grading models, or a new pricing algorithm. Preserve working existing features and data.

Do not purchase services, add production dependencies, change platforms, perform destructive migrations, deploy, or push a branch that triggers deployment without the required explicit approval. Prepare any necessary proposal concretely; ordinary local implementation and testing are authorized by the handoff.

## Verification and return format

Use relevant existing tests plus targeted additions for changed behavior. Run repository-required checks appropriate to the implementation; do not silently omit failures. Tests must verify outcomes and safety boundaries, not enforce long explanatory copy. If environment access prevents a check, name the missing prerequisite and distinguish that from a code failure.

Create `docs/evidence/SOL_PACKET_01_REPORT.md` with:

- Summary of the user-visible change and exact baseline used.
- Files changed by this packet, separate from pre-existing modifications.
- P1–P9 table: PASS / FAIL / NOT VERIFIED, each with test name, evidence path or reproduction steps.
- Exact test commands/results, including any baseline failures.
- Before/after desktop/mobile screenshot paths and which data states they show. Label mocked/staged/live sources.
- Identity trace from selected result through profile to add/watch payload; no private user data.
- Known limitations, live-provider/device gaps, and decisions requiring Astra review.
- Concise patch summary and any data migration implications.

Return the report path and a copy-ready summary to Elliott/Astra. Do not call the packet accepted: Astra will review the diff, screenshots and evidence and return ACCEPT, REVISE or BLOCKED before issuing the next packet.
