# CLIENT-06 revision — Partial local acceptance

2026-09-25. Accept the repaired calculation and UI boundaries for their tested scope; **CLIENT-06 remains incomplete because graded exact-sold persistence is not implemented.**

Astra independently reran the unchanged three-case probe: all pass. `node --test tests/portfolio-history.test.js tests/price-history.test.js`: **7 passed**. Inspected current portfolio eligibility and application exact-sale derivation: graded generic quotes/history are now excluded; the application obtains ready results through `exactSoldValuation` and its validated context. Event dates, numeric-cost checks and explicit membership uncertainty cover the original findings. The original A/B/C fixture is now clearly identified as raw reference-price evidence, not graded exact-sale persistence.

The six browser passes, disposable database fresh-login proof, 448 unit passes/two guarded skips and build checks are Sol-reported evidence, not independently rerun by Astra. The disposable proof demonstrates raw historical reconciliation and rejection of generic graded observations, not persistence of graded estimates.

The reported durability gap is accepted as a path limitation; the stronger claim that new schema is necessary is not yet established. Existing `position_price_observations` has `quality`, context and later provenance columns, and a server-only write boundary. Existing authenticated server patterns also exist. Review reuse before proposing a new table/column/RPC. Existing service-write access is not a reason to grant browser write access.

Issue `docs/SOL_CLIENT_PACKET_06B_DURABLE_GRADED_VALUATION.md` as the sole active packet: assess concrete reuse and implement the secure existing-schema path locally if feasible; otherwise produce exact minimal additive SQL for review, while completing independent contract/tests. No new migration application or hosted mutation is authorized. Positive live-price/display/device gates remain open; CLIENT-07 is unissued.
