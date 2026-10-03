import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Exercise shipped handlers; only camera, image preparation and persistence are
// fixture dependencies. No photo is sent to a model or a real account.
let handlers, resume, camera, report, helperBundle;
test.beforeAll(async () => {
  const source = await readFile(new URL("../../app.js", import.meta.url), "utf8");
  handlers = source.slice(source.indexOf("const fullDigitalGradeCaptureSteps"), source.indexOf("async function beginDigitalGrading("));
  resume = source.slice(source.indexOf("function continueGradingActivity("), source.indexOf("async function refreshGradingActivity("));
  camera = source.slice(source.indexOf("async function openDeviceCamera("), source.indexOf("function openAutoCapture("));
  report = source.slice(source.indexOf("function renderVisionResult("), source.indexOf("async function analyzeCardImages("));
  const built = await build({ stdin: { contents: 'export * from "./lib/grading-capture.js"; export { compareGradeIdentity, compareDigitalGradeStability } from "./lib/grading.js";', resolveDir: fileURLToPath(new URL("../../", import.meta.url)) }, bundle: true, format: "iife", globalName: "CaptureHelpers", write: false });
  helperBundle = built.outputFiles[0].text;
});

async function fixture(page) {
  await page.route("**/*", route => route.fulfill({ contentType: "text/html", body: '<main id="bottomSheet"><div id="sheetContent"></div></main>' }));
  await page.goto("/");
  await page.evaluate(({ handlers, resume, helperBundle }) => {
    (0, eval)(helperBundle);
    Object.assign(window, CaptureHelpers);
    window.$ = (selector, root = document) => root.querySelector(selector);
    window.$$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    window.esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
    window.state = { session: { user: { id: "owner-a" } }, gradingMode: "full", gradingCaptureDrafts: new Map(), gradingActivity: [], items: [] };
    window.sessionLoadVersion = 1;
    window.accountRequestIsCurrent = (owner, version) => state.session?.user?.id === owner && sessionLoadVersion === version;
    window.GRADING_MODES = { full: { name: "Digital grading" } };
    window.supabase = {};
    window.toast = () => {};
    window.updateGradingSessionCaptureProgress = async () => {};
    window.openSheet = html => { $("#sheetContent").innerHTML = html; $("#bottomSheet").hidden = false; };
    window.closeSheet = () => { $("#bottomSheet").hidden = true; };
    window.cameraCalls = [];
    window.openDeviceCamera = async input => { cameraCalls.push(input); };
    window.analyzed = [];
    window.analyzeCardImages = async (_kind, images) => analyzed.push(images.map(image => image.captureType));
    window.failedType = "back";
    window.prepareVisionImage = async (file, options) => {
      if (options.captureType === failedType) throw new Error("This photo could not be read");
      return { ...options, imageHash: file.name, blockers: [], warnings: [] };
    };
    (0, eval)(`${handlers}\n${resume}`);
    window.captures = ["front", "back", "alternate_front", "alternate_back"].map(captureType => ({ captureType, side: captureType.includes("back") ? "back" : "front", file: new File([captureType], `${captureType}.jpg`, { type: "image/jpeg" }) }));
  }, { handlers, resume, helperBundle });
}

test("retaking an unreadable back keeps the three accepted views and analyzes exactly four", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => showPrecisionGradingProcessing(captures, { scanSessionId: "scan-a", gradingMode: "full" }));
  await page.getByRole("button", { name: "Retake this view" }).click();
  expect(await page.evaluate(() => cameraCalls.map(call => call.kind))).toEqual(["back"]);
  await page.evaluate(async () => { failedType = ""; await cameraCalls[0].onPhoto(new File(["new-back"], "new-back.jpg", { type: "image/jpeg" })); });
  await expect.poll(() => page.evaluate(() => analyzed.length)).toBe(1);
  expect(await page.evaluate(() => analyzed[0])).toEqual(["front", "back", "alternate_front", "alternate_back"]);
  expect(await page.evaluate(() => state.gradingCaptureDrafts.get("scan-a").map(capture => capture.file.name))).toEqual(["front.jpg", "new-back.jpg", "alternate_front.jpg", "alternate_back.jpg"]);
  expect(await page.evaluate(() => cameraCalls.length)).toBe(1);
});

test("resuming four saved views prepares them without asking for a fifth photo", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => {
    failedType = "";
    state.gradingActivity = [{ id: "scan-a", collection_item_id: "card-a" }];
    state.items = [{ uid: "card-a" }];
    state.gradingCaptureDrafts.set("scan-a", captures);
    continueGradingActivity("scan-a");
  });
  await expect.poll(() => page.evaluate(() => analyzed.length)).toBe(1);
  expect(await page.evaluate(() => cameraCalls.length)).toBe(0);
  expect(await page.evaluate(() => analyzed[0])).toHaveLength(4);
});

test("capture tips can be skipped and stale account callbacks cannot open a camera", async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { window.continued = 0; openGradingCaptureCoach(() => { continued += 1; }); });
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  expect(await page.evaluate(() => continued)).toBe(1);
  await page.evaluate(() => { openGradingCaptureCoach(() => { continued += 1; }); state.session = { user: { id: "owner-b" } }; sessionLoadVersion += 1; });
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  expect(await page.evaluate(() => continued)).toBe(1);
});

test("unavailable optional camera controls do not stop a working camera", async ({ page }) => {
  await fixture(page);
  await page.evaluate(async camera => {
    Object.assign(window, { activeCameraStream: null, activeCameraTimer: null, activeMotionCleanup: null, activeCameraInputCleanup: null, stoppedTracks: 0 });
    window.cardCameraConstraints = () => ({ video: true });
    window.configureCardCamera = async () => [];
    window.stopAutoCaptureCamera = () => {};
    window.cameraErrorMessage = () => "Camera failed";
    window.logIngestionEvent = () => {};
    const track = { stop() { stoppedTracks += 1; }, getCapabilities() { throw new Error("Unsupported optional capabilities"); }, getSettings() { return {}; } };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => ({ getTracks: () => [track], getVideoTracks: () => [track] }),
      enumerateDevices: async () => { throw new Error("Optional enumeration unavailable"); },
    } });
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", { configurable: true, set(value) { this.fixtureStream = value; }, get() { return this.fixtureStream; } });
    HTMLMediaElement.prototype.play = async () => {};
    (0, eval)(camera);
    await openDeviceCamera({ kind: "card", automatic: false });
  }, camera);
  await expect(page.locator("#deviceCameraCapture")).toBeEnabled();
  await expect(page.locator("#deviceCameraState")).toContainText("press the shutter");
  await expect(page.locator("#deviceCameraRetry")).toBeHidden();
  expect(await page.evaluate(() => stoppedTracks)).toBe(0);
});

for (const mismatch of [false, true]) test(`report ${mismatch ? "mismatch blocks reuse" : "missing identity offers a front-only retake with a new report"}`, async ({ page }) => {
  await fixture(page);
  await page.evaluate(({ report, mismatch }) => {
    window.uniqueCaptureRequests = value => value || [];
    window.centeringMeasurementMarkup = window.psa10CenteringGuidelineMarkup = () => "";
    window.compactGradingReportMarkup = ({ blockers }) => blockers;
    window.bindDefectEvidenceDialog = () => {};
    window.gradingIdentitySnapshot = () => ({ name: "Charizard" });
    window.createGradingScanSession = async (_client, input) => { window.createdScan = input; return "new-scan"; };
    window.calculateMicaPregrade = () => ({ status: "estimate", score: 8 });
    state.digitalGradeTargetId = "card-a";
    state.items = [{ uid: "card-a", name: "Charizard", set: "Base Set", number: "4/102", language: "en", variant: "Holofoil", status: "owned", cardState: "raw" }];
    const payload = { scanSessionId: "original-scan", reportPersisted: true, gradingMode: "full", analysis: {
      identity: mismatch ? { name: "Blastoise", setName: "Base Set", collectorNumber: "4/102", language: "en", variant: "Holofoil" } : { name: "Charizard" },
      quality: { usable: true, issues: [] }, condition: { estimatedGradeLow: 7, estimatedGradeHigh: 9, defects: [], subscores: [] },
      micaPregrade: { status: "estimate", score: 8 }, gradingWorkflow: { complete: true, stages: [] },
    } };
    const images = captures.map(capture => ({ captureType: capture.captureType, side: capture.side, previewDataUrl: "/icons/icon.svg" }));
    (0, eval)(report);
    renderVisionResult(payload, "grade", images, captures);
  }, { report, mismatch });
  if (mismatch) {
    await expect(page.locator("#sheetContent")).toContainText("does not match the saved card");
    await expect(page.locator("#retakeIdentityFront")).toHaveCount(0);
    expect(await page.evaluate(() => cameraCalls.length)).toBe(0);
  } else {
    await expect(page.locator("#retakeIdentityFront")).toBeVisible();
    await page.locator("#retakeIdentityFront").click();
    await expect.poll(() => page.evaluate(() => cameraCalls.length)).toBe(1);
    expect(await page.evaluate(() => cameraCalls[0].kind)).toBe("card");
    expect(await page.evaluate(() => createdScan.collectionItemId)).toBe("card-a");
    expect(await page.evaluate(() => state.gradingCaptureDrafts.get("new-scan").map(capture => capture.file.name))).toEqual(["back.jpg", "alternate_front.jpg", "alternate_back.jpg"]);
    await page.evaluate(async () => { failedType = ""; await cameraCalls[0].onPhoto(new File(["new-front"], "new-front.jpg", { type: "image/jpeg" })); });
    await expect.poll(() => page.evaluate(() => analyzed.length)).toBe(1);
    expect(await page.evaluate(() => analyzed[0])).toEqual(["front", "back", "alternate_front", "alternate_back"]);
  }
});
