import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getVercelOidcToken } from "@vercel/oidc";
import { serverEnvironment } from "../lib/env.js";
import {
  buildGatewayAdvisorRequest,
  extractAdvisorOutput,
  normalizeAdvisorOutput,
  parseAdvisorRequest,
} from "../lib/advisor.js";

function send(response, status, body, headers = {}) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Vary", "Authorization");
  for (const [key, value] of Object.entries(headers))
    response.setHeader(key, value);
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  const startedAt = Date.now();
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
      error: "Secure AI guidance is not configured.",
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

  let input;
  try {
    input = parseAdvisorRequest(request.body);
  } catch {
    return send(response, 400, {
      error: "The portfolio brief request is invalid.",
    });
  }

  const { data: usage, error: usageError } = await database.rpc(
    "claim_advisor_usage",
    {
      p_maximum: config.advisorMaxPerHour,
      p_window_seconds: 3600,
    },
  );
  if (usageError)
    return send(response, 503, {
      error: "Secure AI usage controls are not ready.",
      code: "advisor_rate_limit_unavailable",
    });
  if (!usage?.allowed)
    return send(
      response,
      429,
      { error: "AI portfolio brief limit reached. Try again later." },
      { "Retry-After": String(Math.max(1, Number(usage?.retryAfter) || 3600)) },
    );

  let gatewayToken = config.aiGatewayApiKey || config.vercelOidcToken;
  if (!gatewayToken) {
    try {
      gatewayToken = await getVercelOidcToken();
    } catch (error) {
      console.error("[api/advisor] OIDC token unavailable", {
        name: error?.name || "Error",
      });
    }
  }
  if (!gatewayToken)
    return send(response, 503, {
      error:
        "AI portfolio briefs are ready but the Vercel AI Gateway is not connected.",
      code: "advisor_not_configured",
    });

  const safetyIdentifier = createHash("sha256")
    .update(`mica-advisor:${identity.user.id}`)
    .digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const upstream = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildGatewayAdvisorRequest({
          input,
          model: config.advisorModel,
          safetyIdentifier,
        }),
      ),
      signal: controller.signal,
    });
    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      console.error("[api/advisor] gateway request failed", {
        status: upstream.status,
      });
      const billingRequired =
        upstream.status === 402 ||
        (upstream.status === 403 &&
          payload?.error?.type === "customer_verification_required");
      return send(
        response,
        upstream.status === 429 ? 429 : billingRequired ? 503 : 502,
        {
          error:
            upstream.status === 429
              ? "AI guidance is busy. Try again shortly."
              : billingRequired
                ? "AI guidance is waiting for the project owner to finish billing verification."
                : "The AI guidance service could not prepare this brief.",
          ...(billingRequired ? { code: "advisor_billing_required" } : {}),
        },
      );
    }
    const brief = normalizeAdvisorOutput(extractAdvisorOutput(payload), input);
    return send(response, 200, {
      brief,
      provider: "openai",
      model: config.advisorModel.replace(/^openai\//, ""),
      processedAt: new Date().toISOString(),
      privacy: {
        portfolioDetailsSent: false,
        resultPersisted: false,
      },
      metrics: {
        latencyMs: Date.now() - startedAt,
        inputTokens: Number.isFinite(Number(payload?.usage?.input_tokens))
          ? Number(payload.usage.input_tokens)
          : null,
        outputTokens: Number.isFinite(Number(payload?.usage?.output_tokens))
          ? Number(payload.usage.output_tokens)
          : null,
      },
    });
  } catch (error) {
    console.error("[api/advisor] request errored", {
      name: error?.name || "Error",
    });
    return send(response, error?.name === "AbortError" ? 504 : 502, {
      error:
        error?.name === "AbortError"
          ? "AI guidance took too long. Try again."
          : "The AI guidance result could not be verified.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
