# Mica interface and motion plan

Status: design plan, not a claim that this redesign shipped. Recognition repairs remain the current engineering priority. No added features, dependencies, paid services, platform conversion or App Store action.

## Direction

- **Product:** A collector's place to identify slabs, retain each copy and understand its value.
- **Character:** Calm, exact, tactile.
- **World:** A carefully arranged card binder and a collector's financial ledger.
- **Moments:** The real card/slab photograph and the main value chart carry the richness; navigation stays quiet.
- **Signature:** The exact grader and grade appear together in one consistent, compact label beside the card identity.

Retain Mica's mark, product information, existing navigation destinations and section order. Take iOS familiarity from hierarchy, controls, safe areas, readable text and predictable transitions. Do not imitate system glass with illegible blur layers or replace the web stack. These values are Mica's proposed implementation choices, not purported Apple-mandated animation specifications.

## Evidence and remaining visual checks

The real-photo intake audit exposed rejected readable uploads, lost slab context during search recovery and a printing-confirmation dead end. Those are interaction quality issues as well as recognition bugs. Current source has separate style layers in styles.css and themes.css, including a width transition around themes.css:3430 and a repeating process animation around 3435; inspect the computed live states before replacing them. Existing detail and intake screenshots show repeated metadata and explanation; revise only where still present in current renders. Historical screenshots are evidence of historical builds, not proof of today's pixel positions.

Before design implementation, capture the current build's actual routes and reachable sheets in both themes. Maintain a state manifest with route, entry action, expected contents, screenshot, viewport and outcome. Use the existing whiteboard inventory as a starting checklist, not a promise that its old capture count covers every state. No unobserved visual finding should be marked verified.

## Shared system: applied across every surface

| Element | Proposed treatment | Acceptance |
| --- | --- | --- |
| Page shell | Fluid content; 16px phone gutters, 24–32px larger-screen gutters; charts may reach the content edges. Respect safe areas and browser chrome. | No horizontal page overflow; no action behind home indicator, top controls or keyboard. |
| Spacing | 4px rhythm: 4/8 within controls, 12/16 within groups, 24/32 between sections. Space relationships deliberately rather than padding every block equally. | Equal rows, card padding and label baselines match across routes. |
| Type | Existing family first; evaluate system font stack on Apple platforms without a font download. Body 17px/1.45, labels 15px, secondary 13px, section 20px, page 28–34px, price 36–48px subject to fit. Weights 400/500, selective 600. | At 200% text, wrapping preserves all actions; no essential ellipsis or fixed-height clipping. |
| Figures | Tabular numerals; consistent locale/currency formatting; sign and reference period beside changes. | Long prices, half-grades, missing costs and foreign currencies stay legible. |
| Color | Existing brand accent, neutral page/raised surface/hairline ramp, three text roles. Positive and negative changes retain signs and labels. | Contrast measured in both themes; selection and error conveyed beyond color. |
| Buttons | Existing icon set, one stroke convention, 44×44 minimum touch target, normally 48px primary form action. One prominent action per task. | Press, disabled, busy, focus and retry states share the same semantics everywhere. |
| Inputs | Visible labels, 16px minimum input text, appropriate inputmode and autocomplete, inline error beside field. | No zoom surprise, lost typing on rerender, hidden field errors or keyboard obstruction. |
| Rows | Compact aligned label/value/action columns; 52–56px simple settings rows, flexible height for wrapped text. | Long translations and large text grow rows instead of clipping. |
| Corners | Controls 10px, cards 16px, sheets 20px as starting tokens; nested radii follow padding. | No arbitrary pill treatment for all unrelated components. |
| Icons | Reuse the current SVG set; 20px default optical box, 24px navigation. Labels retained for unfamiliar actions. | Icon-only controls have accessible names and touch targets. |
| Sheets | One task and one sheet at a time. Clear Cancel/Close and Save/Done where appropriate; full-screen camera. Restore opener focus and scroll. | Back, Escape, outside tap, dirty drafts and retry all behave consistently. |
| Loading | Immediately show retained matching data; keep its geometry while refreshing. Loading belongs to the affected control/region. | No blanking saved prices, full-page blocking spinner or artificial delay. |
| Empty/error | One specific fact and one next action; retain drafts. Price and identity uncertainty stay available in concise details. | Empty catalog, offline, provider timeout, expired session and never-priced cards have distinct honest states. |

## Screen and workflow coverage

| Existing screen / state family | Layout and copy plan | Motion / interaction plan | Required checks |
| --- | --- | --- | --- |
| Public entry, sign in, sign up, reset/recovery | Single form hierarchy; concise purpose, visible errors, clear password controls; no stacked marketing text. | Focus first invalid field; busy state on submit only. No animated validation shake. | Autofill, keyboard, expired link, repeated submit, failure preserves nonsecret draft values. |
| Onboarding and first collection | Explain only the next required step. Keep optional steps optional; no repeated welcome headings or extra tutorial pages. | Simple progress state for steps that exist. Back preserves work. | Fresh session, reload mid-flow, skip, completed-account return and sign-out isolation. |
| Portfolio | Current value then contextual change, main chart and nearby time controls; existing collection/activity sections follow. | Cached chart paints immediately. One brief first draw only when data is ready; range changes update without blanking. | All ranges really filter; narrow widths, sparse history, estimated purchase points, offline and refresh. |
| Collection / watching / graded / unopened | Images lead; name, set/number, grade and value form a concise stack. Consistent image frames, contained art and stable price area. Compact sticky controls. | Selection/favorite feedback is local. Preserve list position through detail/back and updates. | Long names, mixed grades, multi-copy groups, zero results, large inventories, never-priced entries. |
| Search and filter/sort | Query and clear action together; filters show current values; results identify printing differences without paragraphs. | Immediate input response; cancel obsolete searches; no result entrance cascade. | Name+set+number, Japanese, typo/no-result, pagination, keyboard, manual scan recovery. |
| Camera / upload | Live view owns the screen; shutter, library and text search form a stable control group. One short instruction only when needed. | State changes follow capture/processing; stop stream when leaving. No decorative scanning animation implying recognition. | Allowed/denied camera, rotate, library cancel, small readable screenshot, unsupported image, app background. |
| Scan processing / match choices | Preserve the photo, readable slab facts and a clear choice/correction action. Distinguish unsupported catalog from unreadable image. | Progress reflects actual work; no fake completion percentages or forced minimum waiting. | Slab label rotated/cropped, uncertain edition, PSA/CGC/BGS qualifiers, back-only negative and provider outage. |
| Catalog card detail | Card and concise identity lead; price and source action together; chart follows. Optional evidence in details. | Price refresh replaces matching data in place; chart gestures never block page scroll. | Grade/currency changes, typing during response, version confirmation before saving, no raw fallback for slabs. |
| Owned copy detail | Same visual language as catalog detail; retain copy navigation, purchase, certificate and sale facts. Exact grade visible immediately. | Return to the same selected copy and list position. No repeated celebration on navigation. | Multiple copies, distinct certs/costs, sold state, last valid matching quote and stale background refresh. |
| Add/edit copy and intake queue | Essential identity and purchase fields first; secondary fields disclose; one Save action. No duplicate facts in description and field labels. | Save acknowledges durable success, not optimistic success before persistence. Draft remains on retry. | Double tap, timeout, reload, queue resume, unknown cost, certificate leading zeros and owner boundaries. |
| Printing confirmation / correction / cert details | Show only distinctions needed to identify this version; previews can confirm without an owned record. Separate OCR observations from official verification. | Keep the existing context when replacing one correction sheet with another. | Holo/reverse, edition, promo/stamp, label qualifiers; no silently selected unknowns. |
| Purchases / sales / notes / activity | Aligned amount/date rows, concise verbs; details on demand. Destructive actions remain visually distinct. | Local completion feedback; no number tween that suggests a transaction has settled before it has. | Unknown cost, realized versus unrealized P/L, cancellation, sale of only selected copy, history retention. |
| Settings / profile / notifications | iOS-style grouped rows using existing options only. Appearance and notification text use plain language; account actions separate. | Immediate toggle feedback with explicit failure rollback; no animation preference feature added. | Large text, light/dark, notification failure, sign out, privacy/account sheets and keyboard focus. |
| Existing secondary grading / reports / sealed / trade surfaces | Apply the same controls, spacing, type and error conventions without promoting held capabilities or adding functionality. Keep stored data and secondary access. | Same sheet lifecycle; no different visual language for secondary features. | Only reachable/authorized surfaces; unavailable capability must not look actionable or claim success. |
| Dialogs, menus, tooltips, toasts, permission and retry states | Shared component treatment, brief actionable copy; important evidence remains accessible without hovering. | Anchored menus, one toast region, stable focus and accessible announcements. | Touch, pointer, keyboard, VoiceOver reading order, rapid dismiss/reopen and no trapped focus. |

## Motion specification

Use one family of easing, proposed `cubic-bezier(.2,.8,.2,1)`, with no overshoot. Reuse existing motion hooks; do not introduce an animation library.

| Event | Proposed duration / movement | Reduced motion |
| --- | --- | --- |
| Press / toggle / selected state | 100–140ms surface change; optional 0.98 press scale on standalone buttons, never entire card grids | Color/outline change only |
| Menu / popover | 140–180ms opacity plus 4px translation from anchor | Opacity only or immediate |
| Sheet open / close | 220–280ms transform/opacity; same direction in reverse; one active modal | Immediate placement or short opacity fade |
| Route navigation | Preserve existing navigation model; 160–200ms limited fade if needed; no blanket page entrance on every return | Immediate |
| Chart first ready paint | 240–320ms maximum, once per entry/data set when appropriate; no waiting for animation to interact | Fully drawn immediately |
| Chart range update | 120–180ms restrained redraw; preserve selected range and axes; no faux price path between unrelated datasets | Immediate redraw |
| Price background update | 120ms crossfade only if value changed; retain previous amount and dimensions until replacement ready | Immediate replacement |
| Save/favorite completion | Brief state or check transition, no confetti | Static success state and announcement |
| Loading | Real indeterminate progress where needed; no shimmer on saved values or fake step timing | Static status text plus actual progress updates |

Animate transform/opacity and specific color properties; remove transition-all and animated layout/blur. Motion never delays input, determines whether a value exists, repeats endlessly as decoration, or carries information without text/state. Use prefers-reduced-motion; do not add the rejected animation settings option. Haptics use an existing supported native path only, if one exists; no new plugin, web vibration dependency or claimed Safari parity.

## Execution order and exit gates

1. **Baseline inventory:** current live route/sheet/state captures and an evidence-linked defect ledger. Include portrait/landscape, both themes, keyboard, zoom and reduced motion. Separate measured defects from proposed taste changes.
2. **Shared foundations:** spacing, color, icons, copy, typography in Unslop order. Establish tokens and simplify conflicting style overrides, preserving existing working behavior. Check all routes before another pass.
3. **Layout and component consistency:** shared rows, controls, headers, sheets, cards and charts; resolve responsive composition and content hierarchy. Test long/empty/loading/error data before moving on.
4. **Motion:** apply the matrix only after static layouts work. Inspect interrupted transitions, repeated navigation and real-device performance. No feature changes.
5. **Whole-app acceptance:** run workflow and accessibility regressions, then visually compare every manifest state. Record any unsupported provider/native coverage instead of declaring perfection. Update the whiteboard only from final captures, under its connector review requirements.

Test widths 320, 375, 393/402, 430/440, 768, 1024 and 1440 CSS px plus representative landscape heights. Include intermediate widths rather than assuming those breakpoints prove all sizes. Check browser text scaling to 200%, reduced motion and keyboard occlusion. Use actual 6.3-inch Simulator captures for native visual evidence; browser emulation is additional coverage, not proof of camera hardware behavior. Physical iPhone acceptance remains Elliott's task.

Release gates: no horizontal overflow; essential touch targets at least 44×44; no clipped content/actions at enlarged text; no focus loss or unrecoverable draft; truthful retained pricing and exact slab contexts; no animation-caused data disappearance; documented passing workflow tests and screenshot comparison in both themes. These are acceptance criteria, not a guarantee of zero possible defects.

## Sources

Apple recommends fitting content to the device, touch-sized controls, readable contrast, undistorted images and clear alignment: [UI Design Dos and Don'ts](https://developer.apple.com/design/tips/).

Apple's guidance supports purposeful, brief, optional and interruptible feedback: [Motion](https://developer.apple.com/design/human-interface-guidelines/motion). Proposed timing values above are Mica-specific.

Scoped modal tasks, clear dismissal and one sheet at a time follow [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets). Adapt text and hierarchy using [Typography](https://developer.apple.com/design/human-interface-guidelines/typography) and [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).

The nine-pass craft process and token starting points adapt **Unslop by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0**: [source](https://github.com/heydamir/unslop). Keep this attribution with adaptations. Touch sizing and accessibility requirements override desktop compact-density examples where they conflict.
