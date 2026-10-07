import { expect, test } from "@playwright/test";

// Keep fixture requests on the page route in WebKit as well as Chromium.
test.use({ serviceWorkers: "block" });

const viewIds = [
  "view-dashboard",
  "view-collection",
  "view-scan",
  "view-trade",
  "view-profile",
];
const widths = [320, 390, 768, 1024, 1440];

async function revealShell(page, viewId) {
  await page.evaluate((selectedView) => {
    document.body.dataset.uiTheme = "mica";
    document.body.dataset.workspace = "collector";
    document.body.dataset.softwareMode = "collector";
    document.body.classList.add("authenticated");
    document.querySelector("#authGate").hidden = true;
    document.querySelector("#appShell").removeAttribute("aria-hidden");
    document.querySelectorAll(".view").forEach((view) => {
      const active = view.id === selectedView;
      view.hidden = !active;
      view.classList.toggle("active", active);
      view.setAttribute("aria-hidden", String(!active));
    });
  }, viewId);
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

test("the unified Mica shell fits every required viewport", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of widths) {
    await page.setViewportSize({
      width,
      height: width <= 390 ? 844 : width <= 768 ? 1024 : 1000,
    });
    for (const viewId of viewIds) {
      await revealShell(page, viewId);
      await expect(page.locator(`#${viewId}`)).toBeVisible();
      const audit = await layoutAudit(page);
      expect
        .soft(audit.overflow, `${width}px ${viewId} horizontal overflow`)
        .toBeLessThanOrEqual(0);
      expect
        .soft(audit.textBelowFloor, `${width}px ${viewId} text below 12px`)
        .toEqual([]);
      expect
        .soft(audit.outsideViewport, `${width}px ${viewId} outside viewport`)
        .toEqual([]);
      expect
        .soft(
          audit.undersizedMobileButtons,
          `${width}px ${viewId} controls below 44px`,
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

test("legacy mode preferences never restore seller or trade clutter", async ({ page }) => {
  await page.goto("/");
  await revealShell(page, "view-dashboard");
  for (const mode of ["collector", "investor", "seller"]) {
    await page.evaluate(async mode => (await import("/app.js?v=111")).switchSoftwareMode(mode, { persist: false, announce: false }), mode);
    await expect(page.locator("body")).toHaveAttribute("data-software-mode", "collector");
    await expect(page.locator("#softwareModeHome")).toBeHidden();
    await expect(page.locator("#dashboardTitle")).not.toHaveText("Seller workspace");
    await expect(page.locator(".sidebar-nav [data-sidebar-target]")).toHaveCount(3);
    await expect(page.locator("#softwareModeSettings")).toBeHidden();
    await expect(page.locator("#softwareModeSelect, [data-route=trade]")).toHaveCount(0);
  }
  const audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.textBelowFloor).toEqual([]);
  expect(audit.outsideViewport).toEqual([]);
  expect(audit.undersizedMobileButtons).toEqual([]);
});

test("retired organization stays inaccessible while catalog languages remain available", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 320, height: 844 });
  await revealShell(page, "view-collection");
  const workspace = page.locator("#collectionOrganization");
  await expect(workspace).toBeHidden();
  expect(await workspace.evaluate(node => node.inert)).toBe(true);
  await expect(page.getByRole("heading", { name: "Keep every card findable" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All folders" })).toHaveCount(0);
  await expect(page.locator("#quickSearchLanguage option")).toHaveCount(10);
  const audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.textBelowFloor).toEqual([]);
  expect(audit.outsideViewport).toEqual([]);
  expect(audit.undersizedMobileButtons).toEqual([]);
});

test("digital grading lives in Collection while Add Cards stays focused", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-collection");
  await expect(page.locator("#digitalGraderButton")).not.toBeVisible();
  await page.locator(".collection-grading-workspace > summary").click();
  await expect(
    page.getByRole("heading", { name: "Digitally grade a card" }),
  ).toBeVisible();
  await expect(page.locator("#digitalGraderButton")).toBeVisible();
  await expect(page.locator("#digitalGraderButton strong")).toHaveText(
    "Open the camera",
  );
  await expect(page.locator("#digitalGraderButton em")).toContainText(
    "not a professional grade",
  );
  await expect(page.locator("[data-collection-grading-mode]")).toHaveCount(0);
  await expect(page.locator(".grading-workspace-facts")).toHaveCount(0);
  expect(
    await page.evaluate(() => {
      const cards = document.querySelector("#cardLedger");
      const grader = document.querySelector(".collection-grading-workspace");
      return Boolean(
        cards &&
        grader &&
        cards.compareDocumentPosition(grader) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      );
    }),
  ).toBe(true);
  await expect(page.locator(".add-grade-report-preview")).toHaveCount(0);
  await revealShell(page, "view-scan");
  await expect(page.getByRole("heading", { name: "Add cards" })).toBeVisible();
  await expect(page.locator("#view-scan #digitalGraderButton")).toHaveCount(0);
  await expect(page.locator("#autoCaptureButton")).toBeVisible();
  await expect(page.locator("#autoCaptureButton strong")).toHaveText(
    "Take a photo",
  );
  await expect(page.locator("#receiptCameraButton")).toHaveCount(0);
  await expect(page.locator("#view-scan .simple-privacy")).toBeVisible();
  await expect(page.locator("#autoCaptureButton")).toHaveAttribute(
    "type",
    "button",
  );
});

test("generic Add opens search while photo capture remains explicit", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-dashboard");
  await page.evaluate(async () => {
    const { openAddWorkspace } = await import("/app.js?v=111");
    openAddWorkspace();
  });
  await expect(page.locator("#view-scan")).toBeVisible();
  const keyboardPointer = await page.evaluate(
    () => matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  if (keyboardPointer)
    await expect(page.locator("#quickCardSearch")).toBeFocused();
  else await expect(page.locator("#quickCardSearch")).not.toBeFocused();
  await expect(page.locator("#bottomSheet")).toBeHidden();
  await expect(page.locator(".bottom-nav [data-route='scan']")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator("#autoCaptureButton strong")).toHaveText(
    "Take a photo",
  );
});

test("exact catalog cards can be queued without slowing the direct add path", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-scan");
  await page.evaluate(async () => {
    const { queueIntakeCard, openBatchIntakeSheet } =
      await import("/app.js?v=111");
    const pikachu = {
      id: "tcgdex:en:base1-58",
      name: "Pikachu",
      set: "Base Set",
      number: "58/102",
      language: "en",
      variant: "Normal",
    };
    queueIntakeCard(pikachu);
    queueIntakeCard(pikachu);
    queueIntakeCard({
      id: "tcgdex:de:base1-4",
      name: "Glurak",
      set: "Grundset",
      number: "4/102",
      language: "de",
      variant: "Holofoil",
    });
    openBatchIntakeSheet();
  });
  await expect(page.locator("#intakeQueueCount")).toHaveText(
    "3 cards · 2 exact versions",
  );
  await expect(
    page.getByRole("heading", { name: "Review card queue" }),
  ).toBeVisible();
  await expect(page.locator(".intake-row")).toHaveCount(2);
  await expect(page.locator("[data-intake-quantity]").first()).toHaveValue("2");
  await expect(page.locator("#sheetContent")).toContainText(
    "confirm each exact version before saving",
  );
  await page.locator("#reviewNextIntake").click();
  await expect(
    page.getByRole("heading", { name: "Add to your library" }),
  ).toBeVisible();
  await expect(page.locator("#positionQuantity")).toHaveValue("2");
});

test("CSV review shows mapping, duplicate evidence, and a read-only dry check", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-profile");
  await page.evaluate(async () => {
    const { openCsvImportReview } = await import("/app.js?v=111");
    await openCsvImportReview(
      "Name,Set,Number,Quantity,Condition,Purchase Date,Purchase Price\nPikachu,Base Set,58/102,1,Near Mint,2026-01-02,5.00\nPikachu,Base Set,58/102,1,Near Mint,2026-01-02,5.00",
      { name: "sample.csv" },
    );
  });
  await expect(
    page.getByRole("heading", { name: "Review spreadsheet import" }),
  ).toBeVisible();
  await expect(page.locator("#sheetContent")).toContainText(
    "Nothing enters your library during preview",
  );
  await expect(page.locator("#sheetContent")).toContainText(
    "Exact repeats combined",
  );
  await expect(page.locator("#commitCsvImport")).toBeDisabled();
  await page.locator("#runCsvDryCheck").click();
  await expect(page.locator("#importStatus")).toContainText(
    "Your library is still unchanged",
  );
  await expect(page.locator("#commitCsvImport")).toBeEnabled();
});

test("manual unopened entry remains available for every supported catalog language", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-scan");
  await page.evaluate(async () => {
    const { openManualSealedEntry } = await import("/app.js?v=111");
    openManualSealedEntry({ name: "151 Booster Bundle", language: "de" });
  });
  await expect(
    page.getByRole("heading", { name: "Enter unopened product" }),
  ).toBeVisible();
  await expect(page.locator("#manualSealedLanguage option")).toHaveCount(10);
  await expect(page.locator("#manualSealedLanguage")).toHaveValue("de");
  await expect(page.locator("#sheetContent")).toContainText(
    "provider search is unavailable",
  );
  await expect(page.locator("#sheetContent")).toContainText(
    "marked for review",
  );
});

test("market values carry compact source, context, freshness, and confidence", async ({
  page,
}) => {
  await page.goto("/");
  const disclosure = await page.evaluate(async () => {
    const { priceProvenanceText } = await import("/app.js?v=111");
    const quote = {
      provider: "tcgplayer",
      market: "tcgplayer",
      aggregator: "pkmnprices",
      currency: "USD",
      finish: "holofoil",
      condition: "Near Mint",
      priceType: "market",
      amount: 100,
      observedAt: new Date().toISOString(),
      retrievedAt: new Date().toISOString(),
    };
    return {
      live: priceProvenanceText({
        cardState: "raw",
        condition: "Near Mint",
        variant: "Holofoil",
        currency: "USD",
        pricingStatus: "live",
        price: 100,
        quotes: [quote],
      }),
      manual: priceProvenanceText({ pricingStatus: "manual" }),
    };
  });
  expect(disclosure.live).toContain("TCGplayer via PkmnPrices");
  expect(disclosure.live).toContain("Like new");
  expect(disclosure.live).toContain("live");
  expect(disclosure.live).toContain("Limited evidence");
  expect(disclosure.manual).toContain("Owner-entered value");
  expect(disclosure.manual).toContain("no market source");
});

test("trade values never relabel stale or owner-entered evidence as live", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { tradePricingSeed } = await import("/app.js?v=111");
    return {
      live: tradePricingSeed(
        { price: 100, pricingStatus: "live", quotes: [] },
        90,
      ),
      stale: tradePricingSeed(
        { price: 100, pricingStatus: "stale", quotes: [] },
        90,
      ),
      manual: tradePricingSeed(
        { price: 100, pricingStatus: "manual_override", quotes: [] },
        90,
      ),
    };
  });
  expect(result.live).toMatchObject({
    canPrefill: true,
    pricingStatus: "live",
    valuePerCard: "90.00",
  });
  expect(result.stale).toMatchObject({
    canPrefill: false,
    pricingStatus: "loading",
    valuePerCard: "",
    price: null,
  });
  expect(result.manual).toMatchObject({
    canPrefill: true,
    pricingStatus: "manual",
    valuePerCard: "90.00",
  });
});

test("adding a catalog card requires confirmation of its stable exact version", async ({
  page,
}) => {
  const normalId = "11111111-1111-4111-8111-111111111111";
  const reverseId = "22222222-2222-4222-8222-222222222222";
  await page.goto("/");
  await revealShell(page, "view-scan");
  await page.evaluate(
    async ({ normalId, reverseId }) => {
      const { openPositionSheet } = await import("/app.js?v=111");
      openPositionSheet({
        id: "tcgdex:en:sv03.5-025",
        cardId: "33333333-3333-4333-8333-333333333333",
        name: "Pikachu",
        set: "151",
        number: "025/165",
        language: "en",
        rarity: "Common",
        variantOptions: [
          {
            id: normalId,
            collectibleId: normalId,
            finish: "normal",
            edition: "",
            language: "en",
          },
          {
            id: reverseId,
            collectibleId: reverseId,
            finish: "reverse holofoil",
            edition: "",
            language: "en",
          },
        ],
      });
    },
    { normalId, reverseId },
  );

  await expect(
    page.getByRole("heading", { name: "Add to your library" }),
  ).toBeVisible();
  const selector = page.locator("#positionVariantChoice");
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("radio")).toHaveCount(2);
  await expect(page.locator("#sheetContent")).toContainText(
    "Confirm the printing shown on your card",
  );
  await selector.getByRole("radio", { name: /Reverse Holofoil/ }).check();
  await expect(page.locator("#positionVariantId")).toHaveValue(reverseId);
  await expect(page.locator("#positionVariant")).toHaveValue(
    "Reverse Holofoil",
  );
});

test("collapsed collection filters are excluded from arrow navigation", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-collection");
  const visibleTargets = await page.evaluate(async () => {
    const { visibleCollectionViewTabs } = await import("/app.js?v=111");
    return visibleCollectionViewTabs().map(
      (tab) => tab.dataset.conditionFilter || tab.dataset.ledgerView,
    );
  });
  expect(visibleTargets).toEqual([
    "all",
    "Graded",
    "Sealed",
    "watchlist",
  ]);
});

test("result lists announce concise statuses instead of whole containers", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#cardLedger")).not.toHaveAttribute("aria-live");
  await expect(page.locator("#quickSearchResults")).not.toHaveAttribute(
    "aria-live",
  );
  await expect(page.locator("#gradingActivityList")).not.toHaveAttribute(
    "aria-live",
  );
  await expect(page.locator("#quickSearchStatus")).toHaveAttribute(
    "role",
    "status",
  );
  await expect(page.locator("#gradingActivityStatus")).toHaveAttribute(
    "role",
    "status",
  );
});

test("account setup failure contains focus and keeps the app inert for retry", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-dashboard");
  await page.evaluate(async () => {
    const { openOnboarding } = await import("/app.js?v=111");
    openOnboarding();
  });
  await expect(page.locator("#onboardingDialog")).toHaveAttribute(
    "aria-modal",
    "true",
  );
  await expect(page.locator("#appShell")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(await page.locator("#appShell").evaluate((node) => node.inert)).toBe(
    true,
  );
  await expect(
    page.getByRole("button", { name: "Try again" }),
  ).toBeFocused();
  await expect(page.locator('input[name="softwareMode"], input[name="experience"]')).toHaveCount(0);
  await expect(page.locator("#onboardingDescription")).toContainText(
    "Your saved information is unchanged",
  );
});

test("light sidebar panels and grading CTA keep readable contrast", async ({
  page,
}) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await revealShell(page, "view-collection");
  const contrast = await page.evaluate(() => {
    const rgb = (value) =>
      value
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
    const luminance = (value) => {
      const channels = rgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const ratio = (foreground, background) => {
      const [light, dark] = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a,
      );
      return (light + 0.05) / (dark + 0.05);
    };
    const gradientColors = (selector) =>
      getComputedStyle(document.querySelector(selector)).backgroundImage.match(
        /rgba?\([^)]*\)/g,
      ) || [];
    const minimumGradientRatio = (textSelector, backgroundSelector) => {
      const foreground = getComputedStyle(
        document.querySelector(textSelector),
      ).color;
      return Math.min(
        ...gradientColors(backgroundSelector).map((background) =>
          ratio(foreground, background),
        ),
      );
    };
    return {
      account: minimumGradientRatio("#sidebarAccountName", ".sidebar-account"),
      grader: minimumGradientRatio(
        ".digital-grader-launch em",
        ".digital-grader-launch",
      ),
    };
  });
  expect(contrast.account).toBeGreaterThanOrEqual(4.5);
  expect(contrast.grader).toBeGreaterThanOrEqual(4.5);
});

test("reduced-motion preference suppresses transitions and animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await revealShell(page, "view-collection");
  const timings = await page.evaluate(() => {
    const grader = document.querySelector(".digital-grader-launch");
    const sidebar = document.querySelector(".sidebar-item");
    return {
      graderTransition: getComputedStyle(grader).transitionDuration,
      sidebarTransition: getComputedStyle(sidebar).transitionDuration,
      sheenAnimation: getComputedStyle(grader, "::after").animationDuration,
    };
  });
  const seconds = (value) =>
    Math.max(
      ...value.split(",").map((part) => {
        const timing = part.trim();
        return timing.endsWith("ms")
          ? Number.parseFloat(timing) / 1000
          : Number.parseFloat(timing);
      }),
    );
  expect(seconds(timings.graderTransition)).toBeLessThanOrEqual(0.00001);
  expect(seconds(timings.sidebarTransition)).toBeLessThanOrEqual(0.00001);
  expect(seconds(timings.sheenAnimation)).toBeLessThanOrEqual(0.00001);
});

test("grading capture keeps four views and live checks in one focused surface", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-scan");
  await page.evaluate(() => {
    const sheet = document.querySelector("#bottomSheet");
    sheet.hidden = false;
    sheet.dataset.experience = "grading";
    document.querySelector("#sheetContent").innerHTML = `
      <div class="grading-capture-progress">
        <div><span>Digital grading · 2 of 4</span><strong>Capture the back</strong></div>
        <ol><li class="complete">1</li><li class="active">2</li><li>3</li><li>4</li></ol>
      </div>
      <div class="auto-capture-stage"><div class="card-guide"></div></div>
      <div class="sheet-actions"><button class="secondary" type="button">Use a photo</button><button class="primary" type="button">Capture back</button></div>`;
  });
  await expect(page.getByText("Digital grading · 2 of 4")).toBeVisible();
  await expect(page.locator(".camera-check-rail")).toHaveCount(0);
  const audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.textBelowFloor).toEqual([]);
  expect(audit.outsideViewport).toEqual([]);
  expect(audit.undersizedMobileButtons).toEqual([]);
});

test("grading capture uses four directional bubbles and compact reports lead with data", async ({
  page,
}) => {
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await revealShell(page, "view-collection");
  await page.evaluate(() => {
    const sheet = document.querySelector("#bottomSheet");
    sheet.hidden = false;
    sheet.dataset.experience = "grading";
    document.querySelector("#sheetContent").innerHTML = `
      <div class="auto-capture-stage">
        <div class="auto-capture-guide">
          <i></i><i></i><i></i><i></i>
          <div class="camera-edge-levels" id="deviceCameraLevel" role="status">
            <span class="edge-level horizontal top" data-state="ready"><i></i></span>
            <span class="edge-level horizontal bottom" data-state="ready"><i></i></span>
            <span class="edge-level vertical left" data-state="adjust"><i></i></span>
            <span class="edge-level vertical right" data-state="adjust"><i></i></span>
            <b class="sr-only">Tilt toward the off-center bubbles</b>
          </div>
        </div>
      </div>
      <div class="grading-report-shell compact-report">
        <section class="report-evidence-carousel"><div class="report-evidence-track"><figure><div class="report-evidence-photo"><img alt="Mewtwo GX front evidence" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='630' height='880'%3E%3Crect width='630' height='880' fill='%2352674e'/%3E%3C/svg%3E"><button type="button" aria-label="Open corner defect"><span>1</span></button></div><figcaption>Front · 1 outlined</figcaption></figure></div><div class="report-carousel-hint">Card photo</div></section>
        <section class="compact-grade-hero"><span>Mica pregrade</span><strong>8.4</strong><em>Most likely PSA result · PSA 8</em><small>Probability-weighted PSA outcome · not an official PSA grade</small><div class="pregrade-confidence-grid"><span><b>91%</b><small>Evidence seen</small></span><span><b>98%</b><small>Card identity</small></span></div></section>
        <section class="report-subgrades"><div class="compact-report-heading"><span>Subgrades</span><strong>Visible condition</strong></div><div class="report-subgrade-grid">${["Centering", "Corners", "Edges", "Surface"].map((label) => `<article class="report-subgrade"><span>${label}</span><div class="subgrade-gauge" style="--subgrade:8.4"><i></i><strong>8.4</strong></div><small>Front and back evidence supported this score with 91% coverage.</small></article>`).join("")}</div></section>
        <section class="grade-likelihood"><div class="compact-report-heading"><span>Grade likelihood</span><strong>1–10</strong></div><svg viewBox="0 0 500 170"><polyline points="30,130 79,130 128,130 177,128 226,125 275,115 324,92 373,55 422,44 471,105"></polyline></svg></section>
        <section class="compact-submission maybe"><span>Should you send it in?</span><strong>Maybe</strong><p>Live market data supports a closer look. Confirm the visible card in hand before paying to submit.</p></section>
      </div>`;
  });
  await expect(page.locator(".edge-level")).toHaveCount(4);
  await expect(page.locator("#deviceCameraLevel")).not.toContainText("°");
  await expect(page.locator(".compact-grade-hero > strong")).toHaveText("8.4");
  await expect(page.locator(".compact-grade-hero > span")).toHaveText(
    "Mica pregrade",
  );
  await expect(page.locator(".pregrade-confidence-grid")).toContainText(
    "Evidence seen",
  );
  await expect(page.locator(".report-subgrade")).toHaveCount(4);
  await expect(page.locator(".subgrade-gauge")).toHaveCount(4);
  await expect(page.locator(".compact-report p")).toHaveCount(1);
  await expect(page.locator(".compact-submission > strong")).toHaveText(
    "Maybe",
  );
  const audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.textBelowFloor).toEqual([]);
  expect(audit.outsideViewport).toEqual([]);
  expect(audit.undersizedMobileButtons).toEqual([]);
  const contrast = await page.evaluate(() => {
    const luminance = (color) => {
      const values = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
      return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
    };
    const ratio = (selector, backgroundSelector) => {
      const foreground = getComputedStyle(
        document.querySelector(selector),
      ).color;
      const background = getComputedStyle(
        document.querySelector(backgroundSelector),
      ).backgroundColor;
      const [light, dark] = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a,
      );
      return (light + 0.05) / (dark + 0.05);
    };
    return {
      confidence: ratio(".pregrade-confidence-grid b", ".compact-grade-hero"),
      rationale: ratio(".report-subgrade small", ".report-subgrade"),
      decision: ratio(".compact-submission p", ".compact-submission"),
    };
  });
  expect(contrast.confidence).toBeGreaterThanOrEqual(4.5);
  expect(contrast.rationale).toBeGreaterThanOrEqual(4.5);
  expect(contrast.decision).toBeGreaterThanOrEqual(4.5);
});

test("research capture consent stays optional and separate from normal grading", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-profile");
  await expect(page.locator("#gradingResearchConsentButton")).toBeVisible();
  await expect(page.locator("#gradingResearchConsentHelp")).toContainText(
    "normal grading photos are deleted after analysis",
  );
  await expect(page.locator("#gradingResearchConsentState")).toHaveText("Off");
});

test("grading-to-sale lifecycle and calibration remain readable across the supported shell", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-collection");
  await page.evaluate(() => {
    const host = document.querySelector("#cardLedger");
    host.innerHTML = `
      <article class="detail-section grading-lifecycle" aria-labelledby="testLifecycleTitle">
        <div class="detail-section-head"><h2 id="testLifecycleTitle">Grading-to-sale lifecycle</h2><span>Evidence analyzed</span></div>
        <ol class="grading-lifecycle-track">
          <li class="complete"><i aria-hidden="true"></i><span>Grading candidate</span></li>
          <li class="current"><i aria-hidden="true"></i><span>Evidence analyzed</span></li>
          <li class="pending"><i aria-hidden="true"></i><span>Selected to submit</span></li>
          <li class="pending"><i aria-hidden="true"></i><span>Submitted</span></li>
          <li class="pending"><i aria-hidden="true"></i><span>Returned</span></li>
          <li class="pending"><i aria-hidden="true"></i><span>Final disposition</span></li>
        </ol>
        <div class="grading-lifecycle-summary">
          <div><span>Photo evidence</span><strong>4 captures</strong><small>Recommendation withheld · 1 correction recorded</small></div>
          <div><span>Submission</span><strong>Not submitted</strong><small>Costs remain editable estimates</small></div>
          <div><span>Professional return</span><strong>Not returned</strong><small>Certification not recorded</small></div>
          <div><span>Current disposition</span><strong>Evidence analyzed</strong><small>Updated value unavailable</small></div>
        </div>
        <p class="legal-copy">Digital estimates are never official grades.</p>
      </article>`;
  });
  await expect(
    page.getByRole("heading", { name: "Grading-to-sale lifecycle" }),
  ).toBeVisible();
  await expect(page.locator(".grading-lifecycle-track li")).toHaveCount(6);
  await expect(page.locator(".grading-lifecycle")).toContainText(
    "Recommendation withheld",
  );
  let audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.textBelowFloor).toEqual([]);
  expect(audit.outsideViewport).toEqual([]);

  await revealShell(page, "view-profile");
  await expect(page.locator("#gradingCalibrationSummary")).not.toBeVisible();
  await page.locator("#gradingCalibration > summary").click();
  await expect(page.locator("#gradingCalibrationSummary")).toBeVisible();
  await expect(page.locator("#gradingCalibrationSummary")).toContainText(
    "Checking linked grading returns",
  );
  audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.textBelowFloor).toEqual([]);
  expect(audit.outsideViewport).toEqual([]);
});

test("portable grading report renders as a complete estimate-labeled image", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const { gradingReportImageBlob } = await import("/app.js?v=111");
    const subscores = ["centering", "corners", "edges", "surface"].map(
      (category, index) => ({
        category,
        scoreLow: 7.8 + index * 0.2,
        scoreHigh: 8.6 + index * 0.2,
        confidence: 0.82,
      }),
    );
    const blob = await gradingReportImageBlob({
      item: {
        name: "Charizard ex — Special Illustration Rare",
        set: "151",
        number: "199/165",
      },
      prediction: {
        status: "estimate",
        mostLikelyGrade: 9,
        confidence: 0.86,
        subscores,
      },
      score: {
        status: "estimate",
        score: 8.7,
        low: 8.2,
        high: 9.1,
      },
      evidenceCount: 3,
      reportId: "6bd4f20a-example",
      reportDate: "2026-07-30",
    });
    const url = URL.createObjectURL(blob);
    document.body.innerHTML =
      '<main style="margin:0;display:grid;place-items:center;background:#30382D"><img id="reportPreview" alt="Generated Mica grading report" style="width:min(100%,600px);height:auto;display:block"></main>';
    const image = document.querySelector("#reportPreview");
    image.src = url;
    await image.decode();
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      size: blob.size,
    };
  });
  expect(result).toEqual({
    width: 1200,
    height: 1600,
    size: expect.any(Number),
  });
  expect(result.size).toBeGreaterThan(40_000);
  await testInfo.attach("grading-report-preview.png", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("Add card saves in one step and retries safely without exposing server errors", async ({
  page,
}) => {
  const requests = [];
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__ = {supabaseUrl:"https://mica-ui-test.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("https://mica-ui-test.supabase.co/**", async (route) => {
    if (!route.request().url().endsWith("/rpc/create_collection_position")) {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: requests.length === 1 ? 503 : 200,
      contentType: "application/json",
      body:
        requests.length === 1
          ? JSON.stringify({
              message: "internal relation collection_items failed",
              code: "XX000",
            })
          : JSON.stringify("44444444-4444-4444-8444-444444444444"),
    });
  });
  await page.goto("/");
  await revealShell(page, "view-scan");
  await page.evaluate(async () => {
    const { openPositionSheet } = await import("/app.js?v=111");
    openPositionSheet({
      name: "Pikachu",
      set: "151",
      number: "025/165",
      language: "en",
      variant: "Normal",
    });
  });
  await expect(page.locator("#positionState")).toHaveValue("graded");
  await page.locator("#positionState").selectOption("raw");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(page.locator("#positionError")).toContainText(
    "Your details are still here",
  );
  expect(requests).toHaveLength(1);
  expect(requests[0].p_card_state).toBe("raw");
  expect(requests[0].p_identity.acquisitionCostKnown).toBe(false);
  expect(requests[0].p_raw_condition).toBeNull();
  await expect(page.locator("#positionTotalCost")).toHaveValue("");
  await expect(page.locator("#sheetContent")).not.toContainText(
    "collection_items",
  );
  await expect(page.locator(".new-card-grade-choice")).toHaveCount(0);
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(page.locator("#positionForm")).not.toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual({
    ...requests[0],
    p_identity: {
      ...requests[0].p_identity,
      ingestion: {
        ...requests[0].p_identity.ingestion,
        confirmedAt: expect.any(String),
      },
    },
  });
});

test("optional grading stays separate from the default add action and slab details remain required", async ({
  page,
}) => {
  await page.goto("/");
  await revealShell(page, "view-scan");
  await page.evaluate(async () => {
    const { openPositionSheet } = await import("/app.js?v=111");
    openPositionSheet({
      name: "Pikachu",
      set: "151",
      number: "025/165",
      language: "en",
      variant: "Normal",
    });
  });
  await expect(page.locator("#positionState")).toHaveValue("graded");
  await expect(page.locator("#positionQuantity")).toHaveValue("1");
  await expect(page.locator("#positionQuantity")).toHaveAttribute("readonly");
  await expect(page.locator("#positionGradeFirst")).not.toBeVisible();
  await expect(page.locator("#positionGrader")).toHaveAttribute("required", "");
  await expect(page.locator("#positionGrade")).toHaveAttribute("required", "");
  await page.getByRole("button", { name: "Add card", exact: true }).click();
  await expect(page.locator("#positionForm")).toBeVisible();
  expect(
    await page
      .locator("#positionGrader")
      .evaluate((node) => node.validity.valueMissing),
  ).toBe(true);
  await page.locator("#positionState").selectOption("raw");
  await expect(page.locator("#positionGradeFirst")).toBeVisible();
  await expect(page.locator("#positionCondition")).toHaveValue("unknown");
  await page.locator("#positionGradeFirst").click();
  await expect(page.locator("#positionForm")).toBeVisible();
  await expect(page.locator("#positionGradeFirst")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Add card", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("#positionTotalCost")).toHaveValue("");
  const audit = await layoutAudit(page);
  expect(audit.overflow).toBeLessThanOrEqual(0);
  expect(audit.undersizedMobileButtons).toEqual([]);
});

test("account setup retries without collecting or changing rejected preferences", async ({
  page,
}) => {
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "globalThis.__APP_CONFIG__ = {};",
    }),
  );
  await page.goto("/");
  await revealShell(page, "view-dashboard");
  await page.evaluate(async () =>
    (await import("/app.js?v=111")).openOnboarding(),
  );
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator("#onboardingError")).toHaveText(
    "Couldn’t finish account setup. Please try again.",
  );
  await expect(page.locator('input[name="softwareMode"], input[name="experience"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeEnabled();
  await expect(page.locator(".onboarding-tour")).toHaveCount(0);
  await expect(page.locator("#onboardingDialog")).not.toContainText("getUser");
});
