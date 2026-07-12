# Data flow

1. Client requests signed upload authorization; server validates entitlement and creates a scan row.
2. Client uploads to a private per-user path. Server verifies file signature, dimensions, decoded size, orientation, and limits.
3. Identification extracts deterministic text/signals, retrieves a narrow catalog candidate set, and optionally reranks only allowed IDs using vision.
4. Client receives candidates/reasons and confirms, searches, or retakes.
5. Server creates collection item/owned copy in a transaction, independently requests compatible quotes, and returns success even if quote fetch fails.
6. Price adapters normalize and cache snapshots. Collection totals join only compatible variant/condition/grade basis and label partial valuation.
7. Scheduled jobs refresh shared snapshots, record provider health, deduplicate work, and expire scan objects.

Offline writes use an outbox with idempotency keys in production. Conflicts return field-level resolution; no silent last-write-wins for financial fields.

