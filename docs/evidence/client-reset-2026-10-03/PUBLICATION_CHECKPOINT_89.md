# Checkpoint 89 — scanned-card pricing and purchase defaults

The Zoroark GX 53/73 failure was in Mica's condition boundary. The scan supplied the valid internal enum `near_mint`; /api/cards rejected its underscore with HTTP400 before provider I/O. Repeating the exact catalog identity with `Near Mint` returned the image, nine quotes and 105 history records. A first staged browser check exposed a second boundary: the detail quote selector compared the internal enum literally with provider labels and withheld matching values. Both boundaries are now corrected, with exact known-condition translation and unchanged identity/finish/currency checks. Unknown and invalid values are not upgraded to Near Mint. No provider support contact was necessary.

New Add card entries assume purchase, default to the local current date, omit acquisition/tax/shipping/unknown-date controls and offer **Free (trade)** as explicit known zero cost. Unchecking Free restores the typed amount; an empty amount remains unknown. Historical methods and unknown cost/date flags survive interrupted-work/certificate recovery; existing records were not rewritten. A focused currency preservation check also caught a carried EUR draft defaulting to USD: the form now retains the card currency unless a draft currency overrides it.

## Verification

- 546 unit passes / 3 skips; 65 focused pricing tests. 146 distinct affected browser passes / 10 conditional skips across desktop Chromium, mobile Chromium and WebKit, including six internal certificate recovery checks. Lint 98 sources; syntax checks pass.
- The exact compiled candidate plus staged authenticated API renders Zoroark image/current price/history (105 points), preserves its internal copy condition, and uses the corrected provider-label request. The screenshot was visually inspected after image paint. Tests also verify one floating Add action, today/purchase/Free defaults and same-owner SDK visibility refresh while pricing is pending.
- Recognition is replayed with synthetic Zoroark analysis plus the actual public catalog; pricing, image and authentication are real. No fresh recognition accuracy, physical-device acceptance or live inventory-save acceptance is claimed.
- Staged health/configuration/authentication/CORS/hostile-origin/unknown-path/provider-hold checks pass. Nine functions and sole deletion cron remain. No SQL, customer inventory writes, new AI calls, dependencies, budgets or paid services. Browser background demo writes are intercepted.
- Curated frozen-release process; only `api/cards.js`, `app.js`, `sw.js` differ from checkpoint 88 source. 161 source/output entries scanned, zero private-content findings; 47 certificate-exclusion checks. Two builds match. The first candidate that lacked UI quote normalization and the second pre-currency candidate remain local evidence and were never canonical production.

## Final artifacts

- Deployment ZIP SHA-256: `1cd1c455e9c03cd352ffd2f11f24f95cf5063f98c467cace600001e644ea8b32`
- Source ZIP SHA-256: `5585766cf79ec3281048dec7aeb766b0592fca66996075e1412c9fc375ee2f93`
- Manifest SHA-256: `91e51f122c36a2e0d02a3725aa915b06c7fd0023805055753b1356cfd88cb574`
- Final candidate: `dpl_F2UY1RLUgpAqsXyJTSC4Y1xd9pzx`, READY, existing project `prj_ICSEVLitTA6RdwTTy14BThiAvPEQ`.
- Canonical: https://jordan-pokemon-app.vercel.app

Promoted successfully; canonical READY deployment and exact asset hashes verified after reconnection on October 9 UTC. The live authenticated browser shows the matching image, current price and 105 history records, with zero uncaught errors and no inventory writes. This live check took 11.535 seconds after match; the speed target remains unmet. Recognition was replayed, not freshly inferred. Git remote publication is recorded below after push. Existing Git deployment suppression and hosted ignored build `exit 0` are verified. The only schedule remains `15 5 * * *` at `/api/capabilities?surface=grading-deletion`; other paid jobs and grade/advisor/match/sealed-AI holds remain. Raw runtime logs and demo credentials stay private. No automatic rollback to older provider-enabled code.

Remaining: physical iPhone/new-photo/multilingual accuracy and save acceptance; external-provider/network availability and cold timing cannot be guaranteed. Native/store/subscription work remains separate.
