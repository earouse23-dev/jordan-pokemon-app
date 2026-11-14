# Saved prices and slab identification — 2026-11-13

## Shipped behavior

- Restore the owner-scoped saved prices before rendering newly hydrated inventory. A matching local snapshot renders without waiting for the network; otherwise the existing bounded saved-view read completes before the final inventory render.
- Normalize equivalent raw-condition representations in pricing keys while retaining separate condition, currency, grade, qualifier, printing and card identity boundaries. Store the input/resolved keys on successful detail pricing so a changed condition cannot reuse the previous context's TTL.
- Read full card history and graded evidence from the saved database view when opening a compact cached card, before considering provider refresh. This prevents price-cache reuse from leaving the chart empty.
- Retain last successful matching raw prices in collection, detail and totals during stale/error/empty updates. Compact display snapshots retain this behavior. Older asynchronous responses cannot roll a newer price back.
- Empty/failed server refreshes do not mark an old price newly checked. Existing leases, provider caching, atomic portfolio publication and retry backoff remain. Successful replacements are published to the saved view; history is not deleted at the 24-hour freshness boundary.
- Preserve explicit upstream withdrawals/regrades: a known incorrect comp is removed rather than retained as a valid fallback.
- Send the existing slab evidence collage (whole slab, enlarged label and card) to identification in one image/request. Preserve edition, finish, promotion, grader, half-grade, qualifier and leading-zero certificate through recognition, detail, catalog fallback and save-form handoff.
- Filter known Pristine/Black Label tiers upstream, retain local exact matching and leave legacy ordinary labels unfiltered upstream. Correction polling stays unfiltered so reclassified rows can invalidate old evidence.

## Verification

- Node suite: 602 passed, 3 skipped, 0 failed (605 total).
- Lint and syntax checks passed.
- Server regressions cover expired raw price + empty response, unchanged successful-check timestamp/history, durable later replacement and zero provider work on fresh repeat reads. Existing graded empty-response retention and official withdrawal tests pass.
- Browser regressions cover compact/normalized cold-price restore, empty updates, failed refreshes, repeat detail opens, condition/owner changes, and CGC 8.5 / CGC Pristine / BGS Black Label / unreadable label qualifier scan-to-save handoff. The scan tests assert one identification request containing a 1536×1024 evidence image.
- Full relevant Chromium/mobile-WebKit matrix: 297 passed, 5 skipped, 0 failed (302 total), excluding the separately established existing mobile chart placement assertion below. Follow-up owner/context, full saved-history and withdrawal-publication checks: 8 passed. Final rendered screenshot checks: 4 passed; label disclosure capture: 2 passed.
- Rendered evidence: desktop/mobile saved price-history and CGC Pristine save-form captures in this directory. Synthetic card images intentionally exercise the missing-image fallback.
- Production receipt is recorded after publication below.

## Limits and isolated existing finding

No schema migration, new dependency or paid service. No customer records were modified by tests; providers and writes use isolated fixtures. Real camera/label recognition across arbitrary photographs and provider coverage are not certified by synthetic tests. Missing first-ever evidence is not fabricated; retained prices require a matching saved price, and officially withdrawn evidence is invalidated.

The broad browser run found an existing mobile chart placement assertion (chart top must be below 520px on a 375×667 viewport). It also fails with the original pre-task app source and current styles; the chart is lower than that bound. The current pricing changes do not change layout/CSS. This assertion is isolated from the pricing regression matrix and remains a separate layout follow-up. The older slab pixels assertion was updated to verify the intended single-image collage and still checks both label/card pixels.

## Publication

- Source: `93fba3a`, pushed to the existing `codex/mica-baseline-reconciliation` branch.
- Production: https://jordan-pokemon-app.vercel.app/
- Deployment: https://vercel.com/earouse23-devs-projects/jordan-pokemon-app/P3hLKHrxm5NGztb4tMCbJWbjfWg9 — READY / production.
- Built from an isolated archive of the source commit using the existing prebuilt release workflow. Unrelated working-tree changes were excluded.
- Routing verification: 9 functions; held-route, origin, authentication and independent deletion checks passed; zero real outbound provider calls.
- Production Git branch remains `main`; source was pushed to the existing working branch, then the verified prebuilt artifact was published directly. Existing cron schedules and provider budgets are unchanged.
- Live index, app bundle, service worker and stylesheets match the verified artifact SHA-256 hashes. Health is 200 / healthy; unauthenticated card pricing, sales, graded valuation and saved portfolio endpoints return 401. See `production-verification.json`.
- No migration, new dependency, native/store submission or customer write test was performed. A first-ever missing matching price is still shown honestly; it is not fabricated from an unrelated listing.
