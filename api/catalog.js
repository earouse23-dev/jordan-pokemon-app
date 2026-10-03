import { withNativeCors } from "../lib/native-cors.js";
import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "../lib/env.js";
import { searchInternalCatalogPage } from "../lib/catalog-db.js";
import {
  parseCatalogQuery,
  searchTcgdexCardsPage,
} from "../lib/providers/tcgdex.js";

const LANGUAGES = new Set([
  "en",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "ja",
  "zh-tw",
  "id",
  "th",
]);

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return send(response, 405, { error: "Method not allowed" });
  }
  const query = String(request.query.q || "").trim();
  const language = String(request.query.language || "en").toLowerCase();
  const limit = Math.min(
    24,
    Math.max(1, Math.floor(Number(request.query.limit) || 8)),
  );
  const set = String(request.query.set || "").trim();
  const requestedSource = String(request.query.source || "");
  let continuation = null;
  try {
    if (request.query.cursor) {
      const encoded = String(request.query.cursor);
      if (encoded.length > 2048) throw new Error("cursor");
      continuation = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      );
      if (
        continuation.v !== 1 ||
        continuation.query !== query ||
        continuation.language !== language ||
        continuation.set !== set ||
        continuation.limit !== limit ||
        !["internal", "tcgdex"].includes(continuation.source) ||
        !Number.isSafeInteger(continuation.page) ||
        continuation.page < 2 ||
        continuation.page > 100000 ||
        (requestedSource && requestedSource !== continuation.source)
      )
        throw new Error("cursor");
    }
    if (
      query.length < 2 ||
      query.length > 80 ||
      set.length > 120 ||
      !LANGUAGES.has(language) ||
      (requestedSource && !["internal", "tcgdex"].includes(requestedSource))
    )
      throw new Error("query");
  } catch {
    return send(response, 400, {
      error: "Provide a valid search and matching continuation.",
    });
  }
  const source = continuation?.source || requestedSource;
  const page = continuation?.page || 1;
  const respond = (result, provider) =>
    send(
      response,
      200,
      {
        ...result,
        parsedQuery: result.parsedQuery || parseCatalogQuery(query),
        provider,
        scope: provider,
        total: null,
        nextCursor: result.hasMore
          ? Buffer.from(
              JSON.stringify({
                v: 1,
                query,
                language,
                set,
                limit,
                source: provider,
                page: page + 1,
              }),
            ).toString("base64url")
          : null,
        retrievedAt: new Date().toISOString(),
      },
      {
        "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "max-age=300",
      },
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const config = serverEnvironment();
    if (source !== "tcgdex" && config.supabaseUrl && config.supabaseSecretKey) {
      try {
        const database = createClient(
          config.supabaseUrl,
          config.supabaseSecretKey,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const internal = await searchInternalCatalogPage(
          database,
          query,
          language,
          { limit, offset: (page - 1) * limit, set, signal: controller.signal },
        );
        if (internal.cards.length || internal.hasMore || source === "internal")
          return respond(internal, "internal");
      } catch (error) {
        if (source === "internal") throw error;
        console.warn("[api/catalog] internal catalog unavailable", {
          name: error?.name || "Error",
        });
      }
    } else if (source === "internal")
      throw new Error("Internal catalog unavailable");
    const result = await searchTcgdexCardsPage(
      query,
      language,
      { limit, page, set },
      controller.signal,
    );
    return respond(result, "tcgdex");
  } catch (error) {
    console.error("[api/catalog] provider request failed", {
      name: error?.name || "Error",
    });
    return send(response, 502, {
      error: "The catalog provider is temporarily unavailable.",
      provider: source || "tcgdex",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default withNativeCors(handler, ["GET"]);
