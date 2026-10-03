import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { normalizeNotificationPreferences } from "../../lib/action-center.js";

// Exercise the actual production handler with an isolated browser fixture. The
// persistence stub deliberately rejects asynchronously, after event dispatch.
const source = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
const start = source.indexOf("function openNotificationPreferencesSheet()");
const end = source.indexOf("\nasync function openInstallExperience()", start);
const handler = source.slice(start, end);

async function openPreferences(page) {
  await page.setContent('<main id="fixture"></main>');
  await page.evaluate(
    ({ handler, preferences }) => {
      window.$ = (selector) => document.querySelector(selector);
      window.esc = (value) => String(value);
      window.state = {
        actionCenter: {
          status: "ready",
          preferences,
          capabilities: {
            email: "configured_unverified",
            webPush: "configured_unverified",
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
      preferences: normalizeNotificationPreferences({
        channels: { inApp: true, email: true, webPush: true },
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
