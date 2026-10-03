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
const appUrl = "/app.js?v=111";
let bundle;

test.use({ serviceWorkers: "block" });
test.beforeAll(async () => {
  const source = await readFile(new URL("../../app.js", import.meta.url), "utf8");
  const result = await build({
    stdin: { contents: `${source}\nexport { state, supabase, openSealedSearch, openSealedPositionSheet, openCardDetail };`, resolveDir: root, sourcefile: "app.js" },
    bundle: true, format: "esm", platform: "browser", target: "es2022", write: false,
  });
  bundle = result.outputFiles[0].text;
});

async function setup(page) {
  await page.route("**/app.js?v=111", (route) => route.fulfill({ contentType: "application/javascript", body: bundle }));
  await page.route("**/app-config.js*", (route) => route.fulfill({ contentType: "application/javascript", body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-sealed-test.supabase.co",supabasePublishableKey:"fixture-key"};' }));
  await page.route("https://mica-sealed-test.supabase.co/**", (route) => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.goto("/");
  await page.evaluate(async (url) => {
    const { state } = await import(url);
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
  expect(visionRequests).toHaveLength(1);
  expect(visionRequests[0]).toMatchObject({ mode: "sealed", images: [expect.stringMatching(/^data:image\/jpeg;base64,/)] });
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
    await target.route("**/app.js?v=111", (route) => route.fulfill({ contentType: "application/javascript", body: bundle }));
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
    if (await page.locator("#onboardingDialog").isVisible()) {
      await page.locator("[data-skip-onboarding]").click();
      await expect(page.locator("#onboardingDialog")).toBeHidden();
    }
    await page.evaluate(async (url) => (await import(url)).openSealedSearch(), appUrl);
    const photo = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 40; canvas.getContext("2d").fillRect(0, 0, 40, 40); return canvas.toDataURL("image/png").split(",")[1]; });
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
    await page.evaluate(async () => { const { supabase } = await import("/app.js?v=111"); await supabase.auth.signOut(); });
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
