# Boards 01–06 implementation and verification

Updated: July 29, 2026

This checklist maps the approved implementation boards to the shipped Mica
implementation. “Verified” means the behavior is covered by source assertions,
domain tests, schema validation, browser automation, or a live Supabase check.

## Board 01 — visual direction

- **Single cream/sage system:** exact tokens and the unified `mica` theme are in
  `themes.css`; selectable themes and detail modes were removed from
  `index.html` and `app.js`.
- **Original Pokémon-inspired restraint:** abstract gem, energy, and
  capture-device motifs use CSS shapes only. No official character, card-frame,
  logo, or branded artwork was added.
- **Responsive and accessible presentation:** shared focus, contrast, wrapping,
  touch-target, and responsive rules are in `themes.css`.
- **Verification:** `tests/security.test.js` checks the approved tokens and one
  interface. `tests/browser/ui-regression.spec.js` audits 320, 390, 768, 1024,
  and 1440 px for overflow, text size, viewport containment, and mobile targets.

## Board 02 — UI system, Settings, and authentication

- **Mica naming:** authentication, manifest, titles, navigation, and metadata use
  Mica.
- **Password authentication:** email/password registration and sign-in,
  verification, password reset/update, sign-out, and account deletion remain.
  Magic-link UI and handlers were removed. `/profile` restores the Settings
  route after authentication.
- **Settings ownership:** Account, everyday preferences, collection and data,
  notifications, privacy, and Advanced tools are grouped in `index.html`.
  Theme/detail selectors and Connected Services were removed. Provider
  requirements live in the affected feature.
- **States and access:** auth copy, disabled/progress states, error messages,
  offline handling, focus behavior, and icon labels are implemented in
  `app.js`, `index.html`, and `themes.css`.
- **Verification:** auth/navigation source regressions live in
  `tests/security.test.js`; signed-out and Settings layouts are included in the
  browser suite.

## Board 03 — Dashboard and grading

- **Dashboard ownership:** portfolio value, items, Paid, profit/loss,
  stock-style history, highest-value cards, recent activity, and business
  performance are on Dashboard. Collection-only tools remain in Collection.
- **Chart correctness:** `marketAdjustedPortfolioHistory` removes deposits,
  withdrawals, and grading costs from market change. Explicit regressions cover
  adding a card, adding a lot, partial sale, complete sale, grading return, and
  missing/stale prices.
- **Digital grading:** front/back capture includes alignment and image-quality
  checks, deterministic geometry evidence, conservative AI subscores/ranges,
  abstention, retakes, private confirmed assessments, and no default photo
  storage. The evaluator measures exact/within-one agreement, range coverage,
  false Gem Mint, abstention, repeatability, latency, and labeled cohorts.
- **Batch grading:** selected ungraded positions use confirmed digital grades,
  exact raw and grader/grade prices, versioned fee assumptions, tier minimums,
  an explicit override, and the approved incremental-profit formula.
- **Verification:** `tests/domain.test.js`, `tests/vision.test.js`,
  `tests/security.test.js`, and `docs/digital-grading-benchmark.md`.

## Board 04 — card overview and details

- **Collection cards:** image first, favorite heart, exact identity, quantity,
  digital or professional grade, acquisition method (including Mixed),
  position value, Paid, and profit/loss.
- **Formulas:** position value is quantity times the exact current unit price;
  Paid is remaining allocated cash; profit/loss is position value minus Paid.
  Free positions show dollar change without a misleading percentage.
- **Details:** exact identity, full release date and artist from the
  TCGdex-backed catalog, matching provider quotes, Price today, purchase notes,
  simplified purchase history, and a readable responsive chart with an honest
  insufficient-history state.
- **Removed clutter:** reliability prose, matching-price jargon, buying/selling
  calculators, professional grading calculator, and extra price-proof blocks do
  not appear in the active detail experience.
- **Verification:** quote compatibility, valuation, hydration, and UI ownership
  assertions are in the domain and security suites.

## Board 05 — search, acquisition, and Collection

- **Exact search:** English/Japanese only; name, set, collector number, printed
  total, language, and finish stay separate. Exact Mew ex and number/set
  regressions cover collisions, padded numbers, promos, and finishes.
- **Internal scan resolution:** AI extracts printed name and collector number,
  then queries Mica’s catalog. Allowlisted visual comparison is a secondary
  fallback only when printed identity remains ambiguous.
- **One-card add flow:** the queue/cart and batch raw add were removed. The
  selected exact identity opens one form. Raw cards can grade now or later;
  professional cards require grader and grade.
- **Acquisition methods:** direct purchase, paid/free pack, trade, gift, prize,
  free card, and unknown reveal only relevant fields. Free methods force $0.
  Unknown cost/date remain unknown for first and additional purchases.
- **Retry safety:** every open add form has one stable idempotency key; submits
  disable immediately. Digital-grade confirmation is atomic and can be retried
  without losing a saved card.
- **Collection workflow:** filters cover identity, set, language, grade, grader,
  value, performance, favorite, acquisition method, and raw/graded/sealed.
  View/filter/sort/scroll state persists per user and clears on account change.
- **Verification:** catalog, domain, security, and browser suites plus live
  Supabase function privilege checks.

## Board 06 — Trades, page ownership, and quality gate

- **Trades:** two clean sides (“You give” and “You receive”), totals in headers,
  exact values, cash adjustment, one fairness result, reset, and summary
  sharing. Mobile sections stack without hiding totals or actions.
- **Page ownership:** the sidebar contains Dashboard, Collection, Add Cards, and
  Trades. Settings opens from the account control; `/profile` adds no duplicate
  sidebar item. The old Market Tools route redirects to Dashboard and is not
  navigable.
- **Quality gate:** formatting, linting, syntax/type checks, unit/integration
  tests, 48-table RLS schema validation, production build, Supabase advisors,
  privilege probes, and responsive browser tests are required before release.

## Live database verification

- Applied acquisition/digital-grade migrations preserve legacy records and FIFO
  cents.
- Authenticated users cannot directly insert or update digital assessments.
  They can call only the owner-scoped atomic confirmation RPC.
- The AI usage claim is callable by `service_role` and not by `authenticated`.
- Additional purchase and digital-grade RPCs are invoker-owned; anonymous users
  cannot execute the purchase RPC.
- Supabase Security Advisor reports no new application vulnerability. Its
  remaining warning is leaked-password protection, a documented launch
  dependency. Closed service tables intentionally have RLS with no client
  policies.
- Supabase Performance Advisor reports only unused-index informational notices
  in the current low-traffic database; the digital-grade foreign-key index is
  present.

## Owner approvals still required for launch

- Upgrade and validate the PkmnPrices Pro key for graded pricing and history.
- Enable Supabase leaked-password protection when the project plan supports it.
- Approve any public digital-grading accuracy statement only after an
  independently labeled holdout report.
- Complete native push credentials and App Store release configuration.
