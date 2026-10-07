import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

let source = readFileSync("app.js", "utf8");
if (process.env.MICA_RECOVERY_BASELINE === "1") {
  source = source.replace(
    /      const sessionLoad = applySession\(session\);[\s\S]*?      await sessionLoad;/,
    '      await applySession(session);\n      if (event === "PASSWORD_RECOVERY") openPasswordResetDialog();',
  );
}
const bundled = await build({
  stdin: { contents: `${source}\nexport { state };`, resolveDir: process.cwd(), sourcefile: "app.js" },
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  define: { __MICA_NATIVE__: "false", __MICA_INTERNAL_CERTIFICATES__: "false" },
});
const origin = "https://mica-recovery-fixture.supabase.co";
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "recovery@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};

async function setup(page) {
  const calls = [];
  let failUpdate = true;
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `globalThis.__APP_CONFIG__=${JSON.stringify({ supabaseUrl: origin, supabasePublishableKey: "sb_publishable_synthetic_only", authReturnOrigin: "https://jordan-pokemon-app.vercel.app" })};`,
    }),
  );
  await page.route("**/app.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: bundled.outputFiles[0].text,
    }),
  );
  await page.route(
    /^https:\/\/mica-recovery-fixture\.supabase\.co\//,
    async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const headers = {
        "Access-Control-Allow-Origin": "http://127.0.0.1:4189",
        "Access-Control-Allow-Headers":
          "authorization, apikey, x-client-info, content-type, x-supabase-api-version",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      };
      if (request.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      calls.push({
        path: url.pathname,
        method: request.method(),
        body: request.postDataJSON(),
        redirect: url.searchParams.get("redirect_to"),
      });
      const json = (body, status = 200) =>
        route.fulfill({
          status,
          headers,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.pathname.startsWith("/rest/")) return; // Deliberately stalled collection; teardown closes intercepted requests.
      if (url.pathname === "/auth/v1/user" && request.method() === "PUT") {
        if (failUpdate) {
          failUpdate = false;
          return json(
            { code: "weak_password", message: "Choose a stronger password." },
            422,
          );
        }
        return json(user);
      }
      if (url.pathname === "/auth/v1/user") return json(user);
      return json({});
    },
  );
  return calls;
}

test("password reset request needs only email and uses the public return even from localhost", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/");
  await page.locator("#authEmail").fill(user.email);
  await page.locator("#forgotPassword").click();
  await expect(page.locator("#authMessage")).toContainText(
    "instructions are on the way",
  );
  const requests = calls.filter((call) => call.path.endsWith("/recover"));
  expect(requests).toHaveLength(1);
  expect(requests[0].body.email).toBe(user.email);
  expect(requests[0].redirect).toBe(
    "https://jordan-pokemon-app.vercel.app/?auth=reset",
  );
  await expect(page.locator("#passwordResetDialog")).not.toBeVisible();
});

test("verified recovery permits password retry while collection reads are stalled", async ({
  page,
}, testInfo) => {
  const calls = await setup(page);
  const claims = Buffer.from(
    JSON.stringify({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
    }),
  ).toString("base64url");
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url")}.${claims}.synthetic-not-signed`;
  await page.goto(
    `/?auth=reset#access_token=${token}&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=recovery`,
  );
  await expect(page.locator("#passwordResetDialog")).toBeVisible();
  expect(await page.evaluate(async () => {
    const { state } = await import("/app.js?v=111");
    return [state.portfolioHistoryRange, state.portfolioPnlRange];
  })).toEqual(["all", "all"]);
  await mkdir("docs/evidence/client-reset-2026-10-03/screenshots", {
    recursive: true,
  });
  await page.screenshot({
    path: `docs/evidence/client-reset-2026-10-03/screenshots/checkpoint-43-${testInfo.project.name}-password-reset.png`,
    animations: "disabled",
  });
  await expect
    .poll(() => calls.some((call) => call.path.startsWith("/rest/")))
    .toBe(true);
  await page.locator("#newAccountPassword").fill("synthetic-new-password");
  await page.locator("#passwordResetForm button[type=submit]").click();
  await expect(page.locator("#passwordResetMessage")).toContainText(
    "Use a password with at least 8 characters",
  );
  await expect(page.locator("#newAccountPassword")).toHaveValue(
    "synthetic-new-password",
  );
  await expect(page.locator("#passwordResetDialog")).toBeVisible();
  await page.locator("#passwordResetForm button[type=submit]").click();
  await expect(page.locator("#passwordResetMessage")).toHaveText(
    "Password updated.",
  );
  await expect(page.locator("#newAccountPassword")).toHaveValue("");
  await expect(page.locator("#passwordResetDialog")).not.toBeVisible();
  expect(
    calls.filter((call) => call.method === "PUT").map((call) => call.body),
  ).toEqual(
    Array.from({ length: 2 }, () => ({
      password: "synthetic-new-password",
      code_challenge: null,
      code_challenge_method: null,
    })),
  );
  expect(
    calls.some(
      (call) =>
        /\/(collection_items|position_transactions|storage)\b/.test(
          call.path,
        ) && !["GET", "HEAD"].includes(call.method),
    ),
  ).toBe(false);
});

test("reset query alone never authorizes a password update", async ({
  page,
}) => {
  const calls = await setup(page);
  await page.goto("/?auth=reset");
  await expect(page.locator("#authEmail")).toBeVisible();
  await expect(page.locator("#passwordResetDialog")).not.toBeVisible();
  expect(calls.some((call) => call.method === "PUT")).toBe(false);
});
