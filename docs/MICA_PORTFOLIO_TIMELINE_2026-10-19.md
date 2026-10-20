# Portfolio timeline and full-width content — October 19, 2026

## Confirmed cause

A read-only production query of the portfolio shown in the client screenshot confirmed its saved acquisition boundary was November 3, 2024, but its saved chart started July 24, 2026 (88 days). Retained provider evidence starts later for several holdings. No customer record was written during diagnosis, and no pricing provider was called.

The history builder removed every date through the last incomplete value. Currency conversion repeated that trimming. The chart then selected its domain from observations rather than ownership dates. Separately, desktop views retained a 1,280px content cap plus wide side padding; the prior responsive change addressed phone charts but intentionally left this desktop cap intact. Earlier blanket claims about edge-to-edge sizing did not cover the client's desktop case.

## Workflow correction

- Model v2 stores every dated ownership day, including unavailable totals as null with coverage counts. Earlier complete segments survive later evidence gaps; missing holdings are not silently omitted to produce an apparent full value.
- Only matching dated market observations may value a holding. No purchase-cost substitution, future-price backfill, zero substitution, or cross-edition/grade substitution.
- Old v1 charts rebuild once from cached position pricing and current ownership, using the existing owner lock and revision-checked publication. That repair can complete without providers even on a new pricing day, preserving quote check dates and last price-update time. The browser displays the repaired model before continuing ordinary daily pricing.
- Subsequent reads reuse persisted v2 history. Normal daily append and backdated inventory corrections retain their existing behavior; source archives and ingestion cursors remain unchanged.
- All time explicitly starts at the earliest known acquisition and ends on the user's local current day, with a zero value-axis baseline. Provider ingestion remains UTC. Missing periods remain visibly unavailable rather than disappearing from the time axis. The local current endpoint uses the saved current total without mutating stored historical days.
- Dashboard/detail content uses the width beside navigation with 24px desktop gutters, without the old content-width ceiling. Phone safe-area-aware sizing stays in place.

This fixes the app's truncation and layout, not source coverage. A price for an earlier date cannot be recovered if the provider has never supplied that observation. That limitation is stated beside the chart. It is not a reason to trim the ownership timeline or invent a price.

## Verification

Lint and syntax/type checks passed. 584 unit checks passed with 3 explicit skips. Focused model/service tests cover backdated ownership, raw and exact slab evidence, sparse/missing prices, preservation of prior complete segments, mixed-currency null gaps, current endpoint, corrections, same-day no-op, v1 upgrade with no provider requests on same and next days, and inventory revision races. Nine browser cases passed across desktop Chromium, phone Chromium and phone WebKit, including real theme changes, 375/768/1440/1920/2560 layouts, the date/zero axes, legacy first paint, no horizontal overflow and the existing six-size canvas checks. Synthetic screenshots are retained here. Customer records remain outside write-test scope.

## Published verification

Runtime `bb56895bd9e0ff8a56d7cb0f797316491c6a85ff` published as `dpl_913ojy5kVGxYHqVA7reohEEVAKns` and promoted to https://jordan-pokemon-app.vercel.app. Release routing passed, with the existing nine functions and unchanged held routes/crons. Canonical health is healthy and reports that source. No SQL migration, new service, dependency or budget change.

The isolated authorized demo account was repaired through the staged authenticated API after preflight confirmed every position could reuse its matching cached pricing key. Version 1 became version 2, total/check-day/price-update time stayed unchanged, and the next GET returned the identical persisted timeline (October 5 through server UTC October 20, 16 days). No provider work was required. This was a demo-only write; customer history was diagnosed with read-only metadata queries only.

The production read-only demo browser measured 24px desktop gutters: 1440px screen → 1172px chart, 1920px → 1652px, 2560px → 2292px, all beginning at x244 beside the 220px sidebar. Phone canvases remain x8/359px at 375px and x8/414px at 430px. No page errors or overflow. Three intentional 503s in the restricted read-only harness blocked unrelated calibration, capability and snapshot calls; these are not live pricing failures.

The signed native build succeeded, installed and launched on the existing SE simulator. Native device/touch acceptance is not certified by that build. GitHub beta run 39346967636 was still in progress at the final publication check; only the completed local checks above are claimed here. Existing web sessions require a reload to load the new bundle; normal background portfolio refresh performs the saved-view repair.
