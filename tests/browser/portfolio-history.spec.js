import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizeTcgdexCard } from "../../lib/providers/tcgdex.js";
import { collectibleIdentitySnapshot } from "../../lib/identity.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appUrl = "/app.js?v=114";
const evidenceDir = fileURLToPath(
  new URL("../../docs/evidence/sol-client-06/", import.meta.url),
);
async function chooseChartMode(page, mode) {
  const details = page.locator(".portfolio-native-history");
  if (!(await details.evaluate(element => element.open))) await details.locator(":scope > summary").click();
  await page.locator(`#portfolioHistory [data-portfolio-history-mode='${mode}']`).click();
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
  instrumentedSavedApp = (await build({ stdin: { contents: source.replace("void bootstrap();", "") + "\nexport { state, bindEvents, routeTo, renderCollection, renderPortfolioHistory, loadSavedPortfolio, refreshSavedPortfolio, sessionLoadVersion, portfolioChartInstance };", resolveDir: root, sourcefile: "app.js" }, bundle: true, format: "esm", platform: "browser", target: "es2022", write: false })).outputFiles[0].text;
  await mkdir(evidenceDir, { recursive: true });
});

test("synthetic portfolio P/L, ranges, value toggle and honest movement filters", async ({
  page,
}, testInfo) => {
  // This multi-flow check covers filters, FX failure/retry, ranges and sold records.
  // Keep action/assertion limits; allow the complete workflow its own total budget.
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date("2026-09-25T12:00:00Z") });
  await page.route("**/app.js?v=114", (route) =>
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
  await expect(page.locator("#portfolioChartRange")).toHaveValue("1m");
  await page.locator("#portfolioChartRange").selectOption("1d");
  await expect(page.locator("#portfolioChartRange")).toHaveValue("1d");
  await expect(page.locator(".portfolio-native-history")).toHaveAttribute("open", "");
  await page.locator(".portfolio-native-history > summary").click();
  await chooseChartMode(page, "value");
  await expect(page.locator("#portfolioHistory")).toContainText("Known value");
  await expect(page.locator("#portfolioHistory")).toContainText("$220.00");
  await page.locator("#portfolioChartRange").selectOption("ytd");
  await page.locator("#portfolioChartRange").selectOption("1y");
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
  await page.locator("#filterButton").click();
  await page.locator("#sheetMovement").selectOption("rising");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("1");
  await page.locator("#filterButton").click();
  await expect(page.locator("#sheetMovement")).toHaveValue("rising");
  await page.locator("#sheetCoverage").selectOption("missing");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("0");
  await page.locator("#clearFilters").click();
  await expect(page.locator("#resultCount")).toContainText("3");
  await page.locator("#filterButton").click();
  await page.locator("#sheetPerformance").selectOption("unknown");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("1 saved entry");
  await page.locator("#filterButton").click();
  await page.locator("#resetSheet").click();
  await page.locator("#filterButton").click();
  await page.locator("#sheetMinimumProfitLoss").fill("30");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("1 saved entry");
  await page.locator("#filterButton").click();
  await page.locator("#resetSheet").click();
  await page.locator("#filterButton").click();
  await page.locator("#sheetPurchaseDateFrom").fill("2026-09-20");
  await page.locator("#applySheet").click();
  await expect(page.locator("#resultCount")).toContainText("2 saved entries");
  await page.locator("#filterButton").click();
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
  await expect(page.locator("#portfolioChartRange")).toHaveValue("1y");
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
  await page.route("**/app.js?v=114", (route) =>
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
  expect(results.stale.pricedUnits).toBe(0);
  expect(snapshotWrites).toBe(1); // Only the validated exact-sold aggregate is saved; never the index, wrong grade or stale result.
});


test("portfolio refresh publishes once, shares requests and retains values on failed batches", async ({ page }) => {
  await page.route("**/app.js?v=114", route => route.fulfill({ contentType: "application/javascript", body: instrumentedApp }));
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
  await page.route("**/app.js?v=114", route => route.fulfill({ contentType: "application/javascript", body: instrumentedApp }));
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
 const makeView=(total,day)=>({version:1,complete:true,updatedAt:`2026-01-${day}T12:00:00Z`,summaries:[{currency:'USD',total,knownTotal:total,missingUnits:0,historyStartsAt:'2026-01-01',history:[{date:'2026-01-01',total:400},{date:'2026-01-02',total}]}],pricing:[]});
 let saved=makeView(400,'02'),release,fail=false,paid=0;
 await page.route('**/app.js?v=114',route=>route.fulfill({contentType:'application/javascript',body:instrumentedSavedApp}));
 await page.route('**/app-config.js*',route=>route.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-portfolio-test.supabase.co",supabasePublishableKey:"fixture-key"};'}));
 await page.route('https://mica-portfolio-test.supabase.co/**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
 await page.route('**/api/**',async route=>{
  if(route.request().url().includes('surface=portfolio')){
   if(route.request().method()==='POST'){
    if(fail)return route.fulfill({status:503,body:'{}'});
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
 await page.evaluate(async({appUrl,owner})=>{const a=await import(appUrl);window.fixtureRefresh=a.refreshSavedPortfolio(owner,a.sessionLoadVersion);},{appUrl,owner});
 await expect.poll(()=>Boolean(release)).toBe(true);await expect(page.locator('#portfolioValue')).toHaveText('$400.00');release();await page.evaluate(()=>window.fixtureRefresh);
 await expect(page.locator('#portfolioValue')).toHaveText('$450.00');
 fail=true;await page.evaluate(async({appUrl,owner})=>{const a=await import(appUrl);await a.refreshSavedPortfolio(owner,a.sessionLoadVersion);},{appUrl,owner});await expect(page.locator('#portfolioValue')).toHaveText('$450.00');
 await page.reload();await restore();await expect(page.locator('#portfolioValue')).toHaveText('$450.00');await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
 expect(paid).toBe(0);
 await expect.poll(()=>page.evaluate(async url=>(await import(url)).portfolioChartInstance?.data.datasets[0].data,appUrl)).toEqual([400,450]);
 await expect.poll(()=>page.evaluate(async url=>(await import(url)).portfolioChartInstance?.$traceProgress||0,appUrl)).toBe(1);
 await page.screenshot({path:`/tmp/mica95-saved-${testInfo.project.name}.png`,fullPage:true,animations:"disabled"});
});
