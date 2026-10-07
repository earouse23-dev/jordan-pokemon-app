# Mica client correction brief — 2026-10-02

Elliott requests a client-only scope reset, a simpler and substantially better interface, and correct use of the purchased PkmnPrices Pro integration. This supersedes proceeding through the old roadmap or treating feature count, deployment success and passing unit tests as product acceptance. Astra performs review; Sol remains the implementation owner. No application code was changed in this audit.

## Sources reread

Astra fetched the Mica Notion hub and all four linked pages on October 2 and searched Mica, Jordan and client meeting. The client-call source discovered is the **Mica Client Requirements** page, which identifies itself as Jordan call notes plus Elliott follow-ups; no separate original recording/transcript was discovered. Full safe page snapshots are in `docs/evidence/notion-2026-10-02/`. The hub's unrelated private content was not copied.

- [Client call requirements](https://app.notion.com/p/3deaaba4c66581a7b5e3fdbb85987863): primary authority for the core product and simple interface.
- [API/market additions](https://app.notion.com/p/3dfaaba4c665815c9126ff7d3ded0727): sealed/ETB inventory, regional data, history and source links explicitly added.
- [eBay verification](https://app.notion.com/p/3e2aaba4c66581d1936af1aa7c79ae34): real requested later workflow, not evidence it is shipped. Prior certificate-provider/extension gates remain explicit.
- [Card Ladder audit](https://app.notion.com/p/3e2aaba4c66581f9b8b0d3f5717d6a33): reference and suggestions, not a feature checklist or permission to clone every surface.

The historical software roadmap, client pivot, completion ledger and Pro review were cross-checked. Old broad-roadmap Step 8 explicitly introduced folders/locations/goals. That provenance explains their presence; it does not override Elliott's rejection. Later owner decisions still apply: first public App Store release and subscriptions remain the goal, with business settings undecided. Do not reinstate the older TestFlight-only/no-subscription cutoff by rereading the meeting.

## Confirmed problems

Astra inspected the authenticated live dashboard and Library with browser accessibility state and screenshots. Observed: Collector/Investor/Seller selector; seller workspace and business panels; Trade bottom tab; folders/goals/location completeness prompts; dominant raw-card categories; repeated unavailable-price labels; nested bordered cards, dense metrics and explanatory blocks. Personal amounts and customer identifiers are deliberately omitted here.

The implementation contradicts the requested graph → P/L percentage → current portfolio value hierarchy. Preserving existing records and secondary capabilities became a reason to expose too much UI. Deployed provider holds intentionally stop vision/sales/graded valuation/sealed routes, while shipping card lookup bypasses the Pro provider. A configured key cannot override that code. The current Pro key/account/quota were NOT authenticated in this audit; the September invalid-key observation must not be treated as proof of today's credential state.

## Required experience and subtraction

| Keep and make work | Change to the visible product |
| --- | --- |
| Graded Pokémon: EN/JA/DE, PSA/BGS primary; later API note includes CGC | Default to this scope rather than raw collection/seller management |
| One front slab photo, automatic framing/correction, identify → correct → save once | One obvious add action; no forced folder, location or speculative organization questions |
| Per-copy certification, purchase price/date, notes, photo, sale/history and horizontal copy switching | Compact inventory and detail hierarchy; preserve unknown basis rather than inventing P/L |
| Portfolio and item charts; 1w/1m/6m/1y; value and P/L | Graph first, P/L percentage and value immediately after; compact coverage with optional details |
| Exact sold-based graded estimate and confidence, source/date and eBay/TCGplayer links | One primary estimate; expanded supporting evidence; no raw-price substitution |
| Sealed/ETB recognition, confirmation, save, Cardmarket value/history | Keep as the explicit later addition; do not confuse it with raw-card expansion |
| Useful inventory filters: language/set/grader/grade/value/P&L/movement/date | Compact filters, not another dashboard of controls |
| Auth/profile/privacy/legal, existing records, pregrading and insights | Keep required secondary access without competing with portfolio/inventory/add |

Remove folders/goals/physical-location/custom-field management, mode switching, seller/business panels and Trade from the primary client experience. Preserve stored fields, memberships, transactions and older records. Removing a UI control must not submit empty defaults that clear hidden data. Keep all existing inventory accessible; do not silently hide or discard legacy raw holdings. No new competitor-derived feature, social layer, marketplace, index system, branding or framework rewrite.

Visual direction: fewer containers and shadows, clear typographic hierarchy, restrained separators, consistent spacing, compact rows/card details, one primary action. Eliminate duplicate messages. Keep missing/stale coverage and accessible labels truthful but concise. Compare actual rendered phone-width screens before/after; a selector test alone cannot establish good visual quality.

## PkmnPrices Pro: documented entitlement versus app behavior

Current official [plan page](https://www.pkmnprices.com/developers) and [limits](https://www.pkmnprices.com/docs/rate-limits) advertise Pro at $14.99/month, 20,000 daily account credits, 60 requests/minute, five keys, EN/JA/DE, EUR, sealed, history, listings and commercial use. Elliott says the subscription is purchased; this audit did not verify its live account state. No new purchase is required by the proposed integration work. Credits are returned-item based, reset at midnight UTC, and require bounded pagination/caching rather than unlimited polling.

| Capability | Correct implementation contract |
| --- | --- |
| [Cards](https://www.pkmnprices.com/docs/cards) / [sets](https://www.pkmnprices.com/docs/sets) | Search exact language/set/number; list responses lack price data, then fetch selected ID; current prices are per condition/printing/currency, not universal slab values |
| [Graded eBay sales](https://www.pkmnprices.com/docs/ebay-listings) | Request graded=true and exact grader/grade/variant; validate identity/qualifiers and attribution; read row currency; sold_at is recency, ingested_at/since is ingestion; deduplicate; limit at most 20/page |
| [Sealed](https://www.pkmnprices.com/docs/sealed) | List then detail; currency=eur for Cardmarket; mapped product URL/ID when provided; empty EUR prices mean absent coverage, not zero value |
| [History](https://www.pkmnprices.com/docs/price-history) | Up to 365 days of TCGplayer/Cardmarket aggregates; limit means rows, not days; filter condition/variant/currency; not sold counts, exact graded history or a reconstructed owner's past portfolio |
| [Cardmarket offers](https://www.pkmnprices.com/docs/cardmarket-listings) / [TCGplayer offers](https://www.pkmnprices.com/docs/tcgplayer-listings) | Asking-price context and source links, never completed-sale evidence; language/currency remain explicit |
| [Authentication](https://www.pkmnprices.com/docs/authentication) / [SDK reference](https://www.pkmnprices.com/docs/sdks) | Existing server adapter with X-API-Key for data; account JWT endpoints are different. No new SDK is needed merely because one exists |
| [Errors](https://www.pkmnprices.com/docs/errors) | Distinguish invalid key, plan gate, quota/rate limit, missing identity and genuinely empty coverage; never say connected just because an environment variable exists |

The documented API does not supply Mica's vision engine, a PSA/Beckett cert lookup or GemRate population integration. Those are separate missing capabilities; paying for Pro does not solve them. Do not claim all languages/grades have dense comps. Older Pro review's exclusion of sealed is superseded by the explicit later requirement; its deprecated sale_count warning is historical (the current adapter already comments on removal).

No provider data calls were made during this review. Elliott subsequently explicitly authorized use of the existing 20,000-credit Pro daily allowance ("go ham"), superseding the old zero-credit and proposed 100-credit constraints. Sol may use the available remaining account allowance for integration and meaningful validation without asking again for arbitrary tiny experiment budgets. Verify current Pro entitlement/remaining use through supported secure channels; count all consumers and reserve worst-case returned rows before requests. Reuse existing server-enforced budget, cache, deduplication and rate controls; respect the documented 60 requests/minute and account-wide daily reset. No upgrades, top-ups, overages, new subscription or unrelated AI-provider spending. Do not burn credits merely to reach a cap. Elliott also reaffirmed that Notion contains the client's requested features; older competitor roadmap suggestions add no scope.

## Sol execution direction

Read installed ponytail:ponytail SKILL.md first and use FULL mode. This is one client-correction batch, not automatic CLIENT-08 advancement. Read the four fresh source snapshots and trace actual UI → route → provider → saved value paths before editing. Reuse existing code. Every retained/prominent feature must map to an explicit requirement or necessary security/account function; suggestions are not mandates.

First implement the subtraction and visual hierarchy above across portfolio, inventory, add/confirmation and item detail. Keep pregrading/insights secondary. No data-deleting migration. Repair relevant Pro adapter wiring and diagnose credential/plan/mapping separately from release holds. Enable the requested PkmnPrices-backed paths once entitlement and quota controls are verified; do not leave them permanently held merely because they use the already-purchased subscription. Do not blanket-enable AI, notifications or unrelated providers. Within the newly authorized remaining Pro allowance, validate EN/JA/DE, detail/history, EUR/sealed, marketplace links and graded sold evidence with useful representative coverage. Reserve worst-case returned rows before requests, stop retrying credential/plan/quota failures and retain redacted usage evidence. Missing credential access blocks only dependent provider work; complete independent UI fixes. Any scheduled pricing refresh must share the account budget and caching policy and be explicitly documented; never restore old uncontrolled jobs.

Acceptance: actual before/after mobile and desktop visual review; no folder/location/trade/mode clutter in the primary flow; correct preserved values on save/reopen; copy switching and selected-copy sale; truthful compact chart/coverage; appropriate source-specific provider evidence. Use owned synthetic data for write tests and never change customer records for a demo. Label fixtures and do not substitute browser simulations for live API or device proof. Report the exact remaining recognition/certificate/device blocks rather than calling a held route a completed feature.

Standing publication authorization remains for completed verified work; record exact changes, hashes, commit/deployment links and any remaining held providers. Keep the deployment within the proven free-plan function limit and preserve deletion/security behavior. No speculative feature work. Return one source-linked correction report and real rendered screenshots, not another sequence of infrastructure-only completion reports.

## Elliott dashboard refinement — 2026-10-04

Owner direction in this thread supersedes earlier dashboard timeframe/control presentation: make the actual graph the main visual focus, reclaim dead space and remove unnecessary metric boxes. Keep one P/L box with an independent timeframe control. Both P/L and graph default to All time; each offers Month, Year, YTD, Day and All time. Place the graph timeframe selector at its top right. Draw the graph on dashboard entry with an animation, respecting reduced-motion preferences and preserving factual price gaps. Supporting original amounts, coverage and diagnostics stay optional. This adds no folders or other competitor-derived functionality. Period results require recorded evidence; unavailable history must not become a fabricated return. Publication and provider/security gates remain unchanged.

Further owner direction in this thread: remove visible price-point dots from the portfolio chart and use one flowing line. Preserve original values, missing-data gaps, supporting evidence and accessible value inspection.

## Elliott checklist additions — 2026-10-05

Treat further owner suggestions as additions to this active checklist; finish the current item before switching unless Elliott explicitly requests a priority change. Preserve the whole client-reset objective.

- [ ] Scan → identify exact printed name/number/language and raw versus slab grader/grade → confirm one identity → request pricing for only that card. Show the confirmed identity in that order. Never fan paid pricing out across candidate cards or silently choose an ambiguous provider identity.
- [ ] Verify exact request/credit counts with the purchased Pro API. Reuse mapped IDs and cached responses. The documented known-ID current-detail endpoint can return all permitted currencies in one request; unknown IDs need mapping, and graded sold evidence/history are separate endpoints. Do not claim one photo universally costs one request or one credit.
- [ ] Preserve requested EN/JA/DE, USD/EUR, sealed, history and graded-sale behavior; request each capability when relevant rather than all endpoints for every scan. No unrelated provider activation.

Local implementation/evidence belongs in the work log; checklist completion requires the real provider/workflow verification stated above.

## Elliott checklist additions — visual edges and full-screen capture

These are pending checklist additions, not completed implementation. Keep the current work order unless Elliott changes it.

- [ ] Remove unnecessary boxed containers and sharp 90-degree corners across the app. Use modest, consistent curves on remaining panels and controls; pill shapes are not required. Preserve readable hierarchy, accessibility and useful screen space.
- [ ] Make the plus/add-card action open a full-screen photo capture experience instead of a popup.
- [ ] Remove tripod guidance/control and the flashlight control from that capture screen. Keep a circular capture button, a back icon immediately beside it on one side, and a photo-library icon on the other side. Preserve phone photo selection, camera permissions, accessible labels and existing capture/save safety boundaries.

Elliott requested confirmation once these additions were saved so they can pause the goal and resume tomorrow. This message alone does not mark the goal paused.

## Elliott Safari camera reference — 2026-10-05

The supplied visual reference clarifies full-screen capture: edge-to-edge live camera video within Safari’s available viewport, with controls overlaid; back at top-left, photo library bottom-left, circular shutter bottom-center. This supersedes the earlier request for back beside the shutter. Remove the inset preview panel and white page margins. Preserve safe-area spacing, permissions/library recovery, correction, owner checks and privacy. Safari’s own browser chrome remains browser-controlled. Target a functioning Safari web beta; App Store/native signing remains separate. Check account usage at meaningful work milestones, avoid redundant test/rebuild runs and prioritize required beta flows without substituting fixture success for live acceptance.

## Elliott checklist addition — password reset, 2026-10-05

- [ ] Fix the reported non-working password-reset flow. Trace request/reset email handling, allowed redirect, Safari recovery link/session, new-password form, failure/retry and successful sign-in. Preserve authentication and owner boundaries. Verify the full flow with an authorized existing disposable account before marking it working. Elliott requested this be added to the checklist; no reset email, password change or hosted setting change is authorized by this checklist addition alone.

## Owner continuation — 2026-10-05

Elliott removed the Astra review gate for this reset, authorized Vercel bypass remediation and an isolated demo account, and will perform physical iPhone Safari testing. Routine verified publication remains authorized. Customer data, provider budgets, destructive migrations, dependencies/platform and App Store boundaries remain. See checkpoint58 evidence; beta acceptance is still incomplete.
