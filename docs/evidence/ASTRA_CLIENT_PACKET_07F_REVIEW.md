# CLIENT-07F — Astra rehearsal review

2026-09-29. **ACCEPT the bounded local reconciliation/rehearsal deliverable; do not authorize hosted SQL or deployment.** Proceed to CLIENT-07G release gate closure.

Astra read the consolidated report, object reconciliation, exact local result JSON, activation bundle, subscription proposal and migration-check implementation. Independently verified `collector-upgrade.sql` SHA-256 `ee45c20b673437deeab7728ce035530a58fd7eeacbdde063599e00dbba8c6fe6` and reproduced `npm run check:migrations` exit 1 for pending-name baseline drift. Astra did not rerun the owned DB rehearsal or independently audit every line of the 222 KB assembled SQL. Acceptance is of the documented local milestone, not production certification of all backfill cases.

Sol's preservation, owner/private-photo isolation, sealed native-currency acquisition/sale/history and synthetic valuation retry results are accepted as reported controlled evidence. The rehearsal matched selected hosted metadata and used synthetic records; it does not establish production cardinality/collision/lock behavior or backup recoverability. The artifact transforms existing identity/observation/history data and is not merely empty-table creation. It is single-run; repeat execution fails atomically, not idempotent success.

## Remaining release blockers and next actions

- **Pending-name guard:** the August inventory omits `graded_physical_copies`, `complete_graded_physical_copy_sale`, and `deliver_device_alerts`. Authorize a local bookkeeping update only after verifying provenance/hash and classifying these names. This records their presence as pending; it does not approve their hosted execution. The alerts migration remains outside the collector SQL. Preserve recorded production versions/duplicates and strict unknown-file detection.
- **Whole artifact compatibility:** ten local-only migrations were excluded, while the current dirty app contains related features. That may be correct, but prove the actual release artifact can load and preserve required auth/profile/settings/privacy/pregrading and collector surfaces on the proposed post-upgrade schema. A collector-only route probe cannot establish full retained-feature compatibility. Add only demonstrated essential dependencies to a revised, separately hashed/rehearsed candidate; never silently ship a wider SQL tail.
- **Recoverability:** dashboard evidence establishes no scheduled Supabase backup, not absence of every possible manual backup. Elliott was asked for the location/date of his earlier backup. Validate recoverability and Storage-byte coverage before data-writing activation. No private export or restore is authorized by that question.
- **Release identity/subscription:** client Apple identity/device authority and subscription business decisions remain unresolved. Keep the concrete proposals available, avoid duplicate research, and do not invent configuration, prices or free limits.

Sole active packet: `docs/SOL_CLIENT_PACKET_07G_RELEASE_GATE_CLOSURE.md`. No hosted change, paid plan, private-data export, Apple action, commit, deployment, CLIENT-08 or store submission is authorized.
