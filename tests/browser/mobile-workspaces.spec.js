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
      contents: `${source.replace("void bootstrap();", "")}\nexport { state, renderDetail, renderCollection, renderInsights, renderTrade, routeTo, bindEvents, saveCollectionViewState, restoreCollectionViewState, collectionViewStorageKey, supabase as testSupabase };`,
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

test("populated mobile workspaces stay readable and contained", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "desktop-chromium");
  await openCollection(page);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    for (const route of [
      "dashboard",
      "collection",
      "scan",
      "trade",
      "profile",
      "detail",
    ]) {
      await page.evaluate(
        async ({ appUrl, route }) => {
          const app = await import(appUrl);
          app.routeTo(route, { focus: false, history: "replace" });
          if (route === "collection" || route === "dashboard")
            app.renderCollection();
          if (route === "detail") app.renderDetail();
          if (route === "trade") app.renderTrade();
          scrollTo(0, 0);
        },
        { appUrl, route },
      );
      await expect(page.locator(`#view-${route}`)).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`${route}-${width}.png`),
        animations: "disabled",
      });
      if (route === "collection") {
        await expect(page.locator("#collectionOrganization")).not.toHaveAttribute("open", "");
        await expect(page.locator("#collectionSearch")).toBeInViewport();
        await expect(page.locator("#collectionOrganization")).toBeHidden();
        await expect(page.locator("#collectionOrganization")).toHaveAttribute("inert", "");
        await expect(page.locator(".bottom-nav > button").nth(1)).toHaveAttribute("data-route", "scan");
        await assertFits(page);
      }
      await assertFits(page);
      const title = page.locator(`#view-${route} h1`).first();
      const size = await title.evaluate((el) =>
        parseFloat(getComputedStyle(el).fontSize),
      );
      expect(size).toBeLessThanOrEqual(32);
    }
  }
});
