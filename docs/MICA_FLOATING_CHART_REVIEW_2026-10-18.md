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

Verification and publication evidence will be recorded below after the final run. Fixture screenshots are synthetic and do not establish live marketplace accuracy. The installed simulator uses the existing isolated demo account. No customer records are written during review.
