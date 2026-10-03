import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const source = readFileSync(new URL("../../app.js", import.meta.url), "utf8");
const section = (start, end) =>
  source.slice(
    source.indexOf(start),
    source.indexOf(end, source.indexOf(start)),
  );
const helpers = section(
  "async function finishSavedCollectionChange(",
  "function openPurchaseLotSheet(",
);
const sale = section(
  "function openSaleSheet(",
  "async function reloadPortfolio(",
);
const split = section(
  "function openSeparateCopiesSheet(",
  "function openGradingResultSheet(",
);

for (const flow of ["sale", "split"]) {
  test(`${flow}: committed change retries refresh without another write`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.setContent('<main id="fixture"></main>');
    await page.evaluate(
      ({ helpers, handler, flow }) => {
        window.$ = (selector) => document.querySelector(selector);
        window.esc = (value) => String(value);
        window.localIsoDate = () => "2026-09-06";
        window.conditionLabel = () => "Ungraded";
        window.workflowDefault = () => "";
        window.rememberWorkflowDefault = () => {};
        window.openSheet = (html) => {
          const node = document.querySelector("#fixture");
          node.hidden = false;
          node.innerHTML = html;
        };
        window.closeSheet = () => {
          document.querySelector("#fixture").hidden = true;
        };
        window.toast = () => {};
        window.supabase = {};
        window.writeCount = 0;
        window.refreshCount = 0;
        window.recordSale = window.splitCollectionPosition = async () => {
          window.writeCount += 1;
          return "separated-position";
        };
        window.reloadPortfolio = async () => {
          window.refreshCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (window.refreshCount < 3)
            throw new Error("internal relation unavailable XX000");
        };
        (0, eval)(
          `${helpers}\n${handler}\n${flow === "sale" ? "openSaleSheet" : "openSeparateCopiesSheet"}({ uid: "owned-card", name: "Pikachu", quantity: 3, cardState: "raw" });`,
        );
      },
      { helpers, handler: flow === "sale" ? sale : split, flow },
    );
    if (flow === "sale") await page.locator("#salePrice").fill("12");
    await page.locator('button[type="submit"]').click();
    await expect(
      page.getByRole("heading", { name: "Change saved" }),
    ).toBeVisible();
    await expect(page.locator("#savedChangeRefreshError")).toContainText(
      "Your change is saved",
    );
    await expect(page.locator('button[type="submit"]')).toHaveCount(0);
    await expect(page.locator("#fixture")).not.toContainText("XX000");
    const refresh = page.getByRole("button", { name: "Refresh collection" });
    await refresh.click();
    await expect(page.locator("#savedChangeRefreshError")).toContainText(
      "Couldn’t refresh",
    );
    await expect(refresh).toBeEnabled();
    await refresh.click();
    await expect(page.locator("#fixture")).toBeHidden();
    expect(
      await page.evaluate(() => ({
        writes: window.writeCount,
        refreshes: window.refreshCount,
      })),
    ).toEqual({ writes: 1, refreshes: 3 });
    expect(errors).toEqual([]);
  });
}
