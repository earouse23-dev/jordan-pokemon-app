# Light/dark audit corrections — October 26, 2026

Correction packet for the five findings in `MICA_LIGHT_DARK_SIZE_AUDIT_2026-10-26.md`. Application source: `b82f5f1a94fcf2faaf03758c7b62deaf5461dc71`. An earlier test-only correction resets the synthetic selected valuation context before switching a fixture from raw to graded; application artifacts are unchanged by it.

## Changes

1. **Tablet header:** the 760–1023px shell now reserves the floating header's own row. Dashboard actions remain below it. Desktop keeps its compact floating pill; phone and tablet keep the floating appearance.
2. **Chart controls:** card and saved-portfolio timeframe controls appear above their plots. Card title and period change share a compact row with the 44px range control, avoiding a second header row. The card selector retains its accessible label, value, focus after range changes and empty-history behavior. Chart dimensions and the existing reveal/reduced-motion behavior are preserved.
3. **Contrast:** result counts, older/missing-price labels, detail estimate copy, count badges and Portfolio details use the appropriate light/dark text tokens. The targeted rendered checks require at least 4.5:1 against composited backgrounds.
4. **Dates:** daily histories spanning one to seven days use UTC day-sized ticks. Short intraday histories keep hour labels. Original record timestamps and amounts are unchanged; no points are fabricated.
5. **Touch targets:** Market reference and Price options get 44px disclosure rows with a visible disclosure cue. Copy actions have a 44px minimum width as well as height.

## Verification and publication

Published to https://jordan-pokemon-app.vercel.app/ as release `b82f5f1a94fc`. Final checks: **595 unit passed / 3 skipped; 783 browser passed / 21 skipped; zero failures or flaky passes**. The independent [GitHub gate](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/40426083066) passed 406 workflow browser checks and three large-inventory checks, with 11 intentional skips. Lint, syntax checks, schema baseline and release-routing checks also passed.

Live checks confirmed unblocked dashboard actions across the tablet boundaries in both appearances. At 390×844, the 44px range selector starts at y374, clear of the toolbar at y774; the chart is 374px wide with 8px gutters. Both range selectors work, card range changes retain focus, and the optional disclosure rows are 44px tall. The normal 1710×929 viewport and System appearance were restored. Public header crops and geometry are saved alongside the verification JSON; full customer-detail captures remain outside the repository.

See `evidence/audit-corrections-2026-10-26/verification.json` for final results and the published release. Regression coverage includes both appearances, widths 320–1920px, the 759/760 and 1023/1024 boundaries, short landscape, range/focus behavior, short date-series boundaries and unchanged chart timestamps. Existing workflow suites cover the wider application; these focused tests do not claim exhaustive accessibility certification or physical iPhone acceptance.

No schema, provider budgets, dependency, cron schedule, customer inventory or database preference was changed. Grading and other existing release holds remain. Physical device capture and the previously deferred public signup/legal/store qualifications remain separate milestones.

## Separate live observation

Before promotion, the previous canonical release displayed “Update incomplete” for its daily saved-portfolio refresh while retaining the October 26 value. This UI packet does not change the pricing/refresh pipeline and does not qualify unattended next-day completion. The preserved value is evidence against a blanking regression, not proof that the new day's refresh completed. During final live verification, the active portfolio completed its October 27 update and cleared the warning. A final read-only aggregate found 0 incomplete views and 1 current-day view out of 2 saved views. This is observed recovery with values preserved, not a claim that all accounts or unattended future refreshes have been qualified.
