# Sol CLIENT-04C — offline capture benchmark with real slab photographs

## Authority and required skill

Use `ponytail:ponytail` in **full mode**. Read its installed SKILL.md before work: `/Users/elliottrouse/.codex/plugins/cache/ponytail/ponytail/4.10.0/skills/ponytail/SKILL.md`, locating the installed replacement if updated; report unavailable honestly. Apply reuse-first/smallest-correct-change principles to research and test tooling without reducing evidence, image rights, preservation, security, accessibility or approval gates.

Read AGENTS.md, both required Mica roadmaps, CLIENT-04 and CLIENT-04B acceptance reports, and the existing document detector/browser tests. Elliott authorized continuing with internet slab photos because he owns no slabs. This is the only active packet, a Step 4 evidence slice. Sol performs the work; Astra reviews it. Preserve the dirty worktree.

## Objective and scope

Determine whether the accepted capture implementation detects and crops real PSA/BGS slab photographs without cutting off the slab, card or label. Exercise the existing manual recovery on failures. Produce reproducible results and the smallest evidence-backed next recommendation.

This is an offline image pilot, not a physical-camera benchmark, live recognition test or certificate lookup. Keep recognition responses stubbed and block outbound provider requests. Do not improve/tune application algorithms while measuring their baseline. Test/benchmark tooling and documentation are authorized; application fixes require the next focused review packet.

## 1. Source and freeze a small real-photo corpus

- Target **12 distinct slabs**, two in each PSA/BGS × EN/JA/DE cohort. Prefer varied genuine photographs: visible transparent edges, labels, different backgrounds, mild skew/rotation and reflections. Include BGS half grades and leading-zero certificates when available. Do not substitute printed/rendered drawings or another grader/language just to fill a cell.
- Use existing consented/licensed fixtures first, then openly licensed or otherwise explicitly permitted public photos. Record source page, image URL, author/credit, permission/license evidence, retrieval date, file hash, dimensions and allowed local storage/redistribution. Public visibility alone is not permission to redistribute. No paid assets, scraping certificate services, bypassing access restrictions or contacting owners/providers. If permission is unclear, list the candidate and the missing permission without checking its image into the repository.
- Bound discovery to 24 candidate source pages for this pilot. If enough suitable permitted images cannot be found, complete a source/coverage report with the usable subset and a concrete missing-input request. Do not invent fixtures/permission or search indefinitely. Missing cohorts are a coverage gap, not a pass or an application bug. Do not require Elliott to buy slabs.
- Deduplicate by physical slab/certificate and image hash; do not count multiple views of one slab or transformed copies as independent samples. Label identity fields from visible evidence only; missing/ambiguous text stays unresolved. No official certificate verification claim.
- Before detector execution, save a protocol and corpus manifest with eligibility and source-space annotations: full slab boundary/corners, enclosed card region, full label rectangle, source orientation and visible label text. Distinguish manually annotated facts from inferred ones. Record uncertainty and reviewer identity; do not claim two independent human reviewers if unavailable. Hash the frozen manifest and record the application snapshot.
- Eligibility for the positive crop pilot: source short side at least 600 pixels, complete slab visible with surrounding pixels, one intended slab and sufficiently visible label/card boundaries for annotation. Smaller/clipped/ambiguous inputs remain in the negative/unsupported report, never quietly dropped after seeing output.

## 2. Predeclared pilot measurements

The following are Astra's predeclared pilot targets, not statistical production accuracy claims:

| Check | Target / rule |
| --- | --- |
| Preservation of accepted crops | **100%** retain the annotated slab outline including four corners, card region and full label, with a visible protective margin wherever the source provides it. Report pixel tolerances/annotation uncertainty before execution; no blanket percentage allowance that can hide a clipped certificate digit. |
| Label usability | Every label readable in the source remains readable in the accepted output; compare original/output at native scale and list missing/clipped/blurred characters or uncertainty. No OCR accuracy claim without an authorized recognition run. |
| Automatic usable crop | At least **90% of eligible originals** produce an accepted usable automatic crop. Report numerator/denominator per cohort and pooled; do not hide abstentions or fallback. With two originals in a cell, report counts rather than implying precise population accuracy. |
| Recovery | Every rejected/failed eligible original can reach a useful manually corrected preview or an explicit actionable failure with the original retained and retry available. Record actual outcome, not just whether buttons exist. |
| Safety | Zero automatic inventory writes; zero fixture/source provenance escalation; zero provider requests. Invalid/clipped/ambiguous test cases must not be presented as confidently safe crops. |

Keep automatic detection, correction success, crop acceptance, manual fallback, rejection and user abandonment separate. Measure detector/transform wall time on the stated local hardware; do not apply the physical-camera three-second gate to a downloaded still or call it iPhone capture latency. Explicitly report every attempted sample, including failures and exceptions. Do not tune thresholds after measuring.

## 3. Run the existing image path

- Reuse `lib/capture-precision.js`, `prepareDocumentPreview`/`prepareVisionImage` and the existing document capture harness. Ground-truth annotations are for evaluation only: never pass them to the detector as successful geometry. Automatic output must originate from source pixels.
- Test original real photos first. If useful, generate a small deterministic derivative set for rotation, mild perspective, blur, edge clipping and two-object ambiguity using existing tooling; record transformation parameters and parent IDs. Report those separately as synthetic transformations of real photos, never as additional independent real photographs or evidence of actual reflective-slab behavior.
- Cover the actual saved-photo production consumer, not a parallel implementation. On representative pass/failure/edge cases, verify correction/adjustment/retake and explicit-use boundaries in desktop Chromium, mobile Chromium and mobile WebKit. Keep recognition and inventory adapters isolated; verify that no real source photo is sent to a hosted service.
- Preserve originals read-only. Output paired original/outline/corrected-preview evidence and a per-image result ledger linking filenames and hashes. Do not use generative fill, healing or sharpening to make a sample pass. No source imagery in logs/telemetry or shipping assets. If a permitted source restricts redistribution, store only as allowed and document reproducibility limits.

## 4. Deliver the evidence, not an unreviewed fix

Return `docs/evidence/SOL_CLIENT_PACKET_04C_REPORT.md` and `docs/evidence/sol-client-04c/` with protocol, source-rights ledger, frozen manifest, annotations, exact runner commands, sample results, cohort coverage, failed examples and paired visuals. Keep prohibited redistributions out of Git and evidence attachments.

Classify conclusions separately:

1. Corpus availability and permissions.
2. Measured automatic crop/preservation behavior on eligible real originals.
3. Manual recovery and browser workflow results.
4. Synthetic derivative checks.
5. Still unproved: physical iPhone camera behavior, real slab glare/focus, live recognition accuracy, official certificate records and release readiness.

If the detector fails, preserve the first-run result and identify the likely shared root cause with code references. Propose the smallest repair or a concrete dependency/platform option; do not implement it in this packet. If sample coverage is inadequate, say the pilot cannot close the corresponding gate. Reuse existing unit tests for the harness changes; avoid full unrelated suites for an evidence-only change.

Stop for Astra ACCEPT/REVISE/BLOCKED review. No CLIENT-05 or concurrent packet.

## Boundaries

No application-code tuning, production dependency, paid service, live AI/recognition/certificate/pricing API or public certificate demo query, hosted write, deployment, migration, native platform work, provider/owner messages, purchase or commit. Public source-page/image research and permitted downloads are allowed within the bounds above. External provider inference/query budget remains zero. CLIENT-04B deferred screens remain excluded from shipping artifacts.
