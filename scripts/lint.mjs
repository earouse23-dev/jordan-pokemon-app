import { readFile } from "node:fs/promises";

const files = [
  "index.html",
  "styles.css",
  "themes.css",
  "app.js",
  "api/card-image.js",
  "api/cards.js",
  "api/catalog.js",
  "api/capabilities.js",
  "api/health.js",
  "api/sales.js",
  "api/vision.js",
  "api/price-sync.js",
  "lib/advisor.js",
  "lib/catalog-db.js",
  "lib/core.js",
  "lib/domain.js",
  "lib/env.js",
  "lib/gateway-models.js",
  "lib/grading-pilot-api.js",
  "lib/grading.js",
  "lib/grading-v3.js",
  "lib/grading-dataset-v3.js",
  "lib/image-source.js",
  "lib/portfolio.js",
  "lib/psa-calibration.js",
  "lib/psa-pilot.js",
  "lib/pricing.js",
  "lib/supabase-data.js",
  "lib/vision.js",
  "lib/vision-evaluation.js",
  "lib/providers/base.js",
  "lib/providers/index.js",
  "lib/providers/alt.js",
  "lib/providers/cardladder.js",
  "lib/providers/justtcg.js",
  "lib/providers/pkmnprices.js",
  "lib/providers/tcgdex.js",
  "playwright.config.js",
  "scripts/benchmark-grading-models.mjs",
  "scripts/build-psa-pilot.mjs",
  "scripts/publish-psa-calibration.mjs",
  "scripts/evaluate-vision.mjs",
  "scripts/evaluate-grading-shadow-v3.mjs",
  "scripts/export-grading-dataset-v3.mjs",
  "scripts/serve.mjs",
  "scripts/train-psa-calibration.mjs",
  "scripts/verify-pkmnprices.mjs",
  "tests/advisor.test.js",
  "tests/browser/ui-regression.spec.js",
  "tests/catalog.test.js",
  "tests/capture-precision.test.js",
  "tests/grading-dataset-v3.test.js",
  "tests/grading-pilot.test.js",
  "tests/grading-v3.test.js",
  "tests/grading.test.js",
  "tests/psa-calibration.test.js",
  "tests/psa-pilot.test.js",
  "manifest.webmanifest",
  "sw.js",
];

const failures = [];
for (const file of files) {
  const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  if (/PokÃ|â€”|â€™|ðŸ/.test(text)) failures.push(`${file}: contains mojibake`);
  if (/console\.log\(/.test(text))
    failures.push(`${file}: contains console.log`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.info(`Linted ${files.length} source files.`);
