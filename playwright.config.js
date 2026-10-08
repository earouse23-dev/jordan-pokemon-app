import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["line"]],
  use: {
    baseURL: "http://127.0.0.1:4189",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "mobile-webkit",
      workers: 1,
      testMatch: [
        "**/password-reset.spec.js",
        "**/intake-continuity.spec.js",
        "**/search-recovery.spec.js",
        "**/add-save-recovery.spec.js",
        "**/ui-regression.spec.js",
        "**/mobile-workspaces.spec.js",
        "**/collector-home.spec.js",
        "**/grading-capture-recovery.spec.js",
        "**/document-capture.spec.js",
        "**/local-card-ocr.spec.js",
        "**/price-evidence.spec.js",
        "**/physical-copies.spec.js",
        "**/sealed-collector.spec.js",
        "**/portfolio-history.spec.js",
        "**/native-integration.spec.js",
        "**/card-profile.spec.js",
        "**/certificate-workflows.spec.js",
        "**/shipping-certificate-exclusion.spec.js",
      ],
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command:
      process.env.MICA_INTERNAL_CERTIFICATES === "1"
        ? "PORT=4189 MICA_INTERNAL_CERTIFICATES=1 node scripts/serve.mjs"
        : "PORT=4189 npm run dev",
    url: "http://127.0.0.1:4189",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
