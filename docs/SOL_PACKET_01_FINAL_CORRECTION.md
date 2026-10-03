# Sol Packet 01 — remaining raw/graded compatibility correction

Astra decision: REVISE. R1–R3 are closed; retain those fixes and the revised layout.

Read `docs/evidence/ASTRA_PACKET_01_REVISION_REVIEW.md`. Implement the following bounded correction, preserving all existing work. Do not start Packet 02, add providers/dependencies/migrations, or deploy.

## R4: reject graded evidence for raw requests

`selectReferenceQuote` currently accepts a PSA 10 quote as a condition-neutral fallback for raw Near Mint when no raw quote exists. The review contains a runnable reproduction.

Exclude graded observations from every raw selection path. Preserve valid condition-neutral raw evidence where the established policy allows it. Check related evidence/confidence calculation for the same raw/graded boundary. Sol chooses the smallest coherent technical fix.

Acceptance:

- A raw request supplied only PSA/BGS evidence stays unavailable, including null/absent/empty raw-condition labels. It cannot use the slab value in the hero, a matching-source row, or its confidence support.
- Mixed raw/graded quotes in either order select the compatible raw record; an exact graded request still selects its company/grade.
- Unit regression tests cover the selector and relevant evidence calculation. One rendered-profile regression offers only graded evidence to a raw selection and proves the raw value stays unavailable after the response completes; switching to the correct graded context then shows the graded value.

## Terminal-state and label corrections

After a completed response with no compatible quote, show an unavailable/missing terminal state rather than `Checking this card version`. Preserve loading copy only during pending requests and distinct retry behavior on error. Display the provider's `firstEdition` token as `1st Edition` without changing identity or canonical matching.

## Return

Update `docs/evidence/SOL_PACKET_01_REPORT.md` with this correction's changed files, exact tests/results, terminal-state screenshot, and limitations. Run targeted pricing/profile tests and required checks appropriate to the changes. No repeated broad audit or new layout work is requested. Stop for Astra review.
