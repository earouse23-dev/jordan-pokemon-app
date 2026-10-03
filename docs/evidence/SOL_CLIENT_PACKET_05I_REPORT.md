# SOL CLIENT-05I — detailed-printing persistence proof

**Revision result (2026-09-24): R1 fixed; R2 proven for synthetic local persistence and browser save/reopen.** The original blocked result below is retained as the pre-revision record. The separately owned disposable stack was stopped and its volumes removed after verification. Real provider-sale and production-rights gates remain open. See the appended revision evidence.

Date: 2026-09-24. **Result: blocked; durable printing persistence is not proven.** The requested isolated, disposable database could not be started on the required port because a pre-existing `mica-dev` Supabase stack already owns port 54321. I did not use, reset, stop, or mutate that stack. A separate offline fresh-load reproduction also fails at the detail selection boundary. This packet made no application or migration change and stops for Astra review.

I used `ponytail:ponytail` in full mode after reading its installed skill, and read `AGENTS.md`, both roadmaps, Astra's 05H acceptance, the revised 05H report, the CLIENT-03 report, the 05I packet, and the installed `supabase:supabase` skill. The only additions are the [guarded persistence test](../../tests/detailed-printing-persistence.test.js), the [offline failing reproduction](sol-client-05i-reopen-probe.mjs), and this report. Existing dirty work and data were preserved.

## Frozen synthetic cases and path

`tests/detailed-printing-persistence.test.js` holds one static JSON string, parsed only when needed. Its four **synthetic** `variants_detailed` records use observed `variantId` and documented field names. They are not real catalog/provider records.

| Source record | Frozen facts                                                                                    | Normalized expectation               | Stored/reopened expectation                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| `plain`       | Holo, standard, `subtype:'unlimited'`, `stamp:[]`                                               | Exact unlimited, no extra stamp      | Namespaced source ID and empty stamp array retained; database `variant_id` null. |
| `first`       | Holo, standard, `stamp:['1st-edition']`, subtype absent                                         | Exact first edition                  | Distinct source ID and first-edition fact retained.                              |
| `unknown`     | Holo, standard; subtype and stamp absent                                                        | Edition/promo unknown, review needed | Both `subtypePresent` and `stampPresent` false; no numeric estimate.             |
| `restricted`  | Holo, standard, unlimited, `stamp:[]`, `languages:['ja']`, `foil:'masterball'` on English route | Review needed                        | Both restrictions retained in metadata; no ordinary exact holo estimate.         |

The prepared real-database test uses `normalizeTcgdexCard` → `collectibleIdentitySnapshot` → production `createPosition` adapter → existing `create_graded_copy_position` RPC → stored `collection_items.identity_snapshot` → new authenticated client → production `loadPortfolio`/`hydratePosition` → `selectVariantOption` and `exactSoldValuation`. It would check two distinguishable printings, missing versus empty facts, source namespace versus UUID column, fresh-session reload, source reordering and removal, retry idempotency, separate certificate/acquisition/transaction facts, second-account and anonymous isolation, and cleanup. It requires an explicit disposable-run marker, the `colima-mica-client-05i` Docker context and a loopback URL on port 54321; its local client transport rejects all other destinations. Its service-role client is limited to synthetic user setup/cleanup. **None of its database assertions ran**, so these are prepared checks, not accepted evidence.

The separate offline adapter assertion did run: `createPosition` sent the namespaced source reference inside `p_identity.variantId` and `p_identity.variantMetadata`, with `p_variant_id:null`, to the existing graded-copy RPC name. This uses a fake RPC response and proves serialization only; it does not establish a committed row or the application's private form-to-adapter UUID guard.

## Blocking stack and observed failure

`docker context show` returned `colima-mica-dev`; `colima list` showed its running profile. `docker ps` showed a healthy pre-existing `supabase_db_jordan-pokemon-app` plus the rest of its stack. `lsof -nP -iTCP:54321 -sTCP:LISTEN` showed a pre-existing SSH forward listening on `*:54321`. The database container's labels point at this repository, but they do not establish that this packet owns the profile or its data. A second disposable stack cannot bind the required host port while that listener remains. Using the current database would violate the packet's ownership and isolation gate. No CLI start/reset/stop, database query, Auth call, or RPC was sent.

The offline reproduction constructs one exact synthetic detailed printing, takes its production identity snapshot, simulates the production hydrated row shape, then calls the same `selectVariantOption` used by `app.js`'s detail `selectedPrinting` path. It exits **1**:

| Boundary                                                      | Expected                                                                                                                       | Observed                                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Snapshot                                                      | `identityStatus:'exact'`, namespaced `variantId`                                                                               | Exact; source ID retained.                                                                       |
| Hydrated row                                                  | Same status and ID                                                                                                             | Exact; source ID retained.                                                                       |
| Fresh detail selection with no `variantOptions` on loaded row | Retained selected printing remains eligible from saved evidence, or is explicitly revalidated without being mislabeled missing | `status:'needs_review'`, `identityEvidence:'missing_detailed_variant'`; source ID still matches. |

The last assertion deliberately fails with `expected 'exact', actual 'needs_review'`. The selector recognizes the namespaced ID but treats it as a _removed_ source record whenever the freshly hydrated copy has no catalog options. `app.js`'s `selectedPrinting` then uses that missing state and suppresses exact valuation. This is an offline source-to-hydration/detail failure, **not** a measured database persistence failure. No application fix was made under this packet's boundary; Astra should issue a revision that distinguishes “catalog options not loaded” from “selected source record was explicitly removed,” then rerun the guarded real-save test.

## Commands and results

| Command                                                                                                                                                                                   | Result                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `node docs/evidence/sol-client-05i-reopen-probe.mjs`                                                                                                                                      | **Exit 1, expected failing reproduction**: saved/hydrated exact became missing detailed variant at selection. No request.                     |
| `node --test tests/detailed-printing-persistence.test.js tests/detailed-printing.test.js tests/identity.test.js tests/exact-sold-valuation.test.js tests/graded-copy-persistence.test.js` | **22 passed, 2 skipped, 0 failed**. The new offline adapter check passed. Both guarded database tests skipped; a skip is not a database pass. |
| `npm run lint`; `npm run typecheck`                                                                                                                                                       | Passed. The repository scripts do not include the new standalone test file, so it was also checked directly.                                  |
| `node --check tests/detailed-printing-persistence.test.js`; `node --check docs/evidence/sol-client-05i-reopen-probe.mjs`; scoped Prettier check                                           | Passed.                                                                                                                                       |

No real-save/fresh-reopen browser result is claimed. The current physical-copy browser harness injects fixture items and stubs Supabase rather than authenticating against a disposable local database; the required isolated database was unavailable. An offline browser replay would not close that boundary.

## Source hashes (SHA-256)

| File                                                 | SHA-256                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `app.js`                                             | `fdc28e6b72a3f254b3d0c43d4b2be165f74819a4dcbdbca9a847c525073e75f2` |
| `lib/providers/tcgdex.js`                            | `cfb1131afd4b3f384f8a00d12123d2cdd1f6e34c0115982f20a86a082de8ca78` |
| `lib/identity.js`                                    | `0ad44dca57b2ed7a72923cad22e6d8059a5e74a446d60ec24e81c28335f34412` |
| `lib/supabase-data.js`                               | `88c21754eabad2a47c86b3a648f5287713b02f5b9cfe22982c923caa3cb1a1de` |
| `lib/pricing.js`                                     | `878984d5cd1f9b03761034be32670ab701e604054afb4014a9d3113725242fa9` |
| `tests/detailed-printing-persistence.test.js`        | `a80ad1a9dad56f9a2597cb58717c92c11961cd49ac0daee5f5a9017d0309c097` |
| `docs/evidence/sol-client-05i-reopen-probe.mjs`      | `801bbf868febdcca92a06e78fc4c52d6256b7cd7288636d7f29071bd66ac583b` |
| `docs/SOL_CLIENT_PACKET_05I_PRINTING_PERSISTENCE.md` | `714b9f0d423f3a655442e53e9f7832187f07979639b20845a56d0510df7f4b18` |

## Cleanup, requests, and remaining gates

This run created **zero** users, rows, containers, volumes, or test listeners and sent **zero** database/Auth/RPC, catalog, image, recognition, ECB, or paid-provider requests. It made no hosted mutation. There was therefore no synthetic database entity to remove. The pre-existing `mica-dev` stack and `*:54321` listener remain as found; they were not started or stopped here. No environment file or hosted secret was opened. No migration, deployment, commit, transaction conversion, or CLIENT-06 work occurred.

Durable printing persistence, fresh authenticated reopen, owner/RLS and retry behavior for these new identities, and real-browser save/load remain **blocked**. The prior CLIENT-03 database proof covers older copy facts, not this detailed-printing path. Real-sale numeric validation and provider production retention/display rights also remain open. **Stop for Astra review.**

---

## CLIENT-05I revision — R1 and R2 evidence (2026-09-24)

**Outcome:** The original blocked result above was accurate for its run. Under `docs/SOL_CLIENT_PACKET_05I_REVISION.md`, the unchanged reopen probe now passes, and a distinct disposable local database proves the synthetic persistence path without a skip. The existing form saved through the real RPC and reopened after a fresh browser-context login on desktop Chromium and mobile WebKit. This is local synthetic evidence pending Astra review, not real provider-price or production-data-rights approval. Work stops here for Astra review.

I read the installed `ponytail:ponytail` skill and used full mode, then read AGENTS.md, both Mica roadmaps, the original and revision 05I packets, Astra's 05I review, the corrected 05H report/revision, and the installed `supabase:supabase` skill. I traced `selectVariantOption` callers, snapshot creation, portfolio/watchlist hydration and `app.js:selectedPrinting`. The application change is limited to existing identity/provider/hydration paths; no migration, dependency, product screen, valuation rule or provider integration changed.

### R1 — state distinction and safeguards

The unchanged `node docs/evidence/sol-client-05i-reopen-probe.mjs` **failed before the fix** (exit 1: saved/hydrated exact, selected `needs_review` / `missing_detailed_variant`) and **passes afterward** (exit 0: all three exact, same source ID). The probe file hash remained `801bbf868febdcca92a06e78fc4c52d6256b7cd7288636d7f29071bd66ac583b`.

| Input at selection | Meaning and behavior |
| --- | --- |
| Saved detailed source ID, supported complete metadata, no `variantOptions` array | Catalog options have not loaded. Rebuild one candidate through the existing TCGdex normalizer, compare its source ID, card ID, finish, edition, promo, language, stored label/type and presence/value metadata, then retain exact eligibility only if the reconstructed candidate and saved status are exact. Saved metadata is retained; no refresh timestamp is added. |
| Explicit `variantOptions` array with the source record | A loaded catalog result. Match by stable source ID, regardless of order. |
| Explicit empty, fallback-only, malformed or replacement option array without the selected source | A loaded result establishes absence. Keep the selected source ID as `missing_detailed_variant`, `needs_review`; do not pick another printing. |
| Refresh failed/unavailable and no new option array | Failure does not establish deletion. The saved supported facts remain; error/freshness state is not overwritten, and no price freshness is manufactured. |
| Missing, contradictory, restricted, unsupported or unresolved saved facts | Remain `needs_review`. A namespaced ID or an `identityStatus:'exact'` string alone cannot become an exact detailed option. |

The provider normalizer now retains the observed detailed `type` in metadata for new snapshots, so a saved source type/finish contradiction is visible. Older saved snapshots without that field still pass the unchanged reopen probe when the other facts validate. Watchlist hydration retains the source variant ID in the same way as portfolio hydration. Focused cases cover missing subtype/stamp, Japanese-only language, unsupported masterball foil, malformed metadata, conflicting source references, stale finish/edition, explicit removal/empty options, source reorder, and a failed-refresh marker. Existing raw/sealed and legacy selection paths were exercised by the full unit and browser suites. The actual detail consumer shows a saved unloaded source as eligible and an explicit empty set as “Printing details incomplete” on desktop Chromium, mobile Chromium and mobile WebKit (3 passed).

### R2 — owned endpoint and database path

Before startup I checked Supabase CLI **2.117.0**, `supabase start/stop` help, the [official local CLI configuration guide](https://supabase.com/docs/guides/local-development/cli/config), installed images, the current daemon/context, and listening ports. I made **one** startup attempt. The unique temporary project was `mica-client-05i-6326e459` in `/tmp/mica-client-05i-6326e459` (real path `/private/tmp/...`). Its temp config used only a distinct project ID, existing schema, disabled seed and new service ports. Exactly 75 existing migrations were copied into the temporary project; no repository config or migration was edited. No secrets or environment files were copied.

Before any test DB/Auth request, Docker labels for the run's DB and gateway matched the unique project ID and temp workdir, the DB had its own `supabase_db_mica-client-05i-6326e459` volume, and the gateway's published port matched the CLI-reported **`http://127.0.0.1:55421`** origin. The verified published ports were API 55421, DB 55422, Studio 55423, Inbucket UI 55424, SMTP 55425, POP3 55426 and analytics 55427; shadow DB 55420 and vector 55428 were configured without additional published listeners. Ports 55420–55428 were checked unused before startup. Docker commands were scoped with the explicitly supplied `colima-mica-dev` context and project ID; the harness does **not** require a globally selected context name. The pre-existing `jordan-pokemon-app`/`mica-dev` containers remained running and healthy.

The test harness requires explicit `MICA_CLIENT_05I_DISPOSABLE=1`, credentials and ownership fields supplied process-locally from `supabase status`, loopback HTTP on a non-54321 port, project/workdir labels, DB volume and gateway port match. Its transport rejects any origin other than the verified loopback API and rejects redirects. Keys were read into the temporary runner process and never printed, persisted in a repo file or sent to the browser except the normal anon key. Negative checks exited **1 before any DB request** for missing configuration and for port 54321. The ordinary unopted focused run skipped the guarded DB case; that skip is separate from the enabled result.

`node /tmp/mica-client-05i-6326e459/run-test.mjs` ran `tests/detailed-printing-persistence.test.js` with **2 passed, 0 skipped, 0 failed**. The runner was temporary and passed CLI status credentials only through child-process environment memory. Production `createPosition` called the existing `create_graded_copy_position` RPC using an authenticated owner; service-role access was used only for synthetic user setup/cleanup. The comparison was:

The enabled browser command was `node /tmp/mica-client-05i-6326e459/run-test.mjs ./node_modules/.bin/playwright test tests/browser/physical-copies.spec.js tests/browser/card-profile.spec.js --workers=1 --reporter=dot`. Both temporary-runner commands were executed before removing that run-owned directory; their retained executable assertions are in the repository test files.

| Synthetic source | Stored row and fresh production load |
| --- | --- |
| `plain` | `variant_id:null`; identity snapshot keeps `tcgdex:en:synthetic-25:variant:plain`, `sourceVariantId:'plain'`, `stamp:[]`; reopened exact; $10 basis, one purchase, distinct certification. |
| `first` | Separate row/source ID, first-edition metadata and certificate; reopened exact; $11 basis and one purchase. |
| `unknown` | Absent stamp remains `stampPresent:false`; reopened review needed; exact sold valuation remains `unresolved_context`; $12 basis and one purchase. |
| `restricted` | `languages:['ja']` and `foil:'masterball'` remain in metadata; reopened review needed; exact sold valuation remains `unresolved_context`; $13 basis and one purchase. |

The same idempotency key returned the same `plain` copy ID; four stored rows remained four. After signing out, a new authenticated client loaded the production portfolio rows and retained the source IDs, metadata, certificates, costs and transactions. Reordered loaded options selected the same `plain` source; a loaded result without `plain` produced `needs_review` while retaining its ID. Second-account and anonymous reads/writes did not expose or change owner rows, and a subsequent owner read confirmed all four certificates/source references unchanged. Test clients signed out and the synthetic users were deleted in `finally`; cleanup assertions passed.

The browser harness bundled the **production app source and form with test-only exports**. Test-only app config named a synthetic Supabase hostname to satisfy the existing production URL guard, and Playwright intercepted every request to that hostname and forwarded it to the verified local API origin with redirects disabled. No hosted destination was contacted. Other nonlocal requests were aborted; `/api` responses were local synthetic fixtures. The browser used the anon key only; admin/service-role setup and cleanup ran in Node. Each project created one synthetic owner, signed in through the UI, selected a detailed synthetic catalog printing, submitted the graded-copy form, and verified through a separate owner client that the row has `variant_id:null`, the namespaced source ID in `identity_snapshot`, and its certificate. A **new browser context** then signed in, loaded the real portfolio, opened its saved detail, found no incomplete-printing warning and found the exact-sales action available. The final guarded browser run on desktop Chromium and mobile WebKit passed **2/2**; each recorded 5 browser Auth requests, 1 graded-copy save RPC, 6 collection-row reads and **0 external requests**. Ancillary local app requests could return handled errors; the tested login, save and row-read endpoints were required to succeed. An initial test-harness route ordering mistake and an onboarding race were corrected before that final passing run; these were not application defects.

### Final verification and cleanup

| Check | Result |
| --- | --- |
| Unchanged 05I reopen probe; unchanged four-case 05H Astra probe | Exit 0; 05H 4/4 passed. |
| Enabled guarded DB persistence test | 2 passed, 0 skipped, 0 failed. |
| Focused identity, valuation and persistence tests without DB opt-in | 23 passed, 2 guarded DB skips, 0 failed. The CLIENT-03 DB guard was left disabled. |
| Offline detail browser case on three projects | 3 passed, 0 failed. |
| Full physical-copy and card-profile browser suite, one worker, guarded DB enabled | 110 passed, 10 skips, 0 failed. The skips include the intentionally excluded mobile-Chromium real-DB case and earlier unrelated skips. |
| `npm test` | 443 passed, 1 guarded local-DB skip, 0 failed. |
| `npm run lint`; `npm run typecheck`; `npm run build` | All passed. |
| `node scripts/verify-certificate-exclusion.mjs` | Passed across 25 shipping files. |
| Scoped Prettier check; scoped `git diff --check` | Passed. |

Final SHA-256 for revision-relevant files (the earlier hash table above records the original packet state):

| File | SHA-256 |
| --- | --- |
| `app.js` (unchanged by this revision) | `fdc28e6b72a3f254b3d0c43d4b2be165f74819a4dcbdbca9a847c525073e75f2` |
| `lib/identity.js` | `258268e68019c3cff2b5f25add43bbeb8af82629682bc8b58450b1e2a9992eb7` |
| `lib/providers/tcgdex.js` | `bbf702ad73e53160ddff9e6c36b92454e81f8726923cae5b1f9bb09c92682944` |
| `lib/supabase-data.js` | `21e88769534b6ebadc243b28b6a584dbb084ab4151377d884431c4fb932f3d2c` |
| `lib/pricing.js` (unchanged by this revision) | `878984d5cd1f9b03761034be32670ab701e604054afb4014a9d3113725242fa9` |
| `tests/detailed-printing.test.js` | `7ab0de4cb5e34437a1d7f98fc3a5a21eb03250ad083a20202a873b0b8e287d93` |
| `tests/detailed-printing-persistence.test.js` | `e97648a2a1be441c26d661556ea4f5a0fa6386dcc910e6a6f8fb8facd7f7a5dd` |
| `tests/browser/physical-copies.spec.js` | `eda6d1f4cda5becf24ca2485c26b02a6f18d48311e186d0752dbeeed49666f84` |
| unchanged 05I reopen probe | `801bbf868febdcca92a06e78fc4c52d6256b7cd7288636d7f29071bd66ac583b` |
| unchanged 05H Astra probe | `67b89d670f8edb2376d678f0592f50faf96c56e603376af6105e20cc71a1a658` |

The run-owned users were removed by the guarded tests. `supabase stop --project-id mica-client-05i-6326e459 --workdir /tmp/mica-client-05i-6326e459 --no-backup --yes` reported a scoped stop without backup. A subsequent Docker inventory found **zero** containers or volumes with the run project label/name and no listener on ports 55421–55428. The run-owned temporary workdir, including its local credentials log and launcher, was then removed after validating its project ID. The 12 pre-existing `jordan-pokemon-app` containers remained up, with previously healthy services still healthy. This packet did not query, reset, stop, alter credentials for, or otherwise mutate `mica-dev`.

No provider/catalog/image/recognition/FX request, paid service, environment-file access, hosted mutation, new migration, dependency, deployment, commit, transaction conversion, certificate activation or CLIENT-06 work occurred. Positive real-sale numeric validation, provider production retention/display rights, real-device capture and release gates remain open. **Stop for Astra review.**
