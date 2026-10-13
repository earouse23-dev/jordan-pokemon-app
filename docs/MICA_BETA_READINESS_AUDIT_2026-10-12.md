# Mica commercial beta readiness — 12 October 2026

## Verdict and scope

Mica is not yet evidenced as ready for a broad commercial beta. The latest design release improved the interface and demonstrated a fast saved-chart path for a small isolated demo account. That is valuable, but it does not establish pricing correctness, recoverability, public onboarding, or capacity for many collectors.

This is a release audit, not an implementation release. Findings distinguish confirmed implementation limits, observed failures, and unverified operational controls. No customer records were changed; no production load test, destructive operation, provider upgrade, or new service was performed. Read-only production metadata and aggregate counts were inspected. The code under review is the existing checkpoint 102 release; unrelated workspace changes are excluded.

The beta should concentrate on the client’s existing core: find or photograph a card/slab, resolve its exact identity, inspect matching price evidence, save a physical copy with cost/date, manage copies, and see a durable portfolio and history. Preserve raw cards and existing records. Include requested sealed intake only when its own acceptance flow passes; do not quietly remove it. Secondary grading comparisons, advisory modes, and other held features should not delay or clutter these flows. No new business model or App Store release is proposed.

## What was checked

- Repository roadmap, client reset/pivot, latest publication evidence and current release configuration.
- Portfolio API, daily job, snapshot publication, history reconstruction and provider caching/pagination.
- Collection loading, account deletion, authentication recovery, health checks and legal copy.
- Live Supabase organization tier, schema/RLS metadata, security/performance advisors, aggregate usage and portfolio-view status.
- Fresh full unit run and a broader mobile WebKit suite covering capture, search, save recovery, password reset, copy management, price evidence and sealed products.
- A bounded recent Vercel log sample. Six records returned, all HTTP 200; this is not an uptime or functional-success measurement.
- Fresh read-only production demo navigation at 390 × 844: dashboard, collection and scan had no horizontal overflow or uncaught errors; “Blastoise base” returned results. Three attempted REST writes were blocked by the audit harness. The first cold portfolio readiness attempt timed out at 60 seconds; a second attempt completed. This establishes inconsistent observed readiness, not a diagnosed cause. Investigate request timings before calling it a database or provider defect.
- Official Google SRE, Supabase, OWASP, web.dev, W3C and PkmnPrices documentation.

Important limits: this was not an independent penetration test, a legal review, a statistically representative pricing study, a real-device camera certification, or a sustained capacity test. Unknown controls below are verification requirements, not claims that the controls are absent.

## Ranked release work

### 1. Make the release gate trustworthy and green

**Confirmed:** the fresh full unit run has 573 tests: 559 passed, 11 failed, three skipped. The same 11 pricing-harness failures were reproduced against the unchanged baseline during checkpoint 102. They were not introduced by the visual release, but a failing baseline is still release debt. Several expect two offline transport calls where the current implementation makes one, and one expects HTTP 200 but receives 502.

The completed broader mobile WebKit run has 118 tests: 78 passed, 38 failed, two skipped, in 11.2 minutes. These are not 38 established product bugs. Recognition and price-evidence tests expect short names while the requested detailed title now includes set, number, finish, language and grade. That is test drift, not evidence recognition failed. However, the rendered fixture title repeats “Holofoil” twice, which requires title/identity normalization review. Other copy-management and recovery failures require classification. The password-recovery and physical-copy tests import `/app.js?v=111` despite the shipping entry point using a newer version; this can initialize the application twice. A reviewed physical-copy failure screenshot is on the sign-in gate, not a visible copy screen. These results are unsuitable as proof that production password reset or Add copy is broken, but they do prove the current release checks need repair. Some tests still expect the explicitly removed PSA comparison panel.

CI currently runs on main pushes and pull requests, while work is published from another branch through curated release artifacts. The artifact builder deliberately overlays accepted source onto a snapshot. This protects unrelated work but complicates reproducing exactly what shipped.

**Smallest correct work:** repair obsolete harness entry points and expectations; investigate remaining failures; retain meaningful behavioral assertions; verify a frozen candidate. Do not remove tests merely to obtain green status, and do not rewrite the application for test convenience.

**Exit:** a clean checkout can build the same candidate; lint/typecheck and current core tests pass; product defects have regression checks; skipped tests have an explicit reason; release manifest identifies frontend, API and schema versions; rollback to the previous compatible artifact is rehearsed. A reviewer can distinguish “tested source” from “published source.”

### 2. Guarantee background portfolio work completes beyond a tiny account set

**Confirmed:** `lib/portfolio-service.js:579` selects at most 100 portfolio owners. The invocation has a 48-second budget, three workers, and no durable cursor through the remaining owners. Per-owner exceptions are swallowed, and the reported updated count is not a reliable count of fully refreshed portfolios. One daily invocation cannot guarantee every account receives that day’s update at scale.

The shared PkmnPrices limiter is sensible protection: one request slot every 1,250 ms stays below the documented 60-request/minute limit. It also means a 48-second job has room for roughly 39 request starts before latency and other work. Parallelizing every card without bounds would exhaust provider throughput and credits rather than solve this.

Live production currently has only two persisted portfolio-view rows. Both were checked today and neither reported an incomplete refresh at inspection. This is positive small-scale evidence, not evidence for hundreds of accounts.

**Smallest correct work:** reuse the existing database leases and persisted job state; process due owners in resumable batches; record success, failure, retry time and remaining work; allow bounded subsequent invocations to continue. Prioritize today’s missing prices ahead of old backfill. Deduplicate provider work by exact card/printing/grade across users. Keep the previous completed snapshot visible until its replacement is ready.

**Exit:** a staging workload larger than 100 owners is drained without starvation; a killed invocation resumes; one broken owner does not block others; concurrent logins do not duplicate work; incomplete runs are visible to operators; daily freshness is met within the existing provider budget. Define the supported user/concurrency/holdings envelope from measurements before calling the beta suitable for “a lot of people.”

### 3. Finish the once-only historical ingestion contract

**Confirmed:** durable caching already exists; this is not a cache-free application. Exact graded sales are retained with cursor progress and a highest-ingested timestamp for daily updates. Saved portfolio views and client display caches also exist.

However, raw-history incremental refresh in `lib/providers/pkmnprices.js:1014` applies only when the cached response has one page, the request is for 365 days and page one. Other configurations and multi-page histories can request the full period again after expiry. Fetching raw history is also bounded to four pages. The user’s “save historical data once and append the missing day” promise is therefore not universally established.

**Smallest correct work:** persist history independently of a short-lived HTTP response, keyed by exact identity, finish/edition, grade, source, currency and condition. Store backfill completion, cursor and ingestion watermark. Request only the missing interval after initial backfill. If the provider corrects an old row, accept the correction without scheduling routine full re-downloads. Persist portfolio daily values separately from the underlying price series. Changing acquisition date or holdings should rebuild the affected local dates from saved prices, not purchase all history again.

**Exit:** two UTC days, repeat logins, missed days, partial pagination, restarted functions and two owners sharing the same card are replayed. Provider ledger proves same-day repeated viewing uses no extra historical-download credits. Full backfill occurs once per exact series; subsequent updates are bounded to new material. API failures never erase the saved chart or turn missing prices into zero.

PkmnPrices daily aggregate history is limited to 365 days. Stored eBay sales can extend farther, but coverage is not guaranteed; “all time” must mean all available matching evidence, with an honest start date. Follow cursors until `has_more` is false; a short page does not establish completion. Daily eBay updates use ingestion time, not sale date. See [history](https://www.pkmnprices.com/docs/price-history) and [eBay listings](https://www.pkmnprices.com/docs/ebay-listings).

### 4. Prove card/slab values and portfolio history are correct

This is the most important customer trust gate. A fast wrong price is worse than a clearly unavailable price.

**Required acceptance:** independently check representative PSA, BGS and CGC grades, including decimal grades, unlimited versus first edition, shadowless, holo/non-holo/reverse, supported languages, old comps, unknown variants and sparse histories. Use the owner-supplied Espeon CGC 8.5 and Blastoise examples. Verify listing identity and sold status; an active $599.99 listing is not automatically a completed-sale comp. TCGplayer raw market aggregates can provide raw context; they must not be blended into a slab value as equivalent graded sales.

Older rows with unknown sale type can contain asking prices for accepted offers. Display them as reported estimates with age, sample and evidence quality. “Exact match” does not mean verified paid amount. Missing or conflicting identity should not silently mix editions. Keep sale evidence and exclusions available without burying the result under operational details.

For portfolio date D: replay copies acquired on or before D, subtract copies sold/disposed by D, and value the remaining quantity using matching evidence available for D. Acquisition cost is separate from historical market value. Never use the date the user first opened Mica as the acquisition date. Never use a future sale to manufacture an earlier known value. Between observations, a carried-forward value must retain its source date; an initial unknown period remains unknown rather than becoming $0. Fixing visual gaps by inventing prices is unacceptable.

Current reconstruction can trim dates through the last incomplete day and use a smaller comparable subset for history than the current total. That may be cautious mathematically, but users need to understand why the latest chart point and total differ. Prefer one consistent complete snapshot; where evidence is incomplete, preserve prior known values and explain exclusions concisely.

**Exit:** an independent ledger replay matches app totals and graphs for buys, sells, duplicate retries, backdated edits, copy grading changes, price gaps and currency conversion. Selected examples match the provider response and underlying listings. Last point reconciles with the displayed total or clearly identifies the excluded holdings. No broad accuracy claim until this passes.

### 5. Establish recoverability before collecting more customer data

**Confirmed:** the live organization is on Supabase Free. **Unverified:** a current complete backup, object backup and successful restore rehearsal. The older September evidence did not prove these controls; it cannot establish their current absence either.

Supabase documents that managed daily backups are available on paid plans; Free projects need exports, and database backups do not include Storage object bytes. Free projects can also pause after inactivity. The correct action is to choose and prove an operating/recovery arrangement, not automatically purchase a large plan. See [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) and [backups](https://supabase.com/docs/guides/platform/backups).

**Exit:** restore a non-customer test dataset, private photos and ownership policies into an isolated environment; reconcile copies, costs, transactions, price history and storage hashes. Document recovery point/time objectives and the person responsible. Verify automated backups, retention, offsite access and alerting. Any new paid service remains an owner decision. A suggested starting objective is at most 24 hours of recoverable data loss and a four-hour recovery, subject to an actual drill and the owner’s acceptance.

### 6. Complete public onboarding, isolation, abuse and account lifecycle checks

**Positive evidence:** all inspected public tables have RLS enabled. The portfolio summary view uses security-invoker semantics; anonymous SELECT is denied. All 14 advisor-flagged authenticated SECURITY DEFINER routines contain an `auth.uid()` reference and an empty search path. These are useful protections, but neither RLS presence nor a string match proves correct authorization.

**Confirmed warning:** leaked-password protection is disabled. **Verification required:** inspect the 14 routine bodies and grants; exercise cross-owner read/write attempts using two isolated accounts; test private storage URLs, exports, cache ownership, logout, expired sessions and account switching. The 21 internal tables with RLS and no policy may deliberately deny client access; do not add permissive policies to silence the advisor.

Custom SMTP configuration and delivery are not established by this audit. Supabase’s default sender is restricted and unsuitable for public production email; verify custom SMTP, SPF/DKIM/DMARC, email confirmation and recovery using real external test inboxes. See [SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

The account deletion endpoint inventories private objects and deletes them before deleting the account. Multi-step cleanup needs failure/retry acceptance so a timeout cannot leave an unclear half-deleted account. Do not test deletion against customer records.

**Exit:** public signup/recovery and resend work with safe rate limits; isolation tests pass; deletion/export are verified end to end; request/upload limits and per-user paid-operation quotas are demonstrated; concurrent retries cannot bypass the global budget. Price/capture abuse must degrade gracefully without taking ordinary collection reading down. [OWASP resource-consumption guidance](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/) supports explicit resource and spending bounds.

### 7. Make failures observable and releases reversible

The health route checks basic auth/database reachability and reports paid pricing as configured but unverified. A healthy response does not prove correct comps, successful camera recognition, or completed daily portfolios. The provider summary’s last-success/failure dates are October 2 while the request ledger has newer activity; it is not currently a dependable operator health summary.

No browser error/field performance collector was found in the reviewed application source. That does not prove no external monitoring exists. Verify the actual Vercel observability configuration and alert destinations before introducing a dependency.

**Exit:** monitor user-visible save success, uncaught errors, portfolio update completion/age, provider errors/429s, cache hit rate, credits used and oldest pending backfill. Alerts reach a responsible person. Rehearse provider outage, rate limiting, function timeout, database failure and rollback. Logs must avoid tokens, private photos and customer notes. Keep read-only cached collection/portfolio available during pricing outages. Use existing platform facilities first.

Google’s guidance favors explicit user-facing objectives and reproducible, staged releases with rollback rather than an absolute “never fails” promise: [SLOs](https://sre.google/sre-book/service-level-objectives/), [canary releases](https://sre.google/workbook/canarying-releases/), [launch checklist](https://sre.google/sre-book/reliable-product-launches/).

### 8. Finish the mobile experience through task acceptance

Keep the existing green identity and the recent visual improvements. Another broad cosmetic rewrite should not precede correctness and recovery.

Specific critic points: remove repeated finish words from exact titles; preserve a readable name while making the full identifying title copyable; keep huge green type for real prices, not giant failure paragraphs; put source freshness and missing-price facts immediately below the result; retain the single obvious Add action and top-left back action; ensure a fixed bottom action never obscures fields, graph controls or keyboard focus. Make optional evidence/details genuinely secondary. Avoid excessive empty chart height when there are no points. An unavailable series should have a compact honest state, not a blank investment-style chart.

Fresh production demo screenshots also show generic thumbnails for two recognized Mew cards, a negative y-axis tick on a nonnegative holdings-value chart, and “1 copies” in activity. These are concrete finishing items. Generic placeholders do not count as broken `<img>` elements, so the automated zero-broken-image result is insufficient: inspect expected artwork resolution and delivery separately. The demo chart explicitly excludes three positions from history while the current total excludes one; coverage communication and reconciliation need real collector acceptance.

Test 320/375/390/430 CSS-pixel widths, landscape, desktop, dark/light, 200% text, keyboard open, safe areas, long Japanese/German titles, long amounts, no prices, one price point, hundreds of holdings and slow networks. Screen-reader names, focus order, contrast, error association and reduced motion are acceptance requirements. W3C [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [focus visibility](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) and [targets](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) are useful checks; a few screenshots do not establish WCAG conformance.

Collection loading currently hydrates broad owner history and optional grading data. Measure large portfolios before restructuring it; if those reads delay first useful content, load the concise collection first and hydrate secondary data later. Keep pagination and owner boundaries intact.

**Exit:** a collector completes search/photo → exact detail → save → collection → portfolio without coaching, reloads without data loss, recovers from denial/offline/provider failure and sees no overlap or layout jump. Elliott completes physical iPhone Safari capture acceptance; desktop WebKit cannot replace it.

### 9. Replace provisional legal/support copy

**Confirmed:** `app.js:19882` tells users the owner must add the final legal entity, support contact, retention period and location-specific notices before public launch. Terms also remain provisional. This is not finished commercial onboarding copy.

Provide stable accessible privacy/terms/support destinations; document provider attribution and the already resolved retention permission without reopening it. Verify current production display/artwork and commercial usage obligations against the owner’s agreements. The owner supplies business/legal facts and obtains appropriate review; engineering implements them. Do not invent an entity, jurisdiction or monetization policy.

**Exit:** no provisional instructions in customer UI; privacy reflects actual image processing, storage, exports/deletion and providers; a user can contact support and report an incorrect comp. These operational facts must match implementation.

## Performance and capacity acceptance

Suggested engineering gates, not current measured guarantees:

| Outcome | Proposed acceptance |
|---|---|
| Saved portfolio re-open | p95 ≤1 second on a supported real phone with a prior snapshot; no provider/history request required to paint it |
| Cached detail/search | p95 ≤2 seconds under the declared beta load; retain clear progress/cancel for cold requests |
| Photo identification | Measure the existing five-second target on representative real photos; report success rate and p95 separately; honest retry when no exact match |
| Save correctness | Zero lost or duplicate accepted saves in retry/concurrency tests; acknowledge only durable completion |
| Web responsiveness | p75 LCP ≤2.5 seconds, INP ≤200 ms, CLS ≤0.1, measured separately for mobile/desktop |
| Daily valuation | All eligible accounts complete within the chosen daily window; retained snapshot remains readable during failure |
| Provider cost | Same-day repeat views do not re-download history; shared identities reuse data; hard cap and operator alert demonstrated |
| Reliability | Establish a user-facing availability/error objective and collect pilot evidence; 99.9% may be an initial engineering target, not an advertised guarantee |

The web thresholds are from [Core Web Vitals](https://web.dev/articles/vitals). Checkpoint 102’s 194 ms demo saved-chart observation is useful lab evidence but does not establish field percentiles.

Load tests should use synthetic accounts/provider stubs first, then a small bounded real-provider acceptance within the existing budget. Test concurrent readers, saves, refreshes and cache misses separately. Record database/query latency, memory, function duration and provider queue delay. Forty-three unindexed-FK advisor suggestions and 91 unused-index suggestions are not instructions to add/delete indexes blindly; use hot-query plans and measured benefit.

PkmnPrices documents 20,000 returned-item credits/day on Pro and 60 requests/minute. Budget is account-wide, resets at UTC midnight, and extra keys do not multiply it. A fresh ledger sample showed 81 returned items on October 12; this app ledger is not the provider’s complete billing record. Reconcile provider billing before explaining a reported 12,000-credit day. [Rate/credit documentation](https://www.pkmnprices.com/docs/rate-limits).

## Recommended execution order

Execute one verified packet at a time. Each packet produces a frozen candidate, tests and evidence; do not ship unfinished adjacent work.

1. **Reliable acceptance gate:** classify/fix the 11 unit failures and broader core browser failures; remove duplicate app initialization in fixtures; fix demonstrated product regressions and duplicate title text. Exit with reproducible green core checks.
2. **Daily data correctness and cost:** complete incremental history persistence and resumable portfolio scheduling; verify independent ledger replay and exact slab examples; prove no repeated historical downloads and atomic retained snapshots.
3. **Customer-data and operating readiness:** prove backups/restore, onboarding email, account isolation, lifecycle, abuse bounds, alerts and rollback. Any paid decision is presented separately with concrete cost/need.
4. **Measured capacity and device polish:** stage load test against a declared beta envelope; fix measured bottlenecks; complete real iPhone, accessibility and uncoached collector tasks; finalize owner-provided privacy/support facts.
5. **Controlled release:** begin with a bounded invited cohort, watch real errors/freshness/cost and task completion through at least one daily rollover, then expand only within measured capacity. A broader release requires all critical gates above; “beta” is not a reason to waive data integrity or privacy.

These are sequencing recommendations for software work, not a promise that all unknowns can be closed by a calendar deadline. No extra feature is needed to make the existing core dependable.

## Final acceptance record

Maintain one current launch ledger with each gate marked confirmed pass, confirmed fail or unverified; link the candidate hash, environment, date, test and owner. Retire obsolete checklist claims such as the earlier missing Pro credential once superseded by current evidence. Do not describe provisional, skipped, fixture-only or small-account checks as proof of broad commercial readiness.

The execution and current acceptance record is now maintained in [MICA_BETA_EXECUTION_2026-10-12.md](MICA_BETA_EXECUTION_2026-10-12.md). Verified engineering source `9be74d3` is published; commercial hosting, SMTP, operator/support facts, production recovery, full declared capacity and physical iPhone acceptance remain held. This audit is the original assessment, not an assertion that those external launch gates passed.
