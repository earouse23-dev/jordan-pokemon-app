# Publication checkpoint 76 — production OCR initialization

Live app: https://jordan-pokemon-app.vercel.app. Deployment dpl_DwAyhZZZLfCDKpn248uJQ5eaY2Wk; unique URL https://jordan-pokemon-isxxza6l3-earouse23-devs-projects.vercel.app. October 7, 2026 local. Previous production checkpoint75 is preserved. Routine publication is authorized; no paid providers, SQL, customer writes, new dependency or platform changes.

## Root cause and research

Elliott's iPhone screenshot reports a function-undefined error during worker creation, before text recognition. Reproducing with the actual production settings (ESM, ES2022, splitting and minification) failed in both Chromium and WebKit. Tesseract 7's installed package exports CommonJS API; its separate browser chunk exposes that API through default. The old dynamic named import returned undefined. The shared warmCardOcr import now reads default.createWorker; both camera warmup and photo reading use this shared function.

[esbuild documents CommonJS entries becoming default exports](https://esbuild.github.io/api/#format). [Tesseract's local installation documentation](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md) explains worker/core/language paths. Existing local paths/assets and privacy boundaries remain. A system prompt cannot repair worker initialization. Previous artwork tests bundled without splitting and missed the shipping failure; the permanent OCR browser tests now use split, minified files. Assertions were retained.

[Apple's camera-scanning documentation](https://developer.apple.com/documentation/visionkit/scanning-data-with-the-camera) describes native VisionKit guidance/highlighting; Safari uses Mica's existing pixel detector and SVG overlay. The user's screenshot shows a post-capture reading sheet, not the live camera. Private local replay of its thumbnail detects the document in both engines and renders the blue polygon in the live flow with source proportions preserved. No detector thresholds, clipping/multiple-card rejection or grading gates were changed. This replay does not establish highlighting on Elliott's physical iPhone or successful recognition from the original photo.

The thumbnail appears to contain Korean Hangul; Elliott is unsure of the card language. This is an inference, not a verified identity. Current requested OCR/pricing languages remain English, Japanese and German, and the image's original name/number cannot be accepted from this reduced screenshot. No Korean-to-Japanese substitution or guessed card identity was added. [TCGdex reports varying language completeness](https://tcgdex.dev/status), while [PkmnPrices documents English, Japanese and German coverage](https://www.pkmnprices.com/docs/cards). Original card-photo and live camera evidence are still needed for this exact case.

## Verification and release

540 unit checks pass, three existing skips; lint/typecheck pass. Nine OCR/theme browser checks now exercise minified split OCR files; six focused full-screen auto/shutter checks pass. Two private thumbnail live replays pass; private images/test source are excluded from publication. Before-failure/after-success metadata accompanies this report.

Two curated release builds match exactly. Nine functions, 64 deployment entries, 96 source entries; 160 entries scanned with zero private findings; certificate fixture exclusion passes 47 files. Only shipping source delta from checkpoint75: lib/card-ocr.js, index.html and sw.js. Shell/app versions advance to76/114 to deliver the correction. Backend, provider budgets, public config and deletion-only schedule stay unchanged.

Candidate was staged without assigning canonical production domains, target/READY and 17 static/OCR asset hashes verified, and read-only health/auth/CORS/hostile-origin/unknown-route/hold checks passed before promotion. Runtime window contained no application exceptions and two existing DEP0169 warnings. Deletion-only cron: /api/capabilities?surface=grading-deletion at 15 5 * * *. Paid vision/grading, advisor and notifications remain held. Live verification/final alias evidence accompany this report. Git deployment suppression and ignored-build exit0 remain; unrelated dirty work is preserved.

| Artifact | SHA-256 |
|---|---|
| checkpoint-76-promoted-deployment.zip | 090f9364f087f6facc5083b81b919525b7a3f818ac02d51743989e922c9d593f |
| checkpoint-76-promoted-source.zip | d0db92a4eca580502c83e6d939a47a137faf05e593f6c286778408f1594c00d1 |
| checkpoint-76-promoted-manifest.json | 5bf4ddc6607f066bb07dee22e291b960e555007e6a556d06b495f8402ca1517b |

Remaining: physical iPhone blue-overlay/capture acceptance and original-photo identity/language verification for Elliott's card, broader real-photo accuracy/cold total-five-second performance, prior owner-fact/password-reset device gates. This bounded correction fixes the shown initialization crash; it does not claim all scanning scenarios are now accepted.
