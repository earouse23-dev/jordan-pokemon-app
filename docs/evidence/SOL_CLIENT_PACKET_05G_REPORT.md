# SOL CLIENT-05G — ECB source proof

**Result for Astra review, 2026-09-24 UTC:** The existing `api/fx.js` route accepted one current public ECB daily XML response. Independent inspection of the captured bytes agreed with its effective date, USD-per-EUR rate and SHA-256. A second call to the same handler returned the identical in-process record without outbound traffic. Offline detail-screen replay using that real rate and **synthetic** sales passed on desktop Chromium and mobile WebKit. This establishes source compatibility for this observation; it does not establish real-sale valuation accuracy or a release gate.

I used `ponytail:ponytail` in full mode after reading its installed `SKILL.md`, and read `AGENTS.md`, both required roadmaps, the 05G packet, 05F report and Astra 05F acceptance. Existing dirty work was preserved. No application, parser, freshness, route or source change was made. No paid-provider request, deployment, commit, database/profile/transaction write or CLIENT-06 work occurred.

## One-request ledger and source comparison

The one-shot [harness](../../scripts/client-05g-ecb-proof.mjs) wrote the [preflight](sol-client-05g/preflight.json) with actual clock time, fixed contract and implementation hashes **before** transport. Its `globalThis.fetch` guard allowed only the exact `GET` target `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`, with `redirect: manual`, the route's abort signal and XML Accept header, and at most one guard attempt. It passed that call to native `fetch`; the route's five-second timeout, content-type check and 16 KiB streamed limit remained active. The harness cloned the same response for independent inspection; it made no separate source request. The exclusive preflight marker prevents running the one-shot script a second time in this worktree.

| Observation                 | Recorded value                                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preflight actual time       | `2026-09-24T23:43:01.282Z`                                                                                                                                          |
| Outbound ledger             | **1 of 1** allowed; **1** guard attempt; no retry, redirect following or other destination                                                                          |
| Upstream                    | HTTP `200`, `text/xml`; no declared Content-Length; streamed/captured **1,547 bytes**, under 16,384                                                                 |
| First actual route result   | HTTP `200`; `Cache-Control: public, s-maxage=3600`                                                                                                                  |
| Route `fetchedAt`           | `2026-09-24T23:43:01.803Z` (actual route clock, not backdated)                                                                                                      |
| Independently extracted XML | One `time="2026-09-24"` and one `currency="USD"` leaf, `rate="1.1367"`; EUR base means **1 EUR = 1.1367 USD**                                                       |
| Route record                | `base: EUR`, `quote: USD`, `units: USD per EUR`, rate `1.1367`, effective date `2026-09-24`                                                                         |
| Source-byte SHA-256         | `884cf9f4db126e426adf7c8690d8f0038eebd506b6539d771e1155f5214f5b78` independently computed from the captured bytes; matches route `contentSha256` and local `shasum` |
| Route `rateRef`             | `ecb-eurofxref-daily:2026-09-24:884cf9f4db126e426adf7c8690d8f0038eebd506b6539d771e1155f5214f5b78`                                                                   |
| Independent comparison      | Date, numeric rate, direction, source URL, source-byte hash and rate reference **all agree**                                                                        |

The public [captured XML](sol-client-05g/ecb-daily.xml) and machine-readable [route proof](sol-client-05g/route-proof.json) preserve the exact observation with [ECB attribution](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml). It is a dated reference, not an executable exchange quote or evidence that a future ECB response will have the same contents.

**Cache proof:** Calling the same imported handler again in the same process returned HTTP `200`, `Cache-Control: public, s-maxage=3599`, byte-for-byte identical JSON record and unchanged `fetchedAt`. Outbound count and guard-attempt count both remained **1**. The one-second cache-header change reflects elapsed wall time, not a new fetch. No error/stale response was induced in this live run; prior local 05F tests cover those branches synthetically.

## Real-rate / synthetic-sales UI replay

The focused [browser case](../../tests/browser/physical-copies.spec.js) replays the accepted route JSON through the actual detail UI. It freezes only the **offline browser clock** at the observed `fetchedAt`, after the live route observation. All nonlocal browser traffic is blocked. Its three native USD completed sales are synthetic fixture rows ($100, $120, $140 on the captured rate date); their links and card identity are fixtures, not provider evidence. `/api/sales` and `/api/fx` are fulfilled locally. The independent expected arithmetic is `$120 ÷ 1.1367 = €105.5687516495…`, displayed `About €105.57 · ECB rate dated 2026-09-24`.

| Browser          | Result                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Desktop Chromium | Passed; [screenshot](sol-client-05g/desktop-chromium-real-rate-synthetic-sales.png) visually inspected |
| Mobile WebKit    | Passed; [screenshot](sol-client-05g/mobile-webkit-real-rate-synthetic-sales.png) visually inspected    |

Both screenshots show the $120.00 native sold-derived estimate and three original USD fixture-sale links, with the dated EUR amount as a secondary equivalent and the ECB source disclosure. Assertions compare native amount, evidence-link text and selected USD currency before and after the toggle; check the paired `rateRef`; and observe **one** sales fetch, **one** intercepted FX fetch, and **zero** API/REST write requests. This is browser-engine replay, not a physical iPhone test and not a live-sale or live-provider valuation. No live-price screenshot was created.

## Reproduction and scope

The live command was run exactly once: `node scripts/client-05g-ecb-proof.mjs`. **Do not rerun it**: `preflight.json` is an exclusive one-shot marker, and 05G permits no second source request. Verify the retained bytes offline with `shasum -a 256 docs/evidence/sol-client-05g/ecb-daily.xml` and inspect `route-proof.json`. Offline replay command: `npx playwright test tests/browser/physical-copies.spec.js --grep CLIENT-05G --project=desktop-chromium --project=mobile-webkit --workers=1` — **2 passed, 0 failed**. `node --check` on the harness/test, scoped Prettier check and scoped `git diff --check` passed. No unrelated full suite was rerun because implementation hashes match Astra's accepted snapshot.

| File                        | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `api/fx.js`                 | `667b377442de501aef7d8503e30579728ed0c3a92ef489b1988e4683856064da` |
| `lib/fx.js`                 | `2596780a21c0a9146c1f7138ad5805f422606246c6ba544b86091a73db63608d` |
| `app.js`                    | `cb49d1a08500767668588f37ff7c94c0247fa7f720f19ade85ba537ab2ba5251` |
| 05G one-shot harness        | `4341c90223ab991623e90531eded862083624af63fbb875cd4ec524ea622a932` |
| Browser spec after 05G case | `f02b1a8fa3b754be54b59834e964faa062eade18f819a0769e52a641a7209da6` |

The browser spec had pre-existing CLIENT-05F and physical-copy cases; 05G added one focused case. The broad dirty worktree remains intact. The source and screenshots are public/synthetic evidence; no provider numeric sale payload was retained.

## Step 5 status and outstanding gates

| Gate                                                                        | Current state                                                                                                                                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact-context local valuation                                               | **Accepted locally** under Astra's CLIENT-05/05 revision review; synthetic API-to-estimator/browser evidence exists.                                                             |
| Fixed-sample live paid-provider valuation                                   | **Measured insufficient** in 05D: two contributing rows after a capped two-request/11-credit attempt; no positive numeric live estimate established. No provider request in 05G. |
| Local USD/EUR display conversion                                            | **Accepted locally** by Astra 05F under Elliott's explicit scope approval; native sale evidence remains separate.                                                                |
| Current live ECB source                                                     | **05G passed for one observed response** through the existing FX route, cache and offline real-rate/synthetic-sales replay; awaits Astra review.                                 |
| Production canonical mapping, retained numeric evidence and provider rights | **Open.** The diagnostic 05D identity mapping remains harness-only; reproducible live numeric ledger and production retention/display permissions remain unresolved.             |
| Historical transaction / portfolio conversion                               | **Deferred and unapproved**; 05F/05G cover only indicative current detail display.                                                                                               |
| Release and broader client gates                                            | Open, including real-device/photo/recognition and official certificate gates where applicable. No deployment or CLIENT-06 authorization.                                         |

**Stop for Astra review and the next concrete prompt.**
