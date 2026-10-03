import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

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
      contents: `${source}\nconst originalIntakeTestReload = reloadPortfolio;
reloadPortfolio = async (...args) => {
  try { return await originalIntakeTestReload(...args); }
  finally { globalThis.__intakeTestReloads = (globalThis.__intakeTestReloads || 0) + 1; }
};
export {state, saveCardAddDraft, applySession, bindEvents, supabase as testSupabase};`,
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

function card(name, index, language = "en") {
  return {
    id: `tcgdex:${language}:base1-${index}`,
    name,
    set: "Base Set",
    number: `${index}/102`,
    language,
    variant: "Normal",
    variants: ["Normal"],
    thumb: "/icons/icon.svg",
  };
}

async function setup(page, { failAttempt = 0 } = {}) {
  const requests = [];
  await page.route("**/app.js?v=111", (route) =>
    route.fulfill({ contentType: "application/javascript", body: bundle }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-intake-test.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("https://mica-intake-test.supabase.co/**", async (route) => {
    if (route.request().url().endsWith("/rpc/create_collection_position")) {
      requests.push(route.request().postDataJSON());
      const fail = requests.length === failAttempt;
      await route.fulfill({
        status: fail ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          fail
            ? { message: "private-collection-diagnostic", code: "XX000" }
            : "44444444-4444-4444-8444-444444444444",
        ),
      });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await expect(page.locator("#authGate")).toBeVisible();
  await page.evaluate(
    async ({ appUrl, ownerA }) => {
      const { state, bindEvents, openAddWorkspace } = await import(appUrl);
      bindEvents();
      state.session = { user: { id: ownerA } };
      state.accountLoading = false;
      state.accountLoadError = "";
      state.organization.status = "ready";
      state.gradingActivityStatus = "ready";
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      openAddWorkspace();
    },
    { appUrl, ownerA },
  );
  return requests;
}

async function saveUnknownCost(page) {
  await page.getByRole("button", { name: "Add card", exact: true }).click();
}

test("adding a searched card preserves the search language and query for the next card", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.route("**/api/catalog?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ cards: [card("Pikachu", 58, "de")] }),
    }),
  );
  await page.locator("#quickSearchLanguage").selectOption("de");
  await page.locator("#quickCardSearch").fill("Pikachu 58/102");
  await page.locator("[data-add-search-card]").click();
  await expect(page.locator("#positionForm")).toBeVisible();
  await saveUnknownCost(page);
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect(page.locator("#view-scan")).toBeVisible();
  await expect(page.locator("#quickCardSearch")).toHaveValue("Pikachu 58/102");
  await expect(page.locator("#quickSearchLanguage")).toHaveValue("de");
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].p_identity.acquisitionCostKnown).toBe(false);
  // Observe completion of the real refresh path; the wrapper changes no result.
  await expect
    .poll(() => page.evaluate(() => globalThis.__intakeTestReloads || 0))
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(async (url) => (await import(url)).state.route, appUrl),
    )
    .toBe("scan");
});

test("viewing a reverse printing never substitutes an owned normal copy", async ({
  page,
}) => {
  await setup(page);
  const match = {
    ...card("Pikachu", 58),
    externalIds: { tcgplayer: "fixture-shared-provider-card" },
    variantOptions: [
      {
        id: "normal",
        label: "Normal",
        finish: "normal",
        language: "en",
        status: "exact",
      },
      {
        id: "reverse",
        label: "Reverse Holofoil",
        finish: "reverse_holofoil",
        language: "en",
        status: "exact",
      },
    ],
  };
  await page.route("**/api/catalog?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ cards: [match] }),
    }),
  );
  await page.evaluate(
    async ({ appUrl, match }) => {
      const { state } = await import(appUrl);
      state.items = [
        {
          ...match,
          uid: "55555555-5555-4555-8555-555555555555",
          variant: "Normal",
          variantId: "normal",
          collectibleId: "normal",
          cardState: "raw",
          condition: "Near Mint",
          gradingCompany: "",
          grade: "",
          status: "owned",
          quantity: 1,
          price: null,
          costBasis: null,
          tags: [],
          lots: [],
          transactions: [],
        },
      ];
    },
    { appUrl, match },
  );
  await page.locator("#quickCardSearch").fill("Pikachu");
  const reverse = page
    .locator(".quick-card-result-wrap")
    .filter({ hasText: "Reverse Holofoil" });
  await expect(reverse).toHaveCount(1);
  await expect(reverse.locator(".owned-search-status")).toHaveCount(0);
  await reverse.locator("[data-quick-card]").click();
  await expect(page.locator("#detailTitle")).toHaveText("Pikachu");
  await expect(page.locator(".detail-meta")).toContainText("Reverse Holofoil");
  await expect(page.locator("#detailContent .owned-banner")).toHaveCount(0);
  await expect(page.locator("#addLibraryButton")).toBeVisible();
});

test("queued cards advance directly to the next confirmation and failed saves retain their place", async ({
  page,
}) => {
  const requests = await setup(page, { failAttempt: 2 });
  const cards = [
    card("Pikachu", 58),
    card("Bulbasaur", 44),
    card("Charmander", 46),
  ];
  await page.evaluate(
    async ({ appUrl, cards }) => {
      const { queueIntakeCard, openBatchIntakeSheet } = await import(appUrl);
      cards.forEach(queueIntakeCard);
      openBatchIntakeSheet();
    },
    { appUrl, cards },
  );
  await page.locator("#reviewNextIntake").click();
  await expect(page.locator(".sheet-heading")).toContainText("Pikachu");
  await saveUnknownCost(page);
  await expect(page.locator(".sheet-heading")).toContainText("Bulbasaur");
  await expect(page.locator("#reviewNextIntake")).toHaveCount(0);
  await expect(page.locator("#positionForm")).toBeVisible();
  await saveUnknownCost(page);
  await expect(page.locator("#queueRetrySave")).toBeVisible();
  await expect(page.locator(".sheet-heading")).toContainText("Bulbasaur");
  await expect(page.locator("#sheetContent")).toContainText("Purchase cost not recorded");
  await expect(page.locator("#sheetContent")).not.toContainText(
    "private-collection-diagnostic",
  );
  expect(
    await page.evaluate(
      async (url) =>
        (await import(url)).state.intakeQueue.map((entry) => entry.card.name),
      appUrl,
    ),
  ).toEqual(["Bulbasaur", "Charmander"]);
  await page.locator("#queueRetrySave").click();
  await expect(page.locator(".sheet-heading")).toContainText("Charmander");
  await expect(page.locator("#reviewNextIntake")).toHaveCount(0);
  expect(requests[1].p_idempotency_key).toBe(requests[2].p_idempotency_key);
  await saveUnknownCost(page);
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect.poll(() => requests.length).toBe(4);
  expect(requests.map((request) => request.p_identity.name)).toEqual([
    "Pikachu",
    "Bulbasaur",
    "Bulbasaur",
    "Charmander",
  ]);
  // The sheet closes when the write succeeds; queue removal follows the
  // collection refresh. Wait for that completion instead of sampling mid-save.
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.intakeQueue.length,
        appUrl,
      ),
    )
    .toBe(0);
  await expect(page.locator("#intakeQueueBar")).toBeHidden();
  await expect(page.locator("#view-scan")).toBeVisible();
});

test("changing accounts clears the prior intake queue and dismisses its unfinished confirmation", async ({
  page,
}) => {
  const requests = await setup(page);
  await page.evaluate(
    async ({ appUrl, cards }) => {
      const { queueIntakeCard, openBatchIntakeSheet } = await import(appUrl);
      cards.forEach(queueIntakeCard);
      openBatchIntakeSheet();
    },
    { appUrl, cards: [card("Pikachu", 58), card("Bulbasaur", 44)] },
  );
  await page.locator("#reviewNextIntake").click();
  await page.locator("#positionMoreSummary").click();
  await page.locator("#positionTotalCost").fill("27.50");
  await page.evaluate(
    async ({ appUrl, ownerB }) => {
      const { applySession } = await import(appUrl);
      // Account-loading fixtures return no records; this test checks the real
      // synchronous owner boundary, not successful authentication or hydration.
      await applySession({
        user: { id: ownerB, email: "fixture@example.test" },
      });
    },
    { appUrl, ownerB },
  );
  await expect(page.locator("#positionForm")).toHaveCount(0);
  await expect(page.locator("#bottomSheet")).toBeHidden();
  const state = await page.evaluate(async (url) => {
    const { state } = await import(url);
    return {
      owner: state.session?.user?.id,
      queued: state.intakeQueue.length,
      pending: state.pendingCardAdd,
    };
  }, appUrl);
  expect(state).toEqual({ owner: ownerB, queued: 0, pending: null });
  expect(requests).toHaveLength(0);
});

test("mobile intake keeps identity readable and quantity directly editable", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"));
  const requests = await setup(page);
  await page.route("**/api/catalog?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cards: Array.from({ length: 12 }, (_, index) =>
          card("Pikachu", index + 1),
        ),
      }),
    }),
  );
  await page.locator("#quickCardSearch").fill("Pikachu");
  await expect(page.locator("[data-add-search-card]")).toHaveCount(12);
  for (const [width, height] of [
    [320, 568],
    [360, 780],
    [375, 667],
    [390, 844],
    [430, 932],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: testInfo.outputPath(`intake-${width}.png`) });
    const metrics = await page.evaluate(() => {
      const bounds = (selector) =>
        document.querySelector(selector).getBoundingClientRect().toJSON();
      return {
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        camera: bounds("#autoCaptureButton"),
        mode: bounds("#softwareModeSelect"),
        language: bounds("#quickSearchLanguage"),
        results: bounds("#quickSearchResults"),
        text: bounds(".quick-card-result > span"),
        action: bounds("[data-add-search-card]"),
        fontSize: parseFloat(
          getComputedStyle(document.querySelector("#quickCardSearch")).fontSize,
        ),
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
    expect(metrics.camera.y + metrics.camera.height).toBeLessThan(
      metrics.results.y,
    );
    expect(metrics.text.width).toBeGreaterThan(150);
    expect(metrics.action.height).toBeGreaterThanOrEqual(44);
    expect(metrics.mode.height).toBeGreaterThanOrEqual(44);
    expect(metrics.language.height).toBeGreaterThanOrEqual(44);
    expect(metrics.fontSize).toBeGreaterThanOrEqual(16);
  }
  await page.locator("[data-add-search-card]").first().click();
  await expect(page.locator("#positionQuantity")).toBeVisible();
  await page.locator("#positionQuantity").fill("3");
  await page.locator("#positionMoreSummary").click();
  await page.locator("#positionTotalCost").fill("12");
  await expect(page.locator("#positionCostSummary")).toContainText("3 cards");
  await page.screenshot({ path: testInfo.outputPath("intake-quantity.png") });
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(Number(requests[0].p_quantity)).toBe(3);
});

test("printing choices retain the selected version and quantity after a failed add", async ({
  page,
}, testInfo) => {
  const requests = await setup(page, { failAttempt: 1 });
  await page.evaluate(async (url) => {
    const { openPositionSheet } = await import(url);
    openPositionSheet({
      id: "tcgdex:en:base1-58",
      name: "Pikachu",
      set: "Base Set",
      number: "58/102",
      language: "en",
      variantId: "normal-version",
      variant: "Normal",
      variantOptions: [
        { id: "normal-version", finish: "normal", edition: "", language: "en" },
        {
          id: "reverse-version",
          finish: "reverse holofoil",
          edition: "",
          language: "en",
        },
      ],
    });
  }, appUrl);
  const normal = page.locator(
    'input[name="variantChoice"][value="normal-version"]',
  );
  const reverse = page.getByRole("radio", {
    name: /^Reverse Holofoil/,
  });
  await expect(normal).toBeChecked();
  await normal.focus();
  await page.keyboard.press("ArrowRight");
  await expect(reverse).toBeChecked();
  if (testInfo.project.name.startsWith("mobile-")) {
    await page.locator("#positionMoreSummary").click();
    for (const selector of ["#positionState", "#positionAcquisitionMethod"]) {
      expect(
        (await page.locator(selector).boundingBox()).height,
      ).toBeGreaterThanOrEqual(44);
    }
  }
  await page.screenshot({ path: testInfo.outputPath("printing-choices.png") });
  await expect(page.locator("#positionVariantId")).toHaveValue(
    "reverse-version",
  );
  await page.locator("#positionQuantity").fill("2");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(page.locator("#positionError")).not.toBeEmpty();
  await expect(reverse).toBeChecked();
  await expect(page.locator("#positionQuantity")).toHaveValue("2");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(page.locator("#bottomSheet")).toBeHidden();
  expect(requests).toHaveLength(2);
  expect(requests[1].p_identity.variantId).toBe("reverse-version");
  expect(requests[1].p_quantity).toBe(2);
  expect(requests[1].p_idempotency_key).toBe(requests[0].p_idempotency_key);
});
