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
      contents: `${source}\nexport { state, renderDetail, supabase as testSupabase };`,
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

test("card details preserve uncertainty and keyboard-open tools across refreshes", async ({
  page,
}, testInfo) => {
  await openDetail(page);
  await expect(page.locator(".market-hero")).toContainText(
    "Older matching price",
  );
  await expect(page.locator(".market-hero")).toContainText("$125");
  await expect(page.locator(".owned-banner")).toContainText(
    "Current price unavailable",
  );
  for (const tool of ["prices", "grading", "purchases", "attachments"]) {
    await expect(
      page.locator(`[data-detail-tool="${tool}"]`),
    ).not.toHaveAttribute("open", "");
  }
  const screenshotPath = testInfo.outputPath("card-detail-collapsed.png");
  await page.screenshot({ fullPage: true, path: screenshotPath });
  await testInfo.attach("card-detail-collapsed.png", {
    path: screenshotPath,
    contentType: "image/png",
  });
  const prices = page.locator('[data-detail-tool="prices"]');
  await prices.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(prices).toHaveAttribute("open", "");
  await expect(
    page.getByRole("heading", { name: "Matching prices", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    async (url) => (await import(url)).renderDetail(),
    appUrl,
  );
  await expect(prices).toHaveAttribute("open", "");
  const purchases = page.locator('[data-detail-tool="purchases"]');
  await purchases.locator("summary").click();
  await expect(page.locator("#recordSaleButton")).toBeVisible();
  await expect(purchases).toContainText(
    "excluded from current value and profit",
  );
  await expect(purchases).toContainText(
    "Needs the amount you paid and a current market price",
  );
  await assertFits(page);
  // A different card must not inherit the previous card's expanded tools.
  await page.evaluate(async (url) => {
    const { state, renderDetail } = await import(url);
    state.items[0].uid = "22222222-2222-4222-8222-222222222222";
    state.detailId = state.items[0].uid;
    renderDetail();
  }, appUrl);
  await expect(prices).not.toHaveAttribute("open", "");
  await expect(purchases).not.toHaveAttribute("open", "");
});

test("price retry and active grading controls stay reachable outside collapsed tools", async ({
  page,
}) => {
  await openDetail(page, {
    pricingStatus: "error",
    referencePrice: null,
    activeGradingSubmission: {
      id: "submission-fixture",
      grader: "PSA",
      status: "received",
      quantity: 1,
      submittedAt: "2026-08-01",
      statusUpdatedAt: "2026-08-05",
      estimatedTotalCost: null,
    },
  });
  await expect(page.locator(".market-hero")).toContainText("Price unavailable");
  await expect(page.locator("#retryPricingButton")).toBeVisible();
  await expect(page.locator("#updateGradingSubmissionButton")).toBeVisible();
  await expect(page.locator("#recordGradingResultButton")).toBeVisible();
  await expect(page.locator(".grading-submission-status")).toContainText(
    "Received by grader",
  );
  await page.route("**/api/cards?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"provider-secret-diagnostic"}',
    }),
  );
  await page.evaluate(async (url) => {
    const { state } = await import(url);
    state.session = { user: { id: "33333333-3333-4333-8333-333333333333" } };
  }, appUrl);
  const request = page.waitForRequest("**/api/cards?*");
  await page.locator("#retryPricingButton").click();
  await request;
  await expect(page.locator("#retryPricingButton")).toBeVisible();
  await expect(page.locator("#detailContent")).not.toContainText(
    "provider-secret-diagnostic",
  );
  await page.locator('[data-detail-tool="purchases"] > summary').click();
  await expect(page.locator("#recordSaleButton")).toBeDisabled();
  await expect(page.locator("#recordPurchaseButton")).toBeDisabled();
  await expect(page.locator("#gradingInventoryLock")).toBeVisible();
  await assertFits(page);
});

test("attachment upload recovers from an asynchronous failure and accepts the same file again", async ({
  page,
}) => {
  await openDetail(page);
  await page.evaluate(async (url) => {
    const { testSupabase } = await import(url);
    testSupabase.auth.getUser = async () => ({
      data: { user: { id: "33333333-3333-4333-8333-333333333333" } },
      error: null,
    });
  }, appUrl);
  let uploads = 0;
  await page.route(
    "https://mica-detail-test.supabase.co/storage/v1/object/**",
    async (route) => {
      uploads += 1;
      await route.fulfill({
        status: uploads === 1 ? 500 : 200,
        contentType: "application/json",
        body:
          uploads === 1
            ? '{"statusCode":"500","error":"Internal","message":"private-bucket-diagnostic"}'
            : '{"Key":"fixture-receipt"}',
      });
    },
  );
  const attachment = {
    id: "attachment-fixture",
    filename: "receipt.pdf",
    kind: "document",
    byte_size: 22,
    created_at: "2026-09-06T00:00:00Z",
  };
  await page.route(
    "https://mica-detail-test.supabase.co/rest/v1/collection_item_attachments*",
    (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          route.request().method() === "POST"
            ? { id: attachment.id }
            : [attachment],
        ),
      }),
  );
  const attachments = page.locator('[data-detail-tool="attachments"]');
  await attachments.locator("summary").click();
  const input = page.locator("#collectionAttachmentInput");
  const file = {
    name: "receipt.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fixture receipt"),
  };
  await input.setInputFiles(file);
  await expect(page.locator("#collectionAttachmentError")).toContainText(
    "Choose it again to retry",
  );
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("");
  await expect(attachments).not.toContainText("private-bucket-diagnostic");
  await input.setInputFiles(file);
  await expect(attachments.locator(".attachment-list")).toContainText(
    "receipt.pdf",
  );
  expect(uploads).toBe(2);
  await expect(attachments).toHaveAttribute("open", "");
  await expect(input).toBeEnabled();
  await assertFits(page);
});
