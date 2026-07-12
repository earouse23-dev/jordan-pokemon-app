# QA report

Verified 2026-07-12 in the local workspace.

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Results: 5/5 unit tests passed; JavaScript syntax checks passed; custom source lint passed across 6 files; production bundle built successfully to `dist/`.

The first attempt to use the default Node test runner was blocked by sandbox process-spawn permissions (`EPERM`). The identical `node:test` cases were then run in-process with `node tests/core.test.js` and all passed. On this Windows host, use `npm.cmd` if PowerShell execution policy blocks `npm.ps1`.

Browser QA passed at 390×844 and 320×700: meaningful content, 6 seeded records, no framework error overlay, no console errors, and no horizontal overflow. Collection summary math rendered as $3,323.42 value, $1,938.75 cost, +$1,384.67 unrealized, 10 owned, and 1 unpriced excluded. Detail showed two distinct demo source/currency rows and explicit unavailable sales history. Edit dialog exposed 9 ownership inputs with existing values. Unpriced filtering returned only Espeon. Scan view exposed camera, library, privacy, and manual fallback; manual “Charizard” search returned two exact-printing candidates.

Not browser-automated: native camera/file chooser upload, download confirmation, physical-device permissions, screen-reader speech, and a connected provider outage. Those remain device/infrastructure checks.

Not executable without infrastructure: Supabase migration/advisors, RLS cross-user integration, Auth/OAuth, private signed upload, live adapters, Gemini identification, scheduled cleanup, provider outage integration, and production monitoring.
