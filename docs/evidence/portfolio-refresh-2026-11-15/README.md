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
