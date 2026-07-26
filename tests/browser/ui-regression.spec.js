import { expect, test } from "@playwright/test";

const themes = ["analytics", "clean"];
const workspaces = ["guided", "growth", "pro"];
const viewIds = [
  "view-collection",
  "view-scan",
  "view-trade",
  "view-profile",
];

async function revealShell(page, { theme, viewId, workspace }) {
  await page.evaluate(
    ({ selectedTheme, selectedView, selectedWorkspace }) => {
      document.body.dataset.uiTheme = selectedTheme;
      document.body.dataset.workspace = selectedWorkspace;
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      document.querySelectorAll(".view").forEach((view) => {
        const active = view.id === selectedView;
        view.hidden = !active;
        view.classList.toggle("active", active);
        view.setAttribute("aria-hidden", String(!active));
      });
    },
    {
      selectedTheme: theme,
      selectedView: viewId,
      selectedWorkspace: workspace,
    },
  );
}

async function layoutAudit(page) {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll("body *")].filter(
      (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          rect.width > 0 &&
          rect.height > 0
        );
      },
    );
    const textBelowFloor = visible
      .filter(
        (element) =>
          element.children.length === 0 && element.textContent.trim(),
      )
      .map((element) => ({
        text: element.textContent.trim().slice(0, 60),
        size: Number.parseFloat(getComputedStyle(element).fontSize),
      }))
      .filter(({ size }) => size < 12);
    const outsideViewport = visible
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      })
      .map((element) => ({
        id: element.id,
        className: String(element.className || ""),
      }))
      .slice(0, 20);
    const undersizedMobileButtons =
      innerWidth > 759
        ? []
        : visible
            .filter(
              (element) =>
                element.matches(
                  "button:not(.skip-link), summary, .bottom-nav [role='button']",
                ) &&
                !element.closest("[hidden]") &&
                !element.disabled,
            )
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                label: (
                  element.getAttribute("aria-label") ||
                  element.textContent ||
                  element.tagName
                )
                  .trim()
                  .slice(0, 60),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            })
            .filter(({ width, height }) => width < 44 || height < 44);
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      textBelowFloor,
      outsideViewport,
      undersizedMobileButtons,
    };
  });
}

test("signed-out access is readable and contained", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sign in to your collection" }),
  ).toBeVisible();
  const audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.textBelowFloor).toEqual([]);
  expect(audit.outsideViewport).toEqual([]);
});

for (const theme of themes) {
  test(`${theme} shell keeps every primary workspace visually sound`, async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    for (const workspace of workspaces) {
      for (const viewId of viewIds) {
        await revealShell(page, { theme, viewId, workspace });
        await expect(page.locator(`#${viewId}`)).toBeVisible();
        if (viewId === "view-collection") {
          const marketTools = page.locator(
            "#view-collection > #view-insights.collection-market-tools",
          );
          if (workspace === "guided") {
            await expect(marketTools).toBeHidden();
          } else {
            await expect(marketTools).toBeVisible();
          }
        }
        const audit = await layoutAudit(page);
        await testInfo.attach(`${theme}-${workspace}-${viewId}.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: "image/png",
        });
        expect
          .soft(audit.overflow, `${workspace} ${viewId} horizontal overflow`)
          .toBeLessThanOrEqual(0);
        expect
          .soft(audit.textBelowFloor, `${workspace} ${viewId} text below 12px`)
          .toEqual([]);
        expect
          .soft(
            audit.outsideViewport,
            `${workspace} ${viewId} content outside viewport`,
          )
          .toEqual([]);
        expect
          .soft(
            audit.undersizedMobileButtons,
            `${workspace} ${viewId} mobile buttons below 44px`,
          )
          .toEqual([]);
      }
    }
    await expect(page.locator(".view-tabs")).toHaveAttribute("role", "group");
    await expect(page.locator(".view-tab").first()).toHaveAttribute(
      "aria-pressed",
      /true|false/,
    );
  });
}
