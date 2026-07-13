# QA report

Verified 2026-07-12 in the local workspace.

```bash
npm test
npm run test:schema
npm run typecheck
npm run lint
npm run build
```

Results: 16/16 unit tests passed; the schema validator confirmed 37/37 public tables have RLS; JavaScript and Deno checks passed; custom source lint passed across 13 files; production bundle built successfully to `dist/`. Pricing tests cover normalization, currency/finish/condition/grade compatibility, preferred price selection, history deduplication, server-only key forwarding, normalized output, cache headers, and explicit sold-provider entitlement failures.

The dedicated Supabase project now has seven versioned migrations, 37 public tables with RLS, version 2 of the active JWT-protected catalog Edge Function, an active Vault-backed dispatcher cron, and an active hourly price-metric cron job. A proposed custom-token dispatcher was not deployed because changing the platform JWT boundary was not authorized; the follow-up migration restores the original JWT dispatcher. Ten language targets remain pending while the service-role JWT is absent. The supplied PkmnPrices key passed catalog search, while its sold-listing endpoint returned a verified Pro-plan requirement.

The failing Vercel deployment was traced to `STATIC_BUILD_NO_OUT_DIR`: the project expected `public/` while the build emits `dist/`. Repository-owned `vercel.json` now sets the build command and output directory explicitly.

The first attempt to use the default Node test runner was blocked by sandbox process-spawn permissions (`EPERM`). The identical `node:test` cases were then run in-process with `node tests/core.test.js` and all passed. On this Windows host, use `npm.cmd` if PowerShell execution policy blocks `npm.ps1`.

Current discovery-flow QA passed at 390×844 and 320×700 with no horizontal overflow or app error overlay. The verified journey was Library → Add card → search Greninja → exact result → value-first card page → Add to Library → default Near Mint copy saved. The quick-add form requires only quantity and condition; purchase and storage details are optional. One console message originated from the Chrome extension on a prior page, not from app code.

Not browser-automated: native camera/file chooser upload, download confirmation, physical-device permissions, screen-reader speech, and a connected provider outage. Those remain device/infrastructure checks.

Not yet executable end to end: protected full catalog backfill (requires an authorized service-role JWT in Vault), licensed sold-data ingestion, cross-user RLS integration with test identities, Auth/OAuth, private signed upload, Gemini identification, scheduled cleanup, provider outage integration, and production monitoring.
