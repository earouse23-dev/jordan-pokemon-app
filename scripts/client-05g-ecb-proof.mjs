import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import fxHandler from "../api/fx.js";

const root = new URL("../", import.meta.url);
const evidence = new URL("../docs/evidence/sol-client-05g/", import.meta.url);
const source = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const expectedHashes = {
  "api/fx.js":
    "667b377442de501aef7d8503e30579728ed0c3a92ef489b1988e4683856064da",
  "lib/fx.js":
    "2596780a21c0a9146c1f7138ad5805f422606246c6ba544b86091a73db63608d",
  "app.js": "cb49d1a08500767668588f37ff7c94c0247fa7f720f19ade85ba537ab2ba5251",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashes = {};
for (const path of Object.keys(expectedHashes)) {
  hashes[path] = hash(await readFile(new URL(path, root)));
  assert.equal(
    hashes[path],
    expectedHashes[path],
    `${path} changed after Astra review`,
  );
}
await mkdir(evidence, { recursive: true });
const preflight = {
  recordedAt: new Date().toISOString(),
  source,
  maximumOutboundRequests: 1,
  expected: {
    method: "GET",
    base: "EUR",
    quote: "USD",
    units: "USD per EUR",
    responseLimitBytes: 16_384,
    timeoutMilliseconds: 5_000,
    redirect: "manual",
    usableAgeUtcDays: "0–4",
  },
  implementationSha256: hashes,
};
await writeFile(
  new URL("preflight.json", evidence),
  `${JSON.stringify(preflight, null, 2)}\n`,
  { flag: "wx" },
);

const realFetch = globalThis.fetch;
let outbound = 0;
let guardAttempts = 0;
let upstream = null;
let captured = Promise.resolve({ bytes: null, error: "no_response" });
globalThis.fetch = async (url, options) => {
  guardAttempts += 1;
  assert.equal(url, source, "non-ECB outbound URL blocked");
  assert.equal(options?.redirect, "manual", "redirect policy changed");
  assert.equal(
    options?.signal instanceof AbortSignal,
    true,
    "timeout signal missing",
  );
  assert.equal(
    options?.headers?.Accept,
    "application/xml, text/xml",
    "accept header changed",
  );
  assert.equal(guardAttempts, 1, "second outbound request blocked");
  outbound += 1;
  const response = await realFetch(url, options);
  upstream = {
    status: response.status,
    contentType: response.headers.get("content-type"),
    declaredLength: response.headers.get("content-length"),
  };
  captured = (async () => {
    try {
      const reader = response.clone().body.getReader();
      const chunks = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16_384) {
          await reader.cancel();
          return { bytes: null, error: "capture_over_limit" };
        }
        chunks.push(value);
      }
      return { bytes: Buffer.concat(chunks), error: null };
    } catch {
      return { bytes: null, error: "capture_failed" };
    }
  })();
  return response;
};

function response() {
  return {
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const first = response();
await fxHandler({ method: "GET", url: "/api/fx" }, first);
const mirror = await captured;
const result = {
  preflightRecordedAt: preflight.recordedAt,
  completedAt: new Date().toISOString(),
  outboundRequests: outbound,
  guardAttempts,
  upstream,
  first: {
    status: first.code,
    headers: first.headers,
    record: first.code === 200 ? first.body : null,
    errorCode: first.code === 200 ? null : first.body?.code,
  },
  capture: {
    error: mirror.error,
    byteLength: mirror.bytes?.length ?? null,
    sha256: mirror.bytes ? hash(mirror.bytes) : null,
  },
  independent: null,
  cache: null,
};

if (mirror.bytes) {
  await writeFile(new URL("ecb-daily.xml", evidence), mirror.bytes);
  // Independent source-byte check: inspect the captured XML directly; do not
  // call the production parser or derive these facts from the route record.
  let xml = "";
  try {
    xml = new TextDecoder("utf-8", { fatal: true }).decode(mirror.bytes);
  } catch {
    result.capture.error = "invalid_utf8";
  }
  const dates = [
    ...xml.matchAll(/<Cube\s+time\s*=\s*(['"])(\d{4}-\d{2}-\d{2})\1\s*>/g),
  ].map((match) => match[2]);
  const leafTags = [...xml.matchAll(/<Cube\s+([^<>]*?)\s*\/>/g)].map(
    (match) => match[1],
  );
  const usd = leafTags.filter((tag) =>
    /\bcurrency\s*=\s*(['"])USD\1/.test(tag),
  );
  const rateText =
    usd.length === 1
      ? usd[0].match(/\brate\s*=\s*(['"])([0-9]+(?:\.[0-9]+)?)\1/)?.[2]
      : null;
  result.independent = {
    dateCount: dates.length,
    usdCount: usd.length,
    effectiveDate: dates.length === 1 ? dates[0] : null,
    usdPerEur:
      rateText === null || rateText === undefined ? null : Number(rateText),
    sha256: hash(mirror.bytes),
    routeAgreement: false,
  };
  result.independent.routeAgreement =
    first.code === 200 &&
    dates.length === 1 &&
    usd.length === 1 &&
    Number.isFinite(result.independent.usdPerEur) &&
    result.independent.usdPerEur > 0 &&
    first.body.effectiveDate === result.independent.effectiveDate &&
    first.body.rate === result.independent.usdPerEur &&
    first.body.contentSha256 === result.independent.sha256 &&
    first.body.rateRef ===
      `ecb-eurofxref-daily:${dates[0]}:${result.independent.sha256}` &&
    first.body.base === "EUR" &&
    first.body.quote === "USD" &&
    first.body.units === "USD per EUR" &&
    first.body.sourceUrl === source;
}

if (first.code === 200 && result.independent?.routeAgreement) {
  const second = response();
  await fxHandler({ method: "GET", url: "/api/fx" }, second);
  result.cache = {
    status: second.code,
    headers: second.headers,
    identicalRecord: JSON.stringify(second.body) === JSON.stringify(first.body),
    fetchedAtUnchanged: second.body?.fetchedAt === first.body.fetchedAt,
    outboundRequestsAfter: outbound,
    guardAttemptsAfter: guardAttempts,
  };
}

await writeFile(
  new URL("route-proof.json", evidence),
  `${JSON.stringify(result, null, 2)}\n`,
);
globalThis.fetch = realFetch;
console.log(
  JSON.stringify({
    firstStatus: result.first.status,
    outboundRequests: result.outboundRequests,
    capturedBytes: result.capture.byteLength,
    independentAgreement: result.independent?.routeAgreement ?? false,
    cache: result.cache,
  }),
);
