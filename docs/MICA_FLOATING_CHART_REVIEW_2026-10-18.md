# Floating header and investment-style histories

Owner request: keep critiquing the interface, make the top bar float, improve both portfolio and card-history charts. Scope is presentation; provider ingestion, valuation math, ownership dates, persistent history and refresh budgets are unchanged.

Implemented:
- Floating, translucent rounded header. Desktop screen titles share its vertical space instead of following a full-width navigation band. Mobile header respects safe areas, with 44px action targets and reserved initial content clearance.
- Shared chart inspection crosshair and subtle gradient; straight segments between recorded values, quiet four-tick axes, right-aligned currency labels and exact value/date tooltips. Recorded date spacing and missing-value semantics are preserved.
- Portfolio bounds fit observed values with a small margin instead of forcing every nonzero portfolio to start at zero. Explicit top bounds avoid tick rounding creating large unused space. Value mode stays nonnegative; P/L retains negative values.
- Card history displays the selected period's recorded price change before its chart. The detailed evidence table remains available; timeframe selectors remain below the chart and portfolio P/L keeps its independent range.
- Removed redundant post-render DOM rearrangement that moved the new summary below the chart. Kept empty-history and currency-error recovery paths.

Review corrections: initial automatic y-axis rounding expanded a €206 sample to €400; corrected explicit bounds. Initial compact header reduced two tap targets to 40px; restored 44px without weakening the existing viewport audit. These were caught before publication.

Uses existing CSS, native controls and installed Chart.js; no production dependencies, platform changes, paid services, provider jobs or SQL changes.

References consulted: [Chart.js linear axes](https://www.chartjs.org/docs/latest/axes/cartesian/linear.html) for explicit bounds/grace, and [interaction options](https://www.chartjs.org/docs/latest/configuration/interactions.html) for nearest-date inspection. This is a presentation adaptation, not a claim that card sale history has stock-market liquidity or daily coverage.

Verification and publication evidence is recorded below. Fixture screenshots are synthetic and do not establish live marketplace accuracy. The installed simulator uses the existing isolated demo account. No customer records are written during review.

## Verification and shipped result

Runtime commit: bc0df329cf054c3475a2d76faaac523d201d77a7. Published to the existing [Mica app](https://jordan-pokemon-app.vercel.app) from [the verified deployment](https://jordan-pokemon-iid3fs782-earouse23-devs-projects.vercel.app), deployment dpl_7mf3G9yM9497eGCYwiyHzSs77N33. Header status-area masking and scroll clearance are included. Compact axis labels retain cents for low-priced cards.

[Independent release CI](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/39158953821): 583 unit passed / 3 explicit skips; 361 browser passed / 8 environment skips; 3 large-inventory passed. Local full UI regression: 87 passed. Targeted corrected header/chart checks: 21 passed. Lint, syntax checks, native runtime tests, release routing and normal signed simulator build passed. Release retains 9 functions, existing crons and provider holds.

An earlier broad local run had 300 passes and 18 failures from the 40px header targets. The corrected source passed all 87 UI tests, including those failing checks. Earlier chart tests also caught outdated expectations for smoothing/hover dots; tests now require straight segments and a visible inspection point while preserving date spacing, exact values and range recovery.

Visual evidence: installed iPhone SE 3rd-generation app (not Safari), native scrolling/safe-area review; desktop and mobile fixture portfolio and card-history screenshots. Screenshots with placeholder artwork are synthetic fixture states. Dark chart fixture screenshots were omitted because a manual body-attribute switch did not remount the canvas colors. An additional temporary screenshot-harness experiment that forced full detail rerender was unsuccessful (3 failures, 2 passes) and is not counted as acceptance; its temporary source was removed. The committed runtime and its normal appearance controls passed the independent CI and UI regression suite. This work does not certify physical camera, haptics or VoiceOver acceptance.

Production health reports release bc0df329cf05. Controlled demo reload: saved value/chart visible in 206ms before 25 deliberately delayed inventory reads; no uncaught errors, no customer writes, provider calls blocked by the review harness. This is one observation, not a production latency percentile. Earlier final staging observation was 627ms. Existing health limitations remain explicit: paid pricing configured but unverified by this UI task, vision release hold, authenticated schema acceptance separate.

Evidence: [publication record](evidence/floating-charts-2026-10-18/publication.json), [production browser observation](evidence/floating-charts-2026-10-18/production-browser.json), [native portfolio](evidence/floating-charts-2026-10-18/native-portfolio.png).
