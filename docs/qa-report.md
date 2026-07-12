# QA report

Verified 2026-07-12 in the local workspace.

```bash
npm test
npm run test:schema
npm run typecheck
npm run lint
npm run build
```

Results: 5/5 unit tests passed; the schema validator confirmed 30/30 public tables have RLS; JavaScript syntax checks passed; custom source lint passed across 6 files; production bundle built successfully to `dist/`.

The dedicated Supabase project was empty before setup. The launch schema was applied transactionally and verified at 30 public tables, 30 RLS-enabled tables, and 26 policies. Supabase security advisors report only four informational default-deny notices for server-only operational tables; performance advisors report no missing foreign-key indexes. New indexes are expected to appear as unused until production queries exercise them.

The failing Vercel deployment was traced to `STATIC_BUILD_NO_OUT_DIR`: the project expected `public/` while the build emits `dist/`. Repository-owned `vercel.json` now sets the build command and output directory explicitly.

The first attempt to use the default Node test runner was blocked by sandbox process-spawn permissions (`EPERM`). The identical `node:test` cases were then run in-process with `node tests/core.test.js` and all passed. On this Windows host, use `npm.cmd` if PowerShell execution policy blocks `npm.ps1`.

Browser QA passed at 390×844 and 320×700: meaningful content, 6 seeded records, no framework error overlay, no console errors, and no horizontal overflow. Collection summary math rendered as $3,323.42 value, $1,938.75 cost, +$1,384.67 unrealized, 10 owned, and 1 unpriced excluded. Detail showed two distinct demo source/currency rows and explicit unavailable sales history. Edit dialog exposed 9 ownership inputs with existing values. Unpriced filtering returned only Espeon. Scan view exposed camera, library, privacy, and manual fallback; manual “Charizard” search returned two exact-printing candidates.

Not browser-automated: native camera/file chooser upload, download confirmation, physical-device permissions, screen-reader speech, and a connected provider outage. Those remain device/infrastructure checks.

Not yet executable end to end: cross-user RLS integration with test identities, Auth/OAuth, private signed upload, live adapters, Gemini identification, scheduled cleanup, provider outage integration, and production monitoring.
