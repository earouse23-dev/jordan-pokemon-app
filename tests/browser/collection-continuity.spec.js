import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const appUrl = "/app.js?v=121";
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
      contents: `${source}\nexport { state, renderDetail, renderCollection, routeTo, bindEvents, saveCollectionViewState, restoreCollectionViewState, collectionViewStorageKey, applySession, supabase as testSupabase };`,
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
  await page.route("**/app.js?v=121", (route) =>
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
  await expect(page.locator("#detailTitle .detail-title-name")).toHaveText("Charizard");
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

for (const appearance of ["light", "dark"]) {
  test(`library favorites accept pointer and keyboard input without opening details (${appearance})`, async ({ page }) => {
    await openCollection(page);
    await page.evaluate(value => { document.body.dataset.appearance = value; }, appearance);
    const writes = [];
    page.on("request", request => {
      if (request.method() === "PATCH" && request.url().includes("/collection_items"))
        writes.push(request.postDataJSON());
    });
    const heart = page.locator(".ledger-favorite").first();
    if (test.info().project.use.hasTouch) await heart.tap();
    else await heart.click();
    await expect(heart).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#view-collection")).toBeVisible();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ tags: ["Favorites"] });
    await heart.press("Enter");
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1]).toEqual({ tags: [] });
    await expect(page.locator("#view-collection")).toBeVisible();
    await page.locator(".ledger-open-overlay").first().click();
    await expect(page.locator("#view-detail")).toBeVisible();
  });
}

for (const appearance of ["light", "dark"]) {
  test(`library tab hover stays readable (${appearance})`, async ({ page }) => {
    await openCollection(page);
    await page.evaluate(value => { document.body.dataset.appearance = value; }, appearance);
    const tab = page.locator('[data-condition-filter="Graded"]');
    await tab.hover();
    const colors = await tab.evaluate(e => {
      const s = getComputedStyle(e);
      const lum = color => color.match(/[\d.]+/g).slice(0,3).map(Number).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
      let surface = e;
      while (getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)' && surface.parentElement) surface = surface.parentElement;
      const values = [lum(s.color),lum(getComputedStyle(surface).backgroundColor)].sort((a,b)=>b-a);
      return { image:s.backgroundImage,contrast:(values[0]+.05)/(values[1]+.05) };
    });
    expect(colors.image).toBe('none');
    expect(colors.contrast).toBeGreaterThanOrEqual(4.5);
  });
}

test('leaving Settings clears its path and back/forward preserves the selected workspace', async ({page}) => {
  await openCollection(page);
  await page.getByRole('button',{name:'Open settings',exact:true}).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.locator('[data-sidebar-target="collection"]:visible, [data-route="collection"]:visible').first().click();
  expect(new URL(page.url()).pathname).toBe('/');
  expect(new URL(page.url()).hash).toBe('#collection');
  await expect(page.locator('#view-collection')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#view-profile')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#view-collection')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

for (const capability of ['active','held']) test(`background pricing retains focused collection actions (${capability})`, async ({page}) => {
  await openCollection(page);
  await page.evaluate(async ({url,capability})=>{const app=await import(url);app.state.gradingCapability=capability;app.renderCollection();},{url:appUrl,capability});
  const action=page.getByRole('button',{name:'Open Blastoise details',exact:true});
  await action.focus();
  const original=await action.elementHandle();
  const before=await page.evaluate(()=>window.scrollY);
  await page.evaluate(async url=>{const app=await import(url);app.state.items[1].price=275;app.state.items[1].retainedPrice=true;app.renderCollection();},appUrl);
  await expect(action).toBeFocused();
  expect(await original.evaluate(node=>node.isConnected)).toBe(true);
  expect(Math.abs(await page.evaluate(()=>window.scrollY)-before)).toBeLessThanOrEqual(2);
});


test('a price arriving during a card press does not swallow the open action', async ({page}) => {
  await openCollection(page);
  const action=page.getByRole('button',{name:'Open Blastoise details',exact:true});
  const box=await action.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.evaluate(async url=>{const app=await import(url);app.state.items[1].price=275;app.state.items[1].retainedPrice=true;app.renderCollection();},appUrl);
  await page.mouse.up();
  await expect(page.locator('#detailTitle')).toContainText('Blastoise');
});


test("saved identification photos replace artwork privately without rebuilding controls or persisting signed URLs", async ({ page }) => {
  await openCollection(page);
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let reads = 0, signs = 0;
  await page.route("**/rest/v1/collection_item_attachments?*", route => {
    reads++;
    const url = new URL(route.request().url());
    expect(url.searchParams.get("user_id")).toBe(`eq.${owner}`);
    return route.fulfill({contentType:"application/json",body:JSON.stringify([{collection_item_id:"11111111-1111-4111-8111-111111111111",storage_path:`${owner}/11111111-1111-4111-8111-111111111111/front.jpg`,caption:"Front identification photo · user confirmed"}])});
  });
  await page.route("**/storage/v1/object/sign/collection-item-files", route => {
    signs++;
    const body = route.request().postDataJSON();
    expect(body.paths).toHaveLength(1);
    expect(body.expiresIn).toBe(300);
    return route.fulfill({contentType:"application/json",body:JSON.stringify(body.paths.map(path=>({path,signedURL:`/object/sign/collection-item-files/${path}?token=private-fixture`})))});
  });
  await page.route("**/storage/v1/object/sign/collection-item-files/**", route => route.fulfill({status:200,contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"><rect width="63" height="88" fill="green"/></svg>'}));
  const button=page.getByRole("button",{name:"Open Charizard details",exact:true});
  await button.focus();
  const original=await button.elementHandle();
  await page.evaluate(async({appUrl,owner})=>{const app=await import(appUrl);app.state.session={user:{id:owner},access_token:"fixture"};app.renderCollection();},{appUrl,owner});
  await expect(page.locator('.ledger-row[data-id="11111111-1111-4111-8111-111111111111"]>.card-thumb')).toHaveAttribute("src",/private-fixture/);
  expect(await original.evaluate(el=>el.isConnected)).toBe(true);
  await expect(button).toBeFocused();
  await page.evaluate(async url=>(await import(url)).renderCollection(),appUrl);
  expect(reads).toBe(1);expect(signs).toBe(1);
  expect(await page.evaluate(async url=>JSON.stringify((await import(url)).state.items),appUrl)).not.toContain("private-fixture");
  await page.evaluate(async url=>(await import(url)).applySession(null),appUrl);
  expect(await page.locator('img[src*="private-fixture"]').count()).toBe(0);
  expect(await page.locator('body').evaluate(el=>el.innerHTML)).not.toContain('private-fixture');
});

test("a saved copy opened directly after save loads its private photo without an attachment-panel visit", async ({ page }) => {
  await openCollection(page);
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const uid = "11111111-1111-4111-8111-111111111111";
  await page.route("**/rest/v1/collection_item_attachments?*", route => route.fulfill({ contentType: "application/json", body: JSON.stringify([{ collection_item_id: uid, storage_path: `${owner}/${uid}/front.jpg`, caption: "Front identification photo · user confirmed" }]) }));
  await page.route("**/storage/v1/object/sign/collection-item-files", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(route.request().postDataJSON().paths.map(path => ({ path, signedURL: `/object/sign/collection-item-files/${path}?token=direct-private-fixture` }))) }));
  await page.route("**/storage/v1/object/sign/collection-item-files/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"/>' }));
  await page.evaluate(async ({ appUrl, owner }) => {
    const app = await import(appUrl);
    app.state.session = { user: { id: owner }, access_token: "fixture" };
    app.state.detailId = app.state.items[0].uid;
    app.state.detailCard = app.state.items[0];
    app.routeTo("detail");
  }, { appUrl, owner });
  await expect(page.locator('.detail-image img[data-private-photo]')).toHaveAttribute("src", /direct-private-fixture/);
});


for(const reduced of [false,true])test(`background value feedback keeps the real value and respects reduced motion (${reduced})`,async({page})=>{
  await openCollection(page);
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  await page.evaluate(async url=>{const app=await import(url);app.state.items[0].price=100;app.state.items[0].retainedPrice=true;app.renderCollection();},appUrl);
  await page.evaluate(async url=>{const app=await import(url);app.state.items[0].price=125;app.renderCollection();},appUrl);
  const value=page.locator('.ledger-row[data-id="11111111-1111-4111-8111-111111111111"] .position-price-grid strong');
  await expect(value).toHaveText('$125.00');
  const animations=await value.evaluate(el=>el.getAnimations().length);
  expect(animations).toBe(reduced?0:1);
});


test("background values do not repeatedly reload a failed artwork source",async({page})=>{
  await openCollection(page);
  let failed=0;
  await page.route('**/missing-artwork.jpg',route=>{failed++;return route.fulfill({status:404,body:''});});
  await page.evaluate(async url=>{const app=await import(url);app.state.items[0].thumb='/missing-artwork.jpg';app.state.items[0].image='/icons/icon.svg';app.renderCollection();},appUrl);
  const image=page.locator('.ledger-row[data-id="11111111-1111-4111-8111-111111111111"]>.card-thumb');
  await expect(image).toHaveAttribute('src',/icon.svg$/);
  const original=await image.elementHandle();
  await page.evaluate(async url=>{const app=await import(url);app.state.items[0].price=126;app.state.items[0].retainedPrice=true;app.renderCollection();},appUrl);
  expect(await original.evaluate(el=>el.isConnected)).toBe(true);expect(failed).toBe(1);
});


test('a background value sort waits until the pressed card has opened',async({page})=>{
  await openCollection(page);
  const action=page.getByRole('button',{name:'Open Charizard details',exact:true}),box=await action.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.evaluate(async url=>{const app=await import(url);app.state.items[0].price=300;app.state.items[0].retainedPrice=true;app.renderCollection();},appUrl);
  await page.mouse.up();await expect(page.locator('#detailTitle')).toContainText('Charizard');
});
