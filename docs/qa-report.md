# QA report

Verified 2026-07-22 in the local workspace and against the connected Supabase project.

```bash
npm test
npm run test:schema
npm run typecheck
npm run lint
npm run build
git diff --check
```

Current automated result: 162/162 tests passed, JavaScript syntax checks passed, custom source lint passed across 24 files, 47 unique public tables were found with RLS enabled on every table, and the production bundle built successfully to `dist/`.

Coverage includes exact card/variant matching, raw/graded/sealed price boundaries, provider normalization, history, sold evidence and offers, FIFO purchases and sales, unknown cost basis, trades, grading decisions and submissions, watch targets, camera/AI request safety, CSV imports and exports, large-collection paging, ownership checks, account deletion, scheduled pricing, accessibility source rules, offline boundaries, and deployment configuration. A regression test now proves that an unrelated card sharing `151/165` is labeled a number-only alternative rather than a strong match.

Connected Supabase verification found 47 of 47 public tables with RLS enabled, two distinct portfolio owners, zero ownership mismatches between collection items and their transactions, and owner policies on the active portfolio tables. Five foreign-key indexes recommended by the performance advisor were added through migration `20260722143000_cover_foreign_key_indexes.sql`. Tables intentionally reserved for service-only operations have RLS with no client policy. The authenticated `claim_vision_usage` security-definer RPC is intentional: it derives the owner from `auth.uid()`, bounds both caller inputs, serializes claims per owner, and grants no access to another account.

Browser QA uses the production bundle at 390×844 and 1280×800. It covers signed-out login, password visibility, legal dialogs, authenticated showcase login, dashboard history, mobile Home/Library navigation, collection tabs and counts, add/search/photo entry points, card details, progressive decision tools, saved fee defaults, sale-calculator reactivity, Market, Trade Check, Settings connection status, no horizontal overflow, top-of-route positioning, browser errors, and console errors. Native camera permission still requires a real camera-equipped browser/device; the browser automation environment has no camera hardware.

Deployment truth boundaries remain explicit. PkmnPrices Pro-only data is never invented; AI analysis reports its Gateway setup state; push alerts are labeled developer mode until native/web push infrastructure is approved; the installed shell opens offline but private collection data is not stored as a readable offline copy. Public launch still requires the owner to approve final legal entity/jurisdiction/support language and enable Supabase leaked-password protection if password sign-in remains available.
