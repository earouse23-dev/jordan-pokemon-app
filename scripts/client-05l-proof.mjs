import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  closeSync,
  fsyncSync,
  lstatSync,
  realpathSync,
  renameSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import salesHandler from "../api/sales.js";
import { normalizeTcgdexCard } from "../lib/providers/tcgdex.js";
import { collectibleIdentitySnapshot } from "../lib/identity.js";
import { exactSoldValuation, EXACT_SOLD_RULE_VERSION } from "../lib/pricing.js";

export const cardUrl = "https://api.pkmnprices.com/v1/cards/20618?currency=usd";
export const soldUrl =
  "https://api.pkmnprices.com/v1/cards/20618/listings/ebay?limit=10&sort=date_desc&graded=true&variant=1st+Edition+Holofoil&grader=PSA&grade=10";
export const source = Object.freeze({
  id: "base2-1",
  name: "Clefable",
  localId: "1",
  set: { id: "base2", name: "Jungle", cardCount: { official: 64 } },
  variants: { holo: true, firstEdition: true },
  variants_detailed: [
    {
      variantId: "3a83wf50ts0izj268xwv3crwi",
      type: "holo",
      size: "standard",
      stamp: ["1st-edition"],
    },
  ],
});
export const lookup = Object.freeze({
  clientId: "tcgdex:en:base2-1",
  pkmnpricesId: "20618",
  name: "Clefable (1)",
  set: "Jungle",
  number: "01/64",
  language: "en",
  variant: "1st Edition · Holofoil",
  finish: "holofoil",
  edition: "first_edition",
  promoType: "none",
  grader: "PSA",
  grade: "10",
  gradeQualifier: "",
  currency: "USD",
});
export const privateDir = join(
  homedir(),
  "Library",
  "Application Support",
  "Mica",
  "client-05l-private",
);
const sourceId = "tcgdex:en:base2-1:variant:3a83wf50ts0izj268xwv3crwi";
const frozenFiles = [
  "lib/providers/pkmnprices.js",
  "lib/pricing.js",
  "lib/providers/tcgdex.js",
  "lib/identity.js",
  "api/sales.js",
  "scripts/client-05l-proof.mjs",
];
const hash = (data) => createHash("sha256").update(data).digest("hex");
const json = (value) => JSON.stringify(value, null, 2) + "\n";
const stopped = (reason) =>
  Object.assign(new Error(`CLIENT-05L guard: ${reason}`), {
    status: 409,
    reason,
  });
const responseObject = () => ({
  setHeader() {},
  status(status) {
    this.statusCode = status;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
export function sourceReady(card = source) {
  const normalized = normalizeTcgdexCard(card, "en");
  const option = normalized.variantOptions.find((row) => row.id === sourceId);
  const snapshot = collectibleIdentitySnapshot(normalized, sourceId);
  return (
    card.id === "base2-1" &&
    card.name === "Clefable" &&
    String(card.localId) === "1" &&
    card.set?.id === "base2" &&
    card.set?.name === "Jungle" &&
    Number(card.set?.cardCount?.official) === 64 &&
    normalized.id === lookup.clientId &&
    normalized.number === "1/64" &&
    option?.status === "exact" &&
    option.finish === "holofoil" &&
    option.edition === "first_edition" &&
    option.promoType === "none" &&
    option.language === "en" &&
    option.metadata?.type === "holo" &&
    option.metadata?.size === "standard" &&
    option.metadata?.stampPresent === true &&
    JSON.stringify(option.metadata.stamp) === '["1st-edition"]' &&
    snapshot?.identityStatus === "exact"
  );
}
export function directMatches(card) {
  return (
    String(card?.id) === "20618" &&
    card?.name === "Clefable (1)" &&
    card?.set?.name === "Jungle" &&
    String(card?.number) === "01" &&
    String(card?.total_set_number) === "64" &&
    card?.language === "English" &&
    Array.isArray(card?.prices) &&
    card.prices.some(
      (row) =>
        row?.variant === "1st Edition Holofoil" && row?.currency === "USD",
    )
  );
}
const directEvidence = (body) => ({
  id: body?.id ?? null,
  name: body?.name ?? null,
  number: body?.number ?? null,
  total_set_number: body?.total_set_number ?? null,
  set: body?.set?.name ?? null,
  language: body?.language ?? null,
  prices: Array.isArray(body?.prices)
    ? body.prices.map((row) => ({
        variant: row?.variant ?? null,
        currency: row?.currency ?? null,
      }))
    : null,
  topLevelFields:
    body && typeof body === "object" ? Object.keys(body).sort() : [],
});
const rowEvidence = (row) => ({
  id: row?.id ?? null,
  ebay_listing_id: row?.ebay_listing_id ?? null,
  title: row?.title ?? null,
  listing_url: row?.listing_url ?? null,
  price: row?.price ?? null,
  currency: row?.currency ?? null,
  sold_at: row?.sold_at ?? null,
  ingested_at: row?.ingested_at ?? null,
  attribution: row?.attribution ?? null,
  language: row?.language ?? null,
  variant: row?.variant ?? null,
  grader: row?.grader ?? null,
  grade: row?.grade ?? null,
  grade_qualifier: row?.grade_qualifier ?? null,
  sale_type: row?.sale_type ?? null,
});
function privatePath(directory) {
  const path = resolve(directory);
  if (path === process.cwd() || path.startsWith(process.cwd() + "/"))
    throw stopped("private directory inside repository");
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (lstatSync(path).isSymbolicLink())
    throw stopped("private directory symlink");
  if ((lstatSync(path).mode & 0o077) !== 0)
    throw stopped("private directory permissions");
  return join(realpathSync(path), "attempt.json");
}
function save(path, ledger) {
  const temp = `${path}.tmp`;
  const fd = openSync(temp, "w", 0o600);
  try {
    writeFileSync(fd, json(ledger));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temp, path);
}
export function createGuard(transport, ledger, persist, card = source) {
  if (!sourceReady(card)) throw stopped("source drift");
  let phase = 0;
  let verified = false;
  return {
    async fetch(input, options = {}) {
      const url = String(input);
      const expected =
        phase === 0 ? cardUrl : phase === 1 && verified ? soldUrl : null;
      if (
        !expected ||
        url !== expected ||
        (options.method || "GET").toUpperCase() !== "GET" ||
        options.body != null ||
        (options.redirect && options.redirect !== "error")
      )
        throw stopped("URL, phase, method, body or redirect");
      const stage = phase === 0 ? "direct" : "sales";
      phase++;
      ledger.requests.push({
        stage,
        url,
        reservedCredits: stage === "direct" ? 1 : 10,
        status: "unknown_outcome",
        charge: null,
      });
      ledger.reservedCredits += stage === "direct" ? 1 : 10;
      persist(); // Durable reservation precedes transport; timeout/crash still spends this slot.
      let response;
      try {
        response = await transport(input, { ...options, redirect: "error" });
      } catch (error) {
        ledger.requests.at(-1).error = error?.name || "transport_error";
        persist();
        throw stopped("transport failed; no retry");
      }
      const request = ledger.requests.at(-1);
      request.status = response.status;
      const charge = response.headers.get("x-credits-charged");
      request.charge = /^\d+$/.test(charge || "") ? Number(charge) : null;
      let body;
      try {
        body = await response.clone().json();
      } catch {
        body = null;
      }
      if (stage === "direct") {
        ledger.direct = directEvidence(body);
        ledger.directGate =
          response.ok && directMatches(body) ? "pass" : "fail";
        verified = ledger.directGate === "pass";
      } else {
        ledger.rows = Array.isArray(body?.data)
          ? body.data.map(rowEvidence)
          : null;
        ledger.hasMore = body?.pagination?.has_more === true;
        ledger.retrievedAt = new Date().toISOString();
      }
      persist();
      if (stage === "direct" && !verified)
        throw stopped("direct identity incomplete or contradictory");
      if (
        stage === "sales" &&
        (!response.ok || !Array.isArray(body?.data) || body.data.length > 10)
      )
        throw stopped("sales response failed or exceeded ten rows");
      return response;
    },
    get outbound() {
      return phase;
    },
  };
}
export async function runAttempt({
  transport,
  apiKey,
  directory = privateDir,
  card = source,
  now = Date.now(),
}) {
  if (!apiKey) return { stop: "credential_unconfigured", outbound: 0 };
  if (!sourceReady(card)) return { stop: "source_drift", outbound: 0 };
  const path = privatePath(directory);
  const fd = openSync(path, "wx", 0o600); // Existing attempt means budget is exhausted, even if it crashed.
  closeSync(fd);
  const ledger = {
    packet: "CLIENT-05L",
    candidate: {
      sourceCard: source.id,
      sourceVariant: sourceId,
      sourceNumber: "1/64",
      providerId: "20618",
      assumption: "PSA 10, no qualifier",
      currency: "USD",
    },
    evaluatedAt: new Date(now).toISOString(),
    ruleVersion: EXACT_SOLD_RULE_VERSION,
    fileHashes: Object.fromEntries(
      frozenFiles.map((file) => [file, hash(readFileSync(file))]),
    ),
    requests: [],
    reservedCredits: 0,
    direct: null,
    directGate: "not_run",
    rows: null,
    hasMore: null,
    outcome: "attempt_started",
  };
  const persist = () => save(path, ledger);
  persist();
  const guard = createGuard(transport, ledger, persist, card);
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.PKMNPRICES_API_KEY;
  globalThis.fetch = guard.fetch;
  process.env.PKMNPRICES_API_KEY = apiKey;
  const output = responseObject();
  try {
    await salesHandler(
      { method: "GET", query: { lookup: JSON.stringify(lookup) } },
      output,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = previousKey;
  }
  ledger.apiStatus = output.statusCode;
  ledger.apiCode = output.body?.code ?? null;
  ledger.api =
    output.statusCode === 200
      ? {
          receivedCount: output.body.receivedCount,
          acceptedCount: output.body.acceptedCount,
          excludedCount: output.body.excludedCount,
          upstreamExclusions: output.body.upstreamExclusions,
          exclusions: output.body.exclusions,
          sales: output.body.sales,
          validatedContext: output.body.validatedContext,
          retrievedAt: output.body.retrievedAt,
        }
      : null;
  ledger.outcome =
    ledger.directGate !== "pass"
      ? "identity_blocked"
      : !ledger.rows
        ? "sales_unavailable"
        : "sales_observed";
  if (ledger.api) {
    const valuation = valuationFromApi(
      ledger.api,
      ledger.evaluatedAt,
      ledger.hasMore,
    );
    ledger.production = valuation;
    ledger.outcome = valuation.status;
  }
  persist();
  return { path, ledger };
}
export function valuationFromApi(api, evaluatedAt, hasMore) {
  const context = {
    canonicalId: lookup.clientId,
    identityStatus: "exact",
    name: lookup.name,
    set: lookup.set,
    number: lookup.number,
    language: lookup.language,
    variant: lookup.variant,
    finish: lookup.finish,
    edition: lookup.edition,
    promoType: lookup.promoType,
    grader: lookup.grader,
    grade: lookup.grade,
    qualifier: lookup.gradeQualifier,
    currency: lookup.currency,
  };
  return exactSoldValuation(api.sales, context, {
    now: Date.parse(evaluatedAt),
    validatedContext: api.validatedContext,
    hasMore,
    retrievedAt: api.retrievedAt,
  });
}
export function readCredential() {
  if (process.env.PKMNPRICES_API_KEY?.trim())
    return process.env.PKMNPRICES_API_KEY.trim();
  const path = resolve(".env.local");
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*PKMNPRICES_API_KEY\s*=\s*(.*?)\s*$/);
    if (match) return match[1].replace(/^(['"])(.*)\1$/, "$2").trim() || null;
  }
  return null;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] !== "--live") {
    console.error(
      "Use --live for the one authorized attempt; offline replay uses the private ledger.",
    );
    process.exitCode = 2;
  } else {
    try {
      const credential = readCredential();
      if (!credential)
        console.log(
          JSON.stringify({ stop: "credential_unconfigured", outbound: 0 }),
        );
      else {
        const result = await runAttempt({
          transport: globalThis.fetch,
          apiKey: credential,
        });
        console.log(
          JSON.stringify({
            outcome: result.ledger.outcome,
            outbound: result.ledger.requests.length,
            reservedCredits: result.ledger.reservedCredits,
            path: result.path,
          }),
        );
      }
    } catch (error) {
      console.error(
        `CLIENT-05L stopped: ${error?.reason || error?.code || error?.name || "error"}`,
      );
      process.exitCode = 1;
    }
  }
}
