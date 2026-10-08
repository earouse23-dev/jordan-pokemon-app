import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appUrl = "/app.js?v=114";
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
const copyId = "44444444-4444-4444-8444-444444444444";
const config = {
  supabaseUrl: "https://mica-native-test.supabase.co",
  supabasePublishableKey: "sb_publishable_synthetic_only",
  apiOrigin: "https://mica-api.example.invalid",
  authCallback: "https://mica-beta.example.invalid/auth/native-return",
};
const evidence = fileURLToPath(
  new URL("../../docs/evidence/sol-client-07/", import.meta.url),
);
let bundle;
test.beforeAll(async () => {
  const source = await readFile(
    new URL("../../app.js", import.meta.url),
    "utf8",
  );
  const result = await build({
    stdin: {
      contents: `${source}\nexport { state, applySession, nativeRuntime, openDeviceCamera, openCardDetail, openAccountDeletionSheet, openNextQueuedCard, approvedImageProxyPath, routeTo, supabase as testSupabase, signOut, sendPasswordReset, resendSignupConfirmation };`,
      resolveDir: fileURLToPath(new URL("../../", import.meta.url)),
      sourcefile: "app.js",
    },
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    define: {
      __MICA_NATIVE__: "true",
      __MICA_INTERNAL_CERTIFICATES__: "false",
    },
    // Plugin transport alone is replaced; application and Supabase SDK are real.
    plugins: [
      {
        name: "synthetic-native-transport",
        setup(builder) {
          builder.onResolve({ filter: /^@capacitor\// }, ({ path }) => ({
            path,
            namespace: "native-fixture",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "native-fixture" },
            ({ path }) => {
              const code =
                path === "@capacitor/core"
                  ? `export const Capacitor={getPlatform:()=>"ios"}; export const registerPlugin=()=>Object.fromEntries(["get","set","remove"].map(m=>[m, p=>window.__nativeBridge("keychain",m,p)]));`
                  : path === "@capacitor/preferences"
                    ? `export const Preferences=Object.fromEntries(["get","set","remove"].map(m=>[m,p=>window.__nativeBridge("preferences",m,p)]));`
                    : `globalThis.__nativeListeners=new Map(); export const App={addListener:async(n,fn)=>{__nativeListeners.set(n,fn);return {remove:async()=>{}}},getState:async()=>({isActive:true}),getLaunchUrl:async()=>({url:globalThis.__nativeLaunchURL})};`;
              return { contents: code, loader: "js" };
            },
          );
        },
      },
    ],
  });
  bundle = result.outputFiles[0].text;
  await mkdir(evidence, { recursive: true });
});

function user(owner = ownerA) {
  return {
    id: owner,
    email:
      owner === ownerA
        ? "synthetic-a@example.invalid"
        : "synthetic-b@example.invalid",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
  };
}
function session(owner = ownerA, expired = false) {
  const expiry = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  const token = [
    Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from(
      JSON.stringify({ sub: owner, exp: expiry, role: "authenticated" }),
    ).toString("base64url"),
    "synthetic-not-signed",
  ].join(".");
  return {
    access_token: token,
    refresh_token: "synthetic-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiry,
    user: user(owner),
  };
}

async function setup(
  page,
  { seedSession = false, expired = false, failure = "" } = {},
) {
  const secrets = new Map(),
    preferences = new Map(),
    calls = [],
    api = [],
    auth = [],
    rows = [],
    transactions = [],
    lots = [],
    allocations = [];
  const state = { failure, offline: false, owner: ownerA, failSaveOnce: false, createCalls: 0 };
  if (seedSession)
    secrets.set("mica.auth", JSON.stringify(session(ownerA, expired)));
  await page.exposeBinding(
    "__nativeBridge",
    async (_source, target, method, payload) => {
      calls.push({ target, method, key: payload.key });
      if (state.failure === `${target}:${method}`)
        throw new Error("private diagnostic must not be logged");
      const map = target === "keychain" ? secrets : preferences;
      if (method === "set") map.set(payload.key, payload.value);
      if (method === "remove") map.delete(payload.key);
      return { value: map.get(payload.key) ?? null };
    },
  );
  await page.addInitScript(() => {
    globalThis.__serviceWorkerRegistrations = 0;
    if (navigator.serviceWorker)
      navigator.serviceWorker.register = async () => {
        __serviceWorkerRegistrations++;
        throw new Error("native must not register");
      };
  });
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const json = (data, status = 200, extra = {}) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Range": `0-0/${rows.length}`,
          ...extra,
        },
        body: JSON.stringify(data),
      });
    if (url.origin === config.supabaseUrl) {
      if (state.offline) return route.abort();
      const body = request.postDataJSON();
      if (url.pathname.startsWith("/auth/v1/")) {
        auth.push({
          path: url.pathname,
          grant: url.searchParams.get("grant_type"),
          body,
          redirect: url.searchParams.get("redirect_to"),
        });
        if (body?.email)
          state.owner = body.email.includes("synthetic-b") ? ownerB : ownerA;
        if (url.pathname.endsWith("/token")) return json(session(state.owner));
        if (url.pathname.endsWith("/user"))
          return json(user(state.owner));
        return json({});
      }
      if (url.pathname.endsWith("/profiles"))
        return json([
          {
            id: state.owner,
            display_name: "Synthetic native beta",
            preferences: { softwareMode: "collector" },
            display_currency: "USD",
            onboarding_completed_at: "2026-09-20T12:00:00Z",
          },
        ]);
      if (url.pathname.endsWith("/rpc/get_collection_organization_summary"))
        return json({
          positionCount: rows.length,
          allPositionCount: rows.length,
        });
      if (url.pathname.endsWith("/rpc/create_graded_copy_position")) {
        state.createCalls++;
        if (state.rejectSave)
          return json(
            { code: "22023", message: "Synthetic invalid statement" },
            400,
          );
        const existing = rows.find(
          (row) => row.operation === body.p_idempotency_key,
        );
        if (!existing) {
          rows.push({
            id: copyId,
            user_id: state.owner,
            identity_snapshot: body.p_identity,
            card_state: "graded",
            grader: body.p_grader,
            grade: body.p_grade,
            certification_number: body.p_certification_number,
            quantity: 1,
            currency: "USD",
            status: "owned",
            tags: [],
            custom_fields: {},
            operation: body.p_idempotency_key,
            created_at: "2026-09-20T12:00:00Z",
            updated_at: "2026-09-20T12:00:00Z",
          });
          const cost = body.p_unit_price;
          transactions.push({
            id: ownerB,
            collection_item_id: copyId,
            transaction_type: "purchase",
            transaction_date: body.p_transaction_date,
            quantity: 1,
            unit_price: cost,
            subtotal: cost,
            total_cost: cost,
            currency: "USD",
          });
          lots.push({
            id: ownerB,
            collection_item_id: copyId,
            purchase_transaction_id: ownerB,
            acquired_at: body.p_transaction_date,
            acquired_at_known: body.p_identity.acquisitionDateKnown,
            cost_basis_known: body.p_identity.acquisitionCostKnown,
            quantity_acquired: 1,
            quantity_remaining: 1,
            total_cost: cost,
            remaining_cost: cost,
            currency: "USD",
          });
        }
        if (state.failSaveOnce) {
          state.failSaveOnce = false;
          return route.abort();
        }
        return json(copyId);
      }
      if (url.pathname.endsWith("/rpc/record_graded_copy_sale")) {
        expect(body.p_collection_item_id).toBe(copyId);
        rows[0].status = "sold";
        rows[0].quantity = 0;
        const cost = lots[0].total_cost;
        lots[0].quantity_remaining = 0;
        lots[0].remaining_cost = 0;
        transactions.push({
          id: copyId,
          collection_item_id: copyId,
          transaction_type: "sale",
          transaction_date: body.p_transaction_date,
          quantity: 1,
          unit_price: body.p_unit_price,
          subtotal: body.p_unit_price,
          net_proceeds: body.p_unit_price,
          currency: "USD",
        });
        allocations.push({
          sale_transaction_id: copyId,
          purchase_lot_id: ownerB,
          quantity: 1,
          allocated_cost: cost,
          cost_basis_known: true,
        });
        return json(copyId);
      }
      if (url.pathname.endsWith("/collection_items")) return json(rows);
      if (url.pathname.endsWith("/collection_transactions"))
        return json(transactions);
      if (url.pathname.endsWith("/purchase_lots")) return json(lots);
      if (url.pathname.endsWith("/fifo_lot_allocations"))
        return json(allocations);
      return json([]);
    }
    if (url.origin === config.apiOrigin) {
      api.push({
        path: url.pathname,
        method: request.method(),
        authorization: request.headers().authorization,
      });
      if (state.offline) return route.abort();
      if (url.pathname === "/api/graded-valuation")
        return json(
          { error: "Verified valuation storage is unavailable." },
          503,
        );
      return json({
        cards: [],
        items: [],
        prices: [],
        sales: [],
        status: "unavailable",
      });
    }
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.startsWith("/api/"))
      throw new Error("Native API stayed on local origin");
    if (url.pathname === "/app.js")
      return route.fulfill({
        contentType: "application/javascript",
        body: bundle,
      });
    if (url.pathname === "/app-config.js")
      return route.fulfill({
        contentType: "application/javascript",
        body: `globalThis.__APP_CONFIG__=Object.freeze(${JSON.stringify(config)});`,
      });
    return route.continue();
  });
  await page.goto("/");
  await page.evaluate((url) => import(url), appUrl);
  return { secrets, preferences, calls, state, api, auth, rows, transactions };
}

async function login(page, email = "synthetic-a@example.invalid") {
  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill("Synthetic-password-07");
  await page.locator('#passwordAuthForm button[type="submit"]').click();
  await expect(page.locator("#authGate")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.accountLoading,
        appUrl,
      ),
    )
    .toBe(false);
}

test("native manual collector loop: secure login, interrupted graded form, save, relaunch, selected-copy sale and honest P/L", async ({
  page,
}, info) => {
  const f = await setup(page);
  await login(page);
  expect(f.secrets.has("mica.auth")).toBe(true);
  expect(
    await page.evaluate(
      async (url) =>
        (await import(url)).approvedImageProxyPath(
          "https://assets.tcgdex.net/en/base/base1/25/high.png",
        ),
      appUrl,
    ),
  ).toBe(
    `${config.apiOrigin}/api/card-image?url=https%3A%2F%2Fassets.tcgdex.net%2Fen%2Fbase%2Fbase1%2F25%2Fhigh.png`,
  );
  await page.evaluate(async (url) => {
    const app = await import(url);
    app.openPositionSheet({
      id: "synthetic:en:25",
      name: "Synthetic beta Pikachu",
      set: "Synthetic beta set",
      number: "025/100",
      language: "en",
      variant: "Holofoil",
      finish: "holofoil",
      edition: "unlimited",
      promoType: "none",
      identityStatus: "exact",
      thumb: "./icons/icon.svg",
    });
  }, appUrl);
  await page.locator("#positionState").selectOption("graded");
  await page.locator("#positionGrader").selectOption("PSA");
  await page.locator("#positionGrade").fill("10");
  await page.locator("#positionCertification").fill("000007");
  await page
    .locator("#positionPurchaseDetails summary")
    .click()
    .catch(() => {});
  await page.locator("#positionTotalCost").fill("100");
  await page.locator("#positionDate").fill("2026-09-20");
  await expect
    .poll(() => f.preferences.get(`mica:position-draft:v1:${ownerA}`))
    .toContain('"certificationNumber":"000007"');
  await page.reload();
  await expect(page.locator("#positionCertification")).toHaveValue("000007");
  await expect(page.locator("#positionTotalCost")).toHaveValue("100");
  await page.locator('#positionForm button[type="submit"]').first().click();
  await expect.poll(() => f.rows.length).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.items.length,
        appUrl,
      ),
    )
    .toBe(1);
  expect(f.preferences.has(`mica:position-draft:v1:${ownerA}`)).toBe(false);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.items.length,
        appUrl,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.accountLoading,
        appUrl,
      ),
    )
    .toBe(false);
  await page.evaluate(async (url) => {
    const app = await import(url);
    app.openCardDetail(app.state.items[0], true);
  }, appUrl);
  await expect(page.locator("#view-detail")).toContainText("000007");
  await page.evaluate(async (url) => {
    const app = await import(url);
    await app.applySession({ ...app.state.session, access_token: `${app.state.session.access_token}x` });
  }, appUrl);
  await expect(page.locator("#view-detail")).toHaveClass(/active/);
  await expect(page.locator("#view-detail")).toContainText("000007");
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.items[0].price,
        appUrl,
      ),
    )
    .toBe(null);
  await expect(page.locator("#view-detail")).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: `${evidence}/${info.project.name}-synthetic-native-reopen.png`,
  });
  await page.locator('details[data-detail-tool="purchases"] > summary').click();
  await page.locator("#recordSaleButton").click();
  await page.locator("#saleDate").fill("2026-09-25");
  await page.locator("#salePrice").fill("150");
  await page.locator('#saleForm button[type="submit"]').click();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.items[0]?.realizedGain,
        appUrl,
      ),
    )
    .toBe(50);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.items[0]?.realizedGain,
        appUrl,
      ),
    )
    .toBe(50);
  await expect(page.locator("#view-dashboard")).toHaveCSS("opacity", "1");
  await expect(page.locator("#portfolioHistory")).toContainText("Portfolio value · USD");
  await expect(page.locator("#portfolioHistory")).toContainText("Known value$0.00");
  await expect(page.locator("#portfolioPnlNote")).toContainText("$50.00 · known total P/L");
  await page.screenshot({
    path: `${evidence}/${info.project.name}-synthetic-native-sale-history.png`,
  });
  expect(await page.evaluate(() => __serviceWorkerRegistrations)).toBe(0);
  expect(
    await page.evaluate(() =>
      Object.entries(localStorage).some(
        ([key, value]) =>
          /mica\.auth|sb-.*-auth-token/.test(key) ||
          value.includes("synthetic-refresh"),
      ),
    ),
  ).toBe(false);
});

test("native uncertain commit survives relaunch and retries the same operation once", async ({
  page,
}) => {
  const f = await setup(page);
  await login(page);
  await page.evaluate(async (url) => {
    const app = await import(url);
    app.openPositionSheet({
      id: "synthetic:en:25",
      name: "Synthetic uncertain copy",
      set: "Synthetic set",
      number: "025/100",
      language: "en",
      variant: "Holofoil",
      finish: "holofoil",
      edition: "unlimited",
      promoType: "none",
      identityStatus: "exact",
    });
  }, appUrl);
  await page.locator("#positionState").selectOption("graded");
  await page.locator("#positionGrader").selectOption("PSA");
  await page.locator("#positionGrade").fill("10");
  f.state.failSaveOnce = true;
  await page.locator('#positionForm button[type="submit"]').first().click();
  await expect(page.locator("#positionError")).not.toBeEmpty();
  expect(f.rows).toHaveLength(1);
  const operation = f.rows[0].operation;
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.accountLoading,
        appUrl,
      ),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        async (url) =>
          Boolean((await import(url)).state.intakeQueue[0]?.pending),
        appUrl,
      ),
    )
    .toBe(true);
  await page.evaluate(async (url) => {
    const app = await import(url);
    app.openPositionSheet({ id: "synthetic:en:26", name: "Another synthetic card",
      set: "Synthetic set", number: "026/100", language: "en", variant: "Normal",
      finish: "normal", identityStatus: "exact" });
  }, appUrl);
  await expect(page.locator("#queueRetrySave")).toBeVisible();
  await page.locator("#queueRetrySave").click();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.intakeQueue.length,
        appUrl,
      ),
    )
    .toBe(0);
  expect(f.rows).toHaveLength(1);
  expect(f.rows[0].operation).toBe(operation);
  expect(f.transactions).toHaveLength(1);
});

test("native owner-bound queue relaunch, signout and account switch clear private work", async ({
  page,
}) => {
  const f = await setup(page);
  await login(page);
  expect(await page.evaluate(async (url) => {
    const { state } = await import(url);
    return [state.portfolioHistoryRange, state.portfolioPnlRange];
  }, appUrl)).toEqual(["all", "all"]);
  await page.evaluate(async (url) => {
    const app = await import(url);
    await app.queueIntakeCard({
      id: "synthetic:1",
      name: "Synthetic queued card",
      set: "Synthetic",
      number: "1",
      language: "en",
      variant: "Normal",
    });
  }, appUrl);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.intakeQueue.length,
        appUrl,
      ),
    )
    .toBe(1);
  await page.evaluate(
    async (url) => (await import(url)).openAddWorkspace(),
    appUrl,
  );
  await expect(page.locator("#intakeQueueBar")).toBeVisible();
  await page.evaluate(async (url) => {
    const app = await import(url);
    app.state.portfolioHistoryRange = "1m";
    app.state.portfolioPnlRange = "ytd";
    await app.signOut(app.testSupabase);
  }, appUrl);
  await expect(page.locator("#authGate")).toBeVisible();
  await expect.poll(() => f.preferences.size).toBe(0);
  expect(f.secrets.size).toBe(0);
  await login(page, "synthetic-b@example.invalid");
  await expect(page.locator("#intakeQueueBar")).toBeHidden();
  expect(
    await page.evaluate(
      async (url) => (await import(url)).state.session.user.id,
      appUrl,
    ),
  ).toBe(ownerB);
  expect(await page.evaluate(async (url) => {
    const { state } = await import(url);
    return [state.portfolioHistoryRange, state.portfolioPnlRange];
  }, appUrl)).toEqual(["all", "all"]);
});

test("native secure read/write/delete failures never store tokens in web storage", async ({
  page,
}) => {
  const f = await setup(page, { failure: "keychain:get" });
  await expect(page.locator("#nativeSecureRetry")).toBeVisible();
  expect(f.auth.length).toBe(0);
  f.state.failure = "";
  await page.reload();
  f.state.failure = "keychain:set";
  await page.locator("#authEmail").fill("synthetic-a@example.invalid");
  await page.locator("#authPassword").fill("Synthetic-password-07");
  await page.locator('#passwordAuthForm button[type="submit"]').click();
  await expect(page.locator("#nativeSecureRetry")).toBeVisible();
  await expect(page.locator("#authGate")).toBeVisible();
  expect(f.secrets.has("mica.auth")).toBe(false);
  f.state.failure = "";
  await page.reload();
  await login(page);
  f.state.failure = "keychain:remove";
  await page.evaluate(async (url) => {
    const app = await import(url);
    await app.signOut(app.testSupabase);
  }, appUrl);
  await expect(page.locator("#authGate")).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((value) =>
        value.includes("synthetic-refresh"),
      ),
    ),
  ).toBe(false);
});

test("native definitive rejection unlocks editing while account deletion attempts all secure keys", async ({
  page,
}) => {
  const f = await setup(page);
  await login(page);
  await page.evaluate(async (url) => {
    const app = await import(url);
    app.openPositionSheet({
      id: "synthetic:en:25",
      name: "Synthetic rejected copy",
      set: "Synthetic set",
      number: "025/100",
      language: "en",
      variant: "Holofoil",
      finish: "holofoil",
      edition: "unlimited",
      promoType: "none",
      identityStatus: "exact",
    });
  }, appUrl);
  await page.locator("#positionState").selectOption("graded");
  await page.locator("#positionGrader").selectOption("PSA");
  await page.locator("#positionGrade").fill("9");
  f.state.rejectSave = true;
  await page.locator('#positionForm button[type="submit"]').first().click();
  await expect(page.locator("#positionError")).not.toBeEmpty();
  expect(f.rows).toHaveLength(0);
  f.state.rejectSave = false;
  await page.locator("#positionGrade").fill("10");
  await page.locator('#positionForm button[type="submit"]').first().click();
  await expect.poll(() => Number(f.rows[0]?.grade)).toBe(10);
  await expect
    .poll(() =>
      page.evaluate(
        async (url) => (await import(url)).state.accountLoading,
        appUrl,
      ),
    )
    .toBe(false);
  await page.evaluate(
    async (url) => (await import(url)).openAccountDeletionSheet(),
    appUrl,
  );
  await page.locator("#deleteAccountEmail").fill("synthetic-a@example.invalid");
  f.state.failure = "preferences:remove";
  await page.locator("#confirmAccountDeletion").click();
  await expect(page.locator("#authGate")).toBeVisible();
  await expect(page.locator("#authMessage")).toContainText("Account deleted");
  for (const key of [
    "mica.auth",
    "mica.auth-user",
    "mica.auth-code-verifier",
    "mica.auth-return",
  ])
    expect(
      f.calls.some(
        (call) =>
          call.target === "keychain" &&
          call.method === "remove" &&
          call.key === key,
      ),
    ).toBe(true);
  expect(f.secrets.size).toBe(0);
});

test("native expired session refresh, API unavailable/offline/reconnect retains truthful errors", async ({
  page,
}) => {
  const f = await setup(page, { seedSession: true, expired: true });
  await expect(page.locator("#authGate")).toBeHidden();
  await expect
    .poll(() => f.auth.filter((call) => call.grant === "refresh_token").length)
    .toBe(1);
  const request = () =>
    page.evaluate(async (url) => {
      const app = await import(url);
      try {
        const response = await app
          .nativeRuntime()
          .fetch("/api/graded-valuation", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${app.state.session.access_token}`,
            },
            body: "{}",
          });
        return response.status;
      } catch {
        return "offline";
      }
    }, appUrl);
  expect(await request()).toBe(503);
  expect(f.api.at(-1).authorization).toContain("Bearer ");
  f.state.offline = true;
  expect(await request()).toBe("offline");
  f.state.offline = false;
  expect(await request()).toBe(503);
  expect(f.rows.length).toBe(0);
});

test("native real SDK PKCE recovery rejects wrong state and replays; cold return exchanges once", async ({
  page,
}) => {
  const f = await setup(page);
  await page.locator("#authEmail").fill("synthetic-a@example.invalid");
  await page.locator("#forgotPassword").click();
  await expect
    .poll(() => f.auth.find((call) => call.path.endsWith("/recover"))?.redirect)
    .toContain("/auth/native-return");
  await expect(page.locator("#authMessage")).toContainText(
    "instructions are on the way",
  );
  const recovery = f.auth.find((call) => call.path.endsWith("/recover"));
  expect(recovery.body.code_challenge).toBeTruthy();
  expect(recovery.body.code_challenge_method).toBe("s256");
  expect(f.secrets.has("mica.auth-code-verifier")).toBe(true);
  const callback = new URL(recovery.redirect);
  callback.searchParams.set("code", "synthetic-code");
  await page.evaluate(async (link) => {
    await __nativeListeners.get("appUrlOpen")({
      url: link.replace("state=", "state=wrong"),
    });
  }, callback.href);
  expect(f.auth.filter((call) => call.grant === "pkce").length).toBe(0);
  await page.addInitScript((link) => {
    globalThis.__nativeLaunchURL = link;
  }, callback.href);
  await page.reload();
  await expect
    .poll(() => f.auth.filter((call) => call.grant === "pkce").length)
    .toBe(1);
  expect(
    f.auth.find((call) => call.grant === "pkce").body.code_verifier,
  ).toBeTruthy();
  await expect(page.locator("#passwordResetDialog")).toBeVisible();
  await page.evaluate(async (link) => {
    await __nativeListeners.get("appUrlOpen")({ url: link });
  }, callback.href);
  expect(f.auth.filter((call) => call.grant === "pkce").length).toBe(1);
});

test("native camera background invalidates pending start, stops late tracks and restores manual retry", async ({
  page,
}) => {
  await setup(page);
  await login(page);
  await page.evaluate(async (url) => {
    globalThis.__lateStopped = false;
    let first = true;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (first) {
            first = false;
            return new Promise((resolve) => {
              globalThis.__resolveNativeCamera = () =>
                resolve({
                  getTracks: () => [
                    {
                      stop: () => {
                        __lateStopped = true;
                      },
                    },
                  ],
                });
            });
          }
          throw new DOMException("denied", "NotAllowedError");
        },
        enumerateDevices: async () => [],
      },
    });
    const app = await import(url);
    void app.openDeviceCamera({ automatic: false });
  }, appUrl);
  await expect(page.locator("#deviceCameraCapture")).toBeVisible();
  await page.evaluate(() =>
    __nativeListeners.get("appStateChange")({ isActive: false }),
  );
  await page.evaluate(() => __resolveNativeCamera());
  await expect.poll(() => page.evaluate(() => __lateStopped)).toBe(true);
  await page.evaluate(() =>
    __nativeListeners.get("appStateChange")({ isActive: true }),
  );
  await expect(page.locator("#deviceCameraRetry")).toBeVisible();
  await expect(page.locator("#deviceCameraUpload")).toBeAttached();
});

test("native saved scan photo survives relaunch as metadata and attaches to the same copy", async ({ page }) => {
  const f = await setup(page);
  await login(page);
  const uploads = [], attachments = [];
  await page.route(config.supabaseUrl + "/storage/v1/object/**", async route => {
    uploads.push(route.request().url());
    await route.fulfill({ status: uploads.length === 1 ? 503 : 200, contentType: "application/json", body: JSON.stringify(uploads.length === 1 ? { message: "Synthetic upload interruption" } : { Key: "synthetic-photo" }) });
  });
  await page.route(config.supabaseUrl + "/rest/v1/collection_item_attachments**", async route => {
    if (route.request().method() === "POST") attachments.push(route.request().postDataJSON());
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(route.request().method() === "POST" ? { id: "synthetic-attachment" } : []) });
  });
  const photoDataUrl = await page.evaluate(async url => {
    const app = await import(url);
    const canvas = document.createElement("canvas"); canvas.width = 4; canvas.height = 4;
    const photoDataUrl = canvas.toDataURL("image/jpeg");
    app.openPositionSheet({ id: "synthetic:en:25", name: "Synthetic photographed copy", set: "Synthetic set", number: "025/100", language: "en", variant: "Holofoil", finish: "holofoil", edition: "unlimited", promoType: "none", identityStatus: "exact" }, { photoDataUrl, prefill: { cardState: "graded", grader: "PSA", grade: "10", certificationNumber: "000123" } });
    return photoDataUrl;
  }, appUrl);
  await page.locator('#positionForm button[type="submit"].primary').click();
  await expect(page.locator("#retryScanPhoto")).toBeVisible();
  expect(f.rows).toHaveLength(1); expect(uploads).toHaveLength(1);
  const journalKey = `mica:position-draft:v1:${ownerA}`;
  const journal = JSON.parse(f.preferences.get(journalKey));
  expect(journal.pending.photoRequired).toBe(true);
  expect(journal.pending.savedItemId).toBe(copyId);
  expect(JSON.stringify(journal)).not.toMatch(/data:image|photoDataUrl|photoFile/);
  const operation = f.rows[0].operation;
  await page.reload();
  await expect.poll(() => page.evaluate(async url => (await import(url)).state.intakeQueue[0]?.pending?.savedItemId, appUrl)).toBe(copyId);
  await expect.poll(() => page.evaluate(async url => (await import(url)).state.accountLoading, appUrl)).toBe(false);
  await page.evaluate(async url => (await import(url)).openNextQueuedCard(), appUrl);
  await expect(page.locator("#queueRetrySave")).toHaveCount(0);
  await expect(page.locator("#retryScanPhoto")).toBeVisible();
  expect(f.rows).toHaveLength(1); expect(f.rows[0].operation).toBe(operation);
  expect(uploads).toHaveLength(1); // The restored journal contains no image to upload.
  await expect.poll(() => page.evaluate(async url => (await import(url)).state.intakeQueue.length, appUrl)).toBe(1);
  await page.locator("#scanPhotoRetryFile").setInputFiles({ name: "original-front.jpg", mimeType: "image/jpeg", buffer: Buffer.from(photoDataUrl.split(",")[1], "base64") });
  await page.locator("#retryScanPhoto").click();
  await expect(page.locator("#toastRegion")).toContainText("Card and photo saved");
  expect(uploads).toHaveLength(2); expect(uploads[1]).toBe(uploads[0]);
  expect(attachments).toHaveLength(1); expect(attachments[0].user_id).toBe(ownerA);
  expect(attachments[0].collection_item_id).toBe(copyId);
  await expect.poll(() => page.evaluate(async url => (await import(url)).state.intakeQueue.length, appUrl)).toBe(0);
  expect(f.preferences.has(journalKey)).toBe(false);
  expect(f.rows).toHaveLength(1); expect(f.transactions).toHaveLength(1);
  expect(f.state.createCalls).toBe(1);
});

test("saving one confirmed slab prices only that identity with unrelated inventory retained", async ({ page }) => {
  const f = await setup(page);
  await login(page);
  const unrelatedId = "77777777-7777-4777-8777-777777777777";
  f.rows.push({ id: unrelatedId, user_id: ownerA, identity_snapshot: { catalogId: "unrelated-card", name: "Unrelated card", set: "Other set", number: "100/100", language: "en", variant: "Normal" }, card_state: "raw", quantity: 1, currency: "USD", status: "owned", tags: ["preserved"], custom_fields: { legacy: "preserved" }, created_at: "2026-09-20T12:00:00Z", updated_at: "2026-09-20T12:00:00Z" });
  const pricing = [], graded = [];
  await page.route(config.apiOrigin + "/api/graded-valuation", async route => {
    graded.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture release hold" }) });
  });
  await page.route(config.apiOrigin + "/api/cards?**", async route => {
    pricing.push(JSON.parse(new URL(route.request().url()).searchParams.get("lookups")));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ cards: [] }) });
  });
  await page.evaluate(async url => (await import(url)).openPositionSheet({ id: "synthetic-confirmed", name: "Confirmed card", set: "Synthetic set", number: "025/100", language: "en", variant: "Holofoil", finish: "holofoil", edition: "unlimited", promoType: "none", identityStatus: "exact" }, { prefill: { cardState: "graded", grader: "PSA", grade: "10" } }), appUrl);
  await page.locator('#positionForm button[type="submit"].primary').click();
  await expect.poll(() => graded.length).toBe(1);
  expect(graded[0]).toEqual({ positionId: copyId });
  expect(pricing).toHaveLength(0);
  expect(f.state.createCalls).toBe(1); expect(f.rows).toHaveLength(2);
  const untouched = f.rows.find(row => row.id === unrelatedId);
  expect(untouched.tags).toEqual(["preserved"]); expect(untouched.custom_fields).toEqual({ legacy: "preserved" });
  await expect.poll(() => page.evaluate(async url => (await import(url)).state.items.length, appUrl)).toBe(2);
});
