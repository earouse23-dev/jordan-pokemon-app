import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";
import { normalizeTcgdexCard } from "../../lib/providers/tcgdex.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appUrl = "/app.js?v=114";
const ownerId = "11111111-1111-4111-8111-111111111111";
const otherOwnerId = "99999999-9999-4999-8999-999999999999";
const baselineFile = process.env.MICA_CARD_PROFILE_BASELINE_FILE;
const captureLabel = process.env.MICA_CARD_PROFILE_CAPTURE || "";
const packet02Capture = process.env.MICA_PACKET_02_CAPTURE || "";
const packet02RevisionCapture =
  process.env.MICA_PACKET_02_REVISION_CAPTURE || "";
let bundle;
let baselineStyles = null;
const fixtureCardImage = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 315 440" role="img" aria-label="Yellow test creature card"><rect width="315" height="440" rx="18" fill="#e5c84f"/><rect x="18" y="18" width="279" height="404" rx="13" fill="#fff8d5" stroke="#614f25" stroke-width="6"/><text x="36" y="58" font-family="sans-serif" font-size="24" font-weight="700" fill="#332b19">Pikachu</text><circle cx="158" cy="205" r="92" fill="#f1ce36"/><path d="M94 151 69 71l61 53M220 151l27-80-63 53" fill="#f1ce36" stroke="#332b19" stroke-width="8"/><circle cx="126" cy="190" r="9" fill="#332b19"/><circle cx="190" cy="190" r="9" fill="#332b19"/><path d="M144 224q14 12 28 0" fill="none" stroke="#332b19" stroke-width="7" stroke-linecap="round"/><circle cx="105" cy="222" r="18" fill="#dc5147"/><circle cx="211" cy="222" r="18" fill="#dc5147"/><rect x="38" y="322" width="239" height="4" fill="#8f7b3c"/><text x="38" y="356" font-family="sans-serif" font-size="17" fill="#514522">Local profile fixture</text></svg>`;

test.use({ serviceWorkers: "block" });

test.beforeAll(async () => {
  const source = await readFile(
    baselineFile || new URL("../../app.js", import.meta.url),
    "utf8",
  );
  if (process.env.MICA_CARD_PROFILE_BASELINE_STYLES_FILE)
    baselineStyles = await readFile(
      process.env.MICA_CARD_PROFILE_BASELINE_STYLES_FILE,
      "utf8",
    );
  const result = await build({
    stdin: {
      contents: `${source.replace("void bootstrap();", "")}\nexport { valuationContextForItem, state, loadDisplayFx, applySession, bindEvents, bindSetSheet, openCardDetail, openSheet, renderCollection, renderDetail, restorePendingProfileAction, routeTo, setSheetMarkup, refreshWatchlistPricing, supabase as testSupabase };`,
      resolveDir: baselineFile ? baselineFile.slice(0, baselineFile.lastIndexOf("/")) : root,
      sourcefile: "app.js",
    },
    define: { __MICA_INTERNAL_CERTIFICATES__: "false" },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
  });
  bundle = result.outputFiles[0].text;
});

const exactCard = (overrides = {}) => ({
  id: "tcgdex:en:test-25",
  catalogIdentityId: "tcgdex:en:test-25",
  cardId: "22222222-2222-4222-8222-222222222222",
  collectibleId: "33333333-3333-4333-8333-333333333333",
  variantId: "33333333-3333-4333-8333-333333333333",
  name: "Pikachu",
  set: "Exact Test Set",
  number: "025/100",
  rarity: "Rare",
  language: "en",
  variant: "Reverse Holo",
  finish: "reverse_holofoil",
  edition: "unknown",
  promoType: "unknown",
  identityStatus: "needs_review",
  image: "/fixtures/profile-card.svg",
  thumb: "/fixtures/profile-card.svg",
  variants: ["Reverse Holo", "Holofoil"],
  variantOptions: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      collectibleId: "33333333-3333-4333-8333-333333333333",
      label: "Reverse Holo",
      finish: "reverse_holofoil",
      edition: "unknown",
      promoType: "unknown",
      language: "en",
      status: "needs_review",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      collectibleId: "44444444-4444-4444-8444-444444444444",
      label: "Holofoil",
      finish: "holofoil",
      edition: "unknown",
      promoType: "unknown",
      language: "en",
      status: "needs_review",
    },
  ],
  externalIds: { tcgdex: "test-25" },
  quotes: [],
  priceHistory: [],
  ...overrides,
});

const quote = (overrides = {}) => ({
  provider: "tcgplayer",
  aggregator: "pkmnprices",
  market: "tcgplayer",
  currency: "USD",
  finish: "reverseHolofoil",
  condition: "Near Mint",
  gradingCompany: null,
  grade: null,
  priceType: "market",
  amount: 10,
  observedAt: "2026-09-16T12:00:00.000Z",
  retrievedAt: "2026-09-17T12:00:00.000Z",
  attribution: "TCGplayer market via PkmnPrices",
  quality: { direct: true },
  ...overrides,
});

const pricingPayload = (
  quotes = [
    quote(),
    quote({ condition: "Lightly Played", amount: 7 }),
    quote({ condition: null, gradingCompany: "PSA", grade: "10", amount: 200 }),
    quote({
      condition: null,
      gradingCompany: "BGS",
      grade: "9.5",
      amount: 150,
    }),
    quote({ finish: "holofoil", amount: 999 }),
  ],
) => ({
  cards: [
    {
      externalIds: { tcgdex: "test-25", pkmnprices: "987" },
      quotes,
      history: [],
      historyStatus: "unavailable",
      capabilities: { raw: "live", graded: "live", current: "live" },
    },
  ],
});

function unresolvedFirstEditionCard() {
  const normalized = normalizeTcgdexCard(
    {
      id: "base1-4",
      localId: "4",
      name: "Charizard",
      set: { id: "base1", name: "Base Set" },
      variants: { holo: true, firstEdition: true },
    },
    "en",
  );
  const option = normalized.variantOptions.find(
    (candidate) => candidate.edition === "first_edition",
  );
  return exactCard({
    ...normalized,
    cardId: "99999999-9999-4999-8999-999999999999",
    catalogIdentityId: normalized.id,
    collectibleId: option.id,
    variantId: option.id,
    variant: option.label,
    finish: option.finish,
    edition: option.edition,
    promoType: option.promoType,
    identityStatus: option.status,
    variantOptions: [option],
    image: null,
    thumb: null,
  });
}

async function setup(
  page,
  { onCards, onSupabase, accountProfiles = null } = {},
) {
  await page.route("**/app.js?v=114", (route) =>
    route.fulfill({ contentType: "application/javascript", body: bundle }),
  );
  if (baselineStyles)
    await page.route("**/styles.css*", (route) =>
      route.fulfill({ contentType: "text/css", body: baselineStyles }),
    );
  await page.route("**/fixtures/profile-card.svg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: fixtureCardImage }),
  );
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__={supabaseUrl:"https://mica-card-profile.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("**/api/**", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/cards?*", async (route) => {
    if (onCards) return onCards(route);
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(pricingPayload()),
    });
  });
  await page.route(
    "https://mica-card-profile.supabase.co/**",
    async (route) => {
      if (onSupabase) {
        const handled = await onSupabase(route);
        if (handled) return;
      }
      const url = new URL(route.request().url());
      if (accountProfiles && url.pathname.endsWith("/rest/v1/profiles")) {
        if (route.request().method() === "POST") {
          const input = route.request().postDataJSON();
          const completedAt =
            input.onboarding_completed_at || "2026-09-17T12:00:00.000Z";
          accountProfiles[input.id] = { ...accountProfiles[input.id], onboardingCompletedAt: completedAt, preferences: input.preferences, displayCurrency: input.display_currency || accountProfiles[input.id]?.displayCurrency || "USD" };
          await route.fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              ...input,
              onboarding_completed_at: completedAt,
            }),
          });
          return;
        }
        const requestedOwner = String(url.searchParams.get("id") || "").replace(
          /^eq\./,
          "",
        );
        const fixture = accountProfiles[requestedOwner] || {};
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            id: requestedOwner,
            display_name: "Fixture collector",
            display_currency: fixture.displayCurrency || "USD",
            preferences: fixture.preferences || {},
            onboarding_completed_at: fixture.onboardingCompletedAt || null,
          }),
        });
        return;
      }
      await route.fulfill({ contentType: "application/json", body: "[]" });
    },
  );
  await page.goto("/");
  await page.evaluate(
    async ({ appUrl, ownerId }) => {
      const { state, bindEvents } = await import(appUrl);
      state.session = { user: { id: ownerId } };
      state.accountLoading = false;
      state.organization.status = "ready";
      state.gradingActivityStatus = "ready";
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      bindEvents();
    },
    { appUrl, ownerId },
  );
}

async function initializeAccount(page, activeOwnerId) {
  await page.evaluate(
    async ({ appUrl, activeOwnerId }) => {
      const { applySession, testSupabase } = await import(appUrl);
      testSupabase.auth.getUser = async () => ({
        data: { user: { id: activeOwnerId, email: "fixture@example.test" } },
        error: null,
      });
      await applySession({
        user: { id: activeOwnerId, email: "fixture@example.test" },
      });
    },
    { appUrl, activeOwnerId },
  );
}

async function openCard(page, card = exactCard(), preferOwned = false) {
  await page.evaluate(
    async ({ appUrl, card, preferOwned }) => {
      const { state, openCardDetail } = await import(appUrl);
      if (preferOwned) state.items = [card];
      openCardDetail(card, preferOwned);
    },
    { appUrl, card, preferOwned },
  );
  await expect(page.locator("#detailTitle")).toHaveText(card.name);
}

async function chooseGraded(page, grader, grade) {
  await openValueContext(page);
  await page.locator("#detailValuationState").selectOption("graded");
  await openValueContext(page);
  await page.locator("#detailValuationGrader").selectOption(grader);
  await openValueContext(page);
  await page.locator("#detailValuationGrade").fill(String(grade));
  await page.locator("#detailValuationGrade").dispatchEvent("change");
}

function watchEntry(overrides = {}) {
  return exactCard({
    watchlistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    cardState: "raw",
    rawCondition: "near_mint",
    condition: "Near Mint",
    gradingCompany: null,
    grade: null,
    currency: "USD",
    currentPrice: 10,
    referencePrice: 10,
    startingMarketPrice: 9,
    targetPrice: 8,
    pricingStatus: "live",
    pricingUpdatedAt: "2026-09-16T12:00:00.000Z",
    quotes: [quote()],
    priceHistory: [],
    notes: "",
    ...overrides,
  });
}

async function openWatchFromCollection(page, item) {
  await page.evaluate(
    async ({ appUrl, item }) => {
      const { state, renderCollection, routeTo } = await import(appUrl);
      state.items = [];
      state.watchlist = [item];
      state.ledgerView = "watchlist";
      state.sidebarTarget = "watchlist";
      state.query = "";
      state.setFilter = "";
      state.conditionFilter = "";
      state.languageFilter = "";
      state.graderFilter = "";
      routeTo("collection", { focus: false });
      renderCollection();
    },
    { appUrl, item },
  );
  await page.locator(`[data-watch-id="${item.watchlistId}"]`).click();
  await expect(page.locator("#detailTitle")).toHaveText(item.name);
}

function ownedEntry(overrides = {}) {
  return exactCard({
    uid: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    cardState: "raw",
    status: "owned",
    rawCondition: "near_mint",
    condition: "Near Mint",
    gradingCompany: null,
    grade: null,
    quantity: 1,
    currency: "USD",
    price: 10,
    pricingStatus: "live",
    pricingUpdatedAt: "2026-09-16T12:00:00.000Z",
    quotes: [quote()],
    transactions: [],
    lots: [{ id: "lot-raw", quantity: 1, unitCost: 4 }],
    tags: [],
    ...overrides,
  });
}

test("catalog profile loads a labeled reference without assessing the owned condition, then matches raw and graded evidence", async ({
  page,
}) => {
  const lookups = [];
  await setup(page, {
    onCards: async (route) => {
      lookups.push(
        JSON.parse(
          new URL(route.request().url()).searchParams.get("lookups"),
        )[0],
      );
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload()),
      });
    },
  });
  await openCard(page);
  await expect(page.locator(".market-hero")).toContainText("$10.00");
  await expect(page.locator(".detail-meta")).toContainText("Reverse Holo");
  await expect(page.locator(".detail-meta")).toContainText("English");
  await expect(page.locator(".identity-details")).not.toHaveAttribute("open");
  await expect(page.locator(".identity-details summary")).toContainText(
    "Printing details incomplete",
  );
  await page.locator(".identity-details summary").click();
  await expect(page.locator(".identity-secondary")).toContainText(
    "Reverse Holofoil",
  );
  await expect(page.locator(".identity-secondary")).toContainText("Unknown");
  await expect(page.locator(".market-hero")).toContainText("$10.00");
  await expect(page.locator('[data-detail-tool="valuation-context"]')).toContainText("reference price");
  expect(lookups).toHaveLength(1);
  expect(await page.evaluate(async appUrl => (await import(appUrl)).state.detailCard.condition, appUrl)).toBeUndefined();

  await openValueContext(page);
  await page.locator("#detailValuationCondition").selectOption("Near Mint");
  await expect(page.locator(".market-hero")).toContainText("$10.00");
  await expect(page.locator(".market-hero")).toContainText("TCGplayer");
  await expect(page.locator(".market-hero")).toContainText("Sep 16, 2026");
  await expect(page.locator(".market-hero")).toContainText("Stale evidence");
  expect(lookups.at(-1)).toMatchObject({
    language: "en",
    variant: "Reverse Holo",
    condition: "Near Mint",
  });

  await chooseGraded(page, "PSA", "10");
  await expect(page.locator(".market-hero")).toContainText("$200.00");
  expect(lookups.at(-1)).toMatchObject({ grader: "PSA", grade: "10" });

  await openValueContext(page);
  await page.locator("#detailValuationGrader").selectOption("BGS");
  await openValueContext(page);
  await page.locator("#detailValuationGrade").fill("9.5");
  await page.locator("#detailValuationGrade").dispatchEvent("change");
  await expect(page.locator(".market-hero")).toContainText("$150.00");
  expect(lookups.at(-1)).toMatchObject({ grader: "BGS", grade: "9.5" });
  await expect(page.locator("#detailValuationGrade")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("raw profile rejects graded-only evidence, then prices the matching slab context", async ({
  page,
}) => {
  const gradedQuote = quote({
    finish: "holofoil",
    condition: null,
    gradingCompany: "PSA",
    grade: "10",
    amount: 200,
  });
  await setup(page, {
    onCards: (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload([gradedQuote])),
      }),
  });
  const card = exactCard({
    variant: "Holofoil",
    finish: "holofoil",
    edition: "unlimited",
    promoType: "none",
    identityStatus: "exact",
    variantId: "44444444-4444-4444-8444-444444444444",
    collectibleId: "44444444-4444-4444-8444-444444444444",
  });
  await openCard(page, card);
  await openValueContext(page);
  await page.locator("#detailValuationCondition").selectOption("Near Mint");
  await expect(page.locator(".market-hero")).toContainText("Price unavailable");
  await expect(page.locator(".market-hero")).toContainText(
    "No matching price found for this card version",
  );
  await expect(page.locator(".market-hero")).not.toContainText("Checking");
  await expect(page.locator(".market-hero")).not.toContainText("$200.00");
  await expect(page.locator(".market-hero")).not.toContainText(
    "Limited evidence",
  );
  await page.locator('#detailMoreToolsButton').click();
  await page.locator('[data-detail-tool="prices"] > summary').click();
  const matchingPricesUnavailable = page
    .locator('[data-detail-tool="prices"] .detail-section')
    .first()
    .locator(".unavailable-panel");
  await expect(matchingPricesUnavailable).toContainText(
    "Mica did not use graded evidence",
  );
  await expect(matchingPricesUnavailable).not.toContainText("$200.00");
  if (captureLabel === "final-correction") {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
    await page.screenshot({
      fullPage: false,
      path: `docs/evidence/sol-packet-01/final-correction-terminal-${page.viewportSize().width}.png`,
    });
  }

  await chooseGraded(page, "PSA", "10");
  await expect(page.locator(".market-hero")).toContainText("$200.00");
});

for (const scenario of [
  {
    label: "raw",
    item: watchEntry(),
    responseQuote: quote(),
    expectedPrice: "$10.00",
    expectedLookup: { condition: "Near Mint", grader: "", grade: "" },
  },
  {
    label: "graded",
    item: watchEntry({
      watchlistId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      cardState: "graded",
      rawCondition: null,
      condition: "Graded",
      gradingCompany: "PSA",
      grade: "10",
      currency: "EUR",
      currentPrice: 185,
      referencePrice: 185,
      startingMarketPrice: 180,
      targetPrice: 175,
      quotes: [
        quote({
          currency: "EUR",
          condition: null,
          gradingCompany: "PSA",
          grade: "10",
          amount: 185,
        }),
      ],
    }),
    responseQuote: quote({
      currency: "EUR",
      condition: null,
      gradingCompany: "PSA",
      grade: "10",
      amount: 185,
    }),
    expectedPrice: "€185.00",
    expectedLookup: { condition: "", grader: "PSA", grade: "10" },
  },
]) {
  test(`Watchlist ${scenario.label} row opens its saved context and reaches a matching price`, async ({
    page,
  }) => {
    const lookups = [];
    await setup(page, {
      onCards: async (route) => {
        lookups.push(
          JSON.parse(
            new URL(route.request().url()).searchParams.get("lookups"),
          )[0],
        );
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(pricingPayload([scenario.responseQuote])),
        });
      },
    });
    await openWatchFromCollection(page, scenario.item);
    await expect(page.locator("#detailValuationState")).toHaveValue(
      scenario.item.cardState,
    );
    if (scenario.item.cardState === "graded") {
      await expect(page.locator("#detailValuationGrader")).toHaveValue("PSA");
      await expect(page.locator("#detailValuationGrade")).toHaveValue("10");
    } else {
      await expect(page.locator("#detailValuationCondition")).toHaveValue(
        "Near Mint",
      );
    }
    await expect.poll(() => lookups.length).toBeGreaterThan(0);
    expect(lookups.at(-1)).toMatchObject(scenario.expectedLookup);
    await expect(page.locator(".market-hero")).toContainText(
      scenario.expectedPrice,
    );
    await expect(page.locator(".market-hero")).not.toContainText("Checking");
    if (packet02Capture) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
      await page.screenshot({
        fullPage: false,
        path: `docs/evidence/sol-packet-02/${packet02Capture}-watch-${scenario.label}-${page.viewportSize().width}.png`,
      });
    }
  });
}

test("a lone raw watch never masquerades as the selected graded research context", async ({
  page,
}) => {
  let watchPayload;
  const watchMethods = [];
  await setup(page, {
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.endsWith("/rest/v1/card_watchlist")) return false;
      watchMethods.push(route.request().method());
      if (route.request().method() === "POST") {
        watchPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify([
            {
              ...watchPayload,
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              created_at: "2026-09-17T12:00:00.000Z",
              updated_at: "2026-09-17T12:00:00.000Z",
            },
          ]),
        });
        return true;
      }
      return false;
    },
  });
  await page.evaluate(
    async ({ appUrl, watched }) => {
      const { state } = await import(appUrl);
      state.watchlist = [watched];
    },
    { appUrl, watched: watchEntry() },
  );
  await openCard(page);
  await chooseGraded(page, "PSA", "10");
  await expect(page.locator("#watchCardButton")).toHaveText("Watch card");
  await page.locator("#watchCardButton").click();
  await expect(page.locator("#sheetTitle")).toHaveText("Watch this card");
  await expect(page.locator("#watchState")).toHaveValue("graded");
  await expect(page.locator("#watchGrader")).toHaveValue("PSA");
  await expect(page.locator("#watchGrade")).toHaveValue("10");
  await page
    .getByRole("button", { name: "Watch this card", exact: true })
    .click();
  await expect.poll(() => watchPayload).toBeTruthy();
  expect(watchMethods).toEqual(["POST"]);
  expect(watchPayload).toMatchObject({
    card_state: "graded",
    grader: "PSA",
    grade: "10",
    currency: "USD",
  });
  expect(watchPayload.identity_snapshot).toMatchObject({
    variantId: exactCard().variantId,
    language: "en",
    finish: "reverse_holofoil",
  });
});

test("sign-in interruption restores the exact PSA 10 Add draft and idempotent retry", async ({
  page,
}) => {
  const writes = [];
  const accountProfiles = {
    [ownerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z" },
  };
  await setup(page, {
    accountProfiles,
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.endsWith("/rpc/create_graded_copy_position"))
        return false;
      writes.push(route.request().postDataJSON());
      if (writes.length === 1)
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "interrupted response" }),
        });
      else
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
        });
      return true;
    },
  });
  await openCard(page);
  await chooseGraded(page, "PSA", "10");
  await page.locator("#addLibraryButton").click();
  await expect(page.locator("#positionQuantity")).toHaveValue("1");
  await expect(page.locator("#positionQuantity")).toHaveAttribute("readonly");
  await page.locator("#positionMoreSummary").click();
  await expect(page.locator("#positionAcquisitionMethod")).not.toBeVisible();
  await expect(page.locator("#positionAcquisitionMethod")).toHaveValue("direct_purchase");
  await page.locator("#positionTotalCost").fill("27.50");
  await page.locator("#positionDate").fill("2026-09-01");

  await page.evaluate(async (appUrl) => {
    const { applySession } = await import(appUrl);
    await applySession(null);
  }, appUrl);
  await expect(page.locator("#positionForm")).toHaveCount(0);
  expect(writes).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("mica:pending-profile-action")),
    ),
  ).toMatchObject({
    action: "add",
    ownerId,
    prefill: {
      cardState: "graded",
      grader: "PSA",
      grade: "10",
      quantity: "1",
      totalAcquisitionCost: "27.50",
      transactionDate: "2026-09-01",
    },
  });

  await initializeAccount(page, ownerId);
  await expect(page.locator("#positionState")).toHaveValue("graded");
  await expect(page.locator("#positionGrader")).toHaveValue("PSA");
  await expect(page.locator("#positionGrade")).toHaveValue("10");
  await expect(page.locator("#positionQuantity")).toHaveValue("1");
  await expect(page.locator("#positionTotalCost")).toHaveValue("27.50");
  await expect(page.locator("#positionDate")).toHaveValue("2026-09-01");
  expect(writes).toHaveLength(0);

  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(page.locator("#positionError")).toContainText(
    "Your details are still here",
  );
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].p_idempotency_key).toBe(writes[0].p_idempotency_key);
  expect(writes[1]).toMatchObject({
    p_variant_id: exactCard().variantId,
    p_card_state: "graded",
    p_grader: "PSA",
    p_grade: "10",
    p_quantity: 1,
  });
  expect(writes[1].p_identity).toMatchObject({
    language: "en",
    finish: "reverse_holofoil",
  });
});

test("sign-in interruption restores the exact graded Watch draft without writing", async ({
  page,
}) => {
  const writes = [];
  const accountProfiles = {
    [ownerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z" },
  };
  await setup(page, {
    accountProfiles,
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().method() !== "GET" &&
        (url.pathname.endsWith("/rest/v1/card_watchlist") ||
          url.pathname.endsWith("/rpc/create_collection_position"))
      )
        writes.push(route.request().url());
      return false;
    },
  });
  await openCard(page);
  await chooseGraded(page, "PSA", "10");
  await page.locator("#watchCardButton").click();
  await page.locator("#watchTarget").fill("175");
  await page.locator("#watchNotes").fill("Auction ceiling");
  await page.evaluate(async (appUrl) => {
    const { applySession } = await import(appUrl);
    await applySession(null);
  }, appUrl);
  expect(writes).toEqual([]);

  await initializeAccount(page, ownerId);
  await expect(page.locator("#watchState")).toHaveValue("graded");
  await expect(page.locator("#watchGrader")).toHaveValue("PSA");
  await expect(page.locator("#watchGrade")).toHaveValue("10");
  await expect(page.locator("#watchTarget")).toHaveValue("175");
  await expect(page.locator("#watchNotes")).toHaveValue("Auction ceiling");
  expect(writes).toEqual([]);
});

test("a different account cannot see or revive an interrupted private Watch draft", async ({
  page,
}) => {
  const actionWrites = [];
  const accountProfiles = {
    [otherOwnerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z" },
  };
  await setup(page, {
    accountProfiles,
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (
        route.request().method() !== "GET" &&
        (url.pathname.endsWith("/rest/v1/card_watchlist") ||
          url.pathname.endsWith("/rpc/create_collection_position"))
      )
        actionWrites.push(route.request().url());
      return false;
    },
  });
  await openCard(page, exactCard({ name: "Account A private card" }));
  await chooseGraded(page, "PSA", "10");
  await page.locator("#watchCardButton").click();
  await page.locator("#watchTarget").fill("175");
  await page.locator("#watchNotes").fill("Account A private draft note");
  await page.evaluate(async (appUrl) => {
    const { applySession } = await import(appUrl);
    await applySession(null);
  }, appUrl);

  await initializeAccount(page, otherOwnerId);
  await expect(page.locator("#watchlistForm")).toHaveCount(0);
  await expect(page.locator("#positionForm")).toHaveCount(0);
  await expect(page.getByText("Account A private draft note")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Account A private card" }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("mica:pending-profile-action"),
    ),
  ).toBeNull();

  await page.evaluate(async (appUrl) => {
    const { applySession } = await import(appUrl);
    await applySession(null);
  }, appUrl);
  await initializeAccount(page, otherOwnerId);
  await expect(page.locator("#watchlistForm")).toHaveCount(0);
  expect(actionWrites).toEqual([]);
});

test("a different account cannot see an interrupted private Add purchase draft", async ({
  page,
}) => {
  const actionWrites = [];
  const accountProfiles = {
    [otherOwnerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z" },
  };
  await setup(page, {
    accountProfiles,
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/rpc/create_graded_copy_position"))
        actionWrites.push(route.request().postDataJSON());
      return false;
    },
  });
  await openCard(page, exactCard({ name: "Account A purchase draft" }));
  await chooseGraded(page, "PSA", "10");
  await page.locator("#addLibraryButton").click();
  await expect(page.locator("#positionQuantity")).toHaveValue("1");
  await expect(page.locator("#positionQuantity")).toHaveAttribute("readonly");
  await page.locator("#positionMoreSummary").click();
  await page.locator("#positionTotalCost").fill("27.50");
  await page.locator("#positionDate").fill("2026-09-01");
  await page.evaluate(async (appUrl) => {
    const { applySession } = await import(appUrl);
    await applySession(null);
  }, appUrl);

  await initializeAccount(page, otherOwnerId);
  await expect(page.locator("#positionForm")).toHaveCount(0);
  await expect(page.locator('input[value="27.50"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Account A purchase draft" }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("mica:pending-profile-action"),
    ),
  ).toBeNull();
  expect(actionWrites).toEqual([]);
});

test("same-owner Watch draft waits for automatic account setup and preserves stored preferences", async ({
  page,
}) => {
  const actionWrites = [];
  let pendingProfile;
  const accountProfiles = { [ownerId]: { onboardingCompletedAt: null, preferences: { softwareMode: "seller", collectorGoal: "selling", experienceLevel: "professional", tradeValuePercent: 73 } } };
  await setup(page, {
    accountProfiles,
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/rest/v1/profiles") && route.request().method() === "POST") { pendingProfile = route; return true; }
      if (
        route.request().method() !== "GET" &&
        (url.pathname.endsWith("/rest/v1/card_watchlist") ||
          url.pathname.endsWith("/rpc/create_collection_position"))
      )
        actionWrites.push(route.request().url());
      return false;
    },
  });
  await openCard(page);
  await chooseGraded(page, "PSA", "10");
  await page.locator("#watchCardButton").click();
  await page.locator("#watchTarget").fill("175");
  await page.locator("#watchNotes").fill("Resume after onboarding");
  await page.evaluate(async (appUrl) => {
    const { applySession } = await import(appUrl);
    await applySession(null);
  }, appUrl);

  await initializeAccount(page, ownerId);
  await expect.poll(() => Boolean(pendingProfile)).toBe(true);
  await expect(page.locator("#onboardingDialog")).not.toBeVisible();
  await expect(page.locator('input[name="softwareMode"], input[name="experience"]')).toHaveCount(0);
  await expect(page.locator("#watchlistForm")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(sessionStorage.getItem("mica:pending-profile-action")),
    ),
  ).toMatchObject({ ownerId, notes: "Resume after onboarding" });

  const profileWrite = pendingProfile.request().postDataJSON();
  expect(profileWrite.preferences).toMatchObject(accountProfiles[ownerId].preferences);
  expect(profileWrite.onboarding_completed_at).toBeTruthy();
  await pendingProfile.fulfill({ contentType: "application/json", body: JSON.stringify(profileWrite) });
  await expect(page.locator("#onboardingDialog")).toHaveCount(0);
  await expect(page.locator("#watchState")).toHaveValue("graded");
  await expect(page.locator("#watchGrader")).toHaveValue("PSA");
  await expect(page.locator("#watchGrade")).toHaveValue("10");
  await expect(page.locator("#watchTarget")).toHaveValue("175");
  await expect(page.locator("#watchNotes")).toHaveValue(
    "Resume after onboarding",
  );
  expect(actionWrites).toEqual([]);
});

test("late account setup cannot replace another owner's profile or reopen a private draft", async ({ page }) => {
  let pendingProfile;
  const accountProfiles = {
    [ownerId]: { onboardingCompletedAt: null },
    [otherOwnerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z", preferences: { sellingFeePercent: 7 } },
  };
  await setup(page, { accountProfiles, onSupabase: async route => {
    if (new URL(route.request().url()).pathname.endsWith("/rest/v1/profiles") && route.request().method() === "POST") { pendingProfile = route; return true; }
    return false;
  } });
  await openCard(page);
  await chooseGraded(page, "PSA", "10");
  await page.locator("#watchCardButton").click();
  await page.locator("#watchNotes").fill("Private account A draft");
  await page.evaluate(async url => (await import(url)).applySession(null), appUrl);
  await initializeAccount(page, ownerId);
  await expect.poll(() => Boolean(pendingProfile)).toBe(true);
  await initializeAccount(page, otherOwnerId);
  await expect(page.locator("#onboardingDialog")).toHaveCount(0);
  await expect(page.locator("#appShell")).not.toHaveAttribute("aria-hidden", "true");
  expect(await page.locator("#appShell").evaluate(node => node.inert)).toBe(false);
  await pendingProfile.fulfill({ contentType: "application/json", body: JSON.stringify(pendingProfile.request().postDataJSON()) });
  await expect.poll(() => page.evaluate(async url => (await import(url)).state.profile?.id, appUrl)).toBe(otherOwnerId);
  expect(await page.evaluate(async url => (await import(url)).state.preferences.sellingFeePercent, appUrl)).toBe(7);
  await expect(page.locator("#watchlistForm")).toHaveCount(0);
  await expect(page.getByText("Private account A draft")).toHaveCount(0);
});

test("visible fee preference saves preserve hidden mode and trade values", async ({ page }, testInfo) => {
  const writes = [];
  const preferences = { softwareMode: "seller", collectorGoal: "selling", experienceLevel: "professional", tradeValuePercent: 73, quickSalePercent: 61, sellingFeePercent: 7 };
  await setup(page, { accountProfiles: { [ownerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z", preferences } }, onSupabase: async route => {
    if (new URL(route.request().url()).pathname.endsWith("/rest/v1/profiles") && route.request().method() === "POST") writes.push(route.request().postDataJSON());
    return false;
  } });
  await initializeAccount(page, ownerId);
  await page.evaluate(async url => (await import(url)).routeTo("profile"), appUrl);
  for (const id of ["defaultTradePercent", "defaultQuickSalePercent", "sharePortfolioButton", "insuranceReportButton", "softwareModeSettings"])
    await expect(page.locator("#" + id)).toBeHidden();
  await page.evaluate(() => {
    document.querySelector("#defaultTradePercent").value = "1";
    document.querySelector("#defaultQuickSalePercent").value = "2";
    document.querySelector("#defaultSellingFeePercent").value = "9";
    document.querySelector("#saveWorkflowDefaults").click();
  });
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].preferences).toMatchObject({ ...preferences, sellingFeePercent: 9 });
  expect(writes[0]).not.toHaveProperty("display_currency");
  await expect(page.locator("#workflowDefaultsStatus")).toHaveText("Saved to your Mica account.");
  await expect(page.locator("#gradingCalibration")).not.toHaveAttribute("open", "");
  const heading = await page.locator("#profileTitle").boundingBox();
  for (const id of ["collectionInsights", "gradingCalibration"]) {
    const secondary = await page.locator("#"+id).boundingBox();
    expect(secondary.y).toBeGreaterThan(heading.y + heading.height);
  }
  await page.screenshot({path:testInfo.outputPath("profile-viewport-fixture.png"),animations:"disabled"});
  await page.locator("#gradingCalibration > summary").click();
  await expect(page.locator("#gradingCalibrationSummary")).toBeVisible();
});

test("saved display currency converts the portfolio and survives profile reload without changing native items", async ({ page }, testInfo) => {
  const writes = [];
  const preferences = { softwareMode: "seller", tradeValuePercent: 73, sellingFeePercent: 7 };
  await setup(page, { accountProfiles: { [ownerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z", preferences } }, onSupabase: async route => {
    if (new URL(route.request().url()).pathname.endsWith("/rest/v1/profiles") && route.request().method() === "POST") writes.push(route.request().postDataJSON());
    return false;
  } });
  const date = new Date().toISOString().slice(0,10); const hash = "a".repeat(64);
  let rateCalls = 0;
  await page.route("**/api/fx", route => {
    if (++rateCalls === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "rate_unavailable" }) });
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ sourceId: "ecb-eurofxref-daily", sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", base: "EUR", quote: "USD", units: "USD per EUR", rate: 1.25, effectiveDate: date, fetchedAt: new Date().toISOString(), contentSha256: hash, rateRef: "ecb-eurofxref-daily:"+date+":"+hash }) }); });
  await initializeAccount(page, ownerId);
  await page.evaluate(async url => {
    const { state, renderCollection, routeTo } = await import(url);
    state.items = [
      { uid: "currency-usd", id: "sealed:usd", name: "USD sealed", cardState: "sealed", status: "owned", currency: "USD", quantity: 1, price: 100, pricingStatus: "live", costBasis: 60, quotes: [], transactions: [], lots: [], tags: [], thumb: "/icons/icon.svg" },
      { uid: "currency-eur", id: "sealed:eur", name: "EUR sealed", cardState: "sealed", status: "owned", currency: "EUR", quantity: 1, price: 100, pricingStatus: "live", costBasis: 90, quotes: [], transactions: [], lots: [], tags: [], thumb: "/icons/icon.svg" },
    ];
    renderCollection(); routeTo("dashboard");
  }, appUrl);
  await expect(page.locator("#retryDisplayFx")).toBeVisible();
  await expect(page.locator("#portfolioValue")).toHaveText("$100.00");
  await expect(page.locator("#portfolioChange")).toContainText("1 awaiting conversion");
  await page.locator("#retryDisplayFx").click();
  await expect(page.locator("#portfolioValue")).toHaveText("$225.00");
  await expect(page.locator("#retryDisplayFx")).toBeHidden();
  expect(rateCalls).toBe(2);
  await expect(page.locator("#portfolioChange")).toContainText("ECB rate " + date);
  await page.evaluate(async url => (await import(url)).routeTo("profile"), appUrl);
  await expect(page.locator("#currencyButton")).toHaveCount(0);
  await expect(page.locator("#everydaySettings #profileDisplayCurrency")).toBeVisible();
  await expect(page.locator("#everydaySettings #saveWorkflowDefaults")).toBeVisible();
  for (const id of ["profileDisplayCurrency", "saveWorkflowDefaults"]) expect(await page.locator("#"+id).evaluate(el=>parseFloat(getComputedStyle(el).borderTopRightRadius))).toBeGreaterThanOrEqual(10);
  await page.locator("#profileDisplayCurrency").selectOption("EUR");
  await page.locator("#saveWorkflowDefaults").click();
  await expect(page.locator("#workflowDefaultsStatus")).toHaveText("Saved to your Mica account.");
  expect(writes).toHaveLength(1);
  expect(writes[0].display_currency).toBe("EUR");
  expect(writes[0].preferences).toMatchObject(preferences);
  await page.locator("#everydaySettings").scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("everyday-currency-fixture.png"),animations:"disabled"});
  await page.evaluate(async url => (await import(url)).routeTo("dashboard"), appUrl);
  await expect(page.locator("#portfolioValue")).toHaveText("€180.00");
  await expect(page.locator("#portfolioToplineLabel")).toHaveText("Known EUR collection value");
  await expect(page.locator("#costBasis")).toHaveText("€138.00");
  await expect(page.locator("#gradedOwnedCount")).toHaveText("€138.00");
  const native = await page.evaluate(async url => (await import(url)).state.items.map(item => ({ currency:item.currency, price:item.price, costBasis:item.costBasis })), appUrl);
  expect(native).toEqual([{ currency:"USD", price:100, costBasis:60 }, { currency:"EUR", price:100, costBasis:90 }]);
  await page.evaluate(async url => (await import(url)).routeTo("collection"), appUrl);
  await expect(page.locator(".ledger-row").filter({ hasText: "USD sealed" }).locator(".position-price-grid")).toContainText("€80.00");
  await expect(page.locator(".ledger-row").filter({ hasText: "USD sealed" }).locator(".position-price-grid")).toContainText("€48.00");
  await expect(page.locator(".ledger-row").filter({ hasText: "USD sealed" }).locator(".position-price-grid strong").first()).toHaveAttribute("title", /Original \$100.00.*ECB rate/);
  await page.evaluate(async url => {
    const app = await import(url);
    app.openCardDetail(app.state.items[0], true);
  }, appUrl);
  await expect(page.locator(".market-hero > strong")).toHaveText("€80.00");
  await expect(page.locator(".detail-meta")).not.toContainText("Catalog ID");
  expect((await page.locator(".market-hero").innerText()).match(/Updated date unavailable/g)).toHaveLength(1);
  expect(await page.locator(".detail-identity").evaluate(element => getComputedStyle(element).boxShadow)).toBe("none");
  expect(await page.locator(".market-hero").evaluate(element => getComputedStyle(element).boxShadow)).toBe("none");
  await expect(page.locator(".owned-banner")).toContainText("€80.00 each");
  await expect(page.locator(".detail-performance")).toContainText("€32.00");
  await expect(page.locator(".detail-currency-note")).toContainText("ECB rate dated " + date);
  await page.screenshot({ path: testInfo.outputPath("selected-currency-detail-fixture.png"), fullPage: true });
  await page.locator('[data-detail-tool="purchases"] > summary').click();
  await expect(page.locator(".position-summary")).toContainText("$60.00");
  await expect(page.locator(".position-summary")).toContainText("€80.00 each");
  expect(await page.evaluate(async url => (await import(url)).state.items[0].currency, appUrl)).toBe("USD");
  await initializeAccount(page, ownerId);
  expect(await page.evaluate(async url => (await import(url)).state.profile.displayCurrency, appUrl)).toBe("EUR");
  await expect(page.locator("#profileDisplayCurrency")).toHaveValue("EUR");
});

for (const invalidDraft of [
  {
    name: "legacy ownerless",
    value: JSON.stringify({
      action: "watch",
      card: exactCard(),
      valuationContext: {
        cardState: "graded",
        condition: "",
        gradingCompany: "PSA",
        grade: "10",
        currency: "USD",
      },
      targetPrice: "175",
      notes: "Legacy private note",
      savedAt: Date.now(),
    }),
  },
  {
    name: "expired",
    value: JSON.stringify({
      action: "watch",
      ownerId,
      card: exactCard(),
      valuationContext: {
        cardState: "graded",
        condition: "",
        gradingCompany: "PSA",
        grade: "10",
        currency: "USD",
      },
      targetPrice: "175",
      notes: "Expired private note",
      savedAt: 1,
    }),
  },
  { name: "malformed", value: "{" },
]) {
  test(`initializer discards a ${invalidDraft.name} private draft`, async ({
    page,
  }) => {
    const accountProfiles = {
      [ownerId]: { onboardingCompletedAt: "2026-09-01T12:00:00.000Z" },
    };
    await setup(page, { accountProfiles });
    await page.evaluate((value) => {
      sessionStorage.setItem("mica:pending-profile-action", value);
    }, invalidDraft.value);
    await initializeAccount(page, ownerId);
    await expect(page.locator("#watchlistForm")).toHaveCount(0);
    await expect(page.locator("#positionForm")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("mica:pending-profile-action"),
      ),
    ).toBeNull();
  });
}

test("Library row opens the chosen saved position and research does not mutate either copy", async ({
  page,
}) => {
  const mutations = [];
  await setup(page, {
    onSupabase: async (route) => {
      if (
        route.request().method() !== "GET" &&
        !route.request().url().includes("/auth/")
      )
        mutations.push({
          method: route.request().method(),
          url: route.request().url(),
        });
      return false;
    },
  });
  const raw = ownedEntry();
  const graded = ownedEntry({
    uid: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    cardState: "graded",
    rawCondition: null,
    condition: "Graded",
    gradingCompany: "PSA",
    grade: "10",
    price: 200,
    quotes: [
      quote({
        condition: null,
        gradingCompany: "PSA",
        grade: "10",
        amount: 200,
      }),
    ],
    lots: [{ id: "lot-graded", quantity: 1, unitCost: 75 }],
  });
  await page.evaluate(
    async ({ appUrl, raw, graded }) => {
      const { state, renderCollection, routeTo } = await import(appUrl);
      state.items = [raw, graded];
      state.watchlist = [];
      state.ledgerView = "all";
      state.sidebarTarget = "collection";
      state.query = "Pikachu";
      state.setFilter = "Exact Test Set";
      document.querySelector("#collectionSearch").value = "Pikachu";
      routeTo("collection", { focus: false });
      renderCollection();
    },
    { appUrl, raw, graded },
  );
  await page.locator(`[data-open-position="${graded.uid}"]`).click();
  await expect(page.locator("#detailValuationState")).toHaveValue("graded");
  await expect(page.locator("#detailValuationGrader")).toHaveValue("PSA");
  await expect(page.locator("#detailValuationGrade")).toHaveValue("10");
  expect(
    await page.evaluate(
      async (appUrl) => (await import(appUrl)).state.detailId,
      appUrl,
    ),
  ).toBe(graded.uid);

  await openValueContext(page);
  await page.locator("#detailValuationState").selectOption("raw");
  await openValueContext(page);
  await page
    .locator("#detailValuationCondition")
    .selectOption("Lightly Played");
  await expect(page.locator(".market-hero")).toContainText("$7.00");
  expect(mutations).toEqual([]);
  expect(
    await page.evaluate(async (appUrl) => {
      const { state } = await import(appUrl);
      return state.items.map((item) => ({
        uid: item.uid,
        cardState: item.cardState,
        condition: item.condition,
        gradingCompany: item.gradingCompany,
        grade: item.grade,
        lots: item.lots,
      }));
    }, appUrl),
  ).toEqual([
    {
      uid: raw.uid,
      cardState: "raw",
      condition: "Near Mint",
      gradingCompany: null,
      grade: null,
      lots: raw.lots,
    },
    {
      uid: graded.uid,
      cardState: "graded",
      condition: "Graded",
      gradingCompany: "PSA",
      grade: "10",
      lots: graded.lots,
    },
  ]);
  await page.locator("#detailBack").click();
  await expect(page.locator("#view-collection")).toBeVisible();
  await expect(page.locator("#collectionSearch")).toHaveValue("Pikachu");
  expect(
    await page.evaluate(async (appUrl) => {
      const { state } = await import(appUrl);
      return { query: state.query, setFilter: state.setFilter };
    }, appUrl),
  ).toEqual({ query: "Pikachu", setFilter: "Exact Test Set" });
});

test("existing missing-set card link opens the exact catalog profile", async ({
  page,
}) => {
  const card = exactCard();
  await setup(page);
  await page.route("**/api/catalog?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ cards: [card] }),
    }),
  );
  await page.evaluate(async (appUrl) => {
    const { bindSetSheet, openSheet, setSheetMarkup } = await import(appUrl);
    const group = {
      name: "Exact Test Set",
      language: "en",
      ownedCount: 0,
      ownedIds: new Set(),
      percent: 0,
      catalog: {
        name: "Exact Test Set",
        totalCount: 1,
        cards: [
          {
            name: "Pikachu",
            localId: "25",
            thumb: "/fixtures/profile-card.svg",
            externalIds: { tcgdex: "test-25" },
          },
        ],
      },
    };
    openSheet(setSheetMarkup(group));
    bindSetSheet(group);
  }, appUrl);
  await page.locator('[data-set-card="test-25"]').click();
  await expect(page.locator("#detailTitle")).toHaveText("Pikachu");
  await expect(page.locator(".detail-meta")).toContainText("English");
  await expect(page.locator(".detail-meta")).toContainText("Reverse Holo");
  expect(
    await page.evaluate(
      async (appUrl) => (await import(appUrl)).state.detailCard.variantId,
      appUrl,
    ),
  ).toBe(card.variantId);
});

test("provider-normalized first-edition uncertainty stays unpriced through add and watch", async ({
  page,
}) => {
  let addPayload;
  let watchPayload;
  const offeredQuotes = [
    quote({ finish: "normal", amount: 123 }),
    quote({ finish: "1stEditionNormal", amount: 234 }),
    quote({ finish: "holofoil", amount: 345 }),
  ];
  await setup(page, {
    onCards: (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload(offeredQuotes)),
      }),
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/rpc/create_collection_position")) {
        addPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
        });
        return true;
      }
      if (
        url.pathname.endsWith("/rest/v1/card_watchlist") &&
        route.request().method() === "POST"
      ) {
        watchPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify([
            {
              ...watchPayload,
              id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              created_at: "2026-09-17T12:00:00.000Z",
              updated_at: "2026-09-17T12:00:00.000Z",
            },
          ]),
        });
        return true;
      }
      return false;
    },
  });
  const card = unresolvedFirstEditionCard();
  await openCard(page, card);
  await expect(page.locator(".detail-meta")).toContainText("1st Edition");
  await expect(page.locator(".detail-meta")).not.toContainText("firstEdition");
  await openValueContext(page);
  await page.locator("#detailValuationCondition").selectOption("Near Mint");
  await expect(page.locator(".market-hero")).toContainText("Price unavailable");
  await expect(page.locator(".market-hero")).toContainText(
    "No matching price found for this card version",
  );
  await expect(page.locator(".market-hero")).not.toContainText("Checking");
  await expect(page.locator(".market-hero")).not.toContainText("$123.00");
  await expect(page.locator(".market-hero")).not.toContainText("$234.00");
  await expect(page.locator(".market-hero")).not.toContainText("$345.00");
  await page.locator(".identity-details summary").click();
  await expect(page.locator(".identity-secondary")).toContainText(
    "FinishUnknown",
  );
  await expect(page.locator(".identity-secondary")).toContainText(
    "Edition / stamp1st Edition",
  );

  await page.locator("#addLibraryButton").click();
  await expect(page.locator("#positionVariantId")).toHaveValue(card.variantId);
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect.poll(() => addPayload).toBeTruthy();
  expect(addPayload.p_variant_id).toBeNull();
  expect(addPayload.p_identity).toMatchObject({
    variantId: card.variantId,
    finish: "unknown",
    edition: "first_edition",
    promoType: "unknown",
  });

  await expect(page.locator("#view-scan")).toBeVisible();
  await openCard(page, card);
  await page.locator("#watchCardButton").click();
  await page
    .getByRole("button", { name: "Watch this card", exact: true })
    .click();
  await expect.poll(() => watchPayload).toBeTruthy();
  expect(watchPayload.variant_id).toBeNull();
  expect(watchPayload.identity_snapshot).toMatchObject({
    variantId: card.variantId,
    finish: "unknown",
    edition: "first_edition",
    promoType: "unknown",
  });
});

test("owned raw value stays separate through graded loading, failure, and retry", async ({
  page,
}) => {
  const gradedRequests = [];
  const ownershipWrites = [];
  await setup(page, {
    onCards: async (route) => {
      const lookup = JSON.parse(
        new URL(route.request().url()).searchParams.get("lookups"),
      )[0];
      if (lookup.grader === "PSA") {
        gradedRequests.push(route);
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload()),
      });
    },
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (
        /collection_items|create_collection_position/.test(url.pathname) &&
        route.request().method() !== "GET"
      )
        ownershipWrites.push(route.request().method());
      return false;
    },
  });
  const owned = exactCard({
    uid: "55555555-5555-4555-8555-555555555555",
    cardState: "raw",
    status: "owned",
    rawCondition: "near_mint",
    condition: "Near Mint",
    quantity: 1,
    currency: "USD",
    price: 10,
    pricingStatus: "live",
    pricingUpdatedAt: "2026-09-16T12:00:00.000Z",
    quotes: [quote()],
    transactions: [],
    lots: [],
    tags: [],
  });
  await openCard(page, owned, true);
  await expect(page.locator(".market-hero")).toContainText("$10.00");
  await chooseGraded(page, "PSA", "10");
  await expect.poll(() => gradedRequests.length).toBeGreaterThan(0);
  await expect(page.locator(".market-hero")).toContainText("Checking…");
  await expect(page.locator(".market-hero")).not.toContainText("$10.00");
  await expect(page.locator(".owned-banner")).toContainText(
    "Current price unavailable",
  );

  const failedCount = gradedRequests.length;
  await Promise.all(
    gradedRequests.map((route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: "{}",
      }),
    ),
  );
  await expect(page.locator(".market-hero")).toContainText("Price unavailable");
  await expect(page.locator(".market-hero")).toContainText(
    "Could not check a live price",
  );
  await expect(page.locator(".market-hero")).not.toContainText("$10.00");
  await expect(page.locator(".owned-banner")).toContainText(
    "Current price unavailable",
  );

  const providerIndex = page.locator('[data-detail-tool="provider-index"]');
  if (await providerIndex.count() && !(await providerIndex.evaluate(element => element.open)))
    await providerIndex.locator("summary").click();
  await page.locator("#retryPricingButton").click();
  await expect.poll(() => gradedRequests.length).toBeGreaterThan(failedCount);
  await Promise.all(
    gradedRequests.slice(failedCount).map((route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload()),
      }),
    ),
  );
  await expect(page.locator(".market-hero")).toContainText("$200.00");
  await expect(page.locator(".owned-banner")).toContainText(
    "Current price unavailable",
  );
  const saved = await page.evaluate(async (appUrl) => {
    const { state } = await import(appUrl);
    const item = state.items[0];
    return {
      cardState: item.cardState,
      rawCondition: item.rawCondition,
      condition: item.condition,
      gradingCompany: item.gradingCompany || "",
      grade: item.grade || "",
      price: item.price,
    };
  }, appUrl);
  expect(saved).toEqual({
    cardState: "raw",
    rawCondition: "near_mint",
    condition: "Near Mint",
    gradingCompany: "",
    grade: "",
    price: null,
  });
  expect(ownershipWrites).toEqual([]);
});

test("late raw pricing cannot replace the newly selected graded context", async ({
  page,
}) => {
  const pending = [];
  await setup(page, {
    onCards: (route) => {
      const lookup = JSON.parse(
        new URL(route.request().url()).searchParams.get("lookups"),
      )[0];
      pending.push({ route, lookup });
    },
  });
  await openCard(page);
  await openValueContext(page);
  await page.locator("#detailValuationCondition").selectOption("Near Mint");
  await expect
    .poll(() => pending.some(({ lookup }) => lookup.condition === "Near Mint"))
    .toBe(true);
  await chooseGraded(page, "PSA", "10");
  await expect
    .poll(() =>
      pending.some(
        ({ lookup }) => lookup.grader === "PSA" && lookup.grade === "10",
      ),
    )
    .toBe(true);
  const gradedRequests = pending.filter(
    ({ lookup }) => lookup.grader === "PSA" && lookup.grade === "10",
  );
  await Promise.all(
    gradedRequests.map(({ route }) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload()),
      }),
    ),
  );
  await expect(page.locator(".market-hero")).toContainText("$200.00");
  const rawRequests = pending.filter(
    ({ lookup }) => lookup.condition === "Near Mint",
  );
  await Promise.all(
    rawRequests.map(({ route }) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload([quote({ amount: 10 })])),
      }),
    ),
  );
  await expect(page.locator(".market-hero")).toContainText("$200.00");
  await expect(page.locator(".market-hero")).not.toContainText("$10.00");
});

test("late raw-condition evidence cannot replace a newer owned research context", async ({
  page,
}) => {
  const delayed = [];
  await setup(page, {
    onCards: async (route) => {
      const lookup = JSON.parse(
        new URL(route.request().url()).searchParams.get("lookups"),
      )[0];
      if (["Lightly Played", "Damaged"].includes(lookup.condition)) {
        delayed.push({ route, lookup });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(pricingPayload()),
      });
    },
  });
  const owned = exactCard({
    uid: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    cardState: "raw",
    status: "owned",
    rawCondition: "near_mint",
    condition: "Near Mint",
    quantity: 1,
    currency: "USD",
    price: 10,
    pricingStatus: "live",
    pricingUpdatedAt: "2026-09-16T12:00:00.000Z",
    quotes: [quote()],
    transactions: [],
    lots: [],
    tags: [],
  });
  await openCard(page, owned, true);
  await expect(page.locator(".market-hero")).toContainText("$10.00");

  await openValueContext(page);
  await page
    .locator("#detailValuationCondition")
    .selectOption("Lightly Played");
  await expect
    .poll(() =>
      delayed.some(({ lookup }) => lookup.condition === "Lightly Played"),
    )
    .toBe(true);
  await expect(page.locator(".market-hero")).toContainText("Checking…");
  await expect(page.locator(".market-hero")).not.toContainText("$10.00");

  await openValueContext(page);
  await page.locator("#detailValuationCondition").selectOption("Damaged");
  await expect
    .poll(() => delayed.some(({ lookup }) => lookup.condition === "Damaged"))
    .toBe(true);
  const lightlyPlayed = delayed.filter(
    ({ lookup }) => lookup.condition === "Lightly Played",
  );
  await Promise.all(
    lightlyPlayed.map(({ route }) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          pricingPayload([quote({ condition: "Lightly Played", amount: 7 })]),
        ),
      }),
    ),
  );
  await expect(page.locator(".market-hero")).toContainText("Checking…");
  await expect(page.locator(".market-hero")).not.toContainText("$7.00");
  await expect(page.locator(".market-hero")).not.toContainText("$10.00");

  const damaged = delayed.filter(
    ({ lookup }) => lookup.condition === "Damaged",
  );
  await Promise.all(
    damaged.map(({ route }) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(
          pricingPayload([quote({ condition: "Damaged", amount: 3 })]),
        ),
      }),
    ),
  );
  await expect(page.locator(".market-hero")).toContainText("$3.00");
  await expect(page.locator(".owned-banner")).toContainText(
    "Current price unavailable",
  );
});

test("add and watch payloads retain the selected canonical identity and unknown raw condition", async ({
  page,
}) => {
  let addPayload;
  let watchPayload;
  await setup(page, {
    onSupabase: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/rpc/create_collection_position")) {
        addPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify("66666666-6666-4666-8666-666666666666"),
        });
        return true;
      }
      if (
        url.pathname.endsWith("/rest/v1/card_watchlist") &&
        route.request().method() === "POST"
      ) {
        watchPayload = route.request().postDataJSON();
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify([
            {
              ...watchPayload,
              id: "77777777-7777-4777-8777-777777777777",
              created_at: "2026-09-17T12:00:00.000Z",
              updated_at: "2026-09-17T12:00:00.000Z",
            },
          ]),
        });
        return true;
      }
      return false;
    },
  });
  const card = exactCard({
    id: "tcgdex:ja:test-25",
    catalogIdentityId: "tcgdex:ja:test-25",
    collectibleId: "88888888-8888-4888-8888-888888888888",
    variantId: "88888888-8888-4888-8888-888888888888",
    language: "ja",
    variant: "Holofoil",
    finish: "holofoil",
    variantOptions: [
      {
        id: "88888888-8888-4888-8888-888888888888",
        collectibleId: "88888888-8888-4888-8888-888888888888",
        label: "Holofoil",
        finish: "holofoil",
        edition: "unknown",
        promoType: "unknown",
        language: "ja",
        status: "needs_review",
      },
    ],
  });
  await openCard(page, card);
  await expect(page.locator(".detail-meta")).toContainText("Japanese");
  await expect(page.locator(".detail-meta")).toContainText("Holofoil");
  await page.locator("#addLibraryButton").click();
  await expect(page.locator("#positionVariantId")).toHaveValue(card.variantId);
  await expect(page.locator("#positionCondition")).toHaveValue("unknown");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect.poll(() => addPayload).toBeTruthy();
  expect(addPayload).toMatchObject({
    p_card_id: card.cardId,
    p_variant_id: card.variantId,
    p_card_state: "raw",
    p_raw_condition: null,
  });
  expect(addPayload.p_identity).toMatchObject({
    collectibleId: card.collectibleId,
    variantId: card.variantId,
    language: "ja",
    finish: "holofoil",
    edition: "unknown",
    promoType: "unknown",
  });

  await expect(page.locator("#view-scan")).toBeVisible();
  await openCard(page, card);
  await page.locator("#watchCardButton").click();
  await expect(page.locator("#watchCondition")).toHaveValue("unknown");
  await page
    .getByRole("button", { name: "Watch this card", exact: true })
    .click();
  await expect.poll(() => watchPayload).toBeTruthy();
  expect(watchPayload).toMatchObject({
    card_id: card.cardId,
    variant_id: card.variantId,
    card_state: "raw",
    raw_condition: null,
  });
  expect(watchPayload.identity_snapshot).toMatchObject({
    collectibleId: card.collectibleId,
    variantId: card.variantId,
    language: "ja",
    finish: "holofoil",
    edition: "unknown",
    promoType: "unknown",
  });
});

for (const card of [
  exactCard({
    name: "Professor's Research",
    rarity: "Trainer",
    image: null,
    thumb: null,
  }),
  exactCard({
    name: "Basic Lightning Energy",
    rarity: "Energy",
    image: null,
    thumb: null,
  }),
]) {
  test(`${card.rarity} profile works without a Pokémon character or image`, async ({
    page,
  }) => {
    await setup(page);
    await openCard(page, card);
    await expect(page.locator("#detailTitle")).toHaveText(card.name);
    await expect(page.locator(".detail-identity img")).toHaveAttribute(
      "src",
      "./icons/icon.svg",
    );
    await expect(page.locator(".detail-image")).toContainText(
      "Image unavailable",
    );
    await expect(page.locator("#addLibraryButton")).toBeVisible();
    await expect(page.locator("#watchCardButton")).toBeVisible();
  });
}

test("focused valuation controls stay visible above the sticky actions", async ({
  page,
}) => {
  await setup(page);
  await openCard(page);
  await openValueContext(page);
  await page.locator("#detailValuationCondition").selectOption("Near Mint");
  await expect(page.locator(".market-hero")).toContainText("$10.00");
  const expectAboveActions = async (selector) => {
    const control = page.locator(selector);
    await expect(control).toBeFocused();
    await expect
      .poll(() =>
        page.evaluate((target) => {
          const element = document.querySelector(target);
          const actions = document.querySelector(".detail-sticky-action");
          const rect = element.getBoundingClientRect();
          const actionRect = actions.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= actionRect.top;
        }, selector),
      )
      .toBe(true);
  };
  await expectAboveActions("#detailValuationCondition");
  await openValueContext(page);
  await page.locator("#detailValuationState").selectOption("graded");
  await expectAboveActions("#detailValuationState");
  await openValueContext(page);
  await page.locator("#detailValuationGrader").selectOption("PSA");
  await expectAboveActions("#detailValuationGrader");
  await page.locator("#detailValuationGrade").evaluate((control) => {
    control.value = "10";
    control.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expectAboveActions("#detailValuationGrade");
  await expect(page.locator("#addLibraryButton")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("captures revised normal and uncertain profile viewports", async ({
  page,
}) => {
  test.skip(
    !captureLabel,
    "Evidence capture is run explicitly by the packet workflow.",
  );
  await setup(page);
  const width = page.viewportSize().width;
  const states = [
    {
      name: "normal",
      card: exactCard({
        identityStatus: "exact",
        edition: "unlimited",
        promoType: "none",
      }),
      expected: "$10.00",
    },
    {
      name: "uncertain",
      card: unresolvedFirstEditionCard(),
      expected: "Price unavailable",
    },
  ];
  for (const state of states) {
    await openCard(page, state.card);
    await openValueContext(page);
    await page.locator("#detailValuationCondition").selectOption("Near Mint");
    await expect(page.locator(".market-hero")).toContainText(state.expected);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
    await expect(page.locator("#detailTitle")).toBeInViewport();
    await expect(page.locator(".market-hero")).toBeInViewport();
    await expect(page.locator("#detailValuationState")).toBeInViewport();
    await expect(page.locator("#addLibraryButton")).toBeVisible();
    if (state.name === "normal")
      expect(
        await page.locator(".detail-image img").evaluate((image) => ({
          src: image.getAttribute("src"),
          loaded: image.complete && image.naturalWidth > 0,
        })),
      ).toEqual({ src: "/fixtures/profile-card.svg", loaded: true });
    await page.screenshot({
      fullPage: false,
      path: `docs/evidence/sol-packet-01/${captureLabel}-${state.name}-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  }
});

test("captures Packet 02 PSA action-prefill viewports", async ({ page }) => {
  test.skip(
    !packet02Capture,
    "Evidence capture is run explicitly by the packet workflow.",
  );
  await setup(page);
  await openCard(page);
  await chooseGraded(page, "PSA", "10");
  const width = page.viewportSize().width;

  await page.locator("#addLibraryButton").click();
  await expect(page.locator("#positionState")).toHaveValue("graded");
  await expect(page.locator("#positionGrader")).toHaveValue("PSA");
  await expect(page.locator("#positionGrade")).toHaveValue("10");
  await page.screenshot({
    fullPage: false,
    path: `docs/evidence/sol-packet-02/${packet02Capture}-action-add-${width}.png`,
  });
  await page.locator("#positionCancel").click();

  await page.locator("#watchCardButton").click();
  await expect(page.locator("#watchState")).toHaveValue("graded");
  await expect(page.locator("#watchGrader")).toHaveValue("PSA");
  await expect(page.locator("#watchGrade")).toHaveValue("10");
  await page.screenshot({
    fullPage: false,
    path: `docs/evidence/sol-packet-02/${packet02Capture}-action-watch-${width}.png`,
  });
});

test("captures owner-safe automatic account setup and resumed Watch viewports", async ({
  page,
}) => {
  test.skip(
    !packet02RevisionCapture,
    "Evidence capture is run explicitly by the packet workflow.",
  );
  const accountProfiles = { [ownerId]: { onboardingCompletedAt: null } };
  await setup(page, { accountProfiles });
  await openCard(page);
  await chooseGraded(page, "PSA", "10");
  await page.locator("#watchCardButton").click();
  await page.locator("#watchTarget").fill("175");
  await page.locator("#watchNotes").fill("Resume after onboarding");
  await page.evaluate(async (appUrl) => {
    const { applySession } = await import(appUrl);
    await applySession(null);
  }, appUrl);
  await initializeAccount(page, ownerId);

  const width = page.viewportSize().width;
  await expect(page.locator("#onboardingDialog")).toHaveCount(0);
  await expect(page.locator("#watchNotes")).toHaveValue(
    "Resume after onboarding",
  );
  await expect(page.locator("#bottomSheet")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({
    fullPage: false,
    path: `docs/evidence/sol-packet-02/${packet02RevisionCapture}-resumed-watch-${width}.png`,
  });
});

async function openValueContext(page) {
  const context = page.locator('[data-detail-tool="valuation-context"]');
  if (await context.count() && !(await context.evaluate(element => element.open)))
    await context.locator("summary").click();
}


test("card result leads with price and recovers provider images through the validated proxy", async ({ page }) => {
  let proxyReads = 0;
  await setup(page);
  await page.route("https://images.pkmnprices.com/cards/test.webp", route => route.abort());
  await page.route("**/api/card-image?*", route => { proxyReads++; return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jf1sAAAAASUVORK5CYII=", "base64") }); });
  await openCard(page, exactCard({ image: "https://images.pkmnprices.com/cards/test.webp", thumb: null }));
  await expect(page.locator(".market-hero")).toContainText("$10.00");
  await expect.poll(() => page.locator(".detail-image img").evaluate(i => i.complete && i.naturalWidth > 0 && new URL(i.src).pathname === "/api/card-image")).toBe(true);
  expect(proxyReads).toBeGreaterThan(0);
  const positions = await page.evaluate(() => ({ price: document.querySelector(".market-hero").getBoundingClientRect().top, chart: document.querySelector("#cardPriceHistory").getBoundingClientRect().top, metadata: document.querySelector(".detail-secondary").getBoundingClientRect().top }));
  expect(positions.price).toBeLessThan(positions.chart);
  expect(positions.metadata).toBeGreaterThan(positions.chart);
  await expect(page.getByRole("combobox", { name: "Price history timeframe" })).toHaveValue("all");
  await expect(page.locator("#cardHistoryRange option")).toHaveText(["1 month", "6 months", "1 year", "All time"]);
});


test("public display rate completes across session changes instead of stranding loading", async ({ page }) => {
  await setup(page);
  const day = new Date().toISOString().slice(0, 10), hash = "a".repeat(64);
  await page.route("**/api/fx", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ sourceId: "ecb-eurofxref-daily", sourceUrl: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", base: "EUR", quote: "USD", units: "USD per EUR", rate: 1.2, effectiveDate: day, fetchedAt: new Date(Date.now() - 1000).toISOString(), contentSha256: hash, rateRef: `ecb-eurofxref-daily:${day}:${hash}` }) }));
  await openCard(page);
  const status = await page.evaluate(async ({ appUrl, otherOwnerId }) => {
    const app = await import(appUrl);
    app.state.profile = { ...(app.state.profile || {}), displayCurrency: "EUR" };
    app.state.displayFxStatus = "idle";
    const pending = app.loadDisplayFx();
    app.state.session = { user: { id: otherOwnerId } };
    await pending;
    return app.state.displayFxStatus;
  }, { appUrl, otherOwnerId });
  expect(status).toBe("ready");
});

for (const phase of ["while loading", "after loading"]) test(`same-account Safari auth announcement preserves card prices and history ${phase}`, async ({page}) => {
 const fresh=quote({amount:100,observedAt:new Date().toISOString(),retrievedAt:new Date().toISOString()}); const payload=pricingPayload([fresh]); payload.cards[0].history=[{...fresh,amount:90,recordedAt:"2026-10-01T00:00:00Z"},{...fresh,recordedAt:"2026-10-02T00:00:00Z"}]; payload.cards[0].historyStatus="live";
 let pending; await setup(page, {onCards: route => { pending=route; }}); await initializeAccount(page, ownerId); await openCard(page); await expect.poll(()=>Boolean(pending)).toBe(true);
 if (phase === "after loading") { await pending.fulfill({contentType:"application/json",body:JSON.stringify(payload)}); await expect(page.locator(".market-hero")).toContainText("$100.00"); }
 const before = await page.evaluate(async url=>{const app=await import(url); const before={route:app.state.route,id:app.state.detailId}; await app.applySession({user:{id:app.state.session.user.id},access_token:"refreshed-fixture-token"}); return before;},appUrl);
 expect(before.route).toBe("detail"); await expect(page.locator("#detailTitle")).toHaveText("Pikachu");
 if (phase === "while loading") await pending.fulfill({contentType:"application/json",body:JSON.stringify(payload)});
 await expect(page.locator(".market-hero")).toContainText("$100.00"); await expect(page.locator("#positionChart")).toBeVisible();
 expect(await page.evaluate(async url=>{const app=await import(url);return app.state.session.access_token;},appUrl)).toBe("refreshed-fixture-token");
});

test("a scan condition enum renders its exact quote and history without changing the copy facts", async ({ page }) => {
  const lookups=[];
  await page.route("https://images.pkmnprices.com/cards/scan-fixture.webp",route=>route.fulfill({contentType:"image/svg+xml",body:fixtureCardImage}));
  await setup(page,{onCards:async route=>{
    lookups.push(JSON.parse(new URL(route.request().url()).searchParams.get("lookups"))[0]);
    const payload=pricingPayload();payload.cards[0].history=[{provider:"tcgplayer",currency:"USD",condition:"Near Mint",finish:"reverseHolofoil",amount:10,recordedAt:"2026-10-07T12:00:00Z"},{provider:"tcgplayer",currency:"USD",condition:"Near Mint",finish:"reverseHolofoil",amount:11,recordedAt:"2026-10-08T12:00:00Z"}];payload.cards[0].images={large:"https://images.pkmnprices.com/cards/scan-fixture.webp",small:"https://images.pkmnprices.com/cards/scan-fixture.webp"};payload.cards[0].historyStatus="live";
    await route.fulfill({contentType:"application/json",body:JSON.stringify(payload)});
  }});
  await page.evaluate(async appUrl=>{
    const app=await import(appUrl),card={id:"tcgdex:en:test-25",name:"Pikachu",set:"Exact Test Set",number:"025/100",language:"en",variant:"Reverse Holo",finish:"reverse_holofoil",edition:"unknown",cardState:"raw",condition:"near_mint",externalIds:{tcgdex:"test-25"}};
    app.openCardDetail(card,false,app.valuationContextForItem(card));
  },appUrl);
  await expect(page.locator(".market-hero")).toContainText("$10.00");
  await expect(page.locator("#positionChart")).toBeVisible();
  await expect(page.locator(".detail-image img")).toHaveAttribute("src",/images\.pkmnprices\.com/);
  expect(lookups).toHaveLength(1);expect(lookups[0].condition).toBe("Near Mint");
  expect(await page.evaluate(async appUrl=>(await import(appUrl)).state.detailCard.condition,appUrl)).toBe("near_mint");
});

test("Watch All time preserves full recorded history through a current-price-only refresh", async ({page}) => {
  const requests=[];
  await setup(page,{onCards:async route=>{
    const url=new URL(route.request().url());requests.push(url.searchParams.get("history"));
    const lookup=JSON.parse(url.searchParams.get("lookups"))[0];
    const payload=pricingPayload([quote()]);payload.cards[0].providerCardId=lookup.clientId;
    payload.cards[0].historyStatus=url.searchParams.get("history")==="full"?"live":"not_requested";
    payload.cards[0].history=url.searchParams.get("history")==="full"?[{...quote(),recordedAt:"2025-01-01T00:00:00Z",amount:5},{...quote(),recordedAt:"2026-10-01T00:00:00Z",amount:9}]:[];
    await route.fulfill({contentType:"application/json",body:JSON.stringify(payload)});
  }});
  await openWatchFromCollection(page,watchEntry());
  await expect(page.locator("#cardHistoryRange")).toHaveValue("all");
  await expect(page.locator("#cardPriceHistory")).toContainText("2025");
  expect(requests[0]).toBe("full");
  await page.evaluate(async url=>{const app=await import(url);await app.refreshWatchlistPricing();},appUrl);
  await expect(page.locator("#cardPriceHistory")).toContainText("2025");
  expect(await page.evaluate(async url=>(await import(url)).state.watchlist[0].priceHistory.some(point=>point.recordedAt.startsWith("2025-01-01")),appUrl)).toBe(true);
  await page.locator("#detailMoreToolsButton").click();
  await expect(page.locator('[data-detail-tool="grading-comparison"]')).toHaveCount(0);
});

test("All time with one observation explains missing history without an empty chart or grading comparison", async ({page},testInfo) => {
  await setup(page);
  await openCard(page);
  await expect(page.locator("#cardPriceHistory")).toContainText("Only one recorded price is available");
  await expect(page.locator("#positionChart")).toHaveCount(0);
  await page.locator("#detailMoreToolsButton").click();
  await expect(page.locator('[data-detail-tool="grading-comparison"]')).toHaveCount(0);
  await expect(page.getByText("Compare grading outcomes",{exact:true})).toHaveCount(0);
  await page.screenshot({path:`docs/evidence/client-reset-2026-10-03/checkpoint-94-${testInfo.project.name}.png`,fullPage:true});
});
