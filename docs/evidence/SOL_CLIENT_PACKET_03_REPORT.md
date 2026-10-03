# Sol CLIENT-03 evidence — physical graded copies

Date: 2026-09-20  
Decision requested: **Astra review**

CLIENT-03 now passes its disposable local-database gate. The test used synthetic accounts and data in a new Colima profile, applied the repository migration chain locally, exercised the real Supabase API/RLS/RPC paths, removed all synthetic rows, destroyed the packet-created Supabase containers and volumes, and stopped the profile. No hosted database, provider, deployment, or CLIENT-02 certificate integration was touched.

CLIENT-02 remains open. Certificate and grade values in this flow remain user claims; no PSA or Beckett access is implied.

## Result

- Copies A/B/C persisted as three quantity-one rows with separate certificates, dates, costs, and histories. Fresh authenticated clients reopened them. Selling B changed only B to sold/zero remaining quantity; A and C stayed owned at quantity one.
- Concurrent identical creates returned one copy ID both with and without a certificate.
- Different idempotency keys racing for one active same-owner grader/certificate produced one success and one `duplicate_active_certificate` rejection.
- Concurrent sales produced one committed sale and one `graded_copy_sale_unavailable` response. Repeating the successful key returned the original transaction ID.
- A second account could not read or update the owner's copy, attach a child transaction, or sell it.
- Specialized create, generic create, direct update, and grading-return paths could not persist a user-submitted `gradeClaimSource: official`; the database boundary stored `user`.
- Unknown cost/date remained unknown, a known zero remained known zero, and a USD sale against a EUR copy failed with `currency_mismatch` without changing the copy.
- Full Node result with the database test enabled: **417 passed, 0 skipped, 0 failed**.

## Root cause found during the rehearsal

The first real sale race failed before the concurrency assertion with PostgreSQL `23514`: the existing sale ledger correctly represents a fully disposed position as quantity zero, while `collection_items_quantity_check` still required quantity at least one.

The narrow correction is `supabase/migrations/20260920200000_complete_graded_physical_copy_sale.sql`. It changes the existing bound from `1..99999` to `0..99999`, using `NOT VALID` followed by validation. It rewrites no rows and does not alter the upper bound. This is the shared persistence invariant used by the existing sale ledger, rather than a special-case workaround in the new RPC.

The correction was added as a new forward-only migration instead of editing the already rehearsed CLIENT-03 migration or resetting migration history. Before applying it, the local migration list showed exactly `20260920200000` pending. `supabase migration up --local` applied only that migration; afterward the local database contained all 75 repository versions, latest `20260920200000`, with zero pending local rows.

## Local tooling and isolation

Existing tooling was inspected first:

- No working `supabase`, `docker`, `colima`, or `psql` command was initially available.
- The shared Homebrew prefix was owned by another macOS account and was not writable. The failed Homebrew attempt installed nothing; permissions were not changed and `sudo` was not used.
- Existing Docker contexts `colima-mica-step8` and `colima-mica-step9` were discovered and left untouched. Only `mica-step9` currently appeared as a stopped Colima profile.

Only user-local release binaries were installed under `/Users/Elliottrouse/.mica-tools`:

| Tool         | Version | Purpose                                                              |
| ------------ | ------- | -------------------------------------------------------------------- |
| Supabase CLI | 2.117.0 | Start/apply/check the disposable local stack                         |
| Colima       | 0.10.3  | New isolated VM/profile                                              |
| Lima         | 2.2.0   | Colima runtime requirement                                           |
| Docker CLI   | 29.8.1  | Address the isolated daemon and inspect/query its database container |

Release archives/bottles were checksum-verified. No project dependency or lockfile changed.

The new profile was `mica-client-03`, with its own socket at `/Users/Elliottrouse/.colima/mica-client-03/docker.sock`. Before startup it had zero containers, images, and volumes. Every migration or database-test command asserted all of the following before execution:

1. that exact socket existed;
2. the database container was exactly `supabase_db_jordan-pokemon-app` in that daemon;
3. Supabase reported API `http://127.0.0.1:54321`;
4. the PostgreSQL URL targeted `127.0.0.1:54322/postgres`; and
5. the expected latest local migration was present when tests ran.

The stack used the repository's disabled seed setting and no `.env.local` or hosted credential. Locally generated development credentials were passed only as process environment to the test and are not stored in the repository or this report.

### Network limitation

Although Supabase reported loopback URLs and the test itself hard-fails for any non-loopback API URL, Colima's SSH forwarding listened on host interfaces while the VM was active. The stack was therefore isolated by daemon/profile and data, but not strictly loopback-bound at the host listener. It ran only with synthetic data and was torn down immediately after verification. Ports 54321–54324 are now closed. A future rehearsal on an untrusted network should first configure host-loopback-only forwarding or an equivalent local firewall rule.

## Actual database proof

`tests/graded-copy-persistence.test.js` uses `@supabase/supabase-js`, already in the repository, against the real local Auth/PostgREST/RPC stack. It creates two confirmed synthetic users and cleans them through the local admin API in `finally`.

| Required boundary            | Database operation and observed result                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A/B/C persist; sell B only   | Created A/B/C for the same canonical identity with separate cert/date/cost. A new authenticated client read all three and their purchase rows. It sold B; another new client found A/C `owned`, quantity 1, B `sold`, quantity 0, and B's purchase plus sale history with $70 net proceeds. |
| Identical create, no cert    | Two simultaneous `create_graded_copy_position` calls with one retry key both succeeded and returned the same UUID.                                                                                                                                                                          |
| Identical create, cert       | Two simultaneous calls with one retry key and certificate both succeeded and returned the same UUID.                                                                                                                                                                                        |
| Competing same certificate   | Two simultaneous calls with different retry keys and the same owner/grader/certificate yielded one UUID and one `duplicate_active_certificate` error.                                                                                                                                       |
| Concurrent sale/retry        | Two sale keys raced one copy: one committed and one returned `graded_copy_sale_unavailable`. Retrying the winner returned its original sale transaction UUID.                                                                                                                               |
| Cross-account isolation      | The second user read zero rows and updated zero rows; its direct child insert was rejected; its selected-copy sale returned `copy_not_found`.                                                                                                                                               |
| Official provenance spoofing | Specialized create, generic `create_collection_position`, relevant direct update, and `record_grading_result` attempts all read back `gradeClaimSource: user`.                                                                                                                              |
| Unknown vs zero              | Unknown cost/date stored `cost_basis_known=false` and `acquired_at_known=false`; its portfolio remaining basis was `null`. Known zero stored both flags true and remaining basis `0`.                                                                                                       |
| Currency boundary            | A EUR copy rejected a USD sale with `currency_mismatch` and remained `owned`, quantity 1, currency EUR.                                                                                                                                                                                     |

After the targeted run, a live database count was `collection_items=0` and `auth.users=0`, confirming synthetic cleanup. The same integration then passed inside the full suite.

## Migration rehearsal and preservation

- The isolated empty database applied the full existing repository chain in filename order. No migration was edited, marked applied, repaired, or removed.
- The initial chain through `20260918160000_graded_physical_copies.sql` exposed the quantity constraint defect described above.
- The forward-only correction was applied with `migration up --local`; the database then reported 75 applied versions, latest `20260920200000`, and no pending local migration.
- No seed, hosted data, existing local database, or existing Colima volume was used.
- The global production-baseline check remains intentionally unresolved: there are 75 local files and 58 production history rows, producing 18 local pending names against the recorded 15-name approved set. The three additions outside that recorded set are the pre-existing `deliver_device_alerts` plus this packet's `graded_physical_copies` and `complete_graded_physical_copy_sale`. The baseline file and production history were not changed.

## Test results

| Command/scope                                                                                                                             | Result                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Guarded `node --test tests/graded-copy-persistence.test.js`                                                                               | **1 passed, 0 skipped, 0 failed**; real local database, 1.47 s                                    |
| Guarded `npm test`                                                                                                                        | **417 passed, 0 skipped, 0 failed**; database integration executed, 2.53 s                        |
| `npm run lint`                                                                                                                            | Passed; 84 source files                                                                           |
| `npm run typecheck`                                                                                                                       | Passed                                                                                            |
| `npm run test:schema`                                                                                                                     | Passed; 83 public tables, RLS enabled on all                                                      |
| `npm run build`                                                                                                                           | Passed; local static bundle generated                                                             |
| `MICA_CLIENT_03_CAPTURE=1 npx playwright test tests/browser/physical-copies.spec.js --project=desktop-chromium --project=mobile-chromium` | **4 passed, 0 failed**; 8.4 s                                                                     |
| Scoped `git diff --check`                                                                                                                 | Passed                                                                                            |
| `npm run check:migrations`                                                                                                                | Expected gate failure: pending local names differ from the approved baseline; no repair performed |

The database regression is guarded and skips when its three explicit local variables are absent. It additionally rejects any API hostname other than `127.0.0.1`/`localhost` or any API port other than 54321.

## Screenshots

The accepted layout was preserved; the focused browser suite recaptured these after the database correction.

### Desktop

- [Grouped inventory](sol-client-03/desktop-grouped-inventory.png) — 1440 × 1318; one group, two active and one sold.
- [Copy navigation](sol-client-03/desktop-copy-navigation.png) — 1440 × 1720; three distinct selectors with per-copy facts.
- [Selected B history](sol-client-03/desktop-sold-copy-history.png) — 1440 × 2578; B's purchase, certificate, sale, fees, and P/L remain attached.

### Mobile emulator

- [Grouped inventory at 390 CSS px](sol-client-03/mobile-390-grouped-inventory.png) — 1170 × 4191 at DPR 3.
- [Copy navigation at 390 CSS px](sol-client-03/mobile-390-copy-navigation.png) — 1170 × 5418 at DPR 3.
- [Selected B history at 390 CSS px](sol-client-03/mobile-390-sold-copy-history.png) — 1170 × 8394 at DPR 3.

The mobile evidence is Chromium emulation, not a real iPhone. No interface code changed in this final local-database pass.

## Files changed for CLIENT-03

- `app.js` — quantity-one graded entry, exact copy navigation, selected-copy add/sale/history UI, and safe accounting display.
- `styles.css` — responsive copy controls and fact layout.
- `lib/domain.js` — exact graded-copy context/group helpers.
- `lib/supabase-data.js` — provenance/qualifier hydration, currency-safe costs, and graded RPC routing.
- `supabase/migrations/20260918160000_graded_physical_copies.sql` — retry/certificate serialization, selected-copy sale, and shared provenance boundary.
- `supabase/migrations/20260920200000_complete_graded_physical_copy_sale.sql` — forward-only zero-quantity sold-state constraint correction found by the rehearsal.
- `tests/domain.test.js` — grouping and accounting boundaries.
- `tests/security.test.js` — SQL contract and privilege checks, including the corrected quantity bound.
- `tests/graded-copy-persistence.test.js` — real local Auth/RLS/RPC concurrency, durability, provenance, ownership, unknown-fact, and currency regression.
- `tests/run.js` — includes the guarded real-database regression.
- `tests/browser/physical-copies.spec.js` and retained related browser tests — current handler/UI behavior and screenshots.
- `docs/evidence/sol-client-03/*.png` — refreshed desktop/mobile evidence.
- `docs/evidence/SOL_CLIENT_PACKET_03_REPORT.md` — this report.

The repository was already materially dirty. Existing work was preserved; no unrelated cleanup or commit was made.

## Cleanup state and instructions

Completed cleanup:

- The two synthetic users and all cascading packet rows were deleted before shutdown.
- `supabase stop --no-backup` removed the 12 packet-created containers and all 3 volumes from the isolated daemon; post-check: zero containers, zero volumes.
- `mica-client-03` is stopped; ports 54321–54324 are closed.
- The existing step-8/step-9 Docker contexts remain untouched; the pre-existing `mica-step9` profile remains stopped.

Retained for a reproducible review rerun:

- `/Users/Elliottrouse/.mica-tools` with the four user-local CLI binaries.
- The stopped, empty `mica-client-03` VM/profile and downloaded container images.

If Elliott later wants those retained prerequisites removed, delete only the new profile with `/Users/Elliottrouse/.mica-tools/bin/colima delete --profile mica-client-03`, then remove `/Users/Elliottrouse/.mica-tools` only after confirming no other local work uses it. Neither removal was necessary for this packet and neither was performed.

## Limitations

- This proves the local migration chain and real Supabase behavior, not hosted production state. The two CLIENT-03 migrations remain unapplied to hosted data.
- The migration-baseline reconciliation remains a separate approval gate; it was reported, not repaired.
- Session reopening is proven with newly constructed authenticated Supabase clients against persisted rows. Browser UI/session continuity remains mocked by the existing Playwright handler tests.
- Screenshots are desktop/mobile Chromium, not physical-device evidence.
- Official PSA/Beckett certificate provenance remains blocked on CLIENT-02 provider access and terms. The current boundary intentionally treats all user-originated claims as `user`.
- The temporary host-listener behavior described above should be tightened before another local stack is left running on an untrusted network.

## Copy-ready summary for Astra

> CLIENT-03 now passes its disposable real-Supabase gate. I installed only checksum-verified user-local Supabase 2.117.0, Colima 0.10.3, Lima 2.2.0, and Docker CLI 29.8.1, using a fresh `mica-client-03` daemon/profile with synthetic users and data. The first sale race exposed a real shared-schema defect: the existing ledger sells a full position to quantity 0 while the collection constraint required quantity >=1. A new forward-only migration changes that bound to 0..99999 without rewriting data; it was applied locally after the original CLIENT-03 migration, with no reset or migration-history repair. Real API/RLS/RPC tests prove A/B/C persistence and selected-B sale isolation; same-ID concurrent creates with and without certs; rejection of distinct creates sharing an active cert; one-commit concurrent sales and idempotent retry; cross-account denial; database-enforced user provenance; and unknown/zero/currency boundaries. Results: 417/417 Node tests, 84-file lint, typecheck, 83-table RLS validation, build, and 4/4 refreshed desktop/mobile Playwright cases pass. The expected production migration-baseline gate still fails and was not modified. The synthetic users/rows, 12 containers, and 3 new volumes were removed; the new profile is stopped and ports are closed. No hosted change, dependency, provider credit, deployment, or CLIENT-02 work occurred. Ready for Astra review.
