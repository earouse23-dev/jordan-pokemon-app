# Mica brainstorm execution checklist

Owner now authorizes completing the full `MICA_NEXT_POLISH_IDEAS.md` follow-up. Existing spend/dependency/platform, customer-data and physical-device boundaries remain. A proposal is complete only when its benefit is implemented or existing behavior is verified; unsupported capabilities and unavailable evidence remain open.

Design direction: a collector's working library; calm, exact, tactile; quiet warm neutrals around real card/slab imagery; portfolio and exact card value as the main visual moments; consistent grading-context labels and restrained 3M trends as the signature. Preserve the current Mica brand, typography and semantic chart colors. No decorative new destinations.

| ID | Acceptance item | Current state / evidence |
|---|---|---|
| B01 | Original slab photo → correct context → save once → cold reopen | Recognition fixes shipped; live hosted disposable-owner write/reopen still open |
| B02 | Saved-first cold/warm/offline pricing; 24h TTL; concurrent tabs | Verified pricing-reliability evidence; rerun in final demo suite |
| B03 | Exact comp identity/URL, corrections vs timeout, sparse history | Existing pricing/source tests; provider coverage cases remain open |
| B04 | Collection filter/sort/search/scroll/focus survives detail and background updates | Implemented stable row controls for price/photo updates; focus, in-progress press, filters, sort and scroll regressions pass |
| B05 | Physical camera permission/cancel/background/repeat/low-light | Owner response requested; cannot certify with desktop fixtures |
| B06 | Add/edit/lot/sale/import/save interruption and idempotent recovery | Add/edit/lot/sale/import and native interruption suites mapped and verified; final combined run in progress |
| B07 | Duplicate certificate recovery, no destructive deduplication | Verified existing server uniqueness + inline open-existing recovery; draft and leading-zero certificate retained; one write |
| B08 | Cache-only catalog reference trend coverage, no paid tile fanout | Implemented public cache-only batch summaries, exact raw NM printing/language/currency; no provider calls/writes or owner data |
| B09 | Cold/warm timing and input responsiveness measured honestly | Measured local saved-value restore 5–8ms; paint-ready 20–32ms with network blocked; see evidence/brainstorm-completion/local-performance.json |
| B10 | 1,000-copy paging/render profile and unnecessary work removed | Verified 1,000 distinct copies, 100 DOM rows, 900 remaining, retained focus and no provider fanout; measured render below 200ms in local browsers |
| B11 | Resume history backfills without renewing price TTL/downloading again | Verified resumed cursors/checkpoints, missing-days updates, retained evidence and rolling TTL in unit suite |
| B12 | Prefer actual saved slab photo, authorized owner-only source, artwork fallback | Implemented batched private identification-photo access; short-lived memory-only URLs; owner reset and failed-source artwork fallback verified |
| B13 | 3M market trend remains separate from purchase P/L | Shipped; final responsive/a11y check pending |
| B14 | Touch chart inspection, date/value labels and dismissal | Verified actual mobile taps and outside dismissal; original date/value data retained; keyboard Escape cleanup supported |
| B15 | Shared identity hierarchy, concise errors/copy | Reviewed shared identity hierarchy and copy; phone identity/photo/value layout compacted; primary screens stay concise |
| B16 | Empty/filtered/zero/sold/unknown date/image/huge value/long language/FX states | Verified empty/filtered, zero/unknown cost/date, sold/FX/image fallbacks and very large value/long international identity fixtures |
| B17 | Currency/date defaults and no inherited cert/grade | Verified current date/currency defaults, unknown/free cost, new printing/cert context and stable retries |
| B18 | Rapid add context, keyboard/rotation/enlarged text | Browser/native fixture queue, interrupted form, rotation/large-text checks pass; physical software-keyboard acceptance remains in B05 |
| B19 | Screen reader names and workflow focus; real assistive technology | Fixture AX checks pending; physical acceptance open |
| B20 | Press/sheet/navigation motion consistent and interruptible | Existing shared brief press/sheet motion retained; pointer press survives background updates; native/background interruption fixtures pass |
| B21 | Subtle actual-price replacement feedback, no fake counting | Implemented 320ms value-only emphasis on actual collection/portfolio replacements; no synthetic values, focus loss or Reduce Motion animation |
| B22 | Chart first draw vs range transitions preserve context | Implemented first-context reveal; range/background changes do not replay intro. Reduce Motion and unchanged observations verified |
| B23 | Native completion haptic if existing capability permits | Conditional proposal not applicable: existing native bridge/plugins have no haptic capability. No new dependency/platform action added |
| B24 | Reduced Motion everywhere, equivalent feedback | Verified first-draw, range, controls/dialog/sheet and actual price replacement paths with Reduce Motion |
| B25 | Two-owner cache/photo/logout/recovery isolation | Verified two-owner price/cache/draft guards; added private-photo owner filters, signing-path checks and logout DOM cleanup |
| B26 | Held integrations stay honest and secondary | Verified held grading fails closed, saved reports remain accessible; OCR remains distinct from official authentication |
| B27 | Repeatable full demo script: sizes/themes/loading/interrupted save | Pending |
| B28 | Provider data gaps: Ninetales recent attribution, Charizard archive, Topps metadata | Concrete report prepared; permission to reply to existing support thread requested |

Execution order: workflow/data continuity → saved imagery and catalog efficiency → responsive/a11y/copy → motion/performance → complete repeatable demo/security checks. Provider and owner-device requests proceed while independent engineering continues. Never mark their external acceptance passed merely because local tests pass.


## Verified engineering changes

- Retain collection controls and loaded/fallback image nodes across price/photo paints and value reordering. Defer a live resort until a pressed card has opened. Preserve focus and the saved view.
- Carry fresh exact preview evidence through save. A never-priced slab still receives its targeted durable check; unrelated inventory remains untouched.
- Read private identification-photo metadata per visible page (up to 100 IDs), then sign eligible owner paths in a batch. URLs last five minutes, remain memory/DOM only, and are scrubbed on logout. Artwork remains the fallback. Receipts and other attachments never become card images.
- Enrich public catalog previews with bounded cache-only raw Near Mint USD reference summaries. Reuse the existing canonical identity and printing matching. No provider credit claims, cache writes or private inventory reads are allowed on this path. A 750ms optional-read deadline preserves search recovery.
- Compact phone card identity/image/value layout; remove empty secondary portfolio summaries before the first card.
- Keep first chart draw separate from range/background changes; dismiss an inspected chart by tapping outside or Escape. Price replacement emphasis lasts 320ms and is disabled by Reduce Motion. No intermediate amounts are invented.

No new production dependencies, migrations, provider budgets or platform integrations were added. Existing native plugins do not expose haptics, so that conditional suggestion was not turned into a new dependency.

## Repeatable acceptance commands

Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run test:schema`. The full browser selection is: add-save-recovery, saved-change-recovery, detail-recovery, search-recovery, intake-continuity, physical-copies, collection-continuity, collector-home, price-evidence, portfolio-history, unslop, whiteboard-polish, native-integration and import-recovery, across desktop Chromium, mobile Chromium and mobile WebKit. Use a separate output directory per run.

The combined run passed 611 browser cases, with seven explicit environment/disposable-database skips. Later focused checks cover the final fallback-image/reorder and empty-portfolio corrections. The unit suite passes 623 checks with three explicit environment skips. Schema validation reports 83 public tables with RLS enabled. These results are engineering evidence, not a claim of physical-camera, assistive-technology, data-license or commercial-release certification.

The 1,000-copy fixture holds 1,000 distinct items, renders 100 rows, offers the remaining 900 through existing paging, keeps focus, and makes no provider requests. Local render and warm repaint samples were below 25ms; measurements are not claims about an iPhone's CPU or real-world network latency.
