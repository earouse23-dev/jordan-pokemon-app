# Mica Step 2 goal prompt

```text
Goal: Complete Roadmap Step 2 as a software-only competitor benchmark, then verify
its exit gate before beginning Step 3.

Inputs:
- docs/MICA_SOFTWARE_ROADMAP.md
- docs/MICA_STEP1_CAPABILITY_AUDIT.md
- docs/MICA_STEP1_COMPLETION_APPENDIX.md
- docs/evidence/MICA_STEP1_VERIFICATION.md

Scope:
- Compare Collectr, Dex, Rare Candy, Shiny, DittoDex, PokeData, Card Ladder,
  PriceCharting, eBay Price Guide, Dragon Shield, Ludex, CollX, Double Holo,
  DeckTradr, InVelocity, SnapGrade, and CardGrade.
- Use current first-party workflows, app-store evidence, public demonstrations,
  and recent release evidence.
- Separate documented behavior, current product evidence, vendor claims,
  anecdotes, and unavailable paid/device-only behavior.
- Record shortest supported paths and compare fields/defaults, correction, batch
  behavior, search/identity, responsiveness, accessibility, offline/failure
  behavior, export, notification, portability, and recovery.
- Convert only valuable, evidence-linked gaps or confirmed Mica problems into
  testable software requirements with measurable acceptance targets.
- Produce parity, differentiation, and rejection lists.

Constraints:
- Do not make product vision, market, pricing-plan, marketing, or business-model
  decisions.
- Do not modify application code, dependencies, data, deployments, providers, or
  competitor accounts.
- Do not purchase paid access without approval.
- Do not infer exact workflow behavior from marketing copy.

Completion gate:
- Every proposed feature links to a documented competitor workflow or a confirmed
  Mica problem.
- Every requirement has acceptance criteria and a measurable target.
- No roadmap item exists only because a competitor lists it.
- Unknown paid, device, accessibility, and offline behavior remains explicitly
  unverified.
- The benchmark and source ledger are saved in the repository and pass document
  formatting, link, traceability, and Git hygiene checks.
```
