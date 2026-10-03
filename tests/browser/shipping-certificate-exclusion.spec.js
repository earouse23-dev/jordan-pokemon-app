import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const evidence = fileURLToPath(
  new URL("../../docs/evidence/sol-client-04b/", import.meta.url),
);
test.skip(
  process.env.MICA_INTERNAL_CERTIFICATES === "1",
  "shipping artifact only",
);
test.use({ serviceWorkers: "block" });
test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
});

test("shipping artifact has no certificate entry or direct module path", async ({
  page,
  request,
}, info) => {
  const requests = [];
  page.on("request", (value) => {
    if (/gemrate|\/v1\/certs|\/v1\/cards\/.*population/i.test(value.url()))
      requests.push(value.url());
  });
  await page.goto("/?internalCertificates=1#certificate-lookup");
  await page.evaluate(() => {
    localStorage.setItem("mica:internal-certificates", "true");
    sessionStorage.setItem("mica:internal-certificates", "true");
  });
  await page.reload();
  await expect(
    page.locator(
      "#certificateInternalBadge, #certificateLookupFromAdd, #certificateLookupFromCopy",
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => "__MICA_INTERNAL_CERTIFICATE_TEST__" in globalThis,
    ),
  ).toBe(false);
  const direct = await request.get("/internal/certificates.js");
  expect(direct.status()).toBe(404);
  expect(requests).toEqual([]);
  if (info.project.name === "desktop-chromium")
    await page.screenshot({
      path: `${evidence}/shipping-navigation.png`,
      fullPage: true,
    });
  await page.locator("#tryCardSearch").click();
  await expect(page.locator("#publicCatalog")).toBeVisible();
  await expect(page.locator("#certificateLookupFromAdd")).toHaveCount(0);
  if (info.project.name === "desktop-chromium")
    await page.screenshot({
      path: `${evidence}/shipping-public-card-search.png`,
      fullPage: true,
    });
});
