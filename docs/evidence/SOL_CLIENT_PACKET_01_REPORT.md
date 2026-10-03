# Sol CLIENT-01 evidence report

Date: 2026-09-18  
Packet: `docs/SOL_CLIENT_PACKET_01_PRO_GRADED_EVIDENCE.md`, final evidence gate  
Revision result: **CLIENT-01's local evidence gate is satisfied with a real handler result; the six-cell and half-grade live samples remain explicitly limited rather than being generalized to provider-wide support**

## Result

The mismatch is a combination of three conditions:

1. **Provider attribution defect:** PkmnPrices returned a Flying Pikachu V 006/025 Celebrations sale inside card 10195's sold feed and labeled the row `attribution: exact`.
2. **Insufficient identity validation:** the pre-revision local adapter treated endpoint scope plus provider `exact`, printing, grader and grade as enough. A synthetic regression proved that it accepted both the wrong Flying Pikachu row and the correct McDonald's row.
3. **Outdated deployed code:** the deployed `/api/sales` response accepted all 10 rows and lacked the current local contract's `capabilityStatus`, exclusion counts, printing, attribution and ingested-time fields. This demonstrates that production does not contain the accepted local safeguards or this revision. No deployment was authorized or performed.

The narrow local fix resolves the card identity before evaluating sales and requires each candidate title to corroborate that canonical identity. A conflicting full collector fraction is rejected; a row without a full fraction needs name plus set/number evidence. Ambiguous rows do not support exact evidence. Provider `exact` remains necessary but is no longer sufficient.

The second focused review found three additional fail-open boundaries in that matcher: one matching fraction could hide another card in a bundle, a matching fraction could bypass contradictory set/year text, and ASCII-only tokenization erased Japanese names. Synthetic tests reproduced all three before the correction. The matcher now requires every explicit fraction and tagged number to agree, rejects bundle/lot markers, rejects conflicting years and unexplained set identity text, and tokenizes Unicode letters/numbers directly without transliteration.

## Final-matcher live evidence gate — 2026-09-18

These results were produced after Astra accepted the focused matcher revision. They are separate from the earlier 19/20-credit investigation recorded below.

Every live command explicitly loaded `.env.local` with Node's `--env-file=.env.local`. No credential value was printed, cached, added to the report, requested in chat or sent anywhere except the provider request header. Each request's worst-case returned-row cost was reserved before the request. There was no pagination, retry expansion or request after the final handler check.

### PSA/BGS × English/Japanese/German sample

The final matcher sampled one catalog-selected Pikachu identity per language, then requested at most three recent graded sales per grader. HTTP was 200 for every catalog and sold-listing endpoint.

| Language | Grader | Provider card and canonical identity                                             | Received | Accepted | Excluded | Exclusion reason / sampled result                                                                |
| -------- | ------ | -------------------------------------------------------------------------------- | -------: | -------: | -------: | ------------------------------------------------------------------------------------------------ |
| English  | PSA    | 10195 — Pikachu, McDonald's Promos 2023, 006/015                                 |        3 |        0 |        3 | `canonical_identity_mismatch_or_ambiguous` ×3; all three were Flying Pikachu/Celebrations titles |
| English  | BGS    | 10195 — Pikachu, McDonald's Promos 2023, 006/015                                 |        0 |        0 |        0 | empty sample                                                                                     |
| Japanese | PSA    | 37504 — _____'s Pikachu, s8a-P Promo Card Pack 25th Anniversary Edition, 007/025 |        0 |        0 |        0 | empty sample                                                                                     |
| Japanese | BGS    | 37504 — same identity                                                            |        0 |        0 |        0 | empty sample                                                                                     |
| German   | PSA    | 157036 — Pikachu, HeartGold SoulSilver, 78/123                                   |        3 |        0 |        3 | `missing_printing` ×3; rows also carried provider attribution `unknown`                          |
| German   | BGS    | 157036 — same identity                                                           |        0 |        0 |        0 | empty sample                                                                                     |

The matrix received six sale rows, accepted zero and excluded six. The three English rows were genuinely incompatible with the requested canonical card. The German title text—“PIKACHU GERMAN POKEMON HEARTGOLD & SOULSILVER 2010 78 PSA 8”—looked compatible with the canonical identity, but the rows did not identify a finish and had `unknown` rather than `exact` provider attribution. They are legitimate-looking sales, but they cannot support an exact printing valuation. The repeated German response was reported as received rather than silently deduplicated.

No title that appeared legitimate for the full requested card, finish and slab context was rejected by the stricter canonical matcher in this sample. The only canonical-matcher rejections were Flying Pikachu/Celebrations rows. The German rows failed evidence completeness before canonical matching; weakening the identity or printing safeguards would not make them exact evidence.

Empty cells mean only that these bounded recent samples returned no rows. They do **not** establish that PkmnPrices lacks PSA, BGS, English, Japanese, German, half-grade or label-sensitive support elsewhere in its catalog.

Sanitized matrix cache: `output/pkmnprices-client-01-final-matrix.json`, mode `0600`. It contains titles and normalized evidence context for review, but no key, price, listing identifier, source URL or raw provider payload.

### Live half-grade / label-sensitive attempt

A separate, single-attempt BGS 9.5 probe requested at most two rows for each of the same English, Japanese and German card IDs:

| Language | Requested | HTTP | Received | Accepted | Excluded |
| -------- | --------- | ---: | -------: | -------: | -------: |
| English  | BGS 9.5   |  200 |        0 |        0 |        0 |
| Japanese | BGS 9.5   |  200 |        0 |        0 |        0 |
| German   | BGS 9.5   |  200 |        0 |        0 |        0 |

The attempt was successful at the transport/entitlement boundary but found no live half-grade or qualifier row in this bounded sample. The live half-grade/label evidence question therefore remains unknown; the synthetic half-grade/qualifier preservation regressions remain the only positive coverage for that shape.

### Current local application handler

The current local `api/sales.js` handler was called with provider card 10195 and the exact English Pikachu / McDonald's Promos 2023 / 006/015 / Holofoil / PSA 10 context. This used the same server environment and provider adapter as the application path, not a direct-only normalizer demonstration.

| Stage                  | Received | Accepted | Excluded | Reasons                                              |
| ---------------------- | -------: | -------: | -------: | ---------------------------------------------------- |
| Provider sold rows     |       10 |        8 |        2 | `canonical_identity_mismatch_or_ambiguous` ×2        |
| Local handler response |       10 |        8 |        2 | `contextMismatch: 0`; `canonicalIdentityMismatch: 2` |

Handler result: HTTP 200, provider card 10195, capability `live`. All eight accepted rows retained exact attribution, PSA 10, Holofoil, USD, distinct sold and ingested timestamps, and a safe source-link presence flag. The two excluded rows were “2021 POKEMON CELEBRATIONS #006 FLYING PIKACHU V PSA 10” and “Flying Pikachu V #006/025 | 2021 Pokemon Celebrations | PSA 10”. The accepted rows were recognizable McDonald's 2023 Pikachu titles, including full 006/015 fractions and set/year anchors. No accepted title crossed the canonical identity boundary.

These are provider-reported sales, not independently verified marketplace transactions.

### Final-gate credit ledger

| Probe                                             | Pre-request reserved upper bound | Provider-reported charge | Returned evidence                                        |
| ------------------------------------------------- | -------------------------------: | -----------------------: | -------------------------------------------------------- |
| Three catalog selections + six 3-row matrix cells |                               21 |                        9 | 3 catalog cards + 6 sale rows                            |
| Three BGS 9.5 2-row samples                       |                                6 |                        0 | 0 rows                                                   |
| Current local handler: one card + up to 10 sales  |                               11 |                       11 | 1 card + 10 sale rows                                    |
| **Final-gate total**                              |                      **38 / 40** |                   **20** | within both the reservation and provider-charge ceilings |

The earlier focused revision used its separate 19/20 authorization. It is historical evidence and is not mixed into this final-gate 38/40 reservation or the provider-reported charge of 20.

## Earlier focused-revision credential and access evidence — 2026-09-17

Credentials were loaded explicitly from `.env.local`. No value was printed, retained, requested in chat, committed or sent anywhere except the provider request header.

| Check                                  | Result                                 |
| -------------------------------------- | -------------------------------------- |
| `.env.local` credential                | present and accepted                   |
| Local declared plan                    | `pro`                                  |
| Provider single-card endpoint          | HTTP 200                               |
| Local application `/api/sales` handler | HTTP 200                               |
| Production plan                        | `pro`, per Astra's production evidence |
| Deployed `/api/sales`                  | HTTP 200, independently reproduced     |

A plan label is not treated as entitlement proof. Successful authenticated card and sold-listing responses establish access for this tested path.

## Earlier canonical identity and mixed-sale inspection — 2026-09-17

Provider card 10195 resolved to:

- Name: Pikachu
- Printing number: 006/015
- Set: McDonald's Promos 2023
- Requested language: English
- Provider card-detail language field: absent
- Requested slab context: PSA 10, Holofoil

The deployed API returned 10 sales. They included one Flying Pikachu V 006/025 Celebrations sale and nine McDonald's Pikachu sales. The deployed response did not expose attribution or exclusion diagnostics.

The bounded local application-path check inspected seven provider rows. The provider's raw response showed:

| Candidate class                                                           | Count | Provider attribution | Local result                          |
| ------------------------------------------------------------------------- | ----: | -------------------- | ------------------------------------- |
| Flying Pikachu V, Celebrations, 006/025                                   |     1 | `exact`              | excluded: canonical identity mismatch |
| Pikachu, McDonald's Promos 2023, 006/015 or equivalent set/number anchors |     6 | `exact`              | retained                              |

The wrong row was newer than every retained row. It was still excluded; recency cannot override identity.

Post-fix local application result:

- HTTP: 200
- Provider card ID: 10195
- Provider rows: 7
- Exact eligible rows retained: 6
- Excluded: 1
- Context mismatches: 0
- Canonical identity mismatches: 1
- Capability status: `live`
- Currency: USD on every retained row
- Newest retained sold date: 2026-08-24
- Newest retained ingestion time: 2026-09-01T06:21:11.663938Z
- Source links present: yes

This is provider-reported evidence passed through Mica's application handler and normalizer. The underlying marketplace transactions were not independently verified.

Sanitized cache: `output/pkmnprices-client-01-revision.json`, permission mode `0600`. It contains no key, price, listing identifier, source URL or raw payload.

## Earlier 20-credit live-probe budget — 2026-09-17

The revision stayed below the requested 20 returned-item-credit ceiling.

| Probe                            | Planned upper bound | Result                         |
| -------------------------------- | ------------------: | ------------------------------ |
| Deployed `/api/sales` comparison |                  10 | 10 rows, HTTP 200, cache MISS  |
| Direct canonical card inspection |                   1 | 1 card, HTTP 200               |
| Post-fix local application path  |                   8 | 1 card + 7 sold rows, HTTP 200 |
| **Total**                        |         **19 / 20** | within ceiling                 |

The local post-fix provider responses reported eight charged credits, matching eight observed returned items. No pagination, automatic retry or additional live matrix request was made.

## Implementation

- Added `saleMatchesCanonicalIdentity` to require canonical sale-title corroboration after the existing exact context checks.
- Every full collector fraction and tagged number in a title must match the canonical number and set total. One matching fraction cannot hide a second conflicting card.
- Explicit bundle, lot, pair, playset and multi-card language fails closed.
- A title year must not conflict with an explicit canonical set year. Unexplained set-like identity text is rejected even when the collector fraction matches.
- Unicode letters and numbers are preserved during identity tokenization. Japanese names are compared as printed; no transliteration or inferred alias is introduced.
- Without a full fraction, generic names require set and number anchors. A title such as only “Pikachu Holo PSA 10” is ambiguous and excluded.
- Explicit conflicting language markers are rejected.
- Direct sales lookups retain the resolved provider card metadata for sale validation. If provider language is absent, full canonical name/set/number must match before the requested language context can proceed.
- The sales API now reports separate context and canonical-identity exclusion counts.
- The bounded readiness verifier now uses the same canonical identity check; provider `exact` alone cannot mark a matrix cell application-eligible.
- Existing currency, half-grade, qualifier, attribution, source-link and sold/ingested timestamp safeguards remain unchanged.
- No valuation algorithm, UI, dependency, migration or persistence model was added.

This intentionally prefers missing/thin evidence over accepting an ambiguous sale. It does not try to infer a price from titles.

## Regression evidence

All constructed rows are explicitly **synthetic** and are not market evidence.

The new regression uses the observed mismatch shape:

- canonical provider card 10195, Pikachu, McDonald's Promos 2023, 006/015;
- provider-`exact` Flying Pikachu V Celebrations 006/025 row;
- provider-`exact` correct McDonald's 006/015 row;
- provider-`exact` but ambiguous “Pikachu Holo PSA 10” row.
- a multi-card bundle containing both matching 006/015 and conflicting 006/025 fractions;
- matching 006/015 with the wrong 2022 year;
- matching 006/015 and 2023 with the conflicting Celebrations set name;
- exact Japanese `ピカチュウ` 025/165 plus wrong-name, wrong-number and wrong-set Japanese negatives.

Before the first fix, the targeted test failed because both explicit rows were accepted. Before this second correction, the bundle and wrong-year rows were also accepted, while the matching Japanese row was rejected. After correction, only the correct McDonald's row is retained; the conflicting, bundled and ambiguous rows are counted as canonical identity mismatches, and exact Japanese text works without weakening negative checks.

Verification results:

| Check                                                | Result                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Pre-fix mismatch regression                          | failed as expected: wrong and correct rows both accepted                           |
| Focused pricing/readiness suite                      | 59 passed                                                                          |
| Second-revision targeted regressions                 | 2 passed after both failed before correction                                       |
| Final readiness classification regression            | passed; mixed accepted/canonical-mismatch/non-exact rows are counted and explained |
| Full `npm test`                                      | 409 passed                                                                         |
| `npm run lint`                                       | passed, 84 source files                                                            |
| `npm run typecheck` plus explicit packet-file checks | passed                                                                             |
| `git diff --check` on packet files                   | passed                                                                             |

The earlier Packet 02 prerequisite remains separately evidenced: 16 focused desktop/mobile owner/session/onboarding regressions passed before CLIENT-01 implementation. No owner-boundary or accepted layout code changed in this revision.

## Files changed for the focused revision

- `lib/providers/pkmnprices.js` — canonical sale identity corroboration, resolved-card retention and exclusion accounting.
- `api/sales.js` — return separate canonical/context exclusion counts.
- `lib/pkmnprices-readiness.js` — require canonical identity for application-eligible live matrix rows.
- `tests/pricing.test.js` — mixed provider-`exact` printing and ambiguous-title regression.
- `tests/pkmnprices-readiness.test.js` — provide canonical identity in verifier fixtures.
- `output/pkmnprices-client-01-revision.json` — sanitized live evidence cache.
- `output/pkmnprices-client-01-final-matrix.json` — sanitized final-matcher six-cell matrix cache.
- `docs/evidence/SOL_CLIENT_PACKET_01_REPORT.md` — this updated report.

The prior CLIENT-01 harness, currency/history safeguards and test integration remain in the dirty worktree. Unrelated work was preserved.

The final evidence-gate change was limited to sanitized row classification/reporting in `lib/pkmnprices-readiness.js`, its offline regression in `tests/pkmnprices-readiness.test.js`, the final matrix cache and this report. No matcher, handler, UI, dependency, migration or deployment code changed during this final gate.

## Screenshots and environment claims

No user-facing layout or flow changed, so no screenshots were captured.

- Synthetic/local automated behavior: verified by regression tests.
- Live provider: authenticated Pro path returned real card and sold rows.
- Live application path: the current final-matcher handler returned eight exact-eligible rows and excluded two wrong-card rows; the earlier six/one result remains historical evidence above.
- Deployed application: inspected read-only; still exhibits the mixed result and older response contract.
- Live persistence/database: not exercised.
- Physical device: not exercised.
- Deployment: not performed.

## Remaining CLIENT-01 coverage limits

- The PSA/BGS × EN/JA/DE matrix was executed, but it is a six-cell sample over only three catalog-selected Pikachu identities. Four cells were empty, the English PSA cell contained only wrong-card rows in its three newest results, and the German PSA rows lacked exact printing/attribution evidence. This is limited sampled coverage, not absence of provider support.
- The live BGS 9.5 attempt returned no rows across the three sampled identities. Live half-grade and label-qualifier preservation remain unproven beyond synthetic regression coverage.
- The successful real application case is English Holofoil PSA 10 for provider card 10195. Other cards, languages, graders, grades, qualifiers, variants and currencies were not proven end to end.
- Production remains on the older behavior until a separately authorized deployment. No deployment was performed or requested here.
- No marketplace transaction or provider attribution was independently verified.

## Copy-ready summary for Astra

> CLIENT-01 final evidence gate completed locally with `.env.local` loaded explicitly and no credential disclosure. Every live request was pre-reserved: 38/40 maximum additional credits; provider headers reported 20 charged. The final matcher sampled PSA/BGS × English/Japanese/German: six sale rows were received, zero accepted and six excluded—three English Flying Pikachu/Celebrations canonical mismatches and three German rows missing a printing and carrying unknown attribution; four cells were empty. A separate BGS 9.5 attempt returned zero rows, so live half-grade/label support remains unknown rather than unsupported. The current local application handler then proved one real exact case for card 10195: HTTP 200, 10 rows received, 8 McDonald's Pikachu PSA 10 Holofoil rows accepted, and 2 Flying Pikachu rows excluded as canonical mismatches. Legitimate exact-context titles were retained; safeguards were not weakened. Full tests pass 409/409, lint and typecheck pass. No UI, dependency, migration, deployment or CLIENT-02 work.
