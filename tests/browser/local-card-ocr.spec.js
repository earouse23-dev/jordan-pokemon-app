import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
let ocrFiles, appBundle;
test.use({ serviceWorkers: "block" });
test.beforeAll(async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  ocrFiles = new Map((
    await build({
      entryPoints: [`${root}lib/card-ocr.js`],
      bundle: true,
      platform: "browser",
      format: "esm",
      target: ["es2022"],
      splitting: true,
      minify: true,
      outdir: "/ocr-check",
      write: false,
    })
  ).outputFiles.map(file => [file.path, file.text]));
  const source = (await readFile(`${root}app.js`, "utf8")).replace(
    "void bootstrap();",
    "",
  );
  appBundle = (
    await build({
      stdin: {
        contents: `${source}\nexport { bindEvents, routeTo, state };`,
        resolveDir: root,
        sourcefile: "app.js",
      },
      bundle: true,
      platform: "browser",
      format: "esm",
      write: false,
    })
  ).outputFiles[0].text;
});
test("real local OCR reads pixels without photo upload or external requests", async ({
  page,
}, testInfo) => {
  const outbound = [];
  page.on("request", (r) => {
    if (
      new URL(r.url()).origin !==
      new URL(testInfo.project.use.baseURL || "http://127.0.0.1:4189").origin
    )
      outbound.push(r.url());
  });
  await page.route("**/ocr-check/**", (r) =>
    r.fulfill({ contentType: "application/javascript", body: ocrFiles.get(new URL(r.request().url()).pathname) }),
  );
  await page.route("**/app.js*", (r) =>
    r.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.goto("/");
  const proof = await page.evaluate(async () => {
    const api = await import("/ocr-check/card-ocr.js");
    const start = performance.now();
    await api.warmCardOcr("en");
    const coldMs = performance.now() - start;
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 1120;
    const x = c.getContext("2d");
    const results = [];
    for (const slab of [false, true]) {
      x.fillStyle = "white";
      x.fillRect(0, 0, 800, 1120);
      x.fillStyle = "black";
      x.font = "bold 50px Arial";
      x.fillText(slab ? "PSA GEM MT 10" : "Mewtwo GX", 130, 90);
      if (slab) x.fillText("Mewtwo GX", 30, 360);
      x.font = "bold 24px Arial";
      x.fillText("76/73", 130, 1085);
      const tick = performance.now();
      const identity = await api.readCardText(c.toDataURL(), {
        documentKind: slab ? "slab" : "card",
      });
      results.push({
        ms: performance.now() - tick,
        number: identity.query,
        grade: identity.grade,
        state: identity.cardState,
        exact: api.matchOcrCards(identity, [
          { name: "Mewtwo GX", number: "076/073", language: "en" },
        ]).exact,
      });
    }
    return { coldMs, results };
  });
  for (const result of proof.results) {
    expect(result.number).toBe("76/73");
    expect(result.exact).toBe(true);
    expect(result.ms).toBeLessThan(5000);
  }
  expect(proof.results[1].grade).toBe("10");
  expect(proof.results[1].state).toBe("graded");
  expect(outbound).toEqual([]);
  await testInfo.attach("local-ocr-timing", {
    body: JSON.stringify(proof),
    contentType: "application/json",
  });
});
test("light and dark mode persist, retaining green primary actions", async ({
  page,
}, testInfo) => {
  await page.route("**/app.js*", (r) =>
    r.fulfill({ contentType: "application/javascript", body: appBundle }),
  );
  await page.route("**/app-config.js*", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: "globalThis.__APP_CONFIG__={};",
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    const app = await import("/app.js");
    app.state.session = {
      user: { id: "11111111-1111-4111-8111-111111111111" },
    };
    app.state.accountLoading = false;
    app.bindEvents();
    document.body.classList.add("authenticated");
    document.querySelector("#authGate").hidden = true;
    document.querySelector("#appShell").removeAttribute("aria-hidden");
    app.routeTo("profile");
  });
  await page.locator("#appearanceSelect").selectOption("dark");
  await expect(page.locator("body")).toHaveAttribute("data-appearance", "dark");
  expect(await page.locator("#view-profile .simple-note").evaluate(el => ({ background: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }))).toEqual({background:"rgb(32, 44, 36)",color:"rgb(237, 242, 235)"});
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe("dark");
  expect(
    await page.evaluate(
      () =>
        getComputedStyle(document.querySelector("button.primary"))
          .backgroundColor,
    ),
  ).toBe("rgb(39, 100, 67)");
  await page.screenshot({
    path: testInfo.outputPath("dark-profile.png"),
    fullPage: true,
  });
  await page.goto("/");
  await page.evaluate(() => import("/app.js"));
  await expect(page.locator("body")).toHaveAttribute("data-appearance", "dark");
  await page.evaluate(async () => {
    const app = await import("/app.js");
    app.bindEvents();
    document.querySelector("#appearanceSelect").value = "light";
    document
      .querySelector("#appearanceSelect")
      .dispatchEvent(new Event("change"));
  });
  await expect(page.locator("body")).toHaveAttribute(
    "data-appearance",
    "light",
  );
});

 test("Japanese pixels select the Japanese catalog even with English as the menu default", async ({page})=>{
  await page.route("**/ocr-check/**",r=>r.fulfill({contentType:"application/javascript",body:ocrFiles.get(new URL(r.request().url()).pathname)}));
  await page.route("**/app.js*",r=>r.fulfill({contentType:"application/javascript",body:""}));
  await page.goto("/");
  const result=await page.evaluate(async()=>{const api=await import("/ocr-check/card-ocr.js");await api.warmCardOcr("en");const c=document.createElement("canvas");c.width=800;c.height=1120;const x=c.getContext("2d");x.fillStyle="white";x.fillRect(0,0,800,1120);x.fillStyle="black";x.font="bold 50px sans-serif";x.fillText("ピカチュウex",80,90);x.font="bold 26px Arial";x.fillText("023/106",60,1040);const id=await api.readCardText(c.toDataURL(),{language:"en"});return {query:id.query,language:id.language,exact:api.matchOcrCards(id,[{name:"ピカチュウex",number:"023/106",language:"ja"}]).exact};});
  expect(result).toEqual({query:"23/106",language:"ja",exact:true});
 });
