import { withNativeCors } from "../lib/native-cors.js";
import { createHash } from "node:crypto";
import {
  ECB_SOURCE_ID,
  ECB_SOURCE_URL,
  parseEcbDailyXml,
  usableFxRate,
} from "../lib/fx.js";

const MAX_BYTES = 16_384;
const TTL = 3_600_000;
let cached = null;
const cacheSeconds = (record, now) =>
  Math.max(
    0,
    Math.floor(
      Math.min(
        TTL - (now - Date.parse(record.fetchedAt)),
        Date.parse(`${record.effectiveDate}T00:00:00Z`) + 5 * 86_400_000 - now,
      ) / 1000,
    ),
  );

async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.setHeader("Cache-Control", "no-store");
    return response.status(405).json({ code: "method_not_allowed" });
  }
  let hasParameters = false;
  try {
    hasParameters = Boolean(
      request.url && new URL(request.url, "https://mica.local").search,
    );
  } catch {
    hasParameters = true;
  }
  if (hasParameters) {
    response.setHeader("Cache-Control", "no-store");
    return response.status(400).json({ code: "unsupported_parameters" });
  }
  const now = Date.now();
  if (
    cached &&
    now - Date.parse(cached.fetchedAt) < TTL &&
    usableFxRate(cached, now)
  ) {
    response.setHeader(
      "Cache-Control",
      `public, s-maxage=${cacheSeconds(cached, now)}`,
    );
    return response.status(200).json(cached);
  }
  let upstream;
  try {
    upstream = await fetch(ECB_SOURCE_URL, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "application/xml, text/xml" },
    });
    if (
      upstream.status !== 200 ||
      !/^(?:application|text)\/xml(?:\s*;|$)/i.test(
        upstream.headers.get("content-type") || "",
      )
    )
      throw new Error("source_unavailable");
    const declared = upstream.headers.get("content-length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BYTES))
      throw new Error("source_unavailable");
    const reader = upstream.body?.getReader();
    if (!reader) throw new Error("source_unavailable");
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) throw new Error("source_unavailable");
        chunks.push(value);
      }
    } finally {
      if (total > MAX_BYTES) await reader.cancel().catch(() => {});
    }
    const bytes = Buffer.concat(chunks);
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const fetchedAt = new Date(Date.now()).toISOString();
    const { effectiveDate, rate } = parseEcbDailyXml(
      xml,
      Date.parse(fetchedAt),
    );
    const contentSha256 = createHash("sha256").update(bytes).digest("hex");
    const record = {
      sourceId: ECB_SOURCE_ID,
      sourceUrl: ECB_SOURCE_URL,
      base: "EUR",
      quote: "USD",
      units: "USD per EUR",
      rate,
      effectiveDate,
      fetchedAt,
      contentSha256,
      rateRef: `${ECB_SOURCE_ID}:${effectiveDate}:${contentSha256}`,
    };
    if (!usableFxRate(record, Date.parse(fetchedAt))) {
      response.setHeader("Cache-Control", "no-store");
      return response.status(503).json({ code: "rate_stale" });
    }
    cached = record;
    response.setHeader(
      "Cache-Control",
      `public, s-maxage=${cacheSeconds(record, Date.parse(fetchedAt))}`,
    );
    return response.status(200).json(record);
  } catch {
    response.setHeader("Cache-Control", "no-store");
    return response.status(502).json({ code: "rate_unavailable" });
  } finally {
    await upstream?.body?.cancel?.().catch(() => {});
  }
}

export default withNativeCors(handler, ["GET"]);
