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
      contents: `${source}\nexport { state, renderDetail, renderCollection, renderInsights, renderTrade, routeTo, bindEvents, saveCollectionViewState, restoreCollectionViewState, collectionViewStorageKey, supabase as testSupabase };`,
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
  await page.evaluate(
    async ({ appUrl, overrides }) => {
      const { state, renderDetail } = await import(appUrl);
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

test("collector Home includes unpriced cards and keeps bookkeeping optional across modes", async ({ page }, testInfo) => {
  await openCollection(page);
  await page.evaluate(async url => {
    const { state, renderCollection, routeTo } = await import(url);
    state.items[0].quantity = 3;
    state.organization.goals = [{ id: "goal-home", name: "Base Set binder", progress: { status: "ready", current: 2, target: 102, percent: 2 / 102 * 100 } }];
    renderCollection(); routeTo("dashboard", { focus: false });
  }, appUrl);
  await expect(page.locator("#dashboardHighestTitle")).toHaveText("Your cards");
  await expect(page.locator("#dashboardHighestCards button")).toHaveCount(2);
  await expect(page.locator("#dashboardHighestCards")).toContainText("3 owned");
  await expect(page.locator("#softwareModeHome")).toContainText("2 of 102");
  await expect(page.locator("#softwareModeHome")).not.toContainText("need review");
  await expect(page.locator("#portfolioChange")).not.toContainText("paid");
  await expect(page.locator("#portfolioValue")).toBeVisible();
  await expect(page.locator("#portfolioValue")).toHaveText("—");
  await expect(page.locator("#gradedOwnedCount")).not.toBeVisible();
  await expect(page.locator("#sealedOwnedCount")).not.toBeVisible();
  await expect(page.locator("#dashboardMoneyDetails")).not.toHaveAttribute("open", "");
  await expect(page.locator("#dashboardBusinessPerformance")).not.toBeVisible();
  if (testInfo.project.name !== "desktop-chromium") {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await assertFits(page);
      await page.screenshot({ path: testInfo.outputPath(`collector-home-${width}.png`), fullPage: true, animations: "disabled" });
    }
  } else await assertFits(page);
  await page.locator("#dashboardHighestCards button").first().click();
  await expect(page.locator("#detailTitle")).toHaveText("Charizard");
  await page.evaluate(async url => {
    const { switchSoftwareMode } = await import(url);
    await switchSoftwareMode("investor", { persist: false, announce: false });
  }, appUrl);
  await expect(page.locator("#dashboardHighestTitle")).toHaveText("Highest-value cards");
  await expect(page.locator("#dashboardMoneyDetails")).toHaveAttribute("open", "");
  await expect(page.locator("#softwareModeHome")).toContainText("Purchase costs recorded");
  await page.evaluate(async url => {
    const { switchSoftwareMode } = await import(url);
    await switchSoftwareMode("seller", { persist: false, announce: false });
  }, appUrl);
  await expect(page.locator("#softwareModeHome")).toContainText("Listed inventory");
  await page.evaluate(async url => {
    const { switchSoftwareMode } = await import(url);
    await switchSoftwareMode("collector", { persist: false, announce: false });
  }, appUrl);
  await expect(page.locator("#dashboardHighestCards button")).toHaveCount(2);
  await expect(page.locator("#dashboardMoneyDetails")).not.toHaveAttribute("open", "");
  expect(await page.evaluate(async url => (await import(url)).state.items.reduce((sum,item)=>sum+item.quantity,0), appUrl)).toBe(4);
});
