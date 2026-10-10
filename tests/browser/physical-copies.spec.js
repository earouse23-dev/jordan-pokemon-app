import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeTcgdexCard } from "../../lib/providers/tcgdex.js";
import { collectibleIdentitySnapshot } from "../../lib/identity.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appUrl = "/app.js?v=111";
const ownerId = "11111111-1111-4111-8111-111111111111";
const copyIds = {
  a: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  b: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  c: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};
const screenshotDir = fileURLToPath(
  new URL("../../docs/evidence/sol-client-03/", import.meta.url),
);
const valuationEvidenceDir = fileURLToPath(
  new URL("../../docs/evidence/sol-client-05/", import.meta.url),
);
const fxEvidenceDir = fileURLToPath(
  new URL("../../docs/evidence/sol-client-05f/", import.meta.url),
);
const fxSourceEvidenceDir = fileURLToPath(
  new URL("../../docs/evidence/sol-client-05g/", import.meta.url),
);
let instrumentedApp;

test.use({ serviceWorkers: "block" });

test("CLIENT-05I detail reopens saved printing without catalog options and detects explicit removal", async ({
  page,
}) => {
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
  const saved = {
    ...gradedCopy("a"),
    ...snapshot,
    uid: copyIds.a,
    cardState: "graded",
    status: "owned",
    gradingCompany: "PSA",
    grade: "10",
    certificationNumber: "synthetic-000001",
    quantity: 1,
    variant: card.variantOptions[0].label,
  };
  delete saved.variantOptions;
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1" ||
    new URL(route.request().url()).hostname === "mica-copy-test.supabase.co"
      ? route.fallback()
      : route.abort(),
  );
  await setup(page);
  const open = (item) =>
    page.evaluate(
      async ({ appUrl, item }) => {
        const { state, openCardDetail } = await import(appUrl);
        state.items = [item];
        openCardDetail(item, true);
      },
      { appUrl, item },
    );
  await open(saved);
  await expect(page.locator(".identity-details")).not.toContainText(
    "Printing details incomplete",
  );
  await expect(page.locator("#checkExactSalesButton")).toBeVisible();
  await open({ ...saved, variantOptions: [] });
  await expect(page.locator(".identity-details")).toContainText(
    "Printing details incomplete",
  );
});

test("CLIENT-05I form saves to disposable database and fresh browser login reopens printing", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(
    process.env.MICA_CLIENT_05I_DISPOSABLE !== "1" ||
      testInfo.project.name === "mobile-chromium",
    "requires the owned disposable CLIENT-05I stack",
  );
  const localUrl = process.env.MICA_LOCAL_SUPABASE_URL;
  const anonKey = process.env.MICA_LOCAL_SUPABASE_ANON_KEY;
  const serviceKey = process.env.MICA_LOCAL_SUPABASE_SERVICE_KEY;
  const projectId = process.env.MICA_CLIENT_05I_PROJECT_ID;
  const workdir = process.env.MICA_CLIENT_05I_WORKDIR;
  const dockerContext = process.env.MICA_CLIENT_05I_DOCKER_CONTEXT;
  expect(
    localUrl && anonKey && serviceKey && projectId && workdir && dockerContext,
  ).toBeTruthy();
  const url = new URL(localUrl);
  expect(url.protocol).toBe("http:");
  expect(url.hostname).toBe("127.0.0.1");
  expect(Number(url.port)).toBeGreaterThan(1024);
  expect(url.port).not.toBe("54321");
  expect(projectId).toMatch(/^mica-client-05i-[a-z0-9]{6,}$/);
  expect(realpathSync(workdir)).toMatch(/^\/private\/tmp\/mica-client-05i-/);
  for (const name of [
    `supabase_db_${projectId}`,
    `supabase_kong_${projectId}`,
  ]) {
    const container = JSON.parse(
      execFileSync("docker", ["--context", dockerContext, "inspect", name], {
        encoding: "utf8",
      }),
    )[0];
    expect(container.Config.Labels["com.supabase.cli.project"]).toBe(projectId);
    expect(
      realpathSync(container.Config.Labels["com.supabase.cli.workdir"]),
    ).toBe(realpathSync(workdir));
    if (name.startsWith("supabase_kong_"))
      expect(container.HostConfig.PortBindings["8000/tcp"][0].HostPort).toBe(
        url.port,
      );
    else
      expect(
        container.Mounts.some((mount) => mount.Name?.includes(projectId)),
      ).toBe(true);
  }
  const guardedFetch = (input, init) => {
    expect(new URL(input instanceof Request ? input.url : input).origin).toBe(
      url.origin,
    );
    return fetch(input, { ...init, redirect: "error" });
  };
  const admin = createClient(localUrl, serviceKey, {
    auth: { persistSession: false },
    global: { fetch: guardedFetch },
  });
  const email = `mica-client-05i-browser-${randomUUID()}@example.invalid`;
  const password = `Mica-${randomUUID()}-9a!`;
  let userId;
  let freshContext;
  let ownerCheck;
  const network = {
    auth: 0,
    rpc: 0,
    rows: 0,
    external: 0,
    noncriticalErrors: 0,
  };
  const routePage = async (target) => {
    await target.route("**/app.js?v=111", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: instrumentedApp,
      }),
    );
    await target.route("**/app-config.js*", (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `globalThis.__APP_CONFIG__=${JSON.stringify({ supabaseUrl: "https://mica-copy-test.supabase.co", supabasePublishableKey: anonKey })};`,
      }),
    );
    await target.route("**/api/**", (route) =>
      route.fulfill({ contentType: "application/json", body: "{}" }),
    );
    await target.route(
      "https://mica-copy-test.supabase.co/**",
      async (route) => {
        const request = new URL(route.request().url());
        const targetUrl = `${url.origin}${request.pathname}${request.search}`;
        if (request.pathname.startsWith("/auth/v1/")) network.auth += 1;
        if (request.pathname.includes("/rpc/create_graded_copy_position"))
          network.rpc += 1;
        if (request.pathname.startsWith("/rest/v1/collection_items"))
          network.rows += 1;
        const response = await route.fetch({ url: targetUrl, maxRedirects: 0 });
        expect(
          response.status() < 300 || response.status() >= 400,
          `local API redirect at ${request.pathname}`,
        ).toBe(true);
        if (
          [
            "/auth/v1/token",
            "/rest/v1/rpc/create_graded_copy_position",
          ].includes(request.pathname) ||
          request.pathname === "/rest/v1/collection_items"
        )
          expect(
            response.status(),
            `local API ${request.pathname}`,
          ).toBeLessThan(300);
        else if (response.status() >= 400) network.noncriticalErrors += 1;
        await route.fulfill({ response });
      },
    );
    await target.route("**/*", (route) => {
      if (
        ["127.0.0.1", "mica-copy-test.supabase.co"].includes(
          new URL(route.request().url()).hostname,
        )
      )
        return route.fallback();
      network.external += 1;
      return route.abort();
    });
  };
  try {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    expect(created.error).toBeNull();
    userId = created.data.user.id;
    await routePage(page);
    await page.goto("/");
    await page.locator("#authEmail").fill(email);
    await page.locator("#authPassword").fill(password);
    await page.locator("#passwordAuthForm button[type=submit]").click();
    await expect(page.locator("#authGate")).toBeHidden();
    await expect.poll(() => page.evaluate(async (url) => Boolean((await import(url)).state.profile?.onboardingCompletedAt), appUrl)).toBe(true);
    await expect(page.locator("#onboardingDialog")).toHaveCount(0);
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
    await page.evaluate(
      async ({ appUrl, card }) => {
        const { catalogItem, openCardDetail } = await import(appUrl);
        openCardDetail(catalogItem(card, card.variantOptions[0].id));
      },
      { appUrl, card },
    );
    await page.locator("#addLibraryButton").click();
    await page.locator("#positionState").selectOption("graded");
    await page.locator("#positionGrader").selectOption("PSA");
    await page.locator("#positionGrade").fill("10");
    await page.locator("#positionCertification").fill("synthetic-browser-0001");
    await page.locator("#positionPurchaseDetails summary").click();
    await page.locator("#positionTotalCost").fill("12");
    await page.locator("#positionDate").fill("2026-09-20");
    await page.locator("#positionForm button[type=submit]").first().click();
    await expect.poll(() => network.rpc).toBe(1);
    await expect(page.locator("#positionForm")).toBeHidden();
    ownerCheck = createClient(localUrl, anonKey, {
      auth: { persistSession: false },
      global: { fetch: guardedFetch },
    });
    expect(
      (await ownerCheck.auth.signInWithPassword({ email, password })).error,
    ).toBeNull();
    const raw = await ownerCheck
      .from("collection_items")
      .select("id,variant_id,identity_snapshot,certification_number,user_id")
      .eq("user_id", userId);
    expect(raw.error).toBeNull();
    expect(raw.data).toHaveLength(1);
    expect(raw.data[0].variant_id).toBeNull();
    expect(raw.data[0].identity_snapshot.variantId).toBe(
      card.variantOptions[0].id,
    );
    expect(raw.data[0].certification_number).toBe("synthetic-browser-0001");
    freshContext = await browser.newContext({
      viewport: page.viewportSize(),
      isMobile: testInfo.project.name === "mobile-webkit",
      hasTouch: testInfo.project.name === "mobile-webkit",
      serviceWorkers: "block",
    });
    const freshPage = await freshContext.newPage();
    await routePage(freshPage);
    await freshPage.goto("/");
    await freshPage.locator("#authEmail").fill(email);
    await freshPage.locator("#authPassword").fill(password);
    await freshPage.locator("#passwordAuthForm button[type=submit]").click();
    await expect(freshPage.locator("#authGate")).toBeHidden();
    await expect(freshPage.locator("#onboardingDialog")).toHaveCount(0);
    await expect
      .poll(() =>
        freshPage.evaluate(
          async (url) => (await import(url)).state.items.length,
          appUrl,
        ),
      )
      .toBe(1);
    await freshPage.evaluate(async (url) => {
      const { state, openCardDetail } = await import(url);
      openCardDetail(state.items[0], true);
    }, appUrl);
    await expect(freshPage.locator(".identity-details")).not.toContainText(
      "Printing details incomplete",
    );
    await expect(freshPage.locator("#checkExactSalesButton")).toBeVisible();
    expect(network.auth).toBeGreaterThanOrEqual(2);
    expect(network.rpc).toBe(1);
    expect(network.rows).toBeGreaterThan(0);
    expect(network.external).toBe(0);
    console.log(
      `CLIENT-05I ${testInfo.project.name}: auth=${network.auth} save_rpc=${network.rpc} row_reads=${network.rows} external=${network.external}`,
    );
  } finally {
    await freshContext?.close();
    if (ownerCheck) expect((await ownerCheck.auth.signOut()).error).toBeNull();
    if (userId) {
      const deleted = await admin.auth.admin.deleteUser(userId);
      expect(deleted.error).toBeNull();
    }
  }
});

test.beforeAll(async () => {
  const source = await readFile(
    new URL("../../app.js", import.meta.url),
    "utf8",
  );
  const result = await build({
    stdin: {
      contents: `${source}\nexport { state, renderCollection, renderDetail, routeTo, bindEvents, catalogItem, openCardDetail, openPurchaseLotSheet, refreshLivePricing, chartInstance };`,
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
  if (process.env.MICA_CLIENT_03_CAPTURE)
    await mkdir(screenshotDir, { recursive: true });
});

function purchase(date, total) {
  return {
    id: `purchase-${date}-${total}`,
    type: "purchase",
    date,
    quantity: 1,
    unitPrice: total,
    subtotal: total,
    tax: 0,
    shipping: 0,
    marketplaceFees: 0,
    gradingFees: 0,
    otherCosts: 0,
    totalCost: total,
    netProceeds: null,
    allocatedCost: null,
    realizedGain: null,
    currency: "USD",
    marketplace: "Card show",
    acquisitionMethod: "direct_purchase",
    marketUnitPriceAtPurchase: null,
  };
}

function gradedCopy(key, { sold = false } = {}) {
  const facts = {
    a: { cert: "000001", date: "2026-01-01", cost: 10 },
    b: { cert: "000002", date: "2026-02-02", cost: 20 },
    c: { cert: "000003", date: "2026-03-03", cost: 30 },
  }[key];
  const transactions = [purchase(facts.date, facts.cost)];
  if (sold)
    transactions.push({
      id: "sale-copy-b",
      type: "sale",
      date: "2026-04-04",
      quantity: 1,
      unitPrice: 100,
      subtotal: 100,
      marketplaceFees: 10,
      shipping: 5,
      otherCosts: 0,
      totalCost: 0,
      netProceeds: 85,
      allocatedCost: 20,
      realizedGain: 65,
      currency: "USD",
      marketplace: "Card show",
    });
  return {
    uid: copyIds[key],
    id: "tcgdex:en:sv-25",
    collectibleId: "33333333-3333-4333-8333-333333333333",
    cardId: "22222222-2222-4222-8222-222222222222",
    variantId: "33333333-3333-4333-8333-333333333333",
    name: "Pikachu",
    set: "Synthetic Violet",
    setId: "sv-test",
    number: "025/100",
    rarity: "Rare Holo",
    language: "en",
    variant: "Holofoil",
    finish: "holofoil",
    edition: "unlimited",
    promoType: "none",
    identityStatus: "exact",
    externalIds: { tcgdex: "sv-25" },
    cardState: "graded",
    status: "owned",
    condition: "Graded",
    rawCondition: null,
    gradingCompany: "PSA",
    grade: "10",
    gradeQualifier: "",
    gradeClaimSource: "user",
    certificationNumber: facts.cert,
    quantity: sold ? 0 : 1,
    currency: "USD",
    price: null,
    referencePrice: null,
    pricingStatus: "missing",
    pricingUpdatedAt: null,
    cost: sold ? null : facts.cost,
    costBasis: sold ? null : facts.cost,
    purchaseDate: facts.date,
    netSaleProceeds: sold ? 85 : 0,
    allocatedSoldCost: sold ? 20 : null,
    realizedGain: sold ? 65 : 0,
    marketPriceAtPurchase: null,
    marketPriceAtPurchaseProvider: "",
    quotes: [],
    priceHistory: [],
    transactions,
    lots: [
      {
        id: `lot-${key}`,
        quantityAcquired: 1,
        quantityRemaining: sold ? 0 : 1,
        costBasisKnown: true,
        acquisitionDateKnown: true,
        acquiredAt: facts.date,
        totalCost: facts.cost,
        remainingCost: sold ? 0 : facts.cost,
        currency: "USD",
      },
    ],
    tags: [],
    createdAt: `${facts.date}T12:00:00.000Z`,
    updatedAt: sold
      ? "2026-04-04T12:00:00.000Z"
      : `${facts.date}T12:00:00.000Z`,
  };
}

async function setup(page, { soldB = false, onSale } = {}) {
  await page.route("**/app.js?v=111", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: instrumentedApp,
    }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-copy-test.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.route("https://mica-copy-test.supabase.co/**", async (route) => {
    if (
      onSale &&
      route.request().url().includes("/rest/v1/rpc/record_graded_copy_sale")
    ) {
      await onSale(route.request().postDataJSON());
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify("dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
      });
    }
    return route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.goto("/");
  await page.evaluate(
    async ({ appUrl, ownerId, copies }) => {
      const { state, renderCollection, routeTo, bindEvents } = await import(
        appUrl
      );
      state.session = { user: { id: ownerId } };
      state.accountLoading = false;
      state.items = copies;
      state.ledgerView = "all";
      state.query = "";
      state.sort = "name";
      state.groupBy = "none";
      state.organization.status = "ready";
      state.organization.summary = { positionCount: copies.length };
      state.gradingActivityStatus = "ready";
      for (const copy of copies) {
        state.gradingReports.set(copy.uid, []);
        state.organization.attachments.set(copy.uid, {
          status: "ready",
          items: [],
        });
      }
      document.body.dataset.uiTheme = "mica";
      document.body.dataset.workspace = "collector";
      document.body.dataset.softwareMode = "collector";
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      bindEvents();
      routeTo("collection", { focus: false });
      renderCollection();
    },
    {
      appUrl,
      ownerId,
      copies: [
        gradedCopy("a"),
        gradedCopy("b", { sold: soldB }),
        gradedCopy("c"),
      ],
    },
  );
}

async function capture(page, testInfo, name) {
  if (!process.env.MICA_CLIENT_03_CAPTURE) return;
  const viewport = testInfo.project.name.startsWith("mobile")
    ? "mobile-390"
    : "desktop";
  await page.screenshot({
    path: `${screenshotDir}/${viewport}-${name}.png`,
    fullPage: true,
  });
}

test("opening a graded copy reads exact comps without persisting or inventing its printing", async ({ page }) => {
  await setup(page);
  const reads = [], writes = [];
  await page.route("**/api/sales?*", route => {
    reads.push(JSON.parse(new URL(route.request().url()).searchParams.get("lookup")));
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ sales: [], salesStatus: "live" }) });
  });
  page.on("request", request => { if (request.url().includes("/api/graded-valuation")) writes.push(request.method()); });
  await page.evaluate(async ({ appUrl, saved }) => {
    const { state, openCardDetail } = await import(appUrl);
    state.session = { ...state.session, access_token: "synthetic-read-only-token" };
    state.items = [saved]; openCardDetail(saved, true);
  }, { appUrl, saved: { ...gradedCopy("a"), identityStatus: "needs_review", edition: "unknown", promoType: "unknown", variantMetadata: {}, variantOptions: [] } });
  await expect.poll(() => reads.length).toBe(1);
  expect(reads[0].grader).toBe("PSA");
  expect(reads[0].grade).toBe("10");
  expect(writes).toEqual([]);
  await expect(page.locator(".exact-sold-value")).toContainText("Confirm the printing");
});

test("adding a legacy copy preserves its saved printing in the graded-copy request", async ({ page }) => {
  await setup(page);
  const saved = {
    ...gradedCopy("a"), variantId: null, variant: "holo", finish: "holo",
    edition: "unlimited", promoType: "unknown", identityStatus: "needs_review",
    variantMetadata: {},
  };
  delete saved.variantOptions;
  await page.evaluate(async ({ appUrl, saved }) => {
    const { state, openCardDetail } = await import(appUrl);
    state.items = [saved];
    openCardDetail(saved, true);
  }, { appUrl, saved });
  await page.locator("#duplicateCopyButton").click();
  await expect(page.locator("#positionVariantId")).toHaveValue("");
  const request = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith("/rpc/create_graded_copy_position"));
  await page.locator("#positionForm button[type=submit]").filter({ hasText: "Add card" }).click();
  const payload = (await request).postDataJSON();
  expect(payload.p_variant_id).toBeNull();
  for (const field of ["variant", "finish", "edition", "promoType", "language"])
    expect(payload.p_identity[field], field).toBe(saved[field]);
  expect(payload.p_identity.identityStatus).toBe("needs_review");
});

function soldRows(lookup, amounts, soldAt = "2026-09-20") {
  const base =
    lookup.currency === "EUR" ? 22000 : lookup.grade === "8" ? 33000 : 11000;
  return amounts.map((amount, index) => ({
    provider: "fixture",
    providerSaleId: String(base + index),
    source: "ebay",
    sourceUrl: `https://www.ebay.com/itm/${base + index}`,
    title: "Synthetic Pikachu Violet 025/100 Holofoil PSA",
    attribution: "exact",
    gradingCompany: lookup.grader,
    grade: lookup.grade,
    gradeQualifier: lookup.gradeQualifier || null,
    printing: lookup.variant,
    language: "English",
    currency: lookup.currency,
    amount,
    soldAt,
    ingestedAt: "2026-09-23T00:00:00Z",
  }));
}

function soldPayload(lookup, sales, hasMore = false) {
  return {
    sales,
    hasMore,
    retrievedAt: "2026-09-24T00:00:00Z",
    validatedContext: {
      ...lookup,
      providerCardId: "fixture-card",
      canonicalValidated: true,
      completedSaleValidated: true,
    },
  };
}

function fxRecord(date = "2026-09-25", rate = 1.25) {
  const contentSha256 = "a".repeat(64);
  return {
    sourceId: "ecb-eurofxref-daily",
    sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
    base: "EUR",
    quote: "USD",
    units: "USD per EUR",
    rate,
    effectiveDate: date,
    fetchedAt: `${date}T12:00:00.000Z`,
    contentSha256,
    rateRef: `ecb-eurofxref-daily:${date}:${contentSha256}`,
  };
}

test("CLIENT-05H keeps detailed source selection, unresolved references and late sales separate", async ({
  page,
}) => {
  const source = {
    id: "synthetic-25",
    localId: "25",
    name: "Pikachu",
    set: {
      id: "synthetic",
      name: "Synthetic Violet",
      cardCount: { official: 100 },
    },
    variants: { holo: true, firstEdition: true },
    variants_detailed: [
      {
        variantId: "plain",
        type: "holo",
        size: "standard",
        subtype: "unlimited",
        stamp: [],
        languages: ["en"],
      },
      {
        variantId: "first",
        type: "holo",
        size: "standard",
        stamp: ["1st-edition"],
      },
      {
        variantId: "staff",
        type: "holo",
        size: "standard",
        subtype: "unlimited",
        stamp: ["staff"],
      },
    ],
  };
  const normalized = normalizeTcgdexCard(source, "en");
  const plainId = normalized.variantOptions[0].id;
  const staffId = normalized.variantOptions[2].id;
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    return host === "127.0.0.1" || host === "mica-copy-test.supabase.co"
      ? route.fallback()
      : route.abort();
  });
  await setup(page);
  const writes = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/api\/|\/rest\/v1\//.test(request.url())
    )
      writes.push(request.url());
  });
  const openCatalog = (card, selected) =>
    page.evaluate(
      async ({ appUrl, card, selected }) => {
        const { catalogItem, openCardDetail } = await import(appUrl);
        openCardDetail(catalogItem(card, selected));
      },
      { appUrl, card, selected },
    );
  await openCatalog(normalized, plainId);
  await page.locator("#addLibraryButton").click();
  await expect(page.locator("#positionVariantId")).toHaveValue(plainId);
  await page.locator("#positionCancel").click();
  await page.evaluate(
    async ({ appUrl, card }) => {
      const { openPositionSheet } = await import(appUrl);
      openPositionSheet(card);
    },
    { appUrl, card: normalized },
  );
  await page.locator(`[name="variantChoice"][value="${staffId}"]`).check();
  await expect(page.locator("#positionVariantId")).toHaveValue(staffId);
  await page.locator("#positionCancel").click();
  const reordered = normalizeTcgdexCard(
    { ...source, variants_detailed: [...source.variants_detailed].reverse() },
    "en",
  );
  await openCatalog(reordered, staffId);
  expect(
    await page.evaluate(
      async (url) => (await import(url)).state.detailCard.variantId,
      appUrl,
    ),
  ).toBe(staffId);
  await openCatalog(reordered, "tcgdex:en:synthetic-25:0:holo");
  await expect(page.locator(".identity-details")).toContainText(
    "Printing details incomplete",
  );
  expect(
    await page.evaluate(
      async (url) => (await import(url)).state.detailCard,
      appUrl,
    ),
  ).toMatchObject({
    identityStatus: "needs_review",
    finish: "unknown",
    edition: "unknown",
  });
  for (const replacement of [
    { ...source, variants_detailed: [] },
    { ...source, variants: {}, variants_detailed: [] },
    { ...source, variants_detailed: [{ variantId: null, type: "holo" }] },
  ]) {
    await openCatalog(normalizeTcgdexCard(replacement, "en"), plainId);
    await expect(page.locator(".identity-details")).toContainText(
      "Printing details incomplete",
    );
    expect(
      await page.evaluate(
        async (url) => (await import(url)).state.detailCard,
        appUrl,
      ),
    ).toMatchObject({
      variantId: plainId,
      identityStatus: "needs_review",
      finish: "unknown",
      edition: "unknown",
    });
  }

  let release;
  let requested = false;
  let completed = false;
  await page.route("**/api/sales?*", async (route) => {
    requested = true;
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    await new Promise((resolve) => {
      release = resolve;
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        soldPayload(lookup, soldRows(lookup, [100, 120, 140])),
      ),
    });
    completed = true;
  });
  const owned = (selected) => {
    const option = normalized.variantOptions.find(
      (value) => value.id === selected,
    );
    return {
      ...gradedCopy("a"),
      ...normalized,
      id: normalized.id,
      uid: copyIds.a,
      variantId: selected,
      variant: option.label,
      finish: option.finish,
      edition: option.edition,
      promoType: option.promoType,
      identityStatus: option.status,
      cardState: "graded",
      gradingCompany: "PSA",
      grade: "10",
    };
  };
  await page.evaluate(
    async ({ appUrl, item }) => {
      const { state, openCardDetail } = await import(appUrl);
      state.items = [item];
      openCardDetail(item, true);
    },
    { appUrl, item: owned(plainId) },
  );
  await page.locator("#checkExactSalesButton").click();
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(
    async ({ appUrl, item }) => {
      const { state, openCardDetail } = await import(appUrl);
      state.items = [item];
      openCardDetail(item, true);
    },
    { appUrl, item: owned(staffId) },
  );
  release();
  await expect.poll(() => completed).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(async (url) => {
        const { state } = await import(url);
        return state.detailSales?.selectionKey || "";
      }, appUrl),
    )
    .not.toContain(plainId);
  await expect(page.locator(".exact-sold-value")).not.toContainText("$120.00");
  expect(writes).toHaveLength(0);
});

test("CLIENT-05G replays a captured ECB rate with synthetic sales and no external traffic", async ({
  page,
}, testInfo) => {
  const proof = JSON.parse(
    await readFile(
      new URL(
        "../../docs/evidence/sol-client-05g/route-proof.json",
        import.meta.url,
      ),
    ),
  );
  const accepted =
    proof.first.status === 200 && proof.independent?.routeAgreement;
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (
      url.hostname === "127.0.0.1" ||
      url.hostname === "mica-copy-test.supabase.co"
    )
      return route.fallback();
    return route.abort();
  });
  await setup(page);
  await page.clock.install({
    time: new Date(proof.first.record?.fetchedAt ?? proof.completedAt),
  });
  let saleCalls = 0;
  let fxCalls = 0;
  const writes = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/api\/|\/rest\/v1\//.test(request.url())
    )
      writes.push(request.url());
  });
  await page.route("**/api/sales?*", (route) => {
    saleCalls += 1;
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    const rows = soldRows(
      lookup,
      [100, 120, 140],
      proof.independent?.effectiveDate ?? "2026-09-24",
    ).map((row) => ({ ...row, ingestedAt: proof.completedAt }));
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...soldPayload(lookup, rows),
        retrievedAt: proof.completedAt,
      }),
    });
  });
  await page.route("**/api/fx", (route) => {
    fxCalls += 1;
    return route.fulfill({
      status: accepted ? 200 : proof.first.status,
      contentType: "application/json",
      body: JSON.stringify(
        accepted ? proof.first.record : { code: proof.first.errorCode },
      ),
    });
  });
  await page.locator("[data-open-position]").first().click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await page.locator("#exactSaleEvidence > summary").click();
  const nativeBefore = {
    amount: await page.locator(".exact-sold-value > strong").textContent(),
    evidence: await page.locator("#exactSaleEvidence a").allTextContents(),
    currency: await page.locator("#detailValuationCurrency").inputValue(),
  };
  await page.locator("#toggleExactFxButton").click();
  if (accepted) {
    const eur = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "EUR",
    }).format(120 / proof.independent.usdPerEur);
    await expect(page.locator(".exact-fx")).toContainText(
      `About ${eur} · ECB rate dated ${proof.independent.effectiveDate}`,
    );
    expect(
      await page.evaluate(
        async (url) => (await import(url)).state.detailFx.conversion.rateRef,
        appUrl,
      ),
    ).toBe(proof.first.record.rateRef);
    await page.locator(".exact-fx summary").click();
    await expect(page.locator(".exact-fx details")).toContainText(
      "USD completed-sale evidence",
    );
  } else {
    await expect(page.locator(".exact-fx")).toContainText(
      "Equivalent unavailable",
    );
  }
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await expect(page.locator("#exactSaleEvidence a")).toHaveCount(3);
  expect({
    amount: await page.locator(".exact-sold-value > strong").textContent(),
    evidence: await page.locator("#exactSaleEvidence a").allTextContents(),
    currency: await page.locator("#detailValuationCurrency").inputValue(),
  }).toEqual(nativeBefore);
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-${accepted ? "real-rate-synthetic-sales" : "source-unavailable"}.png`),
    fullPage: true,
  });
  expect(saleCalls).toBe(1);
  expect(fxCalls).toBe(1);
  expect(writes).toHaveLength(0);
});

test("CLIENT-05F displays dated ECB equivalent without changing native sale evidence or saved data", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-09-29T00:30:00Z") });
  await page.route("https://www.ecb.europa.eu/**", (route) => route.abort());
  await page.route("https://api.pkmnprices.com/**", (route) => route.abort());
  let saleCalls = 0;
  let fxCalls = 0;
  const writes = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /\/api\/|\/rest\/v1\//.test(request.url())
    )
      writes.push(request.url());
  });
  await page.route("**/api/sales?*", (route) => {
    saleCalls += 1;
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    const amounts =
      lookup.currency === "EUR" ? [90, 100, 110] : [100, 120, 140];
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        soldPayload(lookup, [
          ...soldRows(lookup, amounts),
          ...soldRows(
            { ...lookup, currency: lookup.currency === "USD" ? "EUR" : "USD" },
            [70, 80, 90],
          ),
        ]),
      ),
    });
  });
  await page.route("**/api/fx", (route) => {
    fxCalls += 1;
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fxRecord()),
    });
  });
  await page.locator("[data-open-position]").first().click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await expect(page.locator("#toggleExactFxButton")).toHaveText(
    "Show EUR equivalent",
  );
  await expect(page.locator(".exact-fx")).not.toContainText("About");
  await page.locator("#toggleExactFxButton").click();
  await expect(page.locator(".exact-fx")).toContainText(
    "About €96.00 · ECB rate dated 2026-09-25",
  );
  expect(
    await page.evaluate(async (url) => {
      const { state } = await import(url);
      const {
        nativeAmount,
        nativeCurrency,
        amount,
        currency,
        rateRef,
        nativeEvaluatedAt,
      } = state.detailFx.conversion;
      return {
        nativeAmount,
        nativeCurrency,
        amount,
        currency,
        rateRef,
        nativeEvaluatedAt,
      };
    }, appUrl),
  ).toMatchObject({
    nativeAmount: 120,
    nativeCurrency: "USD",
    amount: 96,
    currency: "EUR",
    rateRef: `ecb-eurofxref-daily:2026-09-25:${"a".repeat(64)}`,
    nativeEvaluatedAt: expect.any(String),
  });
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await page.locator(".exact-fx summary").click();
  await expect(page.locator(".exact-fx details")).toContainText(
    "USD completed-sale evidence",
  );
  await expect(page.locator(".exact-fx a")).toHaveAttribute(
    "href",
    /ecb.europa.eu/,
  );
  await page.locator("#exactSaleEvidence > summary").click();
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "EUR sales are separate",
  );
  await mkdir(fxEvidenceDir, { recursive: true });
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-usd-equivalent.png`),
    fullPage: true,
  });
  expect(saleCalls).toBe(1);
  expect(fxCalls).toBe(1);
  await openValueContext(page);
  await page.locator("#detailValuationCurrency").selectOption("EUR");
  await expect(page.locator(".exact-fx")).toHaveCount(0);
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$125.00",
  );
  await expect(page.locator(".exact-sold-value")).toContainText("Original €100.00");
  expect(await page.evaluate(async url => (await import(url)).state.detailValuationContext.currency, appUrl)).toBe("EUR");
  await page.locator("#toggleExactFxButton").click();
  await expect(page.locator(".exact-fx")).toContainText("About $125.00");
  expect(saleCalls).toBe(2);
  expect(fxCalls).toBe(2);
  expect(writes).toHaveLength(0);
});

test("CLIENT-05F expires an open equivalent at UTC midnight and guards pending responses", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-09-29T23:59:58Z") });
  await page.route("https://www.ecb.europa.eu/**", (route) => route.abort());
  await page.route("https://api.pkmnprices.com/**", (route) => route.abort());
  await page.route("**/api/sales?*", (route) => {
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        soldPayload(lookup, soldRows(lookup, [100, 120, 140])),
      ),
    });
  });
  let release;
  let delay = true;
  let fxCalls = 0;
  await page.route("**/api/fx", async (route) => {
    fxCalls += 1;
    if (delay)
      await new Promise((resolve) => {
        release = resolve;
      });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fxRecord()),
    });
  });
  await page.locator("[data-open-position]").first().click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await page.locator("#toggleExactFxButton").click();
  await expect(page.locator(".exact-fx")).toContainText("Checking ECB rate");
  await page.evaluate(async (url) => {
    const { renderDetail } = await import(url);
    renderDetail();
  }, appUrl);
  await expect(page.locator(".exact-fx")).toContainText("Checking ECB rate");
  await expect.poll(() => Boolean(release)).toBe(true);
  release();
  await expect(page.locator(".exact-fx")).toContainText("About €96.00");
  await page.clock.runFor(3_000);
  await expect(page.locator(".exact-fx")).toContainText(
    "Equivalent unavailable",
  );
  await expect(page.locator(".exact-fx")).not.toContainText("About €96.00");
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  expect(fxCalls).toBe(1);
  delay = true;
  await page.locator("#retryExactFxButton").click();
  await expect.poll(() => fxCalls).toBe(2);
  await page.locator("#toggleExactFxButton").click();
  release();
  await expect(page.locator(".exact-fx")).not.toContainText("About");
  await page.locator("#toggleExactFxButton").click();
  await expect.poll(() => fxCalls).toBe(3);
  await page.locator(`[data-copy-id="${copyIds.b}"]`).click();
  release();
  await expect(page.locator(".exact-fx")).toHaveCount(0);
});

test("CLIENT-05F FX failure, retry and native refresh keep provenance paired", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-09-24T17:00:00Z") });
  await page.route("https://www.ecb.europa.eu/**", (route) => route.abort());
  await page.route("https://api.pkmnprices.com/**", (route) => route.abort());
  let salesCalls = 0;
  let fxCalls = 0;
  await page.route("**/api/sales?*", (route) => {
    salesCalls += 1;
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        soldPayload(
          lookup,
          soldRows(
            lookup,
            salesCalls === 1 ? [100, 120, 140] : [130, 150, 170],
          ),
        ),
      ),
    });
  });
  await page.route("**/api/fx", (route) => {
    fxCalls += 1;
    return route.fulfill(
      fxCalls === 1
        ? {
            status: 502,
            contentType: "application/json",
            body: '{"code":"rate_unavailable"}',
          }
        : {
            contentType: "application/json",
            body: JSON.stringify(fxRecord("2026-09-24")),
          },
    );
  });
  await page.locator("[data-open-position]").first().click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await page.locator("#toggleExactFxButton").click();
  await expect(page.locator(".exact-fx")).toContainText(
    "Equivalent unavailable",
  );
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await page.locator("#retryExactFxButton").click();
  await expect(page.locator(".exact-fx")).toContainText("About €96.00");
  expect(salesCalls).toBe(1);
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$150.00",
  );
  await expect(page.locator(".exact-fx")).toContainText("About €120.00");
  expect(
    await page.evaluate(
      async (url) => (await import(url)).state.detailFx.conversion.nativeAmount,
      appUrl,
    ),
  ).toBe(150);
  await expect(page.locator(".exact-fx")).not.toContainText("€96.00");
  expect(salesCalls).toBe(2);
  expect(fxCalls).toBe(2);
  await page.locator("#detailBack").click();
  await expect(page.locator(".exact-sold-value")).toBeHidden();
});

test("CLIENT-05F account and route changes reject delayed FX display", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-09-24T17:00:00Z") });
  await page.route("https://www.ecb.europa.eu/**", (route) => route.abort());
  await page.route("https://api.pkmnprices.com/**", (route) => route.abort());
  await page.route("**/api/sales?*", (route) => {
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        soldPayload(lookup, soldRows(lookup, [100, 120, 140])),
      ),
    });
  });
  let release;
  let calls = 0;
  await page.route("**/api/fx", async (route) => {
    calls += 1;
    await new Promise((resolve) => {
      release = resolve;
    });
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fxRecord("2026-09-24")),
    });
  });
  await page.locator("[data-open-position]").first().click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value > strong")).toHaveText(
    "$120.00",
  );
  await page.locator("#toggleExactFxButton").click();
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(async (url) => {
    const { state, renderDetail } = await import(url);
    state.session = { user: { id: "another-account" } };
    renderDetail();
  }, appUrl);
  release();
  await expect(page.locator(".exact-fx")).not.toContainText("About");
  await page.locator("#toggleExactFxButton").click();
  await page.evaluate(async (url) => {
    const { state } = await import(url);
    state.session = { user: { id: "11111111-1111-4111-8111-111111111111" } };
  }, appUrl);
  release = null;
  await page.locator("#toggleExactFxButton").click();
  await expect.poll(() => calls).toBe(2);
  await page.evaluate(async (url) => {
    const { routeTo } = await import(url);
    routeTo("collection", { focus: false });
  }, appUrl);
  release();
  await expect(page.locator(".exact-sold-value")).toBeHidden();
  expect(
    await page.evaluate(
      async (url) => (await import(url)).state.detailFx,
      appUrl,
    ),
  ).toBeNull();
});

test("CLIENT-05B offline UI replay keeps unresolved sample context unavailable", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(async (appUrl) => {
    const { state, renderCollection } = await import(appUrl);
    Object.assign(state.items[0], {
      name: "Pikachu",
      set: "McDonald's Promos 2023",
      number: "006/015",
      variant: "Holofoil",
      finish: "holofoil",
      edition: "unknown",
      promoType: "unknown",
      identityStatus: "unknown",
    });
    renderCollection();
  }, appUrl);
  let requests = 0;
  await page.route("**/api/sales?*", (route) => {
    requests += 1;
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...soldPayload(lookup, soldRows(lookup, [100, 120, 140])),
        receivedCount: 3,
        acceptedCount: 3,
        excludedCount: 0,
      }),
    });
  });
  await page.locator("[data-open-position]").first().click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Estimate unavailable",
  );
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Confirm the printing, grade and label",
  );
  await page.locator("#exactSaleEvidence > summary").click();
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "3 received · 3 accepted · 0 excluded before valuation",
  );
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "unverified context",
  );
  expect(requests).toBe(1);
});

test("exact sold value follows selected copy, currency and grade without inventory writes", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-09-24T12:00:00Z") });
  const writes = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/rpc/"))
      writes.push(request.url());
  });
  const lookups = [];
  await page.route("**/api/sales?*", (route) => {
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    lookups.push(lookup);
    if (
      lookup.grade === "10" &&
      lookup.currency === "USD" &&
      !lookup.gradeQualifier &&
      lookups.filter(
        (row) =>
          row.grade === "10" && row.currency === "USD" && !row.gradeQualifier,
      ).length === 2
    )
      return route.fulfill({
        status: 502,
        contentType: "application/json",
        body: '{"code":"provider_unavailable"}',
      });
    if (lookup.grade === "7")
      return route.fulfill({
        status: 502,
        contentType: "application/json",
        body: '{"code":"provider_unavailable"}',
      });
    const sales =
      lookup.grade === "6" || lookup.gradeQualifier
        ? []
        : lookup.grade === "9"
          ? soldRows(lookup, [100, 120])
          : lookup.grade === "8"
            ? soldRows(lookup, [100, 120, 140], "2026-08-20")
            : soldRows(
                lookup,
                lookup.currency === "EUR" ? [90, 110, 130] : [100, 120, 140],
              );
    if (
      lookup.grade === "10" &&
      lookup.currency === "USD" &&
      !lookup.gradeQualifier
    )
      sales.push(...soldRows({ ...lookup, currency: "EUR" }, [90, 110, 130]));
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(soldPayload(lookup, sales, true)),
    });
  });
  await page.locator("[data-open-position]").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Estimate unavailable",
  );
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText("$120.00");
  await page.locator("#exactSaleEvidence > summary").click();
  await expect(page.locator("#exactSaleEvidence a")).toHaveCount(3);
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "EUR sales are separate",
  );
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "Limited recent sample",
  );
  await expect(page.locator(".market-hero")).not.toContainText("Checking…");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await mkdir(valuationEvidenceDir, { recursive: true });
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-exact-usd.png`),
  });
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText("$120.00");
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Couldn’t refresh",
  );
  await openValueContext(page);
  await page.locator("#detailValuationCurrency").selectOption("EUR");
  await expect(page.locator(".exact-sold-value")).not.toContainText("$120.00");
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText("€110.00");
  await expect(page.locator(".market-hero")).not.toContainText("Checking…");
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-exact-eur.png`),
  });
  await openValueContext(page);
  await page.locator("#detailValuationGrade").fill("9");
  await openValueContext(page);
  await page.locator("#detailValuationGrade").press("Tab");
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "2 eligible sales",
  );
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Estimate unavailable",
  );
  await openValueContext(page);
  await page.locator("#detailValuationCurrency").selectOption("USD");
  await openValueContext(page);
  await page.locator("#detailValuationGrade").fill("8");
  await openValueContext(page);
  await page.locator("#detailValuationGrade").press("Tab");
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText("$120.00");
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Older completed sales",
  );
  await openValueContext(page);
  await page.locator("#detailValuationGrade").fill("7");
  await openValueContext(page);
  await page.locator("#detailValuationGrade").press("Tab");
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Couldn’t refresh",
  );
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Estimate unavailable",
  );
  await openValueContext(page);
  await page.locator("#detailValuationGrade").fill("6");
  await openValueContext(page);
  await page.locator("#detailValuationGrade").press("Tab");
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "0 eligible sales",
  );
  await openValueContext(page);
  await page.locator("#detailValuationGrade").fill("10");
  await openValueContext(page);
  await page.locator("#detailValuationGrade").press("Tab");
  await expect(page.locator("#detailValuationGrade")).toHaveValue("10");
  await openValueContext(page);
  await page.locator("#detailValuationQualifier").fill("Black Label");
  await openValueContext(page);
  await page.locator("#detailValuationQualifier").press("Tab");
  await expect(page.locator("#detailValuationQualifier")).toHaveValue(
    "Black Label",
  );
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "0 eligible sales",
  );
  await page.locator(`[data-copy-id="${copyIds.b}"]`).click();
  await expect(page.locator("#copyNavigationTitle")).toHaveText("Copy 2 of 3");
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Estimate unavailable",
  );
  expect(lookups.map((lookup) => lookup.currency)).toEqual([
    "USD",
    "USD",
    "EUR",
    "EUR",
    "USD",
    "USD",
    "USD",
    "USD",
  ]);
  expect(lookups.at(-1).gradeQualifier).toBe("Black Label");
  expect(writes).toHaveLength(0);
});

test("provider exclusions remain traceable through retry and clear with context", async ({
  page,
}, testInfo) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-09-24T12:00:00Z") });
  let calls = 0;
  await page.route("**/api/sales?*", (route) => {
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    calls += 1;
    if (calls === 2)
      return route.fulfill({
        status: 502,
        contentType: "application/json",
        body: "{}",
      });
    const sales =
      lookup.currency === "USD" ? soldRows(lookup, [100, 120, 140]) : [];
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ...soldPayload(lookup, sales),
        receivedCount: lookup.currency === "USD" ? 5 : 0,
        acceptedCount: sales.length,
        excludedCount: lookup.currency === "USD" ? 2 : 0,
        upstreamExclusions:
          lookup.currency === "USD"
            ? [
                { id: "pkmnprices:9001", reason: "context_mismatch" },
                { id: null, reason: "normalization_rejected" },
              ]
            : [],
      }),
    });
  });
  await page.locator("[data-open-position]").click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText("$120.00");
  await page.locator("#exactSaleEvidence > summary").click();
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "5 received · 3 accepted · 2 excluded before valuation",
  );
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "pkmnprices:9001 (context mismatch)",
  );
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "unidentified provider row (normalization rejected)",
  );
  await expect(page.locator("#exactSaleEvidence a")).toHaveCount(3);
  await mkdir(valuationEvidenceDir, { recursive: true });
  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-upstream-exclusions.png`),
    fullPage: true,
  });
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Couldn’t refresh",
  );
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "pkmnprices:9001 (context mismatch)",
  );
  await openValueContext(page);
  await page.locator("#detailValuationCurrency").selectOption("EUR");
  await expect(page.locator(".exact-sold-value")).not.toContainText("$120.00");
  await expect(page.locator("#exactSaleEvidence")).toHaveCount(0);
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "0 received · 0 accepted · 0 excluded before valuation",
  );
  await page.locator(`[data-copy-id="${copyIds.b}"]`).click();
  await expect(page.locator("#exactSaleEvidence")).toHaveCount(0);
  expect(calls).toBe(3);
});

test("late sale response for a previous physical copy cannot overwrite the selected copy", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install({ time: new Date("2026-09-24T12:00:00Z") });
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;
  await page.route("**/api/sales?*", async (route) => {
    calls += 1;
    const lookup = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    if (calls === 1) await firstGate;
    const rows = soldRows(
      lookup,
      calls === 1 ? [100, 120, 140] : [200, 220, 240],
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(soldPayload(lookup, rows)),
    });
  });
  await page.locator("[data-open-position]").click();
  await page.locator("#checkExactSalesButton").click();
  await expect.poll(() => calls).toBe(1);
  await page.locator(`[data-copy-id="${copyIds.b}"]`).click();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText("$220.00");
  releaseFirst();
  await page.waitForTimeout(100);
  await expect(page.locator("#copyNavigationTitle")).toHaveText("Copy 2 of 3");
  await expect(page.locator(".exact-sold-value")).toContainText("$220.00");
  await expect(page.locator(".exact-sold-value")).not.toContainText("$120.00");
});

test("grouped inventory reopens all copies and keeps the sold copy's history", async ({
  page,
}, testInfo) => {
  await setup(page, { soldB: true });
  await expect(page.locator(".ledger-row")).toHaveCount(1);
  await expect(page.locator(".ledger-row")).toContainText("2 active/1 sold");
  await expect(page.locator(".ledger-row")).toContainText("Varies by copy");
  await capture(page, testInfo, "grouped-inventory");

  await page.locator("[data-open-position]").click();
  await expect(page.locator("#copyNavigationTitle")).toHaveText("Copy 1 of 3");
  await expect(page.locator(".copy-navigation-strip button")).toHaveCount(3);
  await capture(page, testInfo, "copy-navigation");

  await page.locator("#nextCopyButton").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#copyNavigationTitle")).toHaveText("Copy 2 of 3");
  await expect(page.locator(`[data-copy-id="${copyIds.b}"]`)).toBeFocused();
  await expect(page.locator(".copy-facts")).toContainText("000002");
  await expect(page.locator(".copy-facts")).toContainText("2026-02-02");
  await expect(page.locator(".copy-facts")).toContainText("$20.00");
  await expect(page.locator(".copy-facts")).toContainText("Sold");

  await page.locator('details[data-detail-tool="purchases"] > summary').click();
  await expect(page.locator(".transaction-list")).toContainText("$20.00 paid");
  await expect(page.locator(".transaction-list")).toContainText(
    "Sold 2026-04-04",
  );
  await expect(page.locator(".transaction-list")).toContainText("$85.00");
  await expect(page.locator("#recordSaleButton")).toHaveCount(0);
  await capture(page, testInfo, "sold-copy-history");

  await page.locator(`[data-copy-id="${copyIds.c}"]`).click();
  await expect(page.locator(".copy-facts")).toContainText("000003");
  await expect(page.locator(".copy-facts")).toContainText("2026-03-03");
  await expect(page.locator(".copy-facts")).toContainText("$30.00");
});

test("horizontal swipe changes only the selected copy and keeps vertical gestures inert", async ({ page }, testInfo) => {
  await setup(page);
  await page.locator("[data-open-position]").click();
  const gesture = (start, end) => page.locator(".copy-facts").evaluate((area, points) => {
    const dispatch = (type, property, [clientX, clientY]) => {
      const event = new Event(type, { bubbles: true });
      Object.defineProperty(event, property, { value: [{ clientX, clientY }] });
      area.dispatchEvent(event);
    };
    dispatch("touchstart", "touches", points.start);
    dispatch("touchend", "changedTouches", points.end);
  }, { start, end });
  await gesture([300, 100], [100, 115]);
  await expect(page.locator("#copyNavigationTitle")).toHaveText("Copy 2 of 3");
  await expect(page.locator(".copy-facts")).toContainText("000002");
  if (process.env.MICA_CLIENT_07D_CAPTURE) {
    const dir = fileURLToPath(new URL("../../docs/evidence/sol-client-07d/", import.meta.url));
    await mkdir(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/copy-swipe-${testInfo.project.name}.png`, fullPage: true });
  }
  await gesture([200, 100], [150, 260]);
  await expect(page.locator("#copyNavigationTitle")).toHaveText("Copy 2 of 3");
  await gesture([100, 100], [300, 110]);
  await expect(page.locator("#copyNavigationTitle")).toHaveText("Copy 1 of 3");
  await expect(page.locator(".copy-facts")).toContainText("000001");
});

test("record sale posts one stable selected-copy id and leaves siblings untouched", async ({
  page,
}) => {
  let saleRequest;
  let releaseSale;
  const saleGate = new Promise((resolve) => {
    releaseSale = resolve;
  });
  await setup(page, {
    async onSale(input) {
      saleRequest = input;
      await saleGate;
    },
  });
  await page.locator("[data-open-position]").click();
  await page.locator(`[data-copy-id="${copyIds.b}"]`).click();
  await page.locator('details[data-detail-tool="purchases"] > summary').click();
  await page.locator("#recordSaleButton").click();
  await expect(page.locator("#sheetTitle")).toHaveText("Record a sale");
  await expect(page.locator("#bottomSheet")).toContainText("cert 000002");
  await expect(page.locator('#saleForm input[name="quantity"]')).toHaveValue(
    "1",
  );
  await page.locator("#saleDate").fill("2026-04-04");
  await page.locator("#salePrice").fill("100");
  await page.locator("#saleFees").fill("10");
  await page.locator("#saleShipping").fill("5");
  await page.locator("#saleMarketplace").fill("Card show");
  await page.locator('#saleForm button[type="submit"]').click();

  await expect.poll(() => saleRequest?.p_collection_item_id).toBe(copyIds.b);
  expect(saleRequest.p_quantity).toBe(1);
  expect(saleRequest.p_currency).toBe("USD");
  expect(saleRequest.p_idempotency_key).toMatch(/^[0-9a-f-]{36}$/i);
  expect(saleRequest.p_marketplace_fees).toBe("10");
  expect(saleRequest.p_shipping).toBe("5");
  const quantities = await page.evaluate(async (url) => {
    const { state } = await import(url);
    return state.items.map(({ uid, quantity }) => ({ uid, quantity }));
  }, appUrl);
  expect(quantities).toEqual([
    { uid: copyIds.a, quantity: 1 },
    { uid: copyIds.b, quantity: 1 },
    { uid: copyIds.c, quantity: 1 },
  ]);
  releaseSale();
});

test("CLIENT-05L replays the private direct-identity stop without sales or external traffic", async ({
  page,
}) => {
  const { privateDir, source } =
    await import("../../scripts/client-05l-proof.mjs");
  const ledger = JSON.parse(
    await readFile(`${privateDir}/attempt.json`, "utf8"),
  );
  expect(ledger.directGate).toBe("fail");
  expect(ledger.requests).toHaveLength(1);
  expect(ledger.rows).toBeNull();
  const normalized = normalizeTcgdexCard(source, "en");
  const variantId = "tcgdex:en:base2-1:variant:3a83wf50ts0izj268xwv3crwi";
  const snapshot = collectibleIdentitySnapshot(normalized, variantId);
  const item = {
    ...gradedCopy("a"),
    ...normalized,
    ...snapshot,
    uid: copyIds.a,
    cardState: "graded",
    status: "owned",
    gradingCompany: "PSA",
    grade: "10",
    gradeQualifier: "",
    certificationNumber: null,
    variantId,
    variant: normalized.variantOptions.find((row) => row.id === variantId)
      .label,
    currency: "USD",
    price: null,
    referencePrice: null,
    quotes: [],
    priceHistory: [],
  };
  const unexpected = [];
  const writes = [];
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (route.request().method() !== "GET") writes.push(route.request().url());
    if (["127.0.0.1", "mica-copy-test.supabase.co"].includes(host))
      return route.fallback();
    unexpected.push(route.request().url());
    return route.abort();
  });
  await setup(page);
  let salesRequests = 0;
  await page.route("**/api/sales?*", (route) => {
    salesRequests++;
    return route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        code: "provider_unavailable",
        error: "Direct identity not verified",
      }),
    });
  });
  await page.evaluate(
    async ({ appUrl, item }) => {
      const { state, openCardDetail } = await import(appUrl);
      state.items = [item];
      openCardDetail(item, true);
    },
    { appUrl, item },
  );
  await expect(page.locator("#checkExactSalesButton")).toBeVisible();
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Estimate unavailable",
  );
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Couldn’t refresh",
  );
  await expect(page.locator("#toggleExactFxButton")).toHaveCount(0);
  expect(salesRequests).toBe(1);
  expect(unexpected).toEqual([]);
  expect(writes).toEqual([]);
});

test("CLIENT-05M replays retained insufficient sales privately with no external traffic or writes", async ({
  page,
}) => {
  const { privateDir } = await import("../../scripts/client-05m-proof.mjs");
  const { source, lookup } = await import("../../scripts/client-05l-proof.mjs");
  const ledger = JSON.parse(
    await readFile(`${privateDir}/attempt.json`, "utf8"),
  );
  expect(ledger.membershipGate).toBe("pass");
  expect(ledger.apiStatus).toBe(200);
  expect(ledger.production.status).toBe("insufficient");
  expect(ledger.production.estimate).toBeNull();
  const card = normalizeTcgdexCard(source, "en");
  const variantId = "tcgdex:en:base2-1:variant:3a83wf50ts0izj268xwv3crwi";
  const snapshot = collectibleIdentitySnapshot(card, variantId);
  const item = {
    ...gradedCopy("a"),
    ...card,
    ...snapshot,
    uid: copyIds.a,
    name: lookup.name, // Private candidate-scoped browser replay; no saved alias.
    number: lookup.number,
    externalIds: { tcgdex: source.id, pkmnprices: lookup.pkmnpricesId },
    variantId,
    variant: lookup.variant,
    finish: lookup.finish,
    edition: lookup.edition,
    promoType: lookup.promoType,
    identityStatus: "exact",
    cardState: "graded",
    status: "owned",
    gradingCompany: "PSA",
    grade: "10",
    gradeQualifier: "",
    certificationNumber: null,
    currency: "USD",
    price: null,
    referencePrice: null,
    quotes: [],
    priceHistory: [],
  };
  const unexpected = [];
  const writes = [];
  await page.route("**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (route.request().method() !== "GET") writes.push(route.request().url());
    if (["127.0.0.1", "mica-copy-test.supabase.co"].includes(host))
      return route.fallback();
    unexpected.push(route.request().url());
    return route.abort();
  });
  await setup(page);
  await page.clock.install({ time: new Date(ledger.evaluatedAt) });
  let salesRequests = 0;
  await page.route("**/api/sales?*", (route) => {
    salesRequests++;
    const requested = JSON.parse(
      new URL(route.request().url()).searchParams.get("lookup"),
    );
    expect(requested).toMatchObject(lookup);
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ...ledger.api, hasMore: ledger.hasMore }),
    });
  });
  await page.evaluate(
    async ({ appUrl, item }) => {
      const { state, openCardDetail } = await import(appUrl);
      state.items = [item];
      openCardDetail(item, true);
    },
    { appUrl, item },
  );
  await page.locator("#checkExactSalesButton").click();
  await expect(page.locator(".exact-sold-value")).toContainText(
    "Estimate unavailable",
  );
  await expect(page.locator(".exact-sold-value")).toContainText(
    "0 eligible sales · at least 3 needed",
  );
  await page.locator("#exactSaleEvidence > summary").click();
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "10 received · 6 accepted · 4 excluded before valuation",
  );
  await expect(page.locator("#exactSaleEvidence")).toContainText(
    "Limited recent sample; more provider pages were not fetched",
  );
  await expect(page.locator("#toggleExactFxButton")).toHaveCount(0);
  expect(salesRequests).toBe(1);
  expect(unexpected).toEqual([]);
  expect(writes).toEqual([]);
});

async function openValueContext(page) {
  const context = page.locator('[data-detail-tool="valuation-context"]');
  if (await context.count() && !(await context.evaluate(element => element.open)))
    await context.locator("summary").click();
}

test("printing details show the saved release year and keep unknown years truthful", async ({ page }) => {
  await setup(page);
  await page.evaluate(async (url) => {
    const { state } = await import(url);
    state.items[0].release = "1999-01-09";
    state.items[1].release = "";
    state.items[2].release = "unconfirmed";
  }, appUrl);
  await page.locator("[data-open-position]").click();
  const year = page.locator(".identity-secondary > div").filter({ has: page.getByText("Year", { exact: true }) });
  await expect(page.locator(".identity-details")).not.toHaveAttribute("open");
  await page.locator(".identity-details > summary").click();
  await expect(year).toContainText("1999");
  await expect(year).not.toContainText("2026");
  await page.locator("#nextCopyButton").click();
  await page.locator(".identity-details > summary").click();
  await expect(year).toContainText("Unknown");
  await page.locator("#nextCopyButton").click();
  await page.locator(".identity-details > summary").click();
  await expect(year).toContainText("Unknown");
});

test("selected-copy sale reloads persisted history and reopens without changing siblings", async ({ page }, testInfo) => {
  let writes = 0;
  let committed = false;
  const copies = [gradedCopy("a"), gradedCopy("b"), gradedCopy("c")];
  await setup(page, { onSale: async () => { writes++; committed = true; } });
  await page.route("https://mica-copy-test.supabase.co/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/record_graded_copy_sale")) {
      const input = route.request().postDataJSON();
      expect(input.p_collection_item_id).toBe(copyIds.b);
      writes++; committed = true;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify("sale-copy-b") });
    }
    const sold = committed;
    const rows = copies.map((copy, index) => ({
      id: copy.uid, user_id: ownerId, card_id: copy.cardId, collectible_id: copy.collectibleId,
      variant_id: copy.variantId, identity_snapshot: copy, card_state: "graded", grader: "PSA", grade: 10,
      certification_number: copy.certificationNumber, quantity: sold && index === 1 ? 0 : 1,
      status: sold && index === 1 ? "sold" : "owned", valuation_basis: "market", currency: "USD",
      notes: `Copy ${index + 1} notes`, storage_location: `Legacy ${index + 1}`, created_at: copy.createdAt,
    }));
    const transactions = copies.map((copy) => ({
      id: `purchase-${copy.uid}`, collection_item_id: copy.uid, transaction_type: "purchase",
      transaction_date: copy.purchaseDate, quantity: 1, unit_price: copy.costBasis,
      subtotal: copy.costBasis, total_cost: copy.costBasis, currency: "USD", notes: `Purchase ${copy.certificationNumber} <original>`,
    }));
    if (sold) transactions.push({ id: "sale-copy-b", collection_item_id: copyIds.b,
      transaction_type: "sale", transaction_date: "2026-04-04", quantity: 1, unit_price: 100,
      subtotal: 100, marketplace_fees: 10, shipping: 5, net_proceeds: 85, currency: "USD", notes: "Sale <receipt>" });
    const lots = copies.map((copy, index) => ({
      id: `lot-${copy.uid}`, collection_item_id: copy.uid, purchase_transaction_id: `purchase-${copy.uid}`,
      acquired_at: copy.purchaseDate, acquired_at_known: true, cost_basis_known: true,
      quantity_acquired: 1, quantity_remaining: sold && index === 1 ? 0 : 1,
      total_cost: copy.costBasis, remaining_cost: sold && index === 1 ? 0 : copy.costBasis, currency: "USD",
    }));
    const table = url.pathname.split("/").at(-1);
    const data = table === "collection_items" ? rows
      : table === "collection_transactions" ? transactions
      : table === "purchase_lots" ? lots
      : table === "fifo_lot_allocations" && sold ? [{ sale_transaction_id: "sale-copy-b", purchase_lot_id: `lot-${copyIds.b}`, allocated_cost: 20, cost_basis_known: true }]
      : table === "get_collection_organization_summary" ? { positionCount: 3 }
      : [];
    await route.fulfill({ contentType: "application/json", headers: { "content-range": "0-2/3" }, body: JSON.stringify(data) });
  });
  await page.locator("[data-open-position]").click();
  await page.locator(`[data-copy-id="${copyIds.b}"]`).click();
  await page.locator('details[data-detail-tool="purchases"] > summary').click();
  await page.locator("#recordSaleButton").click();
  await page.locator("#saleDate").fill("2026-04-04");
  await page.locator("#salePrice").fill("100");
  await page.locator("#saleFees").fill("10");
  await page.locator("#saleShipping").fill("5");
  await page.locator('#saleForm button[type="submit"]').click();
  await expect(page.locator(".copy-facts")).toContainText("Sold");
  await expect(page.locator(".copy-facts")).toContainText("000002");
  await expect(page.locator("#recordSaleButton")).toHaveCount(0);
  if (!(await page.locator('details[data-detail-tool="purchases"]').evaluate((el) => el.open))) await page.locator('details[data-detail-tool="purchases"] > summary').click();
  await expect(page.locator(".transaction-list")).toBeVisible();
  await expect(page.locator(".transaction-list")).toContainText("Sold 2026-04-04");
  await expect(page.locator(".transaction-list")).toContainText("$85.00");
  await expect(page.locator(".transaction-notes")).toHaveText(["Purchase 000002 <original>", "Sale <receipt>"]);
  await expect(page.locator(".transaction-list original, .transaction-list receipt")).toHaveCount(0);
  const saved = await page.evaluate(async (url) => {
    const { state } = await import(url);
    return state.items.map(({ uid, quantity, certificationNumber, costBasis, allocatedSoldCost, notes, location }) => ({ uid, quantity, certificationNumber, costBasis, allocatedSoldCost, notes, location }));
  }, appUrl);
  expect(saved.map(({ uid, quantity }) => ({ uid, quantity }))).toEqual([
    { uid: copyIds.a, quantity: 1 }, { uid: copyIds.b, quantity: 0 }, { uid: copyIds.c, quantity: 1 },
  ]);
  expect(saved[0]).toMatchObject({ certificationNumber: "000001", costBasis: 10, notes: "Copy 1 notes", location: "Legacy 1" });
  expect(saved[1]).toMatchObject({ certificationNumber: "000002", allocatedSoldCost: 20 });
  expect(saved[2]).toMatchObject({ certificationNumber: "000003", costBasis: 30, notes: "Copy 3 notes", location: "Legacy 3" });
  await page.evaluate(() => document.activeElement?.blur());
  if (process.env.MICA_RESET_SALE_CAPTURE === "1") await page.screenshot({ path: `docs/evidence/client-reset-2026-10-03/sold-copy-${testInfo.project.name}-fixture.png`, fullPage: true });
  await page.evaluate(async (url) => { const { routeTo } = await import(url); routeTo("collection"); }, appUrl);
  await page.locator("[data-open-position]").click();
  await page.locator(`[data-copy-id="${copyIds.b}"]`).click();
  await expect(page.locator(".copy-facts")).toContainText("Sold");
  if (!(await page.locator('details[data-detail-tool="purchases"]').evaluate((el) => el.open))) await page.locator('details[data-detail-tool="purchases"] > summary').click();
  await expect(page.locator(".transaction-list")).toBeVisible();
  await expect(page.locator(".transaction-list")).toContainText("$85.00");
  await expect(page.locator(".transaction-notes")).toHaveText(["Purchase 000002 <original>", "Sale <receipt>"]);
  await expect(page.locator(".transaction-list original, .transaction-list receipt")).toHaveCount(0);
  expect(writes).toBe(1);
});

for (const cardState of ["raw", "sealed"]) {
  test(`${cardState} additional purchase keeps notes and stable retry without acquisition clutter`, async ({ page }, testInfo) => {
    await setup(page);
    const requests = [];
    await page.route("**/rest/v1/rpc/record_collection_purchase", (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill(requests.length === 1
        ? { status: 403, contentType: "application/json", body: JSON.stringify({ message: "fixture denied", code: "42501" }) }
        : { contentType: "application/json", body: JSON.stringify("purchase-fixture") });
    });
    await page.evaluate(async ({ url, cardState }) => {
      const { state, openPurchaseLotSheet } = await import(url);
      const item = { ...state.items[0], cardState, gradingCompany: null, grade: null, currency: "EUR" };
      openPurchaseLotSheet(item, { notes: 'Original <receipt> & "notes"' });
    }, { url: appUrl, cardState });
    await expect(page.locator("#lotAcquisitionMethod")).toBeHidden();
    await expect(page.locator("#purchaseLotForm select")).toHaveCount(0);
    await expect(page.locator("#purchaseLotForm")).not.toContainText("Trade");
    await expect(page.locator("#lotPaidField .money-input > span")).toHaveText("EUR");
    await page.locator("#lotTotalCost").fill("120.50");
    await page.locator("#purchaseLotSummary").click();
    await expect(page.locator("#lotNotes")).toHaveValue('Original <receipt> & "notes"');
    await expect(page.locator("#lotNotes")).toHaveAttribute("maxlength", "10000");
    await expect(page.locator("#purchaseLotForm receipt")).toHaveCount(0);
    await page.locator("#lotQuantity").fill("2");
    await page.locator("#lotDate").fill("2026-04-01");
    await page.locator("#lotNotes").fill("Two copies · private receipt");
    await page.locator('#purchaseLotForm button[type="submit"]').click();
    await expect(page.locator("#purchaseLotError")).toContainText("Your details are still here");
    await expect(page.locator("#lotNotes")).toHaveValue("Two copies · private receipt");
    await expect(page.locator("#lotTotalCost")).toHaveValue("120.50");
    await expect(page.locator("#lotQuantity")).toHaveValue("2");
    await expect(page.locator("#lotDate")).toHaveValue("2026-04-01");
    if (process.env.MICA_RESET_PURCHASE_CAPTURE === "1" && cardState === "sealed") await page.screenshot({ path: `docs/evidence/client-reset-2026-10-03/sealed-purchase-notes-${testInfo.project.name}-fixture.png`, fullPage: true });
    expect(requests[0]).toMatchObject({ p_collection_item_id: copyIds.a, p_quantity: 2, p_currency: "EUR", p_notes: "Two copies · private receipt", p_acquisition_method: "direct_purchase", p_transaction_date: "2026-04-01" });
    await page.locator('#purchaseLotForm button[type="submit"]').click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toEqual(requests[0]);
    await expect(page.locator("#purchaseLotForm")).toBeHidden();
  });
}

for (const [prices, estimate] of [[[100,110,120],110],[[225,215,230.2,219,220.46,220,222.5,260,209.99,190],220.23]]) test(`portfolio reads one graded context and detail charts actual matching sales without valuation writes (${estimate})`, async ({page}) => {
  await setup(page);
  let reads=0, valuationWrites=0;
  page.on("request",request=>{if(request.url().includes("/api/graded-valuation"))valuationWrites++;});
  await page.route("**/api/cards?*",async route=>{await new Promise(resolve=>setTimeout(resolve,300));const lookup=JSON.parse(new URL(route.request().url()).searchParams.get("lookups"))[0];if(lookup.clientId==="unavailable")return route.fulfill({status:502,contentType:"application/json",body:JSON.stringify({error:"Synthetic unavailable card"})});return route.fulfill({contentType:"application/json",body:JSON.stringify({cards:[{providerCardId:lookup.clientId,quotes:[],history:[],capabilities:{graded:"missing"}}]})});});
  await page.route("**/api/sales?*",route=>{
    reads++; const lookup=JSON.parse(new URL(route.request().url()).searchParams.get("lookup"));
    const sales=soldRows(lookup,prices,new Date(Date.now()-86400000).toISOString().slice(0,10));
    sales.forEach((sale,index)=>sale.soldAt=new Date(Date.now()-(index+1)*86400000).toISOString().slice(0,10));
    return route.fulfill({contentType:"application/json",body:JSON.stringify(soldPayload(lookup,sales))});
  });
  await page.evaluate(async ({appUrl,copies})=>{const {state,refreshLivePricing,openCardDetail}=await import(appUrl);state.session={...state.session,access_token:"fixture-read-token"};state.items=[{...copies[0],id:"unavailable",uid:"unavailable-copy",cardState:"raw",gradingCompany:"",grade:"",price:null,notes:"Unpriced entry preserved"},...copies];await refreshLivePricing();state.items.forEach(item=>delete item.exactSaleEvidence);openCardDetail(state.items.find(item=>item.cardState==="graded"),true);},{appUrl,copies:[gradedCopy("a"),gradedCopy("b")]});
  await expect(page.locator(".exact-sold-value")).toContainText("$"+estimate.toFixed(2));
  await expect(page.locator("#positionChart")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator(".detail-performance")).not.toContainText("Purchase cost or matching value missing");
  await expect(page.locator("#detailContent")).toContainText("Matching completed-sale prices");
  await page.locator(".history-values > summary").click();
  await expect(page.locator(".history-values tbody tr")).toHaveCount(prices.length);
  expect(await page.evaluate(async url=>(await import(url)).state.items.find(item=>item.id==="unavailable").notes,appUrl)).toBe("Unpriced entry preserved");
  expect(await page.evaluate(async url=>(await import(url)).state.items.find(item=>item.id==="unavailable").pricingStatus,appUrl)).toBe("error");
  expect(valuationWrites).toBe(0);
  // One collection read plus one independent detail read; copies never fan out.
  expect(reads).toBe(2);
  expect(await page.evaluate(async ({url,estimate})=>(await import(url)).state.items.filter(item=>item.cardState==="graded").every(item=>item.price===estimate),{url:appUrl,estimate})).toBe(true);
});

test('latest slab comp and full-width recorded history stay legible in light and dark mode',async({page},testInfo)=>{
 await setup(page);
 const dates=['2026-08-01','2026-08-10','2026-08-31'];
 await page.route('**/api/sales?*',route=>{
  const lookup=JSON.parse(new URL(route.request().url()).searchParams.get('lookup'));
  const rows=soldRows(lookup,[1000,1020,5000],dates[0]);
  rows.forEach((row,index)=>{row.soldAt=dates[index];row.saleType='fixed_price';});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(soldPayload(lookup,rows))});
 });
 await page.evaluate(async({appUrl,item})=>{const app=await import(appUrl);app.state.session={user:{id:'11111111-1111-4111-8111-111111111111'},access_token:'fixture'};document.body.classList.add('authenticated');document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');app.openCardDetail(item,true);},{appUrl,item:gradedCopy('a')});
 await expect(page.locator('.exact-sold-value > strong')).toHaveText('$5,000.00');
 await expect(page.locator('#positionChart')).toBeVisible();
 await expect(page.locator('.exact-sold-value .inline-source-link')).toContainText('2026-08-31');
 const bounds=await page.evaluate(async url=>{const {chartInstance:chart}=await import(url);return {min:chart.options.scales.x.min,max:chart.options.scales.x.max,radius:chart.data.datasets[0].pointRadius};},appUrl);
 expect(bounds).toEqual({min:Date.parse(dates[0]),max:Date.parse(dates[2]),radius:0});
 expect(await page.locator('.exact-sold-value .inline-source-link').evaluate(el=>parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThanOrEqual(12);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('slab-history-light.png'),fullPage:true});
 await page.evaluate(()=>document.body.dataset.appearance='dark');
 await page.screenshot({path:testInfo.outputPath('slab-history-dark.png'),fullPage:true});
});
