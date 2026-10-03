# Sol Packet 02 — one exact profile across entry points and actions

Owner: Astra. Implementer: Sol. Status: ready for handoff.

## Task and outcome

Complete the existing canonical profile's entry paths and action continuity. A collector can open the same exact printing from search, Library, or Watchlist, see the appropriate context, start Add/Watch, and return to where they came from without losing their selection or changing stored ownership unintentionally.

Read `AGENTS.md`, the existing software roadmap, `docs/MICA_MVP_BRIEF_2026-09-17.md`, and `docs/evidence/ASTRA_PACKET_01_ACCEPTANCE.md`. Packet 01 is accepted for its scope. This packet is product sequence 2, reusing roadmap Steps 3–5; it is not roadmap Step 2 and does not authorize later phases.

Sol chooses technical implementation. Work in the current dirty workspace as its sole application-code writer. Record relevant baseline hashes/diffs and preserve other work. Verify the accepted pricing regressions before changing profile behavior. Use one existing profile, not a new screen or navigation architecture.

## First inspect, then change only demonstrated gaps

Trace these entry points through visible UI: search result, owned Library position, raw Watchlist entry, graded Watchlist entry, and existing set/missing-card links if already present. Record which requirements already pass; do not rebuild working paths or introduce absent set features.

Specific inspection leads, not yet reproduced defects:

- `openWatchlistDetail` sets a context and renders without starting a price request, while research evidence reuse currently recognizes owned/sealed contexts. Verify a watched card with known context reaches a price or honest terminal state rather than remaining indefinitely pending.
- `matchingWatchEntry` has a single-match fallback. Verify a raw watch cannot masquerade as a PSA 10 watch simply because it is the only watch for that printing.
- Inspect the existing Add/Watch handlers' use of selected research context versus the base card. Preserve deliberate research choices as editable defaults without changing an existing owned position.

## Product behavior

| Entry/action | Required behavior |
| --- | --- |
| Search → profile | Preserve exact selected printing; do not replace it with an owned copy. No forced raw-condition guess. |
| Library → profile | Start with that position's saved state/condition/company/grade. Distinguish multiple copies or lots without silently choosing another position. |
| Watchlist → profile | Start with that watch's saved state/condition/company/grade and currency context; reach matching evidence or a useful terminal state. |
| Change research context | Research remains separate from stored ownership and watch settings. No mutation until an explicit save action. |
| Profile → Add | Carry the exact selected printing and, where intentionally selected, the research state/condition/company/grade as editable defaults. Preserve unknown values. Do not ask for the same exact variant again. |
| Profile → Watch | Carry the selected printing and valuation context. Match an existing watch only when its actual context matches. A different context must not silently overwrite a watch. |
| Authentication interruption | Preserve the pending Add/Watch intent and selected identity/context through the existing sign-in flow. Saving remains explicit; signing in alone must not create ownership or duplicate a write. |
| Back or cancel | Return to the actual originating screen with query, language, filters and useful focus/scroll context retained. No extra navigation loop. |

Use the existing supported currency/provider contract. Do not add conversion or silently recast EUR evidence as USD. If an existing currency context is unsupported by the profile, show that limitation rather than attach a different market's value.

## Acceptance criteria

| ID | Evidence required |
| --- | --- |
| C1 | UI-click tests open a same-name/number English and Japanese pair with close finishes from search. Correct identity reaches profile and the existing Add/Watch payloads. |
| C2 | Raw and graded Watchlist entries load their saved context and finish in matching-price, unavailable, or retryable-error states. A lone raw watch does not count as a matching graded watch. |
| C3 | Opening an owned position selects that position even when other copies have different conditions or grades. Research changes send no ownership/watch mutation. |
| C4 | Explicit PSA 10 research → Add and Watch prefills PSA 10 for the selected printing; raw unknown remains unknown. Existing acquisition details/lots are preserved. Different-context watches are not silently overwritten. |
| C5 | Sign-in interruption and failed save retain intended identity/context and draft values. Retry is idempotent; Back/cancel returns to the origin with useful focus and selected filters. |
| C6 | Slow/failed requests, navigation to another card, and rapid context changes cannot cross-contaminate prices, selections, action payloads or watches. |
| C7 | Existing 390px mobile and desktop layout remains concise and keyboard-usable; watch detail does not introduce persistent loading or duplicate confirmation screens. |

Favor end-to-end UI entry tests for this packet. Existing direct `openCardDetail` fixture tests remain useful but do not alone prove entry routing. Reuse fixtures and existing search/detail/add/watch recovery tests. Validate the request/persistence boundaries without private user data; clearly label mocks and do not claim they prove live database persistence.

## Explicit exclusions

No layout redesign, new navigation structure, sold-history expansion, alerts, population ingestion, bulk imports, trade matching, marketplace checkout, billing, new providers, production dependencies, schema overhaul or platform change. Preserve Packet 01's exact-identity, raw/graded and pending/error boundaries. Follow the existing approval requirements for production or destructive operations.

## Verification and handoff

Implement this packet only. Run relevant existing and new regression tests plus repository-required checks appropriate to the changed files. Do not repeatedly run broad suites once stable or broaden into unrelated baseline failures. If a requirement already passes, cite its evidence and leave its implementation alone.

Create `docs/evidence/SOL_PACKET_02_REPORT.md` containing:

- Before/after behavior and files changed relative to the recorded starting workspace.
- C1–C7 PASS/FAIL/NOT VERIFIED with exact tests, commands and results.
- A short entry-path → profile-context → Add/Watch payload matrix.
- Desktop/mobile screenshots for watched raw, watched graded and action-prefill states; reuse evidence where one capture covers multiple criteria.
- Authentication/retry/no-unintended-write evidence and any live-provider, persistence or physical-device gaps.
- Known limitations and product decisions needing Astra review.

Return the report path and concise summary, then stop for Astra review. Do not advance to sold-price history or deploy. If all criteria already pass, an evidence-only completion is valid.
