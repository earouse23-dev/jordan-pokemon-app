import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizeTcgdexCard } from "../../lib/providers/tcgdex.js";
import { collectibleIdentitySnapshot } from "../../lib/identity.js";
import { buildPortfolioView } from "../../lib/portfolio-view.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appUrl = "/app.js?v=120";
const evidenceDir = fileURLToPath(
  new URL("../../docs/evidence/sol-client-06/", import.meta.url),
);
async function chooseChartMode(page, mode) {
  const details = page.locator(".portfolio-native-history");
  if (!(await details.evaluate(element => element.open))) await details.locator(":scope > summary").click();
  await page.locator(`#portfolioHistory [data-portfolio-history-mode='${mode}']`).click();
}
async function openAdvancedFilters(page) {
  await page.locator("#filterButton").click();
  if (!(await page.locator(".collection-advanced-filters").evaluate(element => element.open)))
    await page.locator(".collection-advanced-filters > summary").click();
}
let instrumentedApp, instrumentedSavedApp;
test.use({ serviceWorkers: "block" });

test.beforeAll(async () => {
  const source = await readFile(
    new URL("../../app.js", import.meta.url),
    "utf8",
  );
  const bundle = await build({
    stdin: {
      contents: `${source}\nexport { state, renderCollection, renderPortfolioHistory, routeTo, bindEvents, portfolioChartInstance, portfolioItems, capturePortfolioValuation, exactSaleContext, valuationContextForItem, portfolioProfitLoss, refreshLivePricing, refreshMovementHistory, refreshSavedPortfolio, loadSavedPortfolio, sessionLoadVersion };`,
      resolveDir: root,
      sourcefile: "app.js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  });
  instrumentedApp = bundle.outputFiles[0].text;
  instrumentedSavedApp = (await build({ stdin: { contents: source.replace("void bootstrap();", "") + "\nexport { state, bindEvents, routeTo, renderCollection, renderPortfolioHistory, loadSavedPortfolio, refreshSavedPortfolio, refreshLivePricing, sessionLoadVersion, portfolioChartInstance, restorePortfolioPricing, cachePortfolioView };", resolveDir: root, sourcefile: "app.js" }, bundle: true, format: "esm", platform: "browser", target: "es2022", write: false })).outputFiles[0].text;
  await mkdir(evidenceDir, { recursive: true });
});

test("synthetic portfolio P/L, ranges, value toggle and honest movement filters", async ({
  page,
}, testInfo) => {
  // This multi-flow check covers filters, FX failure/retry, ranges and sold records.
  // Keep action/assertion limits; allow the complete workflow its own total budget.
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date("2026-09-25T12:00:00Z") });
  await page.route("**/app.js?v=120", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedApp,
    }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("**/api/**", (route) => route.request().url().includes("surface=portfolio") ? route.fulfill({status:404,body:"{}"}) : route.abort());
  await page.route("**/api/fx", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "rate_unavailable" }) }));
  await page.route("https://mica-portfolio-test.supabase.co/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "[]" }),
  );
  await page.goto("/");
  await page.evaluate(async (appUrl) => {
    const { state, renderCollection, routeTo, bindEvents } = await import(
      appUrl
    );
    const make = (id, date, cost, price, points, extra = {}) => ({
      uid: id,
      id,
      name: `Synthetic ${id}`,
      set: "Synthetic Set",
      number: id,
      variant: "Holofoil",
      cardState: "raw",
      condition: "Near Mint",
      language: "en",
      currency: "USD",
      quantity: 1,
      status: "owned",
      cost,
      costBasis: cost,
      price,
      pricingStatus: price == null ? "missing" : "live",
      thumb: "/icons/icon.svg",
      purchaseDate: date,
      lots: [
        {
          acquiredAt: date,
          quantityAcquired: 1,
          quantityRemaining: 1,
          totalCost: cost,
          costBasisKnown: cost !== null,
          acquisitionDateKnown: true,
          currency: "USD",
        },
      ],
      transactions: [
        {
          type: "purchase",
          date,
          quantity: 1,
          totalCost: cost,
          currency: "USD",
        },
      ],
      priceHistory: points.map(([day, amount]) => ({
        recordedAt: `${day}T12:00:00Z`,
        amount,
        currency: "USD",
        provider: "synthetic",
        finish: "holofoil",
        condition: "Near Mint",
      })),
      quotes: [],
      tags: [],
      ...extra,
    });
    state.session = { user: { id: "11111111-1111-4111-8111-111111111111" } };
    state.accountLoading = false;
    state.organization.status = "ready";
    state.items = [
      make("A", "2026-09-01", 100, 150, [
        ["2026-09-10", 130],
        ["2026-09-20", 140],
        ["2026-09-25", 150],
      ]),
      make("C", "2026-09-20", 50, 70, [
        ["2026-09-20", 70],
        ["2026-09-25", 70],
      ]),
      make("U", "2026-09-20", null, null, [], { costBasis: null }),
    ];
    state.portfolioHistory = [
      {
        date: "2026-09-10",
        total: 130,
        currency: "USD",
        pricedItems: 1,
        unpricedItems: 0,
        freshItems: 1,
      },
      {
        date: "2026-09-20",
        total: 210,
        currency: "USD",
        pricedItems: 2,
        unpricedItems: 1,
        freshItems: 2,
      },
      {
        date: "2026-09-25",
        total: 220,
        currency: "USD",
        pricedItems: 2,
        unpricedItems: 1,
        freshItems: 2,
      },
    ];
    state.portfolioHistoryMode = "pnl";
    state.portfolioHistoryRange = "1m";
    document.body.dataset.uiTheme = "mica";
    document.body.dataset.workspace = "collector";
    document.body.dataset.softwareMode = "collector";
    document.body.classList.add("authenticated");
    document.querySelector("#authGate").hidden = true;
    document.querySelector("#appShell").removeAttribute("aria-hidden");
    bindEvents();
    routeTo("dashboard", { focus: false });
    renderCollection();
  }, appUrl);
  await expect(page.locator("#portfolioHistory")).toContainText(
    "Known unrealized P/L",
  );
  await expect(page.locator("#portfolioHistory")).toContainText("$70.00");
  await expect(page.locator(".portfolio-native-history")).not.toHaveAttribute("open", "");
  await expect(page.locator(".portfolio-history-metrics")).not.toBeVisible();
  await expect(page.locator(".portfolio-chart-coverage")).toBeVisible();
  await page.locator(".portfolio-native-history > summary").click();
  await expect(page.locator(".portfolio-history-metrics")).toBeVisible();
  await expect(page.locator("#portfolioChartRange")).toHaveAttribute("data-value", "1m");
  await page.locator(`#portfolioChartRange [data-range="${"1d"}"]`).click();
  await expect(page.locator("#portfolioChartRange")).toHaveAttribute("data-value", "1d");
  await expect(page.locator(".portfolio-native-history")).toHaveAttribute("open", "");
  await page.locator(".portfolio-native-history > summary").click();
  await chooseChartMode(page, "value");
  await expect(page.locator("#portfolioHistory")).toContainText("Known value");
  await expect(page.locator("#portfolioHistory")).toContainText("$220.00");
  await page.locator(`#portfolioChartRange [data-range="${"ytd"}"]`).click();
  await page.locator(`#portfolioChartRange [data-range="${"1y"}"]`).click();
  await chooseChartMode(page, "pnl");
  await expect
    .poll(() =>
      page.evaluate(async (url) => {
        const { portfolioChartInstance } = await import(url);
        return (
          portfolioChartInstance?.data.datasets.length || 0
        );
      }, appUrl),
    )
    .toBe(1);
  await page.evaluate(() =>
    document.querySelector("#toastRegion").replaceChildren(),
  );
  await page.screenshot({
    path: testInfo.outputPath("synthetic-portfolio.png"),
    fullPage: true,
  });
  await page.evaluate(
    async (appUrl) =>
      (await import(appUrl)).routeTo("collection", { focus: false }),
    appUrl,
  );
  await openAdvancedFilters(page);
  await page.locator("#sheetMovement").selectOption("rising");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("1");
  await openAdvancedFilters(page);
  await expect(page.locator("#sheetMovement")).toHaveValue("rising");
  await page.locator("#sheetCoverage").selectOption("missing");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("0");
  await page.locator("#clearFilters").click();
  await expect(page.locator("#resultCount")).toContainText("3");
  await openAdvancedFilters(page);
  await page.locator("#sheetPerformance").selectOption("unknown");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("1 item");
  await openAdvancedFilters(page);
  await page.locator("#resetSheet").click();
  await openAdvancedFilters(page);
  await page.locator("#sheetMinimumProfitLoss").fill("30");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("1 item");
  await openAdvancedFilters(page);
  await page.locator("#resetSheet").click();
  await openAdvancedFilters(page);
  await page.locator("#sheetPurchaseDateFrom").fill("2026-09-20");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("2 items");
  await openAdvancedFilters(page);
  await page.locator("#resetSheet").click();
  await page.evaluate(async (url) => {
    const { state, renderPortfolioHistory, routeTo } = await import(url);
    const euro = structuredClone(state.items[0]);
    euro.id = "E";
    euro.uid = "E";
    euro.currency = "EUR";
    euro.costBasis = 50;
    euro.cost = 50;
    euro.price = 110;
    euro.lots[0].currency = "EUR";
    euro.lots[0].totalCost = 50;
    euro.transactions[0].currency = "EUR";
    euro.transactions[0].totalCost = 50;
    euro.priceHistory = [
      ["2026-09-20", 90],
      ["2026-09-25", 110],
    ].map(([date, amount]) => ({
      recordedAt: `${date}T12:00:00Z`,
      amount,
      currency: "EUR",
      provider: "synthetic",
      finish: "holofoil",
      condition: "Near Mint",
    }));
    state.items.push(euro);
    state.profile = { ...state.profile, displayCurrency: "EUR" };
    state.portfolioHistoryMode = "pnl";
    routeTo("dashboard", { focus: false });
    renderPortfolioHistory();
  }, appUrl);
  await expect(page.locator("#portfolioHistory [data-portfolio-history-currency]")).toHaveCount(0);
  await expect(page.locator("#portfolioHistory")).toContainText("€60.00");
  await expect(page.locator("#portfolioHistory")).toContainText("awaiting conversion");
  await expect(page.locator("[data-portfolio-fx-retry]")).toBeVisible();
  const hash = "a".repeat(64);
  await page.route("**/api/fx", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ sourceId: "ecb-eurofxref-daily", sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", base: "EUR", quote: "USD", units: "USD per EUR", rate: 1.25, effectiveDate: "2026-09-25", fetchedAt: "2026-09-25T12:00:00.000Z", contentSha256: hash, rateRef: "ecb-eurofxref-daily:2026-09-25:" + hash }) }));
  await page.locator("[data-portfolio-fx-retry]").click();
  await expect(page.locator("#portfolioHistory .portfolio-history-metrics")).toContainText("€116.00");
  await expect(page.locator("#portfolioHistory")).toContainText("not historical exchange rates");
  expect(await page.evaluate(async url => (await import(url)).state.items.map(item => item.currency), appUrl)).toEqual(["USD", "USD", "USD", "EUR"]);
  await chooseChartMode(page, "value");
  await expect(page.locator("#portfolioHistory .portfolio-history-metrics")).toContainText("€286.00");
  const nativeRows = page.locator(".portfolio-native-history tbody tr").filter({ hasText: "2026-09-25" });
  await expect(nativeRows.filter({ hasText: "USD" })).toContainText("$220.00");
  await expect(nativeRows.filter({ hasText: "USD" })).toContainText("$70.00");
  await expect(nativeRows.filter({ hasText: "EUR" })).toContainText("€110.00");
  await expect(nativeRows.filter({ hasText: "EUR" })).toContainText("€60.00");
  await page.locator(".portfolio-native-history > summary").click();
  await expect(page.locator("#portfolioChartRange")).toHaveAttribute("data-value", "1y");
  await page.evaluate(() =>
    document.querySelector("#toastRegion").replaceChildren(),
  );
  await page.screenshot({
    path: testInfo.outputPath("synthetic-eur.png"),
    fullPage: true,
  });
  await page.evaluate(async (url) => {
    const { state, renderPortfolioHistory } = await import(url);
    state.items = state.items.filter((item) => item.uid === "E");
    renderPortfolioHistory();
  }, appUrl);
  await expect(page.locator("#portfolioHistory")).toContainText(
    "Portfolio value · EUR",
  );
  await expect(
    page.locator("#portfolioHistory [data-portfolio-history-currency]"),
  ).toHaveCount(0);
  await page.evaluate(async (url) => {
    const { state, renderPortfolioHistory } = await import(url);
    const base = structuredClone(state.items[0]);
    const sold = {
      ...base,
      uid: "S",
      id: "S",
      currency: "USD",
      quantity: 0,
      status: "sold",
      costBasis: 0,
      price: null,
      pricingStatus: "missing",
      lots: [
        {
          acquiredAt: "2026-09-01",
          quantityAcquired: 1,
          quantityRemaining: 0,
          totalCost: 100,
          costBasisKnown: true,
          acquisitionDateKnown: true,
          currency: "USD",
        },
      ],
      transactions: [
        {
          type: "sale",
          date: "2026-09-15",
          quantity: 1,
          netProceeds: 140,
          allocatedCost: 100,
          currency: "USD",
        },
      ],
      priceHistory: [
        {
          recordedAt: "2026-09-10T12:00:00Z",
          amount: 120,
          currency: "USD",
          provider: "synthetic",
          finish: "holofoil",
          condition: "Near Mint",
        },
      ],
    };
    const unpriced = {
      ...base,
      uid: "U2",
      id: "U2",
      currency: "USD",
      quantity: 1,
      price: null,
      pricingStatus: "missing",
      costBasis: 50,
      lots: [
        {
          acquiredAt: "2026-09-01",
          quantityAcquired: 1,
          quantityRemaining: 1,
          totalCost: 50,
          costBasisKnown: true,
          acquisitionDateKnown: true,
          currency: "USD",
        },
      ],
      transactions: [
        {
          type: "purchase",
          date: "2026-09-01",
          quantity: 1,
          totalCost: 50,
          currency: "USD",
        },
      ],
      priceHistory: [],
    };
    const uncertain = {
      ...unpriced,
      uid: "X",
      id: "X",
      lots: [
        { ...unpriced.lots[0], acquiredAt: null, acquisitionDateKnown: false },
      ],
      transactions: [],
    };
    state.items = [sold, unpriced, uncertain];
    state.profile = { ...state.profile, displayCurrency: "USD" };
    state.portfolioHistoryCurrency = "USD";
    state.portfolioHistoryMode = "pnl";
    renderPortfolioHistory();
  }, appUrl);
  await expect(page.locator("#portfolioHistory")).toContainText("$40.00");
  await expect(page.locator("#portfolioHistory")).toContainText(
    "1 missing price",
  );
  await expect(page.locator("#portfolioHistory")).toContainText(
    "1 unknown date",
  );
  await expect(page.locator("#portfolioChartSummary")).toContainText(
    "2026-09-15",
  );
  await chooseChartMode(page, "value");
  await expect(page.locator("#portfolioHistory")).toContainText("Known value");
  await expect(page.locator("#portfolioHistory")).toContainText(
    "1 unknown date",
  );
  await expect
    .poll(() =>
      page.evaluate(async (url) => {
        const { portfolioChartInstance } = await import(url);
        return (
          portfolioChartInstance === null
        );
      }, appUrl),
    )
    .toBe(true); // Unknown ownership means no misleading partial-value line.
  await page.evaluate(async (appUrl) => {
    const { state, renderPortfolioHistory, routeTo } = await import(appUrl);
    state.items = [];
    state.portfolioHistory = [];
    state.portfolioHistoryMode = "value";
    state.portfolioHistoryStatus = "error";
    routeTo("dashboard", { focus: false });
    renderPortfolioHistory();
  }, appUrl);
  await expect(page.locator("#portfolioHistory")).toContainText(
    "History could not refresh",
  );
  await page.locator("[data-portfolio-history-retry]").click();
  await expect(page.locator("#portfolioHistory")).toContainText(
    "No recorded history in this range",
  );
});

test("graded reference index cannot enter portfolio totals or snapshots; exact sold cache can", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-09-25T12:00:00Z") });
  await page.route("**/app.js?v=120", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedApp,
    }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("**/api/**", (route) => route.request().url().includes("surface=portfolio") ? route.fulfill({status:404,body:"{}"}) : route.abort());
  let snapshotWrites = 0;
  await page.route("https://mica-portfolio-test.supabase.co/**", (route) => {
    if (route.request().url().includes("record_portfolio_valuation_snapshot"))
      snapshotWrites += 1;
    return route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.goto("/");
  const card = normalizeTcgdexCard(
    {
      id: "synthetic-25",
      localId: "25",
      name: "Pikachu",
      set: {
        id: "synthetic",
        name: "Synthetic Violet",
        cardCount: { official: 100 },
      },
      variants_detailed: [
        {
          variantId: "plain",
          type: "holo",
          size: "standard",
          subtype: "unlimited",
          stamp: [],
        },
      ],
    },
    "en",
  );
  const snapshot = collectibleIdentitySnapshot(card, card.variantOptions[0].id);
  const results = await page.evaluate(
    async ({ url, snapshot, cardId }) => {
      const {
        state,
        portfolioItems,
        portfolioProfitLoss,
        capturePortfolioValuation,
        exactSaleContext,
        valuationContextForItem,
        renderCollection,
      } = await import(url);
      const item = {
        ...snapshot,
        id: cardId,
        uid: "graded-copy",
        cardState: "graded",
        gradingCompany: "PSA",
        grade: "10",
        gradeQualifier: "",
        quantity: 1,
        currency: "EUR",
        costBasis: 50,
        price: 900,
        pricingStatus: "live",
        lots: [
          {
            acquiredAt: "2026-09-01",
            quantityAcquired: 1,
            quantityRemaining: 1,
            totalCost: 50,
            remainingCost: 50,
            costBasisKnown: true,
            acquisitionDateKnown: true,
            currency: "EUR",
          },
        ],
        transactions: [],
        priceHistory: [
          {
            recordedAt: "2026-09-20T12:00:00Z",
            amount: 900,
            currency: "EUR",
            provider: "synthetic",
            finish: "holofoil",
            gradingCompany: "PSA",
            grade: "10",
          },
        ],
      };
      state.session = { user: { id: "11111111-1111-4111-8111-111111111111" } };
      state.items = [item];
      state.pricingStatus = "live";
      state.accountLoading = false;
      state.organization.status = "ready";
      const indexOnly = portfolioProfitLoss(portfolioItems(), "EUR");
      renderCollection();
      const indexScreen =
        document.querySelector("#valuationCoverage").textContent;
      await capturePortfolioValuation();
      const context = exactSaleContext(item, valuationContextForItem(item));
      const sales = [100, 120, 140].map((amount, index) => ({
        provider: "pkmnprices",
        providerSaleId: String(8001 + index),
        source: "ebay",
        sourceUrl: `https://www.ebay.com/itm/${8001 + index}`,
        attribution: "exact",
        evidenceKind: "completed_sale",
        gradingCompany: "PSA",
        grade: "10",
        gradeQualifier: null,
        printing: "Holofoil",
        language: "English",
        currency: "EUR",
        amount,
        soldAt: "2026-09-20",
      }));
      item.exactSaleEvidence = {
        salesStatus: "live",
        sales,
        validatedContext: {
          ...context,
          clientId: context.canonicalId,
          gradeQualifier: "",
          providerCardId: "synthetic-25",
          canonicalValidated: true,
          completedSaleValidated: true,
        },
        retrievedAt: "2026-09-24T00:00:00Z",
      };
      const ready = portfolioItems()[0].soldValuation;
      const exact = portfolioProfitLoss(portfolioItems(), "EUR");
      renderCollection();
      const exactScreen =
        document.querySelector("#valuationCoverage").textContent;
      await capturePortfolioValuation();
      item.grade = "9";
      const wrongGrade = portfolioProfitLoss(portfolioItems(), "EUR");
      item.grade = "10";
      item.exactSaleEvidence.sales = sales.map((sale) => ({
        ...sale,
        soldAt: "2026-08-20",
      }));
      const stale = portfolioProfitLoss(portfolioItems(), "EUR");
      return {
        context,
        indexOnly,
        exact,
        ready,
        wrongGrade,
        stale,
        indexScreen,
        exactScreen,
      };
    },
    { url: appUrl, snapshot, cardId: card.id },
  );
  expect(results.context.identityStatus).toBe("exact");
  expect(results.context.edition).toBe("unlimited");
  expect(results.indexOnly.pricedUnits).toBe(0);
  expect(results.indexScreen).not.toContain("€900.00");
  expect(results.exact.valueMinor).toBe(10000);
  expect(results.exact.unrealizedMinor).toBe(5000);
  expect(results.ready).toMatchObject({
    status: "ready",
    currency: "EUR",
    ruleVersion: "mica-last-ebay-sale-v1",
    newestSoldAt: "2026-09-20",
  });
  expect(results.ready.evaluatedAt).toMatch(/^2026-09-25T/);
  expect(results.ready.contributingEvidenceIds).toEqual([
    "ebay:8001",
  ]);
  expect(results.exactScreen).toContain("€100.00");
  expect(results.wrongGrade.pricedUnits).toBe(0);
  expect(results.stale.pricedUnits).toBe(1);
  expect(results.stale.valueMinor).toBe(10000);
  expect(snapshotWrites).toBe(1); // Only the validated exact-sold aggregate is saved; never the index, wrong grade or stale result.
});


test("portfolio refresh publishes once, shares requests and retains values on failed batches", async ({ page }) => {
  await page.route("**/app.js?v=120", route => route.fulfill({ contentType: "application/javascript", body: instrumentedApp }));
  await page.route("**/app-config.js*", route => route.fulfill({ contentType: "application/javascript", body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};' }));
  await page.route("https://mica-portfolio-test.supabase.co/**", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/**", route => route.request().url().includes("surface=portfolio") ? route.fulfill({status:404,body:"{}"}) : route.abort());
  let requests = 0;
  let releaseLast;
  const last = new Promise(resolve => { releaseLast = resolve; });
  await page.route("**/api/cards?**", async route => {
    requests++;
    const lookups = JSON.parse(new URL(route.request().url()).searchParams.get("lookups"));
    expect(new URL(route.request().url()).searchParams.get("history")).toBe("full");
    if (lookups.some(row => row.clientId === "C")) { await last; await route.fulfill({ status: 502, contentType: "application/json", body: "{}" }); return; }
    const now = new Date().toISOString();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ retrievedAt: now, cards: lookups.map(row => ({ providerCardId: row.clientId, externalIds: {}, quotes: [{ provider: "tcgplayer", market: "tcgplayer", currency: "USD", finish: "holofoil", condition: "Near Mint", amount: 200, priceType: "market", observedAt: now, retrievedAt: now }], historyStatus: "live", history: [{ provider: "tcgplayer", currency: "USD", finish: "holofoil", condition: "Near Mint", recordedAt: now, amount: 200 }] })) }) });
  });
  await page.goto("/");
  await page.evaluate(async appUrl => {
    const app = await import(appUrl);
    const now = new Date().toISOString();
    app.state.session = { user: { id: "11111111-1111-4111-8111-111111111111" } };
    app.state.accountLoading = false; app.state.organization.status = "ready";
    app.state.preferences.displayCurrency = "USD";
    app.state.items = ["A", "B", "C"].map(id => ({ uid: id, id, name: "Synthetic " + id, set: "Synthetic", number: "1", variant: "Holofoil", language: "en", condition: "Near Mint", rawCondition: "near_mint", currency: "USD", cardState: "raw", quantity: 1, costBasis: 50, price: 100, pricingStatus: "live", tags: [], transactions: [], lots: [{ acquiredAt: now.slice(0, 10), quantityAcquired: 1, quantityRemaining: 1, totalCost: 50, currency: "USD" }], quotes: [{ provider: "tcgplayer", market: "tcgplayer", priceType: "market", finish: "holofoil", condition: "Near Mint", currency: "USD", amount: 100, observedAt: now, retrievedAt: now }], priceHistory: [{ provider: "tcgplayer", finish: "holofoil", condition: "Near Mint", currency: "USD", amount: 100, recordedAt: new Date(Date.now() - 86_400_000).toISOString() }, { provider: "tcgplayer", finish: "holofoil", condition: "Near Mint", currency: "USD", amount: 100, recordedAt: now }] }));
    document.body.dataset.uiTheme = "mica"; document.body.dataset.workspace = "collector"; document.body.classList.add("authenticated"); document.querySelector("#authGate").hidden = true; document.querySelector("#appShell").removeAttribute("aria-hidden"); app.bindEvents();
    const cachedItems = app.state.items;
    app.state.items = cachedItems.map(item => ({ ...item, price: null, pricingStatus: "loading" }));
    app.state.portfolioHistory = [{ date: now.slice(0, 10), currency: "USD", total: 300, pricedItems: 3, unpricedItems: 0 }];
    app.state.pricingStatus = "idle"; app.renderCollection();
    globalThis.__restoredPortfolioValue = document.querySelector("#portfolioValue").textContent;
    app.state.items = cachedItems;
    app.state.pricingStatus = "live"; app.routeTo("dashboard"); app.renderCollection();
    globalThis.__portfolioRun = Promise.all([app.refreshLivePricing(), app.refreshLivePricing()]);
  }, appUrl);
  expect(await page.evaluate(() => globalThis.__restoredPortfolioValue)).toBe("$300.00");
  await expect.poll(() => requests).toBe(2);
  await expect(page.locator("#portfolioValue")).toHaveText("$300.00");
  await expect(page.locator(".status-label")).toContainText("Updating prices");
  const previousCanvas = await page.locator("#portfolioHistoryChart").elementHandle();
  await page.waitForTimeout(500);
  expect(await previousCanvas.evaluate(node => node.isConnected)).toBe(true);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(requests).toBe(2); // Returning while a batch is active shares that same refresh.
  releaseLast();
  await page.evaluate(() => globalThis.__portfolioRun);
  await expect(page.locator("#portfolioValue")).toHaveText("$500.00");
  await expect(page.locator("#portfolioToplineLabel")).toHaveText("Total portfolio value");
  await expect(page.locator("#portfolioValue")).toHaveCSS("color", "rgb(79, 99, 72)");
  expect(requests).toBe(2);
  await page.evaluate(async appUrl => { const app = await import(appUrl); await app.refreshLivePricing(["A", "B"]); }, appUrl);
  expect(requests).toBe(2); // Fresh owned detail/collection history does not refetch.
  await expect.poll(() => page.evaluate(async url => Boolean((await import(url)).portfolioChartInstance), appUrl)).toBe(true);
  const result = await page.evaluate(async appUrl => {
    const app = await import(appUrl); const chart = app.portfolioChartInstance; app.renderCollection(); app.renderCollection();
    return { sameChart: chart === app.portfolioChartInstance, prices: app.state.items.map(item => item.price), onlyCompleteDataset: chart.data.datasets.length === 1, heroBeforeChart: document.querySelector(".portfolio-hero").compareDocumentPosition(document.querySelector("#portfolioHistory")) & Node.DOCUMENT_POSITION_FOLLOWING };
  }, appUrl);
  expect(result).toEqual({ sameChart: true, prices: [200, 200, 100], onlyCompleteDataset: true, heroBeforeChart: 4 });
});

test("portfolio overlaps three batches and publishes only after the final batch", async ({ page }) => {
  await page.route("**/app.js?v=120", route => route.fulfill({ contentType: "application/javascript", body: instrumentedApp }));
  await page.route("**/app-config.js*", route => route.fulfill({ contentType: "application/javascript", body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};' }));
  await page.route("https://mica-portfolio-test.supabase.co/**", route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.route("**/api/**", route => route.request().url().includes("surface=portfolio") ? route.fulfill({status:404,body:"{}"}) : route.abort());
  const release = []; let requests = 0, active = 0, peak = 0;
  await page.route("**/api/cards?**", async route => {
    requests++; active++; peak = Math.max(peak, active);
    const rows = JSON.parse(new URL(route.request().url()).searchParams.get("lookups"));
    expect(rows.every(row => row.variant === "Holofoil" && row.currency === "USD" && ["Near Mint", "Lightly Played"].includes(row.condition))).toBe(true);
    expect(new Set(rows.map(row => row.clientId)).size).toBe(rows.length);
    await new Promise(resolve => release.push(resolve));
    const now = new Date().toISOString();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ cards: rows.map(row => ({ providerCardId: row.clientId, quotes: [{ provider: "tcgplayer", priceType: "market", finish: "holofoil", condition: row.condition, currency: "USD", amount: row.condition === "Lightly Played" ? 100 : 200, observedAt: now }], historyStatus: "live", history: [] })) }) });
    active--;
  });
  await page.goto("/");
  await page.evaluate(async url => {
    const app = await import(url), now = new Date().toISOString();
    Object.assign(app.state, { session: { user: { id: "11111111-1111-4111-8111-111111111111" } }, accountLoading: false, pricingStatus: "live" });
    app.state.organization.status = "ready";
    app.state.items = Array.from({ length: 8 }, (_, i) => ({ uid: String(i), id: i === 1 ? "0" : String(i), name: "Synthetic " + i, set: "Synthetic", number: String(i), variant: "Holofoil", language: "en", condition: i === 1 ? "Lightly Played" : "Near Mint", rawCondition: i === 1 ? "lightly_played" : "near_mint", currency: "USD", cardState: "raw", quantity: 1, costBasis: 50, price: 100, pricingStatus: "live", tags: [], transactions: [], lots: [{ acquiredAt: now.slice(0, 10), quantityAcquired: 1, quantityRemaining: 1, totalCost: 50, currency: "USD" }] }));
    document.body.dataset.uiTheme = "mica"; document.body.dataset.workspace = "collector"; document.body.classList.add("authenticated"); document.querySelector("#authGate").hidden = true; document.querySelector("#appShell").removeAttribute("aria-hidden"); app.bindEvents(); app.routeTo("dashboard"); app.renderCollection();
    globalThis.__concurrentRun = Promise.all([app.refreshLivePricing(), app.refreshLivePricing()]);
  }, appUrl);
  await expect.poll(() => requests).toBe(3);
  expect(active).toBe(3); expect(peak).toBe(3);
  await expect(page.locator("#portfolioValue")).toHaveText("$800.00");
  release[0]();
  await expect.poll(() => requests).toBe(4);
  await expect(page.locator("#portfolioValue")).toHaveText("$800.00");
  release.slice(1).forEach(resolve => resolve());
  await page.evaluate(() => globalThis.__concurrentRun);
  expect(requests).toBe(4); expect(peak).toBe(3);
  expect(await page.evaluate(async url => (await import(url)).state.items.map(item => item.price), appUrl)).toEqual([200, 100, 200, 200, 200, 200, 200, 200]);
  await expect(page.locator("#portfolioValue")).toHaveText("$1,500.00");
  await page.evaluate(async url => { const app = await import(url); app.state.movementStatus = "idle"; await app.refreshMovementHistory(); }, appUrl);
  expect(requests).toBe(4); // Insights reuses fresh context histories instead of broad duplicate fetches.
});

test('saved chart and total restore together and publish only after a completed refresh',async({page},testInfo)=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const makeView=(total,day)=>({version:4,complete:true,updatedAt:`2026-01-${day}T12:00:00Z`,dashboard:buildPortfolioView([{uid:'saved-card',id:'saved-card',name:'Saved Charizard',set:'Base Set',number:'4/102',quantity:1,currency:'USD',price:total,pricingStatus:'live',costBasis:200,lots:[],transactions:[]}]).dashboard,summaries:[{currency:'USD',total,knownTotal:total,missingUnits:0,historyStartsAt:'2026-01-01',history:[{date:'2026-01-01',total:400},{date:'2026-01-02',total}]}],pricing:[]});
 let saved=makeView(400,'02'),release,fail=false,empty=false,paid=0,posts=0;
 await page.route('**/app.js?v=120',route=>route.fulfill({contentType:'application/javascript',body:instrumentedSavedApp}));
 await page.route('**/app-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};'}));
 await page.route('https://mica-portfolio-test.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/api/**',async route=>{
  if(route.request().url().includes('surface=portfolio')){
   if(route.request().method()==='POST'){
    posts++;
    if(posts===1)return route.fulfill({contentType:'application/json',body:JSON.stringify({view:{...saved,refreshIncomplete:true,refreshReason:'incomplete_refresh',pendingPricing:[{price:100}]}})});
    if(fail)return route.fulfill({status:empty?200:503,contentType:'application/json',body:empty?JSON.stringify({view:{version:1,refreshIncomplete:true,updatedAt:'2026-01-04T12:00:00Z',summaries:[{currency:'USD',total:null,knownTotal:null,missingUnits:24,history:[]}],pricing:[]}}):'{}'});
    await new Promise(resolve=>release=resolve);saved=makeView(450,'03');
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify({view:saved})});
  }
  if(route.request().url().includes('/api/cards'))paid++;
  await route.abort();
 });
 const restore=()=>page.evaluate(async({appUrl,owner})=>{
  const app=await import(appUrl);app.state.session={user:{id:owner}};app.state.accountLoading=false;app.state.organization.status='ready';app.state.items=[];app.state.profile={...app.state.profile,displayCurrency:'USD'};app.state.portfolioHistoryMode='value';app.state.portfolioHistoryRange='all';
  document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');
  app.bindEvents();app.state.portfolioView=await app.loadSavedPortfolio(owner);app.routeTo('insights');app.renderCollection();app.renderPortfolioHistory();
 },{appUrl,owner});
 await page.goto('/');await restore();await expect(page.locator('#portfolioValue')).toHaveText('$400.00');await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
 await expect(page.locator('#dashboardHighestCards')).toContainText('$400.00');
 await expect(page.locator('#portfolioReturn')).toHaveText('+100.0%');
 await page.evaluate(async url=>{const a=await import(url);a.state.items=[{uid:'saved-card',name:'Saved Charizard',currency:'USD',quantity:1,price:null,pricingStatus:'missing',lots:[],transactions:[]}];a.renderCollection();},appUrl);
 await expect(page.locator('#dashboardHighestCards')).toContainText('$400.00');
 await expect(page.locator('#portfolioReturn')).toHaveText('+100.0%');
 await page.evaluate(async({appUrl,owner})=>{const a=await import(appUrl);window.fixtureRefresh=a.refreshSavedPortfolio(owner,a.sessionLoadVersion);},{appUrl,owner});
 await expect.poll(()=>Boolean(release)).toBe(true);await expect(page.locator('#portfolioValue')).toHaveText('$400.00');release();await page.evaluate(()=>window.fixtureRefresh);
 await expect(page.locator('#portfolioValue')).toHaveText('$450.00');expect(posts).toBe(2);
 await expect(page.locator('#dashboardHighestCards')).toContainText('$450.00');
 await expect(page.locator('#portfolioReturn')).toHaveText('+125.0%');
 fail=true;await page.evaluate(async({appUrl,owner})=>{const a=await import(appUrl);await a.refreshSavedPortfolio(owner,a.sessionLoadVersion);},{appUrl,owner});await expect(page.locator('#portfolioValue')).toHaveText('$450.00');
 empty=true;await page.evaluate(async({appUrl,owner})=>{const a=await import(appUrl);await a.refreshSavedPortfolio(owner,a.sessionLoadVersion);},{appUrl,owner});await expect(page.locator('#portfolioValue')).toHaveText('$450.00');
 await page.reload();await restore();await expect(page.locator('#portfolioValue')).toHaveText('$450.00');await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
 expect(paid).toBe(0);
 await expect.poll(()=>page.evaluate(async url=>(await import(url)).portfolioChartInstance?.data.datasets[0].data,appUrl)).toEqual([400,450,450]);
 expect(await page.evaluate(async url => (await import(url)).portfolioChartInstance?.options.animation, appUrl)).toBe(false);
 await page.evaluate(()=>{document.body.dataset.uiTheme='mica';const select=document.querySelector('#appearanceSelect');select.value='dark';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(async url=>(await import(url)).portfolioChartInstance?.options.scales.y.ticks.color,appUrl)).toBe('#b4bcb2');
 expect(paid).toBe(0);
 await page.screenshot({path:`/tmp/mica95-saved-${testInfo.project.name}.png`,fullPage:true,animations:"disabled"});
});

test('saved chart paints while account and server reads are pending, survives reload, and cannot cross owners', async ({page},testInfo)=>{
  const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
  const view=amount=>({version:1,dailyVersion:1,checkedDay:'2026-01-03',updatedAt:'2026-01-03T12:00:00Z',summaries:[{currency:'USD',total:amount,knownTotal:amount,missingUnits:0,history:[{date:'2026-01-02',total:400},{date:'2026-01-03',total:amount}],historyStartsAt:'2026-01-02'}],pricing:[{uid:'fixture',priceHistory:Array(1000).fill({amount:100})}]});
  let release,fail=false;
  await page.route('**/app.js?v=120',route=>route.fulfill({contentType:'application/javascript',body:instrumentedSavedApp}));
  await page.route('**/app-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};'}));
  await page.route('https://mica-portfolio-test.supabase.co/**',route=>route.abort());
  await page.route('**/api/**',async route=>{
    if(!route.request().url().includes('surface=portfolio'))return route.abort();
    if(fail)return route.fulfill({status:503,body:'{}'});
    await new Promise(resolve=>release=resolve);
    return route.fulfill({contentType:'application/json',body:JSON.stringify({view:view(450)})});
  });
  await page.goto('/');
  const start=seed=>page.evaluate(async({appUrl,owner,seed,value})=>{
    const a=await import(appUrl);a.state.session={user:{id:owner}};a.state.accountLoading=true;a.state.accountLoadError='';a.state.items=[];
    a.state.portfolioHistoryMode='value';a.state.portfolioHistoryRange='all';
    document.body.dataset.uiTheme='mica';document.body.dataset.workspace='collector';document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');
    if(seed)localStorage.setItem('mica:portfolio-view:'+owner,JSON.stringify(value));
    a.routeTo('dashboard');window.savedRead=a.loadSavedPortfolio(owner);a.renderCollection();
  },{appUrl,owner,seed,value:view(400)});
  await start(true);
  await expect(page.locator('#portfolioValue')).toHaveText('$400.00');
  await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
  expect(await page.locator('.portfolio-hero').evaluate(n=>Boolean(n.compareDocumentPosition(document.querySelector('#portfolioHistory')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect.poll(()=>Boolean(release)).toBe(true);release();await page.evaluate(()=>window.savedRead);
  await expect(page.locator('#portfolioValue')).toHaveText('$450.00');
  expect(await page.evaluate(owner=>JSON.parse(localStorage.getItem('mica:portfolio-view:'+owner)).pricing,owner)).toBeUndefined();
  await page.evaluate(owner=>{
    const key='mica:portfolio-view:'+owner,value=JSON.parse(localStorage.getItem(key)),day=new Date().toISOString().slice(0,10),hash='a'.repeat(64);
    value.cachedDisplayCurrency='EUR';value.cachedDisplayFx={sourceId:'ecb-eurofxref-daily',sourceUrl:'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',base:'EUR',quote:'USD',units:'USD per EUR',rate:2,contentSha256:hash,rateRef:`ecb-eurofxref-daily:${day}:${hash}`,effectiveDate:day,fetchedAt:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(value));
  },owner);
  fail=true;await page.reload();await start(false);
  await expect(page.locator('#portfolioValue')).toHaveText('€225.00');await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
  await page.screenshot({path:`/tmp/mica101-saved-first-${testInfo.project.name}.png`,fullPage:true,animations:'disabled'});
  fail=false;release=null;await start(false);await expect.poll(()=>Boolean(release)).toBe(true);
  await page.evaluate(async({appUrl,other})=>{const a=await import(appUrl);a.state.session={user:{id:other}};a.state.portfolioView=null;a.renderCollection();},{appUrl,other});
  release();await page.evaluate(()=>window.savedRead);
  await expect(page.locator('#portfolioValue')).toHaveText('—');await expect(page.locator('#portfolioHistoryChart')).toHaveCount(0);
});

test('saved EUR portfolio requests conversion before inventory arrives and retries without losing history', async ({ page }) => {
  const owner='11111111-1111-4111-8111-111111111111';
  let fxCalls=0, fail=true;
  await page.route('**/app.js?v=120',route=>route.fulfill({contentType:'application/javascript',body:instrumentedSavedApp}));
  await page.route('**/app-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};'}));
  await page.route('https://mica-portfolio-test.supabase.co/**',route=>route.abort());
  await page.route('**/api/**',route=>route.fulfill({status:503,body:'{}'}));
  await page.route('**/api/fx',route=>{
    fxCalls++;
    const day=new Date().toISOString().slice(0,10),hash='a'.repeat(64);
    return route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{}:{sourceId:'ecb-eurofxref-daily',sourceUrl:'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',base:'EUR',quote:'USD',units:'USD per EUR',rate:2,contentSha256:hash,rateRef:`ecb-eurofxref-daily:${day}:${hash}`,effectiveDate:day,fetchedAt:new Date().toISOString()})});
  });
  await page.goto('/');
  await page.evaluate(async ({ appUrl,owner })=>{
    const a=await import(appUrl);a.bindEvents();a.state.session={user:{id:owner}};a.state.profile={displayCurrency:'EUR'};a.state.accountLoading=true;a.state.items=[];
    a.state.portfolioHistoryMode='value';a.state.portfolioHistoryRange='all';
    document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');
    localStorage.setItem('mica:portfolio-view:'+owner,JSON.stringify({version:1,updatedAt:'2026-01-03T12:00:00Z',summaries:[{currency:'USD',total:450,knownTotal:450,missingUnits:0,history:[{date:'2026-01-02',total:400},{date:'2026-01-03',total:450}]}]}));
    a.routeTo('dashboard');await a.loadSavedPortfolio(owner);a.renderCollection();
  },{appUrl,owner});
  await expect(page.locator('#retryDisplayFx')).toBeVisible();
  expect(fxCalls).toBe(2);
  await expect(page.locator('#portfolioHistory')).toContainText('Currency conversion unavailable');
  fail=false;
  await page.locator('#retryDisplayFx').click();
  await expect(page.locator('#portfolioValue')).toHaveText('€225.00');
  await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
  await expect(page.locator('#retryDisplayFx')).toBeHidden();
  expect(fxCalls).toBe(3);
  expect(await page.locator('#portfolioChartRange').evaluate(n=>n.getBoundingClientRect().bottom <= document.querySelector('#portfolioHistoryChart').getBoundingClientRect().top)).toBe(true);
  await page.evaluate(async appUrl=>{const a=await import(appUrl);a.state.portfolioView.summaries[0].history=a.state.portfolioView.summaries[0].history.slice(-1);a.renderCollection();},appUrl);
  await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
  await expect.poll(()=>page.evaluate(async url=>Boolean((await import(url)).portfolioChartInstance),appUrl)).toBe(true);
  const endpoint = await page.evaluate(async url=>{const chart=(await import(url)).portfolioChartInstance; const c=chart.options.plugins.tooltip.callbacks; return {values:chart.data.datasets[0].data, label:c.label({dataIndex:1})};},appUrl);
  expect(endpoint.values).toEqual([225,225]);
  expect(endpoint.label).toContain('Saved valuation from Jan 3, 2026');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('mica:portfolio-view:11111111-1111-4111-8111-111111111111')).summaries[0].history.length)).toBe(2);
});

test.describe('UTC daily valuation boundaries', () => {
 test.use({timezoneId:'America/Chicago'});
 test('saved dashboard timeframes retain daily observations across local and UTC midnight without pricing requests', async ({page}) => {
  await page.clock.install({time:new Date('2026-10-22T02:30:00Z')});
  await page.route('**/app.js?v=120',route=>route.fulfill({contentType:'application/javascript',body:instrumentedSavedApp}));
  await page.route('**/app-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={};'}));
  let requests=0;
  await page.route('**/api/**',route=>{requests++;return route.abort();});
  await page.goto('/');
  const dates=['2024-11-03','2025-10-20','2025-10-21','2025-12-31','2026-01-01','2026-09-20','2026-09-21','2026-10-20','2026-10-21','2026-10-22'];
  await page.evaluate(async({appUrl,dates})=>{
    const a=await import(appUrl);a.state.session={user:{id:'11111111-1111-4111-8111-111111111111'}};a.state.accountLoading=false;a.state.items=[];
    a.state.profile={displayCurrency:'USD'};a.state.portfolioHistoryMode='value';a.state.portfolioHistoryRange='all';
    a.state.portfolioView={version:4,updatedAt:'2026-10-22T02:00:00Z',summaries:[{currency:'USD',total:1000,knownTotal:1000,missingUnits:0,acquiredAt:dates[0],history:dates.map((date,i)=>({date,total:(i+1)*100}))}],dashboard:{holdings:[],nativePerformance:[]}};
    document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');
    a.routeTo('dashboard');a.renderCollection();
  },{appUrl,dates});
  const before=requests;
  for(const [range,start] of [['all','2024-11-03'],['1d','2026-10-21'],['1m','2026-09-21'],['ytd','2026-01-01'],['1y','2025-10-21'],['all','2024-11-03'],['1d','2026-10-21']]) {
    await page.locator(`#portfolioChartRange [data-range="${range}"]`).click();
    await expect(page.locator("#portfolioChartRange")).toHaveAttribute("data-value", range);
    await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
    await expect.poll(()=>page.evaluate(async({appUrl,start})=>{
      const chart=(await import(appUrl)).portfolioChartInstance;
      return chart ? {first:chart.data.labels[0],last:chart.data.labels.at(-1),min:chart.scales.x.min,max:chart.scales.x.max} : null;
    },{appUrl,start})).toEqual({first:Date.parse(start),last:Date.parse('2026-10-22'),min:Date.parse(start),max:Date.parse('2026-10-22')});
    await expect(page.locator('#portfolioValue')).toHaveText('$1,000.00');
  }
  await page.clock.setFixedTime(new Date('2026-10-23T02:30:00Z'));
  await page.evaluate(async appUrl=>(await import(appUrl)).renderPortfolioHistory(),appUrl);
  await expect.poll(()=>page.evaluate(async appUrl=>(await import(appUrl)).portfolioChartInstance?.data.labels,appUrl)).toEqual([Date.parse('2026-10-22'),Date.parse('2026-10-23')]);
  expect(requests).toBe(before);
  const saved=await page.evaluate(async appUrl=>(await import(appUrl)).state.portfolioView.summaries[0].history,appUrl);
  expect(saved.map(p=>p.date)).toEqual(dates);
});

});

for (const appearance of ['light', 'dark']) {
 test(`portfolio retry retains saved chart, respects backoff and recovers without polling (${appearance})`, async ({page}, testInfo) => {
  await page.clock.install({time:new Date('2026-01-03T12:00:00Z')});
  const owner='11111111-1111-4111-8111-111111111111';
  const saved={version:4,dailyVersion:1,checkedDay:'2026-01-03',updatedAt:'2026-01-03T11:00:00Z',summaries:[{currency:'USD',total:450,knownTotal:450,missingUnits:0,history:[{date:'2026-01-02',total:400},{date:'2026-01-03',total:450}]}],pricing:[]};
  let calls=0, release;
  await page.route('**/app.js?v=120',r=>r.fulfill({contentType:'application/javascript',body:instrumentedSavedApp}));
  await page.route('**/app-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};'}));
  await page.route('https://mica-portfolio-test.supabase.co/**',r=>r.abort());
  await page.route('**/api/**',async r=>{
   if(!r.request().url().includes('surface=portfolio')) return r.abort();
   calls++;
   if(calls===1)return r.fulfill({status:503,body:'{}'});
   if(calls===2)return r.fulfill({contentType:'application/json',body:JSON.stringify({view:{...saved,refreshIncomplete:true,attemptDay:'2026-01-03',retryAt:'2026-01-03T12:05:00Z'}})});
   await new Promise(resolve=>release=resolve);
   return r.fulfill({contentType:'application/json',body:JSON.stringify({view:{...saved,updatedAt:'2026-01-03T12:05:00Z',summaries:[{...saved.summaries[0],total:475,knownTotal:475,history:[saved.summaries[0].history[0],{date:'2026-01-03',total:475}]}]}})});
  });
  await page.goto('/');
  await page.evaluate(async ({appUrl,owner,saved,appearance})=>{
   const a=await import(appUrl);a.bindEvents();a.state.session={user:{id:owner}};a.state.accountLoading=false;a.state.items=[];a.state.portfolioView=saved;
   document.body.dataset.appearance=appearance;document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');
   a.routeTo('dashboard');a.renderCollection();await a.refreshLivePricing();
  },{appUrl,owner,saved,appearance});
  const retry=page.locator('#retryPortfolio');
  await expect(page.locator('#portfolioValue')).toHaveText('$450.00');
  await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
  await expect(retry).toBeEnabled();
  await retry.click();
  await expect(retry).toBeDisabled();
  await expect(page.locator('#portfolioRetryNote')).toContainText('Try again at');
  await expect(page.locator('#portfolioValue')).toHaveText('$450.00');
  await page.screenshot({path:testInfo.outputPath(`portfolio-retry-${appearance}.png`),fullPage:false});
  await page.clock.fastForward(300_010);
  await expect(retry).toBeEnabled();
  expect(calls).toBe(2);
  await retry.click();
  await expect.poll(()=>calls).toBe(3);
  await expect(retry).toHaveText('Updating…');
  await expect(retry).toBeDisabled();
  await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
  release();
  await expect(page.locator('#portfolioValue')).toHaveText('$475.00');
  await expect(retry).toBeHidden();
  await expect(page.locator('.status-label')).not.toContainText('Update incomplete');
  expect(calls).toBe(3);
  await page.evaluate(async ({appUrl,saved})=>{const a=await import(appUrl);a.state.portfolioView={...saved,refreshIncomplete:true,refreshReason:'provider_daily_budget_reached',attemptDay:'2026-01-03'};a.renderCollection();},{appUrl,saved});
  await expect(retry).toBeHidden();
  await expect(page.locator('#portfolioRetryNote')).toHaveText('Try again tomorrow');
  await expect(page.locator('.status-label')).toContainText('Daily pricing limit reached');
  await page.clock.fastForward(86_400_000);
  await expect(retry).toBeEnabled();
  expect(calls).toBe(3);
 });
}

test('collection restores matching saved prices before network, retains them on failure, and rejects changed identities', async ({page}, testInfo) => {
  const owner='11111111-1111-4111-8111-111111111111';
  let pending, reads=0, providerCalls=0;
  await page.route('**/app.js?v=120',r=>r.fulfill({contentType:'application/javascript',body:instrumentedSavedApp}));
  await page.route('**/app-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};'}));
  await page.route('https://mica-portfolio-test.supabase.co/**',r=>r.abort());
  await page.route('**/api/**',r=>{
    if(r.request().url().includes('surface=portfolio')) {reads++;pending=r;return;}
    providerCalls++;return r.abort();
  });
  await page.goto('/');
  const restore=async(seed)=>page.evaluate(async({appUrl,owner,seed})=>{
    const a=await import(appUrl);
    const base={uid:'cached-raw',id:'cached-raw',name:'Saved Charizard',set:'Base Set',number:'4/102',language:'en',variant:'Holofoil',finish:'holofoil',edition:'unlimited',promoType:'none',condition:'Near Mint',rawCondition:'near_mint',currency:'USD',cardState:'raw',quantity:2,price:null,pricingStatus:'loading',lots:[],transactions:[],tags:[]};
    const key=JSON.stringify([base.id,base.externalIds?.pkmnprices,base.variant,base.language,base.condition,base.rawCondition,base.currency,base.cardState,base.gradingCompany,base.grade,base.gradeQualifier,base.finish,base.edition,base.promoType]);
    const old='2024-01-01T12:00:00Z';
    const price={uid:base.uid,key,price:100,pricingStatus:'stale',checkedAt:old,quotes:[{provider:'tcgplayer',currency:'USD',finish:'holofoil',condition:'Near Mint',priceType:'market',amount:100,observedAt:old,retrievedAt:old}]};
    a.state.session={user:{id:owner}};a.state.accountLoading=false;a.state.organization.status='ready';a.state.items=[base];a.state.profile={displayCurrency:'USD'};
    document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');
    if(seed)a.cachePortfolioView(owner,{version:4,updatedAt:old,summaries:[{currency:'USD',total:200,knownTotal:200,missingUnits:0,history:[]}],pricing:[price]});
    a.routeTo('collection');globalThis.pendingSavedRead=a.loadSavedPortfolio(owner);a.renderCollection();
  },{appUrl,owner,seed});
  await restore(true);
  await expect(page.locator('#cardLedger')).toContainText('$200.00');
  await expect(page.locator('#cardLedger')).not.toContainText('Price unavailable');
  await expect.poll(()=>Boolean(pending)).toBe(true);
  await pending.fulfill({status:503,body:'{}'});await page.evaluate(()=>pendingSavedRead);
  await expect(page.locator('#cardLedger')).toContainText('$200.00');
  await page.reload();pending=null;await restore(false);
  await expect(page.locator('#cardLedger')).toContainText('$200.00');
  await expect.poll(()=>Boolean(pending)).toBe(true);
  await pending.fulfill({status:503,body:'{}'});await page.evaluate(()=>pendingSavedRead);
  await page.screenshot({path:testInfo.outputPath('saved-price-network-failure.png'),fullPage:false});
  await page.evaluate(async appUrl=>{const a=await import(appUrl);a.state.items[0]={...a.state.items[0],condition:'Damaged',rawCondition:'damaged',price:null,quotes:[],pricingStatus:'loading'};a.restorePortfolioPricing(a.state.portfolioView);a.renderCollection();},appUrl);
  await expect(page.locator('#cardLedger')).not.toContainText('$200.00');
  await page.evaluate(async appUrl=>{const a=await import(appUrl);a.state.session={user:{id:'different-owner'}};a.state.items=[];globalThis.pendingSavedRead=a.loadSavedPortfolio('different-owner');},appUrl);
  await expect.poll(()=>reads).toBe(3);await pending.fulfill({status:503,body:'{}'});await page.evaluate(()=>pendingSavedRead);
  expect(await page.evaluate(async appUrl=>(await import(appUrl)).state.portfolioView,appUrl)).toBeNull();
  expect(providerCalls).toBe(0);
});
