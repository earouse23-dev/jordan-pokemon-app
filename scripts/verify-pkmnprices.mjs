import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runPkmnPricesReadiness } from "../lib/pkmnprices-readiness.js";

// Credentials must arrive through a scoped server channel; never read env files.

const argumentsList = process.argv.slice(2);
const requestedMaximum = Number(
  argumentsList
    .find((argument) => argument.startsWith("--max-credits="))
    ?.split("=")[1] || 20_000,
);
const cacheArgument = argumentsList
  .find((argument) => argument.startsWith("--cache-file="))
  ?.slice("--cache-file=".length);

const summary = await runPkmnPricesReadiness({
  apiKey: process.env.PKMNPRICES_API_KEY,
  liveAuthorized: argumentsList.includes("--allow-live"),
  maxCredits: requestedMaximum,
});

if (cacheArgument) {
  const cachePath = resolve(process.cwd(), cacheArgument);
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(summary, null, 2)}\n`, {
    mode: 0o600,
  });
}

if (argumentsList.includes("--json")) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  process.stdout.write(`PkmnPrices readiness: ${summary.overall}\n`);
  process.stdout.write(
    `Credits: maximum ${summary.creditBudget.requestedMaximum}; planned upper bound ${summary.creditBudget.plannedUpperBound}; observed returned items ${summary.creditBudget.observedReturnedItems}; provider-reported ${summary.creditBudget.reportedCharges ?? "unknown"}\n`,
  );
  for (const entry of summary.results) {
    process.stdout.write(
      `${entry.status.padEnd(24)} ${entry.feature} (HTTP ${entry.httpStatus ?? "unknown"})\n`,
    );
  }
}

if (summary.overall !== "verified") process.exitCode = 1;
