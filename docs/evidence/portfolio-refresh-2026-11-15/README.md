# Portfolio price refresh repair

The owner's message referred to the price refresh beside the portfolio total, not the application update banner. Separately, the inspected existing Chrome tab was still using the older 15px UI without the shared feedback token. An ordinary reload loaded the published 17px/120ms UI without clearing storage or signing out.

## Root cause

A stored demo view had reached three refresh attempts while every pending price was retained and most statuses were live. Several raw-card history requests were partial. The service counted optional partial history as an entire pricing failure, withheld the new total and never stamped those successful quotes as checked. This exhausted the current-day retry allowance even though current quote retrieval succeeded.

## Correction

- Current-price validity and historical coverage are separate outcomes. Missing/partial history cannot discard a validated matching current quote.
- The existing atomic view publish, exact context checks, price failure retention, source corrections, owner isolation, provider budgets and row/page limits remain intact.
- Partial history is explicitly pending and resumes through the existing durable cursor. Coverage is shown in optional history details, not relabelled as a price failure.
- History-only continuation preserves the original quote check timestamp rather than sliding its 24-hour expiry.
- Pricing pipeline version 3 gives a one-time recovery to old incomplete views specifically carrying valid quotes plus partial history. Genuine new failures still have the same backoff. No SQL reset, migration, account edit or provider-budget increase.
- Service worker shell 144 delivers the small history-details presentation change.

## Verification

A regression reproduces the old three-attempt lock, publishes the new matching current quote despite a partial history response, resumes pages 5–8 and then 9–10, reuses the one cached card-detail response, keeps the quote TTL unchanged, and makes no provider request after the series completes within the TTL. Existing tests preserve totals on real price failures and clear officially withdrawn comps.

Final automated and publication results recorded below after verification. No customer inventory write tests or new dependency.

## Final verification and publication

- Backend repair `0e2798f`; coverage display correction `fd94fc0`. Both pushed to the existing branch; no unrelated files included.
- Production `dpl_ExzE7oMoUBPJDoXyvvxkNnJSA6m5`, READY at https://jordan-pokemon-app.vercel.app/.
- 612 Node checks passed, 3 skipped; 99 relevant browser checks passed across desktop Chromium, mobile Chromium and mobile WebKit. Final history-details/retry checks: 6 passed across both appearances and all three engines. Final service-worker/security suite passed. Lint 101 files and syntax checks passed.
- Frozen prebuilt release and routing checks passed: 9 functions, auth/origin/held-route boundaries intact, zero real provider calls in routing tests. Existing cron schedules unchanged.
- Production static hashes match the artifact; health healthy; unauthenticated pricing/sales/graded valuation/portfolio return 401. See `production-verification.json`.
- Actual authenticated Chrome tab was reloaded from the old UI to the published one. The ordinary background price refresh published pipeline version 3, reset the prior retry counter to zero, cleared the price error and marked the current update successful. A read-only database check confirmed those facts without a manual SQL reset.
- Live UI changed from the old incomplete refresh to “Updated Nov 15, 2026.” Reopening retained the new value immediately. Partial historical coverage appears separately in optional history details. Private screenshot: ignored `benchmarks/private/portfolio-refresh-2026-11-15/repaired-portfolio.png`.
- No storage clearing, account sign-out, inventory edit, migration, dependency/platform change, new service or budget increase. Some historical coverage remains partial; the fix does not invent missing historical values.
