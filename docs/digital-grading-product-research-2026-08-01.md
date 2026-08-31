# Digital grading product research

Reviewed: 2026-08-01

This document turns the supplied DGC screenshots, every article linked from the
official Digital Grading Company blog sitemap, the current App Store listing,
and the supplied one-star review set into product and engineering requirements
for Mica. DGC is a capability and interaction benchmark, not ground truth for
model accuracy.

## Source inventory

The official sitemap exposes 15 blog articles. All 15 were read in full.

| Article                                | Product signal                                                                                                                                         | Mica decision                                                                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What Is AI Grading? A Beginner's Guide | One report should connect condition, market value, submission potential, and next actions.                                                             | Keep the score, evidence, likely PSA outcome, financial context, and next action in one report.                                                                                                             |
| How We Rebuilt Digital Grading Company | DGC identifies inconsistent output, opaque reasoning, weak scaling, and clunky UX as its original failures.                                            | Treat repeatability, explanation, durable reports, and low-friction capture as release gates.                                                                                                               |
| How AI Grading Works                   | Published flow: smartphone capture, image normalization, multiple hypotheses, condition categories, confidence, and a collector report.                | Normalize locally, run independent reviews, retain only supported evidence, and show confidence without presenting it as validation.                                                                        |
| How AI Detects Fake & Altered Cards    | Claims print/ink, trimming, reflectivity, fingerprints, and authentic-reference comparisons.                                                           | Do not make authenticity claims from ordinary phone images. Keep hashes for idempotency and research, but label authenticity as out of scope until a verified reference dataset and optical protocol exist. |
| Why Grading Matters                    | Condition matters because it changes buyer trust, resale value, and submission economics.                                                              | Put a plain-language financial decision beside the condition result, without letting price affect grade.                                                                                                    |
| Graded vs Raw Cards                    | The useful task is deciding whether professional grading is worth the cost.                                                                            | Keep raw, digital estimate, and professional slab states distinct; show likely outcome and cost/value context.                                                                                              |
| The Truth About AI Grading             | Strong emphasis on explainability, visible markers, market context, and AI as a pre-screen rather than encapsulation.                                  | Every retained defect must open visible evidence. Every screen says the result is an estimate, not authentication or an official grade.                                                                     |
| AI vs Human Grading                    | The observable benefit is repeatable pre-screening with a transparent report.                                                                          | Measure repeat scans and professional returns. Do not claim perfect consistency.                                                                                                                            |
| The 7 Factors                          | Surface, centering, corners, edges, print quality, structure/durability, and authenticity are described as the complete system.                        | Measure the four defensible photo categories now. Represent print/structure only as localized evidence or an abstention. Keep authenticity unavailable.                                                     |
| How Accurate Is AI Grading?            | Publishes 98.7% agreement and 23% uplift claims without public cohort definitions, leakage controls, confidence intervals, or independent replication. | Never reuse those numbers. Mica remains unvalidated until its protected labeled benchmark passes.                                                                                                           |
| How AI Predicts Card Value             | Connects live pricing, trends, local variation, and sell/hold/trade actions.                                                                           | Use only verified provider observations. No model-generated price, forecast, or local-market claim.                                                                                                         |
| Why Collector First                    | Transparency is expressed as four subgrades, annotated scans, confidence, and useful actions.                                                          | Make results the visual center of the experience and keep rationale concise.                                                                                                                                |
| Why No Free Version                    | Argues compute and market data require premium access, while promising no hidden fees.                                                                 | Never create contradictory entitlement or stacked-payment UX. The collection remains useful without grading. Show access requirements before capture if monetization is introduced.                         |
| Why Grading Is Not Instant             | Describes multi-angle capture, competing hypotheses, structural review, confidence checks, durable queue states, and an ETA.                           | Collect alternate-light front and back in one guided sequence, start a durable session before the first capture, and preserve a visible retry/recovery state.                                               |
| Understanding the Scale                | Defines a 0–10 display in 0.1 increments, four core visible subgrades plus structure, confidence, and gemstone tiers.                                  | Use one-decimal DG scores, front/back category values, confidence, and an at-a-glance tier. Keep the underlying range visible so decimal precision is not mistaken for certainty.                           |

Official source index: https://www.digitalgrading.ai/blog

## Important contradictions and unsupported claims

- Results are described as both instant/in seconds and as taking up to four
  hours. Mica must display actual state and elapsed work instead of a marketing
  promise.
- The scale article describes five core factors while the factor article
  describes seven. Mica should disclose what is actually measured on each
  report.
- Smartphone captures are repeatedly described as microscopic, but ordinary
  RGB phone images cannot prove microscopic damage, material composition, or
  authenticity. Mica must abstain outside visible evidence.
- The 98.7% match-rate claim does not publish sufficient validation detail to
  reproduce or trust it. It is not a benchmark target or training label.
- The blog says the model adapts continuously. A grading product also needs
  frozen rubric/model versions so an old report remains reproducible. Mica
  stores both.
- Market trends are described as condition inputs in some copy. Mica keeps
  market data completely separate from the condition score.

## Screenshot interaction and visual system notes

- Black, edge-to-edge grading surfaces with large white condensed headlines.
- One high-emphasis violet action color, supported by orange-to-pink-to-violet
  gradients for model activity and grade identity.
- A report number and timestamp stay visible at the top.
- Capture is a focused full-screen task. The card, guide, and one current
  instruction dominate; navigation chrome disappears.
- Processing shows named model stages and progress rather than an unexplained
  spinner.
- The result starts with the card and decimal grade, not a paragraph.
- Front/back switching and defect markers are directly on the card image.
- Subgrades are four large cards: corners, edges, surface, and centering, each
  with a combined number plus front/back values.
- Evidence detail opens from a numbered marker and shows a crop, severity, and
  short explanation.
- Financial context compares predicted value with current raw/market value and
  answers whether professional grading may be worthwhile.
- Sharing is an output action after the result, not a prerequisite.

Mica should follow this interaction hierarchy and visual confidence while
retaining its own name, accessibility requirements, privacy behavior, and
evidence limitations.

## One-star review failure matrix

The supplied file contains 414 lines of reviews and developer responses.

| Failure reported                                                   | Required prevention or recovery                                                                                                                                                                           |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same card returns scores from 6–10 or defects change on each scan  | Independent-review consensus, previous-result stability guard, alternate-light evidence, saved scan comparison, and no overwrite when a regrade moves beyond the safe tolerance.                          |
| Pack-fresh or damaged cards receive implausibly high grades        | Weakest-area weighting, major damage hard stop, grade/evidence contradiction guard, and protected severe-card benchmark cohort.                                                                           |
| False whitening, scratches, or spots                               | Plain contrasting capture guidance, glare/shadow rejection, alternate lighting, majority-localized evidence, and user false-defect feedback.                                                              |
| Scratches, print lines, dents, bends, or factory errors are missed | Alternate-light front/back in the default grading sequence; explicit structural limitation; close-up request when evidence is ambiguous.                                                                  |
| Camera cannot detect the card or crops it crooked                  | Boundary detection, aspect and perspective rejection, live frame state, manual shutter fallback, and saved-photo fallback.                                                                                |
| Images upload flipped or the wrong side is analyzed                | Explicit capture descriptors, front/back side validation, visible review thumbnail, and identity/side agreement before saving.                                                                            |
| Image upload fails or grading queue becomes empty                  | Durable scan session before the model call, idempotent request reuse, persistent workflow status, retry without another charge, and never remove the previous saved grade until replacement is confirmed. |
| Wrong Japanese/English printing is selected                        | Consensus must include name, set, number, and language; saved card identity is compared against the scan before attaching a grade.                                                                        |
| Too much information is required before grading                    | Grading starts directly from Add Cards or any raw card. Acquisition facts are not part of capture. New-card details are held locally and saved only after the grading choice.                             |
| Feature is buried behind nested screens                            | One primary Grade action on Add Cards, one Grade/Regrade action on every eligible raw card, and a direct prompt during new-card intake.                                                                   |
| Forced profile, notification, rating, or subscription gates        | No notification dependency, no forced rating prompt, no payment surprise, and no grading access claim before entitlement is known.                                                                        |
| Subscription plus tokens plus fast-track charges                   | Any future entitlement screen must state the exact included actions before capture. Never sell a token that the current plan cannot use.                                                                  |
| No useful free collection                                          | Library, search, and manual intake remain independent from digital grading.                                                                                                                               |
| Support is hard to find                                            | Every recoverable error names the next action; account support remains reachable outside a failed workflow.                                                                                               |

## Target end-to-end experience

1. The Add Cards screen presents **Digital grade** as the first and strongest
   action, followed by search and photo identification.
2. A raw card can begin grading from Add Cards, its collection row, or its
   detail screen. A professionally graded or sealed item never shows this
   action.
3. Grading is one uninterrupted four-capture sequence: primary front, primary
   back, alternate-light front, alternate-light back. The current step and the
   exact capture check are always visible.
4. Local checks reject bad brightness, glare, focus, framing, perspective, and
   movement before the model allowance is used.
5. A private, durable scan session exists before remote analysis. Multiple
   independent reviews must agree on identity, grade range, and localized
   findings.
6. A report either shows a responsible range and provisional PSA distribution
   or clearly abstains. There is no forced numerical result.
7. The first report viewport contains the card, DG score/tier, four subgrades,
   confidence, and primary action. Defects, centering, probability, financial
   context, and method remain available without navigating through nested
   product screens.
8. Regrades are compared with the saved result. A large unexplained change is
   kept as a report but cannot silently replace the collection's DG number.
9. New-card intake saves the card only after the user declines grading or a
   reliable report is ready. The save and grade association are retry-safe.

## Accuracy release gates

Unit tests and model self-agreement are necessary but not accuracy evidence.
The existing private evaluator remains the authority. Public parity claims are
blocked until a protected labeled set demonstrates, at minimum:

- at least 95% of supported-workflow predictions within one verified PSA grade;
- at least 95% of repeat scans within 0.5 DG points;
- at most 5% false-positive high-confidence PSA 10 recommendations;
- at least 90% completion for supported devices and capture conditions;
- visible support for every retained defect;
- separately reported results for language, era, finish, device, lighting,
  severe damage, and high-grade cohorts;
- no tuning access to the final holdout and no DGC outputs used as labels.

Until those gates pass, Mica's result is a transparent pre-screening estimate.

## Video review: Return On Rips DGC walkthrough

Reviewed: 2026-08-02

Source: `How I’m Testing Digital Grading App Accuracy (Before the Results)` by
Return On Rips, requested segment 00:51–02:59. The segment was inspected as 100
uniformly spaced frames so short transitions and small interface states were
not skipped. The source has no downloadable caption track; its burned-in
captions were used only to corroborate what is visible on screen.

### What this segment does and does not establish

The segment establishes DGC's information architecture, capture controls,
grading choices, report structure, and pricing model. It does **not** establish
grading accuracy. During the introduction, the reviewer says that the return
results are not available yet and that accuracy is therefore still unknown.
The video title also identifies this as the setup before the results. DGC must
remain a UX and capability reference, not a source of benchmark labels.

### Timestamped product notes

| Time        | Visible behavior                                                                                                                                                                                                                                                                                                                                                            | Product meaning for Mica                                                                                                                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00:51–00:58 | DGC opens with a minimal black splash screen and a dark collection home. A card stack, search/profile actions, a prominent violet Instant Scan action, a Lucario VSTAR card, its decimal score, and a gemstone tier are visible together.                                                                                                                                   | Collection and grading are one product. A user should see the saved card, DG number, and tier without entering a separate grading area.                                                                                                                         |
| 00:58–01:06 | The Grading Menu shows a Universal Credits wallet and four services: Deep Grade, Centering Tool, Instant Grade, and Instant Pro. Instant Grade costs one credit and Instant Pro costs two credits in the shown state.                                                                                                                                                       | If Mica offers multiple modes, differences must be explained before capture by output, evidence depth, ETA, and any cost. Do not use vague model names as the only explanation.                                                                                 |
| 01:06–01:21 | A short, swipeable Scanning Setup teaches the task with animated pass/fail examples. It shows the card flat rather than tilted, the whole card and all four edges inside frame, and even light without glare or shadow. The current tutorial page is shown with dots and one Next action.                                                                                   | Add an optional first-run capture coach made from visual examples. Keep the live camera itself focused on one instruction; do not repeat a paragraph of setup copy on every view.                                                                               |
| 01:21–01:34 | The front capture is full-screen. The card sits inside a rectangular guide with green alignment feedback along its edges. The screen names the side being scanned, exposes one large violet shutter, and keeps preparation help collapsible below the camera.                                                                                                               | Live boundary feedback must visibly move from waiting to aligned. The current step, side, one correction, and shutter state should be obvious without reading supporting copy.                                                                                  |
| 01:34–01:47 | The same capture treatment is used for the back. The reviewer specifically calls out the built-in phone level as a differentiator because it helps produce a flat, repeatable photo.                                                                                                                                                                                        | Preserve Mica's device-motion level and three-degree gate, but integrate it visually with the card boundary instead of making it look like an unrelated diagnostic.                                                                                             |
| 01:47–01:50 | A Checking Scan Details state shows front and back thumbnails before grading. It explains that the exact version must be confirmed for grading and valuation, then offers Search for your card or Create a custom label.                                                                                                                                                    | Capture may begin before identity is known, but condition must not attach to a collection item until name, set, number, language, and side agree. Show both captured sides at this checkpoint.                                                                  |
| 01:50–02:08 | Select Your Card recommends searching character name followed by set. Results display a thumbnail, card name, and set/printing. A Label Maker remains available when the catalog cannot supply the exact card.                                                                                                                                                              | Search after capture should use the extracted query, put the likely exact version first, and provide a clearly marked custom identity fallback. A custom label cannot bypass identity confidence when attaching a DG result to an existing item.                |
| 01:58–02:12 | The reviewer explains the four models. Deep Grade takes roughly one to four hours and returns extensive detail. Centering Tool is for a centering-only question. The last two return instant results.                                                                                                                                                                       | The menu separates jobs users actually understand: quick check, centering measurement, detailed instant report, and deeper queued review. These are product contracts, not merely different loading animations.                                                 |
| 02:12–02:21 | The Quick Grade processing screen names Corner, Surface, Edge, and Centering assessments. Each has an orange-to-pink-to-violet progress bar. An Overall Grade card is labeled as a weighted composite and moves through Processing, Preparing, and Complete before Reveal Grade becomes available.                                                                          | Preserve named, truthful processing stages and one explicit reveal/complete state. Stage progress must come from backend workflow state or measured completion, never an ornamental timer.                                                                      |
| 02:21–02:28 | Instant Pro also returns in about 30 seconds in the reviewer's example, but produces a more detailed report. The result opens on the card image with a decimal grade of 8.8 and the Ruby tier.                                                                                                                                                                              | Lead with the card, identity, decimal DG score, tier, and evidence range. Do not lead with explanatory prose. Never promise 30 seconds until measured production latency supports it.                                                                           |
| 02:24–02:29 | The report header retains a report number and grading date. Front, Back, and Blockchain tabs appear above the card. Quick actions include Save Label, sharing, a violet action, and Digital Slab.                                                                                                                                                                           | Keep report ID and date persistent. Keep Front/Back switching and share/report output. Omit Blockchain and minting. Only retain quick actions that complete a collector task.                                                                                   |
| 02:28–02:36 | Financial data compares Predicted Value (10.1 USD in the example) and Market Value (11.5 USD). Sub-grades and Card Data are sibling tabs. Four large cards show Corners 6.9 (front 6.5, back 7.0), Edges 7.0 (front 7.0, back 7.0), Surface 7.6 (front 5.5, back 8.5), and Centering 9.0 (front 8.0, back 9.5). A radar-style detailed breakdown summarizes the categories. | Put the four combined and side-specific scores in the first report viewport. Market data remains a separately sourced decision aid and must never affect the condition score. A radar chart is optional; it adds value only if the exact numbers stay readable. |
| 02:36–02:45 | Card Data shows a lettered A–E confidence scale and report details including report number, card identity, date, DG score, and category values. The reviewer identifies score minting to blockchain as the only meaningful product con and says removing those buttons would clean up the UI.                                                                               | Store confidence, identity, timestamps, rubric/model versions, and category evidence. Show confidence as uncertainty, not certification. Do not add blockchain, minting credits, or inactive crypto actions.                                                    |
| 02:45–02:59 | The reviewer shows a monthly DGC subscription and summarizes the range as $4.99–$14.99. Instant modes require additional purchased credits. The reviewer calls DGC the most costly app in the comparison.                                                                                                                                                                   | Do not reproduce stacked subscription-plus-credit pricing. If grading becomes paid, show the exact included use and total charge before the camera opens, and allow retry/recovery without charging again.                                                      |

### Reviewer scorecard from the segment

The four written strengths are:

1. Cleanest and most robust UI.
2. Collection and scanning system in one app.
3. A level for repeatable photos.
4. Four grading models for different jobs and turnaround needs.

The written negative is the blockchain feature. The pricing negatives are a
$4.99–$14.99 subscription range and additional credits for instant grading.
The reviewer says there are few other cons without becoming overly nitpicky.

### Exact DGC feature and data inventory visible in the segment

- A collection/library home with search, profile access, Instant Scan, saved
  card art, decimal DG number, gemstone tier, and bottom navigation.
- A credit wallet and four grading choices: Deep Grade, Centering Tool, Instant
  Grade, and Instant Pro.
- Visual scanning education for card angle, whole-card framing, all four edges,
  even lighting, glare, and shadow.
- Separate front and back capture steps, a live card boundary, green alignment
  state, a device level, manual shutter, and collapsible preparation help.
- A post-capture review with both thumbnails, exact-version confirmation,
  catalog search, and custom-label fallback.
- Named corner, surface, edge, centering, and overall processing states.
- A persistent report number and date; card name, set/printing, image, overall
  DG score, tier, and front/back views.
- Combined and front/back corner, edge, surface, and centering sub-grades; a
  visual category breakdown; A–E confidence; and card/report metadata.
- Predicted conditioned value beside current market value.
- Save Label, share, Digital Slab, and blockchain/minting actions.
- A monthly subscription, grading credits, separate minting credits, and bulk
  minting pricing.

### Parity audit against the current Mica implementation

| Capability                       | Current Mica state                                                                                                                                                                   | Required decision or change                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collection-linked grading        | Present. The Collection page owns the grading workspace and recent activity.                                                                                                         | Keep. Do not move grading back into Add Cards.                                                                                                                                                        |
| Card-level eligibility           | Present. Owned raw cards show Digital grade; digitally graded raw cards show Regrade and their DG number. Sealed and professionally graded items are excluded.                       | Keep and test all states.                                                                                                                                                                             |
| Direct camera capture            | Partly present. Photo actions open the camera, but the main Add shortcut still lands on a search-first screen.                                                                       | Make the primary Add Card action open card capture immediately, with search and saved-photo fallbacks inside that flow.                                                                               |
| Visual capture tutorial          | Missing as a dedicated pass/fail coach.                                                                                                                                              | Add a concise first-run/reopenable coach using Mica styling and original artwork, not copied DGC assets.                                                                                              |
| Live alignment and level         | Present as a guided boundary, Light/Focus/Frame/Level/Steady checks, device-motion level, and auto-capture gate.                                                                     | Make edge alignment and the relationship between the level and frame visually clearer.                                                                                                                |
| Capture evidence                 | Mica already requests primary and alternate-light front/back views, which is more evidence than the two visible DGC capture steps in this segment.                                   | Keep four views for the evidence-first grade. A lighter mode may use fewer views only if its output is explicitly narrower.                                                                           |
| Identity confirmation            | Present for photo identification and guarded when attaching a report, but the checkpoint is not as visually explicit as DGC's two-thumbnail screen.                                  | Add one scan-details checkpoint with both sides, extracted identity, exact-version confirmation, and catalog/custom fallback.                                                                         |
| Four grading modes               | Missing. Mica currently exposes one evidence-first digital grade route.                                                                                                              | Add only after each mode has an honest output contract: Centering Check, Quick Condition Check, Full Digital Grade, and Deep Review. Do not imply four independent trained systems before they exist. |
| Named processing                 | Present: normalization, centering, corners/edges, surface/structure, independent consensus, and overall grade.                                                                       | Connect visible completion to durable backend stage state and expose elapsed/ETA for queued work.                                                                                                     |
| Result hierarchy                 | Present, including report ID, card image, DG/tier/range, PSA pre-screen, confidence, sub-grades, defect map, market context, and evidence detail. Some secondary evidence is nested. | Recompose the first viewport around image + DG/tier + four sub-grades + confidence + primary action; keep technical method below.                                                                     |
| Front/back defect review         | Present through side-specific sub-grades and localized evidence crops, but not a persistent Front/Back image toggle at the report top.                                               | Add a direct Front/Back switch over the same report image and keep numbered findings anchored to each side.                                                                                           |
| Financial comparison             | Present with ungraded value, predicted-grade value, estimated grading cost, and possible value gained.                                                                               | Keep provider-sourced values and the strict separation between price and condition.                                                                                                                   |
| Confidence and provenance        | Stronger than the visible DGC example: Mica records percent confidence, independent-review agreement, hashes, rubric/model versions, and abstention.                                 | Keep the detail; translate the first view into a plain-language confidence band and leave technical provenance expandable.                                                                            |
| Shareable output                 | Present as a locally rendered report image.                                                                                                                                          | Keep. A Digital Slab can be a branded share layout, not a claim of physical certification.                                                                                                            |
| Blockchain and minting           | Intentionally absent.                                                                                                                                                                | Continue to omit.                                                                                                                                                                                     |
| Stacked subscription and credits | Intentionally absent.                                                                                                                                                                | Continue to avoid. Any paid entitlement must be singular, disclosed before capture, and retry-safe.                                                                                                   |

### Recommended Mica grading contracts

The four-mode concept is useful only if each selection changes the work and the
answer, not just the branding:

1. **Centering Check** — front and back, measured border ratios, no condition
   grade, no professional-grade prediction, fastest and least expensive.
2. **Quick Condition Check** — front and back, broad condition range and four
   provisional category signals, no claim of fine surface or structural review.
3. **Full Digital Grade** — Mica's current four-view primary/alternate-light
   evidence flow, independent review consensus, localized findings, DG range,
   provisional PSA distribution, and financial context.
4. **Deep Review** — queued full report plus requested close-ups/angled evidence,
   durable ETA, saved recovery state, and human adjudication if Mica later adds
   a qualified review operation. Until that operation exists, show this mode as
   unavailable rather than simulating it.

The app can reach DGC-level interaction parity without copying its brand or
unsupported claims. It cannot reach independently demonstrated accuracy by
matching UI, prompts, model names, or DGC outputs. Accuracy requires the
protected professional-return benchmark and repeat-scan gates already listed
above.
