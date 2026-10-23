# Solid chart lines — 2026-10-23

- Owner request: remove dashed chart lines. Removed segment dash styling from card median and portfolio charts. Updated optional history explanation and portfolio purchase-estimate notice to match. Real missing-value gaps, saved observations, purchase-estimate metadata/tooltips, median calculations, provider requests and history retention are unchanged.
- Source 1fc916b521cebffd3ea751bea0f66f943729895f; shell cache 120.
- 80 focused history/security tests passed; six desktop Chromium/mobile Chromium/mobile WebKit tests passed for solid card and estimated portfolio lines, saved data reuse and original values. Lint and syntax checks passed. Release build/routing passed (nine functions). Existing cron/provider controls and Git-triggered deployment setting unchanged.
- Published to the existing Vercel project: https://jordan-pokemon-iok27am9g-earouse23-devs-projects.vercel.app (dpl_Hwic4qs3WTfk5gCEisTpd5YdAS2W). Staged and canonical health healthy, release 1fc916b521ce. Served app SHA-256 matches artifact: 0635ad6afb7d865a1dcf40c59b2cf06a072a86171350c64ce29817b9d36a3a48.
- Live browser confirmed the solid median line and preserved saved $3,763 quote. Screenshot published.png. No inventory/settings edits or forced price refresh.
