# Median-only card chart — 2026-10-22

Owner request: remove individual-sale dots and show only the median price on the graph.

- Removed the scatter dataset. The single line contains the existing saved UTC daily medians; hover shows that day's median and date.
- Plot bounds now use only plotted median values, not hidden individual-sale extremes. The line has no persistent markers for a multi-day history.
- Original reported sales remain in the dated table and source evidence. No pricing algorithm, headline price, history storage, provider query, cache window or schema change. Sparse-date dashed connections remain documented in Details.
- Removed obsolete overlapping-series tooltip filtering. Shell cache version 118.
- Lint/syntax and whitespace checks passed; 79 focused history/security unit tests passed.
- Twelve desktop/mobile Chromium/WebKit checks passed for median series, original evidence rows, cache reuse and delayed invalid responses. Final median visual/scale checks passed across all three browsers after the axis adjustment; retained public fixture still contains 117 original sales and 51 daily medians. No live provider downloads for testing.
- Source commit: 6ed8748c212a17c145f41a3938548236605043b3.
- Existing project deployed with nine functions and unchanged cron/provider controls; build and release routing verified.
- Staged deployment: https://jordan-pokemon-qvbimt2p1-earouse23-devs-projects.vercel.app (`dpl_5pU9BQqMSBNrUDEiBxmzD8dFrbZn`).
- Served app SHA-256 matches prebuilt output: d00bfb92af580159a0bbb075da8fec0eca7bf672938eb8333e9bd2b9503fc367.
- Staged and canonical health healthy, release 6ed8748c212a; promoted to https://jordan-pokemon-app.vercel.app/.
- Live browser reopened the saved Umbreon context and visually confirmed only the median line, no individual-sale dots. `published.png` captures the actual published chart. No inventory/settings writes or manual sales refresh.
