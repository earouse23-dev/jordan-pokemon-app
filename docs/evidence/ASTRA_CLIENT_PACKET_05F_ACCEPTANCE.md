# Astra CLIENT-05F local acceptance

**ACCEPT for the approved indicative USD/EUR display slice.** The report records Elliott's explicit approval-bearing implementation prompt. No deployment, transaction conversion or broader FX approval is implied.

Reviewed fixed-source API transport and cache, full supported XML structure extraction, rate/date/provenance validation, conversion directions, and native-result/request guards in the actual detail UI. The stable native fingerprint avoids invalidating a pending rate on unrelated rendering. FX preserves native evidence and has its own failure/freshness state. No blocking issue found within this review scope.

## Independent checks

- `node --test tests/fx.test.js tests/fx-api.test.js tests/exact-sold-valuation.test.js tests/pricing.test.js tests/client-05-revision.test.js`: **68 passed**.
- Focused CLIENT-05F physical-copy browser cases: **12 passed in 15.1 seconds**, across desktop Chromium, mobile Chromium and mobile WebKit. These cover conversion/native separation, UTC-midnight expiry, pending unrelated rendering, failed refresh/retry, replacement native values, and account/route/copy/toggle response guards.
- Shipping certificate exclusion: **passed across 25 existing build files**; Astra did not rebuild.

Browser verification used a temporary copy of the existing spec/config with source imports preserved and output paths redirected, a dedicated local server on port 4197 and external request blocking. Existing fixture routes supplied rates and sales. No checked-in Sol screenshot was overwritten. Temporary output: `/var/folders/2_/v5kbdt0j0p3131zbc3c78mwm0000gn/T/mica-05f-astra-qaslxc7r/`.

Sol's full 439-unit/57-browser runs, lint/typecheck/build/formatting are reported evidence, not independently rerun in full. Astra did not contact ECB or a paid provider. Local passes do not establish current live feed compatibility or real-sale accuracy.

Reviewed SHA-256:

- `lib/fx.js`: `2596780a21c0a9146c1f7138ad5805f422606246c6ba544b86091a73db63608d`
- `api/fx.js`: `667b377442de501aef7d8503e30579728ed0c3a92ef489b1988e4683856064da`
- `app.js`: `cb49d1a08500767668588f37ff7c94c0247fa7f720f19ade85ba537ab2ba5251`
- `tests/browser/physical-copies.spec.js`: `2e4ad8ef4ca5f129a84bf7ec06e563c28ee02375d76c2ccd16a9cded60f26e39`

## Next gate

Issue CLIENT-05G for a single public ECB response through the actual route and an offline UI replay using synthetic native sales. Do not repeat the insufficient paid-sale probe. Positive numeric real-sale evidence, production canonical mapping, provider retention/display rights, real-photo/device/recognition and release gates remain open. CLIENT-06 is not issued. No application code was changed during Astra review.
