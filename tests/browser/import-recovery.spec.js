import { expect, test } from "@playwright/test";

const csv =
  "Name,Set,Number,Quantity,Condition,Purchase Date,Purchase Price\nPikachu,Base Set,58/102,1,Near Mint,2026-01-02,5.00";

test("import retry preserves its job and column choices without exposing backend errors", async ({
  page,
}, testInfo) => {
  const calls = [];
  let commits = 0;
  await page.route("**/app-config.js*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'globalThis.__APP_CONFIG__ = {supabaseUrl:"https://mica-import-test.supabase.co",supabasePublishableKey:"fixture-key"};',
    }),
  );
  await page.route("https://mica-import-test.supabase.co/**", async (route) => {
    const rpc = route.request().url().split("/rpc/")[1];
    if (rpc) calls.push({ rpc, body: route.request().postDataJSON() });
    let data = [];
    if (rpc === "begin_collection_import")
      data = "44444444-4444-4444-8444-444444444444";
    if (rpc === "stage_collection_import_rows") data = 1;
    if (rpc === "preview_collection_import")
      data = { invalidRows: 0, validRows: 1 };
    if (rpc === "commit_collection_import") {
      commits++;
      if (commits === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "XX000",
            message: "internal relation import_jobs failed",
          }),
        });
        return;
      }
      data = { createdRows: 1, reusedRows: 0 };
    }
    if (rpc === "rollback_collection_import_v2") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "XX000",
          message: "internal rollback transaction failed",
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  await page.goto("/");
  await page.evaluate(async (csvText) => {
    const { openCsvImportReview } = await import("/app.js?v=111");
    await openCsvImportReview(csvText, { name: "fixture.csv" });
  }, csv);
  await expect(page.locator("#commitCsvImport")).toBeDisabled();
  await page.locator("#runCsvDryCheck").click();
  await expect(page.locator("#commitCsvImport")).toBeEnabled();
  await page.locator("#commitCsvImport").click();
  await expect(page.locator("#importStatus")).toContainText(
    "could not confirm",
  );
  await expect(page.locator("#sheetContent")).not.toContainText("import_jobs");
  await expect(page.locator("#sheetContent")).not.toContainText("XX000");
  await expect(page.locator("#commitCsvImport")).toBeEnabled();
  await expect(page.locator("#importMap-name")).toHaveValue("name");
  await expect(page.locator("#bottomSheet")).toHaveAttribute(
    "data-lock-close",
    "false",
  );
  await testInfo.attach("import-retry.png", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await page.locator("#commitCsvImport").click();
  await expect(
    page.getByRole("heading", { name: "Import complete", exact: true }),
  ).toBeVisible();
  expect(
    calls.filter((call) => call.rpc === "begin_collection_import"),
  ).toHaveLength(1);
  const staged = calls.filter(
    (call) => call.rpc === "stage_collection_import_rows",
  );
  expect(staged).toHaveLength(2);
  expect(staged[1].body).toEqual(staged[0].body);
  expect(commits).toBe(2);
  await page.locator("#rollbackCsvImport").click();
  await expect(page.locator("#importRollbackStatus")).toContainText(
    "Could not confirm the undo",
  );
  await expect(page.locator("#importRollbackStatus")).not.toContainText(
    "without deleting anything",
  );
  await expect(page.locator("#sheetContent")).not.toContainText("XX000");
  await expect(page.locator("#rollbackCsvImport")).toBeEnabled();
});
