# SOL activation 04 — configured release prepared, 2026-10-02

**Outcome: configured 07G web/API artifacts prepared locally; stop for Astra review. No deployment, preview upload, hosted setting change, synthetic account, SQL rerun, paid-provider call, commit or CLIENT-08 work occurred.** Ponytail FULL, AGENTS.md, current roadmap/pivot and applicable Supabase/Vercel skills were followed. ACTIVATION-03's executed SQL and bounded compatibility evidence remain accepted; migration-history inventory was not treated as an execution queue.

## Exact artifacts and provenance

| Artifact | SHA-256 |
| --- | --- |
| [Configured prebuilt deployment ZIP](sol-release-activation-04/configured-deployment.zip) | `d9a1ac3e908b4f01106841ff70eadd96ae219d74e64b849bbaec0cfcc5f26b09` |
| [Configured source ZIP](sol-release-activation-04/configured-source.zip) | `44a1c4793a3820f5ee7337dc2eccd178dc98af92d967e0c8be10ecdaa212d7fb` |
| [Exact deployment/source manifest](sol-release-activation-04/configured-manifest.json) | `8966004f6297f2bad4089edd3644da271bf6b622d09ad68c61a5927263a8758c` |
| [Reviewable source changes](sol-release-activation-04/source-changes.patch) | `21c8b59d2740788ef5062b69766d88e4bc3f8cd136396a4e15f6a3857286f7b7` |

The unchanged frozen input ZIP/manifest were reverified as `391b748260cf17124cded8dc18960b23b8e020af3f178aa899d0f84d3dd33b47` / `4e1710477b1af0846532cf906315f3f48b81878857b6b0d7c729f9970614dc58`. All 112 frozen files matched their hashes before applying the explicit overlay. The dirty worktree was not packaged; its runtime source was not edited. Configured source has 85 files: the original 84 plus one shared release-hold handler. Thirteen existing source/config files changed; every other source file retains its frozen hash.

The deployment ZIP contains **61 upload files: 28 static files, 16 bundled Node 24 functions and their configuration, plus Build Output configuration**; two additional local control files identify the Vercel project and proposed configuration. Vercel CLI 59.26's read-only `--dry` output matched every upload file and hash (5,173,020 bytes). Two consecutive final builds reproduced all three artifact hashes. The manifest records installed dependency versions, build-script hash, per-file SHA-256 and byte counts; no dependency installation or remote rebuild occurred. Bundling uses the existing esbuild and [Vercel Build Output API](https://vercel.com/docs/build-output-api/primitives).

Output tree SHA-256: `72d8311677adbcdc799f56bb5cb788a7b833ad48cbe6dd51ac3f68b1f65baee7`; static tree SHA-256: `a918453f96a3c91b67ad8587377cc4252faf95b347821209cdcf76d9ca35f3df`. These digest the manifest's ordered per-file records, not ZIP bytes. Only static `app-config.js` and the service-worker cache version differ from the frozen neutral output.

## Public configuration and disclosed release changes

The scoped Supabase publishable-key connector supplied the existing enabled modern public key. [Public configuration](sol-release-activation-04/public-config.json) uses `https://kdkzdflrxajfdcithrfj.supabase.co` and API origin `https://jordan-pokemon-app.vercel.app`; web requests remain same-origin. Key SHA-256 is `0c25b3039cb7141ac61e3a428de55efa5d159b1d1651d237a23a7a6a5ab9e79c`. No environment file was read, written or pulled. Public values are in static configuration and per-function public overrides; server secrets remain inherited server-side. Read-only project metadata confirms production `SUPABASE_SECRET_KEY` and `CRON_SECRET` names are present; values were not decrypted or packaged.

The frozen source would enable two cron jobs and can obtain AI Gateway credentials through Vercel OIDC even without an explicit AI key. The proposed local changes therefore:

- Hold `/api/vision`, `/api/graded-valuation`, `/api/sales`, `/api/offers`, `/api/sealed`, `/api/price-sync`, `/api/maintenance` and `/api/alert-delivery` with a shared HTTP 503 `release_hold`, before credential/network use. Existing credentials or environment flags cannot lift this hold.
- Keep `/api/cards` on its existing public TCGdex fallback; report held AI and external notification delivery honestly in capabilities/health. Public catalog, images and ECB FX paths remain; no paid provider or email dispatch is enabled.
- Remove pricing/maintenance schedules, while preserving the **already deployed** deletion schedule `/api/capabilities?surface=grading-deletion`, `15 5 * * *`. Its authentication and lineage-aware deletion handler are unchanged. No deletion guarantee was replaced with a provider-spend guard.
- Give the service worker a new shell cache name so the public configuration refreshes without clearing authentication or customer records.

A read-only probe found the frozen health check incorrectly classified the expected anonymous private-table denial (`401`, PostgreSQL `42501`) as an outage. The correction reports `access_restricted`, preserves `requires_authenticated_acceptance`, and still returns 503 for invalid keys and outages. Auth health and this corrected built endpoint passed against the existing project without reading customer rows. No grant or SQL change was made.

Users would see the collector, manual entry/correction, saved copies, selected-copy sales/history, profiles/privacy/settings, in-app action screens and retained pregrade reports. AI recognition/advice, fresh paid graded/sealed evidence and external delivery are explicitly unavailable; saved facts and public raw pricing remain. This limitation and the overlay require Astra's review before deployment. Normal existing Vercel/Supabase hosting usage is not a zero-cost guarantee; the artifact introduces no new paid service or scheduled paid-provider execution.

## Verification and concrete approval request

[Focused runnable checks](sol-release-activation-04/verify-configured.mjs) passed all artifact hashes, eight held routes with populated synthetic provider/OIDC credentials and zero outbound calls, eight hostile-origin checks, public-only card lookup, account/deletion authentication, accurate capabilities, health rejection/outage boundaries, all 16 function imports and source syntax. Existing certificate-fixture exclusion passed; deployed files contain no environment files, private keys, service-role JWTs, source maps or fixtures. [Verification evidence](sol-release-activation-04/verification.json) records scope. No browser/device/fresh-login/Storage acceptance is newly claimed.

**Prepared request after Astra acceptance:** Elliott approves uploading only the exact prebuilt deployment ZIP above to existing Vercel project `prj_ICSEVLitTA6RdwTTy14BThiAvPEQ`, team `team_txwalREE56wdO0c6DX4hfwjQ`, with its public configuration, provider holds and deletion-only cron. Extract into an isolated directory; verify all manifest hashes; use `vercel deploy --prebuilt --prod --skip-domain --cwd <extracted-directory> --scope team_txwalREE56wdO0c6DX4hfwjQ`. This creates a production candidate without automatic domain assignment. Before `vercel promote <new-deployment-id>`, verify READY status, exact files/public configuration, `/api/health`, held-route responses, private-bucket/RLS metadata, deletion schedule and runtime errors using read-only checks. Stop on unexpected behavior; do not rebuild remotely or apply SQL. Account writes and provider acceptance need separate authority.

Production was reconfirmed READY at `dpl_5rZyi9juErBWXNjzKYtetDb2DYap`, commit `08854a6613b8cefdbe0c2e0a006f356bf8d56639`. The approval request also covers **alias-only rollback** of `jordan-pokemon-app.vercel.app` and `jordan-pokemon-app-earouse23-devs-projects.vercel.app` to `jordan-pokemon-4m8d11k0l-earouse23-devs-projects.vercel.app` using `vercel alias set` under the same team. Leave additive SQL/customer records and the deletion-only cron intact. Do not use an automatic Instant Rollback: it can restore old cron definitions, including price sync. [Vercel cron rollback behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs#rollbacks-with-cron-jobs). Alias rollback restores the old server code and its prior provider behavior; the new code's holds do not survive that restoration, and no additional provider spending is authorized.

Remaining gates: Astra review of the exact overlay/artifacts; Elliott's separate deployment-and-alias-rollback approval; actual Vercel runtime/read-only smoke checks; separately authorized authenticated save/reopen/private-Storage and user acceptance. Native signing/callbacks/AASA, subscriptions, TestFlight/App Store release and CLIENT-08 remain separate. **Stop for Astra review.**
