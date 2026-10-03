# Astra CLIENT-05H review — REVISE

Do not accept the detailed mapping slice yet. The current positive fixtures mirror an invented source shape closely enough to miss real contract errors.

## R1 — source contract mismatch

The public CLIENT-05C record observed and independently inspected by Astra used `variants_detailed[].variantId: jr7oetx1mqug9`. Implementation and reconstructed real-shape tests use `id` instead. With the observed `variantId` input, all detailed records are dropped and the code falls back to independent flags, losing the source reference. The 05H report's real-shape preservation claim is therefore not established.

The frozen schema also describes first edition via `stamp: ['1st-edition']` and prerelease via `pre-release`, whereas fixtures use a `firstEdition` subtype and `prerelease` stamp. Reconcile the actual public API/source schema at the adapter boundary rather than declaring synthetic spellings supported source fields. A legacy alias may be supported if explicitly distinguished and tested, but cannot replace the real contract.

## R2 — wrong-language and foil facts can become exact

The source schema exposes a `languages` array; implementation checks singular `language`. A complete synthetic detailed row restricted to `languages:['ja']` becomes exact English. The implementation also ignores `foil`; adding unsupported `foil:'masterball'` to a complete row still yields ordinary exact holo. Both erase distinctions relevant to sale eligibility, contradicting packet/report claims. Preserve source restrictions/treatments; unsupported or incompatible facts must prevent ordinary exact valuation.

## R3 — removed selection still silently changes when all details disappear

The missing-selection guard runs only when a current option carries detailed-variant metadata. After details disappear, fallback flag options cause a previously selected detailed ID to resolve to the first fallback option. The guard must also recognize the prior detailed reference independently of the current option list, including empty lists; preserve its unresolved identity instead of silently selecting another printing.

## Independent evidence

`node --test tests/detailed-printing.test.js tests/identity.test.js tests/catalog.test.js tests/pricing.test.js tests/exact-sold-valuation.test.js tests/client-05-revision.test.js`: **89 passed**. Additional offline probes reproduced all four failures above. Runnable assertions: `node docs/evidence/sol-client-05h-astra-probe.mjs`. No new public catalog/provider request, environment-file read or application edit was performed. Broad browser runs were not repeated because source/eligibility defects already require revision.

Issue the focused CLIENT-05H R1–R3 revision. Preserve the valuation policy, existing accepted FX work and remaining gates. No CLIENT-06 or live provider request is authorized.
