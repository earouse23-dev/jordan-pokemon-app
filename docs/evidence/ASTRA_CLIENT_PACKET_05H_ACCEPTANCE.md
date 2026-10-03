# CLIENT-05H — Astra local acceptance

Date: 2026-09-24. Decision: accept R1–R3 for the local detailed-printing slice. Supersedes the REVISE decision in `ASTRA_CLIENT_PACKET_05H_REVIEW.md`.

The observed API `variantId` now supplies the stable source reference. Language arrays, foil restrictions and documented stamp spellings are preserved conservatively. Missing or conflicting edition/stamp facts remain unresolved. Removal of a selected detailed source record preserves that selection for review instead of silently selecting another printing. The corrected Sol report distinguishes constructed fixtures from observed source facts.

## Independent review evidence

- Unchanged `node docs/evidence/sol-client-05h-astra-probe.mjs`: **4 passed**, closing the four original failures.
- `node --test tests/detailed-printing.test.js tests/identity.test.js tests/catalog.test.js tests/pricing.test.js tests/exact-sold-valuation.test.js tests/client-05-revision.test.js`: **89 passed**.
- Isolated replay of the `CLIENT-05H` physical-copy browser case: **3 passed**, desktop Chromium, mobile Chromium and mobile WebKit. Temporary harness used port 4197 and separate output; an initial temporary import-resolution error was corrected before tests ran. Repository application/test source was not changed by Astra.
- Shipping certificate exclusion: passed across **25** build files.
- Reviewed normalization, selection, snapshot and hydration code. No application changes were made during this review.

Sol separately reports 442 unit passes/one guarded database skip, 105 browser passes/nine existing skips, lint, typecheck, build and formatting. Those full suites were not independently repeated by Astra. Browser replay and fixture hydration do not establish real database persistence.

## Reviewed file hashes (SHA-256)

| File | Hash |
| --- | --- |
| `app.js` | `fdc28e6b72a3f254b3d0c43d4b2be165f74819a4dcbdbca9a847c525073e75f2` |
| `lib/identity.js` | `0ad44dca57b2ed7a72923cad22e6d8059a5e74a446d60ec24e81c28335f34412` |
| `lib/providers/tcgdex.js` | `cfb1131afd4b3f384f8a00d12123d2cdd1f6e34c0115982f20a86a082de8ca78` |
| `lib/supabase-data.js` | `88c21754eabad2a47c86b3a648f5287713b02f5b9cfe22982c923caa3cb1a1de` |
| `tests/detailed-printing.test.js` | `f0c1a75abc3c144b47d1166b2a26e91f9088e89a1e6444bc4a506fb74dc8c5de` |
| `tests/browser/physical-copies.spec.js` | `7a24337763a2ea4d71aa79850b29eb68e4b5014dce6f41f96afc773aa242c5cb` |

## Limits and next gate

The observed Pikachu remains unresolved and must not receive an exact estimate. Positive real-sale numeric validation, cross-provider canonical mapping, provider production retention/display rights, real-photo/device and release gates remain open. No paid-provider budget is renewed; CLIENT-06 is not issued.

The next bounded Step 5 packet is `docs/SOL_CLIENT_PACKET_05I_PRINTING_PERSISTENCE.md`: prove the new printing snapshot survives actual isolated local database save and fresh-session reopen. CLIENT-03's prior persistence proof predates this mapping and cannot substitute for that check.
