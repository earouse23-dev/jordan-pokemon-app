# CLIENT-06B — Durable graded valuation evidence

2026-09-25. Synthetic, offline, local-only packet. **Stop for Astra review.**

## Decision and remaining gate

Existing `position_price_observations` columns can faithfully store a sold-derived **estimate** and its source facts. Existing owner RLS can read it without replacing the public history RPC. However, executable concurrency testing found that a server read followed by an ordinary service upsert can insert a stale-context observation if the copy changes between those operations.

The final route therefore requires one atomic owner/context/Auth-session RPC, before reserving credits or invoking the provider. That RPC is absent from the effective schema. The route fails closed with HTTP 503/`valuation_write_guard_unavailable`; it has no fallback insert. **Final authenticated server save → database → fresh-login chain remains blocked.** The independently computed database-storage/read/UI chain and mocked atomic contract checks below are separate evidence, not a claim that the blocked chain passed.

Exact minimal proposal: [PERSIST_VERIFIED_GRADED_VALUATION_PROPOSAL.sql](sol-client-06b/PERSIST_VERIFIED_GRADED_VALUATION_PROPOSAL.sql). It is outside the migration directory and was neither applied nor compiled. Existing columns, types and grants were checked against the disposable effective database. Approval and executable SQL validation are still required before activation.

Ponytail full and the installed Supabase skill were read. AGENTS, both Mica roadmaps, CLIENT-06 packet/revision/report and Astra revision acceptance informed the scope. Existing pricing, physical-copy save/sale, owner hydration, history/P&L and browser tooling were reused. No valuation rule changed.

## Effective storage and access map

The separately owned database ran the existing migration chain, including canonical identity, transparent pricing and physical-copy migrations. Read-only catalog queries checked the final schema, constraints, privileges and Auth-session columns.

| Contract                         | Existing storage / boundary                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner/copy/canonical collectible | `user_id`, `collection_item_id`, `collectible_id`; UUID/FK context and explicit service owner lookup                                                    |
| Exact context                    | `quality.context`: stored canonical identity, name/set/number, language, variant/finish/edition/promo, grader/grade/qualifier/native currency           |
| Trusted producer                 | `quality.producer` and `source_metadata.producer` = `mica-server-exact-sold-v1`; clients cannot insert/update observations                              |
| Estimate semantics               | `valuation_type=provider_estimate`, `evidence_kind=completed_sale`, `derivation=aggregated`: estimate supported by sales, never represented as one sale |
| Native result                    | positive numeric `amount`; nonnegative range and count fields; currency retained unchanged                                                              |
| Dates/freshness                  | `observed_at` original evaluation, `retrieved_at`, `provider_updated_at` newest contributing sale                                                       |
| Attribution/revalidation         | existing JSONB `source_metadata`: provider card ID, allowlisted normalized sales, contributing transaction IDs, newest sale and truncation              |
| Rule/status                      | existing `evidence_rule_version`, provider/capability/exclusion fields; frozen `mica-exact-sold-v1`                                                     |
| Idempotency                      | existing UUID PK; deterministic source/context digest and duplicate-ignore insertion preserve the first observation date                                |
| Reads                            | authenticated SELECT with owner RLS; no anon access; authenticated INSERT/UPDATE absent; service role bypasses RLS and needs explicit owner checks      |
| Session/write atomicity          | existing `auth.sessions(id,user_id,not_after)` and copy row, but no existing atomic RPC combining those checks and insert                               |

Graded constraints require grader and grade label, numeric grade 1–10 and empty raw condition. Legacy indexes remain legacy records. The abbreviated existing history RPC is retained for ordinary history; graded producer rows use an additional owner-RLS table projection of their complete provenance, including sold copies.

Aggregate snapshots retain their existing raw/sealed limitation. This packet does not promote provenance-free aggregate snapshots into durable graded proof.

## Trust flow and implemented work

1. Browser explicit refresh submits only saved `positionId` with the current bearer token. Login/detail reopen does not fetch paid evidence.
2. Server validates the token with Auth `getUser`, resolves the position under its owner, requires active graded status, complete exact context and a stored numeric direct provider mapping. Forged browser prices, owner IDs and flags are ignored.
3. Atomic capability/session/context preflight must succeed before the existing 11-credit reservation. Missing guard causes no provider call or observation write.
4. Actual adapter is restricted to one direct identity request and one ten-row sales request; no search fallback or retry. Tests inject transport. The frozen estimator computes the result.
5. Only ready results produce an allowlisted observation. Proposed final RPC locks the session/copy and compares the stored contract again before insert. Changed context/revoked session rejects persistence. Service-only EXECUTE and fixed empty search path preserve client boundaries.
6. Hydration verifies producer/type/rule, source facts, numeric consistency, owner and context; it independently reruns the estimator at the original recorded time and now. Historical validity does not create a current price.
7. Graded history uses only validated recorded observations. Current totals use a currently eligible exact estimate; indexes cannot fill gaps. Detail shows source links, original recorded estimates and stale/unavailable status. USD and EUR remain separate.

The SQL proposal adds only that function and grants, no table or column. Disable by revoking service-role EXECUTE: preflight stops before credits. Dropping the function after disabling the route leaves all observations and transactions intact. No existing RPC contract or browser grants are changed.

## Frozen synthetic reconciliation

The synthetic identity is Clefable, **Synthetic Jungle**, 017/064, English Holofoil, unlimited, no promo, PSA 10 with no qualifier. Provider ID 20618 is a fixture reference, not live identity validation. Each sale is explicitly synthetic, has a distinct transaction reference and sold date 2026-09-20. Evaluation/retrieval is 2026-09-25. No dates or amounts are inferred before the recorded evaluation.

| Copy  | Acquisition | Cost | Qualifying native sales | Median | Outcome                            |
| ----- | ----------- | ---: | ----------------------- | -----: | ---------------------------------- |
| A USD | Sep 1       |  100 | 130, 150, 170           |    150 | owned, unrealized +50              |
| B USD | Sep 5       |  200 | 230, 250, 270           |    250 | sold Sep 25 for 300, realized +100 |
| C USD | Sep 20      |   50 | 50, 70, 90              |     70 | owned, unrealized +20              |
| EUR   | Sep 20      |   50 | 90, 110, 130            |    110 | owned, unrealized +60 / 120%       |

Independent arithmetic: active USD value = 150+70 = **220**; active basis = 100+50 = **150**; unrealized = **70**, return **46.6667%**. Sold B realized = 300−200 = **100**, with zero recorded fees. EUR value **110**, basis **50**, gain **60**, return **120%**. The preserved original raw A/B/C contributes USD unrealized70/realized80; the combined synthetic history therefore shows USD unrealized140/realized180. Unknown index-only graded copy remains unavailable.

## Executable evidence and limits

- A regression at the final persistence boundary **failed before** the atomic guard (HTTP 200 versus expected 409). The final contract test passes with the atomic RPC model; this proves the route contract, not execution of unapplied SQL.
- Focused graded valuation tests: **8 passed, 0 skipped**. Includes forged values, authorization/ownership failures, missing guard, context correction during delayed response, final-boundary race, revoked session, insufficient/failed evidence, duplicate/new observations, malformed/index rows, stale-current/valid-history separation and actual adapter fake-transport two-request/no-retry limits.
- Full `npm test`: **458 tests, 456 passed, 2 guarded database skips, 0 failed**. The enabled disposable test is reported separately.
- Retained Astra probes: CLIENT-06 three findings, CLIENT-05H four source-shape checks and CLIENT-05I fresh selection check all passed unchanged.
- Affected portfolio/physical-copy browser regression run: **51 passed, 3 guarded skips** across the configured browsers. Subsequent final persistence/detail checks are recorded below.
- Final lint: **96 files**; typecheck, neutral public-config build, shipping certificate exclusion (**25 files**) and diff whitespace check passed.
- No provider/FX transport was used. Fake adapter transport independently verifies the direct identity/sales requests. Real local Auth/database HTTP is necessary for persistence proof and is distinguished from outbound provider traffic.

### Disposable database and fresh-login evidence

Database ownership: `mica-client-06b-2daea67f`, isolated workdir `/tmp/mica-client-06b-8oeukcae`, unused ports 55511–55520. Existing migrations only. Generated disposable credentials were kept private; no production environment files or mica-dev records were read or changed.

The final harness first calls the actual route against the effective database: absent RPC must return503, make zero provider calls, reserve no credits and write no observation; another owner receives404. It then computes each synthetic result with the production helper/estimator and stores that computed observation through an explicitly independent service fixture. **This storage fixture is not the final authenticated route.** Owner browser INSERT is denied, another owner cannot read the rows, duplicate storage preserves one observation, the normal physical-copy sale preserves B's observations, and fresh Auth login loads observations through production hydration.

**Final enabled result: 1 passed, 0 skipped, 0 failed (15.7 seconds), including all three browser contexts.** Actual missing-guard route, no-credit/no-provider assertions, database storage/RLS, normal copy sale, duplicate handling, fresh-session production hydration and browser proof completed. Detail shows $150, three original sale links and the Sep25 recorded estimate; after browser time advances to Nov1 the current total is unavailable while recorded evidence remains. No durable refresh request occurs on login or reopen.

Fresh-login screenshots (all synthetic): [desktop Chromium](sol-client-06b/desktop-chromium-fresh-login-eur.png), [mobile Chromium](sol-client-06b/mobile-chromium-fresh-login-eur.png), [mobile WebKit](sol-client-06b/mobile-webkit-fresh-login-eur.png).

The added detail check initially failed because the sidebar event binding selected the body element after Auth initialization. Its inherited click listener navigated card clicks back to Collection. Restricting binding to `button[data-sidebar-target]` fixes the demonstrated cause; the same fresh-login test passes afterward. This is included in the implemented scope. Earlier prototype success does not override the final missing-RPC boundary.

## Outstanding review gates

- Atomic RPC proposal has not been applied or executed. Final secure write and real SQL locking/revocation concurrency proof remain open.
- Synthetic evidence does not close provider production display rights, live valuation coverage or live-price approval.
- Browser emulation is not physical iPhone/device proof.
- No new migration, dependency, hosted change, paid request/credit, deployment, commit or CLIENT-07 occurred. Dirty worktree and unrelated existing work are preserved.

Current official guidance consulted: [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [upsert](https://supabase.com/docs/reference/javascript/upsert), and [API security](https://supabase.com/docs/guides/api/securing-your-api). Server Auth validation and explicit service-role ownership enforcement follow these boundaries; current changelog review found no relevant change requiring a dependency update.

## Final artifacts and cleanup

Frozen source/test/SQL/screenshot hashes: [SOURCE_HASHES.sha256](sol-client-06b/SOURCE_HASHES.sha256). Screenshots were visually inspected; their EUR result and separate USD/EUR current values agree with the numerical assertions. They contain synthetic card labels and no provider numeric payload or credentials.

The owned Supabase project was stopped with no backup. Its project-label container query returned no resources; its owned temporary workdir and diagnostic files were removed. The local preview was stopped. mica-dev was not stopped, reset or altered.

Final review status: local read/history implementation and independent executable validation complete; **atomic secure write unavailable pending separate SQL approval and validation**. No packet exit beyond this review gate is claimed.
