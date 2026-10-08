# Publication checkpoint 84 — restore authenticated card identification

Live URL: https://jordan-pokemon-app.vercel.app
Deployment: dpl_DWrB3ngcdKQ5GaWhXAbggT4ZffAP
Unique deployment: https://jordan-pokemon-jl00e2cfv-earouse23-devs-projects.vercel.app
Owner authorization: Elliott explicitly approved restoring the existing AI recognizer for the main identification feature. Routine publication is covered by AGENTS.md. No additional service, dependency, credit purchase, billing setting or budget was added. Ponytail FULL used.

## Root cause and bounded correction

Earlier working code read the full photograph through the existing authenticated AI recognizer and resolved the printed identity against the catalog. Recent local-OCR work introduced two independent failures: mandatory edge isolation rejected readable hand-held photographs before recognition, and fixed-region OCR could not reliably read stylized Mega titles/numbers. Device-specific worker/CSP defects had already been corrected in checkpoint78; those fixes did not repair these accuracy/framing failures.

Intake now reuses the existing AI identification handler. Rejected edge geometry does not crop or reject a readable identification frame; full source pixels and unverified geometry provenance remain intact. Blank/low-quality and detected multiple-card frames retain their checks. Grading geometry and manual correction checks remain stricter. One authenticated identify operation permits one inference, preserves ownership/rate-limit/idempotency controls and opens only a unique exact catalog recommendation. It does not save a collection entry automatically.

The real staged check exposed a second catalog defect: printed MCharizard EX versus catalog M Charizard EX. The shared catalog parser normalizes this Mega spacing without changing Mew/Mewtwo. Shared identity cleanup normalizes language names to tags before lookup, preserving other detected tags rather than redirecting them to English. A separately printed EX tag completes the search title when the title lacks it; missing collector numbers are never invented. The prompt describes the actual full-frame input and identifies the title, either bottom number corner and printed slab label.

AI grading, advisor, other vision modes, price-sync, maintenance and alert-delivery remain held. Existing Pro pricing routes and authenticated deletion remain independent. No SQL or customer inventory writes occurred. The only cron remains /api/capabilities?surface=grading-deletion at 15 5 * * *.

## Verification

- 543 unit tests pass; 3 pre-existing skips; 98 source files linted.
- 33 affected Chromium/mobile Chromium/WebKit browser checks pass: raw/graded automatic exact opening, uncertain-match handling, ownership races, automatic capture fixtures, Japanese detection without menu selection, readable rejected-edge intake, blank-photo rejection, source-pixel preservation and independent manual grading correction.
- Traced old rejected-geometry test expectations: identification now proceeds while grading still requires correction. Pixel/provenance assertions remain; obsolete local OCR counter expectations were replaced with actual identify request and manually delivered file assertions. No assertions were deleted to hide a failure.
- Actual packaged routing verifies 9 functions (limit12), exact URLs, methods, authentication, CORS, hostile origins, unknown404 and deletion independence. No paid calls in the routing checks.
- Two builds are identical. All 158 source/output entries scanned against scoped private values; zero private findings; 47 certificate fixture exclusions preserved. Original ACTIVATION04 and checkpoint78 artifacts remain intact. Source is the reviewed explicit overlay, not the dirty worktree.
- Final READY candidate made a real authenticated AI identification through the existing isolated demo account: MCharizard EX, 101/108, en, exact recommendation tcgdex:en:xy12-101. One inference, 6719ms total; server 5114ms; imagePersisted/resultPersisted false. Internal finish ambiguity is retained separately and is not guessed as a unique collectible variant.
- Four bounded identification inferences total during this investigation (initial catalog mismatch, corrected reference, private screenshot, final reference); no other paid surface invoked. Earlier candidates81/82/83 were not promoted. No billing/credit settings changed.
- Private screenshot replay in both engines now passes basic preparation with no blockers and no false crop. A real screenshot inference reads the name but cannot recover its small collector number. It is NOT an exact-match acceptance pass. Corrected name-only catalog query returns seven candidates and no exact recommendation. Private pixels/raw response remain outside committed publication evidence.
- Staged/live health, configuration hash, API authentication, identification-only mode gate, CORS and holds pass. Promoted asset hashes, canonical alias, deletion cron and Git build guards are verified separately in linked JSON evidence. Initial staged error query returned zero rows. Final bounded log query returned three Node DEP0169 url.parse deprecation warnings tagged at error level by the existing runtime bridge; corresponding catalog200, sealed401 and capabilities200 responses match their checks. No application exceptions were observed. These warnings are disclosed rather than counted as a clean log.

## Exact artifacts and provenance

Deployment ZIP SHA-256: 04b49c18d61ab155f8dfd037c560008bb5ef861c00477e301182611e451cd0fb
Source ZIP SHA-256: facef8f91dcfab6823b7977f53f41d8e8cf3599ae2e63cb6d1011e57cce89c9c
Manifest SHA-256: 930bc151cc66001a859ed274c47cec19450fde62b9fabd2da1e10179ea6668ca
Configured public asset SHA-256: 65b310fcb5dd0692eddd945de91ca439995bce48a040cccd1afa4bf8602e745f
Checkpoint78 is the verified pre-promotion alias state; no automatic rollback was performed. Git deployments remain disabled and ignored build command remains exit 0.

Exact source delta versus78: app.js, sw.js, api/vision.js, api/capabilities.js, lib/held-routes.js, lib/vision.js, lib/providers/tcgdex.js, scripts/build-release.mjs. Test/routing checks and this evidence are committed alongside the source. No hosted secret/config setting changed. Shell cache identification81 advances the production78 cache; intermediate candidates were not live.

## Remaining acceptance

Elliott must test the original full-resolution English camera photo on iPhone Safari. The screenshot alone does not establish collector-number legibility. Automatic blue highlighting/triggering against hands and complex backgrounds remains an existing detector limitation; synthetic auto-capture passes do not establish physical acceptance. The strict five-second recognition target is not met by the 6.7-second final hosted sample. Japanese workflow fixtures pass, but no real Japanese physical-photo acceptance was claimed. Login/save/Storage/device acceptance and the rest of beta requirements remain separate; this release does not claim a fully accepted beta.
