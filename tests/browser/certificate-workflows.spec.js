import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const evidence = fileURLToPath(
  new URL("../../docs/evidence/sol-client-04b/", import.meta.url),
);
const owner = "certificate-fixture-owner";

test.use({ serviceWorkers: "block" });
test.skip(
  process.env.MICA_INTERNAL_CERTIFICATES !== "1",
  "internal artifact only",
);
test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
});

async function setup(page, { copy = false, language = "en" } = {}) {
  await page.route(/https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.locator("#certificateInternalBadge")).toBeAttached();
  await page.evaluate(
    ({ owner, copy, language }) => {
      const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
      const card = {
        id: "synthetic-pikachu",
        uid: copy ? "synthetic-copy-one" : undefined,
        name: "Pikachu",
        set: "Synthetic Violet",
        number: "025/165",
        variant: "Normal",
        language,
        cardState: copy ? "graded" : "raw",
        gradingCompany: copy ? "PSA" : undefined,
        grade: copy ? "9" : undefined,
        certificationNumber: copy ? "00011111" : undefined,
        quantity: 1,
        status: "owned",
        currency: "USD",
        transactions: [],
        lots: [],
      };
      api.state.session = { user: { id: owner } };
      api.state.accountLoading = false;
      api.state.items = copy ? [card] : [];
      api.state.route = "collection";
      document.body.classList.add("authenticated");
      document.querySelector("#authGate").hidden = true;
      document.querySelector("#appShell").removeAttribute("aria-hidden");
      if (copy) api.openCardDetail(card, true);
      else api.openPositionSheet(card);
    },
    { owner, copy, language },
  );
  if (copy) await page.locator("#certificateLookupFromCopy").click();
  else await page.locator("#certificateLookupFromAdd").click();
  await expect(page.locator("#certificateLookupForm")).toBeVisible();
}

async function lookup(page, grader, certificate) {
  await page.locator("#certificateGrader").selectOption(grader);
  await page.locator("#certificateNumber").fill(certificate);
  await expect(page.locator("#certificateNumber")).toHaveValue(certificate);
  await page.locator("#certificateSearch").click();
}

test("internal artifact opens a synthetic account and visible workflow entry", async ({
  page,
}) => {
  await page.goto("/");
  const config = await page.request.get("/app-config.js");
  expect(config.status()).toBe(200);
  expect(await config.text()).toContain('"supabaseUrl":""');
  await expect(page.locator("#certificateInternalBadge")).toBeVisible();
  await page.locator("#certificateInternalStart").click();
  await expect(page.locator("#certificateLookupFromAdd")).toBeVisible();
  expect(
    await page.evaluate(
      () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.session.user.id,
    ),
  ).toBe(owner);
});

test("scan review lookup keeps leading zeros, population and explicit fixture-only add", async ({
  page,
}, info) => {
  const remoteWrites = [];
  page.on("request", (request) => {
    if (/supabase|gemrate/i.test(request.url()) && request.method() !== "GET")
      remoteWrites.push(request.url());
  });
  await setup(page);
  await lookup(page, "PSA", "00012345");
  await expect(page.locator("#certificateResult")).toContainText("00012345");
  await expect(page.locator("#certificateResult")).toContainText(
    "does not authenticate",
  );
  await expect(page.locator(".certificate-images img")).toHaveAttribute(
    "src",
    "./certificate-sample.svg",
  );
  if (info.project.name === "desktop-chromium")
    await page.screenshot({
      path: `${evidence}/internal-success.png`,
      fullPage: true,
    });
  await page.locator("#certificatePopulation").click();
  await expect(page.locator("#certificatePopulationPanel")).toContainText(
    "Grade",
  );
  await expect(page.locator("#certificatePopulationPanel")).toContainText(
    "History not available",
  );
  if (info.project.name === "desktop-chromium") {
    await page.locator("#certificatePopulationPanel").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/internal-population.png`,
      fullPage: true,
    });
  }
  await page.locator("#certificateContinue").click();
  await expect(page.locator("#positionForm")).toBeVisible();
  await expect(page.locator("#positionCertification")).toHaveValue("00012345");
  await page.locator('#positionForm button[type="submit"]').first().click();
  await expect(page.locator("#bottomSheet")).toBeHidden();
  const result = await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    return api.state.items.map(
      ({
        uid,
        certificationNumber,
        gradeClaimSource,
        internalCertificateSample,
      }) => ({
        uid,
        certificationNumber,
        gradeClaimSource,
        internalCertificateSample,
      }),
    );
  });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    certificationNumber: "00012345",
    gradeClaimSource: "user",
    internalCertificateSample: true,
  });
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    api.openCardDetail(api.state.items[0], true);
  });
  await expect(page.locator(".copy-row")).toContainText("00012345");
  await page.locator("#certificateObservationDetails").click();
  await expect(page.locator("#sheetContent")).toContainText("125");
  await expect(page.locator("#sheetContent")).toContainText(
    "2026-09-24T12:00:00Z",
  );
  expect(remoteWrites).toEqual([]);
});

test("populated draft survives back, failure, repeated lookup and explicit save", async ({
  page,
}, info) => {
  await setup(page);
  await page.locator("#certificateBack").click();
  await page.evaluate(() => {
    globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.openPositionSheet({
      id: "synthetic-pikachu",
      name: "Pikachu",
      set: "Synthetic Violet",
      number: "025/165",
      variant: "Normal",
      variantId: "normal",
      language: "en",
      variantOptions: [
        { id: "normal", label: "Normal", finish: "non_holo", language: "en" },
        {
          id: "reverse",
          label: "Reverse Holofoil",
          finish: "reverse_holofoil",
          language: "en",
        },
      ],
    });
  });
  await page.getByRole("radio", { name: /^Reverse Holofoil/ }).check();
  await page.locator("#positionState").selectOption("graded");
  await page.locator("#positionGrader").selectOption("PSA");
  await page.locator("#positionGrade").fill("9");
  await page.locator("#positionQualifier").fill("OC");
  await page.locator("#positionPurchaseDetails summary").click();
  await expect(page.locator("#positionAcquisitionMethod")).toHaveValue("direct_purchase");
  await page.locator("#positionTotalCost").fill("87.65");
  await page.locator("#positionDate").fill("2026-09-01");
  await page.locator("#certificateLookupFromAdd").click();
  await lookup(page, "PSA", "RATE");
  await expect(page.locator("#certificateStatus")).toContainText("rate limit");
  await lookup(page, "PSA", "00012345");
  await expect(page.locator(".certificate-comparison")).toContainText("Grade");
  await expect(page.locator(".certificate-comparison")).toContainText(
    "Version",
  );
  await expect(page.locator(".certificate-comparison-table")).toContainText(
    "OC",
  );
  if (info.project.name === "desktop-chromium")
    await page.screenshot({
      path: `${evidence}/revision-draft-conflict.png`,
      fullPage: true,
    });
  await page.locator("#certificateReturn").click();
  await expect(page.locator("#positionTotalCost")).toHaveValue("87.65");
  await expect(page.locator("#positionDate")).toHaveValue("2026-09-01");
  await expect(page.locator("#positionGrade")).toHaveValue("9");
  await expect(page.locator("#positionQualifier")).toHaveValue("OC");
  await expect(
    page.getByRole("radio", { name: /^Reverse Holofoil/ }),
  ).toBeChecked();
  await page.getByRole("radio", { name: /^Normal/ }).check();
  await page.locator("#positionGrade").fill("10");
  await page.locator("#positionQualifier").clear();
  await page.locator("#certificateLookupFromAdd").click();
  await lookup(page, "PSA", "00012345");
  await expect(page.locator("#certificateContinue")).toBeVisible();
  await page.locator("#certificateContinue").click();
  await expect(page.locator("#positionTotalCost")).toHaveValue("87.65");
  await expect(page.locator("#positionDate")).toHaveValue("2026-09-01");
  await page.locator('#positionForm button[type="submit"]').first().click();
  const items = await page.evaluate(
    () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items,
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    cost: 87.65,
    purchaseDate: "2026-09-01",
    grade: "10",
    certificationNumber: "00012345",
    gradeClaimSource: "user",
  });
});

test("unknown purchase flags and queue callback survive lookup without duplicate save", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#certificateBack").click();
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    const card = {
      id: "synthetic-pikachu",
      name: "Pikachu",
      set: "Synthetic Violet",
      number: "025/165",
      variant: "Normal",
      language: "en",
      currency: "EUR",
    };
    api.state.intakeQueue = [
      { key: "queue-one", card, quantity: 1, operationId: "stable-key" },
    ];
    globalThis.fixtureCallbackCount = 0;
    globalThis.fixtureCancelCount = 0;
    api.openPositionSheet(card, {
      queueEntryKey: "queue-one",
      queueOwner: "certificate-fixture-owner",
      idempotencyKey: "stable-key",
      onCancel: () => {
        globalThis.fixtureCancelCount++;
      },
      prefill: {
        cardState: "graded",
        grader: "PSA",
        grade: "10",
        acquisitionCostKnown: false,
        acquisitionDateKnown: false,
      },
      afterSave: () => {
        globalThis.fixtureCallbackCount++;
        api.state.intakeQueue = [];
      },
    });
  });
  await page.locator("#positionPurchaseDetails summary").click();
  await expect(page.locator("#positionCostUnknown")).toBeChecked();
  await expect(page.locator("#positionDateUnknown")).toBeChecked();
  await page.locator("#certificateLookupFromAdd").click();
  await page.locator("#certificateBack").click();
  await expect(page.locator("#positionCancel")).toHaveText("Back to queue");
  await page.locator("#positionCancel").click();
  expect(await page.evaluate(() => globalThis.fixtureCancelCount)).toBe(1);
  await page.locator("#certificateLookupFromAdd").click();
  await lookup(page, "PSA", "00012345");
  await page.locator("#certificateContinue").click();
  await expect(page.locator("#positionCostUnknown")).toBeChecked();
  await expect(page.locator("#positionDateUnknown")).toBeChecked();
  await page.locator('#positionForm button[type="submit"]').first().click();
  const result = await page.evaluate(() => ({
    items: globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items,
    queue: globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.intakeQueue,
    callbacks: globalThis.fixtureCallbackCount,
    cancels: globalThis.fixtureCancelCount,
  }));
  expect(result.items).toHaveLength(1);
  expect(result.items[0]).toMatchObject({
    cost: null,
    purchaseDate: null,
    currency: "EUR",
  });
  expect(result.queue).toEqual([]);
  expect(result.callbacks).toBe(1);
  expect(result.cancels).toBe(1);
});

test("the fixture save boundary refuses a second active copy with the same certificate", async ({
  page,
}) => {
  await setup(page);
  await lookup(page, "PSA", "00012345");
  await expect(page.locator("#certificateResult")).toBeVisible();
  await page.locator("#certificateContinue").click();
  await page.locator('#positionForm button[type="submit"]').first().click();
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    api.openPositionSheet({
      id: "synthetic-pikachu",
      name: "Pikachu",
      set: "Synthetic Violet",
      number: "025/165",
      variant: "Normal",
      language: "en",
    });
  });
  await page.locator("#certificateLookupFromAdd").click();
  await lookup(page, "PSA", "00012345");
  await expect(page.locator("#certificateResult")).toBeVisible();
  await page.locator("#certificateContinue").click();
  await page.locator('#positionForm button[type="submit"]').first().click();
  await expect(page.locator("#positionError")).toContainText(
    "already on an active",
  );
  expect(
    await page.evaluate(
      () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items.length,
    ),
  ).toBe(1);
});

test("existing copy retains active association and reopens unresolved sample", async ({
  page,
}, info) => {
  await setup(page, { copy: true });
  await lookup(page, "PSA", "00012345");
  await expect(page.locator(".certificate-comparison")).toContainText("Grade");
  await expect(page.locator(".certificate-comparison")).toContainText(
    "Certificate",
  );
  if (info.project.name === "desktop-chromium") {
    await page.locator("#certificateUnresolved").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/internal-conflict.png`,
      fullPage: true,
    });
  }
  await expect(page.locator("#certificateContinue")).toHaveCount(0);
  await page.locator("#certificateUnresolved").click();
  const item = await page.evaluate(
    () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items[0],
  );
  expect(item).toMatchObject({
    certificationNumber: "00011111",
    grade: "9",
  });
  expect(item.gradeClaimSource).toBeUndefined();
  expect(item.internalCertificateSample).toBeUndefined();
  expect(item.transactions).toEqual([]);
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    api.openCardDetail(api.state.items[0], true);
  });
  await page.locator("#certificateObservationDetails").click();
  await expect(page.locator("#sheetContent")).toContainText("00012345");
  await expect(page.locator("#sheetContent")).toContainText(
    "Unresolved; active certificate unchanged",
  );
});

test("BGS half grade and Japanese identity stay distinct from English printing", async ({
  page,
}) => {
  await setup(page, { language: "en" });
  await lookup(page, "BGS", "00054321");
  await expect(page.locator("#certificateResult")).toContainText("9.5");
  await expect(page.locator("#certificateResult")).toContainText("Subgrades");
  await expect(page.locator(".certificate-comparison")).toContainText(
    "Language",
  );
  await page.locator("#certificatePopulation").click();
  await expect(page.locator("#certificatePopulationPanel")).toContainText(
    "9.5",
  );
  await expect(page.locator("#certificatePopulationPanel")).toContainText(
    "Recorded history",
  );
  await expect(page.locator("#certificateContinue")).toHaveCount(0);
  await page.locator("#certificateReturn").click();
  await expect(page.locator("#positionForm")).toBeVisible();
  await expect(page.locator("#positionGrade")).toBeEmpty();
  expect(
    await page.evaluate(
      () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items,
    ),
  ).toEqual([]);
});

test("normal holofoil printing cannot silently use the normal certificate sample", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#certificateBack").click();
  await page.evaluate(() => {
    globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.openPositionSheet({
      id: "synthetic-pikachu",
      name: "Pikachu",
      set: "Synthetic Violet",
      number: "025/165",
      language: "en",
      variant: "Normal",
      variantId: "normal",
      variantOptions: [
        { id: "normal", label: "Normal", finish: "non_holo", language: "en" },
        { id: "holo", label: "Normal", finish: "holofoil", language: "en" },
      ],
    });
  });
  await page.locator('#positionVariantChoice input[value="holo"]').check();
  await page.locator("#certificateLookupFromAdd").click();
  await lookup(page, "PSA", "00012345");
  await expect(page.locator(".certificate-comparison")).toContainText("Finish");
  await expect(page.locator("#certificateContinue")).toHaveCount(0);
  await page.locator("#certificateReturn").click();
  await expect(
    page.locator('#positionVariantChoice input[value="holo"]'),
  ).toBeChecked();
});

test("conflicting BGS qualifier cannot become an active certificate association", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#certificateBack").click();
  await page.evaluate(() => {
    globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.openPositionSheet({
      id: "synthetic-ja",
      name: "Pikachu",
      set: "Synthetic Japanese Set",
      number: "025/100",
      language: "ja",
      variant: "Normal",
      finish: "non_holo",
    });
  });
  await page.locator("#positionState").selectOption("graded");
  await page.locator("#positionGrader").selectOption("BGS");
  await page.locator("#positionGrade").fill("9.5");
  await page.locator("#positionQualifier").fill("Black label");
  await page.locator("#certificateLookupFromAdd").click();
  await lookup(page, "BGS", "00054321");
  await expect(page.locator(".certificate-comparison")).toContainText(
    "Qualifier",
  );
  await expect(page.locator(".certificate-comparison-table")).toContainText(
    "Black label",
  );
  await expect(page.locator("#certificateContinue")).toHaveCount(0);
  await page.locator("#certificateReturn").click();
  await expect(page.locator("#positionQualifier")).toHaveValue("Black label");
});

test("cross-grader observation stays unresolved and isolated from sibling copy offline", async ({
  page,
}, info) => {
  await setup(page, { copy: true });
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    const first = api.state.items[0];
    first.currency = "EUR";
    first.cost = 80;
    first.transactions = [{ id: "purchase" }];
    api.state.items.push({
      ...first,
      uid: "synthetic-copy-two",
      certificationNumber: "00022222",
      transactions: [{ id: "sibling" }],
    });
  });
  await lookup(page, "BGS", "00054321");
  await expect(page.locator(".certificate-comparison")).toContainText(
    "Language",
  );
  await expect(page.locator(".certificate-comparison")).toContainText("Grader");
  await expect(page.locator(".certificate-comparison")).toContainText("Grade");
  await expect(page.locator("#certificateContinue")).toHaveCount(0);
  if (info.project.name === "desktop-chromium")
    await page.screenshot({
      path: `${evidence}/revision-cross-grader.png`,
      fullPage: true,
    });
  await page.locator("#certificateUnresolved").click();
  await page.locator("#certificateLookupFromCopy").click();
  await lookup(page, "BGS", "00054321");
  await expect(page.locator("#certificateContinue")).toHaveCount(0);
  await page.locator("#certificateUnresolved").click();
  await expect(page.locator("#certificateObservationDetails")).toHaveCount(1);
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    api.openCardDetail(api.state.items[1], true);
  });
  await expect(page.locator("#certificateObservationDetails")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    api.openCardDetail(api.state.items[0], true);
  });
  await page.locator("#certificateObservationDetails").click();
  await expect(page.locator("#sheetContent")).toContainText("00054321");
  await expect(page.locator("#sheetContent")).toContainText(
    "Synthetic BGS Japanese example",
  );
  await expect(page.locator("#sheetContent")).toContainText(
    "Unresolved; active certificate unchanged",
  );
  if (info.project.name === "desktop-chromium")
    await page.screenshot({
      path: `${evidence}/revision-observation-reopen.png`,
      fullPage: true,
    });
  const copies = await page.evaluate(
    () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items,
  );
  expect(copies[0]).toMatchObject({
    gradingCompany: "PSA",
    grade: "9",
    certificationNumber: "00011111",
    language: "en",
    currency: "EUR",
    cost: 80,
    transactions: [{ id: "purchase" }],
  });
  expect(copies[1]).toMatchObject({
    certificationNumber: "00022222",
    transactions: [{ id: "sibling" }],
  });
});

test("existing-copy duplicate uses the stored grader and exact leading-zero certificate", async ({
  page,
}) => {
  await setup(page, { copy: true });
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    const first = api.state.items[0];
    first.grade = "10";
    first.certificationNumber = "";
    api.state.items.push({
      ...first,
      uid: "duplicate-copy",
      certificationNumber: "00012345",
    });
  });
  await lookup(page, "PSA", "00012345");
  await expect(page.locator("#certificateContinue")).toBeVisible();
  await page.locator("#certificateContinue").click();
  await expect(page.locator("#certificateStatus")).toContainText(
    "already attached",
  );
  const items = await page.evaluate(
    () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items,
  );
  expect(items[0].certificationNumber).toBe("");
  expect(items[1].certificationNumber).toBe("00012345");
});

test("partial normalized observation reopens with missing fields and user provenance", async ({
  page,
}) => {
  await setup(page, { copy: true, language: "de" });
  await page.evaluate(() => {
    const item = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items[0];
    item.grade = "";
    item.certificationNumber = "";
  });
  await lookup(page, "PSA", "PARTIAL");
  await expect(page.locator("#certificateContinue")).toBeVisible();
  await page.locator("#certificateContinue").click();
  await page.evaluate(() => {
    const api = globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__;
    api.openCardDetail(api.state.items[0], true);
  });
  await page.locator("#certificateObservationDetails").click();
  await expect(page.locator("#sheetContent")).toContainText(
    "Population not available",
  );
  await expect(page.locator("#sheetContent")).toContainText("Not available");
  const item = await page.evaluate(
    () => globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.items[0],
  );
  expect(item).toMatchObject({
    certificationNumber: "PARTIAL",
    gradeClaimSource: "user",
  });
});

for (const [grader, certificate, expected] of [
  ["PSA", "NO-MATCH", "No sample record found"],
  ["CGC", "00012345", "not supported"],
  ["PSA", "UNSUPPORTED-LANGUAGE", "not supported"],
  ["PSA", "AMBIGUOUS", "More than one"],
  ["PSA", "RATE", "rate limit"],
  ["PSA", "ENTITLEMENT", "access unavailable"],
  ["PSA", "ERROR", "Lookup unavailable"],
  ["PSA", "MALFORMED", "response incomplete"],
  ["PSA", "OFFLINE", "Offline"],
]) {
  test(`${grader} ${certificate} retains input and reports ${expected}`, async ({
    page,
  }, info) => {
    await setup(page);
    await lookup(page, grader, certificate);
    await expect(page.locator("#certificateStatus")).toContainText(expected);
    await expect(page.locator("#certificateNumber")).toHaveValue(certificate);
    await expect(page.locator("#certificateResult")).toHaveCount(0);
    if (certificate === "RATE" && info.project.name === "desktop-chromium")
      await page.screenshot({
        path: `${evidence}/internal-error-retry.png`,
        fullPage: true,
      });
    if (certificate === "RATE") {
      await lookup(page, "PSA", "00012345");
      await expect(page.locator("#certificateResult")).toBeVisible();
    }
  });
}

test("partial fields and absent population remain unknown", async ({
  page,
}, info) => {
  await setup(page, { language: "de" });
  await lookup(page, "PSA", "PARTIAL");
  await expect(page.locator("#certificateResult")).toContainText(
    "Not available",
  );
  await page.locator("#certificatePopulation").click();
  await expect(page.locator("#certificatePopulationMissing")).toBeVisible();
  if (info.project.name === "desktop-chromium") {
    await page
      .locator("#certificatePopulationMissing")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${evidence}/internal-missing-population.png`,
      fullPage: true,
    });
  }
});

test("changed input, cancel, close and account change invalidate pending response", async ({
  page,
}) => {
  await setup(page);
  await lookup(page, "PSA", "SLOW");
  await page.locator("#certificateNumber").fill("00012345");
  await page.waitForTimeout(800);
  await expect(page.locator("#certificateResult")).toHaveCount(0);
  await lookup(page, "PSA", "SLOW");
  await page.locator("#certificateCancel").click();
  await expect(page.locator("#certificateStatus")).toContainText("canceled");
  await lookup(page, "PSA", "SLOW");
  await page.locator(".sheet-close").first().click();
  await page.waitForTimeout(800);
  await expect(page.locator("#positionForm")).toBeVisible();
  await expect(page.locator("#certificateResult")).toHaveCount(0);
  await page.evaluate(() =>
    globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.openPositionSheet({
      id: "synthetic-pikachu",
      name: "Pikachu",
      set: "Synthetic Violet",
      number: "025/165",
      language: "en",
      variant: "Normal",
    }),
  );
  await page.locator("#certificateLookupFromAdd").click();
  await lookup(page, "PSA", "SLOW");
  await page.evaluate(() => {
    globalThis.__MICA_INTERNAL_CERTIFICATE_TEST__.state.session.user.id =
      "other-account";
  });
  await page.waitForTimeout(800);
  await expect(page.locator("#certificateResult")).toHaveCount(0);
});
