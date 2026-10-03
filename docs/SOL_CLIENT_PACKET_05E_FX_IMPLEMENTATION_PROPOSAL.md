# Sol CLIENT-05E — concrete USD/EUR conversion proposal

## Scope and required skill

Use `ponytail:ponytail` in **full mode**. Read its installed SKILL.md, AGENTS.md, both roadmaps, CLIENT-05 acceptance and CLIENT-05D review. Apply reuse and smallest-correct-change principles to design; do not invent implementation work for a research/design packet. Preserve the dirty worktree. This is the sole active packet.

Prepare a concrete implementation proposal for the Step 5 FX approval gate. The roadmap requires separate approval before adding conversion; this packet is **read-only application analysis plus documentation**, not that approval. No dependency, application/schema edit, live paid-provider request, deployment, commit, external message or CLIENT-06 work.

## Astra's proposed technical direction

Limit initial conversion to USD/EUR **current indicative display values**, using the ECB euro reference rate. Native sales stay in their own pools; convert an already computed eligible native estimate, not individual mixed-currency sales to manufacture enough comparables. Preserve original amounts/currency and estimator confidence. Converted USD evidence does not become EUR-market transaction coverage. No historical acquisition/sale cash-flow conversion or portfolio/P&L calculations in this slice.

Astra checked these primary sources on 2026-09-24; read them, then follow the download link to the actual current machine-readable feed rather than guessing its URL:

- [ECB reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html): currencies quoted per euro; normally published around 16:00 CET on working days except TARGET closing days; informational reference rates, discouraged for transaction execution.
- [ECB usage terms](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html): accurate reuse with source attribution, disclosure of modifications, and conditions for information in paid documents. Record relevant application implications without claiming legal clearance for unrelated providers or future subscriptions.

No new paid provider is proposed. Prefer existing runtime/standard library facilities; determine whether the chosen format can be parsed safely without adding a production dependency. Do not install anything. One public feed fetch for schema validation is allowed; no polling loop or full history download.

## Required proposal

1. Trace existing currency controls, money formatting, exact valuation output and API/cache patterns. Name the minimal files/functions to change and the owner/account/context protections to reuse. Identify whether the native-evidence currency and display currency are currently conflated; propose a clear separation without relabeling native evidence or multiplying provider requests.
2. Specify the rate record: source ID and URL, base EUR, quote USD, units USD per EUR, positive finite rate, effective calendar date, fetched timestamp and stable content/version reference. Do not fabricate an intraday source timestamp from a date-only feed. Define USD→EUR division and EUR→USD multiplication, same-currency identity, rounding only for display and preservation of original values. Give independently calculated examples using clearly synthetic rates/amounts.
3. Specify timeout, fixed-source allowlisting, response-size/content limits, malformed/duplicate/missing/future-rate handling and caching. Do not create a general FX platform, cron service or unnecessary storage. Explain exactly how a rendered conversion can be traced to the rate actually used; a later fetch must not silently change a saved calculation's reference.
4. Propose a simple dated-rate freshness policy covering ordinary weekends and source holidays without pretending a weekend rate is live. Include stale/error behavior and preservation of the last valid source record. Missing/invalid FX must leave native value visible and converted value unavailable; it must not produce zero or substitute a guessed rate. Distinguish stale FX from stale sale evidence.
5. Describe the precise existing-screen UI: native estimate, optional converted display, compact source/date, and missing/stale recovery. State whether conversion is explicit or follows an existing user display preference. Avoid another mandatory modal or configuration tutorial. Do not hide that converted value still rests on the original market's evidence.
6. Provide an executable-test plan and hand-calculated expected cases: direction/inverse, same currency, rounding, zero/missing estimate, sparse sales unaffected by conversion, date/timezone boundaries, weekend/holiday staleness, invalid/future/duplicate rates, fetch failure, native estimate refresh, fast currency/copy/account changes and no inventory/transaction writes. Tests are a plan here; do not claim they ran or add production code.
7. Finish with one approval-ready implementation scope and clear exclusions. Include the exact source, supported pair, freshness/default behavior, expected changed files, test commands, operational cost/dependency implications and remaining gates. If a material product choice cannot be inferred, provide a recommendation with the tradeoff rather than a menu of speculative architectures.

Write `docs/evidence/SOL_CLIENT_PACKET_05E_REPORT.md` and a concise proposed implementation checklist within it. No need for another broad provider comparison: assess the proposed ECB route and identify a concrete blocker if it cannot support the intended informational use. Distinguish a design decision from production activation approval. Stop for Astra review; Astra will provide the next implementation prompt or exact revision.
