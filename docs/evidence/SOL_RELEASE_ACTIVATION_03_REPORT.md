# SOL release activation 03 — hosted SQL completed

**Outcome: the approved correction → exact frozen 07F → exact frozen 07G sequence succeeded on existing Supabase `kdkzdflrxajfdcithrfj`. Stop for Astra review; no deployment occurred.** Elliott explicitly approved adding the correction in this chat before execution. Ponytail FULL, AGENTS.md, current roadmap/pivot, Supabase skill and ACTIVATION-02 were followed. Existing actual-data rehearsal and 32-request compatibility evidence were reused; hosted verification was read-only, with no synthetic hosted writes.

## Executed artifacts and outcomes

| Order | Exact artifact | Executed SHA-256 | Outcome |
| --- | --- | --- | --- |
| 1 | [Consent correction](../../supabase/migrations/20261001015858_research_session_consent_boundary.sql) | `26df96999112f96e2afb72e291d5d63a5ee0546365ee6d30cf0ed91ebdbb011d` | Once; success; zero SQL errors; verified before 07F |
| 2 | [Frozen 07F](sol-client-07f/collector-upgrade.sql) | `ee45c20b673437deeab7728ce035530a58fd7eeacbdde063599e00dbba8c6fe6` | Once; success; zero SQL errors; verified before 07G |
| 3 | [Frozen 07G](sol-client-07g/retained-surface-delta.sql) | `6827663e43d47e6b40debff2625b1fa38377358736fd72e6f70cb593bb6f7162` | Once; success; zero SQL errors; final verification passed |

Each unchanged file, including its BEGIN/COMMIT, was submitted separately through installed Supabase CLI 2.117's `db query --linked --project-ref kdkzdflrxajfdcithrfj --file … -o json`. Each returned exit 0 and zero result rows; subsequent independent reads confirmed the committed schema/function changes. Hashes were checked immediately before execution and again afterward. There were no transaction retries, SQL edits, trigger disabling or automatic restores. The existing migration-history table remains 58 rows: direct reviewed activation did not repair/rewrite history or apply the numeric migration tail. The local reconciliation checker still passes; its pending-name list is bookkeeping, not a statement that these reviewed SQL effects are unexecuted.

## Preflight and preservation/privacy verification

Read-only target lookup confirmed `jordan-pokemon-app`, us-west-2, ACTIVE_HEALTHY, PostgreSQL `17.6.1.141`. All nine [schema fingerprint](sol-release-activation-01/read-only-schema.sql) scopes matched the retained baseline before execution: columns, constraints, policies, functions, selected grants, complete migration rows, indexes, triggers and buckets. No other active transaction or lock wait was observed; this was not a contention guarantee. The relevant current Supabase changelog was checked; no database/platform upgrade was performed.

Fresh hosted aggregates reused [ACTIVATION-02's preservation projection](sol-release-activation-01/preservation.mjs), with the same original columns and exclusions. **All 104 original base tables matched before and after each transaction: zero differences.** This preserves original ownership, financial facts and object metadata within that projection. Exclusions remain additive columns, public `updated_at`, the approved `softwareMode` preference key and the new private attachment bucket; sequence state and every service setting are outside the assertion.

| Check | Before | After correction | After 07F | After 07G |
| --- | ---: | ---: | ---: | ---: |
| Research examples / physical-card partitions / pilot audit events | 0 / 0 / 52 | 0 / 0 / 52 | 0 / 0 / 52 | 0 / 0 / 52 |
| Public tables / tables with RLS | 56 / 56 | 56 / 56 | 77 / 77 | 83 / 83 |
| Private / public Storage buckets | 3 / 0 | 3 / 0 | 4 / 0 | 4 / 0 |

Final retained counts remain **2 Auth users, 14 items, 16 transactions, 14 purchase lots and 2 Storage objects / 134,532 bytes**. Normal-session and unretained-capture research-example counts are zero. Item canonical pointers are non-null and reference valid canonical identities. The one remaining NOT VALID grading-result constraint is the existing historical `collection_transactions_grading_result_check`, documented in its original migration; it was not silently validated or removed. The graded-copy quantity correction is not that constraint.

The hosted correction's function body matches the reviewed SQL exactly, both immediately afterward and after 07G; it remains security invoker with empty search path and EXECUTE denied to anon/authenticated, allowed to service_role. 07G report-save, account-withdrawal, delivery-claim and notification-preference bodies also match the frozen artifact exactly. Verified-valuation, account-withdrawal and delivery-claim service functions deny anon/authenticated and allow service_role; Auth email SELECT has the same service-only boundary. Confirmation/replay, withdrawal/quarantine, owner isolation, sale retry and currency behavior retain [ACTIVATION-02's tested local evidence](SOL_RELEASE_ACTIVATION_02_REPORT.md). No hosted mutation tests were used to claim new end-to-end acceptance.

Private execution responses, stderr and aggregate evidence are retained outside Git under the protected recovery directory's `hosted-activation-03/`, directory mode 0700 / files 0600. Credentials, customer rows, emails, identifiers and capture payloads were not published. The original recovery set and frozen source/manifest remain intact. No provider spending, paid service, commit or CLIENT-08 work occurred.

## Concrete next deployment approval request

**Prepared for Elliott after Astra review:** approve configuring and releasing the exact curated 07G web/API source from [release-snapshot.zip](sol-client-07g/release-snapshot.zip), SHA-256 `391b748260cf17124cded8dc18960b23b8e020af3f178aa899d0f84d3dd33b47`, with [manifest](sol-client-07g/release-manifest.json) SHA-256 `4e1710477b1af0846532cf906315f3f48b81878857b6b0d7c729f9970614dc58`, to existing Vercel project `prj_ICSEVLitTA6RdwTTy14BThiAvPEQ` / team `team_txwalREE56wdO0c6DX4hfwjQ`. Both hashes were reverified. The manifest contains 84 runtime source files and 28 neutral output files; internal certificate fixtures, subscriptions, native signing material and the six omitted SQL migrations remain excluded.

Use public Supabase URL `https://kdkzdflrxajfdcithrfj.supabase.co`, that project's current public publishable key through a scoped channel, and API origin `https://jordan-pokemon-app.vercel.app`; server secrets stay server-only. **The neutral ZIP is not a configured production binary:** prepare and review the configured build/output hash and exact configuration before deployment. Native `/auth/native-return` allowlist/AASA changes require exact Apple team/bundle inputs and separate reviewed authority; no missing native gate is waived by SQL success. Unapproved paid/provider routes and scheduled paid calls remain outside authority.

Read-only Vercel lookup reconfirmed the READY current production/rollback deployment `dpl_5rZyi9juErBWXNjzKYtetDb2DYap`, source commit `08854a6613b8cefdbe0c2e0a006f356bf8d56639`. A future rollback may restore that web/API alias only under deployment authority while retaining additive schema and customer records. No backfill reversal or database restore is automatic.

Remaining gates: Astra acceptance of this hosted evidence; Elliott's separate configuration/deployment approval and configured-artifact review; separately authorized fresh-login/private-Storage/device/camera/callback checks and live-provider evidence where required. Synthetic hosted accounts, TestFlight/App Store actions, signing, spending and CLIENT-08 remain unauthorized. **Stop for Astra review.**
