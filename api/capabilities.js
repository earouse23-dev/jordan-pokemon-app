import { withNativeCors } from "../lib/native-cors.js";
import { serverEnvironment } from "../lib/env.js";
import { notificationDeliveryCapabilities } from "../lib/notification-delivery.js";
import gradingPilotHandler, {
  gradingDeletionCronHandler,
} from "../lib/grading-pilot-api.js";

async function handler(request, response) {
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
    const pricingConnected = Boolean(config.pkmnpricesApiKey && config.pkmnpricesPlan === "pro" && config.supabaseUrl && config.supabaseSecretKey);
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
      notifications: { inApp: "active", email: "release_hold", webPush: "release_hold" },
      recognition: { status: "active", engine: "ai_gateway", languages: ["en", "ja", "de"], photoUpload: true },
      vision: {
        status: "release_hold",
      },
      advisor: {
        status: "release_hold",
        privacy: "aggregate_signals_only",
      },
      push: { status: "development_only" },
    });
  } catch {
    return response.status(500).json({ error: "Configuration is invalid" });
  }
}

export default withNativeCors(handler, ["GET"]);
