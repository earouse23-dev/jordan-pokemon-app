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

test('inline alert switch saves once, preserves other preferences, and recovers without cross-account updates',async({page})=>{
 const inline=source.slice(source.indexOf('let targetAlertSave = null;'),source.indexOf('\nfunction notificationKindLabel'));
 await page.setContent('<button id="targetAlertButton"><span id="targetAlertState"></span></button><p id="targetAlertHelp"></p><button id="otherAlertSettings"></button>');
 await page.evaluate(({inline,preferences})=>{
  window.$=s=>document.querySelector(s);window.supabase={};window.sessionLoadVersion=1;
  window.state={session:{user:{id:'one'}},actionCenter:{status:'ready',preferences,capabilities:{}}};
  window.accountRequestIsCurrent=(owner,version)=>state.session.user.id===owner&&sessionLoadVersion===version;
  window.refreshActionCenter=async()=>{};window.saves=[];
  window.saveActionCenterPreferences=async(_client,input)=>{saves.push(input);return await new Promise((resolve,reject)=>{window.completeSave=()=>resolve(input);window.rejectSave=()=>reject(new Error('private server error'));});};
  (0,eval)(inline+'\nwindow.toggleAlerts=toggleTargetAlerts;window.updateAlerts=updateTargetAlertControl;updateAlerts();');
  document.querySelector('#targetAlertButton').onclick=()=>void toggleAlerts();
 },{inline,preferences:normalizeNotificationPreferences({enabled:true,channels:{inApp:true,email:true,webPush:false},dailyCap:9})});
 const button=page.getByRole('switch');await expect(button).toHaveAttribute('aria-checked','true');
 await button.click();await expect(button).toBeDisabled();
 await page.evaluate(()=>{updateAlerts();void toggleAlerts();});
 expect(await page.evaluate(()=>saves.length)).toBe(1);
 await page.evaluate(()=>rejectSave());await expect(button).toBeEnabled();await expect(button).toHaveAttribute('aria-checked','true');
 await expect(page.locator('#targetAlertHelp')).toContainText('Tap to retry');
 await button.click();await page.evaluate(()=>completeSave());await expect(button).toHaveAttribute('aria-checked','false');
 expect(await page.evaluate(()=>saves[1].channels)).toEqual({inApp:false,email:true,webPush:false});
 expect(await page.evaluate(()=>Number(saves[1].dailyCap))).toBe(9);
 await button.click();await page.evaluate(()=>{state.session.user.id='two';sessionLoadVersion++;state.actionCenter.preferences={enabled:false,channels:{inApp:false,email:false,webPush:false}};completeSave();updateAlerts();});
 await expect(button).toHaveAttribute('aria-checked','false');
 expect(await page.evaluate(()=>state.actionCenter.preferences.channels.email)).toBe(false);
});
