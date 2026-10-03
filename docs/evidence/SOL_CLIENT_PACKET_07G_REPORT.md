# CLIENT-07G — local release gate closure for Astra

**2026-09-29 · Review requested. Hosted activation is still blocked.** I read the installed `ponytail:ponytail` SKILL.md first and used its FULL-mode reuse/minimal-change rule. I read `AGENTS.md`, both required roadmaps, the September 29 release direction, 07G packet, 07F report/artifacts, Astra's 07F review, and the installed Supabase/deployment skills. I preserved the dirty worktree and the accepted 07F SQL/evidence. No hosted write, private-data export/restore, environment-file read, provider request/credit, paid plan, new production dependency, Apple action, deployment, commit or CLIENT-08 work occurred.

## 1. Migration inventory guard

The three missing names and hashes match [the 07F reconciliation](sol-client-07f/object-reconciliation.json), [CLIENT-03's graded-copy report](SOL_CLIENT_PACKET_03_REPORT.md), and earlier 06B/06C hash ledgers:

| Name | Current source SHA-256 | Classification |
| --- | --- | --- |
| `graded_physical_copies` | `304d980863f55a59b153c24010dd9dbd38e64a0f800fea0dfdeaa5d4f1d606c3` | Collector dependency in 07F SQL |
| `complete_graded_physical_copy_sale` | `c2e88ec2d1012eb04f0d79d4b36d3ecd4d1a9b5b1769af9d70d7ab6e3e77298e` | Collector sold-quantity constraint in 07F SQL |
| `deliver_device_alerts` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | Empty placeholder; pending and excluded |

I updated only the local approved-pending name list, count/date and classifications in [the reconciliation inventory](MICA_MIGRATION_RECONCILIATION.json). Its previous August capture date remains recorded; the immutable production migration capture, historical version mismatches, duplicate `psa_deletion_worker`, SQL filenames and checker are unchanged. `npm run check:migrations` now passes: **75 local files, 58 hosted-history rows, 18 approved pending names, 51 distinct version-mismatch entries**. In `/tmp/mica-client-07g-guard`, an isolated copy of the same checker/inventory plus `20260929999999_unreviewed_test.sql` exited **1** with “Pending local migration names differ from the approved baseline.” The list records known pending files; it grants no permission to execute them.

## 2. Curated candidate artifact

[The release ZIP](sol-client-07g/release-snapshot.zip) contains **84 explicit web/API runtime source files and 28 neutral static output files** (112 ZIP entries), with per-file hashes and sizes in [the manifest](sol-client-07g/release-manifest.json). The [reproduction script](sol-client-07g/build-release.mjs) copies only the allowlisted runtime paths to `/tmp/mica-client-07g-release`, links already installed local dependencies for building, invokes the current build script with `--neutral-public-config`, normalizes archive timestamps and creates the ZIP. Two consecutive builds returned identical SHA-256 values: ZIP `391b748260cf17124cded8dc18960b23b8e020af3f178aa899d0f84d3dd33b47`; manifest `4e1710477b1af0846532cf906315f3f48b81878857b6b0d7c729f9970614dc58`. The public config contains empty Supabase URL/key. `verify-certificate-exclusion.mjs --root=/tmp/mica-client-07g-release/dist` passed across 31 output paths; internal certificate fixtures, tests, docs, environment files and provider payloads are absent. This is a reproducible **neutral web/API source snapshot**, not a configured/signed iOS binary or deployed build. Its exact inclusion and six omitted SQL-name decisions are recorded in [the approval bundle](sol-client-07g/activation-approval-bundle.md).

## 3. Measured compatibility and smallest repairs

The clean owned stack `/tmp/mica-client-07g-final2` used the same 57-file selected hosted baseline as 07F, plus synthetic pre-upgrade owners/records. I applied **the unchanged** [07F collector transaction](sol-client-07f/collector-upgrade.sql), SHA-256 `ee45c20b673437deeab7728ce035530a58fd7eeacbdde063599e00dbba8c6fe6`, followed by [a separate atomic retained-surface delta](sol-client-07g/retained-surface-delta.sql), SHA-256 `6827663e43d47e6b40debff2625b1fa38377358736fd72e6f70cb593bb6f7162`. No hosted migration history was altered. The delta composes four existing source migrations: `software_modes`, `dependable_action_center`, `withdraw_account_training_before_deletion`, and `preserve_confirmed_grading_reports`; it adds one narrowly scoped `service_role` grant for `auth.users(id,email)` required by the current maintenance delivery claim. Local privilege checks returned **false/false** for `anon` and `authenticated`, **true/true** for `service_role`. The rest of the 07F-excluded tail remains excluded.

Before the delta, actual `loadActionCenter`, alert preference RPC and `recordSoftwareModeEvent` against the 07F-only schema failed with missing table/function errors, while profile, organization, portfolio, grading-report and consent reads passed. After the exact delta, all those reads/writes passed. The existing `api/maintenance.js` route initially returned 500 because `claim_action_deliveries_service` lacked permission to read Auth recipients. After the column grant, the **candidate route** returned 401 without its local synthetic cron secret and 200 with it; zero deliveries were claimed/sent and no outbound provider was used. A synthetic raw card could create a grading scan and reappear in owner-only recent activity; the other signed-in owner did not see it.

I also demonstrated a data-preservation defect before adding `preserve_confirmed_grading_reports`: replaying `save_grading_scan_report` after confirmation changed `estimate_status` from `confirmed` to `estimate` and replaced the report marker `original` with `replayed`. The same executable probe after the fix returned the same prediction ID while preserving `confirmed` and `original`, both on the incremental probe stack and on the clean final combined rehearsal. This is why the fourth migration is in the delta. The current [account route](../../api/account.js) previously inventoried only three grading-photo buckets during deletion; I added the new private `collection-item-files` bucket. With a disposable synthetic account, the candidate route returned 401 without auth, 400 on wrong email confirmation, then 200 on correct confirmation; its private synthetic collection photo and user account were removed. No real account was touched.

The clean final rehearsal preserved **3 pre-upgrade positions, 4 transactions and 3 lots**, including USD/EUR acquisition, prior sale and unknown cost. The 07F verify script then passed owner RLS, private Storage, fresh login, graded create/sale retry, USD realized **$26**, EUR realized **€15**, unknown-basis honesty and service-only 06C guards (wrong owner/session/context/revoked session denied). Through the **compiled candidate web artifact** plus real local Auth/PostgREST/Storage, a synthetic account loaded its collection and profile, entered a manual ETB with a synthetic canvas photo, saved it, sold it, and reopened it through fresh local login. A second owner could not read its attachment. The new USD sale added exactly **$10** realized gain (latest local total $36). Account settings showed durable alerts, privacy controls and a Seller mode switch that persisted across reopening. The browser blocked all external hosts and returned offline responses to provider routes: 135 local backend requests, **0 external requests, 0 page errors**. This is local browser/backend proof; synthetic photo content is not real recognition evidence.

| Retained requirement | Local evidence and limit |
| --- | --- |
| B03/B04/B09 collector save/photo/sale/reopen | Compiled browser → real disposable Auth/Storage/RPC; synthetic ETB, owner-private photo, fresh login, sale; 07F graded-copy retry also reran |
| B06/B07/B10 history/P&L | Production history function on local records; native USD/EUR separated, unknown basis retained; browser sale adds $10 USD without a fabricated market value |
| B11 auth/profile/settings/privacy/account | Candidate browser auth/profile/mode/alert/privacy surfaces; actual maintenance and account routes; synthetic account erasure removes collection photo; no real hosted user tested |
| Pregrading entry/history | Raw-card scan entry and owner-only recent activity; confirmed-report replay immutability regression passed after delta; no live model or physical camera proof |

Focused final checks: `npm run check:migrations` pass; 80 security/maintenance/software-mode Node tests pass; JavaScript syntax checks pass; shipping-certificate exclusion pass. The full unrelated suites were not repeated. The scripts in [07G evidence](sol-client-07g/) and exact SQL/ZIP/manifest hashes make the local run reviewable. The final disposable stack remains at `/tmp/mica-client-07g-final2`; `mica-dev` and the 07F rehearsal data were untouched.

The focused executable commands (in this order on a **fresh** owned stack before the browser adds its extra sale) were:

```sh
node docs/evidence/sol-client-07g/rehearse.mjs seed /tmp/mica-client-07g-final2
docker exec -i supabase_db_mica-client-07g-final2 psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/evidence/sol-client-07f/collector-upgrade.sql
docker exec -i supabase_db_mica-client-07g-final2 psql -U postgres -d postgres -v ON_ERROR_STOP=1 < docs/evidence/sol-client-07g/retained-surface-delta.sql
node docs/evidence/sol-client-07g/rehearse.mjs verify /tmp/mica-client-07g-final2
node docs/evidence/sol-client-07g/compatibility.mjs /tmp/mica-client-07g-final2
node docs/evidence/sol-client-07g/confirmed-report-regression.mjs after /tmp/mica-client-07g-final2
node docs/evidence/sol-client-07g/route-replay.mjs /tmp/mica-client-07g-final2
node docs/evidence/sol-client-07g/build-release.mjs
PORT=4188 node /tmp/mica-client-07g-release/scripts/serve.mjs # separate terminal
node docs/evidence/sol-client-07g/browser-replay.mjs /tmp/mica-client-07g-final2
node docs/evidence/sol-client-07g/account-route-replay.mjs /tmp/mica-client-07g-final2
```

The separate **before** confirmed-report probe ran on the owned 07G probe stack with the 07F SQL and the initial retained-surface dependencies, prior to adding the preservation migration; it produced `confirmed → estimate` and `original → replayed`. The final clean stack used the exact final delta from the beginning. Browser provider calls were intercepted as offline errors; no provider transport was contacted.

## 4. Backup, approval and remaining gates

Elliott's earlier backup is **owner-reported**, but no path/service, timestamp, checksum, format or Storage-byte coverage was supplied in this packet. I did not search private files or infer that no backup exists from the Free dashboard's absence of scheduled backups. [The no-paid manual recovery proposal](sol-client-07g/backup-recovery-proposal.md) specifies database/Auth/migration-history dumps, all Storage object bytes, encrypted destination/credentials, checksums, isolated restore validation, key handling and cleanup; no export/restore was run. Supabase's [backup guide](https://supabase.com/docs/guides/platform/backups) explicitly separates database metadata from Storage bytes, and its [CLI restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) describes logical dumps. The paid managed option is an alternative decision, not assumed.

[The concrete approval bundle](sol-client-07g/activation-approval-bundle.md) gives the ZIP/manifest/two SQL hashes, sequential same-stack activation, guard, backup gate and data-preserving stop/rollback boundaries. **First** review a supplied complete backup or separately authorize a bounded manual export/restore validation; **then** seek exact hosted SQL approval; **later** seek Auth/AASA/public configuration and deployment approval. The current neutral archive cannot authenticate against hosted Supabase. Apple bundle/team/signing/device authority, physical iPhone and live provider recognition/pricing remain unproved. The [07F subscription proposal](sol-client-07f/subscription-approval.md) remains unchanged: price, period, trial, free access/limits and existing-user treatment are Elliott's open business decisions; no StoreKit/product/entitlement work was started.

Six other pending migrations, including V3 pilot/calibration support and the empty device-alert placeholder, remain outside the candidate; related advanced/admin operations are **not certified** by the tested collector/account/pregrade surfaces. This packet does not assert whole-production cardinality, backup recoverability, configured native/device behavior or public-release readiness. Stop for Astra review.
