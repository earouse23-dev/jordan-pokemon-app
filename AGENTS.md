## Mica roadmap

Read `docs/MICA_SOFTWARE_ROADMAP.md` before planning or implementing roadmap work.

For current client-directed priorities, also read `docs/MICA_CLIENT_PIVOT_2026-09-17.md`. Its numbered sequence supersedes conflicting earlier feature priorities, not the safety rules. Execute only the current Astra-issued packet and stop for its review gate before starting the next packet.

Execute one numbered step at a time. Treat each numbered step as a separate goal. Respect dependencies and exit gates, and verify a step completely before beginning the next.

Continue to the next numbered step after the current exit gate passes. Still ask for approval before destructive migrations, paid services, new production dependencies, platform changes, or production deployment.

Do not make product vision, marketing, pricing, or business-model decisions. This repository covers software implementation only.

## Publication direction — Elliott, 2026-10-02

Completed, verified task work should be committed and pushed to the existing GitHub repository and published to the existing Vercel/Supabase stack as part of task completion. This is standing authorization for routine reviewed publication; do not ask again solely because a task includes a commit, push or production deployment. Reconcile this direction with each packet's scope and tests before publishing. Preserve unrelated work; exclude secrets, private recovery data and unfinished/unreviewed changes. Check Git-triggered builds and cron/provider behavior before pushing. Never rerun applied SQL from the historical pending-name inventory. Destructive migrations, new paid services/provider budgets, production dependencies, platform/store actions and newly discovered material risks retain their separate approval boundaries. Document what actually shipped and any held features. No App Store submission authority is implied.

## Sol handoff skill requirement

Every Astra-issued Sol packet/prompt must explicitly require `ponytail:ponytail` in full mode. Sol must read its installed `SKILL.md` before task work, reuse existing implementation first, and choose the smallest correct change. Ponytail must not reduce client-required functionality, official certificate integration, data preservation, security, accessibility, acceptance tests, evidence reporting, or approval gates. If the skill is unavailable, report that fact rather than claiming it was used. Research-only packets apply its scope/reuse principles without inventing code work.

## Interface quality

- Keep everyday screens concise. Lead with the result and the next useful action.
- Keep backend terms, configuration instructions, migrations, model orchestration,
  and audit mechanics in developer documentation or diagnostics.
- Use optional details for deeper explanations. Preserve concise, decision-relevant
  facts such as missing prices, uncertain matches, and estimated grades.
- Avoid extra confirmation or tutorial screens when the user has already supplied
  the information needed to act. Preserve values and provide a clear retry on failure.
- Test behavior and safety boundaries; do not require verbose explanatory copy just
  because an earlier implementation displayed it.
