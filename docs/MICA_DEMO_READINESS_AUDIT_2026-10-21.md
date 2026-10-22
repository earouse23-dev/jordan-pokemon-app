# Mica demo readiness audit — October 21, 2026

Audited production source `7b65a82d697030d5a6d80b44bbdfc6d200c61685`, the canonical Safari/web deployment, current repository, fresh database metadata/advisors, CI and focused browser recovery tests. The audit continued after midnight UTC on October 22. This report distinguishes confirmed defects, design recommendations and unverified release gates. It is not a penetration-test certificate or a claim that every possible workflow was exercised.

**Verdict:** finish the existing core loop before Jordan's acceptance. There are reproducible problems in mobile hierarchy and dashboard refresh consistency. Do not call this a public commercial or App Store release yet. No additional product features are needed for the next milestone.

## 1. Confirmed fixes required before the demo

### A. One dashboard refresh must preserve one coherent valuation

**Priority: high.** During a real reload of the existing signed-in showcase account, the saved total/chart remained at $9,576.71 while all five displayed holdings temporarily showed dashes and all-time P/L became +45.0% / $5.40. The screen later settled to $9,569.54 with priced top holdings and +130.7% / $5,430.94. No inventory was edited; ordinary app loading performed its existing background refresh. This is a transient consistency defect, not evidence that the stored acquisition ledger was lost.

The source explains the split: `renderSavedPortfolio()` and the main total use `state.portfolioView`; `renderPortfolioPnl()` derives all-time P/L from `portfolioItems()`, and `renderDashboardHighlights()` derives values/ranking from `state.items`. `compactPortfolioView()` deliberately excludes per-position pricing, so saved first paint cannot restore those dependent results. The current saved-chart tests mostly protect total/chart, not the entire dashboard.

**Fix:** retain the compact presentation facts needed for total, chart, holdings and P/L as one versioned saved view, or keep the dependent previous presentation until its matching inventory/pricing is ready. Reuse the existing saved-view publication and inventory revision checks. Do not add a second pricing cache or repair this with a cosmetic loading timeout. Preserve source/FX/coverage semantics and owner isolation.

**Acceptance:** delayed inventory, failed provider refresh, partial backfill, expired FX, same-day reopen and account switching must never combine a saved total with empty or partially recalculated holdings/P/L. One completed revision replaces all dependent valuation fields together. Acquisition or sale edits must invalidate the correct revision.

### B. The latest release fails the mobile chart-position gate

**Priority: high.** Remote [Beta candidate gate 39699027670](https://github.com/earouse23-dev/jordan-pokemon-app/actions/runs/39699027670) completed with **365 passed, 8 skipped, 2 failed**. Both failures are `physical-copies.spec.js:2064`, the latest-slab/history mobile test. The chart begins at 550.6px in remote Chromium and 566px in remote WebKit; the acceptance limit is below 520px. A fresh local replay reproduced both failures: 570.1px and 566px; desktop passed.

The earlier publication report correctly said broader CI was pending; it must now be read with this failed result. Passing the smaller camera/title/dashboard suite did not qualify the whole candidate. The failure is the chart's vertical placement, not an absent price.

The live 375px Blastoise page confirms the hierarchy: full identity, a separate copy-title row, value, source pill and another disclosure consume most of the first viewport. Main copy/edit actions follow the chart and performance sections. The result looks better than the old page, but gives low-priority actions space ahead of the frequent task.

**Fix:** make copy-title a compact accessible action beside identity, remove duplicate source decoration, reduce redundant vertical gaps, and put the next collection action within easy reach. Preserve full exact identity and a 44px hit target. Do not simply weaken the test or shrink the chart/type until it passes. Review SE 375×667 and long titles, large values, no-price states, light/dark, WebKit and desktop.

Synthetic fixture screenshot: [mobile regression](evidence/demo-readiness-audit-2026-10-21/slab-mobile-regression.png). It intentionally uses placeholder artwork and synthetic prices; it is not live pricing evidence.

### C. Search result accessibility hides the variant distinction

**Priority: high for accessibility.** Live camera → Search → “Blastoise Base Set” works and returns distinct printing choices. However, all three buttons have the same accessible name: “Review Blastoise from Base Set, number 2/102”. The visible finish/edition is omitted by `app.js:15695`'s explicit `aria-label`. A screen-reader user cannot distinguish those buttons by their names.

**Fix:** include language, finish and edition in the existing accessible label, or let meaningful structured button content supply its name. Verify the actual accessibility tree, keyboard selection, result loading and return focus. Retain exact printing validation; do not collapse variant results just to remove apparently duplicate names.

### D. Patch the vulnerable installed HTTP dependency

**Priority: high before broader release.** Fresh `npm audit --omit=dev --json` reports one affected production package, `undici@7.29.0`, with high-severity advisories. It is brought in by the existing AI SDK/provider-utils dependency chain. The TLS advisory's patched version is 7.29.1. This is a dependency finding, not proof that Mica invokes the affected BalancedPool/WebSocket/cache paths or that an attack occurred. See the [GitHub advisory](https://github.com/advisories/GHSA-w293-vg96-wgc3).

**Fix:** update the existing compatible lock resolution, inspect the actual dependency diff, rerun AI/network/security tests and audit the final production tree. Do not introduce a new networking library. No packages were changed during this audit.

### E. Preserve provenance on the current-day chart endpoint

**Priority: high for valuation honesty.** `app.js:5447` constructs today's display endpoint as only `{ date: today, total: saved.total }`, replacing an existing point or appending a carried-forward point. That drops `estimatedItems` and any other coverage/source facts. The tooltip relies on `estimatedItems` to disclose purchase-price estimates. A synthesized endpoint is useful for the approved through-today domain, but must not erase an estimate label or imply a new observation. This is a confirmed metadata-loss path in source; the screenshot alone does not establish how many real holdings it affects.

**Fix/acceptance:** preserve the original observation/provenance fields, distinguish carried-forward display values from new market observations, and test a one-observation portfolio, today's purchase-cost fallback and a stale saved view. Keep the stored history immutable on ordinary reads. Resolve the six endpoint-related test failures against this explicit contract rather than accepting any extra point unconditionally.

## 2. Workflow and experience polish

| Area | Assessment | Next change or acceptance |
| --- | --- | --- |
| Saved portfolio | Saved total and chart appear before all inventory; final data recovered correctly. Mixed dependent values during refresh are a confirmed defect. | Fix A before treating the dashboard as stable. Measure cached first paint and completed refresh separately. |
| Card identity | Actual Blastoise shows set, number, Holofoil, Unlimited, English and PSA 9; title is copyable. | Preserve these facts while reducing the separate copy row. Test long Japanese/German names and larger text. |
| Slab comps | Actual Blastoise shows $1,250, dated Oct 11, linked to a matching eBay comp. This improves on the earlier stale evidence. | Audit representative PSA/CGC editions and qualifiers, sparse/no-sale cases, unknown sale type and currencies. One correct card does not certify catalog-wide accuracy. |
| Price history | Actual graded history says available from Jun 25, 2026. All-time is available evidence, not a promise of a sale every day. | Keep exact graded sales separate from raw aggregate history and asking prices. Preserve purchase-price estimates and source labels. Show observation age when extending a stale endpoint through today. |
| Search | Natural name-plus-set search and camera-to-search fallback succeeded live; edition choices are visually distinct. | Fix accessible names. Recheck misspellings, number-only queries, partial provider failure and full-catalog pagination using existing recovery flows. |
| Camera | Search control opens the manual lookup and stops the camera sheet. Synthetic permission/background recovery is covered. | Physical SE raw-card/slab capture, glare, blur, orientation and permission-denied retry remain device acceptance. Native packaging does not itself make automatic capture work. Manual capture is accepted for the current demo. |
| Add/save/reopen/sale | Existing idempotency, uncertain-save recovery and physical-copy accounting have prior owned-fixture qualification. No customer mutation was performed in this audit. | Repeat one complete isolated-account raw-card and slab cycle on the final candidate: save, relaunch, copy switch, selected-copy sale, retry after network loss. Preserve query, currency and acquisition facts. |
| Source link polish | Actual eBay button renders two external-link arrows. Source text includes one; `styles.css:11860` adds another. | Remove one decoration. Keep date/amount, source validation and an accessible external-link name. |
| Settings | Main groups are short; notifications clearly distinguish in-app delivery. Account still exposes optional Collection insights, Digital grading and Returned-grade accuracy disclosures. | Consolidate secondary analysis away from account basics; confirm every visible action is supported. Decide save behavior consistently: theme changes immediately while currency has Save changes. This is a design recommendation, not a proven failed save. |
| Charts and navigation | Existing measured responsive chart gutters are 8px on phones and no overflow across 375–2560px in the prior canonical checks. | Preserve this; do not redesign the entire shell again. Review scrub/tooltip, range changes, zero/one observation, cost-estimate transitions and floating bars with keyboard/zoom on the final build. |
| Update adoption | The long-open Chrome tab initially retained the older “Your cards” UI/theme107; reload received Top holdings/theme108. No in-app controller-change/update prompt is implemented. | Offer a safe update affordance when a new shell is ready; do not force-reload an unfinished capture/form. Test an old open session through deployment. |
| Microcopy/privacy | Add screen says “Photos aren’t saved”; the app also has optional saved-photo/evidence flows. | Reconcile this absolute sentence with the actual opt-in retention path and the privacy notice. Audit data behavior before editing the claim. Do not remove consent or required coverage facts to shorten copy. |

## 3. Background updates, speed and operating capacity

Fresh database metadata confirms the five-minute `mica-portfolio-refresh` cron is **inactive**. The separate Vercel daily `/api/capabilities?surface=portfolio-sync` cron remains configured. Its worker authenticates a cron/dispatch token, selects up to 100 due owners, runs three workers and stops at 48 seconds, reporting pending/failed/deferred work. The database selector is fair and skips completed same-day revisions. A paused recurring continuation means a single daily invocation cannot establish that every incomplete or deferred portfolio finishes that day. Do not say all background updates are disabled; equally, do not claim unattended refresh completion is qualified.

At the end of this audit, two saved portfolios existed, one was complete for the current UTC day, zero were marked incomplete and no refresh lease was active. These aggregate facts do not prove the other portfolio is broken or that the scheduler ran successfully for it.

**Before public beta:** demonstrate daily refresh and continuation without any browser opening; account for absent users, queue interruption, backfill and provider failure. Complete capacity/budget acceptance before enabling the already-configured recurring dispatcher. Existing 20,000-item application budget is unchanged. A target of 100 accounts × 1,000 distinct priced identities cannot be promised from a 20,000-item/day budget without proving actual deduplication/workload feasibility.

Current database size: **331 MB**. Prior local acceptance qualified 20 accounts × 1,000 physical copies and concurrent saved reads; it did not qualify the full 100-account physical inventory/retention envelope. Restore evidence is local and owned; managed production database plus private-object recovery is still a separate operational gate. Do not replace this with another dashboard redesign.

Use timed warm/cold/reopen/slow-network measurements on the actual iPhone and final deployment. Existing lab saved-chart timings are useful evidence, not real-user percentiles. Google's [Core Web Vitals](https://web.dev/articles/vitals) distinguish field and lab measurement; target good LCP/INP/CLS while also measuring the app-specific “saved value usable” and “confirmed card price usable” moments. No paid monitoring purchase is required for a bounded qualification.

## 4. Security assessment

Fresh read-only checks found **zero public ordinary tables with RLS disabled**, and all four existing storage buckets are private. Live unauthenticated portfolio GET and account DELETE both returned 401 with private/no-store caching. No deletion was attempted with an authenticated customer. Native Keychain source restricts callers/keys and uses device-only, unlocked accessibility. Vision identifies the authenticated user server-side and reserves rate-limited usage through the database. These are strengths, not a complete security certification.

Supabase advisors report 14 authenticated-executable SECURITY DEFINER functions. The three global identity-merge functions call an admin guard; its current runtime definition uses trusted `app_metadata.role`, rejects missing identity and sets an empty search path. Fresh runtime guard-prefix inspection of the other 11 finds authenticated owner derivation and rejection of a missing user; sampled import/organization/action paths also constrain target records by that owner. Their mere presence is not an exploitable authorization finding. Finish full per-statement/grant review and two-owner denied-operation acceptance rather than treating a guard prefix as proof of every nested operation. [Supabase advisory guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The 21 RLS-enabled/no-policy notices mainly concern server/private tables; no-policy is deny-by-default, not evidence of public disclosure. Leaked-password protection is disabled; check current plan entitlement before proposing activation and never purchase an upgrade automatically. [Password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Health diagnostics need correction: `api/health.js:73` hardcodes vision as release_hold, although `api/vision.js:794` authorizes identification while holding other modes; capabilities separately reports active recognition and held vision. Pricing health checks provider availability/configuration, not a paid feature end-to-end. Report exact surface readiness and recent verified checks; a green health response does not prove pricing/scan acceptance. This report corrects the ambiguity in the prior publication's health interpretation.

Finish final-candidate checks for cross-owner access, session expiry, service-role exclusion from the client artifact, private-photo links/retention, delete retry, log redaction and provider quota enforcement. Reuse the existing security controls/tests; no customer records or production grants were changed.

## 5. Native/App Store gates after Jordan approves

Jordan's Safari approval is approval to proceed to native preparation, not evidence of native production readiness. The existing installed Capacitor build and browser-native fixtures are useful, but not a TestFlight/device qualification of this exact source. Current bundle configuration still uses `dev.mica.client07.local`. A fresh Xcode build was not completed here: command-line tooling reports the unaccepted Xcode license. No license, signing agreement, paid enrollment or store action was accepted during the audit.

Before submission, qualify the signed release identity and build, real-device camera/photo access, suspend/resume, cold auth callback, secure session persistence, offline/reconnect, safe areas/keyboard, accessibility and review-account access. Reconcile the empty collected-data entries in `PrivacyInfo.xcprivacy` with the real collection/upload inventory and App Store privacy disclosures; an empty manifest entry alone is not proof of a policy violation.

Apple expects a functioning, complete app with review access, live backend and required privacy information; an app offering account creation must also support initiating account deletion. See [review guidelines](https://developer.apple.com/app-store/review/guidelines/) and [account deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion). A web wrapper alone does not guarantee approval. Support/operator/legal facts and reliable public signup/reset email remain explicitly deferred by Elliott until this later milestone; this audit did not newly configure or requalify them. Prior Hobby-plan restrictions must be rechecked before commercial operation; [current Vercel Hobby documentation](https://vercel.com/docs/plans/hobby) limits it to personal, non-commercial use. No billing change is authorized or made.

## 6. Test evidence and limits

- Latest remote candidate: **365 passed / 8 skipped / 2 mobile layout failures**. The failed browser command prevents the subsequent large-inventory command in beta:check from running; do not claim that tail passed in this run.
- Fresh local slab-history replay: **1 passed / 2 failed**, same chart-placement defect.
- Fresh native-session/notification/saved-history selection: **19 passed / 6 failed**. The six failures are two expectations repeated across three engines: expecting `[400,450]` instead of the added current-day endpoint `[400,450,450]`, and expecting a single-value message after that same endpoint makes two display points. Source `app.js:5442–5448` explains these discrepancies. Reconcile assertions with the approved through-today display contract, separately test stale endpoint labelling, and preserve zero-provider-call/cache/owner assertions. These six are not counted as passes and are not six independently proven production bugs.
- Live read-only navigation: dashboard, refresh, profile/settings, alert settings, graded library, exact Blastoise detail/back navigation, camera-to-search fallback, name-plus-set results and return home. No holdings/settings/customer records were manually edited. Normal app startup can perform its existing authorized background pricing publication.
- No new paid API experiment, dependency installation, migration, provider budget change, deployment or platform action. Only this audit report and sanitized evidence are intended for publication. Existing unrelated work remains excluded.
- Physical camera, actual signed native recovery, full public signup/reset delivery, full target production load and production restore remain unverified. Prior unit/load results are historical evidence, not fresh passes from this audit.

## 7. Recommended execution order and demo exit gate

1. Fix coherent saved-dashboard refresh; cover holdings/P/L as well as total/chart.
2. Fix phone detail hierarchy, duplicate decoration and variant accessibility; make the real mobile regression pass without weakening its intent.
3. Patch the existing vulnerable dependency; correct readiness diagnostics; finish privileged-function guard review.
4. Preserve endpoint provenance, reconcile chart endpoint expectations and run the complete frozen candidate gate **before** promotion. Keep the previous release available for rollback. Remote CI pending is not a release acceptance result.
5. Run the complete isolated-account demo loop on the exact candidate and Elliott's physical SE: scan raw/slab, identify exact edition, price, add with date/cost, reopen, copy switch, sell selected copy, reload portfolio, interrupt/retry. Record failures and retest.
6. After Jordan's approval, close unattended refresh/capacity/backup and native/public-release gates. Stay within existing plans; bring any unavoidable paid/platform decision back to Elliott separately.

For the Jordan demo, completion means a consistent saved dashboard, the correct exact card and price context, one smooth add/reopen loop, legible mobile charts, honest failure recovery and no candidate-gate failures. A new feature does not substitute for any of those.

Competitor benchmark: Collectr publicly emphasizes a short scan → exact printing → quantity/condition → portfolio flow ([official scan page](https://getcollectr.com/scan)); Card Ladder emphasizes dated sales, vetted evidence and daily collection updates ([official site](https://www.cardladder.com/)). These are product benchmarks and vendor claims, not independently measured accuracy/latency or a reason to copy their entire feature set. Mica should meet the clarity and reliability of its core loop first; this audit cannot certify competitor parity across data coverage.
