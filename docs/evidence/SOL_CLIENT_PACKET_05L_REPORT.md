# SOL CLIENT-05L — one real Clefable valuation attempt

**2026-09-25 outcome: identity blocked; no sold-listing request or numeric valuation.** The one authorized direct PkmnPrices request returned HTTP 200 and reported **one charged credit**. Its card ID, reviewed name, Jungle set, collector number/total and USD first-edition holo price association matched the frozen candidate, but the response had **no top-level `language` field**. The rehearsed direct gate requires explicit English in that field. It stopped the production API/adapter path before the second request. This is a measured inability to substantiate the exact cross-provider mapping, not a claim that the card is Japanese or that no English-specific fact exists anywhere in the provider's data. The limited private identity projection does not establish whether a nested language fact exists. There were **one outbound request, one reserved credit, one reported charged credit, zero sold requests and zero sold rows**. The packet's live authorization is spent; no retry, replacement sample, top-up or further provider call is proposed.

I read the installed `ponytail:ponytail` skill in full mode before work, AGENTS.md, both roadmaps, the 05J dossier, revised 05K report/tests, Astra's 05K acceptance and Elliott's recorded retention permission. The latter permits this **private audit ledger**; it does not by itself settle production display rights. I reused the unchanged sales route, adapter, canonical source normalization and exact-sold estimator. No production application, provider matching, valuation rule, database, dependency or deployment file was changed. No public TCGdex refetch was needed. The old dirty worktree was preserved, with no commit or CLIENT-06 work.

## Frozen candidate and guarded attempt

| Item                | Frozen value / observation                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public source       | English TCGdex Jungle Clefable `base2-1`, `1/64`, detailed first-edition holo source variant `3a83wf50ts0izj268xwv3crwi`; retained 05J/05K observation, not a new catalog request        |
| Candidate crosswalk | PkmnPrices direct ID `20618`, provider-facing `Clefable (1)` and `01/64` in this isolated harness only; no production alias or saved-record identity change                              |
| Experimental grade  | PSA 10, empty qualifier, native USD; no owned slab or certificate claimed                                                                                                                |
| Clock and rule      | `2026-09-25T05:48:19.836Z`; `mica-exact-sold-v1`                                                                                                                                         |
| Direct transport    | `GET https://api.pkmnprices.com/v1/cards/20618?currency=usd`; HTTP 200; `x-credits-charged: 1` recorded privately                                                                        |
| Identity gate       | ID, name, Jungle, number `01`, total `64`, and a USD `1st Edition Holofoil` association passed. Explicit top-level English failed because `language` was absent.                         |
| Adapter/API result  | Candidate-specific guard raised non-retryable status 409; existing `api/sales.js` returned 502 `provider_unavailable`. The adapter's retry/search fallback was stopped before transport. |
| Sold transport      | Not run. The ten-credit reservation was never made. Row count, truncation, per-row printing/currency, contributor count and numeric valuation are unknown.                               |

The first `node scripts/client-05l-proof.mjs --live` invocation before transport exited with no output because the runner's entry-point comparison did not decode the workspace path containing spaces. **It made no request and created no attempt ledger.** I corrected that local runner invocation check, reran five offline guard tests, then executed the single live attempt above. The final runner hash below is the one frozen by the attempt. There was no second live attempt.

The runner writes a durable one-shot attempt file with mode 0600 before transport and persists each reservation before sending. An existing file prevents a restarted run from issuing anything. It exact-matches both allowed URLs, method, phase and filters, forces `redirect:error`, and blocks retry, search fallback, cursor pagination, changed card/grade/limit, third calls and over-limit response rows. The actual adapter/API path ran behind that guard; no shortcut response was passed to the app. It obtained `PKMNPRICES_API_KEY` from the process environment first or the single named value in `.env.local` as permitted. The key, other environment values, raw authorization headers, images, seller/buyer data and provider numeric prices were never printed or placed in the repo. The private direct evidence retains only required identity fields, available variant/currency associations, response field names and request accounting; no numeric sale payload exists because the sale call was blocked.

Frozen SHA-256 at the attempt: `lib/providers/pkmnprices.js` `829440e08d5304c51b82c0c46907f05f971e3dfb8aeec7729da4b014e445fbef`; `lib/pricing.js` `878984d5cd1f9b03761034be32670ab701e604054afb4014a9d3113725242fa9`; `lib/providers/tcgdex.js` `bbf702ad73e53160ddff9e6c36b92454e81f8726923cae5b1f9bb09c92682944`; `lib/identity.js` `258268e68019c3cff2b5f25add43bbeb8af82629682bc8b58450b1e2a9992eb7`; `api/sales.js` `852fe658036d8ccde6c5afce63dbaaec428fd03b7837a6879b5341cea2061f5e`; `scripts/client-05l-proof.mjs` `3f07741c7ec6125b42ac3ffead3b05fb44183f602a86f804709c4ecc86275813`. Offline replay independently rehashed all six and found agreement.

## Private ledger and offline reconstruction

The private, owner-only directory is `/Users/elliottrouse/Library/Application Support/Mica/client-05l-private/` (0700). Its attempt ledger is `/Users/elliottrouse/Library/Application Support/Mica/client-05l-private/attempt.json` (0600), SHA-256 `4a6a33dc3f54167d6e3b50c48a9e460a9ffb32a2497a2b6f42513bec332d1603`. It is outside the repository and web root. It records the source/variant, evaluation time, frozen file hashes and rule, request URL/status/reservation/charge, a minimal direct identity projection, the failed gate and absence of sale rows. It includes no credential or numeric card-price fields. Do not publish or copy this private file into shipping assets.

From the repository root, Astra can repeat the **zero-request** identity and accounting reconstruction with:

```sh
node scripts/client-05l-replay.mjs
```

This independent replay imports no production identity filter, sale-selection, outlier or median helper. It reads only the retained private ledger, checks its permissions, hashes, candidate, rule, URL, one-request/one-credit accounting and each direct fact. It independently returns `explicitEnglish:false` while all other frozen direct checks are true, agrees with `directGate:fail`, and verifies no sales request, rows, API success or production estimate exists. **Accepted/excluded sale rows, deduplication, outliers, median/range and freshness cannot be reconstructed because no sale response was requested.** No synthetic price was substituted for that missing evidence. The earlier 05K tests still cover those arithmetic paths synthetically, but they are not real numeric proof.

## Browser and offline verification

The private ledger drove a blocked-identity replay through the existing card-detail screen. The test constructed the reviewed TCGdex source printing locally, supplied a synthetic unsaved PSA 10 item, and returned the observed guarded API failure via local route interception. It did not inject sale rows or real prices into a fixture or screenshot. In **desktop Chromium and mobile WebKit**, the detail remained `Estimate unavailable`, showed a refresh failure, exposed no FX equivalent, made one local mocked sales request, made **zero external requests** and made **zero database writes**. This verifies truthful unavailable-state presentation, not actual live-price display or a production alias. No ECB request was needed because no estimate existed.

Repeatable commands from the repository root:

```sh
node --test tests/client-05l-proof.test.js tests/client-05k-offline.test.js tests/client-05d-transient.test.js tests/client-05b-guard.test.js
node scripts/client-05l-replay.mjs
npx prettier --check scripts/client-05l-proof.mjs scripts/client-05l-replay.mjs tests/client-05l-proof.test.js tests/browser/physical-copies.spec.js
node --check scripts/client-05l-proof.mjs
node --check scripts/client-05l-replay.mjs
git diff --check
```

Results: **23/23 focused guard/affected tests passed**, private replay passed with all frozen hashes agreeing, Prettier and syntax checks passed, and `git diff --check` passed. The guarded test includes direct-response contradictions, changed filters, redirect, retry, fallback, pagination, extra request, timeout, over-limit rows and restart refusal. For the browser replay, I built a neutral local bundle with the build script's environment-file loader intercepted (so `.env` was not read), served it on `127.0.0.1:4189`, then ran:

```sh
npx playwright test tests/browser/physical-copies.spec.js --grep 'CLIENT-05L replays' --project=desktop-chromium --project=mobile-webkit --workers=1
```

**2/2 passed.** No live-price screenshots were taken. New executable evidence is `scripts/client-05l-proof.mjs`, `scripts/client-05l-replay.mjs`, `tests/client-05l-proof.test.js` and the CLIENT-05L case in `tests/browser/physical-copies.spec.js`. The production application and estimator hashes match their frozen values. No unrelated full build/browser suite was run.

## Step 5 exit assessment

| Step 5 gate                                                           | Assessment after CLIENT-05L                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact printing and grade safeguards                                   | Local detailed printing, source ID and synthetic API-to-estimator tests remain accepted; the live cross-provider English identity is **unresolved** because the direct response omitted the required top-level field. No production mapping was installed. |
| Independently reproducible real estimate from evidence IDs            | **Open.** The guarded sale endpoint was not reached; there are no real sale IDs, amounts, exclusions, contributors, median/range or freshness to compare. The private direct observation itself is independently replayable.                               |
| Wrong variant/language/grade exclusion and truthful unavailable state | Guard tests and local browser replay pass; no real-row exclusion result was observed.                                                                                                                                                                      |
| Native currency and FX                                                | Existing USD/EUR separation and approved ECB display conversion remain local prior evidence. This attempt has no native sale amount or FX equivalent; no ECB call was made.                                                                                |
| Source independence, rights and release                               | No second marketplace or source sample was measured. Elliott's relayed provider permission clears **private ledger retention**, while production display/caching/attribution scope remains a separate release decision.                                    |

**Concrete prerequisite before CLIENT-06:** Astra must resolve whether the provider's direct card data can substantiate English for this exact `20618` first-edition holo association under an approved, source-backed rule, and then separately authorize any further bounded live sold-row attempt. The current packet grants no remaining call or credit budget. Even with that fact resolved, Step 5 still needs enough eligible real sales for an independently reproducible estimate, or an explicitly accepted measured-insufficiency decision, plus production display-rights review. Step 4 physical-device/real-image and wider release gates remain separate. Stop for Astra review.
