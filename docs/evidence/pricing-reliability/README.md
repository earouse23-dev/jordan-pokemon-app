# Saved portfolio response ordering

## Shipped behavior

An older background refresh cannot overwrite a newer published saved portfolio read. This preserves the newer total, chart and compact disk snapshot together; existing per-position timestamps already protected the newer individual quote. Owner/session and inventory-revision guards remain unchanged. The app shell version is 150.

## Verification

- Reproduced before fix: controlled browser test retained the newer 275 card price but rolled portfolio and disk totals back to 240.
- After fix: newer 275 survives in the position, portfolio summary and disk cache.
- Saved quote is restored synchronously before a delayed network read; disconnected read and refresh preserve it.
- Empty provider updates retain last good pricing; published exact evidence corrections remain able to remove a disproven comp.
- Server lease denial returns the saved view without inventory, provider or publication calls.
- Existing server freshness tests cover a rolling 24 hours across midnight, partial history continuation and unchanged quote expiry.
- Full unit suite: 614 passed, three skipped. Lint and syntax checks passed.
- Browser suite: 156 passed initially; two cases found an obsolete 400px chart-height assertion. Updated to the existing 480px responsive maximum; both passed on rerun. No chart styling changed. Combined coverage: 158 scenarios, desktop and mobile Chromium.

All new network scenarios use isolated fixtures. No customer inventory writes, database migrations, new dependencies, paid services, budget changes or scheduled jobs. These checks do not claim physical camera acceptance or universal slab catalog coverage. Later brainstorm priorities remain open.

Published source commit: `9af5b5c`. Production deployment: `dpl_GL6atHwKgbXcctm5Tuhp9n7aHefc`, READY at https://jordan-pokemon-app.vercel.app/ with shell cache 150. Production asset hashes match the frozen release; health is healthy and unauthenticated pricing/portfolio routes return 401. Existing production branch (`main`), team/project and both cron schedules were inspected before publication and left unchanged.

Validation: lint (101 source files), syntax checks and 614 passing unit tests (three existing skips). The broader desktop/mobile browser run passed 156 of 158 cases; the two failures were the same old 400px chart-height assertion against the current 480px design cap. Updated that assertion to the actual responsive design and reran both cases: two passed. Focused pricing cases passed on both desktop and mobile. Release routing verified 64 entries, nine functions and zero outbound calls. No live provider-credit lookup or physical-device verification was needed for this client response-order correction.
