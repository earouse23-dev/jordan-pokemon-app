# SOL publication 05 — stopped at existing-plan limit, 2026-10-02

**The exact reviewed release was uploaded once but could not reach READY. Nothing new shipped.** Vercel rejected candidate `dpl_JCgstuVpRo6nvKXB9rvaPXP7KNzJ` with `exceeded_serverless_functions_per_deployment`: ACTIVATION-04 has 16 functions; the existing Hobby project permits at most 12. No retry, artifact alteration, promotion, alias rollback, push, paid-plan change, provider invocation or SQL execution followed. Stop for Astra review.

## Verified target and artifact

Existing project/team: `prj_ICSEVLitTA6RdwTTy14BThiAvPEQ` / `team_txwalREE56wdO0c6DX4hfwjQ`. Extracted the approved ZIP into a fresh isolated directory, verified all 63 manifest entries and dry-upload inventory: exactly 61 upload paths, 5,173,020 bytes. No dirty-worktree packaging or remote source rebuild. All four accepted artifact hashes still match:

| Artifact | SHA-256 |
| --- | --- |
| Deployment ZIP | `d9a1ac3e908b4f01106841ff70eadd96ae219d74e64b849bbaec0cfcc5f26b09` |
| Source ZIP | `44a1c4793a3820f5ee7337dc2eccd178dc98af92d967e0c8be10ecdaa212d7fb` |
| Configured manifest | `8966004f6297f2bad4089edd3644da271bf6b622d09ad68c61a5927263a8758c` |
| Overlay patch | `21c8b59d2740788ef5062b69766d88e4bc3f8cd136396a4e15f6a3857286f7b7` |

The single command was `vercel deploy --prebuilt --prod --skip-domain --yes --cwd /tmp/mica-publication-05-exact --scope team_txwalREE56wdO0c6DX4hfwjQ`. Candidate URL: `jordan-pokemon-ihe5ws10w-earouse23-devs-projects.vercel.app`; state ERROR at platform function validation. No runtime acceptance is possible for this candidate.

## Preserved production and backend

Live URL remains [Mica](https://jordan-pokemon-app.vercel.app), READY deployment `dpl_5rZyi9juErBWXNjzKYtetDb2DYap`, existing commit `08854a6613b8cefdbe0c2e0a006f356bf8d56639`. Read-only project metadata and **both actual alias records** independently confirm the old deployment remains assigned. Candidate metadata lists an automatic alias name, but actual alias assignment did not change. The existing live static page returns HTTP 200; no provider/API probe was made against old code.

The old deletion cron (`15 5 * * *`) **and old price-sync cron (`0 5 * * *`) remain unchanged**. The proposed deletion-only schedule and hard provider holds are not live. No old code was restored; no new provider request was made. Do not describe this as a successful held-provider release or automatically roll back to old provider behavior.

Supabase was queried read-only: 83 public tables / 83 RLS tables; four buckets, zero public; zero research examples/partitions; 58 migration-history inventory rows; anon/authenticated cannot execute the shared refresh function. The first metadata query used an incomplete function signature and returned a read-only lookup error; the correct `(uuid,text)` signature then passed. Accepted ACT03 preservation/rehearsal evidence remains reused; no synthetic write or SQL rerun occurred. No customer rows, credentials or recovery data were published.

## Local source reconciliation and verification

On existing branch `codex/mica-baseline-reconciliation`:

- `4c4e2d9`: 174 source/support/test files reconcile collector/copy/capture/history/privacy work, completed native source, deferred internal certificate source and retained provider implementations. Includes the accepted runtime overlay, public-only configuration, deletion-only cron and hard holds.
- `eaac560`: 21 SQL/test/rehearsal files record the already activated additive collector scripts and shared research consent correction. Historical migrations and frozen SQL bytes remain intact.
- A third local documentation commit records safe packet/handoff/report material and this blocked publication evidence. **None of these commits has been pushed.** Remote branch remains `88c10ed6d2bde92632def81182f48f0e4d192e00`; no new GitHub commit URL exists yet.

Staging used an explicit file allowlist, not all-worktree staging. Environment files, ZIP/build outputs, native generated dependencies/runtime files, local recovery/customer evidence and unrelated visual/research outputs were excluded and preserved. Credential/private-key/service-role token scan passed selected files. Documentation retains intentional Markdown hard breaks and the exact hashed patch whitespace.

Inspected both existing GitHub workflows: quality tests on main/PRs and an isolated local Supabase identity gate on this branch; neither deploys hosted code or database changes. Vercel Git integration tracks main. The minimal source-only publication guard is `git.deploymentEnabled: false`, using [Vercel's existing setting](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments); it prevents Git auto-builds when this source is pushed. No hosted Git setting or new CI infrastructure was changed. The approved deployment ZIP remains unchanged.

The other source-only change makes `npm run build` use `--release-config`, validates the accepted public JSON through the existing public configuration validator, skips environment-file loading and disables source maps. Future web builds preserve the reviewed public Supabase/API configuration; server credentials stay server-only. A normal local build succeeds. Chunk filenames vary with the build directory, so its bytes are not represented as the frozen prebuilt artifact.

New offline `node scripts/verify-release-holds.mjs` passes all eight holds with populated synthetic provider credentials, zero network calls, correct public configuration, deletion authentication/cron and the Git build guard. Certificate-fixture exclusion passes. Astra's accepted configured-artifact verification was reused unchanged.

A diagnostic source unit run passed 450 tests and failed 18: existing assertions expect enabled provider endpoints, credential-dependent responses, paid lookup preference, old capability state or the prior service-worker cache name. The accepted overlay deliberately changes these behaviors. **Assertions were not weakened or deleted; the broad suite is not claimed to pass.** Aligning retained-provider implementation coverage with held shipping routes remains a review gate. Read-only metadata does not prove login, save/reopen, private Storage, device, provider or user acceptance.

## Astra continuation gate

The smallest likely packaging correction is to route the eight held HTTP surfaces to a shared held function through existing Build Output routing, preserving their URLs/CORS and keeping deletion authentication/handler independent. This could fit the existing plan without enabling providers or reducing customer functionality. It requires a new separately hashed artifact and review; it was **not implemented or uploaded** here. Do not authorize a paid-plan upgrade by implication or retry the same 16-function artifact.

After Astra reviews that bounded packaging/test correction, resume candidate → READY/read-only checks → promotion → Git push → final deployment/automation verification. Elliott's standing routine publication authority remains in force; spending, destructive migration/new platform, native signing/callbacks, subscriptions/App Store and CLIENT-08 remain separate. No next feature packet started.

Machine-readable outcomes and alias evidence: [publication-outcome.json](sol-release-publication-05/publication-outcome.json), [hosted-outcome.json](sol-release-publication-05/hosted-outcome.json), [alias-outcome.json](sol-release-publication-05/alias-outcome.json).
