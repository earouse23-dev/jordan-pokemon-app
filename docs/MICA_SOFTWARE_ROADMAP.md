# Mica Codex Software Handoff

## Scope

This roadmap covers the Mica software only. It does not assign product vision, customer selection, business model, subscription pricing, marketing, or company strategy. Those decisions belong to the client.

The software goal is to make Mica easier, faster, more trustworthy, and more dependable than competing Pokémon collection applications.

## How Codex must use this roadmap

- Read the entire roadmap before proposing work.
- Inspect the repository and its active AGENTS.md instructions before making changes.
- Treat the phases as dependencies, not as one large implementation request.
- Execute one numbered step at a time.
- Start with Step 1 in read-only mode.
- Wait for the required Work or Chat deliverables before starting a dependent Code step.
- Ask for approval before destructive migrations, paid services, new production dependencies, platform changes, or production deployment.
- Preserve existing user data and unrelated work.
- For every implementation, add or update tests, run relevant checks, review the diff, and report evidence.
- Do not claim completion when a provider, credential, dataset, device, or client decision is missing.

## First Codex session

Use GPT-5.6 Sol with xhigh reasoning. Open the connected Mica repository in Code. Use Plan mode for the initial handoff.

Paste this prompt:

```text
You are taking over software implementation for Mica, a Pokémon collection application. The attached Mica Codex Software Handoff is the authoritative technical roadmap. The Forge Labs Handbook defines the engineering standards. This work covers software only. Do not make product vision, target-customer, business-model, subscription-pricing, or marketing decisions.

Read the entire handoff, the complete repository, all active AGENTS.md files, the README, package configuration, database schema and migrations, environment examples, deployment configuration, tests, and existing documentation.

For this first session:
1. Confirm the repository root and list the instruction files you loaded.
2. Summarize the current architecture, stack, important directories, providers, database, authentication, background jobs, testing, deployment, and known constraints.
3. Map every roadmap step to the current files, services, routes, database entities, and dependencies.
4. Identify missing access, credentials, sample data, device tests, and client decisions.
5. Create a safe execution plan that respects the roadmap dependencies.
6. Perform Step 1 only as a read-only audit.

Do not change production code, database data, dependencies, configuration, deployments, or external services during this first session. Do not begin later steps. Do not attempt to implement the entire roadmap at once.

Return:
- Repository and instruction summary
- Current architecture map
- Step 1 capability and flow audit
- Roadmap-to-code mapping
- Critical risks and broken flows
- Missing inputs
- Recommended next task
- Exact verification evidence

Stop and wait for approval after the Step 1 audit.
```

## Execution rules

| Step type | Run it in | Purpose |
|---|---|---|
| Live competitor or provider research | Work | Verify current software, documentation, limits, and screenshots |
| Technical option comparison | Chat | Compare verified options and prepare a decision for approval |
| Repository audit, implementation, testing, and verification | Code | Inspect, change, run, and verify the actual software |

## Phase 1. Understand and stabilize the current software

Research and audit only. Do not change production code.

### Step 1. Audit every existing feature and user flow

**Dependency:** Start here

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** This step requires full repository access, code tracing, data-flow inspection, and test analysis.

**Handoff:** Run the prompt directly in Code with the complete repository connected. Keep it read-only.

**Required outcome:** A verified map of what works, what partially works, what is disconnected, and what could mislead users.

#### Competitor software to beat

- Compare Mica's navigation and core workflows with Collectr, Dex, Double Holo, Card Ladder, PokeData, Rare Candy, Shiny, Ludex, CollX, and DeckTradr.
- Measure steps, clicks, waiting states, correction paths, mobile behavior, and error recovery.
- Do not score competitors from marketing pages alone. Verify live workflows or current product demonstrations.

#### AI work

- Inspect every route, component, API endpoint, database table, server action, third-party provider, feature flag, and environment dependency.
- Trace each user action from interface input through persistence and feedback.
- Classify each flow as operational, partial, disconnected, duplicated, hidden, misleading, or unverified.
- Map missing tests, analytics, loading states, empty states, error states, and recovery paths.

#### What to build

- No feature work in this step.
- Create a route inventory, dependency map, data-flow map, technical debt register, and verified capability matrix.
- Create screenshots or recordings for every critical before-state.

#### What Elliott must provide or decide

- Connect the complete GitHub repository.
- Provide development and staging access if they exist.
- Confirm which test accounts and existing user records must never be changed.

#### Exit gate

- Every visible feature has an owner, code path, data dependency, status, and verification result.
- No production data changed.
- Critical broken or misleading flows are ranked before new features.

#### Copy-ready prompt

```text
You are the lead software auditor for Mica, a Pokémon collection application. Work in read-only mode. Do not modify code, data, configuration, deployments, or third-party services.

Inspect the complete repository and the deployed app at https://jordan-pokemon-app.vercel.app/. Audit every route and feature, including onboarding, dashboard, collection, raw cards, graded cards, sealed products, scanning, manual entry, CSV import, purchases, sales, trades, watchlists, set progress, digital pre-grading, grading submissions, profitability, reports, exports, backups, sharing, alerts, privacy, and account deletion.

For every workflow trace the interface, component, state, API, database operation, external provider, loading state, error state, analytics event, and final user feedback. Classify it as operational, partially operational, hidden, duplicated, misleading, disconnected, or unverified.

Create a route inventory, capability matrix, data-flow map, dependency map, technical debt register, security risk list, performance baseline, accessibility gap list, and test coverage gap list. Include exact file paths and verified evidence. Mark every inference. Do not change production code.
```

### Step 2. Benchmark competitor software and convert gaps into requirements

**Dependency:** Requires Step 1 flow inventory

**Run in:** Work

**Model:** GPT-5.6 Sol

**Reasoning:** high

**Why:** This step needs live competitor research, current documentation, app-store evidence, screenshots, and browser interaction.

**Handoff:** Save the benchmark. Attach it to the repository task when you begin Step 3 in Code.

**Required outcome:** A technical comparison that shows which competitor workflows Mica must match, which it can beat, and which it should ignore.

#### Competitor software to beat

- Collection UX: Collectr, Dex, Rare Candy, Shiny, CollX, PriceCharting.
- Pricing intelligence: Card Ladder, PokeData, eBay Price Guide, Double Holo.
- Scanning: DittoDex, Shiny, Dragon Shield, Ludex, CollX, Rare Candy.
- Pre-grading: SnapGrade, CardGrade, Double Holo.
- Seller operations: DeckTradr, Double Holo, InVelocity.

#### AI work

- Record the shortest successful path for each competitor's core workflow.
- Compare required fields, defaults, corrections, batch actions, search quality, responsiveness, accessibility, offline behavior, exports, and recovery.
- Separate verified behavior from public claims.
- Turn each valuable gap into a testable software requirement with acceptance criteria.

#### What to build

- Create a competitor workflow matrix.
- Create a feature parity list, differentiation list, and rejection list.
- Create measurable targets such as correct cards per minute, import correction rate, and clicks per completed job.

#### What Elliott must provide or decide

- Provide access to any paid competitor accounts you already own.
- Approve paid competitor subscriptions before AI purchases anything.
- Choose which devices matter for testing. Recommended minimum is iPhone Safari, Android Chrome, and desktop Chrome.

#### Exit gate

- Every proposed feature links to a verified competitor workflow or a confirmed Mica software problem.
- Each requirement has acceptance criteria and a measurable target.
- No roadmap item exists only because a competitor lists it.

#### Copy-ready prompt

```text
You are conducting a software-only competitor benchmark for Mica. Do not work on positioning, marketing, pricing plans, customer interviews, or business strategy.

Compare Mica with Collectr, Dex, Rare Candy, Shiny, DittoDex, PokeData, Card Ladder, PriceCharting, eBay Price Guide, Dragon Shield, Ludex, CollX, Double Holo, DeckTradr, InVelocity, SnapGrade, and CardGrade.

For each competitor verify current software behavior using the live product, official help documentation, current app-store material, and recent demonstrations. Measure navigation depth, clicks per task, required inputs, scanner speed, correction flow, batch tools, search quality, pricing evidence, loading behavior, error recovery, mobile usability, accessibility, exports, notifications, offline support, and data portability.

Compare the same workflows in Mica. Create a matrix with verified advantage, verified weakness, unverified claim, Mica response, dependency, engineering effort, and acceptance criteria. Produce three lists: parity requirements, Mica differentiators, and features to reject. Do not modify code.
```

## Phase 2. Build the trust foundation

These systems block every scanner, valuation, grading, trade, and seller feature.

### Step 3. Create one canonical identity system for every collectible

**Dependency:** Requires Steps 1 and 2

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** Identity changes affect the database, imports, prices, grading, trades, and every stored user item.

**Handoff:** Give Code the Step 1 audit and Step 2 benchmark before implementation.

**Required outcome:** Every raw card, graded card, sealed product, purchase, sale, trade, price, and grading record points to a stable identity.

#### Competitor software to beat

- Beat tracker mismatches involving set, collector number, language, finish, edition, promo type, condition, grading company, and grade.
- Match the correction speed users expect from scanner-first apps.
- Preserve provider IDs without making any provider the internal source of truth.

#### AI work

- Audit the current schema and all external identifiers.
- Design canonical entities for card printing, variant, owned item, sealed product, graded item, transaction, and provider mapping.
- Design versioned matching rules, confidence levels, duplicate detection, merge history, and manual corrections.
- Create safe migrations and rollback plans.

#### What to build

- Canonical identity schema and provider mapping tables.
- Exact variant selector with clear differences between close matches.
- Confidence-aware matching service.
- Duplicate review and reversible merge tools.
- Versioned audit history for every identity correction.

#### What Elliott must provide or decide

- Provide anonymized examples of the hardest cards and imports.
- Confirm which languages, finishes, grading companies, and sealed products Mica must support now.
- Approve any destructive migration only after backup and rollback verification.

#### Exit gate

- A benchmark set covers common, Japanese, promo, reverse holo, parallel, graded, and sealed cases.
- No silent wrong-variant substitution.
- Every merge and correction is reversible and auditable.
- All existing records reconcile before deployment.

#### Copy-ready prompt

```text
You are the lead data architect for Mica. Implement a canonical collectible identity system. Preserve all existing user data and do not deploy destructive migrations without approval.

First audit the current schema, types, APIs, imports, scanner matches, pricing records, grading records, transactions, and provider identifiers. Design stable internal identities for card printings, variants, owned items, graded items, sealed products, transactions, and external provider mappings.

Support set, collector number, language, finish, edition, promo type, condition, grading company, grade, certification number, and user corrections. Add match confidence, versioned matching rules, duplicate detection, reversible merges, correction history, and clear unsupported states. Never silently substitute a close variant.

Create migrations, backfill scripts, dry-run reports, rollback procedures, API changes, interface changes, unit tests, integration tests, and a benchmark dataset. Reconcile every existing record before enabling the new system. Stop and ask for approval before any destructive database operation.
```

### Step 4. Build transparent pricing and valuation infrastructure

**Dependency:** Requires Step 3

**Run in:** Work, then Chat, then Code

**Model:** GPT-5.6 Sol

**Reasoning:** high in Work and Chat, xhigh in Code

**Why:** Work verifies current providers and technical limits. Chat compares the options. Code implements the approved provider architecture.

**Handoff:** Move the provider evidence from Work into Chat. Approve one technical approach. Send that decision and the evidence to Code.

**Required outcome:** Every displayed value explains its source, market, condition, freshness, comparable evidence, and confidence.

#### Competitor software to beat

- Match Card Ladder and PokeData on useful history and evidence.
- Match eBay Price Guide on completed-sale usefulness.
- Beat portfolio trackers that show one unexplained market number.
- Cover raw, graded, Japanese, and sealed items only when supported.

#### AI work

- Audit current provider coverage, licensing constraints, freshness, rate limits, and failure behavior.
- Design normalized observations rather than one mutable price field.
- Create comparable-sale rules, outlier handling, confidence scoring, stale states, and provider fallbacks.
- Separate estimated value, latest sale, asking price, market index, and user override.

#### What to build

- Price observation schema with source and timestamp.
- Raw and graded condition normalization.
- Comparable-sale viewer and exclusion controls.
- Value range, confidence, stale, missing, and unsupported states.
- Historical charts, caching, scheduled updates, and regression tests.
- Portfolio calculations that never hide missing coverage.

#### What Elliott must provide or decide

- Provide or approve the data services and API credentials Mica may use.
- Approve provider costs and licenses before integration.
- Choose initial supported markets and currencies.

#### Exit gate

- Every displayed value has provenance.
- Missing and unsupported values remain visibly different from zero.
- Outlier rules pass a human-reviewed benchmark.
- Portfolio totals show coverage and confidence.
- Provider failure cannot corrupt stored ownership data.

#### Copy-ready prompt

```text
You are the lead engineer for Mica's pricing foundation. Implement transparent valuation infrastructure after verifying the canonical identity system from Step 3.

Audit every current pricing provider, API route, cache, cron job, database field, client calculation, and fallback. Separate raw, graded, sealed, Japanese, marketplace offer, completed sale, market index, and user override data. Do not display unsupported data as if it were verified.

Store normalized price observations with canonical item identity, source, source record, market, currency, condition, grade, sale date, retrieval time, fees when available, and confidence metadata. Build comparable-sale selection, outlier handling, freshness rules, stale states, missing states, provider fallbacks, historical charts, and portfolio coverage reporting.

Show users the source, timestamp, range, comparable count, condition assumptions, and reason a value changed. Add unit, integration, regression, provider-contract, and failure tests. Measure cache hit rate, provider errors, update latency, missing coverage, and wrong-identity incidents. Ask for approval before adding a paid provider or changing licensing commitments.
```

## Phase 3. Make entry and daily use easier than competitors

Speed includes accuracy, correction, recovery, and low effort.

### Step 5. Build the fastest reliable scan, search, and migration system

**Dependency:** Requires Steps 3 and 4

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** Scanning and imports require repository changes, device handling, background processing, migrations, and failure tests.

**Handoff:** Attach the competitor scanning benchmark, sample images, sample CSV files, and target device list.

**Required outcome:** Users can move a real collection into Mica faster, with fewer corrections and no fear of data loss.

#### Competitor software to beat

- Beat Shiny, DittoDex, Ludex, Rare Candy, CollX, Dex, and Dragon Shield on correct items added per minute.
- Beat spreadsheet imports through previews, mapping memory, duplicate handling, and rollback.
- Support fast search and manual entry when camera recognition is the wrong tool.

#### AI work

- Benchmark scan time, match accuracy, corrections, device failures, and batch throughput.
- Inspect camera permissions, image quality, cropping, upload size, retries, and low-confidence behavior.
- Design one ingestion pipeline for camera, images, CSV, search, and manual entry.
- Instrument every failure and correction.

#### What to build

- Guided camera capture with quality checks.
- Multi-card and batch queue where accuracy supports it.
- Fast candidate review for uncertain variants.
- CSV mapping preview, saved mappings, validation, duplicate report, dry run, commit, and rollback.
- Background processing with visible progress and safe retries.
- Keyboard-friendly search and bulk editing.

#### What Elliott must provide or decide

- Provide real collection photos and anonymized CSV files from competing apps.
- Confirm target phones, browsers, and maximum acceptable image retention.
- Test ten real migration sessions and record every correction.

#### Exit gate

- Measure correct items added per minute on the same benchmark collection across Mica and competitors.
- No duplicate or partial import can commit without a visible report.
- Every import can roll back.
- Low-confidence scans require confirmation.
- Camera denial, upload failure, and provider outage have usable recovery paths.

#### Copy-ready prompt

```text
You are improving Mica's collection entry system. Build the fastest reliable path for camera scans, uploaded images, search, manual entry, and CSV migration. Preserve existing user data.

Benchmark Mica against Shiny, DittoDex, Ludex, Rare Candy, CollX, Dex, and Dragon Shield using the same representative card set and devices. Measure correct items added per minute, wrong matches, corrections, retries, abandoned sessions, and final data completeness.

Create one ingestion pipeline connected to Mica's canonical identity system. Add guided capture, image-quality checks, candidate review, match confidence, batch queues, retry safety, duplicate detection, quantity handling, ownership fields, and correction history. Build CSV mapping preview, saved mappings, dry run, validation report, transaction-safe commit, backup, and rollback.

Add loading, empty, error, permission-denied, offline-interruption, and provider-outage states. Instrument each step. Write tests for duplicate cards, close variants, malformed files, large files, partial failure, retries, and rollback. Optimize for correct completed entries, not raw recognition speed.
```

### Step 6. Turn Collector, Investor, and Seller into real software modes

**Dependency:** Requires Steps 1, 3, and 4

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** high

**Why:** This step changes routing, saved preferences, dashboard composition, queries, and shared interface behavior.

**Handoff:** Give Code the approved screen-to-mode mapping and require one shared data model.

**Required outcome:** The same trusted data supports focused interfaces without duplicating business logic or hiding features.

#### Competitor software to beat

- Match Dex on collector organization and completion.
- Match Card Ladder and PokeData on research access.
- Prepare for DeckTradr and Double Holo seller speed without building the full seller system yet.

#### AI work

- Audit whether current onboarding answers change workflows or only wording.
- Map shared data, shared actions, role-specific defaults, and role-specific dashboard modules.
- Design mode switching that never duplicates or loses data.
- Keep permissions separate from display preferences.

#### What to build

- Collector home focused on organization, set progress, collection health, and grading candidates.
- Investor view focused on basis, history, exposure, liquidity evidence, and alerts without speculative claims.
- Seller view focused on inventory state, fees, margin, aging, and recent operations.
- Shared search, item detail, identity, prices, transactions, and exports.
- User-controlled mode switching and saved defaults.

#### What Elliott must provide or decide

- Approve which current screens belong in each mode.
- Test whether a new user understands each default home screen without explanation.
- Confirm that one account may use multiple modes.

#### Exit gate

- Changing modes never creates duplicate records.
- Each mode changes default workflows and information hierarchy, not only labels.
- All capabilities remain discoverable through shared navigation.
- Mode choice is reversible.

#### Copy-ready prompt

```text
You are implementing real Collector, Investor, and Seller software modes in Mica. Do not create separate applications or duplicate domain logic.

Audit the current onboarding, stored preferences, navigation, dashboards, routes, queries, and advisor behavior. Identify every place where mode selection changes only text or has no effect.

Design one shared data model and shared service layer. Create role-specific dashboard composition, defaults, navigation emphasis, saved filters, terminology, and recommended actions. Collector mode should prioritize organization, set progress, collection health, and grading candidates. Investor mode should prioritize cost basis, history, exposure, liquidity evidence, and alerts without presenting forecasts as facts. Seller mode should prioritize inventory status, fees, margin, aging, and recent operations.

Allow users to switch modes without losing or duplicating data. Keep authorization separate from display preference. Add migration, state, routing, analytics, accessibility, and end-to-end tests. Verify each mode on mobile and desktop.
```

## Phase 4. Build Mica's connected software advantage

Join workflows competitors often split across several apps.

### Step 7. Own the complete grading-to-sale lifecycle

**Dependency:** Requires Steps 3, 4, and 5

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** The grading lifecycle needs state machines, AI integration, image handling, pricing logic, migrations, and calibration tests.

**Handoff:** Attach real anonymized grading examples, supported grading companies, and the approved image rules.

**Required outcome:** One item record connects photo evidence, pre-grade, grading economics, submission, returned grade, updated value, and final disposition.

#### Competitor software to beat

- Match SnapGrade and CardGrade on guided condition capture.
- Match Double Holo on grading return analysis.
- Beat standalone grading tools by preserving the full ownership and financial history.
- Match pricing research tools on graded comparable evidence.

#### AI work

- Audit the current pre-grade, submission, batch, pricing, and sale flows for disconnected records.
- Design an explicit state machine from candidate through returned, sold, held, or rejected.
- Design photo-quality checks, defect evidence, uncertainty, expected-value scenarios, and feedback from real returned grades.
- Keep AI grading replaceable and never present it as an official grade.

#### What to build

- Guided front and back capture plus optional corner and surface detail.
- Photo-quality validation before AI analysis.
- Defect evidence by centering, corners, edges, and surface.
- Grade probability range with confidence and unsupported states.
- Expected-value calculator using fees, shipping, turnaround, grade probabilities, raw value, and graded comps.
- Submission batches, status history, certification number, returned grade, updated identity, and realized outcome.
- Calibration dashboard for predicted versus returned grades.

#### What Elliott must provide or decide

- Provide anonymized examples of real submissions and returned grades.
- Approve grading companies and fee schedules supported at launch.
- Confirm required photo retention and deletion rules.

#### Exit gate

- No exact grade claim without an approved confidence standard.
- Every recommendation shows inputs and assumptions.
- Returned grades update the same owned item rather than creating an unrelated duplicate.
- Prediction calibration is measured by grading company and capture quality.
- Users can correct every automated defect and grade input.

#### Copy-ready prompt

```text
You are implementing Mica's grading-to-sale lifecycle. Use the existing canonical identity and transparent pricing systems. Preserve all ownership and transaction history.

Audit digital pre-grading, grading candidates, batch economics, submissions, status tracking, returned grades, graded pricing, sales, and profitability. Identify disconnected records and duplicate identity paths.

Create an explicit state machine for candidate, capture incomplete, analyzed, selected, submitted, received, grading, shipped, returned, held, listed, traded, sold, and rejected. Build guided photo capture, image-quality checks, defect evidence for centering, corners, edges, and surface, grade probability ranges, confidence, unsupported states, and user corrections.

Build expected-value scenarios using raw value, grade probabilities, grading fees, shipping, insurance, turnaround, graded comparable sales, marketplace fees, and user overrides. Connect submission batches, certification numbers, returned grades, updated values, final disposition, and realized profit to the same owned item.

Add a calibration system comparing predictions with real returned grades. Keep the AI provider replaceable. Never call a prediction an official grade. Add unit, integration, state-machine, image-failure, pricing-failure, and end-to-end tests.
```

### Step 8. Add collection organization, goals, and inventory depth

**Dependency:** Can run after Steps 3 and 5

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** high

**Why:** This step changes the collection schema, filters, large-list rendering, database indexes, and bulk editing.

**Handoff:** Attach real storage examples and a large anonymized collection for performance testing.

**Required outcome:** Large collections remain easy to understand, locate, maintain, and complete.

#### Competitor software to beat

- Match Dex on set completion, folders, and collector satisfaction.
- Match Collectr and PriceCharting on portfolio organization.
- Beat basic trackers with item-level location, history, documents, and flexible views.

#### AI work

- Audit tags, folders, lists, locations, quantities, set completion, saved filters, notes, photos, and bulk actions.
- Find overlapping concepts and design one understandable organization model.
- Test large collection performance and query plans.
- Design goals that derive from collection data rather than a separate checklist.

#### What to build

- Folders or collections, tags, physical storage locations, notes, photos, documents, and custom fields with clear boundaries.
- Saved views, sorting, filtering, grouping, and bulk editing.
- Set, subset, artist, character, rarity, language, and condition progress where data supports it.
- Goal definitions, progress, missing-item views, and completion history.
- Fast virtualized lists and server-side filtering for large inventories.

#### What Elliott must provide or decide

- Provide examples of real storage systems such as binders, boxes, cases, and display locations.
- Choose whether folders, tags, and lists should remain separate concepts.
- Test the system with a large anonymized collection.

#### Exit gate

- Users can locate an item by physical and digital organization.
- Bulk edits are previewed, undoable where practical, and audited.
- Large collections meet the approved performance budget.
- Progress never counts an unsupported or wrong variant silently.

#### Copy-ready prompt

```text
You are improving collection organization in Mica. Build for small collections and inventories with thousands of items without creating overlapping concepts.

Audit all existing folders, lists, tags, watchlists, storage locations, notes, photos, documents, quantities, set progress, filters, sorting, grouping, and bulk actions. Identify duplication and unclear ownership rules.

Design a coherent organization model for digital collections, flexible tags, physical storage locations, saved views, and goals. Add server-side search, filtering, grouping, sorting, bulk editing, undo or correction history, and virtualized rendering where needed. Support set, subset, artist, character, rarity, language, finish, and condition progress only when catalog data is reliable.

Create goal definitions, missing-item views, progress calculations, completion history, and links to exact variants. Benchmark common actions with 100, 1,000, 10,000, and 100,000 owned items. Add database indexes, query tests, accessibility tests, and end-to-end tests. Preserve all existing collection data during migration.
```

### Step 9. Turn the action center and alerts into dependable software

**Dependency:** Requires Steps 4, 6, and 7

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** Alerts require scheduled jobs, deterministic rules, notification delivery, idempotency, audit logs, and failure handling.

**Handoff:** Provide approved channels, quiet hours, frequency limits, and test devices.

**Required outcome:** Mica detects useful changes, explains them, sends controlled notifications, and records what the user does next.

#### Competitor software to beat

- Match PokeData, Card Ladder, Collectr, and Shiny on alerts.
- Beat price-only alerts with collection-specific context and evidence.
- Avoid noisy AI recommendations that cannot explain their inputs.

#### AI work

- Audit every current alert source, scheduled job, threshold, notification channel, and action link.
- Design deterministic rules first and AI summaries second.
- Create deduplication, cooldowns, quiet hours, frequency caps, delivery retries, and user controls.
- Trace each recommendation back to versioned data inputs.

#### What to build

- Rule engine for price, coverage, goal, grading, listing, inventory, and stale-data events.
- Action center with explanation, evidence, timestamp, suggested action, dismissal, snooze, and completion.
- Email, web push, and in-app delivery abstractions with retries and delivery records.
- Notification preferences, quiet hours, frequency caps, and unsubscribe controls.
- Outcome tracking and recommendation audit log.

#### What Elliott must provide or decide

- Approve which notification channels Mica may use.
- Choose safe default frequency and quiet hours.
- Provide test devices for web-push verification.

#### Exit gate

- Every action links to evidence and a working destination.
- Duplicate alerts remain below the approved threshold.
- Delivery retries cannot send the same alert repeatedly.
- Users can control, mute, and unsubscribe from every optional channel.
- Provider or pricing failures do not generate false actions.

#### Copy-ready prompt

```text
You are rebuilding Mica's action center and alert system. Use transparent pricing, canonical identities, real software modes, and the grading lifecycle as dependencies.

Audit all current scheduled jobs, alert records, watchlists, advisor outputs, push code, email code, thresholds, links, retries, and preferences. Identify development-only paths, dead links, duplicate triggers, unsupported data, and recommendations that lack evidence.

Build a versioned rule engine for price changes, comparable-sale changes, coverage loss, stale data, collection goals, grading opportunities, submission status, listing state, inventory aging, and user-defined thresholds. Use deterministic calculations for decisions. Use AI only to summarize verified evidence.

Create an action center with reason, data source, timestamp, confidence, suggested action, destination, dismissal, snooze, and completion. Add in-app, email, and web-push abstractions with delivery records, idempotency, retries, cooldowns, quiet hours, frequency caps, and channel controls.

Add audit logs, outcome analytics, failure monitoring, unit tests, job tests, delivery tests, permission tests, and end-to-end tests. Never generate an alert from missing, stale, or unsupported data without clearly stating that condition.
```

## Phase 5. Expand professional workflows

Build this only after identity, pricing, entry, and grading are dependable.

### Step 10. Build card-show and seller operations

**Dependency:** Requires Steps 3 through 9

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** Seller operations affect inventory accounting, concurrency, offline behavior, marketplace adapters, and financial reports.

**Handoff:** Attach the client's exact seller workflows, sample reports, marketplace approvals, and hardware list.

**Required outcome:** Sellers can buy, sell, trade, label, and reconcile inventory quickly without breaking the collection ledger.

#### Competitor software to beat

- Match DeckTradr on card-show speed and deal math.
- Match Double Holo on vendor inventory, repricing, labels, and marketplace connections.
- Match InVelocity on seller inventory and eBay workflow.
- Beat separate tools by preserving one item and transaction history.

#### AI work

- Audit current purchases, sales, trades, FIFO, fees, reports, and inventory state.
- Design an append-only inventory ledger and transaction state machines.
- Model card-show offline interruptions, partial payments, trade plus cash, returns, cancellations, and marketplace conflicts.
- Design integrations behind adapters and idempotent queues.

#### What to build

- Fast sell, buy, and trade flows with quantity, condition, price source, fees, tax fields, and notes.
- Trade plus cash and batch deal calculations.
- Labels, barcodes, inventory locations, reservations, and event sessions.
- Event profit, reconciliation, cash tracking, and discrepancy reports.
- Marketplace listing and inventory adapters with conflict review.
- Offline-safe event queue only after web behavior is stable.

#### What Elliott must provide or decide

- Provide exact seller workflows and sample reports from the client.
- Approve marketplace integrations and credentials before connection.
- Test on real card-show hardware, network conditions, printers, and scanners.

#### Exit gate

- Every inventory change produces a balanced, auditable ledger event.
- Retries cannot duplicate sales or quantity changes.
- Trade plus cash, partial failure, return, cancellation, and reconciliation tests pass.
- Marketplace conflicts require review instead of silent overwrite.
- The core collection record remains intact.

#### Copy-ready prompt

```text
You are implementing professional seller and card-show workflows in Mica. Do not begin until canonical identity, transparent pricing, reliable entry, software modes, grading lifecycle, and alerts have passed their exit tests.

Audit purchases, sales, trades, FIFO, cost basis, quantities, fees, profitability, exports, labels, locations, and existing marketplace code. Design an append-only inventory ledger and explicit state machines for buy, sell, trade, trade plus cash, reservation, listing, return, cancellation, and reconciliation.

Build fast card-show flows with barcode or search entry, exact variant confirmation, quantities, condition, price evidence, user override, tax fields, fees, payment method, notes, receipts, labels, event sessions, cash tracking, and discrepancy reports. Add event profitability and inventory aging.

Place eBay, Shopify, and TCGplayer connections behind provider adapters and idempotent job queues. Build conflict detection, manual review, retry safety, rate-limit handling, and audit history. Never silently overwrite inventory from an external marketplace.

Test partial payments, trade plus cash, duplicate requests, network loss, queued retries, returns, cancellations, overselling, concurrent edits, printer failure, and reconciliation. Preserve one ownership and financial history for each item.
```

## Phase 6. Harden and verify the complete app

Quality work runs throughout development, then receives a full-system gate.

### Step 11. Harden security, privacy, accessibility, performance, and observability

**Dependency:** Runs during every phase. Final gate follows Step 10.

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** Security, privacy, performance, accessibility, and observability require full source access and executable verification.

**Handoff:** Provide approved roles, retention rules, supported devices, and production-like scale targets.

**Required outcome:** Mica remains safe, fast, understandable, and diagnosable as features and data volume grow.

#### Competitor software to beat

- Beat competitor friction through faster screens, clear recovery, accessible controls, and reliable data.
- Treat exports, deletion, privacy, and correction as core software quality.
- Measure Mica against its own performance and reliability budgets.

#### AI work

- Audit authentication, authorization, row-level security, secrets, uploads, third-party callbacks, background jobs, and sensitive logs.
- Profile server, database, client bundle, images, and slow routes.
- Audit keyboard use, focus, labels, contrast, screen readers, reduced motion, and responsive layouts.
- Create structured logs, traces, metrics, alerts, and privacy-safe product events.

#### What to build

- Authorization tests for every resource and action.
- Upload validation, signed access, retention, deletion, and malware-risk controls.
- Database indexes, pagination, caching, bundle reduction, image optimization, and background jobs.
- Accessible forms, dialogs, tables, charts, error messages, and keyboard paths.
- Structured logging, traces, dashboards, error reporting, uptime checks, and runbooks.
- Backup, restore, export, deletion, and disaster-recovery verification.

#### What Elliott must provide or decide

- Approve retention rules and access roles provided by the client.
- Provide production-like load expectations and supported devices.
- Approve any monitoring service or paid security scanner before purchase.

#### Exit gate

- No critical or high security issue remains open.
- Authorization tests prove users cannot access another account's data.
- Core Web Vitals and API latency meet the approved budgets.
- Critical flows pass keyboard and screen-reader checks.
- Backup restore and account deletion are tested end to end.
- Every critical background job has monitoring and a runbook.

#### Copy-ready prompt

```text
You are hardening Mica for production. Audit and improve security, privacy, accessibility, performance, resilience, and observability across the full repository and deployed system.

Review authentication, authorization, row-level security, object ownership, secrets, API validation, uploads, image access, third-party callbacks, webhooks, background jobs, rate limits, dependency risk, logs, exports, backups, sharing, privacy, and deletion. Add automated authorization tests for every resource and action.

Profile database queries, server functions, API latency, client bundles, rendering, images, lists, charts, and background tasks. Add indexes, pagination, caching, queueing, image optimization, and bundle reduction based on measured bottlenecks. Define and enforce performance budgets.

Audit WCAG behavior for keyboard navigation, focus, labels, landmarks, errors, dialogs, tables, charts, contrast, zoom, reduced motion, and responsive layouts. Fix critical flows first.

Add structured privacy-safe logs, traces, metrics, dashboards, uptime checks, job monitoring, provider health, error reporting, alerts, and runbooks. Test backup restoration, export accuracy, account deletion, provider outage, queue recovery, and disaster recovery. Do not expose credentials or sensitive user data in logs.
```

### Step 12. Run full end-to-end verification and release hardening

**Dependency:** Requires Steps 1 through 11

**Run in:** Code

**Model:** GPT-5.6 Sol

**Reasoning:** xhigh

**Why:** Release verification must run the real application, test suites, migrations, provider failures, and cross-device workflows.

**Handoff:** Give Code the complete requirements traceability matrix and block production changes until all critical tests pass.

**Required outcome:** Every critical workflow works from browser input through API, data, provider, background processing, and final user result.

#### Competitor software to beat

- Use competitor benchmarks as acceptance targets for speed and task completion.
- Verify Mica's connected workflow advantage instead of counting features.
- Test realistic imported collections, grading batches, trades, sales, and seller events.

#### AI work

- Create a requirements traceability matrix from every roadmap promise to tests and evidence.
- Run unit, integration, contract, migration, end-to-end, visual, accessibility, performance, load, security, and recovery tests.
- Verify production-like deployment configuration and failure behavior.
- Record defects with reproduction, severity, owner, and regression test.

#### What to build

- Stable staging environment with seeded, anonymized test data.
- Automated critical-path suite for onboarding through collection, valuation, grading, trade, sale, report, export, and deletion.
- Cross-device visual and interaction checks.
- Migration rehearsal, rollback rehearsal, provider outage simulation, and queue recovery.
- Release checklist, deployment verification, rollback plan, and post-release monitoring.

#### What Elliott must provide or decide

- Provide acceptance approval for the software requirements.
- Complete hands-on checks on the required phones and desktop browsers.
- Approve production deployment only after critical defects close.

#### Exit gate

- All critical requirements link to passing evidence.
- No critical or high-severity defect remains open.
- Migration and rollback rehearsals pass.
- Cross-device critical paths pass.
- Monitoring detects injected failures.
- Deployment and rollback procedures are verified.

#### Copy-ready prompt

```text
You are the release verification lead for Mica. Verify the complete software from browser interaction through APIs, database changes, external providers, background jobs, notifications, exports, and final user-visible results.

Create a traceability matrix connecting every approved software requirement and acceptance criterion to automated or manual evidence. Build a stable staging environment with anonymized representative collections, imports, grading batches, trades, sales, sealed products, alerts, and seller events.

Run unit, integration, provider-contract, migration, end-to-end, visual regression, accessibility, performance, load, security, backup, restore, deletion, and recovery tests. Test iPhone Safari, Android Chrome, desktop Chrome, narrow screens, slow networks, interrupted uploads, provider outages, queue retries, concurrent edits, stale prices, missing prices, duplicate imports, and rollback.

For each defect record reproduction steps, evidence, severity, affected data, owner, fix, and regression test. Block release for every critical or high-severity defect. Rehearse deployment, data migration, smoke tests, monitoring, rollback, and post-release verification before production approval.
```

## Later software branches

Research and architecture only until Step 12 passes.

### Step 13. Evaluate native apps, deeper offline support, marketplace, social, and more TCGs

**Dependency:** Do not build before Step 12 passes

**Run in:** Work, then Chat, then Code prototype

**Model:** GPT-5.6 Sol

**Reasoning:** high in Work and Chat, xhigh for a Code prototype

**Why:** Work verifies current platform constraints. Chat compares technical paths. Code creates only the approved isolated prototype.

**Handoff:** Do not send anything to Code until the client approves the branch and the measured software constraint.

**Required outcome:** Future expansion uses measured software constraints and does not damage the stable core.

#### Competitor software to beat

- Native and social reference points include Dex, Rare Candy, Shiny, CollX, and Dragon Shield.
- Marketplace reference points include Rare Candy, CollX, eBay, and TCGplayer.
- Multi-TCG reference points include Collectr, Dragon Shield, Ludex, CollX, and PriceCharting.

#### AI work

- Measure PWA camera, push, installation, offline, and performance failures before recommending native.
- Identify which domain types are truly Pokémon-specific before adding another TCG.
- Model marketplace technical risks including payments, fraud, moderation, disputes, shipping, and inventory reservation.
- Model social privacy, moderation, blocking, reporting, and abuse controls.

#### What to build

- Architecture decision records and small technical prototypes only.
- Native shell or offline queue proof only if measured browser constraints justify it.
- TCG adapter proof using one isolated catalog without changing production data.
- Marketplace and social threat models before interface work.

#### What Elliott must provide or decide

- Get the client's approval before expanding scope.
- Provide the measured limitation or approved requirement that triggers each branch.
- Approve any app-store, payment, moderation, or catalog commitments.

#### Exit gate

- Step 12 has passed.
- The branch solves a measured software constraint.
- A prototype proves feasibility without changing the core domain model.
- Security, privacy, moderation, operational, and migration costs are documented.
- The client approves implementation scope.

#### Copy-ready prompt

```text
You are evaluating later software expansion for Mica. Do not implement production features. Work through architecture decisions and isolated prototypes only.

Evaluate five branches separately: native mobile apps, deeper offline support, a marketplace, social features, and additional TCGs. For each branch identify the measured software constraint, current PWA or domain limitation, competitor reference behavior, architecture options, data-model changes, migration risk, security risk, privacy risk, moderation or payment obligations, operational load, test strategy, and rollback path.

For native apps, measure camera, push, installation, offline, and performance failures first. For additional TCGs, identify Pokémon-specific assumptions and design catalog adapters. For marketplace work, model inventory reservation, payments, fraud, disputes, shipping, refunds, and seller identity. For social work, model privacy, blocking, reporting, moderation, and abuse prevention.

Create an architecture decision record and the smallest isolated prototype for any branch that has verified justification. Do not change production data or begin full implementation without the client's approval.
```

## Completion rule

Codex may understand the full roadmap from the first session. Codex must implement it step by step. A later step starts only after its dependencies pass their exit gates and Elliott approves continuation.
