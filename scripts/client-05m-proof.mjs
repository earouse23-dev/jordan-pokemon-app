import { createHash } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import salesHandler from "../api/sales.js";
import { EXACT_SOLD_RULE_VERSION } from "../lib/pricing.js";
import {
  lookup,
  privateDir as oldDir,
  readCredential,
  soldUrl,
  sourceReady,
  valuationFromApi,
} from "./client-05l-proof.mjs";

const digest = (data) => createHash("sha256").update(data).digest("hex");
const serialize = (data) => JSON.stringify(data, null, 2) + "\n";
const stop = (reason) =>
  Object.assign(new Error(`CLIENT-05M guard: ${reason}`), {
    status: 409,
    reason,
  });
const frozen05lHash =
  "4a6a33dc3f54167d6e3b50c48a9e460a9ffb32a2497a2b6f42513bec332d1603";
const frozenProduction = Object.freeze({
  "lib/providers/pkmnprices.js":
    "829440e08d5304c51b82c0c46907f05f971e3dfb8aeec7729da4b014e445fbef",
  "lib/pricing.js":
    "878984d5cd1f9b03761034be32670ab701e604054afb4014a9d3113725242fa9",
  "lib/providers/tcgdex.js":
    "bbf702ad73e53160ddff9e6c36b92454e81f8726923cae5b1f9bb09c92682944",
  "lib/identity.js":
    "258268e68019c3cff2b5f25add43bbeb8af82629682bc8b58450b1e2a9992eb7",
  "api/sales.js":
    "852fe658036d8ccde6c5afce63dbaaec428fd03b7837a6879b5341cea2061f5e",
  "scripts/client-05l-proof.mjs":
    "3f07741c7ec6125b42ac3ffead3b05fb44183f602a86f804709c4ecc86275813",
});
const list = new URL("https://api.pkmnprices.com/v1/cards");
for (const [key, value] of Object.entries({
  name: "Clefable (1)",
  number: "01",
  total_set_number: "64",
  language: "English",
  per_page: "1",
  page: "1",
}))
  list.searchParams.set(key, value);
export const listUrl = list.toString();
export const privateDir = join(
  homedir(),
  "Library",
  "Application Support",
  "Mica",
  "client-05m-private",
);
const required = (value, number) =>
  typeof value === "string" && /^\d+$/.test(value) && Number(value) === number;
function languageFacts(value, path = "") {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const at = path ? `${path}.${key}` : key;
    if (/^languages?$/i.test(key)) return [{ path: at, value: nested }];
    return languageFacts(nested, at);
  });
}
const englishFact = (value) =>
  value == null ||
  (Array.isArray(value)
    ? value.every(englishFact)
    : typeof value === "string" &&
      ["en", "english"].includes(value.trim().toLowerCase()));
export function listMatches(body) {
  if (
    !body ||
    !Array.isArray(body.data) ||
    body.data.length !== 1 ||
    !body.pagination ||
    Number(body.pagination.page) !== 1 ||
    Number(body.pagination.per_page) !== 1 ||
    !Number.isInteger(Number(body.pagination.total)) ||
    Number(body.pagination.total) < 1
  )
    return false;
  const row = body.data[0];
  return (
    String(row?.id) === "20618" &&
    row?.name === "Clefable (1)" &&
    row?.set?.name === "Jungle" &&
    required(String(row?.number ?? ""), 1) &&
    required(String(row?.total_set_number ?? ""), 64) &&
    languageFacts(row).every((fact) => englishFact(fact.value))
  );
}
function listEvidence(body) {
  const row = Array.isArray(body?.data) ? body.data[0] : null;
  return {
    dataCount: Array.isArray(body?.data) ? body.data.length : null,
    pagination:
      body?.pagination && typeof body.pagination === "object"
        ? {
            page: body.pagination.page ?? null,
            per_page: body.pagination.per_page ?? null,
            total: body.pagination.total ?? null,
            total_pages: body.pagination.total_pages ?? null,
          }
        : null,
    candidate: row
      ? {
          id: row.id ?? null,
          name: row.name ?? null,
          number: row.number ?? null,
          total_set_number: row.total_set_number ?? null,
          set: row.set?.name ?? null,
          languageFacts: languageFacts(row),
        }
      : null,
  };
}
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
export function verify05l() {
  const path = join(oldDir, "attempt.json");
  if ((statSync(path).mode & 0o077) !== 0) throw stop("old ledger permissions");
  const bytes = readFileSync(path);
  if (digest(bytes) !== frozen05lHash) throw stop("old ledger changed");
  for (const [file, expected] of Object.entries(frozenProduction))
    if (digest(readFileSync(file)) !== expected)
      throw stop(`frozen file changed: ${file}`);
  const old = JSON.parse(bytes);
  const d = old.direct;
  if (
    old.packet !== "CLIENT-05L" ||
    old.outcome !== "identity_blocked" ||
    old.requests.length !== 1 ||
    old.requests[0].status !== 200 ||
    old.requests[0].stage !== "direct" ||
    old.rows !== null ||
    old.directGate !== "fail" ||
    old.ruleVersion !== EXACT_SOLD_RULE_VERSION ||
    !sourceReady() ||
    String(d?.id) !== "20618" ||
    d?.name !== "Clefable (1)" ||
    d?.set !== "Jungle" ||
    String(d?.number) !== "01" ||
    String(d?.total_set_number) !== "64" ||
    !d.prices?.some(
      (row) => row.variant === "1st Edition Holofoil" && row.currency === "USD",
    ) ||
    d.language !== null
  )
    throw stop("old direct evidence mismatch");
  return { hash: frozen05lHash, observedAt: old.evaluatedAt, direct: d };
}
function privatePath(directory) {
  const path = resolve(directory);
  if (path === process.cwd() || path.startsWith(process.cwd() + "/"))
    throw stop("private directory inside repository");
  mkdirSync(path, { recursive: true, mode: 0o700 });
  if (lstatSync(path).isSymbolicLink() || (lstatSync(path).mode & 0o077) !== 0)
    throw stop("private directory permissions");
  return join(realpathSync(path), "attempt.json");
}
function save(path, data) {
  const temp = `${path}.tmp`;
  const fd = openSync(temp, "w", 0o600);
  try {
    writeFileSync(fd, serialize(data));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temp, path);
}
function cachedDirect(old) {
  return {
    id: old.direct.id,
    name: old.direct.name,
    number: old.direct.number,
    total_set_number: old.direct.total_set_number,
    set: { name: old.direct.set },
    prices: old.direct.prices,
  };
}
export function createGuard(transport, ledger, persist, old) {
  let phase = 0;
  let cached = false;
  return {
    async fetch(input, options = {}) {
      const url = String(input);
      if (
        (options.method || "GET").toUpperCase() !== "GET" ||
        options.body != null ||
        (options.redirect && options.redirect !== "error")
      )
        throw stop("method, body or redirect");
      if (
        url === "https://api.pkmnprices.com/v1/cards/20618?currency=usd" &&
        phase === 1 &&
        ledger.membershipGate === "pass" &&
        !cached
      ) {
        cached = true;
        ledger.cachedDirectUses++;
        persist();
        return Response.json(cachedDirect(old));
      }
      const stage =
        phase === 0 && url === listUrl
          ? "membership"
          : phase === 1 &&
              ledger.membershipGate === "pass" &&
              cached &&
              url === soldUrl
            ? "sales"
            : null;
      if (!stage) throw stop("URL or request phase");
      phase++;
      const request = {
        stage,
        url,
        reservedCredits: stage === "membership" ? 1 : 10,
        status: "unknown_outcome",
        charge: null,
      };
      ledger.requests.push(request);
      ledger.reservedCredits += request.reservedCredits;
      persist();
      let response;
      try {
        response = await transport(input, { ...options, redirect: "error" });
      } catch (error) {
        request.error = error?.name || "transport_error";
        persist();
        throw stop("transport failed; no retry");
      }
      request.status = response.status;
      const charge = response.headers.get("x-credits-charged");
      request.charge = /^\d+$/.test(charge || "") ? Number(charge) : null;
      let body;
      try {
        body = await response.clone().json();
      } catch {
        body = null;
      }
      if (stage === "membership") {
        ledger.membership = listEvidence(body);
        ledger.membershipGate =
          response.ok && listMatches(body) ? "pass" : "fail";
        ledger.membershipObservedAt = new Date().toISOString();
      } else {
        ledger.rows = Array.isArray(body?.data)
          ? body.data.map(rowEvidence)
          : null;
        ledger.hasMore = body?.pagination?.has_more === true;
        ledger.retrievedAt = new Date().toISOString();
      }
      persist();
      if (stage === "membership" && ledger.membershipGate !== "pass")
        throw stop("membership invalid or contradictory");
      if (
        stage === "sales" &&
        (!response.ok || !Array.isArray(body?.data) || body.data.length > 10)
      )
        throw stop("sales unavailable or over ten rows");
      return response;
    },
  };
}
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
export async function runAttempt({
  transport,
  apiKey,
  directory = privateDir,
  now = Date.now(),
}) {
  const old = verify05l();
  if (!apiKey) return { stop: "credential_unconfigured", outbound: 0 };
  const path = privatePath(directory);
  const fd = openSync(path, "wx", 0o600);
  closeSync(fd);
  const ledger = {
    packet: "CLIENT-05M",
    candidate: {
      sourceCard: "base2-1",
      sourceVariant: "tcgdex:en:base2-1:variant:3a83wf50ts0izj268xwv3crwi",
      providerId: "20618",
      grade: "PSA 10",
      qualifier: "",
      currency: "USD",
    },
    evaluatedAt: new Date(now).toISOString(),
    ruleVersion: EXACT_SOLD_RULE_VERSION,
    oldLedgerHash: old.hash,
    oldDirectObservedAt: old.observedAt,
    frozenHashes: frozenProduction,
    runnerHash: digest(readFileSync("scripts/client-05m-proof.mjs")),
    requests: [],
    reservedCredits: 0,
    cachedDirectUses: 0,
    membership: null,
    membershipGate: "not_run",
    rows: null,
    hasMore: null,
    outcome: "attempt_started",
  };
  const persist = () => save(path, ledger);
  persist();
  const guard = createGuard(transport, ledger, persist, old);
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.PKMNPRICES_API_KEY;
  const output = responseObject();
  try {
    await guard.fetch(listUrl, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
    });
    globalThis.fetch = guard.fetch;
    process.env.PKMNPRICES_API_KEY = apiKey;
    await salesHandler(
      { method: "GET", query: { lookup: JSON.stringify(lookup) } },
      output,
    );
  } catch (error) {
    ledger.guardStop = error?.reason || error?.name || "error";
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.PKMNPRICES_API_KEY;
    else process.env.PKMNPRICES_API_KEY = previousKey;
  }
  ledger.apiStatus = output.statusCode ?? null;
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
    ledger.membershipGate !== "pass"
      ? "identity_blocked"
      : !ledger.rows
        ? "sales_unavailable"
        : "sales_observed";
  if (ledger.api) {
    ledger.production = valuationFromApi(
      ledger.api,
      ledger.evaluatedAt,
      ledger.hasMore,
    );
    ledger.outcome = ledger.production.status;
  }
  persist();
  return { path, ledger };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv[2] !== "--live") {
    console.error(
      "Use --live for the one authorized attempt. Offline replay uses the private ledger.",
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
        `CLIENT-05M stopped: ${error?.reason || error?.code || error?.name || "error"}`,
      );
      process.exitCode = 1;
    }
  }
}
