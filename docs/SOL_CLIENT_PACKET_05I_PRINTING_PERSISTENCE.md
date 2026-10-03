# CLIENT-05I — Detailed-printing persistence proof

Owner: Astra. Implementer: Sol. Date: 2026-09-24. Status: sole active packet, bounded Step 5 verification. Stop for Astra review when finished.

## Required approach

Use `ponytail:ponytail` in **full mode**. Read its installed `SKILL.md` before task work, reuse existing implementation first and choose the smallest correct change. If unavailable, report that fact. Do not reduce client functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting or approval gates.

Read `AGENTS.md`, `docs/MICA_SOFTWARE_ROADMAP.md`, `docs/MICA_CLIENT_PIVOT_2026-09-17.md`, `docs/evidence/ASTRA_CLIENT_PACKET_05H_ACCEPTANCE.md`, the revised 05H report and `docs/evidence/SOL_CLIENT_PACKET_03_REPORT.md`. Read the installed `supabase:supabase` skill before database work. Inspect `tests/graded-copy-persistence.test.js` and the current normalization → selection → save adapter/RPC → persisted snapshot → fresh load/hydration → detail/valuation path.

## Outcome

Prove a collector's selected detailed printing and its uncertainty survive a real local database save and a fresh authenticated session. The prior 05H browser fixtures and CLIENT-03 persistence proof do not cover this new path together. This packet adds only focused tests/harness and evidence; reuse the current application and schema. If a defect needs application or migration changes, retain a failing reproduction and report it for Astra's next revision packet.

## Execution and acceptance

1. Reuse CLIENT-03's already installed local tooling and existing guarded test workflow. Use a disposable, isolated local test database with synthetic users/records only. Verify the endpoint is localhost/127.0.0.1 on port 54321 before any database request. Confirm ownership of the test stack; do not reset a shared database or delete unrelated containers/volumes. Applying existing schema/migrations to a newly created disposable test database is in scope; new migrations, production-baseline repair and shared-database changes are not.
2. Freeze synthetic inputs before measurement: two distinguishable detailed printings of the same card, plus a printing with absent edition/stamp facts and a language/foil-restricted case. Use the corrected `variantId`/stamp source shape. These are synthetic acceptance cases, not newly verified catalog or provider records.
3. Exercise the production save serialization/adapter and current database RPC, not only a hand-assembled JSON insert. Assert stored identity snapshots retain the source namespace, source variant ID, printing facts and metadata including absent-versus-empty distinctions. Namespaced source references must not be inserted into UUID columns. Preserve the existing distinction between database variant IDs and source references.
4. Discard the original client/session and all fixture memory. Authenticate a new client, load the saved rows through the production read/hydration path and reopen the selected copy. Compare against the frozen inputs. Prove uncertainty and restrictions remain in the valuation consumer, with unresolved cases still unavailable. An explicit synthetic printing can prove identity eligibility, not a real numeric market estimate.
5. On reload, reorder the source options, then omit the selected detailed record. Prove the saved source reference is not reassociated with another printing or reduced to a finish-only selection; the missing record remains review-needed. Keep separate copies independently addressable and verify sibling identity, acquisition, certificate and transaction facts remain unchanged. Reuse the existing retry/idempotency checks to show a retried save does not duplicate the copy.
6. Reuse the existing owner-isolation assertions with the new saved identities: a second account and anonymous client cannot read or mutate the owner's copies. Any service-role client is setup/cleanup only, never the actor establishing owner authorization.
7. Include one focused real-save/fresh-reopen browser check if supported by the current local harness, with synthetic catalog responses and paid-provider traffic blocked. Clearly identify which segments reach the real local database and which are replayed. If the UI boundary cannot be connected without application changes, report that remaining boundary explicitly; do not call fixture hydration a complete end-to-end pass.

## Operational limits

No `.env.local`, `.env.production.local` or hosted secret access. Generate disposable local credentials through existing local tooling and keep them out of reports/logs. Do not install or upgrade platforms/dependencies. Use existing installed local images/tooling; if unavailable, make a bounded startup diagnosis, complete independent test/evidence work and mark the real database gate blocked. A skipped guarded test is not a pass.

No catalog, image, recognition, ECB or paid-provider requests. Block test egress beyond the isolated local services. No certificate activation, hosted mutation, transaction FX, deployment, commit or CLIENT-06 work. Preserve the dirty worktree. Clean up only synthetic entities and test resources created by this run; record cleanup and remaining listeners without touching unrelated services.

## Deliverable and review gate

Write `docs/evidence/SOL_CLIENT_PACKET_05I_REPORT.md`: exact source hashes/commands; input-to-stored-to-reopened comparisons; non-skipped database result; browser boundary evidence where available; owner/retry/sibling assertions; defects and any blocked boundaries; cleanup and request accounting. Retain only synthetic, secret-free artifacts. Run the focused database and affected identity/valuation checks, plus lint/typecheck for changed test code and diff/format checks. Broader checks are needed only if the changed scope justifies them. Do not rerun unrelated suites to inflate evidence.

Report whether durable printing persistence is proven, failed or blocked. Step 5 real-sale numeric and provider-rights gates remain open regardless of this result. Stop for Astra review.
