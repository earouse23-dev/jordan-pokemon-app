import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { loadCollectionPositionAttachments, loadPortfolio } from "../../lib/supabase-data.js";
import { portfolioProfitLoss, portfolioProfitLossHistory } from "../../lib/portfolio.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appUrl = "/app.js?v=114";
let bundle;

test.use({ serviceWorkers: "block" });
test.beforeEach(async ({page}) => { await page.addInitScript(()=>{globalThis.__packageReadingInputs=[];globalThis.__readPackageText=async source=>{globalThis.__packageReadingInputs.push(source);return globalThis.__packageQuery || "Synthetic Elite Trainer Box";};}); });
test.beforeAll(async () => {
  const source = (await readFile(new URL("../../app.js", import.meta.url), "utf8")).replace('const { readPackageText } = await import("./lib/card-ocr.js");', 'const readPackageText = globalThis.__readPackageText;');
  const result = await build({
    stdin: { contents: `${source}\nexport { state, supabase, openSealedSearch, openSealedPositionSheet, openCardDetail, loadSealedDetailPricing, restoreIntakeQueue };`, resolveDir: root, sourcefile: "app.js" },
    bundle: true, format: "esm", platform: "browser", target: "es2022", write: false,
  });
  bundle = result.outputFiles[0].text;
});

async function setup(page) {
  await page.route("**/app.js?v=114", (route) => route.fulfill({ contentType: "application/javascript", body: bundle }));
  await page.route("**/app-config.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-sealed-test.supabase.co",supabasePublishableKey:"fixture-key"};' }));
  await page.route("https://mica-sealed-test.supabase.co/**", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.goto("/");
  await page.evaluate(async (url) => {
    const module = await import(url);
    globalThis.fixtureSealedApp = module;
    await module.supabase.auth.getSession();
    await new Promise(resolve => setTimeout(resolve, 0));
    const { state } = module;
    state.session = { access_token: "synthetic-token", user: { id: "11111111-1111-4111-8111-111111111111" } };
    state.accountLoading = false;
    document.body.classList.add("authenticated");
    document.querySelector("#authGate").hidden = true;
    document.querySelector("#appShell").removeAttribute("aria-hidden");
  }, appUrl);
}

test("sealed candidate rejects wrong language, preserves correction and retries one stable write", async ({ page }, testInfo) => {
  const writes = [];
  const visionRequests = [];
  let detailAttempt = 0;
  await setup(page);
  await page.route("**/api/vision", (route) => { visionRequests.push(route.request().postDataJSON()); return route.fulfill({ contentType: "application/json", body: JSON.stringify({ analysis: { candidate: { name: "Synthetic Elite Trainer Box", set: "Synthetic Set", language: "en", productType: "elite_trainer_box", sealedRegion: "US", sealedVariant: "Pokemon Center" }, requiresConfirmation: true } }) }); });
  await page.route("**/api/sealed?*", (route) => {
    const detail = new URL(route.request().url()).searchParams.has("id");
    if (detail) detailAttempt += 1;
    const product = { id: "sealed:77", name: "Synthetic Elite Trainer Box", set: "Synthetic Set", language: detailAttempt === 1 && detail ? "de" : "en", productType: "elite_trainer_box", variant: "Sealed product", sealedVariant: detailAttempt === 2 && detail ? "Pokemon Center" : "Standard", externalIds: { pkmnpricesSealed: 77 }, cardState: "sealed", quotes: [] };
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(detail ? { product } : { products: [product] }) });
  });
  await page.evaluate(async (url) => (await import(url)).openSealedSearch({ name: "Synthetic Elite Trainer Box" }), appUrl);
  const photo = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 20; canvas.height = 20; canvas.getContext("2d").fillRect(0, 0, 20, 20); return canvas.toDataURL("image/png").split(",")[1]; });
  await page.locator("#sealedPhoto").setInputFiles({ name: "synthetic-box.png", mimeType: "image/png", buffer: Buffer.from(photo, "base64") });
  await expect(page.locator("#sealedPhotoPreview")).toBeVisible();
  await expect(page.locator("[data-sealed-id]")).toBeVisible();
  expect(visionRequests).toHaveLength(0);
  expect(await page.evaluate(()=>globalThis.__packageReadingInputs)).toEqual([expect.stringMatching(/^data:image\/jpeg;base64,/)]);
  await page.locator("[data-sealed-id]").click();
  await expect(page.locator("#sealedResults")).toContainText("Retry");
  await page.locator("[data-sealed-id]").click();
  await expect(page.locator("#sealedResults")).toContainText("Retry");
  expect(detailAttempt).toBe(2);
  await expect(page.locator("#sheetTitle")).toHaveText("Find unopened products");
  await page.getByRole("button", { name: "Enter product manually" }).click();
  await page.locator("#manualSealedSet").fill("Synthetic Set");
  await page.locator("#manualSealedType").selectOption("elite_trainer_box");
  await page.locator("#manualSealedRegion").fill("US");
  await page.locator("#manualSealedVariant").fill("Pokemon Center");
  await page.locator("#manualSealedForm button[type=submit]").click();
  await expect(page.locator("#bottomSheet")).toContainText("Pokemon Center");
  await expect(page.locator("#bottomSheet")).toContainText("US");
  if (process.env.MICA_CLIENT_07D_CAPTURE) {
    const dir = fileURLToPath(new URL("../../docs/evidence/sol-client-07d/", import.meta.url));
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/sealed-correction-${testInfo.project.name}.png`, fullPage: true });
  }
  await page.route("https://mica-sealed-test.supabase.co/rest/v1/rpc/create_collection_position", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: writes.length === 1 ? 503 : 200, contentType: "application/json", body: writes.length === 1 ? '{"message":"temporary failure"}' : '"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"' });
  });
  await page.locator("#sealedCostUnknown").check();
  await page.locator("#sealedCurrency").selectOption("EUR");
  await expect(page.locator("#sealedPositionTotal")).toHaveText("Not recorded");
  await page.locator(".intake-more > summary").click();
  await page.locator("#sealedDateUnknown").check();
  await page.locator('button[name="saveMode"][value="view"]').click();
  await expect(page.locator("#sealedPositionError")).toContainText("Could not add");
  await page.locator('button[name="saveMode"][value="view"]').click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0].p_idempotency_key).toBe(writes[1].p_idempotency_key);
  expect(writes[1].p_identity).toMatchObject({ cardState: "sealed", productType: "elite_trainer_box", sealedRegion: "US", sealedVariant: "Pokemon Center", identityStatus: "needs_review", externalIds: {} });
  expect(writes[1].p_identity.acquisitionCostKnown).toBe(false);
  expect(writes[1].p_identity.acquisitionDateKnown).toBe(false);
  expect(writes[1].p_currency).toBe("EUR");
  await page.evaluate(async ({ url, identity }) => {
    const { state, openCardDetail } = await import(url);
    const item = { ...identity, id: identity.providerCardId, uid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "owned", cardState: "sealed", quantity: 1, currency: "EUR", costBasis: null, price: null, pricingStatus: "missing", transactions: [], lots: [], priceHistory: [], quotes: [] };
    state.items = [item];
    openCardDetail(item, true);
  }, { url: appUrl, identity: writes[1].p_identity });
  await expect(page.locator("#detailTitle")).toHaveText("Synthetic Elite Trainer Box");
  await expect(page.locator(".detail-meta")).toContainText("Pokemon Center");
  await expect(page.locator(".detail-meta")).toContainText("US");
  await expect(page.locator(".market-hero")).toContainText("Price unavailable");
});

test("07E disposable sealed form survives lost response and fresh login with owner isolation", async ({ page, browser }, testInfo) => {
  test.skip(process.env.MICA_CLIENT_07E_DISPOSABLE !== "1" || testInfo.project.name !== "desktop-chromium", "requires owned 07E database");
  test.setTimeout(90_000);
  const { MICA_CLIENT_07E_PROJECT_ID: projectId, MICA_CLIENT_07E_WORKDIR: workdir, MICA_LOCAL_SUPABASE_URL: localUrl, MICA_LOCAL_SUPABASE_ANON_KEY: anonKey, MICA_LOCAL_SUPABASE_SERVICE_KEY: serviceKey } = process.env;
  expect(projectId).toMatch(/^mica-client-07e-[a-zA-Z0-9]+$/);
  expect(realpathSync(workdir)).toMatch(/^\/private\/tmp\/mica-client-07e-/);
  const origin = new URL(localUrl);
  expect(origin.origin).toBe("http://127.0.0.1:55721");
  for (const name of [`supabase_db_${projectId}`, `supabase_kong_${projectId}`]) {
    const container = JSON.parse(execFileSync("docker", ["--context", "colima-mica-dev", "inspect", name], { encoding: "utf8" }))[0];
    expect(container.Config.Labels["com.supabase.cli.project"]).toBe(projectId);
    expect(realpathSync(container.Config.Labels["com.supabase.cli.workdir"])).toBe(realpathSync(workdir));
  }
  const guardedFetch = (input, init) => {
    expect(new URL(input instanceof Request ? input.url : input).origin).toBe(origin.origin);
    return fetch(input, { ...init, redirect: "error" });
  };
  const client = (key) => createClient(localUrl, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: guardedFetch } });
  const admin = client(serviceKey);
  const email = `mica-07e-${randomUUID()}@example.invalid`;
  const siblingEmail = `mica-07e-${randomUUID()}@example.invalid`;
  const password = `Mica-${randomUUID()}-9a!`;
  const createdIds = [];
  let freshContext;
  let rpcCalls = 0;
  const rpcPayloads = [];
  let failBeforeCommit = false;
  let preCommitFailed = false;
  const attachmentResponses = [];
  const routePage = async (target) => {
    await target.route("**/app.js?v=114", (route) => route.fulfill({ contentType: "application/javascript", body: bundle }));
    await target.route("**/app-config.js*", (route) => route.fulfill({ contentType: "application/javascript", body: `globalThis.__APP_CONFIG__=${JSON.stringify({ supabaseUrl: "https://mica-07e-test.supabase.co", supabasePublishableKey: anonKey })};` }));
    await target.route("**/api/**", (route) => route.fulfill({ contentType: "application/json", body: "{}" }));
    await target.route("**/api/vision", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ analysis: { candidate: { name: "Synthetic ETB", set: "Synthetic Set", language: "en", sealedRegion: "EU", productType: "elite_trainer_box", sealedVariant: "Standard" }, requiresConfirmation: true } }) }));
    await target.route("https://mica-07e-test.supabase.co/**", async (route) => {
      const request = new URL(route.request().url());
      if (request.pathname === "/rest/v1/rpc/create_collection_position") {
        rpcCalls += 1;
        rpcPayloads.push(route.request().postDataJSON());
        if (failBeforeCommit && !preCommitFailed) {
          preCommitFailed = true;
          return route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"synthetic precommit failure"}' });
        }
      }
      const response = await route.fetch({ url: `${origin.origin}${request.pathname}${request.search}`, maxRedirects: 0 });
      if (request.pathname.startsWith("/storage/v1/") || request.pathname.startsWith("/rest/v1/collection_item_attachments"))
        attachmentResponses.push({ path: request.pathname, status: response.status(), body: response.status() >= 400 ? await response.text() : "" });
      if (request.pathname === "/rest/v1/rpc/create_collection_position" && rpcCalls === 1) {
        expect(response.status()).toBe(200);
        return route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"synthetic lost response after commit"}' });
      }
      await route.fulfill({ response });
    });
    await target.route("**/*", (route) => ["127.0.0.1", "mica-07e-test.supabase.co"].includes(new URL(route.request().url()).hostname) ? route.fallback() : route.abort());
  };
  try {
    for (const accountEmail of [email, siblingEmail]) {
      const created = await admin.auth.admin.createUser({ email: accountEmail, password, email_confirm: true });
      expect(created.error).toBeNull();
      createdIds.push(created.data.user.id);
    }
    await routePage(page);
    await page.goto("/");
    await page.locator("#authEmail").fill(email);
    await page.locator("#authPassword").fill(password);
    await page.locator("#passwordAuthForm button[type=submit]").click();
    await expect(page.locator("#authGate")).toBeHidden();
    await expect.poll(() => page.evaluate(async (url) => (await import(url)).state.accountLoading, appUrl)).toBe(false);
    await expect.poll(() => page.evaluate(async (url) => Boolean((await import(url)).state.profile?.onboardingCompletedAt), appUrl)).toBe(true);
    await expect(page.locator("#onboardingDialog")).toHaveCount(0);
    await page.evaluate(async (url) => (await import(url)).openSealedSearch(), appUrl);
    const photo = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 40; canvas.getContext("2d").fillRect(0, 0, 40, 40); return canvas.toDataURL("image/png").split(",")[1]; });
    await page.evaluate(()=>{globalThis.__packageQuery="Synthetic ETB";});
    await page.locator("#sealedPhoto").setInputFiles({ name: "synthetic-etb.png", mimeType: "image/png", buffer: Buffer.from(photo, "base64") });
    await expect(page.locator("#sealedQuery")).toHaveValue("Synthetic ETB");
    await page.getByRole("button", { name: "Enter product manually" }).click();
    await page.locator("#manualSealedForm button[type=submit]").click();
    await page.locator("#sealedCurrency").selectOption("EUR");
    await page.locator("#sealedTotalCost").fill("24.00");
    await page.locator(".intake-more > summary").click();
    await page.locator("#sealedQuantity").fill("2");
    await expect(page.locator("#sealedPositionTotal")).toContainText("€24.00");
    await page.locator('button[name="saveMode"][value="view"]').click();
    await expect(page.locator("#sealedPositionError")).toContainText("Could not add");
    await page.locator('button[name="saveMode"][value="view"]').click();
    await expect.poll(() => rpcCalls).toBe(2);
    expect(rpcPayloads[0].p_idempotency_key).toBe(rpcPayloads[1].p_idempotency_key);
    expect(rpcPayloads[1].p_currency).toBe("EUR");
    const owner = client(anonKey);
    expect((await owner.auth.signInWithPassword({ email, password })).error).toBeNull();
    const loaded = await loadPortfolio(owner, createdIds[0]);
    const saved = loaded.filter((item) => item.name === "Synthetic ETB");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ cardState: "sealed", language: "en", productType: "elite_trainer_box", sealedRegion: "EU", sealedVariant: "Standard", quantity: 2, currency: "EUR", costBasis: 24 });
    expect(saved[0].transactions.filter((item) => item.type === "purchase")).toHaveLength(1);
    const attachments = await loadCollectionPositionAttachments(owner, saved[0].uid);
    expect(attachments, JSON.stringify(attachmentResponses)).toHaveLength(1);
    expect(attachments[0]).toMatchObject({ kind: "photo", mime_type: "image/png", filename: "synthetic-etb.png" });
    failBeforeCommit = true;
    await page.evaluate(async (url) => (await import(url)).openManualSealedEntry({ name: "Synthetic Booster Box", set: "Synthetic Set", language: "ja", productType: "booster_box" }), appUrl);
    await page.locator("#manualSealedForm button[type=submit]").click();
    await page.locator("#sealedCostUnknown").check();
    await page.locator(".intake-more > summary").click();
    await page.locator("#sealedDateUnknown").check();
    await page.locator('button[name="saveMode"][value="view"]').click();
    await expect(page.locator("#sealedPositionError")).toContainText("Could not add");
    await page.locator("#sealedQuantity").fill("2");
    await page.locator('button[name="saveMode"][value="view"]').click();
    await expect(page.locator("#sealedPositionForm")).toBeHidden();
    expect(rpcPayloads[2].p_idempotency_key).not.toBe(rpcPayloads[3].p_idempotency_key);
    const rawRows = await owner.from("collection_items").select("id,identity_snapshot,currency,quantity");
    expect(rawRows.error).toBeNull();
    const allSaved = await loadPortfolio(owner, createdIds[0]);
    const unknown = allSaved.filter((item) => item.name === "Synthetic Booster Box");
    expect(unknown, JSON.stringify({ rows: rawRows.data?.map((item) => ({ name: item.identity_snapshot?.name, id: item.id, currency: item.currency })), hydrated: allSaved.map((item) => ({ name: item.name, uid: item.uid, currency: item.currency })) })).toHaveLength(1);
    expect(unknown[0]).toMatchObject({ currency: "USD", language: "ja", productType: "booster_box", quantity: 2, costBasis: null });
    expect(unknown[0].transactions.filter((item) => item.type === "purchase")).toHaveLength(1);
    const sibling = client(anonKey);
    expect((await sibling.auth.signInWithPassword({ email: siblingEmail, password })).error).toBeNull();
    expect((await loadPortfolio(sibling, createdIds[1])).find((item) => item.uid === saved[0].uid)).toBeUndefined();
    const forbidden = await sibling.from("collection_items").select("id").eq("id", saved[0].uid);
    expect(forbidden.data).toEqual([]);
    await page.evaluate(async () => { const { supabase } = await import("/app.js?v=114"); await supabase.auth.signOut(); });
    freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    await routePage(freshPage);
    await freshPage.goto("/");
    await freshPage.locator("#authEmail").fill(email);
    await freshPage.locator("#authPassword").fill(password);
    await freshPage.locator("#passwordAuthForm button[type=submit]").click();
    await expect(freshPage.locator("#authGate")).toBeHidden();
    await expect.poll(() => freshPage.evaluate(async (url) => (await import(url)).state.items.some((item) => item.name === "Synthetic ETB"), appUrl)).toBe(true);
    const freshItem = await freshPage.evaluate(async (url) => (await import(url)).state.items.find((item) => item.name === "Synthetic ETB"), appUrl);
    expect(freshItem).toMatchObject({ currency: "EUR", sealedRegion: "EU", sealedVariant: "Standard", costBasis: 24 });
    await freshPage.evaluate(async (url) => { const app = await import(url); app.openCardDetail(app.state.items.find((item) => item.name === "Synthetic ETB"), true); }, appUrl);
    await freshPage.locator(".collection-attachments > summary").click();
    await expect(freshPage.locator(".collection-attachments")).toContainText("synthetic-etb.png");
    expect(await freshPage.evaluate(async (url) => (await import(url)).state.items.find((item) => item.name === "Synthetic Booster Box")?.costBasis, appUrl)).toBeNull();
    await freshPage.locator('[data-detail-tool="purchases"] > summary').click();
    await freshPage.locator("#recordSaleButton").click();
    await expect(freshPage.locator("#saleCurrency")).toHaveValue("EUR");
    await freshPage.locator("#salePrice").fill("20.00");
    await freshPage.locator("#saleForm button[type=submit]").click();
    await expect(freshPage.locator("#saleForm")).toBeHidden();
    const afterSale = await loadPortfolio(owner, createdIds[0]);
    const eur = portfolioProfitLoss(afterSale, "EUR");
    const usd = portfolioProfitLoss(afterSale, "USD");
    expect(eur.realizedMinor).toBe(800);
    expect(eur.knownRealizedSales).toBe(1);
    expect(eur.missingUnits).toBe(1);
    expect(usd.unknownBasisUnits).toBe(2);
    expect(portfolioProfitLossHistory(afterSale, "EUR").at(-1).realizedMinor).toBe(800);
  } finally {
    await freshContext?.close();
    for (const id of createdIds) expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});

const historyProduct = {
  id: "sealed:5678", providerCardId: "sealed:5678", name: "Synthetic ETB", set: "Synthetic Set", language: "en", productType: "elite_trainer_box", cardState: "sealed", variant: "Sealed product", externalIds: { pkmnpricesSealed: 5678 }, quotes: [], historyStatus: "live", capabilities: { history: "live" },
  history: [1, 2].map(day => ({ provider: "cardmarket", providerVariantId: "5678:cardmarket:sealed", recordedAt: new Date(Date.now() - day * 86400000).toISOString(), currency: "EUR", finish: "sealed", condition: null, amount: day * 100, granularity: "day" })),
};
async function openHistoryProduct(page, displayCurrency = "EUR") {
  await page.evaluate(({ product, displayCurrency }) => {
    const { state, openCardDetail } = globalThis.fixtureSealedApp;
    state.profile = { ...state.profile, displayCurrency };
    const item = { ...product, uid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "owned", quantity: 1, currency: "EUR", costBasis: null, cost: null, price: null, pricingStatus: "missing", transactions: [], lots: [], tags: [], priceHistory: [] };
    state.items = [item]; openCardDetail(item, true);
  }, { product: historyProduct, displayCurrency });
}
test("sealed history converts display amounts with dated FX and preserves native records", async ({ page }) => {
  await setup(page);
  let rateAvailable = false;
  const date = new Date().toISOString().slice(0, 10);
  const hash = "a".repeat(64);
  await page.route("**/api/fx", route => route.fulfill({ status: rateAvailable ? 200 : 503, contentType: "application/json", body: JSON.stringify(rateAvailable ? { sourceId: "ecb-eurofxref-daily", sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", base: "EUR", quote: "USD", units: "USD per EUR", rate: 1.25, effectiveDate: date, fetchedAt: new Date().toISOString(), contentSha256: hash, rateRef: "ecb-eurofxref-daily:" + date + ":" + hash } : {}) }));
  await page.route("**/api/sealed?*", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ product: historyProduct }) }));
  await openHistoryProduct(page, "USD");
  await expect(page.locator("#positionChart")).toBeVisible();
  await page.locator(".history-values > summary").click();
  await expect(page.locator("#cardPriceHistory")).toContainText("display conversion is unavailable");
  rateAvailable = true;
  await page.locator("[data-retry-history-fx]").click();
  await expect(page.locator("#positionChart")).toBeVisible();
  await expect(page.locator(".history-values")).toContainText("$125.00 · original €100.00");
  await expect(page.locator(".chart-context").filter({ hasText: "Display conversion uses ECB" })).toContainText("not historical exchange rates");
  expect(await page.evaluate(() => globalThis.fixtureSealedApp.state.items[0].currency)).toBe("EUR");
});
test("unsupported legacy currency does not trigger repeated FX requests", async ({ page }) => {
  await setup(page);
  let rateCalls = 0;
  await page.route("**/api/fx", route => { rateCalls++; return route.fulfill({ status: 503, contentType: "application/json", body: "{}" }); });
  await page.evaluate(() => {
    const { state, openCardDetail } = globalThis.fixtureSealedApp;
    state.profile = { ...state.profile, displayCurrency: "USD" };
    const item = { uid: "legacy-gbp", id: "sealed:manual", name: "Legacy sealed", cardState: "sealed", variant: "Sealed", status: "owned", currency: "GBP", quantity: 1, price: null, pricingStatus: "missing", transactions: [], lots: [], tags: [], quotes: [], priceHistory: [], externalIds: {} };
    state.items = [item]; openCardDetail(item, true);
  });
  await expect(page.locator("#cardPriceHistory")).toContainText("not available for this record's currency");
  await expect(page.locator("[data-retry-history-fx]")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(rateCalls).toBe(0);
});
test("sealed detail charts native EUR aggregate history without inventing current value", async ({ page }, testInfo) => {
  await setup(page);
  await page.route("**/api/sealed?*", route => {
    expect(route.request().headers().authorization).toBe("Bearer synthetic-token");
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ product: historyProduct }) });
  });
  await openHistoryProduct(page);
  await expect(page.locator("#positionChart")).toBeVisible();
  await expect(page.locator(".market-hero")).toContainText("Price unavailable");
  await page.locator(".history-values > summary").click();
  await expect(page.locator(".history-values tbody tr")).toHaveCount(2);
  await expect(page.locator(".history-values")).toContainText("€100.00");
  await expect(page.locator(".history-values")).toContainText("cardmarket");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("sealed-history-viewport-fixture.png") });
});
test("late sealed response cannot overwrite a changed account or selected detail", async ({ page }) => {
  await setup(page);
  let pending;
  await page.route("**/api/sealed?*", route => { pending = route; });
  await openHistoryProduct(page);
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.evaluate(() => {
    const { state } = globalThis.fixtureSealedApp;
    state.session = { user: { id: "22222222-2222-4222-8222-222222222222" } };
    state.items = []; state.detailCard = { name: "Second account selection" };
  });
  await pending.fulfill({ contentType: "application/json", body: JSON.stringify({ product: historyProduct }) });
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => ({ count: globalThis.fixtureSealedApp.state.items.length, name: globalThis.fixtureSealedApp.state.detailCard.name }))).toEqual({ count: 0, name: "Second account selection" });
});

test("late sealed history cannot overwrite a newer selection within the same account", async ({ page }) => {
  await setup(page);
  let pending;
  await page.route("**/api/sealed?*", route => { pending = route; });
  await openHistoryProduct(page);
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.evaluate(() => {
    const { state, openCardDetail } = globalThis.fixtureSealedApp;
    const next = { ...state.items[0], id: "sealed:manual", uid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Second selected ETB", externalIds: {} };
    state.items.push(next); openCardDetail(next, true);
  });
  await pending.fulfill({ contentType: "application/json", body: JSON.stringify({ product: historyProduct }) });
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#detailTitle")).toHaveText("Second selected ETB");
  expect(await page.evaluate(() => globalThis.fixtureSealedApp.state.items[0].priceHistory)).toEqual([]);
});

for (const shared of [false, true]) for (const switched of [false, true]) {
  test(`sealed ${shared ? "shared add" : "direct add"} photo retry uses the saved product once${switched ? " and stops for a changed owner" : ""}`, async ({ page }) => {
    await setup(page);
    const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    let creates = 0;
    let uploads = 0;
    const metadata = [];
    await page.route("**/rest/v1/rpc/create_collection_position", route => {
      creates++;
      expect(route.request().postDataJSON()).toMatchObject({ p_card_state: "sealed", p_currency: "EUR", p_notes: "Private box note", p_identity: { ingestion: { channel: "upload" } } });
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(itemId) });
    });
    await page.route("**/storage/v1/object/collection-item-files/**", route => {
      uploads++;
      expect(route.request().url()).toContain(`/11111111-1111-4111-8111-111111111111/${itemId}/`);
      return route.fulfill(uploads === 1 ? { status: 403, contentType: "application/json", body: '{"message":"fixture denied","statusCode":"403"}' } : { contentType: "application/json", body: '{}' });
    });
    await page.route("**/rest/v1/collection_item_attachments*", route => {
      if (route.request().method() === "POST") metadata.push(route.request().postDataJSON());
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "fixture-photo" }) });
    });
    await page.evaluate(async ({url,shared}) => {
      const { state, supabase, openSealedPositionSheet, openPositionSheet } = await import(url);
      supabase.auth.getUser = async () => ({ data: { user: state.session.user }, error: null });
      (shared ? openPositionSheet : openSealedPositionSheet)({ id: "manual-sealed:test", name: "Fixture ETB", set: "Fixture set", language: "en", cardState: "sealed", productType: "elite_trainer_box", variant: "Sealed product", identityStatus: "needs_review", externalIds: {} }, { ingestionChannel: "upload", photoFile: new File([new Uint8Array([1,2,3])], "fixture-box.png", { type: "image/png" }) });
    }, {url:appUrl,shared});
    await page.locator("#sealedCurrency").selectOption("EUR");
    await page.locator("#sealedTotalCost").fill("60");
    await page.locator("#sealedMoreSummary").click();
    await page.locator("#sealedNotes").fill("Private box note");
    await page.locator('button[name="saveMode"][value="view"]').click();
    await expect(page.locator("#sheetTitle")).toHaveText("Product saved");
    expect(creates).toBe(1); expect(uploads).toBe(1); expect(metadata).toHaveLength(0);
    if (switched) await page.evaluate(async url => { const {state}=await import(url); state.session={user:{id:"22222222-2222-4222-8222-222222222222"}}; }, appUrl);
    await page.locator("#retryScanPhoto").click();
    if (switched) {
      await expect(page.locator("#sheetTitle")).toHaveText("Product saved");
      expect(uploads).toBe(1); expect(metadata).toHaveLength(0);
    } else {
      await expect.poll(() => metadata.length).toBe(1);
      expect(metadata[0]).toMatchObject({ user_id: "11111111-1111-4111-8111-111111111111", collection_item_id: itemId, caption: "Unopened product identification photo" });
      await expect(page.locator("#retryScanPhoto")).toBeHidden();
      expect(uploads).toBe(2);
    }
    expect(creates).toBe(1);
  });
}

for (const rejected of [false, true]) {
  test(`sealed changed purchase ${rejected ? "can correct a definite rejection" : "cannot replace an uncertain save"}`, async ({ page }) => {
    await setup(page);
    const writes=[];
    await page.route("**/rest/v1/rpc/create_collection_position", route=>{
      writes.push(route.request().postDataJSON());
      return route.fulfill(writes.length===1 || (!rejected && writes.length===2)
        ? {status:rejected || writes.length===2?403:503,contentType:"application/json",body:JSON.stringify({message:"fixture failure",...(rejected || writes.length===2?{code:"42501"}:{})})}
        : {contentType:"application/json",body:JSON.stringify("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")});
    });
    await page.evaluate(async url => {const {openSealedPositionSheet}=await import(url);openSealedPositionSheet({id:"manual-sealed:test",name:"Fixture ETB",set:"Fixture",language:"en",cardState:"sealed",productType:"elite_trainer_box",variant:"Sealed product",externalIds:{},identityStatus:"needs_review"});},appUrl);
    await page.locator("#sealedTotalCost").fill("60");
    await page.locator('button[name="saveMode"][value="view"]').click();
    await expect(page.locator("#sealedPositionError")).toContainText("Could not add");
    await page.locator("#sealedTotalCost").fill("70");
    await page.locator('button[name="saveMode"][value="view"]').click();
    if(rejected){
      await expect.poll(()=>writes.length).toBe(2);
      expect(writes[1].p_idempotency_key).not.toBe(writes[0].p_idempotency_key);
      expect(writes[1].p_unit_price).toBe("70.00");
    }else{
      await expect(page.locator("#sealedPositionError")).toContainText("Retry the original details");
      expect(writes).toHaveLength(1);
      await expect(page.locator("#sealedTotalCost")).toHaveValue("70");
      await page.locator("#sealedTotalCost").fill("60");
      await page.locator('button[name="saveMode"][value="view"]').click();
      await expect.poll(()=>writes.length).toBe(2);
      expect(writes[1]).toEqual(writes[0]);
      await expect(page.locator("#sealedPositionError")).toContainText("Could not add");
      await page.locator("#sealedTotalCost").fill("70");
      await page.locator('button[name="saveMode"][value="view"]').click();
      await expect(page.locator("#sealedPositionError")).toContainText("Retry the original details");
      expect(writes).toHaveLength(2);
      await page.locator("#sealedTotalCost").fill("60");
      await page.locator('button[name="saveMode"][value="view"]').click();
      await expect.poll(()=>writes.length).toBe(3);
      expect(writes[2]).toEqual(writes[0]);
    }
    await expect(page.locator("#sealedPositionForm")).toBeHidden();
  });
}


for (const restart of [false,true]) test('sealed uncertain save survives '+(restart?'page reload':'closing and reopening')+' without a second operation', async ({page})=>{
  await setup(page);
  const writes=[];
  await page.route('**/rest/v1/rpc/create_collection_position',route=>{
    writes.push(route.request().postDataJSON());
    return route.fulfill({status:503,contentType:'application/json',body:'{"message":"lost response; commit unknown"}'});
  });
  const reopen=()=>page.evaluate(()=>globalThis.fixtureSealedApp.openSealedPositionSheet({id:'manual-sealed:recovery',name:'Fixture recovery ETB',set:'Fixture',language:'en',cardState:'sealed',productType:'elite_trainer_box',variant:'Sealed product',externalIds:{},identityStatus:'needs_review'}));
  await reopen();
  await page.locator('#sealedTotalCost').fill('60');
  await page.locator('button[name="saveMode"][value="view"]').click();
  await expect(page.locator('#sealedPositionError')).toContainText('Could not add');
  expect(writes).toHaveLength(1);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const stored=await page.evaluate(()=>localStorage.getItem('mica:intake-queue:v1:11111111-1111-4111-8111-111111111111'));
  expect(JSON.parse(stored)[0].pending.input.idempotencyKey).toBe(writes[0].p_idempotency_key);
  expect(stored).not.toContain('data:image');
  if(restart){
    await page.reload();
    await page.evaluate(async url=>{const app=await import(url);globalThis.fixtureSealedApp=app;app.state.session={user:{id:'11111111-1111-4111-8111-111111111111'}};app.state.accountLoading=false;app.state.intakeQueue=app.restoreIntakeQueue();document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;},appUrl);
  }
  await reopen();
  await expect(page.locator('#sealedTotalCost')).toHaveValue('60');
  // Same confirmed facts: reopening must replay the original operation, never mint a new key.
  await page.locator('#sealedTotalCost').fill('60');
  await page.locator('button[name="saveMode"][value="view"]').click();
  await expect(page.locator('#sealedPositionError')).toContainText('Could not add');
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});


for (const success of [false,true]) test('closed sealed request retains recovery after late '+(success?'success':'failure')+' without reopening UI',async({page})=>{
  await setup(page); const errors=[];page.on('pageerror',error=>errors.push(error.message));let pending;
  await page.route('**/rest/v1/rpc/create_collection_position',route=>{pending=route;});
  await page.evaluate(()=>globalThis.fixtureSealedApp.openSealedPositionSheet({id:'manual-sealed:late',name:'Fixture late ETB',set:'Fixture',language:'en',cardState:'sealed',productType:'elite_trainer_box',variant:'Sealed product',externalIds:{},identityStatus:'needs_review'}));
  await page.locator('#sealedTotalCost').fill('60');
  await page.locator('button[name="saveMode"][value="view"]').click();
  await expect.poll(()=>Boolean(pending)).toBe(true);
  const request=pending.request().postDataJSON();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await pending.fulfill(success?{contentType:'application/json',body:'"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"'}:{status:503,contentType:'application/json',body:'{"message":"lost response"}'});
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#bottomSheet')).toBeHidden();
  const recovery=await page.evaluate(()=>JSON.parse(localStorage.getItem('mica:intake-queue:v1:11111111-1111-4111-8111-111111111111'))[0]);
  expect(recovery.pending.input.idempotencyKey).toBe(request.p_idempotency_key);
  if(success)expect(recovery.pending.savedItemId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  expect(errors).toEqual([]);
});

test('sealed save refuses network mutation when device recovery cannot be stored',async({page})=>{
  await setup(page);let writes=0;
  await page.route('**/rest/v1/rpc/create_collection_position',route=>{writes++;return route.fulfill({contentType:'application/json',body:'"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"'});});
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('mica:intake-queue:'))throw new Error('fixture device storage denied');return original.call(this,key,value);};globalThis.fixtureSealedApp.openSealedPositionSheet({id:'manual-sealed:storage',name:'Fixture storage ETB',set:'Fixture',language:'en',cardState:'sealed',productType:'elite_trainer_box',variant:'Sealed product',externalIds:{},identityStatus:'needs_review'});});
  await page.locator('#sealedTotalCost').fill('60');
  await page.locator('button[name="saveMode"][value="view"]').click();
  await expect(page.locator('#sealedPositionError')).toContainText('Your save has not started');
  await expect(page.locator('#sealedTotalCost')).toHaveValue('60');expect(writes).toBe(0);
});


test('sealed recovery belongs to its original owner and rejects a mismatched restored journal',async({page})=>{
  await setup(page);let writes=0;
  await page.route('**/rest/v1/rpc/create_collection_position',route=>{writes++;return route.fulfill({status:503,contentType:'application/json',body:'{"message":"lost response"}'});});
  await page.evaluate(()=>globalThis.fixtureSealedApp.openSealedPositionSheet({id:'manual-sealed:owner',name:'Fixture owner ETB',set:'Fixture',language:'en',cardState:'sealed',productType:'elite_trainer_box',variant:'Sealed product',externalIds:{},identityStatus:'needs_review'}));
  await page.locator('#sealedTotalCost').fill('60');await page.locator('button[name="saveMode"][value="view"]').click();
  await expect(page.locator('#sealedPositionError')).toContainText('Could not add');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const result=await page.evaluate(()=>{const app=globalThis.fixtureSealedApp;const key='mica:intake-queue:v1:11111111-1111-4111-8111-111111111111';const stored=localStorage.getItem(key),entry=app.state.intakeQueue[0];app.state.session={user:{id:'22222222-2222-4222-8222-222222222222'}};const restored=app.restoreIntakeQueue(stored);app.openSealedPositionSheet(entry.card,{recoveryEntry:entry});return {restored:restored.length,originalUnchanged:localStorage.getItem(key)===stored,newOwnerDraft:localStorage.getItem('mica:intake-queue:v1:22222222-2222-4222-8222-222222222222')};});
  expect(result).toEqual({restored:0,originalUnchanged:true,newOwnerDraft:null});
  await expect(page.locator('#bottomSheet')).toBeHidden();expect(writes).toBe(1);
});

for (const currency of ["USD", "EUR"]) test(`box photo opens exact product with native ${currency} price before any save`, async ({page})=>{
 await setup(page);const calls=[],writes=[];await page.route("https://mica-sealed-test.supabase.co/**",r=>{writes.push(r.request().method());return r.fulfill({contentType:"application/json",body:"[]"});});
 const product={id:"sealed:77",name:"Synthetic Elite Trainer Box",set:"Synthetic Set",language:"en",productType:"elite_trainer_box",variant:"Sealed product",externalIds:{pkmnpricesSealed:77},cardState:"sealed",quotes:[{provider:currency === "EUR" ? "cardmarket" : "tcgplayer",aggregator:"pkmnprices",currency,finish:"sealed",condition:null,priceType:"market",amount:125,observedAt:new Date().toISOString(),retrievedAt:new Date().toISOString()}]};
 await page.route("**/api/sealed?*",r=>{calls.push(r.request().url());return r.fulfill({contentType:"application/json",body:JSON.stringify(new URL(r.request().url()).searchParams.has("id")?{product:{...product,language:null}}:{products:[product]})});});
 await page.evaluate(async url=>(await import(url)).openSealedSearch(),appUrl);const photo=await page.evaluate(()=>{const c=document.createElement("canvas");c.width=c.height=200;return c.toDataURL("image/png").split(",")[1];});await page.locator("#sealedPhoto").setInputFiles({name:"box.png",mimeType:"image/png",buffer:Buffer.from(photo,"base64")});await expect(page.locator("[data-sealed-id]")).toBeVisible();await page.locator("[data-sealed-id]").click();await expect(page.locator("#detailTitle")).toHaveText(product.name);await expect(page.locator(".market-hero")).toContainText(currency === "EUR" ? "€125.00" : "$125.00");await expect(page.getByRole("button",{name:"Add product",exact:true})).toBeVisible();await expect(page.locator("#sealedPositionForm")).toHaveCount(0);expect(writes.filter(m=>!["GET","HEAD"].includes(m))).toHaveLength(0);await page.locator("#addLibraryButton").click();await expect(page.locator("#sealedPositionForm")).toBeVisible();expect(calls.some(url=>url.includes("id=77"))).toBe(true);
});
