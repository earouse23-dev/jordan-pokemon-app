import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getVercelOidcToken } from "@vercel/oidc";
import { serverEnvironment } from "../lib/env.js";
import {
  buildGatewayVisionRequest,
  extractGatewayOutput,
  normalizeVisionOutput,
  parseVisionRequest,
} from "../lib/vision.js";

function send(response, status, body, headers = {}) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Authorization");
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

function requestError(error) {
  return {
    invalid_mode: "Choose a supported AI analysis.",
    invalid_image_count: "Add every required image before analyzing.",
    invalid_image_type: "Use a JPEG, PNG, or WebP image.",
    image_too_large:
      "The prepared image is too large. Retake it closer to the card.",
  }[error?.message];
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "Method not allowed" });
  }
  let config;
  try {
    config = serverEnvironment();
  } catch {
    return send(response, 500, { error: "Server configuration is invalid" });
  }
  const supabaseAuthKey =
    config.supabasePublishableKey || config.supabaseSecretKey;
  if (!config.supabaseUrl || !supabaseAuthKey)
    return send(response, 503, {
      error: "Secure AI analysis is not configured.",
    });
  const authorization = String(request.headers.authorization || "");
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!token) return send(response, 401, { error: "Authentication required" });

  const database = createClient(config.supabaseUrl, supabaseAuthKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: identity, error: identityError } =
    await database.auth.getUser(token);
  if (identityError || !identity.user)
    return send(response, 401, { error: "Authentication required" });

  let gatewayToken = config.aiGatewayApiKey || config.vercelOidcToken;
  if (!gatewayToken) {
    try {
      gatewayToken = await getVercelOidcToken();
    } catch (error) {
      console.error("[api/vision] OIDC token unavailable", {
        name: error?.name || "Error",
      });
    }
  }
  if (!gatewayToken)
    return send(response, 503, {
      error: "AI analysis is ready but the Vercel AI Gateway is not connected.",
      code: "vision_not_configured",
    });

  let input;
  try {
    input = parseVisionRequest(request.body);
  } catch (error) {
    return send(response, 400, {
      error: requestError(error) || "Invalid analysis request.",
    });
  }

  const { data: usage, error: usageError } = await database.rpc(
    "claim_vision_usage",
    {
      p_maximum: config.visionMaxPerHour,
      p_window_seconds: 3600,
    },
  );
  if (usageError)
    return send(response, 503, {
      error: "Secure AI usage controls are not ready.",
      code: "vision_rate_limit_unavailable",
    });
  if (!usage?.allowed)
    return send(
      response,
      429,
      { error: "AI analysis limit reached. Try again later." },
      { "Retry-After": String(Math.max(1, Number(usage?.retryAfter) || 3600)) },
    );

  const safetyIdentifier = createHash("sha256")
    .update(`mica:${identity.user.id}`)
    .digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const upstream = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildGatewayVisionRequest({
          ...input,
          model: config.visionModel,
          safetyIdentifier,
        }),
      ),
      signal: controller.signal,
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error("[api/vision] gateway request failed", {
        status: upstream.status,
      });
      const billingRequired =
        upstream.status === 402 ||
        (upstream.status === 403 &&
          payload?.error?.type === "customer_verification_required");
      const status =
        upstream.status === 429 ? 429 : billingRequired ? 503 : 502;
      return send(response, status, {
        error:
          upstream.status === 429
            ? "AI analysis is busy. Try again shortly."
            : billingRequired
              ? "AI analysis is waiting for the project owner to finish billing verification."
              : "The AI analysis service could not process this image.",
        ...(billingRequired ? { code: "vision_billing_required" } : {}),
      });
    }
    const analysis = normalizeVisionOutput(
      input.mode,
      extractGatewayOutput(payload),
    );
    return send(response, 200, {
      analysis,
      mode: input.mode,
      provider: "openai",
      model: config.visionModel.replace(/^openai\//, ""),
      processedAt: new Date().toISOString(),
      privacy: { imagePersisted: false, resultPersisted: false },
    });
  } catch (error) {
    console.error("[api/vision] analysis errored", {
      name: error?.name || "Error",
    });
    return send(response, error?.name === "AbortError" ? 504 : 502, {
      error:
        error?.name === "AbortError"
          ? "AI analysis took too long. Try a smaller, clearer image."
          : "The AI analysis result could not be verified.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
