# Release and incident operations

Updated: 2026-07-25

## Release gate

Run `npm run release:check` from a clean checkout. A release is blocked if lint,
syntax checks, behavioral/security tests, schema validation, or the production
build fails. GitHub runs the same gate on every pull request and push to `main`.

After deployment:

1. Confirm `GET /api/health` returns HTTP 200 and `status: healthy`.
2. Sign in with a non-owner test account and verify its collection is isolated.
3. Run search → exact printing → add → detail on a phone-size viewport.
4. Verify one card image loads through the same-origin relay if the direct image
   host is blocked.
5. Check Vercel runtime errors and Supabase security advisors.
6. Run `npm run verify:pkmnprices` only when provider credits are available.
7. Run a private AI benchmark before making scanner-accuracy claims.

## Monitoring

Use `/api/health` for an external uptime check. It actively checks Supabase Auth
and the provider health endpoint but does not make a paid pricing or AI request.
Treat a database failure as a page; treat a provider failure as a warning because
the product has a public pricing fallback.

In Vercel Observability, alert on production 5xx responses, vision errors,
pricing-provider failures, function p95 duration, and AI Gateway spend/latency.

## Rollback

If a web release breaks a main workflow, promote the last known-good Vercel
deployment. Do not roll back the database unless a separately approved, tested
reverse migration exists. With a backward-compatible schema, roll back only the
web deployment and fix forward.

For a provider incident, keep the app online, mark the provider unavailable,
preserve existing portfolio data, and never convert an empty/error response into
zero value or “no sales.”

For suspected data exposure:

1. Disable the affected route or deployment.
2. Rotate the relevant server credential.
3. Preserve Vercel and Supabase logs without copying private values into issues.
4. Determine the affected users and data types.
5. Follow counsel-approved notice requirements.

## Recovery ownership

Before public launch, assign a Vercel rollback owner, a credential-rotation
owner, a monitored support/incident inbox, database recovery objectives, and a
quarterly restore-drill owner. User export is portability, not a substitute for
managed database backups.
