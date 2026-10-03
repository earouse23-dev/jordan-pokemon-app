# Mica MVP implementation brief

Owner: Astra. Implementation: GPT-5.6 Sol. Date: 2026-09-17.

## Authority, evidence, and current baseline

Elliott's September 17 direction authorizes Astra to define the product scope and review Sol's implementation. This updates the older software-only restriction for this brief. Existing data-preservation, dependency, verification, and production-approval rules still apply. This brief is an incremental product acceptance plan, not permission to rebuild Mica or renumber the existing software roadmap.

The Card Ladder findings below are user-supplied research. Astra did not successfully inspect the signed-in competitor session. Treat the reported features as inspiration, not independently verified observations or proof of API availability. The reported subscription price does not establish Mica's pricing.

Repository baseline: HEAD `88c10ed` plus substantial pre-existing tracked and untracked work. A clean checkout of HEAD would omit relevant implementation. Preserve that work. Source and documentation were inspected for this brief; application tests and live-provider checks were not rerun.

Existing foundations include canonical identity, variant selection, normalized pricing, acquisition lots/FIFO, graded ownership, watchlists, collection organization, goals, alerts, and recovery tests. The retrospective reports previous software verification for roadmap Steps 1–8, while explicitly deferring live-provider, production, device, and human evidence. Those historical results do not prove this dirty workspace currently passes.

## Product thesis and target users

Mica helps Pokémon collectors identify the exact card they have, organize their copies, understand what the available price evidence supports, and decide what to collect next.

Primary user: a Pokémon collector managing raw cards and occasional slabs, with incomplete cost or condition information and a mix of duplicate, wanted, and owned cards. Secondary user: a collector who actively buys, sells, or trades and needs dependable ownership and cost history. Professional dealer operations are outside this MVP expansion.

The core loop is **find the exact printing → understand its value evidence → record ownership → see collection and completion progress → choose the next wanted card**.

Success means accurate completed tasks, not feature count. No accepted test case may silently switch language, finish, edition, printing, raw/graded state, grader, or grade. A collector can reach an exact profile from a result in one action and start adding that selected card in one more action. Extra decisions appear only when actual ambiguity requires them.

## MVP boundaries

### Now: dependable collecting foundation

- Search the supported Pokémon catalog by name, set, and collector number; distinguish English/Japanese and all supported variants. Existing additional coverage stays available where proven.
- One canonical card profile reached from search, collection, wants, or set progress, with explicit valuation context.
- Existing compatible market values and genuine sold evidence where an approved source provides them; honest unavailable states elsewhere.
- Reliable ownership entry, quantity, condition, separate acquisition lots, cost basis, locations, and duplicate visibility.
- Basic portfolio value with visible coverage, currency separation, and clear distinction between market change and money added.
- Separate want-list intent from price watching, reusing current storage where its semantics are adequate.
- Retain and validate existing set/binder progress and trade-list capabilities; do not remove useful working features because they appear later in the improvement sequence.

### Next: focused collector improvements

- Dependable threshold alerts on exact compatible evidence.
- Grading-company population snapshots only with a proven, permitted source; improve slab/certification context using existing capabilities.
- Deeper set/binder completion, missing-card actions, duplicate/upgrade intent, and saved searches.
- CSV and certificate import improvements with previews, ambiguity review, receipts, and safe retry.
- Exact-card marketplace discovery through clearly labeled outbound listings when available under current access.

### Later / explicit non-goals

- Marketplace checkout, payments, subscriptions, escrow, shipping, disputes, or new billing work.
- Advanced indexes, forecasts, investment recommendations, complex analytics, or index comparison dashboards.
- Social feeds, public collections expansion, trade matching, messaging, native-app migration, additional TCGs, or professional seller workflows.
- New AI grading models, grading calibration expansion, or an overhaul of the working grading lifecycle.
- A Card Ladder visual clone, collection of competitor private data, or assumptions that a consumer trial permits API use.

Keep existing advanced features functional; reducing their prominence does not authorize deleting records or workflows.

## Core screens, navigation, and workflows

| Screen | Main job | Visible result and next action |
| --- | --- | --- |
| Home | Resume collecting | Collection summary, incomplete coverage, recent additions, one relevant next action |
| Search | Find an exact printing | Name/image, set/number, language, differentiating variant; open profile |
| Card profile | Understand this printing | Identity, selected raw/graded context, value/freshness/confidence; Add to collection and Watch |
| Collection / Library | Find and manage owned copies | Filters, duplicate counts, location, quantities; open owned position or add another copy |
| Add item | Record ownership | Chosen printing retained; condition/state, quantity, acquisition facts; save receipt or retry |
| Wants and Watchlist | Record intent and follow evidence | Want versus watch shown separately; exact-card destination |
| Sets / Binders | See progress | Defined completion scope, owned/missing count, duplicates; open missing printing |
| Account / Activity | Manage account and notifications | Preferences, alert history, privacy/export access |

Navigation target: Home, Library, Search, and Wants, with a prominent Add item action. Sets/Binders live inside Library; portfolio valuation lives on Home/Library; account and alerts are secondary destinations. Desktop uses the same information hierarchy. This is a target for a later dedicated navigation slice, not a first-packet redesign. Current mobile navigation is Home, Library, Add item, Trade; retain it while the profile slice is reviewed.

Main flows:

- Search → exact profile → Add → save → owned position. Keep the selected identity through sign-in, retries, and refreshes.
- Library → owned copy → inspect its price context or record another acquisition. A second purchase remains a separate lot.
- Profile → Want or Watch → list → same exact profile. Wanting a card does not automatically enable notifications.
- Set → missing card → exact profile → Want. Another language or finish cannot satisfy an exact goal accidentally.
- Profile → sold evidence → source details. Asking prices, market aggregates, and completed sales remain distinct.

## Pokémon card data model

This is the logical contract. Sol chooses technical implementation and maps it to existing entities before proposing schema changes.

| Entity | Meaning and required boundaries |
| --- | --- |
| Set / release | Internal ID, localized name, language/region scope, series, release information, source provenance. English/Japanese releases are not interchangeable by translated name. |
| Card printing | Internal ID, release ID, printed collector number plus normalized search key, language, printed name, card type, rarity, image provenance, optional artist/character links. Trainers and Energy are valid cards; Pokémon name is not mandatory. |
| Exact variant | Internal ID, printing ID, finish, edition/stamp, printing treatment, promo distribution and other evidenced distinguishing attributes. Unknown and not-applicable are distinct. |
| Provider mapping | Provider plus external ID and context → internal printing/variant, with source, match state, rule version, and correction history. Provider IDs never become global identity. |
| Graded context | Exact variant, company, grade as a precise value/string, grade scale/label where needed, qualifiers; a certificate belongs to a physical owned copy or a source observation. |
| Population snapshot | Exact variant, company, grade/scale/qualifier, count, publication/retrieval times, source and coverage. Missing differs from zero. |

Reuse `cards`, `card_variants`, `collectible_identities`, provider mappings, `collection_items`, and existing grading lineage. State, condition, company, grade, certificate, costs, and ownership must not mutate the underlying printing identity.

Specific risks to resolve before broadening identity behavior:

- Preserve collector-number prefixes, suffixes, denominators, and original display strings. Normalization may aid search but cannot prove identity across sets.
- Finish is separate from rarity. Reverse holo, special foil patterns, stamps, and distribution variants need evidenced distinctions; avoid flattening every parallel into one interchangeable variant.
- First edition and shadowless/printing treatment are not safely modeled as universally exclusive choices. Do not infer absent attributes from a card name or invent impossible combinations.
- Current `lib/identity.js` maps blank edition to unlimited and blank promo to none. Trace where evidence is missing versus confirmed before changing it; this is an observed normalization rule and a risk, not a demonstrated production defect.
- Raw wear stays unknown unless supplied or confirmed. An AI condition/grade estimate is a separate uncertain observation, never an official grade.
- A profile selection is not permission to change an owned item's identity or grade. Browsing PSA 10 prices must not turn a raw owned item into a slab.
- Duplicate certificate detection is scoped to company and normalized certificate, with a warning/review path. Certificate lookup alone does not authenticate a physical card.
- Unresolved items can remain in a private review state, but cannot receive exact-card prices or exact completion credit until matched.
- Identity corrections preserve ownership and ledger history, invalidate incompatible evidence, and remain auditable/reversible.

## Pricing and confidence model

Reuse the existing evidence contract rather than create another price field or scoring engine.

An observation needs exact identity, raw condition or graded context, evidence kind, source/source record, market, currency, amount, relevant sale/observation date, retrieval time, and any known fee/shipping treatment. Keep sale verification status and verification basis separate from identity confidence and valuation confidence. A provider's verified flag is not Mica independently verifying the sale.

Estimate rules:

- Select only compatible identity/state/condition or company/grade evidence within the selected market/currency. No fallback from a missing graded quote to raw, or Japanese to English.
- Unknown raw condition cannot receive an unqualified Near Mint valuation. A labeled reference value can be shown separately from the owned item's unavailable estimate.
- Show amount/range where supported, source, evidence date, and a compact confidence label beside the value. Optional details explain comparable count, age, exclusions, methodology, and conflicting sources.
- Display latest sold price, asking price, provider aggregate, derived estimate, and owner-entered value as different concepts. Do not invent sold history from market-index points or represent listing price as realized price.
- Use the existing versioned freshness windows in `lib/pricing.js`; document them as operational policy, not proof of statistical accuracy. Retrieval today does not make an old sale fresh.
- Confidence labels should describe evidence strength (strong, limited, insufficient); do not imply a probability that the card will sell for that amount. Preserve/test the current calculation before changing labels or scoring. Calibration is required before probabilistic accuracy claims.
- Stale, unsupported, no matching data, and temporary failure are distinct internally, with concise helpful UI. None becomes zero. Retain last valid evidence with its actual age when appropriate.
- Outlier exclusions retain the original records and a reviewable reason. Never quietly erase inconvenient sales.
- USD and EUR stay separate; no new FX conversion. A Pro configuration label does not prove entitlement.

PkmnPrices Pro remains the approved target, TCGdex the existing catalog/raw fallback, and disabled providers remain disabled. Sold records and population are conditional on actual supported responses and permitted use. Missing access must produce an explicit limitation rather than fabricated results.

Portfolio estimate: sum compatible eligible unit values × owned quantities per currency. Report priced units / total units, unpriced positions, stale coverage, and the scope/time of the summary. A partial loaded page cannot stand in for a full portfolio. Do not present a monetary coverage percentage when the unknown value is unknowable. Cost basis and returns must state when acquisition costs are incomplete; acquisitions are not investment gains.

## Collection model

- Owned position: owner, exact collectible or unresolved identity, raw/graded context, quantity, inventory state, timestamps, notes and organization links.
- Acquisition lot: position, acquired date/method, quantity, currency, actual paid amount or explicitly unknown basis, fees/shipping where known, remaining quantity. Keep FIFO and historical lots.
- Physical copy: distinguish slabs and individually tracked raw cards. Preserve one grading lineage across submission, return, and later sale.
- Organization: digital folders, tags, physical binder/box/page/slot location, saved filters. Do not add a second competing folder/list taxonomy.
- Want: desired printing/variant or an explicitly broader acceptable scope, optional desired state/condition, quantity and target price. Broader wants do not weaken catalog identity.
- Watch: exact valuation context and market/currency, independent of ownership and wants. Alerts require their own rule/preferences.
- Duplicate/upgrade intent: derived duplicate quantity plus owner-marked keep/trade/upgrade intent. Do not automatically mark every duplicate for trade or call a higher market value an upgrade.
- Completion goal: defined release/language/checklist/finish scope and catalog version. Distinct qualifying checklist entries determine progress; duplicate copies do not inflate it. Incomplete catalog coverage must be disclosed.

## User stories and acceptance criteria

| ID | Story | Acceptance gate |
| --- | --- | --- |
| ID-01 | I can select the exact printing I mean. | Same-name/number EN/JA and close-finish fixtures remain separate through result, profile, watch and add. Ambiguity is visible and cannot silently resolve. |
| ID-02 | I can understand a card before owning it. | Catalog preview works without inventing an owned position. Owned position actions remain owner-scoped. |
| PF-01 | I can research raw and graded contexts. | Context is explicit; incompatible quotes never leak between contexts, including delayed responses. Browsing never mutates ownership. |
| PR-01 | I can judge a displayed value. | Every estimate has provenance, freshness and evidence-strength label; missing values are unavailable, never zero. |
| PR-02 | I can inspect real comparable sales. | Sold records show relevant date, source, currency, context and verification basis where known. Unsupported data is not replaced by fake history. |
| CO-01 | I can add another copy reliably. | Retry does not duplicate a purchase; selected identity and entered values survive failure; separate costs/lots remain separate. |
| PO-01 | I can understand my portfolio total. | Coverage and currency are explicit; missing cost/price data is disclosed; purchases do not count as price appreciation. |
| WL-01 | I can want or watch a card without owning it. | Independent intent, exact destination, no inventory or unsolicited-notification side effects. |
| AL-01 | I can trust an alert. | Exact compatible fresh evidence, deduplication/cooldown, working destination and mute control; provider failure cannot trigger a false threshold event. |
| GP-01 | I can inspect grading/population evidence. | Company/grade/scale/date/source remain explicit; missing population is not zero, totals are not claimed as unique physical cards. |
| SC-01 | I can see what completes my set. | Scope is visible; duplicates, wrong languages, and wrong finishes cannot inflate progress. |
| IM-01 | I can import without losing control. | Preview, unresolved rows, duplicate report, idempotent commit, receipt and rollback/correction behavior are verified. |
| UX-01 | I can use it on phone and desktop. | 390px and 1440px evidence, keyboard/focus checks, readable labels, no horizontal page overflow, working loading/empty/error/retry states. |

## Suggested build order and roadmap mapping

These are product slices, not replacement roadmap step numbers. Inspect and improve existing functionality; skip rebuilding acceptance criteria already proven. Only the first packet is assigned now. Each slice requires Sol evidence and Astra review before the next packet.

| Sequence | Vertical slice | Existing roadmap dependency | Priority / exit result |
| --- | --- | --- | --- |
| 1 | Catalog search → exact identity/profile shell | Steps 2, 3; reuse Step 4 evidence | Now. ID-01/02, PF-01, PR-01 and UX-01; first packet below |
| 2 | Complete canonical profile entry paths and actions | Steps 3–5 | Now. Same selected context from search/library/watch; no duplicate detail implementation |
| 3 | Sold-price history and evidence presentation | Step 4 | Now where entitled. PR-02; capability gap recorded if live source unavailable |
| 4 | Ownership, duplicates and acquisition continuity | Steps 3, 5, 8 | Now. CO-01; one reliable save path |
| 5 | Basic portfolio valuation | Steps 4, 6 | Now. PO-01; coverage and cash-flow separation |
| 6 | Want list and watchlist | Steps 3, 8; pricing from 4 | Now. WL-01; intent kept distinct |
| 7 | Price alerts | Step 9 and its dependencies | Next. AL-01; no expansion into every possible alert type |
| 8 | Grading context and population | Steps 4, 7 | Next. GP-01; licensed source required for population |
| 9 | Set/binder completion improvements | Step 8 | Next improvements, existing basics retained. SC-01 |
| 10 | Bulk CSV/certificate import improvements | Step 5 | Next. IM-01; no fabricated certificate matching |

This keeps Elliott's recommended sequence while starting with the usable search-to-profile slice. If slice 1 already satisfies slice 2 criteria, review that evidence rather than create redundant work. Security and recovery checks run in every slice. Original roadmap Steps 11/12 still govern release hardening; no slice acceptance authorizes production deployment or the excluded seller/platform branches.

## Validation and review checklist

- [ ] Capture the actual working-tree baseline; distinguish pre-existing changes from packet changes.
- [ ] Trace each changed acceptance criterion to code, a test or manual check, and evidence.
- [ ] Use close-identity fixtures: EN/JA, non-holo/holo/reverse, promo/stamp, first edition/printing treatment, unknown edition, ambiguous finish, Trainer/Energy and alphanumeric number.
- [ ] Exercise raw unknown condition, raw confirmed condition, PSA 10, BGS 9.5, other company/grade, missing/stale price, mismatched currency, provider error and delayed response.
- [ ] Check owned versus catalog context, multiple owned copies, save/retry idempotency, and unchanged acquisition history.
- [ ] Capture mobile/desktop before and after; verify keyboard order, focus after back/retry, and screen-reader labels. Emulation does not establish physical-device acceptance.
- [ ] Run relevant existing unit/browser checks and required repository checks; report exact command/results and clearly label baseline failures or unavailable prerequisites.
- [ ] Distinguish mock tests, local database tests, authenticated staging checks, live-provider evidence and real-device evidence. Do not claim one establishes the others.
- [ ] Explain capability gaps concisely in product UI and fully in developer notes.
- [ ] Review the packet-only diff and reject unrelated rearchitecture, new provider commitments or scope expansion.
- [ ] Astra returns ACCEPT, REVISE or BLOCKED against criterion IDs. A passing test suite alone does not establish product acceptance.

## Team operation and handoff

This conversation is Astra's planning/review session. Sol is the sole application-code writer for the active packet. Astra owns this brief and packets; Sol returns an evidence report. Separate windows do not automatically share conversation context: files and explicit handoffs are the source of truth.

Use the current workspace serially for one code writer. Do not open an additional writer on the same files. If a later parallel task needs an isolated worktree, first reconcile which uncommitted changes it requires; a worktree based on HEAD alone is not this baseline.

First-step budget: bounded planning and one handoff packet, maximum 10% weekly usage requested by Elliott. Astra has no reliable quota meter or enforceable percentage cap in this session. Do not claim measured compliance, start an unattended agent loop, or launch duplicate implementation agents. Sol starts only when the user submits the packet. Future packets are issued individually after review.

References inspected: `AGENTS.md`, `docs/MICA_SOFTWARE_ROADMAP.md`, `README.md`, `docs/MICA_STEPS_1_8_RETROSPECTIVE.md`, `docs/MICA_STEP3_IDENTITY_DESIGN.md`, `lib/identity.js`, `lib/pricing.js`, `app.js`, `index.html`, and the existing detail/search/price-evidence browser test inventory.
