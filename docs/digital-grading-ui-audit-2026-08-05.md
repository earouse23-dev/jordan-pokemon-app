# Digital grading UI audit — August 5, 2026

## Product rule

The grading journey must answer three questions in order: what evidence was seen, what digital grade did Mica measure, and whether paying for professional grading is financially sensible. Condition scoring, professional-grade prediction, and market value remain separate data products; a missing input produces “Maybe” rather than an invented answer.

## Screen-by-screen audit

| Surface | Previous problem | Resolution in this pass | Follow-up risk |
| --- | --- | --- | --- |
| Collection grading entry | The path was formerly hidden behind Add Cards and multiple intermediate actions. | The primary Digital grade action remains in Collection and starts the camera flow. | Verify camera permission recovery on a larger physical-device matrix. |
| Grading mode choice | Mode descriptions can create decision friction before the user reaches the camera. | Full grading remains the direct/recommended path; specialist tools stay secondary. | Consider remembering the last specialist mode without changing the primary default. |
| Capture Coach | Guidance was useful but could become another long reading screen. | Existing pass/retake visual pairs remain the teaching surface; live capture carries only the current instruction. | Add analytics for help reopening and first-attempt acceptance. |
| Four-view capture | A numeric tilt value did not tell a user which direction to move. Manual shutter timing created avoidable blur and glare. | Four physical bubble levels now sit on the top, bottom, left, and right edges. Each axis moves directionally and turns green when aligned. Auto-capture waits for level, boundary, perspective, light, glare, sharpness, and four stable samples. | Field-test sensor orientation and thresholds across iOS Safari and Android Chrome devices. |
| Camera permission/error | Recovery copy was present but visually competed with capture controls. | Existing retry and saved-photo fallback remain, while the live state is reduced to one actionable instruction. | Confirm permission-settings instructions per browser version. |
| Photo review | Review is necessary but could interrupt a reliable automatic flow. | The captured frame is still shown before use, preserving user control and preventing an unintended scan. | Test whether an optional auto-advance setting improves repeat grading without increasing errors. |
| Processing | Multi-model work can look stalled and previously used too much explanatory copy. | Existing staged progress remains; final output no longer repeats processing methodology in the main report. | Add timing telemetry by stage and a durable resume indicator for long requests. |
| Identity match | Incorrect automatic attachment is a severe trust failure. | Existing name, set, collector number, language, and variant guards remain; mismatches block attachment and preserve the current collection grade. | Expand identity benchmark coverage for promos, Japanese printings, and visually similar reprints. |
| Low-quality/abstained result | A blocked result could resemble a failed grade and bury the needed action. | The compact report keeps the grade position stable, then shows a single blocking card and specific evidence retake actions. | Measure whether users understand “no score” versus a low score. |
| Completed report | Grade, rationale, three-answer cards, defect list, market context, and disclaimers repeated conclusions and forced long scrolling. Some muted text was too close to the dark background. | The main stack is now: evidence carousel, large grade, confidence, four gauges with one-sentence rationales, grade-likelihood line, and one Yes/No/Maybe decision paragraph. Colors are explicitly high-contrast Mica cream/sage/gold on deep green panels. Technical data is collapsed. | Run production screenshots with real long card names and every decision state. |
| Evidence detail | Defects were separated from the card image, making localization harder. | Verified defect regions are outlined directly in the top carousel; tapping an outline opens the existing local evidence crop and description. | Persisting additional normal photos is intentionally avoided; saved reports have the private card-only thumbnail unless retention policy changes. |
| Subgrades | Text ranges made comparisons slow and required too much reading. | Centering, corners, edges, and surface use semicircle gauges with numeric values and one evidence sentence each. | Validate that color is never the only indication; the score and accessible label remain required. |
| Grade likelihood | Professional PSA probabilities are unavailable without validated held-out calibration. | The compact chart displays a normalized Mica condition-likelihood distribution derived from the measured score, range, and evidence confidence. It does not claim unvalidated PSA odds. | Replace with grader-specific probabilities only after calibration-version and held-out-return requirements pass. |
| Submission decision | The old decision and market panel were separate, verbose, and frequently produced a blanket warning. | One large Yes/No/Maybe answer uses the exact card price, exact matching graded quote, configured base grading fee, AI confidence, and validation status. Missing or unvalidated inputs yield Maybe. No card or financial amount is hardcoded. | Add user-entered shipping, insurance, membership tier, selling fees, and turnaround opportunity cost to the calculation. |
| Saved reports / Recent grading | Saved reports reopened into another long technical report. | Saved reports now reuse the same compact stack. The private signed card thumbnail carries retained defect outlines; report/model metadata stays collapsed. | Only the privacy-approved card-only thumbnail persists, so additional transient carousel angles expire. |
| Regrade | A regrade could silently replace a materially different result. | Existing repeatability guard remains and protects the saved DG value when identity or evidence stability fails. | Show a compact version-to-version visual comparison after two valid reports. |
| Centering-only tool | Its specialist output can conflict with the compact full-grade hierarchy. | It remains a separate specialist result and does not claim an overall grade. | Redesign it with the same compact visual language in a dedicated follow-up. |
| Report sharing and deletion | Share/export and private deletion are important but not primary result data. | Both remain available after the data stack; deletion continues to remove the private report artifact without deleting the collection card. | Add an explicit export preview accessibility check. |

## Data and truthfulness checks

- Digital grade and confidence come from the grading analysis response, not display constants.
- Subgrade gauges use the returned low/high bounds and evidence confidence.
- Defect markers use bounded model-returned regions that passed evidence verification.
- The likelihood chart is a condition-uncertainty visualization, not an invented professional-grader distribution.
- Submission values use the collection item’s current exact raw price, an exact grade-specific quote, and the configured grading service fee. Missing inputs abstain to “Maybe.”
- Normal grading photos remain transient. Saved reports use the existing private, owner-scoped, short-lived signed thumbnail.

## Verification required for release

- Unit, security, schema, lint, type, and production build checks.
- Mobile layout at 320 and 390 pixels, tablet at 768, and desktop at 1024 and 1440.
- A four-bubble capture assertion with no degree symbol.
- Report assertions for evidence-first order, four gauges, one decision paragraph, 12-pixel text floor, 44-pixel mobile controls, no page overflow, and WCAG AA contrast for confidence, rationale, and decision copy.
- Live production smoke test after the Vercel deployment.
