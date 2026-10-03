# CLIENT-05L — Astra review and corrected language-evidence contract

2026-09-25. Accept the measured identity stop and private evidence accounting. No numeric valuation gate passed.

Astra independently ran `node scripts/client-05l-replay.mjs`: all six frozen source hashes and the direct-gate/accounting reconstruction agree. One HTTP request, one reserved/reported charged credit, explicitEnglish false, no sales request or arithmetic. Astra inspected the private identity projection without copying it into repository artifacts. All other frozen direct facts match. The projection retained top-level field names but not arbitrary nested contents; it cannot establish absence of language throughout the original payload.

Astra independently ran the 05L/05K/05D/05B tests: **23 passed**. Sol's two-browser blocked-state replay remains attributed to Sol; Astra did not rerun it. The guard obeyed its frozen contract and protected the budget.

## Orchestration correction

The top-level `language === 'English'` prerequisite was too specific to an invented fixture shape. The [official card documentation](https://www.pkmnprices.com/docs/cards), reviewed 2026-09-25, documents a `language` filter on `GET /v1/cards`, while its direct-card response example has no language field. Astra should have validated that evidence route before authorizing 05L. This does not make unknown language English, and does not turn the stopped attempt into a pass.

Approve this narrow source-backed evidence rule for a new isolated experiment: membership of the **same exact provider card ID 20618** in a successful documented `language=English` list response can establish provider catalog language for that ID even if each row omits a redundant language field. Explicit contradictory language anywhere in the returned identity evidence rejects the match. Still require matching name/set/collector number/total; never accept a different ID or infer language from name, USD, an image or TCGdex route. This is a candidate-specific crosswalk proof, not a production fallback.

The retained 05L direct observation supplies first-edition holo association and direct identity facts; it need not be fetched again. One narrowly filtered list request can establish language membership. Only after that passes may a bounded sale request occur. Original 05L authorization is spent and ledger immutable; a distinct authorization is in `docs/SOL_CLIENT_PACKET_05M_LANGUAGE_AND_SALES_PROOF.md`.

No application, database or environment-file change was made in this review. No paid request was repeated. Private retention remains allowed. Positive numeric proof, production crosswalk/display scope and broader release gates remain open; CLIENT-06 is unissued.
