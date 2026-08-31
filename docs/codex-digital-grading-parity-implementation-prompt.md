# Codex implementation prompt: Mica digital grading parity

Copy everything between `BEGIN PROMPT` and `END PROMPT` into Codex.

---

## BEGIN PROMPT

You are the senior product designer, senior UI/UX designer, computer-vision
product engineer, full-stack engineer, QA owner, and release owner for Mica.
Implement the complete digital-grading experience described below in the
existing Mica repository. This is an execution request, not a request for
another audit, mockup, proposal, or partial proof of concept.

Work until the complete flow is implemented, tested, visually polished,
deployed to the linked production Vercel project, and verified on the deployed
URL. Do not stop after producing a plan. Do not leave primary buttons as visual
placeholders. Do not claim a feature works when its underlying contract is not
implemented. Make reasonable, conservative assumptions when they do not change
the requested product; ask only if a genuinely blocking choice cannot be
discovered from the repository or linked services.

### 1. Required evidence before editing

Before changing code, inspect all of these sources yourself:

1. Use the installed Watch skill on
   `https://www.youtube.com/watch?v=_I9Ig_aOwCw&t=191s`, focused on 00:51–02:59.
   Use maximum useful visual fidelity, retain near-duplicate frames, and inspect
   every extracted frame. Do not rely only on a transcript. The important
   evidence is the layout, proportions, camera feedback, hierarchy, motion,
   spacing, depth, and sequencing visible on screen.
2. Inspect every DGC screenshot already supplied in this conversation,
   including processing, defect mapping, defect detail, independent subgrades,
   financial analysis, report presentation, and AR/share views.
3. Read all of
   `docs/digital-grading-product-research-2026-08-01.md`, especially the video
   review, contradiction notes, failure matrix, parity audit, and accuracy
   gates.
4. Read all of `docs/digital-grading-benchmark.md` and
   `docs/digital-grading-implementation.md`.
5. Read the complete supplied one-star review file at
   `/Users/Elliottrouse/.codex/attachments/dc4c80d4-ae0f-42e9-86ac-a6dcb8d44ccd/pasted-text.txt`.
6. Inspect the current application in a real browser at phone, tablet, and
   desktop widths. Exercise Add Cards, Collection, card details, authentication,
   every grading entry point, camera fallback, processing, report, failure,
   retry, regrade, and recent-activity states. Screenshots of static markup are
   not enough.
7. Inspect the current repository and linked environment before deciding what
   is missing. Preserve correct existing work instead of rebuilding it blindly.

Write a short working checklist after this inspection, then implement it. The
final answer must report what actually changed and what was actually verified;
it must not repeat the research as a substitute for implementation.

### 2. Product outcome

Make Mica's grading experience feel as focused, legible, deep, responsive, and
collector-oriented as the DGC experience visible in the evidence. Reproduce the
successful interaction hierarchy and information architecture while retaining
Mica's own name, cream/sage/olive visual identity, original copy, accessibility,
privacy rules, and evidence limitations.

A collector should immediately understand:

- where to add a new card;
- where to grade a card already in the collection;
- which saved cards are eligible for digital grading;
- what each grading mode does, requires, returns, and how long it may take;
- exactly how to photograph the card successfully;
- what the app is doing during analysis;
- how the final grade was constructed;
- which defects were actually observed and where;
- how certain or uncertain the estimate is;
- whether professional grading may be financially sensible;
- how to save, share, regrade, retry, or recover the report.

The experience must not feel like a generic form, a flat admin dashboard, a
marketing graphic, or a maze of nested screens. It should be card-first,
visual-first, and action-first. Use short labels and visual examples instead of
paragraphs wherever the same meaning can be communicated clearly.

### 3. Brand, originality, and accuracy boundaries

- Keep the product name **Mica** everywhere. Never rename it to Jordan Pokémon
  App, DGC, Digital Grading Company, or another brand.
- Use Mica's established cream, ivory, sage, pine, olive, mineral, and warm
  metallic colors. The focused camera and report may use a very dark mineral
  surface for contrast, but the accent system must still feel like Mica. Do not
  copy DGC's violet palette wholesale.
- Match the demonstrated hierarchy, density, proportions, depth, and interaction
  clarity; do not copy DGC logos, trademarks, proprietary illustrations,
  marketing claims, wording, card art, or branded assets.
- Use original Mica icons and ornaments. Prefer precise SVG/CSS icons for UI.
  Use the Imagegen skill only for subtle original decorative textures or
  background assets that materially improve depth; inspect and optimize every
  generated asset before shipping it. Do not generate official Pokémon
  characters, logos, card frames, or imitations of protected artwork.
- Do not claim Mica uses DGC's proprietary models. Do not use DGC results as
  labels. Do not claim DGC-equivalent accuracy, microscopic inspection,
  authentication, counterfeit detection, or professional certification.
- This video is explicitly recorded before the reviewer's professional returns
  arrived. It demonstrates UX, not accuracy. Preserve Mica's `validated: false`
  state and explicit estimate language until the protected benchmark passes.
- Never allow price, popularity, rarity, expected profit, or previous DGC output
  to affect the physical-condition score.

### 4. Preserve and build on the existing architecture

The current application is a static PWA with a large `app.js`, `index.html`,
`styles.css`, `themes.css`, Vercel API routes, Supabase persistence/RLS, and
domain modules. Do not migrate frameworks or rewrite the product unless a real
repository constraint makes that unavoidable.

Inspect and reuse, at minimum:

- `index.html`
- `app.js`
- `styles.css`
- `themes.css`
- `lib/capture-precision.js`
- `lib/grading.js`
- `lib/vision.js`
- `lib/vision-evaluation.js`
- `lib/gateway-models.js`
- `lib/supabase-data.js`
- `api/vision.js`
- grading-related Supabase migrations and schema
- `tests/grading.test.js`
- `tests/capture-precision.test.js`
- `tests/vision.test.js`
- `tests/security.test.js`
- `tests/browser/ui-regression.spec.js`

Preserve unrelated user changes in the dirty worktree. Use focused edits. Add a
migration only when the current schema cannot represent a required durable
state. Maintain owner-scoped RLS and idempotency.

### 5. Final information architecture

#### Add Cards

The primary Add Card action must open the live card camera immediately. Do not
make the user first choose a card from the collection, choose between multiple
large feature tiles, or read a landing page.

The camera flow must still provide quiet fallbacks for:

- choosing a saved card photo;
- searching by name, set, or collector number;
- adding unopened products, without mixing that workflow into raw-card grading;
- recovering when camera permission or hardware is unavailable.

Remove the receipt-scanning feature, receipt CTA, receipt-specific camera copy,
and dead receipt-only UI paths. Preserve purchase data entry, but do not ask for
or scan a receipt.

After card identification and the minimum applicable ownership fields are
confirmed—but before the new card is saved—show one clear decision dialog:

> Would you like to digitally grade this card?

Actions:

- **Grade now**: start the grading mode/capture flow. Hold the card-add draft
  locally and durably enough to recover. When a responsible report completes,
  atomically add the card and associate its DG report. If Mica abstains or save
  fails, preserve the draft and give an explicit retry or Add without grade
  action.
- **Add without grading**: save the card normally and take the user to the saved
  card or Collection.

Do not ask acquisition date, valuation, market opinion, notifications, profile
photo, collector tag, or other unrelated information before the user can grade.
Only ask the ownership fields needed to save the card, and reveal optional
fields progressively.

#### Collection

All grading management belongs in Collection, below the collection card list as
previously requested. Do not put a decorative marketing hero above the cards.

Every owned, unsealed, professionally ungraded card must show one obvious card-
level action:

- **Digital grade** when it has no saved DG result.
- **Regrade · DG X.X** when it has a saved digital result.

The card itself must also display the compact DG number and tier. A digital
grade never changes the card into a professionally graded card. Professionally
graded cards and sealed products must not display Digital Grade or Regrade.

The Collection grading workspace below the cards must include:

- a strong but compact **Start grading** button;
- a one-sentence explanation that it grades an ungraded card from the
  collection;
- an ungraded-card picker or scan-to-match flow when no card-level action was
  used;
- the four grading modes with clear differences;
- recent grading activity using the card's actual image, name, set/number,
  result/status, and date—not “Card grading session” as the main label;
- durable completed, processing, awaiting-capture, abstained, failed, and
  interrupted states;
- View card, View report, Continue capture, Retry analysis, or Restart actions
  as appropriate.

The generic Start Grading action must never silently create an unattached
report. It must either identify and match an owned raw card or ask the user to
select one before final attachment.

#### Card details

For eligible raw cards, put the DG summary and Grade/Regrade action near the
card identity, not inside a deeply nested tools section. Show saved reports and
comparison history below it. Keep professional grading data visually distinct.

### 6. Four honest grading modes

Use four collector-understandable modes corresponding to the useful jobs shown
in DGC. The labels may be refined to fit Mica, but the job and output must remain
obvious. A recommended naming set is:

| Mode                   | Capture contract                                                                                                 | Output contract                                                                                                                                                                                                        | Timing contract                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Centering Tool**     | Primary front and back with strict frame, perspective, and level checks.                                         | Measured left/right and top/bottom ratios when detectable, front/back centering assessment, PSA guideline context, measurement confidence, and an abstention when borders are not measurable. No surface/corner grade. | Immediate local preparation plus measured server time. Never promise a fixed number.                                            |
| **Quick Grade**        | Primary front and back.                                                                                          | Broad DG range, provisional overall score when supported, four provisional category signals, confidence, and limited-evidence warning. No claim of detailed surface/structure inspection.                              | Target a fast result, but show measured elapsed state instead of “30 seconds” until production data supports it.                |
| **Full Digital Grade** | Primary front, primary back, alternate-light front, alternate-light back.                                        | Full DG score/range/tier, independent front/back subgrades, evidence consensus, defect map, confidence, provisional PSA distribution, report data, and financial context.                                              | Synchronous when it safely completes; otherwise preserve a durable processing state.                                            |
| **Deep Review**        | Full four-view sequence plus only the close-up, edge, corner, or angled-light evidence requested by uncertainty. | The most detailed report, explicit review agreement/disagreement, all retained evidence, withheld findings, model/rubric versions, and a durable final result or abstention.                                           | A queued workflow with real state and ETA derived from observed jobs. Never simulate one-to-four hours or fake background work. |

Each mode card must show, without opening another screen:

- what question it answers;
- how many photos it needs;
- what report it returns;
- its current availability;
- expected timing based on real capability;
- any price or allowance before capture, if monetization exists.

Do not reproduce DGC's Universal Credits wallet, grading tokens, minting credits,
or subscription-plus-credit stack. If the current Mica plan has no grading
charge, do not introduce one. If entitlement already exists, present one
unambiguous included-use/price contract before the camera opens. Never sell a
credit the current subscription cannot use. Retries of the same idempotent
session cannot consume another allowance.

If Deep Review cannot be made genuinely durable with the available backend, do
not fake it. Implement its data/state foundation and display an honest
unavailable explanation until the capability is real. The other three modes
must remain usable.

### 7. First-run scanning coach

Before the first grading capture, show a short visual setup coach inspired by
the demonstrated DGC interaction but rendered with original Mica visuals.
Make it reopenable from a help icon and skippable after the first successful
view. Persist the preference per user/device.

Use three or four swipeable/steppable cards with page dots, a single Next/Start
action, and paired pass/fail animation:

1. **Keep the phone parallel** — show a level phone/card with a check and a
   visibly tilted setup with an X.
2. **Show the whole card** — all four corners and edges inside the guide; no
   crop, sleeve border, hand, or slab covering the card.
3. **Use even light** — diffuse lighting from more than one direction; no glare,
   hot spot, hard shadow, or flash reflection.
4. **Use a plain contrasting surface** — light card borders need a darker neutral
   surface and dark borders need a lighter neutral surface. Remove sleeves when
   safe. Keep the card flat and clean without telling users to risk a high-value
   card.

Use animation to teach, not long paragraphs. Honor `prefers-reduced-motion` by
showing clear static before/after examples.

### 8. Capture experience

Capture must be a focused, edge-to-edge task. Hide normal navigation and
irrelevant app chrome. Use a dark mineral camera surface so the physical card,
guide, and instructions dominate.

Required top area:

- close/back action with safe cancellation;
- selected grading mode;
- exact step label such as `1 of 4 · Front`;
- a compact progress sequence for all required views;
- a help action to replay setup guidance;
- the private scan/report identifier after session creation.

Required camera area:

- a true card-ratio guide around 63:88;
- visible corner and edge segments, not only a faint rectangle;
- waiting alignment in neutral white/amber;
- passing alignment in Mica green around the entire detected card boundary;
- clear feedback when an individual edge or corner is outside the guide;
- a live two-axis level integrated with the frame, including tilt degrees when
  available;
- card-side validation and orientation handling so front/back and upside-down
  uploads cannot be silently swapped;
- a real camera image, never a fake demo card in production.

Required live checks:

- Light
- Focus
- Frame
- Perspective
- Level
- Steady
- Glare/shadow
- Correct side/orientation

Keep these checks compact. The main status line should name only the single
highest-priority correction, for example `Move closer`, `Show the top edge`,
`Level the phone`, `Reduce glare`, or `Hold steady`. Do not make the user decode
seven simultaneous warnings.

Required controls:

- one large, high-contrast shutter;
- automatic capture only after all blocking local checks pass for a stable
  interval;
- manual shutter fallback;
- three-second tripod timer;
- keyboard/remote shutter behavior already supported by the PWA;
- choose saved photo fallback;
- switch camera when multiple cameras exist;
- torch only when supported, with warnings that direct glare can reduce quality;
- retake and Use Photo review state.

The primary action text must always pass contrast requirements. Never place
similar-value text and button colors together.

For Full Digital Grade, the uninterrupted sequence is:

1. Primary front — flat, diffuse, even light.
2. Primary back — same setup.
3. Alternate-light front — a different soft light angle to reveal scratches,
   print lines, dents, or surface variation without flash.
4. Alternate-light back — same alternate-light intent.

Show exactly why alternate-light captures are required. Do not make the user
return to menus between views. Preserve accepted captures if one later view
needs a retake.

Run local checks before remote model usage. Record brightness, contrast,
sharpness, glare, shadow, bounds, aspect error, perspective error, edge
confidence, tilt, stability, side, orientation, capture method, and image hash.
Normalize/crop only when the boundary is measurably reliable. Never quietly
repair a capture so aggressively that it invents evidence.

### 9. Scan-details and exact-card confirmation

After the required primary front/back captures and before attaching a result,
show a dedicated **Checking scan details** checkpoint:

- front and back thumbnails together;
- detected name;
- set;
- collector number and printed total;
- language;
- variant/finish when supported;
- confidence;
- an explicit warning when side or orientation is uncertain.

Actions:

- **Search for this card** using the extracted identity.
- **Confirm exact match** when one catalog result reliably agrees.
- **Choose another match** from visually useful result rows.
- **Create custom label** only when the catalog truly lacks the card.
- **Retake a side** when identity or orientation evidence is weak.

Search should be prefilled and explain briefly that character/name plus set or
collector number works best. Each result needs card image, name, set, collector
number, language, finish/variant, and a reason it matches. Never silently select
Japanese when the captured/saved card is English or vice versa.

For a grade started from an existing card, require exact agreement on name,
set, collector number, and language before saving. For a custom label or
unresolved identity, allow a private unattached report only if clearly marked;
do not overwrite a saved card's DG number.

### 10. Processing experience

Use the visual confidence of DGC's processing screen: dark focused panel,
high-contrast named stages, thin mineral-to-warm-metal-to-sage gradient bars,
and a large overall composite card. Keep the styling original to Mica.

Named stages for Full/Deep grading:

1. Photo normalization — device, light, crop, side, orientation, and
   perspective checks.
2. Centering assessment — measurable front/back printed-border geometry.
3. Corner assessment — localized front/back corner evidence.
4. Edge assessment — localized whitening, chipping, wear, or cut evidence.
5. Surface and structure assessment — primary/alternate-light comparison for
   visible scratches, print lines, indentations, creases, bends, or stains.
6. Evidence consensus — independent reviews, localized agreement, outliers,
   and required follow-up evidence.
7. Overall grade — frozen weighted rubric, weakest-area guard, provisional PSA
   distribution, and report persistence.

Every progress indicator must represent real application state. The current
CSS uses endlessly animated decorative progress; replace it with state-driven
progress or label it as indeterminate when the backend cannot expose a percent.
Do not advance bars on a timer merely to look active.

Show Processing, Preparing report, Complete, Failed, or More evidence needed.
When complete, reveal the report automatically or enable one strong Reveal
Grade action. For long-running work, allow the user to leave safely and recover
from Recent Grading without losing the session.

### 11. Report layout and visual hierarchy

The report must feel like the central product, not a diagnostics dump. Use one
responsive report page/sheet with sections in this order.

#### Persistent report header

- close/back;
- `Report No.` plus stable identifier;
- graded date and time;
- report state;
- delete report action with confirmation and correct capture-retention cleanup;
- direct Front and Back tabs.

Do not add a Blockchain tab.

#### First viewport: card and grade

The first mobile viewport must contain as much of the following as practical
without tiny type:

- large card image;
- direct Front/Back switch;
- card name, set, collector number, language, and variant;
- large one-decimal **DG X.X** result;
- Mica mineral/gem tier;
- responsible range so decimal precision is not presented as certainty;
- compact confidence band;
- four subgrade summaries;
- one primary next action.

Use a layered grade plate overlapping or sitting immediately below the card,
similar in depth and proportion to the visual reference: deep shadow, subtle
inner edge, mineral glow, small tier icon, large grade number, identity, and
report ID. Keep text readable and the card unobstructed.

Mica's existing tier mapping remains the source of truth unless domain tests
show a reason to revise it:

- Diamond: 9.6+
- Ruby: 9.0–9.5
- Emerald: 8.0–8.9
- Sapphire: 7.0–7.9
- Pearl: 6.0–6.9
- Onyx: 5.0–5.9
- Amethyst: 4.0–4.9
- Amber: 3.0–3.9
- Quartz: 2.0–2.9
- Stone: 1.0–1.9
- Coal: below 1 when the scale permits it

An abstention shows no manufactured DG number. Lead with `More evidence needed`
or `Mica could not grade responsibly`, preserve the report, and give the exact
capture action.

#### Quick actions

Keep only collector-useful actions:

- Save/download label or report;
- Share report;
- Open Digital Slab/share view;
- Regrade;
- Save DG to Collection when not already attached.

Do not add blockchain minting, tokens, crypto wallets, empty icon buttons, or
actions that exist only to make the screen look busy.

#### Grade rationale

Provide a concise two-to-four sentence rationale explaining why the overall
result falls in its range. Mention the strongest and limiting areas, visible
evidence, and uncertainty. Avoid generic praise, invented microscopic claims,
or repeating every subgrade.

#### Independent subgrades

Use four large, equal cards:

- Corners
- Edges
- Surface
- Centering

Each card displays:

- combined category score or range;
- front value/range;
- back value/range;
- directional or limiting indicator;
- confidence/availability state;
- tap target to filter the defect map to that category.

Do not hide the four categories behind several taps. On narrow phones use a
2×2 grid; on wider screens use four columns. Preserve readable type and minimum
touch targets.

Below them, add a detailed breakdown visualization only if it clarifies the
same data. A restrained radar/spider chart is acceptable when every exact value
remains available in text and the chart is accessible. Do not ship a decorative
chart with no additional meaning.

#### Digital defect mapping

Provide a dedicated Front/Back defect view directly in the report:

- grayscale/dim the card only enough to make markers legible;
- place numbered markers at normalized evidence coordinates;
- preserve the original color view as a toggle;
- show notable-defect summary, visible cleanliness, dominant/limiting side, and
  front/back finding counts;
- allow category filtering from subgrades;
- never show a marker without retained localized evidence.

Selecting a marker opens a bottom sheet/dialog containing:

- finding number and permanent evidence ID;
- front/back side;
- category;
- severity;
- precise area;
- confidence;
- cross-review agreement status;
- one or two enlarged crops, including an undamaged comparison crop only when
  it is actually derived from the captured image;
- a short visible-evidence description;
- why it affected or did not affect the grade;
- `This looks wrong` feedback action;
- close action with focus restoration.

False or unsupported whitening, scratches, dots, or corner damage must be
discarded by evidence verification rather than displayed confidently.

#### Confidence and card data

Use a clear confidence band inspired by the visible A–E scale, but do not hide
the underlying meaning. Display a compact band in the main report and provide
the measured percent plus explanation in Card Data. Confidence describes
evidence coherence, not authenticity or professional agreement.

Card Data must include:

- report ID;
- card identity fields;
- graded timestamp;
- overall DG score/range/tier or abstention;
- four combined and front/back category values;
- confidence;
- capture mode and capture count;
- model bundle version;
- rubric version;
- provisional calibration version;
- independent review count;
- evidence agreement threshold;
- disagreement/outlier count;
- follow-up evidence state;
- saved/replaced/protected regrade state;
- explicit `Estimate, not an official grade` and `Authenticity not assessed`.

Technical provenance may be in a single expandable Card Data/Method section;
the collector result cannot be buried inside it.

#### Financial decision support

Reproduce the useful decision hierarchy from the screenshots with Mica data:

- predicted value based on the supported grade outcome;
- current exact ungraded market value;
- price provider and observation time;
- estimated professional grading cost;
- possible value gained after grading cost;
- likely professional-grade outcomes with probability;
- profit/loss and ROI only when all inputs are present and compatible.

A circular/ring comparison may show ungraded value, estimated grading cost, and
possible grade-related value, but exact numbers and a text legend are mandatory.
Never invent a price, silently substitute another printing/language/condition,
or show $0 for missing data. State `Not available` and explain the missing
match. Pricing must remain downstream of the condition result.

#### Digital Slab and AR/share output

Implement the useful non-blockchain sharing behavior visible in the evidence:

- a polished Digital Slab/share card containing card identity, image, DG score,
  tier, report ID, estimate warning, and Mica branding;
- locally rendered output without uploading a new copy merely to share;
- native share when supported and download fallback;
- optional camera-backed AR/share composition after grading, with the slab
  visually anchored over the live card and a `Snap and share this grade` action;
- clear close/cancel and privacy behavior;
- no suggestion that the digital slab is a physical certification or proof of
  authenticity.

The AR/share screen is an output after grading, never a prerequisite and never
part of condition analysis.

### 12. Grade calculation and evidence behavior

Preserve and harden the existing evidence-first implementation:

- local image-quality gates before remote usage;
- prepared high-resolution evidence and hashes;
- exact side/orientation descriptors;
- independent provider-family reviews;
- majority-localized evidence only;
- agreement on identity and grade range;
- outlier handling and visible disagreement metadata;
- weakest-area weighting;
- structural-damage hard stops;
- grade/evidence contradiction guards;
- alternate-light requirement for possible high grades;
- explicit abstention;
- provisional PSA probability distribution;
- frozen model/rubric/calibration versions;
- no authenticity claim;
- no ordinary photo retention without explicit research consent.

Do not weaken four-view Full Grade merely to match the two visible DGC capture
steps in the video. Mica's alternate-light evidence directly addresses the
one-star reports about missed scratches, print lines, dents, bends, and false
defects.

Do not present a general multimodal model's prose as a specialized trained
corner/edge/surface detector. Continue to disclose the current limitations and
abstain when localization is unsupported.

### 13. Regrade behavior

Regrade uses a new immutable scan session and preserves all prior reports.
Compare:

- overall DG movement;
- category movement;
- localized high-confidence findings;
- capture quality and geometry;
- model/rubric version changes.

If the result moves beyond the safe tolerance or radically changes supported
defects, do not silently overwrite the Collection DG number. Save the report as
an unstable regrade, explain why the previous number remains protected, and ask
for a controlled repeat scan. A stable confirmed regrade may atomically replace
the displayed DG number while retaining history.

### 14. Durable sessions, recovery, and tracking

Create or reuse a private, owner-scoped scan session before the first grading
capture. Persist enough workflow state that refresh, navigation, crash, network
failure, and delayed processing do not make the report disappear.

Required states:

- created;
- capturing, with accepted capture types;
- awaiting identity;
- queued;
- analyzing, with real stage;
- needs evidence;
- preparing report;
- completed;
- abstained;
- failed and retryable;
- cancelled;
- superseded/protected regrade.

Every retry must be idempotent. A repeated completed request returns the saved
report. An analysis failure keeps the accepted captures/session references
allowed by privacy mode and offers a safe retry. Never consume another paid
allowance for the same failed idempotent request.

Recent Grading must survive reload and be owner scoped. Never render a generic
title when identity is available. Do not remove the old DG number until a new
result is safely confirmed.

### 15. Failure prevention from the supplied one-star reviews

Treat every recurring review pattern as an acceptance requirement:

- **Same card scores from 6–10 / changing defects:** consensus, repeat-scan
  comparison, evidence localization, versioning, and protected regrades.
- **Damaged or bent cards receive 8–9+:** critical/major crease and dent hard
  stops, weakest-area cap, and severe-card tests.
- **False whitening, scratches, or spots:** contrasting-background guidance,
  glare/shadow rejection, alternate light, localized majority agreement, and
  false-defect feedback.
- **Missed scratches, print lines, factory errors, dents, bends:** alternate-
  light full views and targeted close-up/angled evidence. Abstain when phone
  photos cannot support the claim.
- **Card cannot be detected / crooked crop:** live boundary confidence,
  perspective and aspect rejection, precise correction, manual shutter, and
  saved-photo fallback.
- **Uploads flip upside down / wrong side:** orientation normalization, side
  validation, front/back thumbnails, and explicit confirmation.
- **Image upload fails:** local validation, bounded retries, clear network
  state, persisted session, and no lost charge.
- **Queue/result disappears:** durable session/history created before analysis
  and retryable saved failure states.
- **Wrong Japanese version:** exact language identity agreement and visible
  language in every result row.
- **Too many fields before grading:** capture first; unrelated purchase and
  valuation data later.
- **Feature buried and difficult navigation:** card-level actions, Collection
  workspace, direct new-card grading prompt, and no chain of hidden menus.
- **Account/profile loop:** no forced profile picture, nickname, collector tag,
  or repeated onboarding before core access.
- **Login/loading loop and crashes:** explicit timeout/error/retry states and
  restored route after authentication.
- **Verification emails not sent:** audit Supabase email signup configuration,
  redirect URLs, Vercel environment variables, signup response handling, resend
  verification action, and user-facing state. Test the real request safely.
- **Forced notification permission:** notifications remain optional and are
  requested only after the user enables a notification feature.
- **Forced rating prompt:** never ask for a store rating before meaningful use.
- **Paywall before seeing value / no free binder:** Collection, search, manual
  add, and saved-card management remain useful without grading payment.
- **Subscription says included but redirects to paywall:** one entitlement
  source of truth and automated state tests for every plan/mode combination.
- **Tokens sold but unusable without another tier:** do not implement stacked
  credits; if any entitlement exists, block incompatible purchase before
  payment and explain exact access.
- **Subscription cancellation confusion:** settings must link to the correct
  platform subscription management and state clearly that uninstalling does
  not cancel a subscription.
- **Support missing:** provide a visible Help/Support path in Settings and from
  recoverable grading errors.
- **Database/search gaps:** never present absence as an exact match; support
  custom label and catalog feedback while preserving identity guards.
- **Financial fields empty or misleading:** show sourced exact matches or an
  honest unavailable state; never fill with invented numbers.

### 16. Visual design specification

Act as a senior mobile product designer. The finished grading flow must have
more depth than the current flat panels while remaining restrained and usable.

Use:

- layered cards with one outer shadow, one subtle inset highlight, and clear
  separation from the canvas;
- mineral-like gradients using Mica sage, pine, olive, warm gold, and muted
  plum only as a supporting accent;
- subtle radial glows behind grade plates and processing stages;
- fine borders and edge highlights rather than heavy outlines everywhere;
- a restrained paper/mineral texture on large empty surfaces;
- purposeful icons for scan, level, light, corners, edges, surface, centering,
  evidence, confidence, report, share, regrade, and recovery;
- large, confident report numbers and grade typography;
- compact uppercase/eyebrow labels only where they improve scanning;
- consistent spacing rhythm, radii, icon stroke, and button height;
- micro-interactions for alignment pass, capture confirmation, stage completion,
  grade reveal, marker selection, and save success;
- real loading, empty, error, offline, disabled, hover, active, focus, success,
  warning, and destructive states.

Do not add:

- a large top marketing graphic or “millions graded” hero;
- ornamental charts without data;
- unreadable low-contrast sage-on-sage buttons;
- excessive paragraphs;
- floating actions with no label or discoverable purpose;
- DGC purple copied as Mica's primary palette;
- Pokémon logos, character art, or copied card UI as decoration;
- flat gray boxes repeated down the entire report;
- unnecessary nested accordions for primary grading information.

The main application remains light Mica. The focused grading camera, processing,
defect map, Digital Slab, and report hero can use dark mineral surfaces so the
experience has drama and concentration without becoming a separate brand.

### 17. Responsive and accessible behavior

Verify at 320, 390, 768, 1024, and 1440 CSS pixels.

- No horizontal overflow.
- No clipped camera controls or dialogs under safe areas.
- Touch targets at least 44×44 CSS pixels.
- Text remains readable without zoom.
- Buttons have WCAG AA contrast in every state.
- Dialogs trap focus and restore it on close.
- Full keyboard operation for non-camera functions and existing remote shutter.
- Semantic headings, labels, progress/status announcements, and alt text.
- Defect markers have numbered accessible buttons and equivalent text lists.
- Charts have text equivalents.
- Color is never the only indication of pass/fail, grade change, or severity.
- `prefers-reduced-motion` removes nonessential movement.
- Screen readers do not announce continuously fluctuating camera measurements;
  announce only meaningful state changes.

### 18. Performance, privacy, and security

- Keep camera analysis smooth on supported phones. Throttle expensive frame
  checks and clean up streams, timers, object URLs, sensor listeners, and event
  handlers on every exit.
- Lazy-load report-only charts/assets.
- Optimize generated/raster assets and avoid adding large uncompressed media.
- Keep ordinary card photos transient. Store only measurements, hashes, bounded
  evidence, and report data unless research consent is active.
- Research consent remains optional, versioned, revocable, owner scoped, and
  deletable.
- Do not expose model prompts, raw provider responses, service keys, private
  storage paths, or another user's session/report.
- Maintain RLS, service-role boundaries, rate limits, and idempotency.
- Deleting a material report or research capture requires confirmation and
  correct recoverability/privacy messaging.

### 19. Required automated tests

Add or update tests for at least:

#### Domain and grading

- tier boundaries;
- mode contracts and required capture types;
- weakest-area weighting;
- critical/major structural abstention;
- high-grade alternate-light gate;
- unsupported evidence removal;
- identity/language conflict blocking;
- front/back side validation;
- orientation normalization;
- repeat-scan stability;
- protected regrade behavior;
- confidence-band mapping;
- price separation from condition;
- unavailable/mismatched financial data.

#### Capture precision

- brightness, focus, glare/shadow, steady, level, frame, aspect, perspective,
  and boundary pass/fail thresholds;
- priority correction selection;
- auto-capture stable interval;
- manual/saved-photo fallback;
- device-motion unavailable state;
- all mode-specific sequences.

#### Persistence and security

- owner-scoped sessions/reports;
- durable workflow transitions;
- idempotent retries;
- completed report immutability;
- failed session recovery;
- atomic card-add-plus-grade association;
- research consent and deletion;
- account signup verification/resend response behavior;
- no client access to protected grading writes.

#### Browser end-to-end

- Add Card opens camera immediately;
- saved-photo fallback reaches exact-card confirmation;
- new card can decline grading and save;
- new card can choose Grade Now and save atomically with DG;
- raw Collection card shows Digital Grade;
- digitally graded raw card shows DG and Regrade;
- professional/slabbed and sealed cards show neither;
- generic Collection grading selects/matches an owned raw card;
- each usable grading mode shows the correct capture sequence;
- setup coach, capture checks, retake, processing, result, report, defect dialog,
  share, regrade, and recent history;
- abstention and supplemental-evidence routes;
- refresh during capture/analysis and retry after failure;
- recent rows show card identity, not generic session names;
- no receipt UI;
- auth create-account verification and resend states;
- responsive, focus, contrast, touch-target, and overflow assertions.

Use deterministic mocked media/model responses in automation. Do not make the
test suite depend on paid live AI calls. Use a separate explicitly approved
private evaluation command for real model benchmarking.

### 20. Accuracy evaluation and release language

Unit tests, multimodal self-agreement, DGC screenshots, and DGC outputs are not
accuracy evidence. Preserve the existing protected evaluator and these release
gates:

- at least 95% of supported predictions within one verified PSA grade;
- at least 95% of repeat scans within 0.5 DG points;
- at most 5% false-positive high-confidence PSA 10 recommendations;
- at least 90% completion for supported devices/conditions;
- visible support for every retained defect;
- separate cohort results for language, era, finish, device, lighting, severe
  damage, and high-grade cards;
- no access to the final holdout during tuning.

Until that passes, every result remains an unvalidated digital estimate and no
accuracy percentage appears in UI, marketing, metadata, or share images.

### 21. Implementation quality process

1. Inspect repository status and preserve unrelated changes.
2. Make a concrete plan covering UX, frontend state, domain contracts,
   persistence, tests, and deployment.
3. Implement foundation/data contracts before styling states that depend on
   them.
4. Implement all entry points and recovery paths.
5. Perform a senior design pass for hierarchy, depth, spacing, icon consistency,
   copy reduction, and responsive behavior.
6. Run formatting, lint, syntax/type checks, unit tests, schema validation,
   production build, and browser tests.
7. Start the app and personally exercise the complete workflow in a browser.
   Capture and inspect screenshots at phone and desktop sizes. Fix visual issues
   you actually observe.
8. Run a final regression for Add Cards, Collection, authentication, card
   details, settings, and unrelated routes.
9. Review the diff for dead receipt code, generic session labels, fake progress,
   debug copy, secrets, unrelated edits, and accessibility regressions.
10. Deploy the verified build to the linked production Vercel project. Confirm
    the production alias/URL, inspect deployment logs, and run smoke tests on
    the deployed URL—not only localhost.

If Supabase schema or configuration changes are required, use the linked
Supabase tooling and verify the live migration/advisors safely. If Vercel
environment changes are required, confirm the exact project/environment and do
not print secret values.

### 22. Definition of done

The work is not complete until all of these are true:

- Add Card opens directly into card capture.
- Receipt scanning is absent.
- Collection owns the grading workspace below the cards.
- Every eligible raw card has the correct Digital Grade/Regrade action.
- Saved DG numbers and tiers are visible on collection cards and details.
- New-card intake asks Grade Now before the card is added and handles both
  branches safely.
- The visual setup coach exists and is useful without paragraphs.
- Live capture gives clear boundary, edge, level, side, orientation, light,
  focus, glare, and steady feedback.
- All four grading jobs are represented honestly; no unavailable capability is
  simulated.
- Exact identity confirmation prevents wrong printing/language attachment.
- Processing stages are named and connected to real workflow state.
- The first report viewport is card/grade/subgrade/confidence first.
- Front/Back defect mapping and evidence detail work.
- Financial context uses exact sourced data or an honest unavailable state.
- Digital Slab/share output works without blockchain.
- Regrades preserve history and protect unstable previous DG numbers.
- Recent Grading uses actual card identity and survives refresh/failure.
- Authentication verification-email and resend behavior are working or a
  precise external configuration blocker is identified with evidence.
- The interface has deliberate depth, shadows, icons, hierarchy, and Mica
  colors while remaining accessible.
- All required checks pass.
- The production Vercel deployment succeeds and the deployed workflow is smoke
  tested.

In the final response, lead with the deployed result. Include the production
URL, the most important implemented changes, tests/checks run, any honest
capability that remains unavailable, and links to the key changed files. Do not
claim accuracy parity with DGC.

## END PROMPT
