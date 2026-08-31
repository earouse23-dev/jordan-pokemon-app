import { serverEnvironment } from "../lib/env.js";

async function probe(url, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    return response.ok ? "healthy" : "degraded";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return response.status(503).json({
      status: "degraded",
      checkedAt: new Date().toISOString(),
      services: { configuration: "invalid" },
    });
  }

  const supabaseConfigured = Boolean(
    config.supabaseUrl && config.supabasePublishableKey,
  );
  const [auth, appSchema, pricingProvider] = await Promise.all([
    supabaseConfigured
      ? probe(`${config.supabaseUrl}/auth/v1/health`, {
          apikey: config.supabasePublishableKey,
        })
      : Promise.resolve("not_configured"),
    supabaseConfigured
      ? probe(`${config.supabaseUrl}/rest/v1/collections?select=id&limit=0`, {
          apikey: config.supabasePublishableKey,
          Authorization: `Bearer ${config.supabasePublishableKey}`,
        })
      : Promise.resolve("not_configured"),
    probe("https://api.pkmnprices.com/health"),
  ]);
  const database =
    auth === "healthy" && appSchema === "healthy" ? "healthy" : "degraded";
  const status = database === "healthy" ? "healthy" : "degraded";
  return response.status(status === "healthy" ? 200 : 503).json({
    status,
    checkedAt: new Date().toISOString(),
    release: String(process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 12),
    services: {
      database,
      auth,
      appSchema,
      catalog: "configured",
      pricingProvider,
      paidPricing: config.pkmnpricesApiKey ? "configured" : "public_fallback",
      vision:
        config.aiGatewayApiKey || config.vercelOidcToken || process.env.VERCEL
          ? "configured"
          : "not_configured",
    },
  });
}
