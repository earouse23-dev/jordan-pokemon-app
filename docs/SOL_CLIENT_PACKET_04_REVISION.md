# Sol CLIENT-04 revision — capture recovery and evidence consistency

Use `ponytail:ponytail` in **full mode**. Read its installed SKILL.md before work: `/Users/elliottrouse/.codex/plugins/cache/ponytail/ponytail/4.10.0/skills/ponytail/SKILL.md` (locate its installed replacement if updated; report unavailable rather than claiming use). Reuse existing implementation and make the smallest correct change. Do not reduce client functionality, official certificate integration, preservation, security, accessibility, tests, evidence or approval gates.

Read AGENTS.md, both required Mica roadmaps, the original CLIENT-04 packet, Sol's report and `docs/evidence/ASTRA_CLIENT_PACKET_04_REVIEW.md`. This is a revision of the same active packet, not a new roadmap step. Preserve the dirty worktree and existing acceptance safeguards. Sol remains the application-code writer.

Implement R1–R4 in the Astra review:

1. Repair pending-review retake cancellation and prove a replacement capture succeeds. Test that stale completions cannot modify a newer attempt. Inspect the same shared state across retake, close, switch and account changes; avoid per-caller patches.
2. Restore manual shutter recovery within automatic sessions while retaining automatic quality gates, mandatory correction/review when needed, grading abstention and explicit inventory save.
3. Keep applied corners, source bounds and evidence provenance consistent. Draw adjustable geometry on the original preview. Recompute safe original-image bounds, invalidate stale automatic geometry claims after manual edits, and prevent unverified perspective from producing trustworthy deterministic centering. Prove the pixels sent for condition assessment include the corrected envelope and remain unwarped; retain transform metadata and correct dimensions. Cover no-detection recovery as well as edits to a successful detection.
4. Add focused behavioral coverage for camera switch, visibility interruption, supplemental full-card/detail paths and the real processed-image-to-recognition request boundary with stubbed provider responses. Attempt a supported WebKit local-video harness; explicitly report any unresolved harness gate. Preserve detail frames, grading multi-view requirements, identity language/half-grade/certificate strings, owner isolation and explicit-save semantics.

Use Astra's diagnostic probe to reproduce R1–R3, then put durable assertions in the existing relevant tests. The probe's successful process exit alone is not acceptance: inspect its outcomes. Do not overwrite Astra review evidence to imply it originally passed.

Run affected tests while iterating. After stabilization, run the original packet's final checks once, reporting passes, failures and skips separately. Update `docs/evidence/SOL_CLIENT_PACKET_04_REPORT.md` with an R1–R4 closure table linking exact code/tests and updated visual evidence. Separate independently runnable local evidence from physical-device/provider/consented-image gates. Refine the benchmark definitions noted in Astra's review before any real measurement; do not collect or run it in this revision.

All original boundaries remain: zero external provider test budget; no production deployment, hosted writes, new production dependencies, paid services, native/platform change, migration-history repair, commits or CLIENT-05. If a dependency/platform change is necessary, provide the smallest concrete proposal for approval without weakening requirements. Stop for Astra ACCEPT/REVISE/BLOCKED review.
