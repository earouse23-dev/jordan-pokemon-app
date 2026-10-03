import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

let source = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
// Optional read-only baseline: swap only the two audited functions in the test bundle.
if (process.env.MICA_SEARCH_BASELINE_FILE) {
  const before = readFileSync(process.env.MICA_SEARCH_BASELINE_FILE, "utf8");
  for (const [start, end] of [
    ["function openManualSearch()", "\nfunction openInfo("],
    ["function bindQuickCardSearch()", "\nfunction approvedImageProxyPath("],
  ]) {
    const oldStart = before.indexOf(start);
    const oldEnd = before.indexOf(end, oldStart);
    const currentStart = source.indexOf(start);
    const currentEnd = source.indexOf(end, currentStart);
    source =
      source.slice(0, currentStart) +
      before.slice(oldStart, oldEnd) +
      source.slice(currentEnd);
  }
}
const bundled = await build({
  stdin: {
    contents: `${source}\nexport { state, bindEvents, bindQuickCardSearch, openManualSearch, closeSheet, rememberCatalogItems };`,
    resolveDir: process.cwd(),
    sourcefile: "app.js",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
});
const card = (name, language = "en") => ({
  id: `${language}:${name}`,
  name,
  language,
  set: "Test Set",
  number: "25/100",
  variant: "Normal",
  variants: ["Normal"],
  thumb: "/icons/icon.svg",
});

async function setup(page) {
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "globalThis.__APP_CONFIG__ = {};",
    }),
  );
  await page.route("**/app.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: bundled.outputFiles[0].text,
    }),
  );
  await page.goto("/");
  await page.evaluate(async () => {
    document.body.classList.add("authenticated");
    document.querySelector("#authGate").hidden = true;
    document.querySelector("#appShell").removeAttribute("aria-hidden");
    document.querySelectorAll(".view").forEach((view) => {
      view.hidden = view.id !== "view-scan";
      view.classList.toggle("active", view.id === "view-scan");
    });
    const app = await import("/app.js?v=111");
    app.state.route = "scan";
    app.state.sidebarTarget = "add";
    app.bindEvents();
  });
}
const fulfillCards = (route, cards) =>
  route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ cards }),
  });

test("same-name English and Japanese close finishes open the exact clicked profile", async ({
  page,
}) => {
  const pair = {
    en: {
      ...card("Pikachu", "en"),
      id: "tcgdex:en:test-25",
      catalogIdentityId: "tcgdex:en:test-25",
      cardId: "11111111-1111-4111-8111-111111111111",
      collectibleId: "22222222-2222-4222-8222-222222222222",
      variantId: "22222222-2222-4222-8222-222222222222",
      variant: "Reverse Holo",
      finish: "reverse_holofoil",
      edition: "unknown",
      promoType: "unknown",
      identityStatus: "needs_review",
      variantOptions: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          collectibleId: "22222222-2222-4222-8222-222222222222",
          label: "Reverse Holo",
          finish: "reverse_holofoil",
          edition: "unknown",
          promoType: "unknown",
          language: "en",
          status: "needs_review",
        },
      ],
    },
    ja: {
      ...card("Pikachu", "ja"),
      id: "tcgdex:ja:test-25",
      catalogIdentityId: "tcgdex:ja:test-25",
      cardId: "33333333-3333-4333-8333-333333333333",
      collectibleId: "44444444-4444-4444-8444-444444444444",
      variantId: "44444444-4444-4444-8444-444444444444",
      variant: "Holofoil",
      finish: "holofoil",
      edition: "unknown",
      promoType: "unknown",
      identityStatus: "needs_review",
      variantOptions: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          collectibleId: "44444444-4444-4444-8444-444444444444",
          label: "Holofoil",
          finish: "holofoil",
          edition: "unknown",
          promoType: "unknown",
          language: "ja",
          status: "needs_review",
        },
      ],
    },
  };
  await page.route("**/api/catalog?**", (route) => {
    const language = new URL(route.request().url()).searchParams.get(
      "language",
    );
    return fulfillCards(route, [pair[language]]);
  });
  await page.route("**/api/cards?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ cards: [] }),
    }),
  );
  await setup(page);

  for (const language of ["en", "ja"]) {
    const selected = pair[language];
    await page.locator("#quickSearchLanguage").selectOption(language);
    await page.locator("#quickCardSearch").fill("Pikachu 25/100");
    await page.locator("#quickCardSearch").press("Enter");
    await page.locator("#quickSearchResults [data-quick-card]").click();
    await expect(page.locator("#detailTitle")).toHaveText("Pikachu");
    await expect(page.locator(".detail-meta")).toContainText(
      language === "en" ? "English" : "Japanese",
    );
    await expect(page.locator(".detail-meta")).toContainText(selected.variant);
    expect(
      await page.evaluate(async (appUrl) => {
        const { state } = await import(appUrl);
        return {
          id: state.detailCard.id,
          variantId: state.detailCard.variantId,
          language: state.detailCard.language,
          finish: state.detailCard.finish,
        };
      }, "/app.js?v=111"),
    ).toEqual({
      id: selected.id,
      variantId: selected.variantId,
      language,
      finish: selected.finish,
    });

    await page.locator("#addLibraryButton").click();
    await expect(page.locator("#positionVariantId")).toHaveValue(
      selected.variantId,
    );
    await expect(page.locator("#positionCondition")).toHaveValue("unknown");
    await page.locator("#positionCancel").click();
    await page.locator("#watchCardButton").click();
    await expect(
      page.locator('#watchlistForm input[name="variant"]'),
    ).toHaveValue(selected.variant);
    await expect(page.locator("#watchCondition")).toHaveValue("unknown");
    await page.locator("#watchCancel").click();
    await page.locator("#detailBack").click();
    await expect(page.locator("#view-scan")).toBeVisible();
    await expect(page.locator("#quickCardSearch")).toHaveValue(
      "Pikachu 25/100",
    );
    await expect(page.locator("#quickSearchLanguage")).toHaveValue(language);
  }
});

for (const action of ["view", "add", "queue", "manual"]) {
  test(`${action} uses the displayed card after a shared-ID cache replacement`, async ({
    page,
  }) => {
    const original = { ...card("Pikachu English"), id: "shared-card-id" };
    await page.route("**/api/catalog?**", (route) =>
      fulfillCards(route, [original]),
    );
    await page.route("**/api/cards?**", (route) =>
      route.fulfill({ contentType: "application/json", body: "{}" }),
    );
    await setup(page);
    if (action === "manual")
      await page.evaluate(async () =>
        (await import("/app.js?v=111")).openManualSearch(),
      );
    const input = page.locator(
      action === "manual" ? "#catalogQuery" : "#quickCardSearch",
    );
    const results = page.locator(
      action === "manual" ? "#manualResults" : "#quickSearchResults",
    );
    await input.fill("Pikachu");
    await input.press("Enter");
    await expect(results).toContainText("Pikachu English");
    await page.evaluate(
      async (replacement) => {
        (await import("/app.js?v=111")).rememberCatalogItems([replacement]);
      },
      { ...original, name: "Pikachu Japanese", language: "ja" },
    );
    const selector = {
      view: "[data-quick-card]",
      add: "[data-add-search-card]",
      queue: "[data-queue-search-card]",
      manual: "[data-catalog-id]",
    }[action];
    await results.locator(selector).click();
    if (action === "add") {
      await expect(page.locator("#sheetContent")).toContainText(
        "Pikachu English",
      );
      await expect(page.locator("#sheetContent")).not.toContainText(
        "Pikachu Japanese",
      );
    } else {
      const chosen = await page.evaluate(async (action) => {
        const { state } = await import("/app.js?v=111");
        const item =
          action === "queue" ? state.intakeQueue[0].card : state.detailCard;
        return { name: item.name, language: item.language };
      }, action);
      expect(chosen).toEqual({ name: "Pikachu English", language: "en" });
    }
  });
}

for (const surface of ["quick", "manual"]) {
  test(`${surface} set filter preserves keyboard focus and next result order`, async ({
    page,
    browserName,
  }) => {
    const cards = Array.from({ length: 6 }, (_, index) => ({
      ...card(`Pikachu ${index}`),
      set: index < 3 ? "First Set" : "Second Set",
    }));
    await page.route("**/api/catalog?**", (route) => {
      const set = new URL(route.request().url()).searchParams.get("set");
      return fulfillCards(
        route,
        set ? cards.filter((card) => card.set === set) : cards,
      );
    });
    await setup(page);
    if (surface === "manual")
      await page.evaluate(async () =>
        (await import("/app.js?v=111")).openManualSearch(),
      );
    const input = page.locator(
      surface === "quick" ? "#quickCardSearch" : "#catalogQuery",
    );
    const results = page.locator(
      surface === "quick" ? "#quickSearchResults" : "#manualResults",
    );
    await input.fill("Pikachu");
    await input.press("Enter");
    const filter = results.getByRole("button", {
      name: "Second Set",
      exact: true,
    });
    await filter.focus();
    await filter.press("Enter");
    await expect(filter).toBeFocused();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press(browserName === "webkit" ? "Alt+Tab" : "Tab");
    await expect(
      results
        .locator(
          surface === "quick" ? "[data-quick-card]" : "[data-catalog-id]",
        )
        .first(),
    ).toBeFocused();
    if (surface === "quick") {
      const queue = results.locator("[data-queue-search-card]").nth(1);
      await queue.focus();
      await page.evaluate(() =>
        document.dispatchEvent(new Event("mica:collection-updated")),
      );
      await expect(queue).toBeFocused();
      await expect(results.locator("[data-add-search-card]")).toHaveCount(3);
    }
  });

  test(`${surface} stalled search times out and retries with retained context`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/api/catalog?**", async (route) => {
      requests++;
      if (requests > 1) await fulfillCards(route, [card("Pikachu", "ja")]);
    });
    await setup(page);
    if (surface === "manual")
      await page.evaluate(async () =>
        (await import("/app.js?v=111")).openManualSearch(),
      );
    const input = page.locator(
      surface === "quick" ? "#quickCardSearch" : "#catalogQuery",
    );
    const language = page.locator(
      surface === "quick" ? "#quickSearchLanguage" : "#catalogLanguage",
    );
    const results = page.locator(
      surface === "quick" ? "#quickSearchResults" : "#manualResults",
    );
    await language.selectOption("ja");
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
    await input.fill("Pikachu");
    await input.press("Enter");
    await expect.poll(() => requests).toBe(1);
    await expect(results).toHaveAttribute("aria-busy", "true");
    await page.clock.runFor(12001);
    await expect(results).toHaveAttribute("aria-busy", "false");
    await expect(input).toHaveValue("Pikachu");
    await expect(language).toHaveValue("ja");
    await results.getByRole("button", { name: "Try again" }).click();
    await expect(results).toContainText("Pikachu");
    await expect(results).toHaveAttribute("aria-busy", "false");
    expect(requests).toBe(2);
  });

  test(`${surface} search invalidates immediately and clears busy on empty`, async ({
    page,
  }) => {
    const pending = [];
    await page.route("**/api/catalog?**", (route) => {
      pending.push(route);
    });
    await setup(page);
    if (surface === "manual")
      await page.evaluate(async () =>
        (await import("/app.js?v=111")).openManualSearch(),
      );
    // Use a deterministic future pause point relative to the installed clock.
    // Sampling the host's current time can be behind the browser by the time
    // pauseAt reaches it when the full suite is running concurrently.
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
    const input = page.locator(
      surface === "quick" ? "#quickCardSearch" : "#catalogQuery",
    );
    const results = page.locator(
      surface === "quick" ? "#quickSearchResults" : "#manualResults",
    );
    await input.fill("Pikachu");
    await page.clock.runFor(300);
    await expect.poll(() => pending.length).toBe(1);
    await input.fill("Eevee");
    await fulfillCards(pending[0], [card("Pikachu")]);
    await page.waitForTimeout(50);
    await expect(results).not.toContainText("Pikachu");
    await expect(results).toHaveAttribute("aria-busy", "true");
    await input.fill("");
    await expect(results).toHaveAttribute("aria-busy", "false");
    await page.clock.runFor(300);
    expect(pending).toHaveLength(1);
  });

  test(`${surface} search retries the same query and language with Enter immediately`, async ({
    page,
  }) => {
    const requests = [];
    await page.route("**/api/catalog?**", async (route) => {
      requests.push(new URL(route.request().url()));
      if (requests.length === 1)
        await route.fulfill({ status: 503, body: "internal failure" });
      else await fulfillCards(route, [card("ピカチュウ", "ja")]);
    });
    await setup(page);
    if (surface === "manual")
      await page.evaluate(async () =>
        (await import("/app.js?v=111")).openManualSearch(),
      );
    const input = page.locator(
      surface === "quick" ? "#quickCardSearch" : "#catalogQuery",
    );
    const language = page.locator(
      surface === "quick" ? "#quickSearchLanguage" : "#catalogLanguage",
    );
    const results = page.locator(
      surface === "quick" ? "#quickSearchResults" : "#manualResults",
    );
    await language.selectOption("ja");
    // Use a deterministic future pause point relative to the installed clock.
    // Sampling the host's current time can be behind the browser by the time
    // pauseAt reaches it when the full suite is running concurrently.
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-02T00:00:00Z"));
    await input.fill("ピカチュウ");
    await input.press("Enter");
    await expect(
      results.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    await expect(input).toHaveValue("ピカチュウ");
    await expect(language).toHaveValue("ja");
    await results.getByRole("button", { name: "Try again" }).click();
    await expect(results).toContainText("ピカチュウ");
    await expect(results).not.toContainText("internal failure");
    await page.clock.runFor(300);
    expect(requests).toHaveLength(2);
    expect(
      requests.map((url) => [
        url.searchParams.get("q"),
        url.searchParams.get("language"),
      ]),
    ).toEqual([
      ["ピカチュウ", "ja"],
      ["ピカチュウ", "ja"],
    ]);
  });
}

test("cached search results stay in the selected language and disclose their source", async ({
  page,
}) => {
  await page.route("**/api/catalog?**", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await setup(page);
  await page.evaluate(
    async (cards) =>
      (await import("/app.js?v=111")).rememberCatalogItems(cards),
    [
      card("Pikachu English", "en"),
      card("Pikachu Japanese", "ja"),
      { ...card("Pikachu Unknown"), language: undefined },
    ],
  );
  await page.locator("#quickSearchLanguage").selectOption("ja");
  await page.locator("#quickCardSearch").fill("Pikachu");
  await page.locator("#quickCardSearch").press("Enter");
  const results = page.locator("#quickSearchResults");
  await expect(results).toContainText("Previously loaded cards");
  await expect(results).toContainText("Pikachu Japanese");
  await expect(results).not.toContainText("Pikachu English");
  await expect(results).not.toContainText("Pikachu Unknown");
  await expect(results.locator("[data-add-search-card]")).toHaveCount(1);
});

test("a replaced manual search ignores its late response", async ({ page }) => {
  let pending;
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/catalog?**", (route) => {
    pending = route;
  });
  await setup(page);
  await page.evaluate(async () =>
    (await import("/app.js?v=111")).openManualSearch(),
  );
  await page.locator("#catalogQuery").fill("Pikachu");
  await page.locator("#catalogQuery").press("Enter");
  await expect.poll(() => Boolean(pending)).toBe(true);
  await page.evaluate(async () => {
    const app = await import("/app.js?v=111");
    app.closeSheet({ discardHistory: true });
    app.openPositionSheet({
      name: "Eevee",
      set: "Test",
      number: "1/100",
      language: "en",
      variant: "Normal",
    });
  });
  await fulfillCards(pending, [card("Pikachu")]);
  await page.waitForTimeout(50);
  await expect(page.locator("#positionForm")).toBeVisible();
  await expect(page.locator("#sheetContent")).not.toContainText("Pikachu");
  expect(errors).toEqual([]);
});

test("collection refresh keeps the selected search set and active input", async ({
  page,
}) => {
  const cards = Array.from({ length: 6 }, (_, index) => ({
    ...card(`Pikachu ${index}`),
    set: index < 3 ? "First Set" : "Second Set",
  }));
  await page.route("**/api/catalog?**", (route) => {
    const set = new URL(route.request().url()).searchParams.get("set");
    return fulfillCards(
      route,
      set ? cards.filter((card) => card.set === set) : cards,
    );
  });
  await setup(page);
  const input = page.locator("#quickCardSearch");
  await input.fill("Pikachu");
  await input.press("Enter");
  const results = page.locator("#quickSearchResults");
  await results.locator('[data-result-set="Second Set"]').click();
  await input.focus();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("mica:collection-updated")),
  );
  await expect(
    results.locator('[data-result-set="Second Set"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(results.locator("[data-add-search-card]")).toHaveCount(3);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Pikachu");
  await expect(page.locator(".search-examples")).toBeHidden();
  await input.fill("");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("mica:collection-updated")),
  );
  await expect(results.locator("[data-add-search-card]")).toHaveCount(0);
  await expect(page.locator(".search-examples")).toBeVisible();
});

test("manual search starts with the current query and printed language", async ({
  page,
}) => {
  const requests = [];
  await page.route("**/api/catalog?**", (route) => {
    requests.push(new URL(route.request().url()));
    return fulfillCards(route, [card("Pikachu", "ja")]);
  });
  await setup(page);
  await page.locator("#quickSearchLanguage").selectOption("ja");
  await page.locator("#quickCardSearch").fill("Pikachu");
  await page.locator("#quickCardSearch").press("Enter");
  await expect(page.locator("#quickSearchResults")).toContainText("Pikachu");
  await page.evaluate(async () =>
    (await import("/app.js?v=111")).openManualSearch(),
  );
  await expect(page.locator("#catalogQuery")).toHaveValue("Pikachu");
  await expect(page.locator("#catalogLanguage")).toHaveValue("ja");
  await expect(page.locator("#manualResults")).toContainText("Pikachu");
  expect(requests.at(-1).searchParams.get("language")).toBe("ja");
});

for (const mode of ["quick", "manual"]) {
  test(`${mode} search loads further pages without dropping results on failure`, async ({
    page,
  }) => {
    let attempts = 0;
    await page.route("**/api/catalog?**", (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("cursor")) {
        attempts += 1;
        if (attempts === 1) return route.fulfill({ status: 502, body: "{}" });
        return route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            cards: [card("Second page")],
            nextCursor: null,
          }),
        });
      }
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          cards: [card("First page")],
          nextCursor: "cursor-2",
          hasMore: true,
        }),
      });
    });
    await setup(page);
    if (mode === "manual")
      await page.evaluate(async () =>
        (await import("/app.js?v=111")).openManualSearch(),
      );
    const input = page.locator(
      mode === "quick" ? "#quickCardSearch" : "#catalogQuery",
    );
    const root = page.locator(
      mode === "quick" ? "#quickSearchResults" : "#manualResults",
    );
    await input.fill("Pikachu");
    await input.press("Enter");
    await expect(root).toContainText("First page");
    await root.locator("[data-catalog-more]").click();
    await expect(root.locator("[data-catalog-more]")).toBeEnabled();
    await expect(root).toContainText("First page");
    await root.locator("[data-catalog-more]").click();
    await expect(root).toContainText("Second page");
    await expect(root).toContainText("First page");
    await expect(root.locator("[data-catalog-more]")).toHaveCount(0);
  });
}

test("public card search works before sign-in and preserves the selected card", async ({
  page,
}) => {
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "globalThis.__APP_CONFIG__ = {};",
    }),
  );
  await page.route("**/app.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: bundled.outputFiles[0].text,
    }),
  );
  await page.route("**/api/catalog?**", (route) =>
    fulfillCards(route, [card("Pikachu")]),
  );
  await page.goto("/");
  await page.locator("#tryCardSearch").click();
  await page.locator("#publicCatalogQuery").fill("Pikachu");
  await page
    .locator("#publicCatalogForm")
    .getByRole("button", { name: "Search cards" })
    .click();
  await expect(page.locator("#publicCatalogResults")).toContainText("Pikachu");
  await expect(page.locator("#appShell")).toBeHidden();
  await page.locator("[data-public-save]").click();
  await expect(page.locator("#passwordAuthForm")).toBeVisible();
  await expect(page.locator("#authMessage")).toContainText("Pikachu");
  expect(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem("mica:public-card")).card.name,
    ),
  ).toBe("Pikachu");
});
