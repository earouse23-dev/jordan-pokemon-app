import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
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
      contents: `${source}\nexport { state, renderDetail, chartInstance, supabase as testSupabase };`,
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
        finish: "holofoil",
        edition: "unlimited",
        promoType: "none",
        identityStatus: "exact",
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

for (const surface of ["sold", "psa"]) {
  test(`${surface} stalled evidence request returns to retry with the same printing`, async ({
    page,
  }) => {
    const requests = [];
    await page.route("**/api/sales?*", async (route) => {
      requests.push(
        JSON.parse(new URL(route.request().url()).searchParams.get("lookup")),
      );
      if (requests.length > 1)
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({ sales: [] }),
        });
    });
    await openDetail(page);
    await page.locator('[data-detail-tool="prices"] > summary').click();
    await page.clock.install({ time: new Date("2026-09-06T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-09-07T12:00:00Z"));
    if (surface === "sold")
      await page.locator("#marketProofDetails > summary").click();
    else {
      await page.locator('[data-detail-tool="grade-prices"] > summary').click();
      await page.locator('[data-psa-price="10"]').click();
    }
    await expect.poll(() => requests.length).toBe(1);
    await page.clock.runFor(15001);
    const retry =
      surface === "sold"
        ? page.getByRole("button", { name: "Try sales again" })
        : page.getByRole("button", {
            name: "Try again for PSA 10",
            exact: true,
          });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(requests[1]).toMatchObject({
      variant: "Holofoil",
      language: "en",
      grader: surface === "psa" ? "PSA" : "",
    });
    if (surface === "psa")
      await expect(page.locator('[data-psa-price="10"]')).toHaveAttribute(
        "aria-disabled",
        "false",
      );
    else
      await expect(page.locator("#marketProofDetails")).toHaveAttribute(
        "open",
        "",
      );
  });
}

test("consecutive daily prices retain their connecting trend line", async ({
  page,
}) => {
  await openDetail(page, {
    priceHistory: [2, 1].map((days) => ({
      recordedAt: new Date(Date.now() - days * 86400000).toISOString(),
      amount: days * 10,
      provider: "tcgplayer",
      finish: "holofoil",
      currency: "USD",
      condition: "Near Mint",
    })),
  });
  await page.locator('[data-detail-tool="prices"] > summary').click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { chartInstance } = await import("/app.js?v=111");
        return chartInstance
          ?.getDatasetMeta(0)
          .dataset.segments.map(({ start, end }) => ({ start, end }));
      }),
    )
    .toEqual([{ start: 0, end: 1 }]);
});

test("dated chart uses elapsed time and range-consistent values, including empty recovery", async ({
  page,
}) => {
  const now = Date.now();
  const point = (days, amount) => ({
    recordedAt: new Date(now - days * 86400000).toISOString(),
    amount,
    finish: "holofoil",
    currency: "USD",
    condition: "Near Mint",
    provider: "tcgplayer",
  });
  await openDetail(page, {
    priceHistory: [point(60, 10), point(6, 30), point(2, 50)],
    historyStatus: "partial",
  });
  await page.locator('[data-detail-tool="prices"] > summary').click();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => Boolean((await import(url)).chartInstance),
        appUrl,
      ),
    )
    .toBe(true);
  await expect(page.locator("#cardPriceHistory")).toContainText(
    "Some historical prices could not be loaded",
  );
  const plot = await page.evaluate(async (url) => {
    const { chartInstance: c } = await import(url);
    return {
      type: c.options.scales.x.type,
      points: c.data.datasets[0].data.map((p) => p.x),
      pixels: c.getDatasetMeta(0).data.map((p) => p.x),
      segments: c
        .getDatasetMeta(0)
        .dataset.segments.map(({ start, end }) => ({ start, end })),
    };
  }, appUrl);
  expect(plot.type).toBe("linear");
  expect(plot.segments.every(({ start, end }) => start === end)).toBe(true);
  await expect(page.locator("#cardPriceHistory")).toContainText(
    "Lines leave gaps longer than two days",
  );
  expect(plot.points.every(Number.isFinite)).toBe(true);
  expect(
    (plot.pixels[1] - plot.pixels[0]) / (plot.pixels[2] - plot.pixels[1]),
  ).toBeCloseTo(54 / 4, 1);
  await page.getByRole("button", { name: "1 week", exact: true }).click();
  await expect(page.locator(".history-summary")).toContainText("$40.00");
  await expect(
    page.getByRole("button", { name: "1 week", exact: true }),
  ).toBeFocused();
  await page.locator(".history-values > summary").click();
  await expect(page.locator(".history-values tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "1 day", exact: true }).click();
  await expect(page.locator("#cardPriceHistory")).toContainText(
    "No matching prices recorded in this range",
  );
  await page
    .getByRole("button", { name: "All available history", exact: true })
    .click();
  await expect(page.locator("#positionChart")).toBeVisible();
  await assertFits(page);
  await page
    .locator("[data-detail-tool=prices]")
    .screenshot({ path: `/tmp/mica-prices-${page.viewportSize().width}.png` });
});

test("sold evidence loads on demand, retains printing context and retries without losing disclosure", async ({
  page,
}) => {
  const lookups = [];
  await page.route("**/api/sales?*", async (route) => {
    lookups.push(
      JSON.parse(new URL(route.request().url()).searchParams.get("lookup")),
    );
    await route.fulfill({
      status: lookups.length === 1 ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        sales: [
          {
            title: "Charizard holo sold",
            amount: 125,
            currency: "USD",
            soldAt: "2026-09-01",
            sourceUrl: "https://www.ebay.com/itm/123456789012",
            printing: "Holofoil",
            attribution: "exact",
            language: "English",
            gradingCompany: null,
            grade: null,
          },
        ],
      }),
    });
  });
  await openDetail(page);
  expect(lookups).toHaveLength(0);
  await page.locator('[data-detail-tool="prices"] > summary').click();
  await page.locator("#marketProofDetails > summary").click();
  await expect(
    page.getByRole("button", { name: "Try sales again" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try sales again" }).click();
  await expect(page.locator(".sale-row")).toHaveCount(1);
  await expect(page.locator(".sale-row")).toContainText(
    "condition not reported",
  );
  expect(lookups).toHaveLength(2);
  expect(lookups[0]).toMatchObject({
    variant: "Holofoil",
    grader: "",
    grade: "",
  });
  await expect(page.locator("#marketProofDetails")).toHaveAttribute("open", "");
  await assertFits(page);
});

test("card detail links only validated marketplace sources and the latest matching eBay sale", async ({ page }, testInfo) => {
  await page.route("**/api/sales?*", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ sales: [
      { title: "Synthetic older sale", amount: 100, currency: "USD", soldAt: "2026-09-20", sourceUrl: "https://www.ebay.com/itm/123456789010", source: "ebay", printing: "Holofoil", attribution: "exact", language: "English" },
      { title: "Synthetic latest sale", amount: 110, currency: "USD", soldAt: "2026-09-21", sourceUrl: "https://www.ebay.com/itm/123456789011", source: "ebay", printing: "Holofoil", attribution: "exact", language: "English" },
      { title: "Wrong language", amount: 999, currency: "EUR", soldAt: "2026-09-22", sourceUrl: "https://www.ebay.com/itm/123456789012", source: "ebay", printing: "Holofoil", attribution: "exact", language: "German" },
    ] }),
  }));
  await openDetail(page, { pricingStatus: "live", price: 125, quotes: [{
    provider: "tcgplayer", aggregator: "pokemon_tcg_api", market: "tcgplayer", currency: "USD", finish: "holofoil", priceType: "market", amount: 125,
    observedAt: "2026-09-28T12:00:00Z", retrievedAt: "2026-09-29T12:00:00Z", providerUrl: "https://www.tcgplayer.com/product/12345/synthetic", attribution: "TCGplayer reference price",
  }] });
  await page.locator('[data-detail-tool="prices"] > summary').click();
  await expect(page.getByRole("link", { name: "TCGplayer market source" })).toHaveAttribute("href", "https://www.tcgplayer.com/product/12345/synthetic");
  await page.context().route("https://www.tcgplayer.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>Synthetic external page</title>" }));
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "TCGplayer market source" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL("https://www.tcgplayer.com/product/12345/synthetic");
  await popup.close();
  await expect(page.locator("#detailTitle")).toHaveText("Charizard");
  await page.getByRole("button", { name: "View recent eBay sales" }).click();
  await expect(page.locator('[data-detail-tool="prices"]')).toHaveAttribute("open", "");
  await expect(page.locator("#marketProofDetails")).toHaveAttribute("open", "");
  await expect(page.locator("#marketProofDetails > summary")).toBeFocused();
  await expect(page.getByRole("link", { name: /View last eBay sale/ })).toHaveAttribute("href", "https://www.ebay.com/itm/123456789011");
  await expect(page.locator(".sale-row")).toHaveCount(2);
  await expect(page.locator(".sales-list")).not.toContainText("Wrong language");
  await expect(page.getByRole("link", { name: /View last eBay sale/ })).toHaveAttribute("rel", "noopener noreferrer");
  if (process.env.MICA_CLIENT_07D_CAPTURE) {
    const dir = fileURLToPath(new URL("../../docs/evidence/sol-client-07d/", import.meta.url));
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/market-links-${testInfo.project.name}.png`, fullPage: true });
  }
});

test("sold response survives a price refresh replacing the card object", async ({
  page,
}) => {
  let complete;
  const pending = new Promise((resolve) => {
    complete = resolve;
  });
  await page.route("**/api/sales?*", async (route) => {
    await pending;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        sales: [
          {
            title: "Returned sale evidence",
            amount: 99,
            currency: "USD",
            soldAt: "2026-09-01",
            sourceUrl: "https://www.ebay.com/itm/123456789012",
            printing: "Holofoil",
            attribution: "exact",
            language: "English",
          },
        ],
      }),
    });
  });
  await openDetail(page);
  await page.locator('[data-detail-tool="prices"] > summary').click();
  await page.locator("#marketProofDetails > summary").click();
  await expect(page.locator("#marketProofDetails")).toContainText(
    "Checking recent sold listings",
  );
  await page.evaluate(async (url) => {
    const { state, renderDetail } = await import(url);
    state.items = state.items.map((item) => ({ ...item, price: 100 }));
    renderDetail();
  }, appUrl);
  complete();
  await expect(page.locator(".sale-row")).toContainText(
    "Returned sale evidence",
  );
});

test("PSA comparison keeps grades separate and exposes the dated source evidence", async ({
  page,
}) => {
  const requests = [];
  await page.route("**/api/sales?*", async (route) => {
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    requests.push(lookup);
    await route.fulfill({
      status:
        requests.filter((row) => row.grade === "10").length > 1 ? 502 : 200,
      contentType: "application/json",
      body: JSON.stringify({
        validatedContext: {
          ...lookup,
          providerCardId: "fixture-card",
          canonicalValidated: true,
          completedSaleValidated: true,
        },
        retrievedAt: "2026-09-24T00:00:00Z",
        sales:
          lookup.grade === "10"
            ? [240, 250, 260].map((amount, index) => ({
                provider: "fixture",
                providerSaleId: String(123456789012 + index),
                source: "ebay",
                gradingCompany: "PSA",
                grade: "10",
                attribution: "exact",
                printing: "Holofoil",
                amount,
                currency: "USD",
                soldAt: "2026-09-01",
                sourceUrl: `https://www.ebay.com/itm/${123456789012 + index}`,
              }))
            : [],
      }),
    });
  });
  await openDetail(page);
  await page.locator('[data-detail-tool="prices"] > summary').click();
  await page.locator('[data-detail-tool="grade-prices"] > summary').click();
  expect(requests).toHaveLength(0);
  const check10 = page.locator('[data-psa-price="10"]');
  await check10.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#psaPriceEvidence")).toContainText("$250.00");
  await expect(check10).toBeFocused();
  expect(requests[0]).toMatchObject({
    grader: "PSA",
    grade: "10",
    variant: "Holofoil",
    gradeQualifier: "",
  });
  await page.locator('[data-psa-sale-details="10"] > summary').click();
  await expect(
    page.locator('[data-psa-sale-details="10"] a').first(),
  ).toContainText("2026-09-01");
  await page.locator('[data-psa-price="9"]').click();
  await expect(page.locator("#psaPriceEvidence")).toContainText(
    "No usable matching sales returned",
  );
  await expect(page.locator('[data-psa-sale-details="10"]')).toHaveAttribute(
    "open",
    "",
  );
  await expect(page.locator(".market-hero")).not.toContainText("$250.00");
  await page.locator('[data-psa-price="10"]').click();
  await expect(page.locator("#psaPriceEvidence")).toContainText(
    "Couldn’t refresh. Previous sales shown.",
  );
  await expect(page.locator("#psaPriceEvidence")).toContainText("$250.00");
  await assertFits(page);
  expect(
    await page
      .locator("#psaPriceEvidence .grade-ladder-row")
      .evaluateAll((rows) =>
        rows.every((row) => {
          const bounds = row.getBoundingClientRect();
          return [...row.querySelectorAll("button, b, a")].every((node) => {
            const r = node.getBoundingClientRect();
            return r.left >= bounds.left - 1 && r.right <= bounds.right + 1;
          });
        }),
      ),
  ).toBe(true);
  await page
    .locator("#psaPriceEvidence")
    .screenshot({ path: `/tmp/mica-psa-${page.viewportSize().width}.png` });
});

test("grading scenarios keep missing data blank and preserve entered costs on refresh", async ({
  page,
}, testInfo) => {
  await openDetail(page);
  await page
    .locator('[data-detail-tool="grading-comparison"] > summary')
    .click();
  await expect(page.locator("#compareRaw")).toHaveValue("");
  await expect(page.locator('[data-comparison-result="10"]')).toContainText(
    "Value and costs needed",
  );
  await page.locator("#compareRaw").fill("100");
  await page.locator("#compareCost").fill("30");
  await page.locator("#compareFee").fill("10");
  await page.locator("#compareGrade9").fill("120");
  await page.locator("#compareGrade10").fill("200");
  await expect(page.locator('[data-comparison-result="9"]')).toContainText(
    "−$12.00",
  );
  await expect(page.locator('[data-comparison-result="10"]')).toContainText(
    "+$60.00",
  );
  await expect(page.locator('[data-comparison-result="8"]')).toContainText(
    "Value and costs needed",
  );
  await page.evaluate(
    async (url) => (await import(url)).renderDetail(),
    appUrl,
  );
  await expect(page.locator("#compareRaw")).toHaveValue("100");
  await expect(page.locator("#compareCost")).toHaveValue("30");
  await expect(page.locator("#compareGrade10")).toHaveValue("200");
  await expect(page.locator("#compareRawSource")).toHaveText("Your estimate");
  await page.locator(".grading-comparison").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("grading-comparison.png"),
    animations: "disabled",
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.locator("#compareFee").fill("100");
  await expect(page.locator('[data-comparison-result="10"]')).toContainText(
    "Value and costs needed",
  );
});

test("grading comparison prefills only current matching market evidence", async ({
  page,
}) => {
  const now = new Date().toISOString();
  const quote = {
    provider: "tcgplayer",
    market: "TCGplayer",
    priceType: "market",
    finish: "holofoil",
    currency: "USD",
    observedAt: now,
    retrievedAt: now,
    amount: 100,
    condition: "Near Mint",
  };
  await openDetail(page, {
    quotes: [
      {
        ...quote,
        amount: 999,
        observedAt: "2020-01-01",
        retrievedAt: "2020-01-01",
      },
      quote,
      {
        ...quote,
        gradingCompany: "PSA",
        grade: "10",
        amount: 999,
        priceType: "asking",
      },
      { ...quote, gradingCompany: "PSA", grade: "10", amount: 200 },
      {
        ...quote,
        gradingCompany: "PSA",
        grade: "9",
        amount: 999,
        currency: "EUR",
      },
      { ...quote, gradingCompany: "BGS", grade: "9", amount: 999 },
    ],
  });
  await page
    .locator('[data-detail-tool="grading-comparison"] > summary')
    .click();
  await expect(page.locator("#compareRaw")).toHaveValue("100.00");
  await expect(page.locator("#compareGrade10")).toHaveValue("200.00");
  await expect(page.locator("#compareGrade9")).toHaveValue("");
  await expect(page.locator("#compareCost")).toHaveValue("");
  await expect(page.locator('[data-comparison-result="10"]')).toContainText(
    "Value and costs needed",
  );
});
