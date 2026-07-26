# QA report

Verified 2026-07-25 in the local workspace and against the connected Supabase
project.

```bash
npm test
npm run test:schema
npm run typecheck
npm run lint
npm run build
npm run test:browser
npm audit
git diff --check
```

Current automated result: 186/186 tests passed, JavaScript syntax checks
passed, custom source lint passed across 40 files, 47 unique public tables were
found with RLS enabled on every table, both browser projects passed, dependency
audits found zero vulnerabilities, and the production bundle built successfully
to `dist/`.

Coverage includes exact card/variant matching, raw/graded/sealed price boundaries, provider normalization, history, sold evidence and offers, FIFO purchases and sales, unknown cost basis, trades, grading decisions and submissions, watch targets, camera/AI request safety, CSV imports and exports, large-collection paging, ownership checks, account deletion, scheduled pricing, accessibility source rules, offline boundaries, and deployment configuration. A regression test now proves that an unrelated card sharing `151/165` is labeled a number-only alternative rather than a strong match.

Connected Supabase verification found 47 of 47 public tables with RLS enabled,
108,548 catalog cards across 1,016 sets, zero ownerless collection items, and
zero ownership mismatches in purchase or sale joins. Tables intentionally
reserved for service-only operations have RLS with no client policy. The
authenticated `claim_vision_usage` and `claim_advisor_usage` security-definer
RPCs are intentional: each derives the owner from `auth.uid()`, bounds caller
inputs, serializes claims per owner, and grants no access to another account.

Browser QA uses the production bundle at 390×844 and 1440×1000. It covers both
themes, guided/growth/pro workspaces, five primary routes, signed-out access,
minimum text size, mobile touch targets, semantic collection filters, and
horizontal containment across 60 rendered states. Separate Axe scans cover the
signed-out and authenticated shells. Native camera permission still requires a
real camera-equipped browser/device; the browser automation environment has no
camera hardware.

Deployment truth boundaries remain explicit. PkmnPrices Pro-only data is never invented; AI analysis reports its Gateway setup state; push alerts are labeled developer mode until native/web push infrastructure is approved; the installed shell opens offline but private collection data is not stored as a readable offline copy. Public launch still requires the owner to approve final legal entity/jurisdiction/support language and enable Supabase leaked-password protection if password sign-in remains available.
