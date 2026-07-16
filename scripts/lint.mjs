import { readFile } from 'node:fs/promises';
const files=['index.html','styles.css','app.js','api/cards.js','api/catalog.js','api/sales.js','api/price-sync.js','lib/core.js','lib/domain.js','lib/env.js','lib/portfolio.js','lib/pricing.js','lib/supabase-data.js','lib/providers/base.js','lib/providers/index.js','lib/providers/alt.js','lib/providers/cardladder.js','lib/providers/justtcg.js','lib/providers/pkmnprices.js','lib/providers/tcgdex.js','manifest.webmanifest','sw.js'];
const failures=[];
for(const file of files){const text=await readFile(new URL(`../${file}`,import.meta.url),'utf8');if(/PokÃ|â€”|â€™|ðŸ/.test(text))failures.push(`${file}: contains mojibake`);if(/console\.log\(/.test(text))failures.push(`${file}: contains console.log`);}
if(failures.length){console.error(failures.join('\n'));process.exit(1);} console.log(`Linted ${files.length} source files.`);
