import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { normalizeNotificationPreferences } from "../../lib/action-center.js";

// Exercise the actual production handler with an isolated browser fixture. The
// persistence stub deliberately rejects asynchronously, after event dispatch.
const source = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
const start = source.indexOf("function openNotificationPreferencesSheet()");
const end = source.indexOf("\nasync function openInstallExperience()", start);
const handler = source.slice(start, end);

async function openPreferences(page, overrides = {}, held = false) {
  await page.setContent('<main id="fixture"></main>');
  await page.evaluate(
    ({ handler, preferences, held }) => {
      window.$ = (selector) => document.querySelector(selector);
      window.esc = (value) => String(value);
      window.sessionLoadVersion = 1;
      window.notificationTimeZone = value => value;
      window.devicePushStatus = async () => "disabled";
      window.state = {
        session: { user: { id: "fixture-owner" } },
        actionCenter: {
          status: "ready",
          preferences,
          capabilities: {
            email: held ? "release_hold" : "configured_unverified",
            webPush: held ? "release_hold" : "configured_unverified",
          },
        },
      };
      window.actionRuleKinds = () => ["watch_target"];
      window.notificationKindLabel = () => "Buy targets";
      window.normalizeNotificationPreferences = (value) => value;
      window.openSheet = (html) => {
        document.querySelector("#fixture").innerHTML = html;
      };
      window.closeSheet = () => {
        document.querySelector("#fixture").hidden = true;
      };
      window.updateTargetAlertControl = () => {};
      window.refreshActionCenter = async () => {};
      window.toast = () => {};
      window.supabase = {};
      window.saveRequests = [];
      window.saveActionCenterPreferences = async (_client, input) => {
        window.saveRequests.push(input);
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (window.saveRequests.length === 1)
          throw new Error(
            "internal notification_preferences relation failed XX000",
          );
        return input;
      };
      (0, eval)(`${handler}\nopenNotificationPreferencesSheet();`);
    },
    {
      handler,
      held,
      preferences: normalizeNotificationPreferences({
        channels: { inApp: true, email: true, webPush: true },
        ...overrides,
      }),
    },
  );
}

test("optional alert unsubscribe recovers from asynchronous rejection and retries", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openPreferences(page);
  const button = page.locator("#disableOptionalAlerts");
  await button.click();
  await expect(page.locator("#notificationPreferencesError")).toContainText(
    "Please try again",
  );
  await expect(button).toBeEnabled();
  await expect(page.locator('input[name="email"]')).toBeChecked();
  await expect(page.locator("#fixture")).not.toContainText("XX000");
  await button.click();
  await expect(page.locator("#fixture")).toBeHidden();
  expect(await page.evaluate(() => window.saveRequests)).toHaveLength(2);
  expect(await page.evaluate(() => window.saveRequests[1].channels)).toEqual({
    inApp: true,
    email: false,
    webPush: false,
  });
  expect(errors).toEqual([]);
});

test("alert settings retain choices and hide server detail through retry", async ({
  page,
}) => {
  await openPreferences(page);
  await page.locator('input[name="inApp"]').uncheck();
  await expect(page.locator("#dailyAlertCap")).toBeHidden();
  await page.locator(".notification-advanced>summary").click();
  await page.locator("#dailyAlertCap").fill("9");
  const button = page.getByRole("button", { name: "Save alert settings" });
  await button.click();
  await expect(page.locator("#notificationPreferencesError")).toContainText(
    "Your choices are still here",
  );
  await expect(button).toBeEnabled();
  await expect(page.locator('input[name="inApp"]')).not.toBeChecked();
  await expect(page.locator("#dailyAlertCap")).toHaveValue("9");
  await expect(page.locator("#fixture")).not.toContainText(
    "notification_preferences",
  );
  await button.click();
  await expect(page.locator("#fixture")).toBeHidden();
  const requests = await page.evaluate(() => window.saveRequests);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
});

test('in-app-only settings stay simple and retain hidden limits through retry',async({page})=>{
  await openPreferences(page,{channels:{inApp:true,email:false,webPush:false},dailyCap:9},true);
  await expect(page.getByLabel('In-app alerts',{exact:true})).toBeVisible();
  await expect(page.locator('.notification-advanced')).toBeHidden();
  await expect(page.locator('#disableOptionalAlerts')).toBeHidden();
  await page.getByLabel('In-app alerts',{exact:true}).uncheck();
  await page.getByRole('button',{name:'Save alert settings'}).click();
  await expect(page.locator('#notificationPreferencesError')).toContainText(/please try again/i);
  await page.getByRole('button',{name:'Save alert settings'}).click();
  const saved=await page.evaluate(()=>saveRequests[1]);
  expect(saved.channels).toEqual({inApp:false,email:false,webPush:false});
  expect(saved.enabled).toBe(false);expect(Number(saved.dailyCap)).toBe(9);
});
