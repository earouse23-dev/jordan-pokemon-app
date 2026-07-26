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
  "lib/image-source.js",
  "lib/portfolio.js",
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
  "scripts/evaluate-vision.mjs",
  "scripts/serve.mjs",
  "scripts/verify-pkmnprices.mjs",
  "tests/advisor.test.js",
  "tests/browser/ui-regression.spec.js",
  "tests/catalog.test.js",
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
