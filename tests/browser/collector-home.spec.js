import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appUrl = "/app.js?v=111";
let instrumentedApp;
test.use({ serviceWorkers: "block" });

test.beforeAll(async () => {
  const source = await readFile(
    new URL("../../app.js", import.meta.url),
    "utf8",
  );
  // Exports exist only in this intercepted test bundle, never the shipped app.
  const result = await build({
    stdin: {
      contents: `${source}\nexport { state, renderDetail, renderCollection, renderInsights, renderTrade, routeTo, bindEvents, saveCollectionViewState, restoreCollectionViewState, collectionViewStorageKey, supabase as testSupabase, openPositionEditSheet, openSheet, portfolioChartInstance, visionPrefill, saveCardAddDraft, refreshLivePricing, loadOwnedCollectionAttachments, openCardDetail, openPurchaseLotSheet }; export { hydratePosition } from "./lib/supabase-data.js";`,
      resolveDir: root,
      sourcefile: "app.js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  });
  instrumentedApp = result.outputFiles[0].text;
});

async function openSecondaryTools(page) {
  if (await page.locator("#detailMoreTools").isHidden()) await page.locator("#detailMoreToolsButton").click();
}

async function openDetail(page, overrides = {}) {
  await page.route("**/app.js?v=111", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedApp,
    }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__ = {supabaseUrl:"https://mica-detail-test.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("https://mica-detail-test.supabase.co/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }),
  );
  await page.goto("/");
  await expect(page.locator("#authGate")).toBeVisible();
  // Chromium can collect a CDP-awaited async promise while Chart.js initializes.
  // Keep the module import separate from the synchronous fixture render.
  await page.evaluate((url) => {
    globalThis.fixtureAppImport = import(url);
    return globalThis.fixtureAppImport.then((module) => { globalThis.fixtureApp = module; });
  }, appUrl);
  await page.evaluate(
    ({ overrides }) => {
      const { state, renderDetail } = globalThis.fixtureApp;
      const item = {
        uid: "11111111-1111-4111-8111-111111111111",
        id: "base1-4",
        name: "Charizard",
        set: "Base Set",
        number: "4/102",
        cardState: "raw",
        status: "owned",
        condition: "Near Mint",
        variant: "Holofoil",
        language: "en",
        currency: "USD",
        quantity: 1,
        price: null,
        referencePrice: 125,
        pricingStatus: "stale",
        pricingUpdatedAt: "2026-01-01",
        cost: null,
        costBasis: null,
        thumb: "/icons/icon.svg",
        quotes: [],
        priceHistory: [],
        transactions: [],
        lots: [],
        tags: [],
        ...overrides,
      };
      state.items = [item];
      state.detailId = item.uid;
      state.detailCard = item;
      state.route = "detail";
      state.detailReturnRoute = "collection";
      state.gradingReports.set(item.uid, []);
      state.organization.attachments.set(item.uid, {
        status: "ready",
        items: [],
      });
      document.body.dataset.uiTheme = "mica";
      document.body.dataset.workspace = "collector";
      document.body.dataset.softwareMode = "collector";
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      document.querySelectorAll(".view").forEach((view) => {
        const active = view.id === "view-detail";
        view.hidden = !active;
        view.classList.toggle("active", active);
        view.setAttribute("aria-hidden", String(!active));
      });
      renderDetail();
    },
    { appUrl, overrides },
  );
  await expect(page.locator("#detailTitle")).toHaveText("Charizard");
}

async function assertFits(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openCollection(page) {
  await openDetail(page);
  await page.evaluate(async (url) => {
    const { state, renderCollection, routeTo, bindEvents } = await import(url);
    state.session = { user: { id: "collection-owner" } };
    state.items.push({
      ...state.items[0],
      uid: "22222222-2222-4222-8222-222222222222",
      name: "Blastoise",
    });
    state.route = "collection";
    state.ledgerView = "all";
    state.query = "";
    state.accountLoading = false;
    state.accountLoadError = "";
    document.querySelectorAll(".view").forEach((view) => {
      const active = view.id === "view-collection";
      view.hidden = !active;
      view.classList.toggle("active", active);
      view.setAttribute("aria-hidden", String(!active));
    });
    state.gradingActivityStatus = "ready";
    bindEvents();
    routeTo("collection", { focus: false });
    renderCollection();
  }, appUrl);
  await expect(page.locator(".ledger-row")).toHaveCount(2);
}

test("client portfolio preserves unpriced inventory without rejected workspace controls", async ({ page }, testInfo) => {
  await openCollection(page);
  await page.evaluate(async url => {
    const { state, renderCollection, routeTo } = await import(url);
    state.items[0].quantity = 3;
    state.organization.goals = [{ id: "goal-home", name: "Base Set binder", progress: { status: "ready", current: 2, target: 102, percent: 2 / 102 * 100 } }];
    renderCollection(); routeTo("dashboard", { focus: false });
  }, appUrl);
  await expect(page.locator("#dashboardHighestTitle")).toHaveText("Your cards");
  await expect(page.locator("#dashboardHighestCards button")).toHaveCount(2);
  await expect(page.locator("#dashboardHighestCards")).toContainText("×3");
  await expect(page.locator("#softwareModeHome")).not.toBeVisible();
  await expect(page.locator("#collectionOrganization")).not.toBeVisible();
  await expect(page.locator("#softwareModeSettings")).not.toBeVisible();
  await expect(page.locator("[data-route=trade], [data-sidebar-target=trades], #softwareModeSelect")).toHaveCount(0);
  await expect(page.locator("#softwareModeHome")).not.toContainText("need review");
  await expect(page.locator("#portfolioChange")).not.toContainText("paid");
  await expect(page.locator("#portfolioValue")).toBeVisible();
  await expect(page.locator("#portfolioValue")).toHaveText("—");
  const hierarchy = await page.locator("#portfolioHistory, #portfolioReturn, #portfolioValue").evaluateAll(nodes => nodes.map(node=>node.id));
  expect(hierarchy).toEqual(["portfolioValue", "portfolioHistory", "portfolioReturn"]);
  await expect(page.locator("#gradedOwnedCount")).not.toBeVisible();
  await expect(page.locator("#sealedOwnedCount")).not.toBeVisible();
  await expect(page.locator("#dashboardMoneyDetails")).not.toHaveAttribute("open", "");
  await expect(page.locator("#dashboardBusinessPerformance")).not.toBeVisible();
  await expect(page.locator(".dashboard-owned-tools")).toBeVisible();
  if (testInfo.project.name !== "desktop-chromium") {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath(`collector-home-${width}.png`), fullPage: true, animations: "disabled" });
    }
  } else { await assertFits(page); await page.screenshot({path:testInfo.outputPath("collector-home-desktop.png"),fullPage:true,animations:"disabled"}); }
  await page.locator("#dashboardMoneyDetails > summary").click();
  await expect(page.locator(".dashboard-owned-tools")).toBeVisible();
  await page.locator("#dashboardHighestCards button").first().click();
  await expect(page.locator("#detailTitle")).toHaveText("Charizard");
  expect(await page.evaluate(async url => (await import(url)).state.items.reduce((sum,item)=>sum+item.quantity,0), appUrl)).toBe(4);
});

test("editing visible card facts never clears hidden legacy fields", async ({page}) => {
  await openDetail(page, {gradingCompany:"PSA", certificationNumber:"000123", notes:"Original", location:"Safe", collectionId:"folder-legacy", tags:["Favorites","Legacy"], customFields:{insured:true}, status:"listed", askingPrice:130, listingVenue:"eBay"});
  let patch;
  await page.route("https://mica-detail-test.supabase.co/rest/v1/collection_items**", async route => {
    if (route.request().method() === "PATCH") {
      patch = route.request().postDataJSON();
      await route.fulfill({status:204});
    } else await route.fulfill({contentType:"application/json",body:"[]"});
  });
  await page.evaluate(async url => {
    const {state,openPositionEditSheet}=await import(url);
    openPositionEditSheet(state.items[0]);
  }, appUrl);
  await expect(page.locator("#editLocation, #editCollectionFolder, #editTags, #editStatus")).toHaveCount(0);
  await page.locator("#editNotes").fill("Updated note");
  await page.locator("#positionEditForm [type=submit]").click();
  await expect.poll(() => patch).toEqual({notes:"Updated note",certification_number:"000123"});
});

test("inventory filters keep client fields and omit organization prompts", async ({ page }, testInfo) => {
  await openCollection(page);
  for (const selector of ["#view-collection .view-tabs", "#view-collection .ledger-tools", ".position-price-grid.compact span"]) {
    const styles = await page.locator(selector).first().evaluate(el => {const s=getComputedStyle(el);return {shadow:s.boxShadow,border:s.borderTopWidth,background:s.backgroundColor};});
    expect(styles).toEqual({shadow:"none",border:"0px",background:"rgba(0, 0, 0, 0)"});
  }
  await page.screenshot({path:testInfo.outputPath("inventory-viewport-fixture.png"),animations:"disabled"});
  await page.locator("#filterButton").click();
  await expect(page.locator("#sheetCollectionFolder, #sheetLocation, #sheetLabel")).toHaveCount(0);
  for (const id of ["sheetSet", "sheetLanguage", "sheetGrader", "sheetGrade", "sheetPerformance", "sheetMovement", "sheetCoverage", "sheetMinimumValue", "sheetMinimumProfitLoss", "sheetPurchaseDateFrom"]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await page.locator("#applySheet").click();
  await expect(page.locator(".ledger-row")).toHaveCount(2);
});

for (const entry of ["manual", "recognized slab"]) test(`${entry} intake preserves graded state and EUR acquisition through the save request`, async ({page},testInfo) => {
  const corrected = entry === "recognized slab" ? { grader: "BGS", grade: "9.5", certification: "001234" } : { grader: "PSA", grade: "10", certification: "000123" };
  await openCollection(page);
  let saved;
  await page.route("https://mica-detail-test.supabase.co/rest/v1/rpc/create_graded_copy_position", async route => {
    saved=route.request().postDataJSON();
    await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"synthetic retry test"})});
  });
  await page.evaluate(async ({ url, entry }) => {
    const { state, openPositionSheet, visionPrefill } = await import(url);
    const analysis = { identity: { cardState: "graded", grader: "PSA", grade: 10, certificationNumber: "000123" } };
    openPositionSheet(state.items[0], entry === "manual" ? {} : { prefill: visionPrefill(analysis, "identify"), visionAnalysis: { mode: "identify" } });
  }, { url: appUrl, entry });
  await expect(page.locator("#positionState")).toHaveValue("graded");
  await expect(page.locator("#positionQuantity")).toHaveValue("1");
  await expect(page.locator("#positionAcquisitionMethod")).not.toBeVisible();
  if (entry === "recognized slab") {
    await expect(page.locator("#positionGrader")).toHaveValue("PSA");
    await expect(page.locator("#positionGrade")).toHaveValue("10");
    await expect(page.locator("#positionCertification")).toHaveValue("000123");
  }
  await page.locator("#positionGrader").selectOption(corrected.grader);
  await page.locator("#positionGrade").fill(corrected.grade);
  await page.locator("#positionCertification").fill(corrected.certification);
  await expect(page.locator("#positionIdentitySummary")).toContainText(`Charizard 4/102 · ${corrected.grader} ${corrected.grade}`);
  await page.locator("#positionIdentitySummary").scrollIntoViewIfNeeded();
  await assertFits(page);
  expect(await page.locator("#positionForm .simple-note").first().evaluate(el => parseFloat(getComputedStyle(el).borderTopRightRadius))).toBeGreaterThanOrEqual(8);
  await page.screenshot({ path: testInfo.outputPath("confirmed-identity-top-fixture.png"),animations:"disabled" });
  await page.locator("#positionMoreSummary").click();
  await page.locator("#positionCurrency").selectOption("EUR");
  await page.locator("#positionTotalCost").fill("120.50");
  await page.locator("#positionDate").fill("2026-09-01");
  await page.locator("#positionNotes").fill(`${entry} purchase note`);
  await page.screenshot({path:testInfo.outputPath("slab-confirmation-fixture.png"),fullPage:true});
  await page.locator("#positionForm [type=submit].primary").click();
  await expect.poll(()=>saved?.p_currency).toBe("EUR");
  expect(saved.p_unit_price).toBe("120.50");
  expect(saved.p_certification_number).toBe(corrected.certification);
  expect(saved.p_grader).toBe(corrected.grader);
  expect(String(saved.p_grade)).toBe(corrected.grade);
  expect(saved.p_acquisition_method).toBe("unknown");
  expect(saved.p_notes).toBe(`${entry} purchase note`);
  await expect(page.locator("#positionNotes")).toHaveValue(`${entry} purchase note`);
  await expect(page.locator("#positionError")).toContainText("Your details are still here");
  await expect(page.locator("#positionCurrency")).toHaveValue("EUR");
});

test("pregrading keeps raw intake without turning estimates into slab labels", async ({ page }) => {
  await openCollection(page);
  await page.evaluate(async url => {
    const { state, openPositionSheet, visionPrefill } = await import(url);
    const analysis = { identity: { cardState: "graded", grader: "PSA", grade: 10, certificationNumber: "000123" }, quality: { usable: true }, condition: { rawCondition: "near_mint", confidence: 0.9, estimatedGradeLow: 8, estimatedGradeHigh: 9 } };
    openPositionSheet(state.items[0], { prefill: visionPrefill(analysis, "grade"), visionAnalysis: { mode: "grade", gradeRange: "8–9" } });
  }, appUrl);
  await expect(page.locator("#positionState")).toHaveValue("raw");
  await expect(page.locator("#positionCondition")).toHaveValue("near_mint");
  await expect(page.locator("#positionGrader")).toBeDisabled();
  await expect(page.locator("#positionCertification")).toHaveValue("");
  await expect(page.locator("#positionCertification")).toBeDisabled();
});

test("save feedback claims a digital grade only after its report is attached", async ({ page }) => {
  await openCollection(page);
  let attached = 0;
  await page.route("https://mica-detail-test.supabase.co/rest/v1/rpc/**", async route => {
    if (route.request().url().endsWith("/confirm_mica_grading_report")) attached++;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify("44444444-4444-4444-8444-444444444444") });
  });
  for (const kind of ["identified slab", "unattached pregrade", "attached pregrade"]) {
    await page.evaluate(async ({ url, kind }) => {
      const { state, saveCardAddDraft } = await import(url);
      document.querySelector("#toastRegion").replaceChildren();
      const graded = kind === "identified slab";
      await saveCardAddDraft({ card: state.items[0], input: { cardState: graded ? "graded" : "raw", grader: graded ? "PSA" : null, grade: graded ? 10 : null, rawCondition: "near_mint", quantity: 1, unitPrice: "100", transactionDate: "2026-09-01", currency: "USD" }, idempotencyKey: crypto.randomUUID() }, { mode: graded ? "identify" : "grade", estimatedGradeLow: 8, scanSessionId: kind === "attached pregrade" ? "55555555-5555-4555-8555-555555555555" : null }, { closeAfterSave: false, refreshAfterSave: false });
    }, { url: appUrl, kind });
    if (kind === "attached pregrade") await expect(page.locator("#toastRegion")).toContainText("Card and digital grade saved");
    else {
      await expect(page.locator("#toastRegion")).toContainText("Added to your collection");
      await expect(page.locator("#toastRegion")).not.toContainText("digital grade saved");
    }
  }
  expect(attached).toBe(1);
});

for (const scenario of ["success", "metadata failure", "missing photo", "owner mismatch"]) test(`scan photo attaches to the saved copy safely: ${scenario}`, async ({ page }) => {
  await openCollection(page);
  const itemId = "44444444-4444-4444-8444-444444444444";
  let creates = 0, uploads = [], metadata = [];
  await page.route("https://mica-detail-test.supabase.co/rest/v1/rpc/create_graded_copy_position", async route => {
    creates++;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(itemId) });
  });
  await page.route("https://mica-detail-test.supabase.co/storage/v1/object/**", async route => {
    uploads.push({ url: route.request().url(), upsert: route.request().headers()["x-upsert"] });
    await route.fulfill({ status: uploads.length > 1 ? 409 : 200, contentType: "application/json", body: JSON.stringify(uploads.length > 1 ? { statusCode: "409", error: "Duplicate", message: "The resource already exists" } : { Key: "fixture" }) });
  });
  await page.route("https://mica-detail-test.supabase.co/rest/v1/collection_item_attachments**", async route => {
    metadata.push(route.request().postDataJSON());
    const fails = scenario === "metadata failure" && metadata.length === 1;
    await route.fulfill({ status: fails ? 503 : 200, contentType: "application/json", body: JSON.stringify(fails ? { message: "fixture retry", code: "503" } : { id: "photo-fixture" }) });
  });
  const result = await page.evaluate(async ({ url, scenario }) => {
    const { state, testSupabase, saveCardAddDraft } = await import(url);
    testSupabase.auth.getUser = async () => ({ data: { user: { id: scenario === "owner mismatch" ? "another-owner" : state.session.user.id } }, error: null });
    globalThis.photoCompleted = 0;
    const canvas = document.createElement("canvas"); canvas.width = 4; canvas.height = 4;
    const photoDataUrl = scenario === "missing photo" ? null : canvas.toDataURL("image/jpeg");
    return await saveCardAddDraft({ card: state.items[0], input: { cardState: "graded", grader: "PSA", grade: 10, quantity: 1, currency: "USD" }, idempotencyKey: crypto.randomUUID(), photoRequired: true, photoDataUrl, afterSave: () => { globalThis.photoCompleted++; } }, null, { refreshAfterSave: false });
  }, { url: appUrl, scenario });
  expect(creates).toBe(1);
  if (scenario === "success") {
    expect(result.photoPending).toBe(false);
    expect(await page.evaluate(() => globalThis.photoCompleted)).toBe(1);
  } else {
    expect(result.photoPending).toBe(true);
    await expect(page.locator("#sheetTitle")).toHaveText("Card saved");
    expect(await page.evaluate(() => globalThis.photoCompleted)).toBe(0);
    if (scenario === "owner mismatch") {
      expect(uploads).toHaveLength(0);
      await page.evaluate(url => import(url).then(({ state }) => { state.session = { user: { id: "another-owner" } }; }), appUrl);
      await page.locator("#retryScanPhoto").click();
      expect(uploads).toHaveLength(0); expect(metadata).toHaveLength(0); return;
    }
    if (scenario === "missing photo") await page.locator("#scanPhotoRetryFile").setInputFiles({ name: "original.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255,216,255,217]) });
    await page.locator("#retryScanPhoto").click();
    await expect(page.locator("#toastRegion")).toContainText("Card and photo saved");
    expect(await page.evaluate(() => globalThis.photoCompleted)).toBe(1);
    expect(creates).toBe(1);
  }
  expect(uploads.length).toBe(scenario === "metadata failure" ? 2 : 1);
  if (uploads.length === 2) expect(uploads[1].url).toBe(uploads[0].url);
  for (const upload of uploads) { expect(upload.url).toMatch(new RegExp(`/collection-item-files/collection-owner/${itemId}/[a-f0-9]{64}\\.jpg$`)); expect(upload.upsert).toBe("false"); }
  const record = metadata.at(-1);
  expect(record.user_id).toBe("collection-owner"); expect(record.collection_item_id).toBe(itemId);
  expect(record.kind).toBe("photo"); expect(record.caption).toContain("user confirmed");
});

test("graded detail shows recorded sold-derived chart without using a provider index", async ({page},testInfo)=>{
  const point=(days,amount,extra={})=>({recordedAt:new Date(Date.now()-days*86400000).toISOString(),amount,currency:"USD",provider:"pkmnprices completed sales",contributingEvidenceIds:["fixture-sale-a","fixture-sale-b","fixture-sale-c"],contextValidated:true,...extra});
  await openDetail(page,{cardState:"graded",gradingCompany:"PSA",grade:"10",certificationNumber:"000123",gradedValuations:[point(2,100),point(1,110),point(1,999,{contextValidated:false}),point(1,888,{currency:"EUR"})],priceHistory:[{recordedAt:new Date().toISOString(),amount:777,finish:"holofoil",currency:"USD",gradingCompany:"PSA",grade:"10"}]});
  await expect(page.locator("#positionChart")).toBeVisible();
  await expect(page.locator("#detailValuationGrade")).not.toBeVisible();
  await page.locator('[data-detail-tool="valuation-context"] > summary').click();
  await expect(page.locator("#detailValuationGrade")).toBeVisible();
  await expect(page.locator("#detailValuationGrade")).toHaveValue("10");
  await page.locator('[data-detail-tool="valuation-context"] > summary').click();
  await expect(page.locator("#cardPriceHistory")).not.toContainText("could not be loaded");
  expect(await page.locator("#cardPriceHistory").evaluate((el) => Boolean(el.compareDocumentPosition(document.querySelector(".exact-sold-value")) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(page.getByRole("button",{name:"6 months",exact:true})).toBeVisible();
  await expect(page.locator(".market-hero")).not.toBeVisible();
  await page.locator(".history-values > summary").click();
  await expect(page.locator(".history-values tbody tr")).toHaveCount(2);
  await expect(page.locator(".history-values")).toContainText("$100.00");
  await expect(page.locator(".history-values")).not.toContainText("$777.00");
  await page.screenshot({path:testInfo.outputPath("graded-detail-fixture.png"),fullPage:true});
});

test("secondary insights use native sealed values and exact-sold graded evidence", async ({ page }, testInfo) => {
  await openCollection(page);
  await page.evaluate(() => {
    const { state, renderInsights, routeTo } = globalThis.fixtureApp;
    const base = state.items[0];
    state.items = [
      { ...base, name: "Graded raw fallback forbidden", cardState: "graded", gradingCompany: "PSA", grade: "10", quantity: 1, price: 999, pricingStatus: "live", costBasis: 10, gradedValuations: [], priceHistory: [
        { provider: "ebay", amount: 100, currency: "USD", gradingCompany: "PSA", grade: "10", finish: "holofoil", recordedAt: "2026-08-01T00:00:00.000Z" },
        { provider: "ebay", amount: 999, currency: "USD", gradingCompany: "PSA", grade: "10", finish: "holofoil", recordedAt: "2026-09-15T00:00:00.000Z" },
      ] },
      { ...base, name: "Native EUR sealed", cardState: "sealed", quantity: 2, price: 50, currency: "EUR", pricingStatus: "live", costBasis: 60 },
      { ...base, name: "Valid exact sold slab", cardState: "graded", gradingCompany: "PSA", grade: "10", quantity: 1, price: 777, currency: "USD", pricingStatus: "live", costBasis: 100, gradedValuations: [{ amount: 100, currency: "USD", recordedAt: "2026-08-01T00:00:00.000Z", verifiedExactSold: true, contextValidated: true }, { amount: 120, currency: "USD", recordedAt: "2026-10-01T00:00:00.000Z", verifiedExactSold: true, contextValidated: true, currentUntil: Date.now()+86400000, current: { estimate: 120, currency: "USD", status: "ready", contextValidated: true } }] },
      { ...base, name: "Sold copy excluded", status: "sold", quantity: 0, price: 1000, pricingStatus: "live", transactions: [{ type: "sale", quantity: 1, currency: "EUR", netProceeds: 25 }] },
    ];
    state.pricingStatus = "live";
    renderInsights(); routeTo("profile", { focus: false });
  });
  await expect(page.locator("#positionRankings")).not.toBeVisible();
  await page.locator("#collectionInsights > summary").click();
  await expect(page.locator("#positionRankings")).toBeVisible();
  await expect(page.locator("#positionRankings .mover")).toHaveCount(3);
  await expect(page.locator("#positionRankings .mover").filter({ hasText: "Native EUR sealed" })).toContainText("€100.00");
  await expect(page.locator("#positionRankings .mover").filter({ hasText: "Native EUR sealed" })).toContainText("up €40.00 (+66.7%)");
  await expect(page.locator("#positionRankings .mover").filter({ hasText: "Graded raw fallback forbidden" })).toContainText("Unavailable");
  await expect(page.locator("#positionRankings .mover").filter({ hasText: "Valid exact sold slab" })).toContainText("$120.00");
  await expect(page.locator("#positionRankings")).not.toContainText("$999.00");
  await expect(page.locator("#positionRankings")).not.toContainText("$777.00");
  await expect(page.locator("#moversList")).not.toContainText("Graded raw fallback forbidden");
  await expect(page.locator("#moversList")).toContainText("Valid exact sold slab");
  await expect(page.locator("#moversList")).toContainText("$100.00 to $120.00");
  await expect(page.locator("#moversList")).not.toContainText("$777.00");
  await expect(page.locator("#recentActivity")).toContainText("Date not recorded");
  await expect(page.locator("#collectionInsights")).not.toContainText("Quick-sale");
  await assertFits(page);
  await page.screenshot({ path: testInfo.outputPath("secondary-insights-synthetic.png"), fullPage: false });
});

test("owner dashboard defaults to an all-time dominant graph and independent P/L timeframe", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openCollection(page);
  await page.evaluate(() => {
    const { state, renderCollection, routeTo } = globalThis.fixtureApp;
    const base = state.items[0];
    state.portfolioHistoryMode = "value";
    state.items = [{ ...base, currency: "USD", quantity: 1, costBasis: 100, cost: 100, pricingStatus: "live", price: 130, cardState: "raw", gradingCompany: null, variant: "Holofoil", condition: "Near Mint", lots: [{ acquiredAt: "2026-01-01", quantityAcquired: 1, quantityRemaining: 1, totalCost: 100, currency: "USD", costBasisKnown: true, acquisitionDateKnown: true }], transactions: [], priceHistory: [1,2,3].map((day,index) => ({ recordedAt: new Date(Date.now()-day*86400000).toISOString(), amount: 130-index*10, currency: "USD", finish: "holofoil", condition: "Near Mint", provider: "synthetic" })) }];
    renderCollection(); routeTo("dashboard", { focus: false });
  });
  await expect(page.locator("#portfolioChartRange")).toHaveValue("all");
  await expect(page.locator("#portfolioPnlRange")).toHaveValue("all");
  await expect(page.locator("#portfolioHistoryChart")).toBeVisible();
  for (const selector of ["#portfolioChartRange", "#portfolioPnlRange"])
    expect(await page.locator(selector).evaluate(element => getComputedStyle(element).borderTopLeftRadius)).toBe("10px");
  await expect.poll(() => page.evaluate(() => globalThis.fixtureApp.portfolioChartInstance?.$traceProgress ?? 0)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => globalThis.fixtureApp.portfolioChartInstance?.$traceProgress)).toBe(1);
  expect(await page.evaluate(() => globalThis.fixtureApp.portfolioChartInstance.data.datasets.every(dataset => !dataset.borderDash?.length))).toBe(true);
  await expect(page.locator("#portfolioReturn")).toHaveAttribute("data-pnl-sign", "positive");
  await expect(page.locator(".dashboard-owned-tools")).toBeVisible();
  await expect.poll(() => page.evaluate(() => globalThis.fixtureApp.portfolioChartInstance?.scales.x.type)).toBe("linear");
  expect(await page.evaluate(() => globalThis.fixtureApp.portfolioChartInstance.data.datasets.every(dataset => dataset.pointRadius === 0))).toBe(true);
  const tooltip = await page.evaluate(() => {
    const tooltip = globalThis.fixtureApp.portfolioChartInstance.options.plugins.tooltip;
    return { value: tooltip.callbacks.title([{ parsed: { y: 130 } }]), date: tooltip.callbacks.label({ dataIndex: 0 }), color: tooltip.titleColor, size: tooltip.titleFont.size };
  });
  expect(tooltip.value).toBe("$130.00");
  expect(tooltip.date).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  expect(tooltip.color).toBe("#276443");
  expect(tooltip.size).toBe(24);
  expect(await page.evaluate(() => {
    const labels = globalThis.fixtureApp.portfolioChartInstance.scales.x.ticks.map(tick => tick.label);
    return new Set(labels).size === labels.length;
  })).toBe(true);
  const spacing = await page.evaluate(() => {
    const chart = globalThis.fixtureApp.portfolioChartInstance;
    const dates = chart.data.labels;
    const x = chart.scales.x;
    const midpoint = x.min + (x.max - x.min) * 0.75;
    return {
      recordedGapRatio: (dates[1] - dates[0]) / (dates[2] - dates[1]),
      visibleRatio: (x.getPixelForValue(midpoint) - x.getPixelForValue(x.min)) / (x.getPixelForValue(x.max) - x.getPixelForValue(midpoint)),
    };
  });
  expect(spacing.recordedGapRatio).toBeGreaterThan(200);
  expect(spacing.visibleRatio).toBeCloseTo(3, 5);
  expect(await page.evaluate(() => {
    const chart = globalThis.fixtureApp.portfolioChartInstance;
    const observed = chart.data.labels.filter((date, index) => chart.data.datasets.some(dataset => dataset.data[index] != null));
    return [chart.scales.x.min === observed[0], chart.scales.x.max === observed.at(-1), chart.data.datasets[0].data[0] === null];
  })).toEqual([true, true, true]);
  expect(await page.locator(".portfolio-chart-shell").evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(300);
  await page.locator(".portfolio-pnl-picker > summary").click();
  await page.locator("#portfolioPnlRange").selectOption("1m");
  await expect(page.locator("#portfolioReturn")).toHaveText("+20.0%");
  await expect(page.locator("#portfolioChartRange")).toHaveValue("all");
  await page.locator("#portfolioChartRange").selectOption("ytd");
  await expect(page.locator("#portfolioPnlRange")).toHaveValue("1m");
  await page.locator("#portfolioChartRange").selectOption("all");
  await page.locator("#portfolioPnlRange").selectOption("all");
  await page.locator(".portfolio-pnl-picker > summary").click();
  await assertFits(page);
  await expect.poll(() => page.evaluate(() => globalThis.fixtureApp.portfolioChartInstance?.$traceProgress)).toBe(1);
  await page.screenshot({ path: testInfo.outputPath("owner-graph-dashboard-fixture.png"), fullPage: true, animations: "disabled" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.locator("#portfolioHistoryChart").evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  await page.evaluate(() => {
    const { state, renderCollection } = globalThis.fixtureApp;
    state.items.push({ ...state.items[0], uid: "synthetic-sold-copy", quantity: 0, lots: [], transactions: [{ type: "sale", date: "2026-09-01", currency: "USD", netProceeds: 120, allocatedCost: 100 }] });
    renderCollection();
  });
  await expect(page.locator("#portfolioReturn")).toHaveText("+25.0%");
  await expect(page.locator("#portfolioPnlNote")).toContainText("$50.00");
});

for (const outcome of ["success", "failure", "quota"]) test(`selected-card pricing avoids unrelated requests and changes: ${outcome}`, async ({ page }) => {
  await openCollection(page);
  await page.evaluate(async url => {
    const { state } = await import(url);
    state.items[0].price = 100; state.items[0].pricingStatus = "live";
    state.items[1].id = "base1-2"; state.items[1].price = 55; state.items[1].pricingStatus = "live";
  }, appUrl);
  const calls = [];
  await page.route("**/api/cards?**", async route => {
    calls.push(JSON.parse(new URL(route.request().url()).searchParams.get("lookups")));
    await route.fulfill({ status: outcome === "failure" ? 503 : outcome === "quota" ? 429 : 200, contentType: "application/json", body: JSON.stringify({ cards: [] }) });
  });
  const before = await page.evaluate(async url => (await import(url)).state.items[1], appUrl);
  await page.evaluate(async url => { const { state, refreshLivePricing } = await import(url); await refreshLivePricing([state.items[0].uid]); }, appUrl);
  expect(calls).toHaveLength(1); expect(calls[0]).toHaveLength(1);
  expect(calls[0][0].clientId).toBe("base1-4");
  const after = await page.evaluate(async url => (await import(url)).state.items[1], appUrl);
  expect(after).toEqual(before);
  if (outcome === "success") {
    calls.length = 0;
    await page.evaluate(async url => (await import(url)).refreshLivePricing(), appUrl);
    expect(calls.flat().map(card => card.clientId).sort()).toEqual(["base1-2", "base1-4"]);
  }
});

for (const scenario of ["same owner", "changed owner", "changed owner failure"]) test(`private attachment response stays with its account: ${scenario}`, async ({ page }) => {
  await openCollection(page);
  let pending;
  await page.route("https://mica-detail-test.supabase.co/rest/v1/collection_item_attachments**", route => { pending = route; });
  await page.evaluate(async url => { const { state, loadOwnedCollectionAttachments } = await import(url); globalThis.pendingPrivateAttachments = loadOwnedCollectionAttachments(state.items[0]); }, appUrl);
  await expect.poll(() => Boolean(pending)).toBe(true);
  if (scenario !== "same owner") await page.evaluate(async url => { const { state } = await import(url); state.session = { user: { id: "another-owner" } }; state.organization.attachments = new Map(); }, appUrl);
  await pending.fulfill({ status: scenario.endsWith("failure") ? 403 : 200, contentType: "application/json", body: JSON.stringify(scenario.endsWith("failure") ? { message: "fixture failure" } : [{ id: "private-photo", filename: "old-owner-fixture.jpg" }]) });
  await page.evaluate(() => globalThis.pendingPrivateAttachments);
  const result = await page.evaluate(async url => { const { state } = await import(url); return [...state.organization.attachments.values()]; }, appUrl);
  if (scenario === "same owner") expect(result[0].items[0].filename).toBe("old-owner-fixture.jpg");
  else expect(result).toEqual([]);
});

for (const scenario of ["same owner", "changed owner"]) test(`signed private photo opens only for the requesting account: ${scenario}`, async ({ page }) => {
  await openDetail(page);
  await page.evaluate(async url => {
    const { state, renderDetail } = await import(url); state.session = { user: { id: "collection-owner" } };
    state.organization.attachments.set(state.items[0].uid, { status: "ready", items: [{ id: "photo", filename: "original-front.jpg", kind: "photo", byte_size: 10, created_at: "2026-09-01", storage_path: "collection-owner/copy/fixture.jpg" }] });
    globalThis.openedPrivatePhotos = []; window.open = (...args) => { openedPrivatePhotos.push(args); return null; }; renderDetail();
  }, appUrl);
  let pending;
  await page.route("https://mica-detail-test.supabase.co/storage/v1/object/sign/**", route => { pending = route; });
  await openSecondaryTools(page);
  await page.locator('[data-detail-tool="attachments"] > summary').click();
  await page.locator('[data-open-collection-attachment="photo"]').click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  if (scenario === "changed owner") await page.evaluate(async url => { const { state } = await import(url); state.session = { user: { id: "another-owner" } }; }, appUrl);
  await pending.fulfill({ contentType: "application/json", body: JSON.stringify({ signedURL: "/object/sign/collection-item-files/collection-owner/copy/fixture.jpg?token=synthetic-only" }) });
  if (scenario === "same owner") {
    await expect.poll(() => page.evaluate(() => openedPrivatePhotos.length)).toBe(1);
    const opened = await page.evaluate(() => openedPrivatePhotos[0]); expect(opened[0]).toContain("/collection-item-files/collection-owner/copy/fixture.jpg"); expect(opened[2]).toBe("noopener,noreferrer");
  } else {
    await expect(page.locator('[data-open-collection-attachment="photo"]')).toBeEnabled();
    expect(await page.evaluate(() => openedPrivatePhotos)).toEqual([]);
  }
});

for (const scenario of ["same owner", "changed owner", "changed owner failure"]) test(`manual private upload callback stays with its account: ${scenario}`, async ({ page }) => {
  await openDetail(page);
  await page.evaluate(async url => {
    const { state, testSupabase, renderDetail } = await import(url); state.session = { user: { id: "collection-owner" } };
    testSupabase.auth.getUser = async () => ({ data: { user: { id: "collection-owner" } }, error: null });
    renderDetail(); document.querySelector("#toastRegion").replaceChildren();
  }, appUrl);
  await page.route("https://mica-detail-test.supabase.co/storage/v1/object/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ Key: "private-fixture" }) }));
  let pending;
  await page.route("https://mica-detail-test.supabase.co/rest/v1/collection_item_attachments**", route => {
    if (route.request().method() === "POST") pending = route;
    else return route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await openSecondaryTools(page);
  await page.locator('[data-detail-tool="attachments"] > summary').click();
  await page.locator("#collectionAttachmentInput").setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255,216,255,217]) });
  await expect.poll(() => Boolean(pending)).toBe(true);
  if (scenario !== "same owner") await page.evaluate(async url => { const { state } = await import(url); state.session = { user: { id: "another-owner" } }; state.organization.attachments = new Map(); document.querySelector("#collectionAttachmentError").textContent = "New account message"; }, appUrl);
  await pending.fulfill({ status: scenario.endsWith("failure") ? 403 : 200, contentType: "application/json", body: JSON.stringify(scenario.endsWith("failure") ? { message: "ownership denied" } : { id: "photo-fixture" }) });
  if (scenario === "same owner") await expect(page.locator("#toastRegion")).toContainText("Private file attached");
  else {
    await expect(page.locator("#collectionAttachmentInput")).toBeEnabled();
    expect(await page.evaluate(async url => [...(await import(url)).state.organization.attachments.values()], appUrl)).toEqual([]);
    await expect(page.locator("#collectionAttachmentError")).toHaveText("New account message");
    await expect(page.locator("#toastRegion")).not.toContainText("Private file attached");
  }
});

test("private deletion cannot continue or show success under a switched account", async ({ page }) => {
  await openDetail(page);
  await page.evaluate(async url => {
    const { state, testSupabase, renderDetail } = await import(url);
    state.session = { user: { id: "collection-owner" } };
    globalThis.deleteOwnerChecks = 0;
    testSupabase.auth.getUser = async () => { deleteOwnerChecks++; return { data: { user: { id: state.session.user.id } }, error: null }; };
    state.organization.attachments.set(state.items[0].uid, { status: "ready", items: [{ id: "photo", filename: "original.jpg", kind: "photo", byte_size: 10, created_at: "2026-09-01", storage_path: "collection-owner/copy/photo.jpg" }] });
    renderDetail(); document.querySelector("#toastRegion").replaceChildren();
  }, appUrl);
  let pending, removals = 0;
  await page.route("https://mica-detail-test.supabase.co/rest/v1/collection_item_attachments**", route => { pending = route; });
  await page.route("https://mica-detail-test.supabase.co/storage/v1/object/**", route => { removals++; return route.fulfill({ contentType: "application/json", body: "[]" }); });
  await openSecondaryTools(page);
  await page.locator('[data-detail-tool="attachments"] > summary').click();
  await page.locator('[data-delete-collection-attachment="photo"]').click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  expect(pending.request().method()).toBe("DELETE");
  await page.evaluate(async url => { const { state } = await import(url); state.session = { user: { id: "another-owner" } }; state.organization.attachments = new Map(); }, appUrl);
  await pending.fulfill({ status: 204, body: "" });
  await expect.poll(() => page.evaluate(() => deleteOwnerChecks)).toBe(2);
  expect(removals).toBe(0);
  expect(await page.evaluate(async url => [...(await import(url)).state.organization.attachments.values()], appUrl)).toEqual([]);
  await expect(page.locator("#toastRegion")).not.toContainText("Private file deleted");
});

 test("inventory keeps unavailable freshness once and distinct purchase performance", async ({page},testInfo)=>{
  await openCollection(page);
  for(const status of ["stale","unsupported","rate_limited","provider_error"]) {
    await page.evaluate(async({url,status})=>{const {state,renderCollection}=await import(url);state.items.forEach(item=>{item.pricingStatus=status;item.price=null;});renderCollection();},{url:appUrl,status});
    const row=page.locator(".ledger-row").first();
    await expect(row.locator(".price-provenance")).not.toBeEmpty();
    await expect(row.locator(".row-move")).toHaveCount(0);
    await expect(row.locator(".position-price-grid strong").first()).toHaveText("—");
    if(status==="stale") {expect((await row.innerText()).match(/Stale · observed/g)).toHaveLength(1);await page.screenshot({path:testInfo.outputPath("inventory-single-freshness-fixture.png"),animations:"disabled"});}
  }
  await page.evaluate(async url=>{const {state,renderCollection}=await import(url);Object.assign(state.items[0],{price:100,pricingStatus:"live",pricingUpdatedAt:new Date().toISOString(),costBasis:60,marketPriceAtPurchase:60});renderCollection();},appUrl);
  const live=page.locator(".ledger-row").filter({hasText:"Charizard"});
  await expect(live.locator(".price-provenance")).toContainText("Updated");
  await expect(live.locator(".row-move")).toContainText("since purchase");
 });

test("dialog keyboard loop includes native disclosures and excludes their closed inputs",async({page})=>{
  await openCollection(page);
  await page.evaluate(async url=>{const {openSheet}=await import(url);openSheet(`<h2 id="sheetTitle">Fixture preferences</h2><details><summary id="fixtureSummary">Optional details</summary><label>Note<input id="fixtureNote"></label></details><button type="button">Done</button><label id="fixtureLast" role="button" tabindex="0">Photo library</label><button disabled tabindex="0">Unavailable</button><button tabindex="-1">Programmatic only</button><div inert><button>Inactive</button></div>`);},appUrl);
  await page.locator("#fixtureLast").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#fixtureSummary")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#fixtureLast")).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.locator("#fixtureNote")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#bottomSheet")).toBeHidden();
  expect(await page.locator("#appShell").evaluate(el=>el.inert)).toBe(false);
});

test("missing saved printing requires explicit choices and preserves the copy through audited correction", async ({page}) => {
  await openDetail(page,{finish:"unknown",edition:"unknown",promoType:"unknown",identityStatus:"needs_review",cardState:"graded",gradingCompany:"PSA",grade:"9",gradeQualifier:null,notes:"Keep original"});
  await page.evaluate(() => { globalThis.fixtureApp.state.session={access_token:"fixture-session",user:{id:"confirmation-owner"}}; });
  let correction;
  await page.route("https://mica-detail-test.supabase.co/rest/v1/rpc/remap_collection_position",async route => { correction=route.request().postDataJSON(); await route.fulfill({contentType:"application/json",body:JSON.stringify("fixture-correction")}); });
  await page.locator(".identity-details > summary").click();
  await page.locator("#confirmPrintingButton").click();
  await expect(page.locator("#printingFinish")).toHaveValue("");
  await expect(page.locator("#printingEdition")).toHaveValue("");
  await expect(page.locator("#printingPromo")).toHaveValue("");
  await page.locator('#confirmPrintingForm [type=submit]').click();
  expect(correction).toBeUndefined();
  await page.locator("#printingFinish").selectOption("holofoil");
  await page.locator("#printingEdition").selectOption("unlimited");
  await page.locator("#printingPromo").selectOption("none");
  await page.locator("#printingQualifier").selectOption("none");
  await page.locator('#confirmPrintingForm [type=submit]').click();
  await expect.poll(()=>correction?.p_identity?.identityStatus).toBe("exact");
  expect(correction.p_collection_item_id).toBe("11111111-1111-4111-8111-111111111111");
  expect(correction.p_identity).toMatchObject({name:"Charizard",set:"Base Set",number:"4/102",variant:"Holofoil",finish:"holofoil",edition:"unlimited",promoType:"none",gradeQualifier:"",variantId:null,collectibleId:null});
  expect(correction.p_card_id).toBeNull(); expect(correction.p_variant_id).toBeNull();
  expect(correction.p_identity.variantMetadata.identityEvidence).toBe("owner_confirmed_printing");
  expect(correction.p_identity).not.toHaveProperty("quantity"); expect(correction.p_identity).not.toHaveProperty("notes");
});

test('primary detail hides extra evidence tools and retains them through an explicit secondary entry', async ({page},testInfo) => {
  await openDetail(page);
  for (const tool of ['prices','grading-comparison','attachments']) await expect(page.locator(`[data-detail-tool="${tool}"]`)).toBeHidden();
  await expect(page.locator('[data-detail-tool="grading"]')).toBeVisible();
  expect(await page.locator('#detailTitle').evaluate(node=>getComputedStyle(node).fontFamily)).toContain('Avenir');
  await page.screenshot({path:testInfo.outputPath('compact-detail-fixture.png')});
  await openSecondaryTools(page);
  for (const tool of ['prices','grading-comparison','attachments']) await expect(page.locator(`[data-detail-tool="${tool}"]`)).toBeVisible();
  await assertFits(page);
});

test('thirteen saved raw entries refresh in seven bounded requests and feed real position totals', async ({page}) => {
  await openCollection(page); let requests=0;
  await page.route('**/api/cards?**', async route => {
    requests++; const lookups=JSON.parse(new URL(route.request().url()).searchParams.get('lookups'));
    expect(lookups.length).toBeLessThanOrEqual(2);
    await route.fulfill({contentType:'application/json',body:JSON.stringify({cards:lookups.map(lookup=>({providerCardId:lookup.clientId,externalIds:{pkmnprices:100},quotes:[{provider:'tcgplayer',currency:'USD',finish:'holofoil',condition:'Near Mint',priceType:'market',amount:100,observedAt:new Date().toISOString(),retrievedAt:new Date().toISOString()}],capabilities:{raw:'live'},history:[]}))})});
  });
  const result=await page.evaluate(async url=>{
    const {state,refreshLivePricing,hydratePosition}=await import(url);
    state.items=Array.from({length:13},(_,i)=>hydratePosition({id:`synthetic-copy-${i}`,card_state:'raw',raw_condition:'near_mint',currency:'USD',quantity:1,status:'owned',identity_snapshot:{id:`synthetic-card-${i}`,name:'Mew ex',set:'151',number:'151/165',variant:'Holofoil',language:'en'}}));
    await refreshLivePricing();return state.items.map(item=>({price:item.price,finish:item.finish,edition:item.edition}));
  },appUrl);
  expect(requests).toBe(7); expect(result).toHaveLength(13);
  for(const item of result) {expect(item.price).toBe(100);expect(item.finish).toBe('holofoil');expect(item.edition).toBe('unknown');}
  expect(await page.locator('.ledger-row').count()).toBe(13);
});


test("first collection prices render while later batches wait and graded copies skip raw requests", async ({ page }, testInfo) => {
  await openCollection(page);
  let pending; const lookups = [];
  const payload = batch => ({ cards: batch.map(lookup => ({ providerCardId: lookup.clientId, quotes: [{provider:"tcgplayer",currency:"USD",finish:"holofoil",condition:"Near Mint",priceType:"market",amount:100,observedAt:new Date().toISOString(),retrievedAt:new Date().toISOString()}],capabilities:{raw:"live"},historyStatus:"not_requested",history:[] })) });
  await page.route("**/api/cards?**", async route => {
    const batch = JSON.parse(new URL(route.request().url()).searchParams.get("lookups")); lookups.push(batch);
    if (lookups.length === 2) { pending = route; return; }
    await route.fulfill({contentType:"application/json",body:JSON.stringify(payload(batch))});
  });
  await page.evaluate(async url => {
    const {state, refreshLivePricing, hydratePosition} = await import(url);
    state.items = Array.from({length:9}, (_, i) => hydratePosition({id:"batch-copy-"+i,card_state:i<4?"raw":"graded",grader:i<4?null:"PSA",grade:i<4?null:"10",raw_condition:"near_mint",currency:"USD",quantity:1,status:"owned",identity_snapshot:{id:"batch-card-"+i,name:"Mew ex",set:"151",number:"151/165",variant:"Holofoil",language:"en"}}));
    globalThis.batchRefresh = refreshLivePricing();
  }, appUrl);
  await expect.poll(() => Boolean(pending)).toBe(true);
  const prices = await page.evaluate(async url => (await import(url)).state.items.map(item => item.price), appUrl);
  expect(prices.slice(0,2)).toEqual([100,100]); expect(prices.slice(2)).toEqual(Array(7).fill(null));
  await expect(page.locator(".ledger-row").first().locator(".position-price-grid")).toContainText("$100.00");
  expect(await page.locator("#view-collection .quick-add:visible").evaluate(element => getComputedStyle(element).backgroundColor)).toBe("rgb(39, 100, 67)");
  await page.screenshot({path:testInfo.outputPath("progressive-green-collection.png"),fullPage:false});
  const batch = lookups[1]; await pending.fulfill({contentType:"application/json",body:JSON.stringify(payload(batch))});
  await page.evaluate(() => batchRefresh);
  expect(lookups.flat().map(item => item.clientId)).toEqual(["batch-card-0","batch-card-1","batch-card-2","batch-card-3"]);
  const final = await page.evaluate(async url => (await import(url)).state.items, appUrl);
  expect(final.slice(0,4).map(item=>item.price)).toEqual([100,100,100,100]);
  expect(final.slice(4).every(item=>item.pricingReason==="printing_confirmation_required")).toBe(true);
});

test("recent owned history is reused only for its owner and matching context", async ({ page }) => {
  await openCollection(page); let calls = 0;
  await page.evaluate(async url => {const {state}=await import(url);Object.assign(state.items[0],{finish:"holofoil",condition:"Near Mint",rawCondition:"near_mint"});},appUrl);
  await page.route("**/api/cards?**", async route => {
    calls++; const lookup=JSON.parse(new URL(route.request().url()).searchParams.get("lookups"))[0];
    await route.fulfill({contentType:"application/json",body:JSON.stringify({cards:[{providerCardId:lookup.clientId,quotes:[{provider:"tcgplayer",currency:"USD",finish:"holofoil",condition:"Near Mint",priceType:"market",amount:100,observedAt:new Date().toISOString(),retrievedAt:new Date().toISOString()}],capabilities:{raw:"live"},historyStatus:"live",history:[1,2].map(day=>({recordedAt:new Date(Date.now()-day*86400000).toISOString(),amount:100-day,currency:"USD",finish:"holofoil",condition:"Near Mint",provider:"tcgplayer"}))}]})});
  });
  const reopen=async()=>page.evaluate(()=>{const {state,openCardDetail}=globalThis.fixtureApp;openCardDetail(state.items[0],true);});
  await reopen(); await expect.poll(()=>calls).toBe(1); await expect(page.locator(".history-summary")).toContainText("Days with prices");
  await reopen(); await expect(page.locator("#positionChart")).toBeVisible(); expect(calls).toBe(1);
  await page.evaluate(async url=>{const {state}=await import(url);state.items[0].condition="Lightly Played";},appUrl);
  await reopen(); await expect.poll(()=>calls).toBe(2);
  await page.evaluate(async url=>{const {state}=await import(url);state.items[0].condition="Near Mint";state.items[0].historyLoadedAt=Date.now()-16*60000;},appUrl);
  await reopen(); await expect.poll(()=>calls).toBe(3);
  await expect.poll(()=>page.evaluate(()=>Date.now()-globalThis.fixtureApp.state.items[0].historyLoadedAt)).toBeLessThan(10000);
  await page.evaluate(async url=>{const {state}=await import(url);state.session={user:{id:"different-owner"}};},appUrl);
  await reopen(); await expect.poll(()=>calls).toBe(4);
});

test("additional purchase Free (trade) records known zero and can be unchecked", async ({ page }) => {
  await openCollection(page);
  await page.evaluate(async url => {
    const { state, openPurchaseLotSheet } = await import(url);
    openPurchaseLotSheet(state.items[0]);
  }, appUrl);
  await expect(page.getByLabel("Free (trade)")).toBeVisible();
  await page.locator("#lotTotalCost").fill("12.50");
  await page.getByLabel("Free (trade)").check();
  await expect(page.locator("#lotTotalCost")).toHaveValue("0.00");
  await expect(page.locator("#lotCostUnknown")).not.toBeChecked();
  await expect(page.locator("#purchaseLotTotal")).toHaveText("$0.00");
  await expect(page.locator("#lotTotalCost")).toHaveJSProperty("readOnly", true);
  await page.getByLabel("Free (trade)").uncheck();
  await expect(page.locator("#lotTotalCost")).toHaveValue("");
  await expect(page.locator("#lotTotalCost")).toHaveJSProperty("readOnly", false);
});

test("known priced history remains visible with excluded slabs and dashboard position totals", async ({ page }, testInfo) => {
  await openCollection(page);
  await page.evaluate(() => {
    const { state, renderCollection, routeTo } = globalThis.fixtureApp;
    const base = state.items[0];
    const today = new Date().toISOString().slice(0,10);
    const lots = [{ acquiredAt: today, quantityAcquired: 2, quantityRemaining: 2, totalCost: 100, currency: "USD", costBasisKnown: true, acquisitionDateKnown: true }];
    const priced = {...base, price:130, pricingStatus:"live", quantity:2, lots, transactions:[], priceHistory:[1,2,3].map(day=>({ recordedAt:new Date(Date.now()-day*86400000).toISOString(), amount:120, currency:"USD", finish:"holofoil", condition:"Near Mint", provider:"synthetic" }))};
    lots[0].acquiredAt = new Date(Date.now()-4*86400000).toISOString().slice(0,10);
    state.items=[priced, {...priced,uid:"excluded-slab",name:"Missing slab",cardState:"graded",gradingCompany:"PSA",grade:10,price:null,quantity:1,lots:[{...lots[0],quantityAcquired:1,quantityRemaining:1}],priceHistory:[]}];
    state.portfolioHistoryMode="value";
    renderCollection(); routeTo("dashboard",{focus:false});
  });
  await expect(page.locator("#dashboardHighestCards button").first()).toContainText("$260.00");
  await expect(page.locator("#dashboardHighestCards button").first()).toContainText("×2");
  await expect(page.locator("#dashboardHighestCards button").last()).not.toContainText("×1");
  await expect(page.locator(".portfolio-chart-coverage")).toContainText("1 copies excluded");
  await expect.poll(()=>page.evaluate(()=>globalThis.fixtureApp.portfolioChartInstance?.data.datasets[1]?.data.filter(value=>value!==null).length || 0)).toBeGreaterThan(1);
  expect(await page.evaluate(()=>globalThis.fixtureApp.portfolioChartInstance.data.datasets[0].data.every(value=>value===null))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>globalThis.fixtureApp.portfolioChartInstance?.$traceProgress)).toBe(1);
  await page.screenshot({path:testInfo.outputPath("known-history-and-position-values.png"),fullPage:true});
});
