# iOS interface and motion implementation

Scope: implement the approved `docs/MICA_IOS_UI_MOTION_PLAN_2026-11-14.md` using the existing app and component system. No new feature, provider, dependency, database change, photo processing change, or store action.

## Direction and baseline

Product: identify and retain a collector’s slabs and follow their value. Character: calm, exact, tactile. World: a card binder and a financial ledger. Moments: actual artwork and the principal value chart. Signature: exact grader and grade displayed together beside identity.

The existing Mica palette, mark, typography family and navigation are retained. This is a consistency/polish pass, not an invented visual direction. Baseline fixtures in `test-results-ios-baseline` exercise portfolio, collection, detail, search, settings, auth and filters at 320/390/430/667/768/1024/1440/1920px in both themes. Fixture prices/artwork are synthetic UI evidence, not provider acceptance.

Observed/source-confirmed defects and corrections:

- Shared styling roots omitted account recovery dialogs and onboarding, leaving different controls and oversized overlay effects.
- Form metadata fell back to 12px in several places; shared type roles now distinguish 17px base text, 15px labels and 13px metadata, retaining 16px input text.
- Editing and secondary sheets used inconsistent gaps, radii and action sizes; the existing shared rules now cover these surfaces.
- Onboarding used a separate large card and heavy blurred backdrop; it now uses a bounded readable task surface with the same palette, focus and primary action.
- Grading preparation animated width and showed decorative multicolor progress; status-driven, static transform states now reflect waiting/active/complete without implying a numeric percentage.
- The chart’s 850ms drawing was slower than the approved motion plan; its existing clipped reveal is now 300ms and remains instant with reduced motion.
- Short landscape charts now have a height-specific rule rather than depending on a named phone model.
- Scan preparation repeated automatic-saving/matching explanations; it now says “Review the match before adding” and keeps factual processing status separately.

## Nine passes

1. **Spacing:** reuse 16px groups and 24px sections, 8px field gaps, aligned list rows, consistent sheet heading/handle spacing.
2. **Color:** extend the existing neutral ramp and green accent to previously omitted surfaces; retain semantic error colors and light/dark primary action contrast. Remove heavy backdrop blur and multicolor preparation bars.
3. **Icons:** preserve the real mark and existing SVG set, shared stroke/size and accessible names. No new icon dependency.
4. **Copy:** shorten the actual scan preparation text; retain exact identity, uncertainty, price sources and safety-relevant details. No fabricated claims or marketing text.
5. **Type:** share native system type, readable metadata, tabular grades/prices and consistent heading weights across shell and dialogs.
6. **Layout:** preserve section order, fluid gutters and existing workflow; bound recovery/onboarding to the usable viewport, permit wrapped settings rows and responsive chart controls, contain long identity text.
7. **Details:** consistent 10px controls and 20px sheets, 44px navigation targets, 48px form controls, visible keyboard focus, restrained disabled/pressed states. Drafts and focus lifecycle remain owned by existing code.
8. **Visuals:** retain real card artwork and the data chart as the content moments; no generated decoration or asset purchases.
9. **Motion:** 120ms feedback, 160ms dialogs/toasts, 240ms sheet entrance, 300ms chart drawing, one easing family. Independent CSS translation preserves existing centered/full-screen positioning. Reduced-motion paths suppress the new animation.

The first post-change matrix caught a sheet-centering regression caused by animating the same transform used for placement. The correction animates the independent `translate` property. The final matrix must pass before publication. A stale settings test selector was updated from a removed appearance group to the actual Preferences group; production behavior did not need to be changed to satisfy that test.

## Verification and limits

Final automated checks: Node 611 passed / 3 skipped / zero failed; main browser matrix 307 passed / 2 skipped / zero failed across desktop Chromium, mobile Chromium and mobile WebKit. Focused chart/design tests 6 passed; settings tests 3 passed after correcting their stale selector. Final modal/enlarged-text/reduced-motion subset 6 passed; portfolio-label contrast subset 3 passed. Lint (101 files), syntax/type checks and release checks are recorded with publication below.

Xcode compiled both unsigned and ordinary Simulator builds in an isolated source copy with the existing pinned dependencies and public configuration. The updated app installed and launched on the existing 6.3-inch iPhone 17 Simulator (402×874 CSS px / 1206×2622 native screenshot). Its retained demo session opened the real portfolio with prices and chart. That screenshot exposed an inherited white-on-light Gain/loss label, now explicitly tied to the secondary text role and covered by the >=4.5:1 contrast regression in both appearances. Simulator computer control still returned “no window available,” so this is native launch/render evidence, not a claim of full native tapping or physical hardware testing. Private Simulator evidence stays under ignored `benchmarks/private/ios-polish-2026-11-15/`.

 Browser tests use existing isolated fixtures and stubbed providers; they do not write customer inventory or demonstrate universal slab coverage. The Topps catalog gap from the prior task is unchanged. Physical camera/hardware and App Store acceptance remain separate. No whiteboard publication is included in this request.

Process adapted from [Unslop by Damir Sokolovsky](https://github.com/heydamir/unslop), [@heydamir](https://x.com/heydamir), CC BY 4.0. Retain attribution with adaptations.

## Publication receipt

- Source commit: `dfcc15b`, pushed to the existing `codex/mica-baseline-reconciliation` branch. Production Git branch remains `main`; the reviewed prebuilt artifact was explicitly published to the existing project.
- Production deployment: `dpl_GEntyMeqDRHSKyhYZK8wNUyNM1qX`, READY, alias https://jordan-pokemon-app.vercel.app/.
- Isolated release build and routing verification passed: 9 functions, 64 deploy entries, existing held routes/auth/origin boundaries, zero real provider calls in the routing checks. Existing two cron definitions and schedules are unchanged.
- Production HTML, app, service worker and CSS hashes match the release artifact. Health is healthy. Unauthenticated pricing, sales, graded valuation and portfolio requests return 401. See `production-verification.json`.
- Live authenticated UI confirms 17px base text, 120ms feedback token and zero horizontal overflow. Settings alerts settle to their retained On state after account loading. Portfolio retains its previous prices/chart while reporting its existing incomplete refresh honestly. One-month and All-time chart controls both visibly update their selection.
- Native screenshot after the final correction confirms the Gain/loss label is readable; app install retained its existing demo session. No customer inventory edits, native/store submission, provider budget change or new feature was performed.
- Native Simulator interaction control remained unavailable. Physical-device and full native touch acceptance are not claimed. Existing Topps catalog coverage is unchanged.
