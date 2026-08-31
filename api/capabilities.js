import { serverEnvironment } from "../lib/env.js";
import gradingPilotHandler, {
  gradingDeletionCronHandler,
} from "../lib/grading-pilot-api.js";

export default async function handler(request, response) {
  if (request.query?.surface === "grading-pilot")
    return gradingPilotHandler(request, response);
  if (request.query?.surface === "grading-deletion")
    return gradingDeletionCronHandler(request, response);
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  try {
    const config = serverEnvironment();
    const pricingConnected = Boolean(config.pkmnpricesApiKey);
    const expandedPricing =
      pricingConnected && ["pro", "business"].includes(config.pkmnpricesPlan);
    return response.status(200).json({
      catalog: { status: "active", provider: "TCGdex" },
      pricing: {
        status: pricingConnected ? "connected" : "public_fallback",
        plan: pricingConnected ? config.pkmnpricesPlan : "free",
        verification: pricingConnected
          ? "configured_live_requests_verify_entitlements"
          : "public_only",
        features: {
          currentUsd: pricingConnected ? "configured" : "public_fallback",
          graded: expandedPricing ? "configured" : "upgrade_required",
          history: expandedPricing ? "configured" : "upgrade_required",
          cardmarket: expandedPricing ? "configured" : "upgrade_required",
          marketplaceOffers: expandedPricing
            ? "configured"
            : "upgrade_required",
          ebaySold: expandedPricing ? "configured" : "upgrade_required",
          sealed: expandedPricing ? "configured" : "upgrade_required",
          japanese: expandedPricing ? "configured" : "upgrade_required",
        },
      },
      vision: {
        status: config.aiGatewayApiKey
          ? "connected"
          : process.env.VERCEL
            ? "vercel_managed"
            : "setup_required",
      },
      advisor: {
        status: config.aiGatewayApiKey
          ? "connected"
          : process.env.VERCEL
            ? "vercel_managed"
            : "setup_required",
        privacy: "aggregate_signals_only",
      },
      push: { status: "development_only" },
    });
  } catch {
    return response.status(500).json({ error: "Configuration is invalid" });
  }
}
