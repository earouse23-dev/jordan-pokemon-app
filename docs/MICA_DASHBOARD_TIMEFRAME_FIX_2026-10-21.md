# Dashboard timeframe repair — October 21, 2026

Work continued October 22 UTC. Application source: `0a3aeed3c6ffcdddc8aa09710e38337574217431`.

## Reproduction and fix

On the live dashboard, choosing Day produced “No recorded history in this range” despite a saved current valuation. Month and the independent P/L Month picker did respond. The saved portfolio uses UTC date-only observations; the display endpoint used the local calendar date, while range filtering compared UTC midnights against the current time minus 24 hours. In America/Chicago after UTC midnight, the endpoint could discard the latest UTC observation and the rolling cutoff could then exclude the remaining local-date point.

The shared portfolio range helper now anchors its cutoff to UTC midnight. The saved chart endpoint uses that same UTC day, matching the existing saved-valuation pipeline. Day shows the prior and current daily observations when available; it does not invent intraday trading data. Month/YTD/Year keep their existing periods with consistent daily boundaries. Both independent dashboard pickers retain their existing behavior. No provider requests, database changes or new cache layer were introduced. Service-worker shell version 112 delivers the application correction.

## Verification

- Reproduced the empty Day state in the actual existing showcase before publication.
- New browser regression runs in America/Chicago at 02:30 UTC, when the local date is still the previous day. It checks Day, Month, YTD, Year, All time, repeated selection, the next UTC midnight, unchanged saved observations, unchanged portfolio total and zero new API requests during switching. Desktop Chromium, mobile Chromium and mobile WebKit all passed.
- Targeted dashboard/history checks: **60 passed**. Updated an older All-time assertion from local-day getters to the UTC contract; the initial 3 failures were that same obsolete date expectation across engines, not suppressed layout failures.
- Focused unit/security checks: **83 passed**; lint passed.
- Protected staged isolated-demo check: all five ranges rendered a chart; warm saved EUR dashboard stayed coherent before and after inventory loading; no uncaught page errors or horizontal overflow at five widths. The read-only harness deliberately blocked mutation/provider routes; its listed 503s are those exclusions. [Staged evidence](evidence/dashboard-timeframes-2026-10-21/staged-browser.json).

The complete local release run passed 588 unit checks and 369 browser checks (8 skips), but one mobile Chromium delayed-FX check ended with “Execution context was destroyed.” Trace inspection found no document navigation after initial load. Its isolated 3×3 browser replay passed all 9 runs; no unrelated app behavior or test assertions were changed to hide it. The large-inventory tail did not run in that failed command. Independent [remote gate 39712769369](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/39712769369) succeeded: 588 unit passes (3 skips), 369 browser passes plus 1 passing on retry (8 skips), followed by 3 large-inventory passes. Its retried case was the separate mobile WebKit manual-set-filter focus test; do not describe this as a zero-retry run. No customer inventory/settings were edited, and there was no paid service, dependency or budget change.

## Publication

Promoted the existing-project staged deployment `jordan-pokemon-hplxvnxvm-earouse23-devs-projects.vercel.app` after the remote gate succeeded. Canonical health confirms release `0a3aeed3c6ff`. Computer-use review of the actual existing showcase verified Day now renders a chart (Oct 21–22), where it previously showed no history. Month, YTD, Year and All time also rendered; the total stayed $9,569.54. Restored All time afterward. [Live Day screenshot](evidence/dashboard-timeframes-2026-10-21/live-day.png), [verification](evidence/dashboard-timeframes-2026-10-21/verification.json), [canonical health](evidence/dashboard-timeframes-2026-10-21/canonical-health.json). Test-only follow-up `80513b4` adds the rollover assertion and corrects the older UTC acceptance expectation; application source remains `0a3aeed`. No migration or provider backfill was needed.
