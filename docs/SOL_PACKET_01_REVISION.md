# Sol Packet 01 revision — price compatibility and concise profile

Decision from Astra: **REVISE**, not accepted. Implement these three corrections only, then stop for review.

Read `docs/evidence/ASTRA_PACKET_01_REVIEW.md` for the evidence and `docs/SOL_PACKET_01_CARD_PROFILE.md` for the original scope. Preserve the current working tree and the successful parts of Packet 01. No new providers, dependencies, migrations, deployment, or Packet 02 work.

## R1: unresolved identity must not acquire an exact price

The provider's `firstEdition` option correctly has unknown finish, but the existing label-based pricing helper selects normal-finish evidence. Fix the profile's compatibility boundary using the structured identity and available authoritative mapping. Do not convert unknown into normal or first-edition non-holo through label parsing.

Acceptance: a provider-normalized first-edition/unknown-finish selection offered normal, first-edition-normal and holo quotes receives no exact estimate until its priced identity is established. Confirm that Add/Watch retain its unresolved identity. Verify a genuinely mapped exact variant can still show compatible prices. Extend the tests across normalization and the rendered profile, rather than asserting only the option's fields.

## R2: switching research context must not relabel an owned value

The profile resets research pricing but inherits the owned item's base live price while the next request is pending or fails. Separate the saved ownership summary from active research pricing/status. Every research amount must match its identity and context before rendering.

Acceptance: start with an owned raw NM card worth $10; select PSA 10 and hold the provider response. The research area must never show the raw $10 as PSA 10. Return an error, then retry and return $200. The research states must be honest throughout; the owned summary remains raw NM $10; no ownership mutation is sent. Cover the analogous condition change with delayed evidence and ensure late responses cannot replace the active context.

## R3: shorten the mobile identity section

Lead with name, one set/number line, language, selected variant and a compact uncertainty cue where needed. Put secondary attributes and the explanation behind optional details. Keep the value/unavailable result and context controls near the header. Remove repeated information rather than shrinking typography. Retain all important identity distinctions and existing tools.

Acceptance: at 390×844, the initial viewport includes the concise identity and price/unavailable result, with a reachable context control and primary action; no horizontal overflow. At normal zoom, keyboard focus and scrolling must make each control visible above the sticky action bar. Show 1440px desktop and 390px mobile viewport screenshots for normal and uncertain states; at least one uses a real working local fixture image. Full-page captures may supplement these. Replace the existing test's requirement for the exact long warning sentence with behavioral uncertainty checks.

## Return

Update `docs/evidence/SOL_PACKET_01_REPORT.md` with a revision section mapping R1/R2/R3 to changed files, precise tests/results, screenshots and remaining limitations. Preserve the original baseline and distinguish this revision's changes. Include failure/pending-state evidence for R2 and the provider-normalized regression for R1. Run affected tests plus repository-required checks proportionate to the changes. Stop for Astra's review; do not mark the packet accepted or advance to the next feature.
