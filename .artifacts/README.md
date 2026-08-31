# Step 1 visual evidence

These files preserve the existing pre-reconciliation visual state. They contain no production account export or private database content.

- `step1-before-state/`: the complete Step 1 route set at desktop and mobile sizes. `*-local-*` files use a configuration-neutral build and synthetic authenticated markup; `auth-production-*` and `profile-404-production-*` are public production pages. See `docs/evidence/MICA_STEP1_VISUAL_EVIDENCE.md` for provenance and hashes.

- `production-add-desktop.png` and `production-add-mobile.png`: public Add workspace before reconciliation.
- `browser/production-collection.png`: public/synthetic Collection state used during the audit.
- `ux-collection-desktop.png` and `ux-collection-mobile.png`: current collection workspace layout references.
- `ux-add-desktop-settled.png` and `ux-add-mobile-settled.png`: current Add workspace settled-state references.
- `digital-grading-report-full-mobile.png` and `digital-grading-report-mobile.png`: synthetic grading-report layout evidence.
- `browser/collection-grade-empty-sheet.png`: empty grading launch state.

Authenticated production records were not opened to create these artifacts. Fresh signed-in evidence must be captured only in a disposable environment during the later authenticated release-verification work.
