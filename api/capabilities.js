import { serverEnvironment } from "../lib/env.js";

export default function handler(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  try {
    const config = serverEnvironment();
    return response.status(200).json({
      catalog: { status: "active", provider: "TCGdex" },
      pricing: {
        status: config.pkmnpricesApiKey ? "connected" : "public_fallback",
        plan: config.pkmnpricesApiKey ? config.pkmnpricesPlan : "free",
      },
      vision: {
        status: config.aiGatewayApiKey
          ? "connected"
          : process.env.VERCEL
            ? "vercel_managed"
            : "setup_required",
      },
      push: { status: "development_only" },
    });
  } catch {
    return response.status(500).json({ error: "Configuration is invalid" });
  }
}
