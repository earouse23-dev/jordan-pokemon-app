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
    const expandedPricingRequested =
      pricingConnected && ["pro", "business"].includes(config.pkmnpricesPlan);
    const requestedCapabilityStatus = expandedPricingRequested
      ? "pending_runtime_verification"
      : "not_requested";
    return response.status(200).json({
      catalog: { status: "active", provider: "TCGdex" },
      pricing: {
        status: pricingConnected ? "configured_unverified" : "public_fallback",
        declaredPlan: pricingConnected ? config.pkmnpricesPlan : null,
        capabilityAuthority: "runtime_endpoint_response",
        verification: pricingConnected
          ? "checked_when_each_feature_is_used"
          : "public_only",
        features: {
          currentUsd: pricingConnected
            ? "pending_runtime_verification"
            : "public_fallback",
          graded: requestedCapabilityStatus,
          history: requestedCapabilityStatus,
          cardmarket: requestedCapabilityStatus,
          marketplaceOffers: requestedCapabilityStatus,
          ebaySold: requestedCapabilityStatus,
          sealed: requestedCapabilityStatus,
          japanese: requestedCapabilityStatus,
          german: requestedCapabilityStatus,
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
