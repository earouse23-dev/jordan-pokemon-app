import { expect, test } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appUrl = "/app.js?v=document-capture";
const owner = "11111111-1111-4111-8111-111111111111";
const evidenceDirectory = fileURLToPath(
  new URL("../../docs/evidence/sol-client-04/", import.meta.url),
);
const rejectedGeometryEvidenceDirectory = fileURLToPath(
  new URL("../../docs/evidence/sol-client-04d/", import.meta.url),
);
let bundle;

test.use({ serviceWorkers: "block" });
test.beforeAll(async () => {
  await mkdir(evidenceDirectory, { recursive: true });
  await mkdir(rejectedGeometryEvidenceDirectory, { recursive: true });
  let source = await readFile(
    new URL("../../app.js", import.meta.url),
    "utf8",
  );
  // Deterministic rejected geometry for the manual-recovery gate; detector tests use real pixels.
  source = source.replace("options.geometry ||\n    isolateUploadedDocument", "options.geometry || globalThis.__rejectedPreviewGeometry ||\n    isolateUploadedDocument");
  const result = await build({
    stdin: {
      contents: `${source.replace("void bootstrap();", "")}\nexport { state, bindEvents, openDeviceCamera, openAutoCapture, openCardCamera, guideCropInFrame, prepareDocumentPreview, prepareVisionImage, showProcessing, detectDocumentBoundaryFromPixels };`,
      resolveDir: fileURLToPath(new URL("../../", import.meta.url)),
      sourcefile: "app.js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  });
  bundle = result.outputFiles[0].text;
});

async function setup(
  page,
  {
    live = false,
    automatic = !live,
    weakFrame = false,
    twoCameras = false,
    initialHidden = false,
    recognition = false,
    captureRequest = null,
    experience = "default",
    visionPayload = null,
  } = {},
) {
  const requests = { writes: [], vision: [], cameras: [], catalog: [], pricing: [] };
  await page.addInitScript(text => {globalThis.__ocrText = text;}, visionPayload?.analysis?.identity?.grader ? "PSA GEM MT 10 Pikachu 025/165" : "Pikachu 025/165");
  await page.route(`**${appUrl}`, (route) =>
    route.fulfill({ contentType: "application/javascript", body: bundle }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-document-capture.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("https://mica-document-capture.supabase.co/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes("/rpc/")) {
      requests.writes.push({
        path: url.pathname,
        body: route.request().postDataJSON(),
      });
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify("44444444-4444-4444-8444-444444444444"),
      });
    }
    return route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/**", (route) => {
    if (route.request().url().includes("/api/cards")) requests.pricing.push(JSON.parse(new URL(route.request().url()).searchParams.get("lookups"))[0]);
    if (route.request().url().includes("/api/catalog")) {
      requests.catalog.push(route.request().url());
      const cards = visionPayload?.catalogResolution?.cards || [];
      return route.fulfill({contentType:"application/json",body:JSON.stringify({cards, hasMore:visionPayload?.catalogResolution?.resolution?.status === "needs_review"})});
    }
    if (route.request().url().includes("/api/vision"))
      requests.vision.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(visionPayload || {
        analysis: { identity: {} },
        catalogResolution: { cards: [] },
      }),
    });
  });
  await page.goto("/");
  await page.evaluate(
    async ({
      appUrl,
      owner,
      live,
      automatic,
      weakFrame,
      twoCameras,
      initialHidden,
      recognition,
      captureRequest,
      experience,
    }) => {
      const app = await import(appUrl);
      app.state.session = {
        user: { id: owner },
        access_token: "fixture-token",
      };
      app.state.accountLoading = false;
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      if (initialHidden)
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
      if (live) {
        const canvas = document.createElement("canvas");
        canvas.width = 700;
        canvas.height = 1000;
        const context = canvas.getContext("2d");
        context.fillStyle = "#596a60";
        context.fillRect(0, 0, 700, 1000);
        if (!weakFrame) context.beginPath();
        if (!weakFrame) {
          context.moveTo(160, 70);
          context.lineTo(535, 105);
          context.lineTo(565, 925);
          context.lineTo(135, 895);
          context.closePath();
          context.fillStyle = "#d7ccb3";
          context.fill();
          context.fillStyle = "#b93232";
          context.fillRect(185, 140, 320, 155);
          context.fillStyle = "#3965b8";
          context.fillRect(175, 340, 350, 485);
          if (automatic) {
            context.fillStyle = "#d7ccb3";
            for (let y = 344; y < 820; y += 20)
              context.fillRect(180, y, 340, 9);
          }
          context.fillStyle = "#f6f1df";
          context.font = "bold 26px sans-serif";
          context.fillText("PSA 10 · 00012345", 195, 220);
          context.fillText("PIKACHU · 025/165", 185, 620);
        } else {
          context.fillStyle = "#596a60";
          context.fillRect(0, 0, 700, 1000);
        }
        const inset = document.createElement("canvas");
        inset.width = 700;
        inset.height = 1000;
        inset.getContext("2d").drawImage(canvas, 0, 0);
        globalThis.__syntheticDocumentCanvas = inset;
        context.fillStyle = "#596a60";
        context.fillRect(0, 0, 700, 1000);
        context.drawImage(inset, 0, 0, 700, 1000, 157, 225, 385, 550);
        globalThis.__liveCanvas = canvas;
        let tick = false;
        globalThis.__liveTick = setInterval(() => {
          context.fillStyle = tick ? "#596a60" : "#596a61";
          context.fillRect(0, 0, 1, 1);
          tick = !tick;
        }, 70);
      }
      globalThis.__mediaCalls = [];
      globalThis.__mediaStreams = [];
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async (constraints) => {
            globalThis.__mediaCalls.push(constraints);
            if (!live) throw new DOMException("denied", "NotAllowedError");
            const stream = globalThis.__liveCanvas.captureStream(15);
            globalThis.__mediaStreams.push(stream);
            setTimeout(() => {
              const context = globalThis.__liveCanvas.getContext("2d");
              context.fillStyle = "#596a60";
              context.fillRect(0, 0, 1, 1);
            }, 100);
            return stream;
          },
          enumerateDevices: async () =>
            twoCameras
              ? ["camera-a", "camera-b"].map((deviceId) => ({
                  kind: "videoinput",
                  deviceId,
                }))
              : [],
        },
      });
      globalThis.__documentCaptureApp = app;
      globalThis.__photosDelivered = 0;
      await app.openDeviceCamera({
        kind: captureRequest ? "supplemental" : "card",
        automatic,
        captureRequest,
        experience,
        onPhoto: (file) => {
          globalThis.__photosDelivered += 1;
          globalThis.__deliveredFile = file;
          globalThis.__deliveredMetadata = file.micaCaptureMetadata;
          if (recognition) return app.showProcessing(file);
          app.openPositionSheet(
            {
              id: "fixture-pikachu",
              name: "Pikachu",
              set: "151",
              number: "025/165",
              language: "en",
              variant: "Holofoil",
            },
            {
              prefill: {
                cardState: "graded",
                grader: "PSA",
                grade: "10",
                certificationNumber: "00012345",
                acquisitionCostKnown: false,
                acquisitionDateKnown: false,
              },
              visionAnalysis: {
                mode: "identify",
                condition: "unknown",
                confidence: 0.91,
              },
            },
          );
        },
      });
    },
    {
      appUrl,
      owner,
      live,
      automatic,
      weakFrame,
      twoCameras,
      initialHidden,
      recognition,
      captureRequest,
      experience,
    },
  );
  requests.cameras = await page.evaluate(() => globalThis.__mediaCalls);
  return requests;
}

async function installSyntheticDocument(page, { marker = false } = {}) {
  await page.evaluate(async (marker) => {
    const canvas = document.createElement("canvas");
    canvas.width = 700;
    canvas.height = 1000;
    const context = canvas.getContext("2d");
    context.fillStyle = "#1f3228";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.beginPath();
    context.moveTo(160, 70);
    context.lineTo(535, 105);
    context.lineTo(565, 925);
    context.lineTo(135, 895);
    context.closePath();
    context.fillStyle = "#d7ccb3";
    context.fill();
    context.fillStyle = "#b93232";
    context.fillRect(185, 140, 320, 155);
    context.fillStyle = "#3965b8";
    context.fillRect(175, 340, 350, 485);
    context.fillStyle = "#f6f1df";
    context.font = "bold 34px sans-serif";
    context.font = "bold 26px sans-serif";
    context.fillText("PSA 10 · 00012345", 195, 220);
    context.fillText("PIKACHU · 025/165", 185, 620);
    if (marker) {
      context.fillStyle = "#f000e0";
      context.fillRect(72, 440, 30, 70);
    }
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.94),
    );
    const input = document.querySelector("#deviceCameraUpload");
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([blob], "synthetic-slab.jpg", { type: "image/jpeg" }),
    );
    globalThis.__syntheticTransfer = transfer;
  }, marker);
}

test("shared document capture recovers from denied camera, corrects once, and keeps manual controls", async ({
  page,
}, testInfo) => {
  const requests = await setup(page);
  await expect(page.locator("#deviceCameraState")).toContainText(
    "Camera access was blocked",
  );
  await expect(page.locator("#deviceCameraUpload")).toHaveCount(1);
  await installSyntheticDocument(page);

  await page.evaluate(() => {
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#deviceCameraState")).toContainText(
    "Corrected full slab preview",
    { timeout: 20_000 },
  );
  await expect(page.locator("#deviceCameraReview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adjust edges" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  await page.locator(".device-camera").screenshot({
    path: `${evidenceDirectory}/${testInfo.project.name}-corrected-preview.png`,
  });

  await page.getByRole("button", { name: "Adjust edges" }).click();
  await expect(page.locator("#deviceCameraAdjustments")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeDisabled();
  await page
    .getByRole("button", { name: "Move selected corner right" })
    .click();
  await page.getByRole("button", { name: "Apply correction" }).click();
  await expect(page.locator("#deviceCameraState")).toContainText(
    "Corrected full slab preview",
    { timeout: 20_000 },
  );
  await page.getByRole("button", { name: "Use photo" }).click();
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(1);
  expect(
    await page.evaluate(
      () => globalThis.__deliveredMetadata.documentTransform.photometricChanges,
    ),
  ).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Add to your library" }),
  ).toBeVisible();
  await expect(page.locator("#positionState")).toHaveValue("graded");
  await expect(page.locator("#positionGrader")).toHaveValue("PSA");
  await expect(page.locator("#positionGrade")).toHaveValue("10");
  await expect(page.locator("#positionCertification")).toHaveValue("00012345");
  await expect(page.locator("#positionForm")).toContainText(
    "Read from photo · confirm the card and slab details.",
  );
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect
    .poll(() =>
      requests.writes.some((request) =>
        request.path.endsWith("/create_graded_copy_position"),
      ),
    )
    .toBe(true);
  const write = requests.writes.find((request) =>
    request.path.endsWith("/create_graded_copy_position"),
  );
  expect(write.body.p_certification_number).toBe("00012345");
  expect(JSON.stringify(write.body)).not.toContain("official");
});

test("live synthetic video drives detected outline and corrected preview", async ({
  page,
}, testInfo) => {
  await setup(page, { live: true });
  await expect(page.locator("#deviceCameraVideo")).toBeVisible();
  await expect
    .poll(
      () => page.locator("#deviceCameraOutline polygon").getAttribute("points"),
      { timeout: 15_000 },
    )
    .not.toBe("");
  await page.locator(".device-camera").screenshot({
    path: `${evidenceDirectory}/${testInfo.project.name}-live-detected-outline.png`,
  });
  await expect(page.locator("#deviceCameraCapture")).toBeEnabled();
  await page.locator("#deviceCameraCapture").click();
  await expect(page.locator("#deviceCameraState")).toContainText(
    "Corrected full slab preview",
    { timeout: 20_000 },
  );
  await page.locator(".device-camera").screenshot({
    path: `${evidenceDirectory}/${testInfo.project.name}-live-corrected-preview.png`,
  });
  await page.getByRole("button", { name: "Retake" }).click();
  await expect(page.locator("#deviceCameraReview")).toBeHidden();
  await expect(page.locator("#deviceCameraOutline polygon")).toHaveAttribute(
    "points",
    /\d/,
  );
  await page.getByRole("button", { name: "Close camera" }).click();
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(0);
});

test("stable live frame captures once without saving inventory", async ({
  page,
}, testInfo) => {
  const requests = await setup(page, { live: true, automatic: true });
  await expect(page.locator("#deviceCameraReview")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("#deviceCameraState")).toContainText(
    "Corrected full slab preview",
    { timeout: 20_000 },
  );
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(0);
  expect(requests.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Use photo" }).click();
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(1);
});

test("account change discards a pending camera correction", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    globalThis.__documentCaptureApp.state.session = {
      user: { id: "22222222-2222-4222-8222-222222222222" },
    };
  });
  await installSyntheticDocument(page);
  await page.evaluate(() => {
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#deviceCameraReview")).toBeHidden();
});

test("retake replaces a pending correction without stale overwrite", async ({
  page,
}, testInfo) => {
  await setup(page, { live: true });
  await installSyntheticDocument(page);
  await page.evaluate(() => {
    const decode = globalThis.createImageBitmap.bind(globalThis);
    let release;
    globalThis.__releaseDecode = () => release?.();
    globalThis.createImageBitmap = async (...args) => {
      globalThis.createImageBitmap = decode;
      await new Promise((resolve) => {
        release = resolve;
      });
      return decode(...args);
    };
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("button", { name: "Retake" })).toBeVisible();
  await page.getByRole("button", { name: "Retake" }).click();
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  const replacement = await page
    .locator("#deviceCameraReview")
    .getAttribute("src");
  await page.evaluate(() => globalThis.__releaseDecode());
  await page.waitForTimeout(300);
  await expect(page.locator("#deviceCameraReview")).toHaveAttribute(
    "src",
    replacement,
  );
  await page.getByRole("button", { name: "Use photo" }).click();
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(1);
});

test("opening edge adjustment while correction is pending keeps use disabled", async ({
  page,
}) => {
  await setup(page);
  await installSyntheticDocument(page);
  await page.evaluate(() => {
    const decode = globalThis.createImageBitmap.bind(globalThis);
    let release;
    globalThis.__releaseDecode = () => release?.();
    globalThis.createImageBitmap = async (...args) => {
      globalThis.createImageBitmap = decode;
      await new Promise((resolve) => {
        release = resolve;
      });
      return decode(...args);
    };
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Adjust edges" }).click();
  await page.evaluate(() => globalThis.__releaseDecode());
  await page.waitForTimeout(200);
  await expect(page.getByRole("button", { name: "Use photo" })).toBeDisabled();
  await page.getByRole("button", { name: "Apply correction" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
});

test("automatic session keeps manual recovery when no boundary is found", async ({
  page,
}, testInfo) => {
  const requests = await setup(page, {
    live: true,
    automatic: true,
    weakFrame: true,
  });
  await page.waitForTimeout(850);
  await expect(page.locator("#deviceCameraReview")).toBeHidden();
  await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(
    page.getByRole("button", { name: "Adjust edges" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeDisabled();
  await page.getByRole("button", { name: "Adjust edges" }).click();
  await expect(
    page.locator("#deviceCameraAdjustmentOutline polygon"),
  ).toHaveAttribute("points", /\d/);
  await page.getByRole("button", { name: "Apply correction" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  expect(
    requests.writes.filter((request) =>
      request.path.endsWith("/create_graded_copy_position"),
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Use photo" }).click();
  expect(
    await page.evaluate(() => globalThis.__deliveredMetadata.captureMethod),
  ).toBe("automatic_manual_fallback");
  expect(
    await page.evaluate(
      () => globalThis.__deliveredMetadata.geometry.manuallyAdjusted,
    ),
  ).toBe(true);
  const condition = await page.evaluate(async () => {
    const image = await globalThis.__documentCaptureApp.prepareVisionImage(
      globalThis.__deliveredFile,
      { purpose: "card" },
    );
    return {
      blockers: image.blockers,
      centering: image.printedBorderCentering,
      geometry: image.geometryMeasurements,
    };
  });
  expect(condition.centering.measurable).toBe(false);
  expect(condition.geometry.perspectiveVerified).toBe(false);
  expect(condition.blockers.join(" ")).toMatch(/angle/i);
});

test("manual corners expand unwarped evidence and invalidate centering", async ({
  page,
}, testInfo) => {
  await setup(page);
  await installSyntheticDocument(page, { marker: true });
  await page.evaluate(() => {
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Adjust edges" }).click();
  await expect(page.locator("#deviceCameraAdjustmentOutline")).toBeVisible();
  await expect(
    page.locator('#deviceCameraAdjustmentOutline circle[data-selected="true"]'),
  ).toHaveCount(1);
  for (let index = 0; index < 10; index += 1)
    await page
      .getByRole("button", { name: "Move selected corner left" })
      .click();
  await page.locator(".device-camera").screenshot({
    path: `${evidenceDirectory}/${testInfo.project.name}-adjusted-corners.png`,
  });
  await page.getByRole("button", { name: "Apply correction" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Use photo" }).click();
  const result = await page.evaluate(async () => {
    const app = globalThis.__documentCaptureApp;
    const image = await app.prepareVisionImage(globalThis.__deliveredFile, {
      purpose: "card",
    });
    const decoded = await createImageBitmap(image.researchBlob);
    const canvas = document.createElement("canvas");
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const context = canvas.getContext("2d");
    context.drawImage(decoded, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let markerPixels = 0;
    for (let index = 0; index < pixels.length; index += 4)
      if (
        pixels[index] > 170 &&
        pixels[index + 1] < 100 &&
        pixels[index + 2] > 140
      )
        markerPixels += 1;
    decoded.close();
    return {
      metadata: globalThis.__deliveredMetadata,
      width: image.width,
      height: image.height,
      blobWidth: canvas.width,
      blobHeight: canvas.height,
      markerPixels,
      centering: image.printedBorderCentering,
      geometry: image.geometryMeasurements,
      transform: image.documentCapture.transform,
    };
  });
  expect(result.metadata.geometry.bounds.x).toBeLessThan(
    result.metadata.geometry.corners.topLeft.x,
  );
  expect(result.markerPixels).toBeGreaterThan(100);
  expect([result.width, result.height]).toEqual([
    result.blobWidth,
    result.blobHeight,
  ]);
  expect(result.transform.sourceWidth).toBe(700);
  expect(result.transform.outputWidth).toBeGreaterThan(0);
  expect(result.geometry.perspectiveVerified).toBe(false);
  expect(result.centering.measurable).toBe(false);
});

test("automatic retake ignores an older correction and captures the next eligible frame", async ({
  page,
}, testInfo) => {
  await setup(page, { live: true, automatic: true, initialHidden: true });
  await installSyntheticDocument(page);
  await page.evaluate(() => {
    const decode = globalThis.createImageBitmap.bind(globalThis);
    let release;
    globalThis.__releaseDecode = () => release?.();
    globalThis.createImageBitmap = async (...args) => {
      globalThis.createImageBitmap = decode;
      await new Promise((resolve) => {
        release = resolve;
      });
      return decode(...args);
    };
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Retake" }).click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled({
    timeout: 20_000,
  });
  const replacement = await page
    .locator("#deviceCameraReview")
    .getAttribute("src");
  await page.evaluate(() => globalThis.__releaseDecode());
  await page.waitForTimeout(300);
  await expect(page.locator("#deviceCameraReview")).toHaveAttribute(
    "src",
    replacement,
  );
  await page.getByRole("button", { name: "Use photo" }).click();
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(1);
});

test("switching cameras stops the old stream and keeps a working shutter", async ({
  page,
}, testInfo) => {
  await setup(page, { live: true, twoCameras: true });
  await expect(
    page.getByRole("button", { name: "Switch camera" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Switch camera" }).click();
  await expect(page.getByRole("button", { name: "Take photo" })).toBeEnabled();
  const streams = await page.evaluate(() => ({
    calls: globalThis.__mediaCalls,
    old: globalThis.__mediaStreams[0]
      .getTracks()
      .map((track) => track.readyState),
    current: globalThis.__mediaStreams[1]
      .getTracks()
      .map((track) => track.readyState),
  }));
  expect(streams.calls[1].video.deviceId).toEqual({ exact: "camera-b" });
  expect(streams.old).toEqual(["ended"]);
  expect(streams.current).toEqual(["live"]);
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
});

test("closing during a pending camera switch stops its late stream", async ({
  page,
}) => {
  await setup(page, { live: true, twoCameras: true });
  await page.evaluate(() => {
    const media = navigator.mediaDevices;
    const original = media.getUserMedia.bind(media);
    let release;
    globalThis.__releaseSwitch = () => release?.();
    media.getUserMedia = async (constraints) => {
      await new Promise((resolve) => {
        release = resolve;
      });
      return original(constraints);
    };
  });
  await page.getByRole("button", { name: "Switch camera" }).click();
  await page.getByRole("button", { name: "Close camera" }).click();
  await page.evaluate(() => globalThis.__releaseSwitch());
  await expect
    .poll(() => page.evaluate(() => globalThis.__mediaStreams.length))
    .toBe(2);
  expect(
    await page.evaluate(() =>
      globalThis.__mediaStreams[1].getTracks().map((track) => track.readyState),
    ),
  ).toEqual(["ended"]);
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(0);
});

test("hidden document pauses automatic capture and resumes on return", async ({
  page,
}, testInfo) => {
  await setup(page, { live: true, automatic: true, initialHidden: true });
  await page.waitForTimeout(1000);
  await expect(page.locator("#deviceCameraReview")).toBeHidden();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled({
    timeout: 20_000,
  });
});

test("supplemental full card and detail use their respective evidence paths", async ({
  page,
}, testInfo) => {
  await setup(page, {
    live: true,
    captureRequest: {
      type: "alternate_front",
      side: "front",
      reason: "Retake full front",
    },
  });
  await expect(
    page.locator('.device-camera[data-camera-kind="card"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Use photo" }).click();
  const full = await page.evaluate(async () => {
    const image = await globalThis.__documentCaptureApp.prepareVisionImage(
      globalThis.__deliveredFile,
      { purpose: "card", captureType: "alternate_front" },
    );
    return {
      type: image.captureType,
      corrected: image.documentCapture.corrected,
      unwarped: image.documentCapture.conditionEvidence,
    };
  });
  expect(full).toEqual({
    type: "alternate_front",
    corrected: true,
    unwarped: "unwarped_source_crop",
  });

  await page.evaluate(() =>
    globalThis.__documentCaptureApp.openDeviceCamera({
      kind: "supplemental",
      captureRequest: {
        type: "corner_closeup",
        side: "front",
        reason: "Show the corner",
      },
      onPhoto: (file) => {
        globalThis.__detailFile = file;
      },
    }),
  );
  await expect(
    page.locator('.device-camera[data-camera-kind="detail"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Take photo" }).click();
  await expect(page.getByRole("button", { name: "Adjust edges" })).toBeHidden();
  await page.getByRole("button", { name: "Use photo" }).click();
  const detail = await page.evaluate(async () => {
    const image = await globalThis.__documentCaptureApp.prepareVisionImage(
      globalThis.__detailFile,
      { purpose: "detail", captureType: "corner_closeup" },
    );
    return {
      type: image.captureType,
      corrected: image.documentCapture.corrected,
      width: image.width,
      height: image.height,
    };
  });
  expect(detail).toEqual({
    type: "corner_closeup",
    corrected: false,
    width: 700,
    height: 1000,
  });
});

test("corrected slab pixels reach approved identification without inventory save", async ({
  page,
}) => {
  const requests = await setup(page, { recognition: true });
  await installSyntheticDocument(page);
  await page.evaluate(() => {
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Use photo" }).click();
  await expect(page.getByRole("button", { name: "Find matching cards" })).toHaveCount(0);
  await expect.poll(() => requests.vision.length).toBe(1);
  expect(requests.vision[0].mode).toBe("identify");
  expect(requests.vision[0].images).toHaveLength(1);
  const source = requests.vision[0].images[0];
  expect(source).toMatch(/^data:image\/jpeg;base64,/);
  const pixels = await page.evaluate(async (dataUrl) => {
    const blob = await (await fetch(dataUrl)).blob();
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let label = 0,
      card = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] > 120 && data[index + 1] < 100 && data[index + 2] < 110)
        label += 1;
      if (data[index + 2] > 110 && data[index] < 120) card += 1;
    }
    image.close();
    return { width: canvas.width, height: canvas.height, label, card };
  }, source);
  // The approved recognizer receives corrected document pixels, not a report screenshot.
  expect(pixels).toMatchObject({ width: 407, height: test.info().project.name === "mobile-webkit" ? 832 : 834 });
  expect(pixels.label).toBeGreaterThan(1000);
  expect(pixels.card).toBeGreaterThan(1000);
  expect(
    requests.writes.filter((request) =>
      request.path.endsWith("/create_graded_copy_position"),
    ),
  ).toHaveLength(0);
});

test("rejected geometry retains source pixels while identification proceeds and grading correction stays guarded", async ({
  page,
}, testInfo) => {
  const requests = await setup(page, { recognition: true });
  await installSyntheticDocument(page, { marker: true });
  const result = await page.evaluate(async () => {
    const app = globalThis.__documentCaptureApp;
    const blob = globalThis.__syntheticTransfer.files[0];
    const makeFile = (bounds, corners, correctable = false) => {
      const file = new File([blob], "rejected-slab.jpg", {
        type: "image/jpeg",
      });
      file.micaCaptureMetadata = {
        geometry: {
          detected: true,
          ...(correctable === null ? {} : { correctable }),
          straight: false,
          confidence: 0.8,
          documentKind: "slab",
          perspectiveDelta: 0.52,
          bounds,
          corners,
        },
      };
      return file;
    };
    const full = { x: 0, y: 0, width: 1, height: 1 };
    const inner = { x: 0.25, y: 0.3, width: 0.5, height: 0.55 };
    const broadCorners = {
      topLeft: { x: 0.08, y: 0.05 },
      topRight: { x: 0.92, y: 0.05 },
      bottomRight: { x: 0.92, y: 0.95 },
      bottomLeft: { x: 0.08, y: 0.95 },
    };
    const innerCorners = {
      topLeft: { x: 0.25, y: 0.3 },
      topRight: { x: 0.75, y: 0.3 },
      bottomRight: { x: 0.75, y: 0.85 },
      bottomLeft: { x: 0.25, y: 0.85 },
    };
    const markerPixels = async (source) => {
      const image = await createImageBitmap(await (await fetch(source)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      ).data;
      let label = 0;
      let marker = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (
          pixels[index] > 140 &&
          pixels[index + 1] < 100 &&
          pixels[index + 2] < 110
        )
          label += 1;
        if (
          pixels[index] > 150 &&
          pixels[index + 1] < 100 &&
          pixels[index + 2] > 140
        )
          marker += 1;
      }
      image.close();
      return { label, marker };
    };
    const observations = [];
    for (const [name, bounds, corners] of [
      ["bounds", inner, broadCorners],
      ["corners", full, innerCorners],
      ["legacy", inner, broadCorners],
    ]) {
      const file = makeFile(bounds, corners, name === "legacy" ? null : false);
      const preview = await app.prepareDocumentPreview(file, {
        geometry: file.micaCaptureMetadata.geometry,
      });
      for (const purpose of ["card", "collectible"]) {
        const prepared = await app.prepareVisionImage(file, { purpose });
        observations.push({
          name,
          purpose,
          previewCorrected: preview.corrected,
          evidence: await markerPixels(prepared.dataUrl),
          identity: await markerPixels(prepared.identityDataUrl),
          display: await markerPixels(prepared.previewDataUrl),
          blockers: prepared.blockers,
          provenance: prepared.geometryMeasurements,
          capture: prepared.documentCapture,
          centering: prepared.printedBorderCentering,
        });
      }
    }
    const detail = await app.prepareVisionImage(makeFile(inner, broadCorners), {
      purpose: "detail",
    });
    observations.push({
      name: "detail",
      evidence: await markerPixels(detail.dataUrl),
      blockers: detail.blockers,
      provenance: detail.geometryMeasurements,
      capture: detail.documentCapture,
    });
    globalThis.__rejectedFile = makeFile(inner, broadCorners);
    await app.showProcessing(globalThis.__rejectedFile);
    return observations;
  });
  for (const item of result.filter((entry) => entry.name !== "detail")) {
    expect(item.previewCorrected).toBe(false);
    for (const pixels of [item.evidence, item.identity, item.display]) {
      expect(pixels.label).toBeGreaterThan(1000);
      expect(pixels.marker).toBeGreaterThan(100);
    }
    if (item.purpose === "card") expect(item.blockers.join(" ")).toMatch(/adjust|retake|edges/i);
    else expect(item.blockers).toHaveLength(0);
    expect(item.provenance.normalizedCropApplied).toBe(false);
    expect(item.provenance.backgroundExcluded).toBe(false);
    expect(item.provenance.boundaryVerified).toBe(false);
    expect(item.provenance.perspectiveVerified).toBe(false);
    expect(item.provenance.sourceCardBounds).toBeNull();
    expect(item.capture.corrected).toBe(false);
    expect(item.capture.kind).toBe("card");
    expect(item.capture.transform).toBeNull();
    expect(item.capture.conditionEvidence).toBe("full_source_frame");
    expect(item.centering.measurable).toBe(false);
  }
  const detail = result.find((item) => item.name === "detail");
  expect(detail.evidence.label).toBeGreaterThan(1000);
  expect(detail.evidence.marker).toBeGreaterThan(100);
  expect(detail.blockers).toHaveLength(0);
  expect(detail.capture.conditionEvidence).toBe("full_source_frame");
  await expect(page.getByRole("button", { name: "Find matching cards" })).toHaveCount(0);
  await expect.poll(()=>requests.vision.length).toBe(1);
  await expect(page.getByRole("button", {name:"Adjust or retake"})).toBeHidden();
  await page.screenshot({
    path: `${rejectedGeometryEvidenceDirectory}/${testInfo.project.name}-rejected-assist.png`,
  });
  expect(requests.vision).toHaveLength(1);
  // Manual edge correction remains a secondary grading/evidence capability.
  await page.evaluate(() => globalThis.__documentCaptureApp.openDeviceCamera({kind:"card",onPhoto:file=>{globalThis.__manualRecoveredFile=file;}}));
  await page.evaluate(() => {
    const input = document.querySelector("#deviceCameraUpload");
    globalThis.__rejectedPreviewGeometry = { ...globalThis.__rejectedFile.micaCaptureMetadata.geometry, correctable: false };
    const transfer = new DataTransfer();
    transfer.items.add(globalThis.__rejectedFile);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("button", { name: "Use photo" })).toBeDisabled();
  await page.getByRole("button", { name: "Adjust edges" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeDisabled();
  await page.getByRole("button", { name: "Apply correction" }).click();
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  await page.getByRole("button", { name: "Use photo" }).click();
  await expect(page.getByRole("button", { name: "Find matching cards" })).toHaveCount(0);
  await page.screenshot({
    path: `${rejectedGeometryEvidenceDirectory}/${testInfo.project.name}-manual-recovery.png`,
  });
  expect(await page.evaluate(()=>Boolean(globalThis.__manualRecoveredFile))).toBe(true);
  expect(requests.vision).toHaveLength(1);
  expect(
    requests.writes.filter((request) =>
      request.path.endsWith("/create_graded_copy_position"),
    ),
  ).toHaveLength(0);
  await writeFile(
    `${rejectedGeometryEvidenceDirectory}/${testInfo.project.name}-pixels.json`,
    `${JSON.stringify({ observations: result, cloudVisionRequests: requests.vision.length }, null, 2)}\n`,
  );
});

test("WebKit local canvas stream harness reports whether video frames start", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-webkit",
    "WebKit harness diagnostic only",
  );
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 480;
    if (typeof canvas.captureStream !== "function")
      return { supported: false, readyState: 0, width: 0 };
    const context = canvas.getContext("2d");
    const stream = canvas.captureStream(15);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    document.body.append(video);
    const timer = setInterval(() => {
      context.fillStyle = `rgb(${Math.floor(Math.random() * 255)}, 50, 50)`;
      context.fillRect(0, 0, 320, 480);
    }, 60);
    await Promise.race([
      video.play().catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1800)),
    ]);
    const result = {
      supported: true,
      readyState: video.readyState,
      width: video.videoWidth,
    };
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    video.remove();
    return result;
  });
  testInfo.annotations.push({
    type: "WebKit local video",
    description: JSON.stringify(result),
  });
  console.log(`WebKit canvas video harness: ${JSON.stringify(result)}`);
  expect(result.supported).toBe(true);
  expect(result.readyState).toBeGreaterThanOrEqual(2);
  expect(result.width).toBe(320);
});

test("account change after review cannot deliver the previous owner's photo", async ({
  page,
}) => {
  const requests = await setup(page);
  await installSyntheticDocument(page);
  await page.evaluate(() => {
    const input = document.querySelector("#deviceCameraUpload");
    input.files = globalThis.__syntheticTransfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.getByRole("button", { name: "Use photo" })).toBeEnabled();
  await page.evaluate(() => {
    globalThis.__documentCaptureApp.state.session = {
      user: { id: "22222222-2222-4222-8222-222222222222" },
    };
  });
  await page.getByRole("button", { name: "Use photo" }).click();
  expect(await page.evaluate(() => globalThis.__photosDelivered)).toBe(0);
  expect(
    requests.writes.filter((request) =>
      request.path.endsWith("/create_graded_copy_position"),
    ),
  ).toHaveLength(0);
});


test("primary intake camera fills viewport edge to edge with overlay controls, retaining correction and cleanup", async ({ page }, testInfo) => {
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  const requests = await setup(page, {experience:'intake'});
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.evaluate(()=>globalThis.__documentCaptureApp.bindEvents());
  await page.locator(page.viewportSize().width < 760 ? '.scan-nav' : '.quick-add:visible').first().click();
  await expect(page.locator('#bottomSheet')).toHaveAttribute('data-experience','intake');
  const bounds = await page.locator('#bottomSheet').boundingBox();
  expect(bounds.x).toBe(0); expect(bounds.y).toBe(0);
  expect(bounds.width).toBeCloseTo(page.viewportSize().width,1); expect(bounds.height).toBeCloseTo(page.viewportSize().height,1);
  await expect(page.getByRole('button',{name:'Back',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Take photo',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose photo from library',exact:true})).toBeVisible();
  await expect(page.locator('#deviceCameraTorch, #deviceCameraTimer, #deviceCameraMotion, #deviceCameraSwitch')).toHaveCount(0);
  const back=await page.getByRole('button',{name:'Back',exact:true}).boundingBox();
  const shutter=await page.getByRole('button',{name:'Take photo',exact:true}).boundingBox();
  const library=await page.getByRole('button',{name:'Choose photo from library',exact:true}).boundingBox();
  expect(back.y+back.height).toBeLessThan(shutter.y); expect(library.x+library.width).toBeLessThan(shutter.x); expect(library.x).toBeLessThanOrEqual(24);
  expect(shutter.x+shutter.width/2).toBeCloseTo(page.viewportSize().width/2,1);
  const video=await page.locator("#deviceCameraVideo").boundingBox();
  expect(video.x).toBe(0); expect(video.y).toBe(0);
  expect(video.width).toBeCloseTo(page.viewportSize().width,1); expect(video.height).toBeCloseTo(page.viewportSize().height,1);
  expect(shutter.y+shutter.height).toBeLessThanOrEqual(page.viewportSize().height);
  await page.screenshot({path:testInfo.outputPath('full-screen-intake-denied-fixture.png'),fullPage:false});
  await installSyntheticDocument(page);
  await page.evaluate(()=>{const input=document.querySelector('#deviceCameraUpload');input.files=globalThis.__syntheticTransfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await expect.poll(()=>requests.vision.length).toBe(1);
  await expect(page.getByRole('button',{name:'Use photo',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Adjust edges',exact:true})).toHaveCount(0);
  await page.locator('#bottomSheet .sheet-close').click();
  await expect(page.locator('#bottomSheet')).toBeHidden();
  expect(await page.locator('#sheetContent').textContent()).toBe('');
  expect(requests.writes.filter(r => !r.path.endsWith('/rpc/record_ingestion_event'))).toHaveLength(0); expect(requests.vision).toHaveLength(1);
  expect(requests.catalog).toHaveLength(0); expect(errors).toEqual([]);
});


for (const automatic of [false, true]) test('full-screen intake '+(automatic?'automatic':'shutter')+' live fixture corrects once and stops stream without photo confirmation', async ({page},testInfo)=>{
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const requests=await setup(page,{live:true,automatic,experience:'intake'});
  // A full-screen guide occupies a different source-camera region than the old sheet.
  // Place the same synthetic document inside that actual guide; keep detector thresholds.
  await page.evaluate(()=>{
    const guide=globalThis.__documentCaptureApp.guideCropInFrame(document.querySelector('#deviceCameraVideo'),document.querySelector('.auto-capture-guide'));
    // Both positive live cases use the same printed texture, independent of capture mode.
    const documentContext=globalThis.__syntheticDocumentCanvas.getContext('2d');
    documentContext.fillStyle='#d7ccb3';
    for(let y=344;y<820;y+=20) documentContext.fillRect(180,y,340,9);
    const canvas=globalThis.__liveCanvas,context=canvas.getContext('2d');
    context.fillStyle='#596a60';context.fillRect(0,0,canvas.width,canvas.height);
    const source=globalThis.__syntheticDocumentCanvas,scale=Math.min(guide.width/source.width,guide.height/source.height)*.9;
    const width=source.width*scale,height=source.height*scale;
    context.drawImage(source,guide.x+(guide.width-width)/2,guide.y+(guide.height-height)/2,width,height);
  });
  if (!automatic) {
    await expect(page.locator('.auto-capture-guide')).toHaveAttribute('data-state','ready',{timeout:15000});
    await expect(page.getByRole('button',{name:'Take photo',exact:true})).toBeEnabled();
    await expect(page.locator(".auto-capture-guide")).toHaveAttribute("data-detected","true");
    expect(await page.locator("#deviceCameraOutline polygon").evaluate(el=>getComputedStyle(el).fill)).toBe("rgba(64, 156, 255, 0.22)");
    await page.screenshot({path:testInfo.outputPath('full-screen-live-camera-fixture.png')});
    await page.getByRole('button',{name:'Take photo',exact:true}).click();
  }
  await expect(page.locator('#bottomSheet[data-experience="intake"]')).toBeHidden({timeout:20000});
  await expect(page.getByRole('button',{name:'Use photo',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>globalThis.__photosDelivered)).toBe(1);
  expect(await page.evaluate(()=>globalThis.__mediaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))).toBe(true);
  await expect(page.locator('#positionCertification')).toHaveValue('00012345');
  await expect(page.locator('#positionGrader')).toHaveValue('PSA');
  await expect(page.locator('#positionGrade')).toHaveValue('10');
  expect(await page.locator('#bottomSheet').getAttribute('data-experience')).toBeNull();
  expect(requests.writes.filter(r=>!r.path.endsWith('/rpc/record_ingestion_event'))).toHaveLength(0);
  expect(requests.vision).toHaveLength(0); expect(errors).toEqual([]);
});

for (const [exact,graded] of [[true,true],[true,false],[false,true]]) test(`intake skips photo confirmation and ${exact ? "opens the exact "+(graded?"graded":"raw")+" match" : "keeps uncertain matches explicit"}`, async ({page}) => {
  const requests = await setup(page, {recognition:true,experience:"intake",visionPayload:{analysis:{quality:{usable:true},identity:{name:"Pikachu",collectorNumber:"025/165",language:"en",cardState:graded?"graded":"raw",grader:graded?"PSA":null,grade:graded?"10":null,confidence:0.98}},catalogResolution:{cards:[{id:"fixture-pikachu",name:"Pikachu",set:"151",number:"025/165",language:"en",variant:"Holofoil",thumb:"/icons/icon.svg"}],resolution:{status:exact?"exact":"needs_review",recommendedId:"fixture-pikachu"}}}});
  await installSyntheticDocument(page);
  await page.evaluate(() => {const input=document.querySelector("#deviceCameraUpload");input.files=globalThis.__syntheticTransfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));});
  await expect.poll(()=>requests.vision.length).toBe(1);
  await expect(page.getByRole("button",{name:"Use photo",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Adjust edges",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Find matching cards",exact:true})).toHaveCount(0);
  if(exact){await expect(page.locator("#detailTitle")).toHaveText("Pikachu");await expect(page.locator("#positionForm")).toHaveCount(0);expect(await page.evaluate(()=>Boolean(globalThis.__documentCaptureApp.state.detailScanDraft?.options.photoDataUrl))).toBe(true);expect(await page.evaluate(()=>globalThis.__documentCaptureApp.state.detailValuationContext.cardState)).toBe(graded?"graded":"raw");await page.locator("#addLibraryButton").click();await expect(page.locator("#positionState")).toHaveValue(graded?"graded":"raw");if(graded){await expect(page.locator("#positionGrader")).toHaveValue("PSA");await expect(page.locator("#positionGrade")).toHaveValue("10");}}
  else {await expect(page.locator("[data-vision-card]")).toBeVisible();await expect(page.locator("#positionForm")).toHaveCount(0);}
  expect(requests.writes.filter(request=>!request.path.endsWith("/rpc/record_ingestion_event"))).toHaveLength(0);
  expect(requests.vision).toHaveLength(1);
  expect(requests.vision[0].mode).toBe("identify");
  expect(requests.vision[0].images).toHaveLength(1);
  expect(requests.catalog).toHaveLength(0);
});

test("late automatic identification cannot open a match for a different owner", async ({page}) => {
  await setup(page,{recognition:true,experience:"intake"});let pending;
  await page.route("**/api/vision",route=>{pending=route;});
  await installSyntheticDocument(page);
  await page.evaluate(()=>{const input=document.querySelector("#deviceCameraUpload");input.files=globalThis.__syntheticTransfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));});
  await expect.poll(()=>Boolean(pending)).toBe(true);
  await page.evaluate(()=>{globalThis.__documentCaptureApp.state.session={user:{id:"different-owner"},access_token:"different-token"};});
  await pending.fulfill({contentType:"application/json",body:JSON.stringify({analysis:{quality:{usable:true},identity:{name:"Pikachu"}},catalogResolution:{cards:[{id:"fixture-pikachu",name:"Pikachu",set:"151",number:"025/165",language:"en",variant:"Holofoil",thumb:"/icons/icon.svg"}],resolution:{status:"exact",recommendedId:"fixture-pikachu"}}})});
  await page.waitForTimeout(200);
  await expect(page.locator("#sheetTitle")).toHaveText("Checking your card");
  await expect(page.getByRole("status", { name: "Loading your card" })).toBeVisible();
  await expect(page.locator(".skeleton-card")).toBeVisible();
  const box = await page.locator("#bottomSheet").boundingBox();
  expect(box.x).toBe(0); expect(box.y).toBe(0);
  expect(box.width).toBe(page.viewportSize().width); expect(box.height).toBeCloseTo(page.viewportSize().height, 1);
  await expect(page.getByRole("button", {name:"Back", exact:true})).toBeVisible();
  await expect(page.locator("#positionForm")).toHaveCount(0);
  await expect(page.locator("[data-vision-card]")).toHaveCount(0);
});

test("unreadable intake photo offers retake without edge or confirmation controls", async ({page},testInfo) => {
  const requests=await setup(page,{experience:"intake",recognition:true});
  await page.evaluate(async()=>{const c=document.createElement("canvas");c.width=700;c.height=1000;c.getContext("2d").fillRect(0,0,700,1000);const blob=await new Promise(resolve=>c.toBlob(resolve,"image/jpeg"));const transfer=new DataTransfer();transfer.items.add(new File([blob],"unreadable.jpg",{type:"image/jpeg"}));const input=document.querySelector("#deviceCameraUpload");input.files=transfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));});
  await expect(page.locator("#visionLocalCheck")).toContainText("Retake this photo");
  await expect(page.getByRole("button",{name:"Adjust or retake",exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Use photo",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Adjust edges",exact:true})).toHaveCount(0);
  expect(requests.vision).toHaveLength(0);
  expect(requests.writes.filter(r=>!r.path.endsWith("/rpc/record_ingestion_event"))).toHaveLength(0);
  await page.screenshot({path:testInfo.outputPath("intake-unreadable-retry.png")});
});

 test("Japanese photo uses detected language without selecting Japanese",async({page})=>{
  const requests=await setup(page,{recognition:true,experience:"intake",visionPayload:{analysis:{quality:{usable:true},identity:{name:"ピカチュウ",collectorNumber:"236/190",language:"ja",cardState:"raw",confidence:0.98}},catalogResolution:{cards:[{id:"fixture-ja",name:"ピカチュウ",number:"236/190",language:"ja",set:"Shiny Treasure ex",variant:"Holofoil",thumb:"/icons/icon.svg"}],resolution:{status:"exact",recommendedId:"fixture-ja"}}}});
  await page.evaluate(()=>{document.querySelector("#quickSearchLanguage").value="en";});
  await installSyntheticDocument(page);
  await page.evaluate(()=>{const input=document.querySelector("#deviceCameraUpload");input.files=globalThis.__syntheticTransfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));});
  await expect(page.locator("#detailTitle")).toHaveText("ピカチュウ");
  expect(requests.catalog).toHaveLength(0);expect(requests.vision).toHaveLength(1);expect(requests.vision[0].mode).toBe("identify");
 });

test("readable intake reaches recognition when card edges cannot be isolated", async ({page}) => {
 const requests=await setup(page,{recognition:true,experience:"intake"});
 await installSyntheticDocument(page);
 await page.evaluate(()=>{globalThis.__rejectedPreviewGeometry={detected:false,correctable:false,reason:"foreground_not_card_shaped"};const input=document.querySelector("#deviceCameraUpload");input.files=globalThis.__syntheticTransfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));});
 await expect.poll(()=>requests.vision.length).toBe(1);
 expect(requests.vision[0].mode).toBe("identify");expect(requests.vision[0].images).toHaveLength(1);
 await expect(page.getByRole("button",{name:"Adjust edges",exact:true})).toHaveCount(0);
 expect(requests.writes.filter(r=>!r.path.endsWith("/rpc/record_ingestion_event"))).toHaveLength(0);
});

test("automatic raw match hydrates photo, price and history without saving a guessed condition", async ({page}) => {
  const cards = [{id:"other",name:"Pikachu",set:"151",number:"025/165",language:"en",variants:["Holofoil","Normal"]}, {id:"mega",name:"M Charizard EX",set:"Evolutions",number:"101/108",language:"en",variants:["Holofoil","Normal"],externalIds:{tcgplayer:124114}}];
  const requests = await setup(page,{recognition:true,experience:"intake",visionPayload:{analysis:{quality:{usable:true},identity:{name:"M Charizard EX",collectorNumber:"101/108",language:"en",cardState:"raw",confidence:.98}},catalogResolution:{cards,resolution:{status:"exact",recommendedId:"mega"}}}});
  await page.route("https://images.pkmnprices.com/**",route=>route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="green"/></svg>'}));
  await page.route("**/api/cards?*",route=>{
    const q={provider:"tcgplayer",aggregator:"pkmnprices",currency:"USD",condition:"Near Mint",finish:"holofoil",priceType:"market",amount:125,observedAt:new Date().toISOString(),retrievedAt:new Date().toISOString()};
    return route.fulfill({contentType:"application/json",body:JSON.stringify({cards:[{images:{large:"https://images.pkmnprices.com/cards/24784.webp",small:"https://images.pkmnprices.com/cards/24784.webp"},externalIds:{pkmnprices:24784},quotes:[q],history:[{...q,recordedAt:"2026-10-01T00:00:00Z",amount:120},{...q,recordedAt:"2026-10-02T00:00:00Z"}],historyStatus:"live"}]})});
  });
  await installSyntheticDocument(page);
  await page.evaluate(()=>{const i=document.querySelector("#deviceCameraUpload");i.files=globalThis.__syntheticTransfer.files;i.dispatchEvent(new Event("change",{bubbles:true}));});
  await expect(page.locator("#detailTitle")).toHaveText("M Charizard EX");
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect(page.locator("#detailBack")).toBeVisible();
  await expect(page.locator(".detail-sticky-action button")).toHaveCount(1);
  await expect(page.getByRole("button", {name:"Add card", exact:true})).toBeVisible();
  await expect(page.locator(".market-hero")).toContainText("$125.00");
  await expect(page.locator(".detail-image img")).toHaveAttribute("src","https://images.pkmnprices.com/cards/24784.webp");
  await expect.poll(()=>page.locator(".detail-image img").evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  expect(await page.evaluate(()=>globalThis.__documentCaptureApp.state.detailPricing.priceHistory.length)).toBeGreaterThan(1);
  expect(await page.evaluate(()=>globalThis.__documentCaptureApp.state.detailCard.condition)).toBeNull();
  expect(requests.vision).toHaveLength(1);
  expect(requests.writes.filter(r=>!r.path.endsWith("/rpc/record_ingestion_event"))).toHaveLength(0);
  await page.locator("#addLibraryButton").click();
  await expect(page.locator("#positionCondition")).toHaveValue("unknown");
});

 test("Back cancels full-screen identification and a late response cannot reopen it", async ({page}) => {
  await setup(page,{recognition:true,experience:"intake"}); let pending;
  await page.route("**/api/vision",route=>{pending=route;});
  await installSyntheticDocument(page);
  await page.evaluate(()=>{const input=document.querySelector("#deviceCameraUpload");input.files=globalThis.__syntheticTransfer.files;input.dispatchEvent(new Event("change",{bubbles:true}));});
  await expect.poll(()=>Boolean(pending)).toBe(true);
  await page.locator("#cancelIdentification").click();
  await pending.fulfill({contentType:"application/json",body:JSON.stringify({analysis:{quality:{usable:true},identity:{name:"Pikachu"}},catalogResolution:{cards:[{id:"fixture-pikachu",name:"Pikachu",set:"151",number:"025/165",language:"en",variant:"Holofoil"}],resolution:{status:"exact",recommendedId:"fixture-pikachu"}}})});
  await page.waitForTimeout(200);
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect(page.locator("#detailTitle")).not.toBeVisible();
  expect(await page.locator(".bottom-nav > button").evaluateAll(nodes=>nodes.map(n=>n.dataset.route||n.dataset.sidebarTarget))).toEqual(["dashboard","scan","collection"]);
 });
