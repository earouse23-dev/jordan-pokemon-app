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
      contents: `${source}\nexport { state, renderDetail, renderCollection, routeTo, bindEvents, saveCollectionViewState, restoreCollectionViewState, collectionViewStorageKey, supabase as testSupabase };`,
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

test("bulk keyboard selection keeps row identity, focus and scroll while updating actions", async ({
  page,
}) => {
  await openCollection(page);
  await page.locator("#selectPositionsButton").click();
  const rows = page.locator(".ledger-row");
  await rows.first().focus();
  const original = await rows.first().elementHandle();
  const y = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("Space");
  await expect(rows.first()).toBeFocused();
  await expect(rows.first()).toHaveAttribute("aria-checked", "true");
  expect(await original.evaluate((node) => node.isConnected)).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  await expect(page.locator("#bulkSelectedCount")).toHaveText("1 selected");
  await page.keyboard.press("Tab");
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#bulkSelectedCount")).toHaveText("2 selected");
  await page.locator("#bulkSelectShown").click();
  await expect(page.locator("#bulkSelectedCount")).toHaveText("0 selected");
  await expect(page.locator("#bulkOrganizeButton")).toBeDisabled();
  expect(await original.evaluate((node) => node.isConnected)).toBe(true);
});

test("cleared filters stay cleared when the owner collection view is restored", async ({
  page,
}) => {
  await openCollection(page);
  await page.evaluate(async (url) => {
    const { state, saveCollectionViewState, renderCollection } = await import(
      url
    );
    state.query = "Charizard";
    state.languageFilter = "en";
    state.gradeFilter = "10";
    state.minimumValue = "20";
    saveCollectionViewState();
    renderCollection();
  }, appUrl);
  await page.locator("#clearFilters").click();
  const restored = await page.evaluate(async (url) => {
    const { state, restoreCollectionViewState, collectionViewStorageKey } =
      await import(url);
    const saved = JSON.parse(localStorage.getItem(collectionViewStorageKey()));
    state.query = "sentinel";
    state.languageFilter = "ja";
    restoreCollectionViewState();
    return {
      saved,
      query: state.query,
      language: state.languageFilter,
      grade: state.gradeFilter,
      minimum: state.minimumValue,
    };
  }, appUrl);
  expect(restored).toMatchObject({
    query: "",
    language: "",
    grade: "",
    minimum: "",
    saved: { query: "", languageFilter: "", gradeFilter: "", minimumValue: "" },
  });
  await expect(page.locator(".ledger-row")).toHaveCount(2);
});

test("Home to Collection preserves the saved filter instead of resetting to all cards", async ({
  page,
}) => {
  await openCollection(page);
  await page.evaluate(async (url) => {
    const { state, saveCollectionViewState, renderCollection } = await import(
      url
    );
    state.query = "Charizard";
    state.setFilter = "Base Set";
    state.languageFilter = "en";
    saveCollectionViewState();
    renderCollection();
  }, appUrl);
  await page
    .locator(
      '[data-sidebar-target="dashboard"]:visible, [data-route="dashboard"]:visible',
    )
    .first()
    .click();
  await page
    .locator(
      '[data-sidebar-target="collection"]:visible, [data-route="collection"]:visible',
    )
    .first()
    .click();
  await expect(page.locator(".ledger-row")).toHaveCount(1);
  await expect(page.locator(".ledger-row")).toContainText("Charizard");
  const filters = await page.evaluate(async (url) => {
    const { state } = await import(url);
    return {
      query: state.query,
      set: state.setFilter,
      language: state.languageFilter,
    };
  }, appUrl);
  expect(filters).toEqual({
    query: "Charizard",
    set: "Base Set",
    language: "en",
  });
});

test("watchlist Recently updated sorts by dates instead of price and handles missing dates", async ({
  page,
}) => {
  await openCollection(page);
  await page.evaluate(async (url) => {
    const { state, renderCollection } = await import(url);
    const base = {
      ...state.items[0],
      targetPrice: null,
      startingMarketPrice: null,
    };
    state.watchlist = [
      {
        ...base,
        id: "old",
        name: "Old expensive",
        currentPrice: 999,
        updatedAt: "2026-01-01",
      },
      {
        ...base,
        id: "new",
        name: "New inexpensive",
        currentPrice: 1,
        updatedAt: "2026-09-01",
      },
      {
        ...base,
        id: "unknown",
        name: "Unknown date",
        currentPrice: 9999,
        updatedAt: "invalid",
      },
    ];
    state.ledgerView = "watchlist";
    state.sort = "updated-desc";
    renderCollection();
  }, appUrl);
  const rows = page.locator("#cardLedger .ledger-row");
  await expect(rows.first()).toContainText("New inexpensive");
  await expect(rows.nth(1)).toContainText("Old expensive");
  await expect(rows.nth(2)).toContainText("Unknown date");
});
