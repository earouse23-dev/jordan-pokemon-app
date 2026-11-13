# Mica whole-app visual polish — 2026-11-13

Owner approved the direction and explicitly limited this work to existing UI/UX. No new features, dependencies, providers, workflows or pricing logic.

## Direction

- Product: a Pokémon collection ledger for tracking cards and their value.
- Character: calm, precise, collectible.
- World: card binders and collection ledgers; retain the Mica logo and sage accent.
- Moments: real card artwork and the main value chart.
- Signature: consistent set/number/finish/grade identity typography.

## Audit and the nine passes

1. **Spacing.** Mixed margins, control padding and row sizing competed across stylesheets. Shared form gaps are 16px; group gaps 24–32px; settings rows 56px; touch actions remain at least 44px. Compact mobile gutters remain 16px, with separately calculated safe-area chart edges.
2. **Color.** Green backgrounds, tinted control layers and colored shadows competed with artwork. Introduced low-saturation light/dark ramps with three text roles; retained sage for selections and charts. Light primary actions use deep green; dark primary actions use a pale neutral. Corrected specific old variants for photo, account and owned-card actions.
3. **Icons.** Kept existing line icons and real Mica mark, normalized navigation/control icon boxes and stroke, and retained larger capture icons where they are the action itself. No icon dependency or new artwork.
4. **Copy.** Replaced the generic greeting with context-specific Portfolio and Sign in to Mica headings. Shortened sign-in supporting copy and password hint; retained decision-relevant uncertainty, identity and pricing evidence.
5. **Type.** Retained native system type. Removed inherited 650–900 weights, CSS uppercase transforms, arbitrary tracking and italic emphasis; used 400/500/600 weights. Figures use tabular numerals. Chart axes now use readable 12px mono labels. Exported condition reports use the same restrained weight ceiling.
6. **Layout.** Retained section order and workflows. Kept fluid app proportions, wide desktop charts, responsive chart height and phone safe-area spacing. Reduced auth form gaps and aligned photo actions with search. Sheets retain scroll and sticky actions.
7. **Details.** Unified 10px control corners, 12–16px cards/panels, 12px grouped range controls, neutral secondary actions and visible focus. Removed duplicate input surfaces inside search/password wrappers. Reports, privacy, filters and recovery sheets retain existing accessible behavior.
8. **Visuals.** Artwork and truthful charts remain the content focus. Removed decorative panel pseudo-elements, raised hover shadows and green account fill. No image generation or fabricated data added to the product.
9. **Motion.** Removed repetitive page fades and raised card hovers; shared feedback transitions use one easing curve. Retained working chart draw animations and actual loading indicators. Reduced motion remains respected.

Guidance adapted from **unslop by Damir Sokolovsky (@heydamir)**, CC BY 4.0: https://heydamir.design/unslop .

## Verification

- Fresh before/after browser renders, not only the old October 30 native captures.
- New `tests/browser/unslop.spec.js` covers Portfolio, Collection, card details, Add cards, Settings, filters and sign-in in both appearances at 320, 390, 430, 667 (landscape), 768, 1024, 1440 and 1920px. Synthetic fixture data and API interception only; no customer writes or paid provider requests.
- Chromium: 41 checks across UI regression, auth/recovery, reports/sheets and the initial visual matrix passed. Final expanded light/dark matrix passed (2 tests, 80 route/width/theme combinations plus filters and auth).
- WebKit: 92 checks passed initially; two radius/height regressions were corrected. Both affected chart tests then passed in Chromium and WebKit (4 checks). Phone-wide layout, theme, keyboard, filter, recovery, grading/report, selected-copy and cache continuity were covered.
- `npm test`: 598 passed, 3 skipped, 0 failed (601 total).
- Lint, syntax, schema and migration-baseline validation passed. Schema/migration checks were read-only; no SQL applied.
- Production theme before this work matched the baseline byte-for-byte. Cache revision and stylesheet versions were updated together.

## Limits

Browser matrix uses fixtures, including an intentional missing-image fallback; it does not establish live card/pricing-provider coverage or physical iPhone camera acceptance. Native installation and Canva whiteboard replacement are outside this visual-only change. Historical CSS remains for legacy paths; this does not claim the whole stylesheet has been structurally rewritten or every possible state is flawless.

## Published result

- Source commit: `f912af6` on the existing `codex/mica-baseline-reconciliation` branch; pushed to the existing repository.
- Production: https://jordan-pokemon-app.vercel.app/
- Deployment: https://vercel.com/earouse23-devs-projects/jordan-pokemon-app/G5mBdkW2fAQ3xPJLBm356GscEjBZ — READY, production.
- Built from an isolated archive of the committed source using the existing `build-release.mjs` workflow. Unrelated workstation edits and generated historical evidence were excluded.
- Prebuilt routing check: 9 functions, existing held-route and owner/auth boundaries retained, no real outbound provider calls. Existing cron configuration copied unchanged.
- Git integration was checked before push: production branch remains `main`; this task pushed the existing working branch and published the reviewed prebuilt artifact directly, without changing the production branch setting.
- Live index, both stylesheets, service worker and app bundle match the verified artifact SHA-256 hashes exactly; see `production-verification.json`.
- Valid unauthenticated card-price, sold-comparison and saved-valuation requests return 401. Health returns 200 / healthy.
