import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

const appUrl = "/app.js?v=111";
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
let bundle;
test.use({ serviceWorkers: "block" });
test.beforeAll(async () => {
  const source = await readFile(
    new URL("../../app.js", import.meta.url),
    "utf8",
  );
  const result = await build({
    stdin: {
      contents: `${source}\nconst originalAddRecoverySave = saveCardAddDraft;
saveCardAddDraft = async (...args) => {
  try { return await originalAddRecoverySave(...args); }
  finally { globalThis.__completedAddSaves = (globalThis.__completedAddSaves || 0) + 1; }
};
export { state, applySession, bindEvents, restoreIntakeQueue };`,
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

async function setup(page, { deferWrite = false, failRefreshes = 0, failWrites = 0, failWriteAt = 0, rejectionCode = null } = {}) {
  const requests = { writes: [], refreshes: 0, pendingWrite: null };
  await page.route("**/app.js?v=111", (route) =>
    route.fulfill({ contentType: "application/javascript", body: bundle }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-add-recovery.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route(
    "https://mica-add-recovery.supabase.co/**",
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/rpc/create_collection_position")) {
        requests.writes.push(route.request().postDataJSON());
        if (requests.writes.length <= failWrites || requests.writes.length === failWriteAt) {
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "interrupted response", ...(rejectionCode ? { code: rejectionCode } : {}) }) });
          return;
        }
        if (deferWrite) {
          requests.pendingWrite = route;
          return;
        }
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify("44444444-4444-4444-8444-444444444444"),
        });
        return;
      }
      if (url.pathname.endsWith("/rest/v1/collections")) {
        requests.refreshes += 1;
        if (requests.refreshes <= failRefreshes) {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              code: "XX000",
              message: "private collection diagnostic",
            }),
          });
          return;
        }
      }
      await route.fulfill({ contentType: "application/json", body: "[]" });
    },
  );
  await page.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await page.evaluate(
    async ({ appUrl, ownerA }) => {
      const { state, bindEvents, openAddWorkspace, openPositionSheet } =
        await import(appUrl);
      bindEvents();
      state.session = { user: { id: ownerA } };
      state.accountLoading = false;
      state.accountLoadError = "";
      state.organization.status = "ready";
      state.gradingActivityStatus = "ready";
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      globalThis.__savedCallbacks = 0;
      globalThis.__refreshedCallbacks = 0;
      openAddWorkspace();
      openPositionSheet(
        {
          id: "fixture-pikachu",
          name: "Pikachu",
          set: "Base Set",
          number: "58/102",
          language: "en",
          variant: "Normal",
        },
        {
          ingestionChannel: "search",
          prefill: {cardState:"raw"},
          afterSave: () => {
            globalThis.__savedCallbacks += 1;
          },
          afterRefresh: () => {
            globalThis.__refreshedCallbacks += 1;
          },
        },
      );
    },
    { appUrl, ownerA },
  );
  return requests;
}

async function submit(page) {
  await page.getByRole("button", { name: "Add card", exact: true }).click();
}

test("a saved add retries collection refresh without another write", async ({
  page,
}) => {
  const requests = await setup(page, { failRefreshes: 2 });
  await submit(page);
  await expect(
    page.getByRole("heading", { name: "Change saved" }),
  ).toBeVisible();
  await expect(page.locator("#positionForm")).toHaveCount(0);
  await expect(page.locator("#savedChangeRefreshError")).toContainText(
    "Your change is saved",
  );
  await expect(page.locator("#sheetContent")).not.toContainText(
    "private collection diagnostic",
  );
  const retry = page.getByRole("button", { name: "Refresh collection" });
  await retry.click();
  await expect(page.locator("#savedChangeRefreshError")).toContainText(
    "Couldn’t refresh",
  );
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => globalThis.__refreshedCallbacks))
    .toBe(1);
  expect(requests.writes).toHaveLength(1);
  expect(requests.refreshes).toBe(3);
  expect(await page.evaluate(() => globalThis.__savedCallbacks)).toBe(1);
});

test("an add completing after an account change cannot reopen or advance the old flow", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const requests = await setup(page, { deferWrite: true });
  await submit(page);
  await expect.poll(() => Boolean(requests.pendingWrite)).toBe(true);
  await page.evaluate(
    async ({ appUrl, ownerB }) => {
      await (
        await import(appUrl)
      ).applySession({ user: { id: ownerB, email: "fixture@example.test" } });
    },
    { appUrl, ownerB },
  );
  await expect(page.locator("#bottomSheet")).toBeHidden();
  const refreshesBeforeCompletion = requests.refreshes;
  await requests.pendingWrite.fulfill({
    contentType: "application/json",
    body: JSON.stringify("44444444-4444-4444-8444-444444444444"),
  });
  await expect
    .poll(() => page.evaluate(() => globalThis.__completedAddSaves || 0))
    .toBe(1);
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect(page.locator("#positionForm")).toHaveCount(0);
  await expect(page.locator("#toastRegion")).not.toContainText(
    "Added to your collection",
  );
  expect(
    await page.evaluate(
      async (url) => ({
        owner: (await import(url)).state.session.user.id,
        saved: globalThis.__savedCallbacks,
        refreshed: globalThis.__refreshedCallbacks,
      }),
      appUrl,
    ),
  ).toEqual({ owner: ownerB, saved: 0, refreshed: 0 });
  expect(requests.refreshes).toBe(refreshesBeforeCompletion);
  expect(requests.writes).toHaveLength(1);
  expect(errors).toEqual([]);
});


test("queue survives reload and retries the identical uncertain save", async ({ page }) => {
  const requests = await setup(page, { failWrites: 1 });
  await page.evaluate(async url => {
    const app = await import(url);
    app.queueIntakeCard({ id: "fixture-pikachu", name: "Pikachu", set: "Base Set", number: "58/102", language: "en", variant: "Normal", image: "data:image/jpeg;base64,privatephoto" });
    app.openBatchIntakeSheet();
  }, appUrl);
  await page.locator("#reviewNextIntake").click();
  // These recovery cases exercise legacy raw quantities, explicitly selected now.
  if (await page.locator("#positionState").count()) await page.locator("#positionState").selectOption("raw");
  await submit(page);
  await expect(page.locator("#queueRetrySave")).toBeVisible();
  expect(requests.writes).toHaveLength(1);
  const original = requests.writes[0];
  await page.reload();
  await page.evaluate(async ({ appUrl, ownerA, ownerB }) => {
    const app = await import(appUrl);
    app.state.session = { user: { id: ownerB } };
    if (app.restoreIntakeQueue().length) throw new Error("Another owner's queue leaked");
    app.state.session = { user: { id: ownerA } };
    app.state.intakeQueue = app.restoreIntakeQueue();
    document.body.classList.add("authenticated");
    document.querySelector("#authGate").hidden = true;
    document.querySelector("#appShell").removeAttribute("aria-hidden");
    app.openBatchIntakeSheet();
  }, { appUrl, ownerA, ownerB });
  await expect(page.locator("[data-intake-quantity]")).toHaveValue("1");
  await expect(page.locator("[data-intake-remove]")).toBeDisabled();
  await expect(page.locator("#clearIntakeQueue")).toBeDisabled();
  await page.locator("#reviewNextIntake").click();
  // These recovery cases exercise legacy raw quantities, explicitly selected now.
  if (await page.locator("#positionState").count()) await page.locator("#positionState").selectOption("raw");
  await page.locator("#queueRetrySave").click();
  await expect.poll(() => requests.writes.length).toBe(2);
  expect(requests.writes[1]).toEqual(original);
  await expect.poll(() => page.evaluate(async url => (await import(url)).restoreIntakeQueue().length, appUrl)).toBe(0);
  expect(JSON.stringify(original)).not.toContain("privatephoto");
});

test("queue retains quantity across reload and refuses writes without a saved journal", async ({ page }) => {
  const requests = await setup(page);
  await page.evaluate(async url => {
    const app = await import(url);
    app.queueIntakeCard({ id: "fixture-pikachu", name: "Pikachu", set: "Base Set", number: "58/102", language: "en", variant: "Normal" });
    app.openBatchIntakeSheet();
  }, appUrl);
  await page.locator("[data-intake-quantity]").fill("4");
  await page.locator("[data-intake-quantity]").dispatchEvent("change");
  await page.evaluate(async url => {
    const app = await import(url);
    app.state.intakeQueue = app.restoreIntakeQueue();
    app.openBatchIntakeSheet();
    Storage.prototype.setItem = () => { throw new Error("Storage full"); };
  }, appUrl);
  await expect(page.locator("[data-intake-quantity]")).toHaveValue("4");
  await page.locator("#reviewNextIntake").click();
  // These recovery cases exercise legacy raw quantities, explicitly selected now.
  if (await page.locator("#positionState").count()) await page.locator("#positionState").selectOption("raw");
  await submit(page);
  await expect(page.locator("#positionError")).toContainText("Device storage is unavailable");
  await expect(page.locator("#positionQuantity")).toHaveValue("4");
  expect(requests.writes).toHaveLength(0);
});


test("a definite rejected queue save remains editable", async ({ page }) => {
  const requests = await setup(page, { failWrites: 1, rejectionCode: "23514" });
  await page.evaluate(async url => {
    const app = await import(url);
    app.queueIntakeCard({ id: "fixture-pikachu", name: "Pikachu", set: "Base Set", number: "58/102", language: "en", variant: "Normal" });
    app.openBatchIntakeSheet();
  }, appUrl);
  await page.locator("#reviewNextIntake").click();
  // These recovery cases exercise legacy raw quantities, explicitly selected now.
  if (await page.locator("#positionState").count()) await page.locator("#positionState").selectOption("raw");
  await submit(page);
  await expect(page.locator("#positionError")).toContainText("Your details are still here");
  await expect(page.locator("#positionQuantity")).toBeEditable();
  await page.locator("#positionQuantity").fill("2");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect.poll(() => requests.writes.length).toBe(2);
  expect(requests.writes[1].p_quantity).toBe(2);
});


test("ordinary collection add needs no purchase facts", async ({ page }) => {
  const requests = await setup(page);
  await expect(page.locator("#positionPurchaseDetails")).not.toHaveAttribute("open", "");
  await expect(page.locator("#positionDate")).toHaveValue("");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect.poll(() => requests.writes.length).toBe(1);
  expect(requests.writes[0].p_identity.acquisitionCostKnown).toBe(false);
  expect(requests.writes[0].p_identity.acquisitionDateKnown).toBe(false);
  expect(requests.writes[0].p_acquisition_method).toBe("unknown");
});

test("batch adds reviewed versions together and retries only remaining rows", async ({ page }) => {
  const requests = await setup(page, { failWriteAt: 2 });
  await page.evaluate(async url => {
    const app = await import(url);
    for (let i = 1; i <= 3; i++) app.queueIntakeCard({ id: `fixture-${i}`, name: `Card ${i}`, set: "Base Set", number: `${i}/102`, language: "en", variant: "Normal" });
    app.openBatchIntakeSheet();
  }, appUrl);
  await page.getByText("Shared purchase details · optional", { exact: true }).click();
  await page.locator("#batchIntakeCost").fill("5");
  await page.locator("#batchIntakeDate").fill("2026-01-01");
  await page.locator("#saveIntakeBatch").click();
  await expect(page.locator("#batchIntakeError")).toContainText("1 saved · 2 remaining");
  await expect(page.locator(".intake-row")).toHaveCount(2);
  expect(requests.writes[0].p_identity.finish).toBe("non_holo");
  const uncertain = requests.writes[1];
  await page.reload();
  await page.evaluate(async ({ appUrl, ownerA }) => {
    const app = await import(appUrl);
    app.state.session = { user: { id: ownerA } };
    app.state.intakeQueue = app.restoreIntakeQueue();
    document.body.classList.add("authenticated");
    document.querySelector("#authGate").hidden = true;
    app.openBatchIntakeSheet();
  }, { appUrl, ownerA });
  await expect(page.locator("#batchIntakeCost")).toHaveValue("5");
  await expect(page.locator("#batchIntakeDate")).toHaveValue("2026-01-01");
  await page.locator("#saveIntakeBatch").click();
  await expect.poll(() => requests.writes.length).toBe(4);
  expect(requests.writes[2]).toEqual(uncertain);
  expect(Number(requests.writes[3].p_unit_price)).toBe(5);
  expect(requests.writes[3].p_transaction_date).toBe("2026-01-01");
  expect(requests.writes[3].p_identity.acquisitionCostKnown).toBe(true);
  expect(requests.writes.map(row => row.p_identity.name)).toEqual(["Card 1", "Card 2", "Card 2", "Card 3"]);
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect.poll(() => page.evaluate(async url => (await import(url)).state.intakeQueue.length, appUrl)).toBe(0);
});


test("changing a queued printing cannot turn later normal copies into reverse copies", async ({ page }) => {
  const requests = await setup(page);
  await page.evaluate(async url => {
    const app = await import(url);
    globalThis.queueFixture = { id: "fixture-pikachu", name: "Pikachu", set: "Base Set", number: "58/102", language: "en", variant: "Normal", variantId: "normal", variantOptions: [
      { id: "normal", label: "Normal", finish: "non_holo", language: "en" },
      { id: "reverse", label: "Reverse Holofoil", finish: "reverse_holo", language: "en" },
    ] };
    app.queueIntakeCard(globalThis.queueFixture); app.openBatchIntakeSheet();
  }, appUrl);
  await page.locator("[data-intake-version]").selectOption("reverse");
  await page.evaluate(async url => { const app = await import(url); app.queueIntakeCard(globalThis.queueFixture); app.openBatchIntakeSheet(); }, appUrl);
  await expect(page.locator(".intake-row")).toHaveCount(2);
  await page.locator("#saveIntakeBatch").click();
  await expect.poll(() => requests.writes.length).toBe(2);
  expect(requests.writes.map(row => row.p_identity.finish)).toEqual(["reverse_holofoil", "non_holo"]);
  expect(requests.writes.map(row => row.p_quantity)).toEqual([1, 1]);
});

test("changing a free acquisition back to unknown cannot invent zero cost", async ({ page }) => {
  const requests = await setup(page);
  await page.locator("#positionMoreSummary").click();
  await page.locator("#positionAcquisitionMethod").selectOption("gift");
  await page.locator("#positionAcquisitionMethod").selectOption("unknown");
  await expect(page.locator("#positionTotalCost")).toHaveValue("");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect.poll(() => requests.writes.length).toBe(1);
  expect(requests.writes[0].p_identity.acquisitionCostKnown).toBe(false);
});
