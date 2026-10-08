# Full-screen scan to card — October 8, 2026

Identification loads in a full-viewport accessible skeleton with Back at the top left. Usable exact matches open the normal card profile directly. Removed the old Scan complete report, photo-limitations and identity-summary panels from identification; grading reports are preserved. A genuinely ambiguous result shows a compact card choice, never a fabricated exact match. Scanned profiles have one large floating green Add card action, with retained account/operation-scoped photo and grade passed into the existing save form. Nothing is automatically added. Add card is centered between Home and Library in bottom navigation.

The scan draft now enters openCardDetail before its first render, preventing the old two-button action from appearing during initial loading. Back cancels identification by invalidating its operation; late recognition/catalog completion cannot reopen it or cross accounts. No dependency, API, provider budget, Supabase SQL, customer write, hosted configuration or schedule change. Existing raw/graded price/image/history recovery is retained.

Verification: 171 distinct affected browser checks passed across desktop/mobile Chromium and Safari/WebKit, 12 conditional skips; lint (98 files) and syntax checks pass. Fullscreen geometry, Back/late-response isolation, exact raw/graded and ambiguous matching, single Add action, retained photo/grade and unknown raw condition are covered. The corrected-pixel test still checks exact dimensions/color evidence and one approved recognition request; its obsolete local-OCR transport expectation was replaced after tracing requestVisionAnalysis. Mobile fixture bootstrap raced its fake inventory; bootstrap is suppressed for determinism, retired folder UI remains hidden/inert. Original unsuccessful run evidence remains local; assertions were not weakened to accept wrong identities or prices.

Two curated builds are identical: 96 source and 62 output entries, nine functions. Delta from checkpoint86 final: app.js, index.html, styles.css, sw.js only. All 158 source/output entries scanned against actual scoped secret/demo values: zero findings. Certificate fixtures excluded (47 checks). Original archives preserved.

- Deployment ZIP SHA-256: 1f1e333e547575222e52f5cef631d3de423fb2d1877e783a39efacf251b8c3b1
- Source ZIP SHA-256: 73a1bc90036a589318678ee5de2f7cfba149e2d8d9bbc00528bb5e254bdf6dbc
- Manifest SHA-256: 250156f920b20ae05ce4803ae2e073ea58067f9e3e96a7987b8e1b3d87416726
- Deployment: dpl_J8GhGAGdmK65qbwjV8PGVrbgszxC
- Canonical: https://jordan-pokemon-app.vercel.app
- Unique: https://jordan-pokemon-8eyleoj59-earouse23-devs-projects.vercel.app

READY candidate staged with canonical still on checkpoint86, target/rollback/configuration and Git guards verified before promotion. Staged/read-only live runtime checks pass configuration hashes, health/capabilities, auth 401, exact routing, CORS/hostile origins, unknown paths, provider holds and sole deletion schedule (/api/capabilities?surface=grading-deletion, 15 5 * * *). Git deploymentEnabled:false and ignored-build exit 0 remain.

Compiled shipping-CSP and live public-asset browser checks use existing isolated demo auth and replay previously successful recognition, with actual authenticated pricing: photo, current value and 104 history records appear with one request; single floating Add and top-left Back verified, zero browser exceptions/customer writes/new AI calls. Staged time 7219ms including protected CLI transport; live warm time 1357ms with 340ms pricing. These checks do not establish fresh recognition accuracy, physical iPhone acceptance or real save/Storage writes. Elliott performs device acceptance. Native/store and held grading/advisor/matching/proactive paid jobs remain separate.

Bounded runtime log sample: 44 rows, 14 intentional held-route 503s, 3 existing Node DEP0169 warnings, zero unexpected application error rows. Full private logs remain local.
