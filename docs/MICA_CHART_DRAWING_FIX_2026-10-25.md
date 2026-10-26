# Chart drawing restoration — October 25, 2026

Source: `64c9d2a670aa48cfdf5c927e35aa5e0ecc259a79`.

The live portfolio still rendered its saved values, but both chart constructors set Chart.js animation to false and no reveal animation remained. This was a presentation regression, not missing pricing records.

One shared Chart.js plugin reveals plotted datasets left to right over 850ms. Axes and labels stay fixed. It uses the rendered data already in memory, preserves dates, amounts, median values and gaps, and makes no data/API requests. Normal Chart.js value tweening stays disabled. Resize and hover do not restart the reveal; chart destruction cancels pending frames. Operating-system Reduce Motion and preserved reduced-motion preferences show the complete plot immediately. The service-worker shell advances to `mica-shell-design-126` for safe existing-tab adoption.

Focused Chromium desktop/mobile and WebKit mobile checks cover both chart types and reduced motion, with a controlled clock to verify intermediate and completed reveal states. Broader history, profile and dashboard regressions and publication evidence are recorded in [verification](evidence/chart-drawing-2026-10-25/verification.json). No provider, database, cache-retention, budget, dependency or cron change is included.

Published after the independent [beta gate](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/40265783522) passed. Canonical health confirms `64c9d2a670aa`. Read-only live browser inspection captured partial and completed drawings for both the portfolio and Umbreon card charts. Restored both ranges to All time and returned to the dashboard. Customer inventory and preferences were not edited.

Local verification: 595 unit checks passed, 6 focused animation checks passed. The broader dashboard/profile/history run passed 276 checks and skipped 9, with 3 timeouts from an outdated advanced-filter test workflow introduced by the earlier filter simplification; opening More filters resolved all 3 on recheck. The test now follows that visible workflow. This fixture repair does not change the published application bundle.
