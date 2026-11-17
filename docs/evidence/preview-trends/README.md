# Saved price previews

User request: simplified green/red price-history previews in collection and catalog, followed by a broad improvement brainstorm. The Komp screenshot was used as a functional reference, not its private code or pricing method.

## Implementation

- Collection plus quick/manual catalog search reuse one compact SVG renderer and existing matched history. No new dependency, per-tile Chart.js instance, provider call, database migration or recurring job.
- Window: previous 93 days, labeled 3M. One median per observed day; elapsed dates control horizontal position. Invalid/future dates, missing amounts and other currencies are excluded. A genuine flat series is neutral. Fewer than two observed days produces a dash, not a fabricated line.
- Graded cards reuse the existing exact-sold evidence validator and daily series. Fallback historical observations must be validated exact records and match grader, grade and qualifier. A PSA 10 or OC-qualified series cannot become a PSA 9 preview.
- Raw catalog references are explicitly marked NM (Near Mint). They reuse only matching saved raw Near Mint history or the current owner's preview cache; an owned slab's value is not used for an ungraded catalog reference. Missing catalog coverage remains visible as a quiet dash; this feature does not purchase history for every unseen search result.
- Signed percentages and screen-reader summaries supplement color. Catalog buttons describe the graph through aria-describedby. Collection purchase performance remains separately labeled P/L.
- Returning to quick catalog search rerenders retained results from current saved data without reissuing the query or replacing its selected context. Existing focus preservation is reused.
- Mini charts remain static during scrolling. Existing main-chart animation and reduced-motion behavior are unchanged. Light/dark colors use readable green/red ink rather than neon decoration.

## Verification

- Unit model covers daily median, rise/fall/flat, missing/invalid/future dates, another currency, zero starting value and insufficient history.
- Browser checks cover collection and both catalog surfaces, rising/falling/empty data, a PSA 9 series mixed with rejected PSA 10/OC records, accessible summaries and zero added pricing requests during preview rendering.
- Responsive Chromium/WebKit matrix covers light/dark at 320, 390, 430, 667 landscape, 768, 1024, 1440 and 1920px. Existing search-recovery and pricing evidence checks exercise retained search identity, retries, exact context and 24-hour quote reuse.
- Functional acceptance: 84 browser cases passed. After the saved-search refresh change, all 60 responsive/search cases passed. Final layout subset: 6 passed; final context/accessibility subset: 2 passed. These are overlapping targeted checks, not a claim of unique test counts or universal provider coverage.
- Unit suite: 613 passed, 3 skipped. Lint: 101 source files. Syntax checks passed. Publication/live verification is recorded below.

The complete brainstorm is in `docs/MICA_NEXT_POLISH_IDEAS.md`. Those proposals are not implemented by this task. Actual provider coverage and physical camera acceptance remain independent from the mini-chart UI.

## Publication and live checks

- Source commit `b2ab895`, pushed to `codex/mica-baseline-reconciliation`. Final production deployment `dpl_DNVXQ2m3mbbXsPooJC15J1dQqHVu`, READY, alias https://jordan-pokemon-app.vercel.app/. Shell cache `mica-shell-design-149`.
- Isolated Git-archive release/routing checks passed: 9 functions, 64 deployment entries and zero real outbound provider calls during routing verification. Existing production Git branch remains main; this reviewed prebuilt release was published explicitly. Existing two cron schedules and provider budgets were unchanged.
- Production HTML/JS/CSS/service-worker hashes match the artifact. Health is healthy; unauthenticated card pricing, sales, graded valuation and portfolio requests return 401. See `production-verification.json`.
- Live demo collection: 14 entries, 13 genuine saved trend plots (12 down, 1 up), 1 insufficient-history placeholder. Phone width 390px had zero horizontal overflow. Actual PSA 9 preview described the saved Aug 24–Nov 5 series rather than borrowing raw/other-grade prices.
- Live catalog: Mew ex 151/165 Holofoil initially had no saved reference. Opening its existing detail workflow loaded its NM reference; returning to retained search results then showed the saved -12.7% trend. Non-holo stayed a dash. No inventory save or forced historical recheck was used to populate the preview. Search context remained intact.
- Real light/dark phone and desktop captures remain in ignored `benchmarks/private/preview-trends/`. Browser theme was restored to System and temporary viewport sizing was reset. Customer inventory was not edited.
- Native Xcode build passed and contains the reviewed preview stylesheet. Simulator installation was not completed because the selected iPhone 17 device was shut down. No full native touch or physical camera acceptance is claimed by this task.
- The brainstorm document is a proposal inventory only; none of its additional feature/workflow suggestions was implemented in this release.
