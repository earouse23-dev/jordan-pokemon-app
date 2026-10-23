# Concise interface copy — 2026-10-22

Source: a1646c9842b85bb016694b83d7606c326aa9ff72.

## Shipped scope

- Card and raw/sealed history: one Price history heading; change amount without repeated period caption; tooltip contains one amount and one date.
- Root cause: nearest chart hover can return a trend point and an individual sale at the same location. Tooltip filtering now chooses the trend when overlapping, or the individual sale when it is the only nearest observation. Original dots, dated sale records, daily medians and evidence remain intact.
- Price hero: date appears once on the eBay link, amount once in the headline. Removed prominent verification/sample-size prose; the estimate label, source, older-price state and missing/mismatched identity states remain truthful. Verification and confidence remain inside Price details.
- Dashboard: removed repeated section kickers and shortened the total P/L caption.
- Add/search: removed repeated pre-search instructions and photo confirmation copy; shortened empty/retry guidance and unopened-product instructions.
- Collection: concise empty/filter guidance. Item identity, edition, grader, grade and counts are preserved.
- Notifications: direct Enable alerts / In Mica options without explanatory subtitles. Advanced controls remain available.
- Shortened detail disclosure subtitles and estimate footer. No pricing algorithm, API schedule, database schema, ownership or cache changes. Shell cache version 116 delivers the updated interface.

## Verification

- Lint, syntax/type checks and diff whitespace check passed.
- Unit tests: 590 passed, 3 existing skips.
- Broad browser run: 270 passed, 9 optional/established skips across add/save recovery, card profile/settings, native integration, price evidence and search recovery.
- Final source recheck: 36 passed across desktop Chromium, mobile Chromium and mobile WebKit. Includes overlapping tooltip selection, single-date/amount labels, one saved evidence request on reopen, search recovery, light/dark main screens and 375px phone layout.
- Sealed-product browser flows: 60 passed, 3 existing skips; USD/EUR history, saved product reuse, retry and owner isolation retained.
- Phone fixture screenshots reviewed: add, collection, settings and detail. Fixtures are explicitly labeled; they do not establish physical-device camera acceptance.
- Release build/routing: 99 source entries, 64 deployment entries, 9 functions; cron/provider behavior unchanged. Release source inventory contains no uncommitted source changes. Unrelated documentation and private recovery files excluded.

## Publication and live acceptance

- Staged production: https://jordan-pokemon-hqlrxpxr6-earouse23-devs-projects.vercel.app
- Canonical: https://jordan-pokemon-app.vercel.app/
- Staged and canonical health returned healthy, release a1646c9842b8.
- Protected staged /app.js matched built SHA-256 9229a07a1e583d825e8ba047a4af1aa39820add34643f97b2c1b66d79a7dc2ef.
- Protected staged / root HTML matched SHA-256 13910df76626242c7bd97d0019ac9f63bc2ce61425ad968b906bc989bc836167.
- Actual live browser confirmed short source button, one Price history heading, no period/median subtitle, price-and-date-only hover, concise Add screen and notification options. Customer inventory/settings were not edited; no manual provider refresh or historical download was triggered for this copy task.
- Published screenshots show the real market context. Phone screenshots use synthetic fixture records, not customer emails or private records.
