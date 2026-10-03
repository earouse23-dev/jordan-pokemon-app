# Sol CLIENT-03 — individual graded copies and selected-copy sale

## Required skill

Use `ponytail:ponytail` in full mode. Read its installed `SKILL.md` before working. Trace and reuse the existing inventory/transaction implementation, choosing the smallest correct change without speculative abstractions or dependencies. Do not simplify away requested functionality, ownership checks, data preservation, accessibility, acceptance tests, evidence or approval gates. Report if the skill is unavailable. Mention what existing implementation was reused in the evidence report.

## Authority and outcome

Elliott approved this independent inventory slice while PSA/Beckett replies are pending. Read `AGENTS.md`, the complete original software roadmap, the current client-pivot roadmap (including its scheduling exception), and CLIENT-01/02 evidence. CLIENT-02 is still open; this packet does not waive official certificate access.

Deliver one usable flow: save three physically distinct copies of the same graded card, reopen each with its own purchase facts, and record a sale against exactly the selected copy. Reuse the existing application and persistence model. Do not start any other packet.

## Inspect before editing

Trace `createPosition`, `createIdentifiedGradePosition`, `recordSale`, inventory hydration and existing UI in `lib/supabase-data.js`/`app.js`; the current definitions of `create_collection_position` and `record_collection_sale`; collection items, owned copies, purchase lots, FIFO allocations, transactions and grading lineage. Some entities may be legacy: determine the actual source of truth before choosing one. A new physical-copy table is not the default solution.

Record a short current-path → necessary-change map. In particular, establish whether a quantity-one graded position already represents a physical copy and whether merging/FIFO can select a different copy. Preserve unrelated dirty work and existing raw/sealed inventory. Do not rewrite legacy records into guessed physical copies.

## Required behavior

- New graded-copy entry records a stable owned-copy identity, canonical printing/language/variant, grader, exact grade and qualifier, certificate string when known, and purchase date/amount/currency when known. Preserve leading zeros in certificates and half-grades. Unknown purchase cost/date remain unknown, never manufactured zero/today.
- A copy's certificate and grade are user-supplied claims unless backed by a real official source. Store the appropriate provenance without building the provider integration. Manual fixture entry here tests inventory independently; it does not satisfy the client's final certificate workflow.
- Group identical printing/language/variant/grader/grade/qualifier contexts for display, with a derived active-copy count. Within the group, offer horizontal copy navigation plus accessible previous/next controls and a clear copy indicator. Different purchases/certs stay separate. Sold copies remain reachable in history, not silently removed.
- Each new graded copy has quantity one internally. Repeated Add actions for distinct copies remain distinct; retrying the same action retains its idempotency key and creates no duplicate.
- Detect an already-active same-owner grader+certificate duplicate and guide the user to the existing copy. Do not impose cross-account public uniqueness or reveal another owner's records. Missing certificates must not collapse distinct copies. Preserve historical sale/reacquisition records rather than overwriting them.
- Save and reopen through real persistence, not browser-only state. Refresh/new session retains the chosen copy's facts. Failure preserves entered values and offers retry without claiming success.
- Record sale from the selected copy: date, proceeds, explicit currency and optional existing fee fields. Bind the operation to its stable copy ID. No group-level FIFO substitution. Atomic and idempotent writes prevent partial disposition, double sale and two concurrent sales of the same copy.
- Sale removes only that copy from active inventory; retains its acquisition, certificate and sale history. Do not rebuild graphs or valuations. Where existing totals depend on inventory, ensure the sold copy is not counted as active and no history is erased.
- Keep the screen concise: copy identity, acquisition facts, status and next useful action. No new navigation system, tutorial or extra confirmation if the existing form already supplies the necessary information.

## Accounting boundaries

Preserve original transaction currencies and amounts. Do not add FX or sum unlike currencies. Reuse established cost/fee calculations; document how a purchase amount and sale amount map to them. Missing cost means unavailable P/L. If existing UI shows copy-level realized P/L, use net sale proceeds minus known allocated acquisition cost only when currencies are compatible; otherwise display unavailable. Zero cost is distinct from unknown cost, and zero denominators cannot produce a percentage. No new portfolio analytics in this packet.

## Database and environment boundaries

Prefer existing schema/RPCs. If insufficient, a minimal additive migration file and rollback/reconciliation proposal may be prepared, with preservation and ownership tests. No destructive migration, legacy backfill, migration-history repair or hosted database change is authorized. Inspect the previously reported migration-baseline mismatch; do not silently fix it or include unrelated migrations.

Use only an isolated local test database and synthetic accounts for writes. Verify it is local/disposable before changing it; do not reset a database containing unknown/user data. Do not use production credentials or a linked hosted database as a test target. If a safe local database is unavailable, complete offline work and report the persistence gate blocked. Hosted test setup requires separate approval.

All copy, transaction and group reads/writes must enforce actual ownership, including parent/child relations. UI filtering is not authorization. Preserve owner-bound auth-interruption recovery and idempotency. Never expose service/provider secrets or weaken RLS to make tests pass.

## Acceptance tests

1. Save copies A/B/C of the same English PSA 10 printing with distinct synthetic certificate strings, costs and purchase dates. The group shows three; each copy reopens with its own data after reload/session restart.
2. Save a different language, variant, grade or qualifier: it does not join the wrong group. Include BGS 9.5 and a qualifier distinction in fixtures.
3. Sell B, not the earliest acquisition. A/C remain active with unchanged facts, group count becomes two, and B retains purchase/sale history. Repeat the same request and simulate two competing requests: only one sale succeeds.
4. Test unknown cost/date, known zero cost, fees and incompatible currencies. No fabricated cost, date, conversion or profit.
5. Same-owner duplicate certificate, two distinct missing-cert copies, lost-response retry, expired session, account switch and persistence failure behave safely.
6. Synthetic user B cannot read, update or sell user A's copy or attach a transaction to it. Demonstrate database authorization, not just mocked UI behavior.
7. Existing quantity>1 legacy positions are preserved and not silently assigned invented certificates or per-copy costs. If an aggregate cannot safely support selected-copy sales, show a scoped unavailable/correction path and report it; do not sell an arbitrary lot.
8. Relevant unit, transaction/authorization and browser tests pass. Capture the grouped inventory, copy navigation and B's sold history at desktop and 390px mobile. Keyboard controls and focus work. Emulator evidence is not physical-device proof.

## Exclusions and report

No PSA/Beckett calls, provider emails, pricing probes, OCR/scanner changes, new valuation algorithms, FX integration, charts, trades, imports, storage-location features, bulk edits, payments, new dependencies, Capacitor/iOS work, deployment or commit. Readonly provider access is not needed; provider credit budget is zero.

Return `docs/evidence/SOL_CLIENT_PACKET_03_REPORT.md` with the existing-path map, files changed, migration proposal if any, exact tests/results, screenshots, local real-persistence and ownership evidence, limitations and decisions. Distinguish synthetic unit/mock browser, real local database, hosted and physical-device evidence. Do not claim Step 3 complete unless its persistence gate passes. Stop for Astra's ACCEPT/REVISE/BLOCKED decision; no next-packet work.
