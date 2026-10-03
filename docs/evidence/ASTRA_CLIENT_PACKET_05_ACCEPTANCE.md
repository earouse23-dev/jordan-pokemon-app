# Astra CLIENT-05 local acceptance — 2026-09-24

**ACCEPT for the authorized native-currency valuation implementation and R1–R3 revision.** No blocking finding remains in the reviewed slice. Full Step 5, live valuation accuracy, FX and release gates are not passed. CLIENT-06 remains unissued.

## Revision closure

- **R1:** Adapter now reconciles explicit title grades/labels with structured provider and requested facts. Missing or contradictory label facts do not enter the ordinary BGS pool. Offline API-to-estimator tests separately establish ordinary BGS 10, Black Label 10 and Gold Label 9.5 values, rejecting the reported conflicting cases.
- **R2:** API accepts canonical `first_edition`; recognized edition wording reaches canonical identity matching without blanket relaxation of title validation. Offline provider/API/estimator tests produce the expected first-edition median, keep unlimited separate, cover supported aliases and reject malformed input.
- **R3:** Safe upstream rejection references and stage counts now pass through API and selected-detail state into optional evidence. Unidentifiable rows are explicitly unidentified; rejected source URLs are not linked. Counts reconcile in integration tests. Browser checks demonstrate retention after a failed refresh, clearing on currency/copy changes and protection against a delayed previous-copy result.

The valuation calculation file is unchanged from the first review: the frozen median, minimum-count, window, outlier and qualitative-confidence policies remain intact. These policies are uncalibrated engineering rules, not proven market accuracy.

## Independent verification

- Unchanged `node docs/evidence/sol-client-05/astra-review-probe.mjs`: **3/3 passed** (previously 3 failures).
- `node --test tests/exact-sold-valuation.test.js tests/pricing.test.js`: **58 passed**.
- `node --test tests/client-05-revision.test.js`: **2 passed**, using locally intercepted provider responses through the actual API and estimator.
- Focused physical-copy browser verification: **9 passed in 15.1 seconds**, covering exact values/currency/context, upstream exclusions/retry and late-response protection across desktop Chromium, mobile Chromium and mobile WebKit.
- Shipping certificate exclusion: **passed across 25 existing build files**. Astra did not rebuild the artifact.

The browser run used a temporary copy of the existing physical-copy spec/config, redirected evidence output, original source imports, a dedicated local server on port 4197 and a route blocking external browser requests. Existing local API stubs handled fixture traffic. Application files and Sol evidence were not changed by this run. Temporary output: `/var/folders/2_/v5kbdt0j0p3131zbc3c78mwm0000gn/T/mica-05r-astra-07wk681o/`.

Sol's 431-test full unit run, 111-test affected browser run, lint/typecheck/build and formatting checks remain reported evidence; Astra did not repeat those broader runs. No live provider or physical-device proof is implied.

Reviewed SHA-256:

| File | Hash |
| --- | --- |
| `app.js` | `c78acfbc5d159b3fa8b75f389dfac23b607c87bcae1649ade6673f5a2aadd43f` |
| `api/sales.js` | `852fe658036d8ccde6c5afce63dbaaec428fd03b7837a6879b5341cea2061f5e` |
| `lib/providers/pkmnprices.js` | `78de482edb7131f71e4c385165e7738deae1a5d76e03e8c0079d2f311c30bfda` |
| `lib/pricing.js` | `878984d5cd1f9b03761034be32670ab701e604054afb4014a9d3113725242fa9` |
| `tests/client-05-revision.test.js` | `a0d1504303e656fd6e9b9913e68d2056d9deb6c356917337da7cf73f30b45891` |
| `tests/browser/physical-copies.spec.js` | `dacd96466aa21b9f424a8a19a8dd6bb2b4fd90c7dcab0aeef2155a0aabe78807` |

## Remaining work

Next valuation evidence should be a separately authorized, capped real-sale sample with independently reconstructed amounts, identity decisions and exclusions. CLIENT-01's sanitized coverage ledger cannot prove a numeric estimate. No new live-call budget is granted here. FX still needs an approved source and timestamped conversion validation; native USD/EUR separation is accepted only as implemented/tested.

Real Pokémon capture coverage remains 0/12. Physical iPhone, live recognition and relevant official-provider/persistence/release gates remain open. GemRate stays excluded from initial shipping. No application code edit, provider call, hosted mutation, deployment or commit occurred during Astra review. Preserve the dirty worktree; no packet is active after this local acceptance.
