# Sol CLIENT-04D — preserve source when geometry is rejected

## Authority

Use `ponytail:ponytail` in **full mode**. Read the installed SKILL.md before work (currently `/Users/elliottrouse/.codex/plugins/cache/ponytail/ponytail/4.10.0/skills/ponytail/SKILL.md`); report unavailable rather than claiming use. Read AGENTS.md, both Mica roadmaps and `docs/evidence/ASTRA_CLIENT_PACKET_04C_REVIEW.md`. Reuse existing code and test harnesses; make the smallest correct shared fix. Preserve data, security, accessibility, acceptance tests, evidence and approval gates. Preserve the dirty worktree.

This is the sole active Step 4 packet. Fix the demonstrated downstream geometry acceptance gap; do not tune the detector, add dependencies or start CLIENT-05.

## Required behavior

1. Trace every `prepareVisionImage` caller and every use of its image/identity/preview output and geometry measurements. Cover card grading, collectible identification and supplemental detail. Determine how accepted manual files carry transformed coordinates before changing their handling.
2. Geometry rejected as uncorrectable must not drive either rectangular source cropping or perspective correction. Retain the whole available input frame (ordinary bounded resizing/encoding is allowed), including its label, in fallback preview/evidence. Do not produce an identity derivative from the rejected bounds. Preserve original/retry access. Reuse existing actionable recovery; require manual correction or retake before sending a rejected document to recognition. Detail-only evidence remains supported without imposing a full-document requirement on intentional closeups.
3. Make returned provenance agree with actual pixels: no successful correction transform, verified boundary/perspective, background-excluded or applied-crop claims based on rejected geometry. Preserve diagnostics as unverified observations where useful. Do not enable condition/centering measurement from rejected geometry. Do not misrepresent manually adjusted geometry as automatic or verified condition evidence.
4. Preserve valid automatic correction and accepted manual correction, source coordinates, orientation, label preservation and quality blockers. Avoid double correction of an already corrected file. Treat missing/legacy geometry conservatively while retaining supported workflows; explain the chosen policy and its tests.

## Executable evidence

- Add a deterministic regression using existing tooling and an original synthetic image with distinct label/border markers. A controlled detector result may isolate the `detected: true, correctable: false` branch; state clearly that this proves control flow, not real-image detection. Show the check fails on the pre-fix app and passes on the changed app.
- Assert decoded output pixel content/frame retention, not only flags or dimensions. Cover fallback preview, prepared evidence and any identity derivative; prevent label loss by both bounds crop and projective crop. Cover `card` and `collectible` purposes and rejected capture metadata where applicable.
- Exercise the actual photo-assist consumer with local recognition stubs: rejected geometry cannot reach a ready-to-send state or emit a recognition request; correction/retry restores a usable path. Check representative failure and manual recovery on desktop Chromium, mobile Chromium and mobile WebKit. Keep all real outbound provider requests blocked.
- Regress valid automatic/manual paths and detail-only supplemental evidence. Reuse existing document capture tests and run affected browser tests, relevant unit tests, lint, typecheck, build, shipping certificate exclusion and scoped formatting/diff checks. Run broader tests only when the changed shared behavior warrants them; report exact commands/counts/skips.
- Do not reuse or download the permission-unresolved Beckett image. No new source hunt is required. Synthetic evidence cannot close CLIENT-04C's 0/12 real Pokémon corpus gap. Preserve original 04C results and manifest unchanged.

## Report and stop

Write `docs/evidence/SOL_CLIENT_PACKET_04D_REPORT.md` with root cause, caller matrix, before/after regression evidence, actual output/provenance checks, changed files, commands/results and remaining gates. Include permitted screenshots where they establish behavior. Distinguish locally simulated provider behavior from live integration.

No paid services, live recognition/certificate calls, hosted mutations, migration, native platform work, deployment, commit or CLIENT-05 work. Stop for Astra review. This repair does not establish real-photo accuracy, physical slab/iPhone performance, live recognition, official certificates or release readiness.
