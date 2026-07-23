# Full remediation pass — 2026-07-22

## Navigation and collection clarity

- Added separate Home and Library destinations to mobile navigation and removed the low-value Profile tab; Settings remains available from the avatar.
- Removed inherited scroll positions between workspaces.
- Changed ambiguous “items” counts to card-copy and grouped-position counts.
- Promoted Watchlist out of the More menu and made small-screen tabs wrap.
- Limited the dashboard to the eight highest-value positions with a direct full-collection action.
- Labeled total position value separately from per-card value and replaced the unexplained plus icon with “Add copy.”

## Matching, pricing, and decision trust

- Collector-number-only candidates with unrelated names are no longer “Strong match.”
- Price confidence now appears before the headline value; raw provider timestamps use readable local dates.
- Dollar inputs are rounded to cents instead of exposing floating-point artifacts.
- Buy and sale planners use the saved selling-fee preference.
- Fixed a shared CSS hook that prevented the rendered sale planner from reacting to edits.
- Card details keep core price evidence visible and collapse advanced buy/sell, grading, marketplace, metadata, and position-management tools.
- Redundant portfolio ranges are disabled and showcase history defaults to ALL.

## Intake, mobile, and presentation

- Replaced queue jargon with clear review language and prevented duplicate queue entries.
- Reduced the empty Add-page search area so camera tools remain reachable; examples wrap on phones.
- Made interactive targets at least 44px on coarse-pointer devices, raised microcopy legibility, fixed dark-theme numeric inputs, and removed white panels that broke the analytics theme.
- Reworked the mobile/auth logo into a gem and kept the dashboard full-width and responsive.

## Auth, deployment, and security

- Added show/hide password, forgot-password email, verified recovery password update, friendlier auth errors, and accessible Terms/Privacy dialogs.
- Added a server-only capability endpoint and a Settings status panel for catalog, pricing plan, AI Gateway, and push-alert readiness without exposing keys.
- Added a Content Security Policy alongside existing frame, MIME, referrer, camera, and microphone restrictions.
- Clarified that the offline shell does not retain a readable private portfolio and retries automatically when connectivity returns.
- Added five foreign-key indexes and applied them to the connected Supabase project.
- Fixed schema validation so duplicated snapshot/migration definitions no longer inflate the table count.

## Owner or licensed-service decisions still required

- Upgrade and set `PKMNPRICES_PLAN=pro` for graded ladders, deeper history, offers, sealed products, and licensed sold links.
- Complete Vercel AI Gateway billing/authorization so card, receipt, and raw-grade photo analysis can run.
- Approve and configure production push infrastructure and App Store notification credentials.
- Enable Supabase leaked-password protection if password login remains enabled.
- Supply final public legal entity, jurisdiction, retention, and support-contact language before launch.
