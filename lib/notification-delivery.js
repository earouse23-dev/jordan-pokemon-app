import { vapidConfiguration } from "./web-push.js";
const CHANNELS = new Set(["in_app", "email", "web_push"]);

function text(value, maximum = 2_000) {
  return String(value ?? "")
    .trim()
    .slice(0, maximum);
}

function email(value) {
  const candidate = text(value, 320).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : "";
}

function emailSender(value) {
  const candidate = text(value, 320);
  const bracket = candidate.match(/^.{1,100}<([^<>]+)>$/);
  return email(bracket ? bracket[1] : candidate) ? candidate : "";
}

function escapeHtml(value) {
  return text(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

export function notificationDeliveryCapabilities(config = {}) {
  return {
    inApp: "active",
    email:
      config.resendApiKey && emailSender(config.alertEmailFrom)
        ? "configured_unverified"
        : "available_after_configuration",
    webPush: vapidConfiguration(config) ? "configured_unverified" : "adapter_ready_requires_configuration",
    ...(vapidConfiguration(config) ? { webPushPublicKey: config.webPushVapidPublicKey } : {}),
  };
}

export function notificationDestinationUrl(baseUrl, value = {}) {
  const base = text(baseUrl, 1_000);
  if (!/^https:\/\/[^\s/]+(?:\/.*)?$/i.test(base)) return "";
  const destination = value && typeof value === "object" ? value : {};
  const route = text(destination.route, 50);
  if (route === "settings") return new URL("/profile", base).toString();
  const shellRoute = [
    "dashboard",
    "collection",
    "watchlist",
    "goals",
    "grading",
    "listings",
    "sales",
  ].includes(route)
    ? route === "dashboard"
      ? "dashboard"
      : "collection"
    : "dashboard";
  const url = new URL("/", base);
  if (route && route !== shellRoute) url.searchParams.set("actionRoute", route);
  if (destination.id)
    url.searchParams.set("actionId", text(destination.id, 200));
  url.hash = shellRoute;
  return url.toString();
}

export function normalizeDeliveryClaim(value = {}) {
  const channel = text(value.channel, 20);
  if (!CHANNELS.has(channel)) throw new Error("Unsupported delivery channel");
  const action =
    value.action && typeof value.action === "object" ? value.action : {};
  const normalized = {
    deliveryId: text(value.deliveryId || value.id, 100),
    channel,
    idempotencyKey: text(value.idempotencyKey, 200),
    recipientUserId: text(value.recipientUserId || value.userId, 100),
    recipientEmail: email(value.recipientEmail),
    action: {
      title: text(action.title, 120),
      reason: text(action.reason, 1_000),
      suggestedAction: text(action.suggestedAction, 300),
      destinationUrl: text(action.destinationUrl, 1_000),
    },
  };
  if (!normalized.deliveryId || !normalized.idempotencyKey)
    throw new Error("Delivery identity is required");
  return normalized;
}

async function deliverEmail(claim, config, fetchImpl) {
  if (!config.resendApiKey || !emailSender(config.alertEmailFrom))
    return {
      status: "unconfigured",
      permanent: true,
      errorCode: "email_not_configured",
    };
  if (!claim.recipientEmail)
    return {
      status: "invalid_recipient",
      permanent: true,
      errorCode: "recipient_email_unavailable",
    };
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": claim.idempotencyKey,
    },
    body: JSON.stringify({
      from: config.alertEmailFrom,
      to: [claim.recipientEmail],
      subject: claim.action.title,
      text: [
        claim.action.reason,
        claim.action.suggestedAction,
        claim.action.destinationUrl,
        "You can pause or unsubscribe from optional alerts in Mica Settings.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      html: `<h1>${escapeHtml(claim.action.title)}</h1><p>${escapeHtml(claim.action.reason)}</p><p>${escapeHtml(claim.action.suggestedAction)}</p>${claim.action.destinationUrl ? `<p><a href="${escapeHtml(claim.action.destinationUrl)}">Open this action in Mica</a></p>` : ""}<p><small>You can pause or unsubscribe from optional alerts in Mica Settings.</small></p>`,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok)
    return {
      status: "sent",
      permanent: false,
      providerMessageId: text(payload.id, 200) || null,
    };
  return {
    status: "failed",
    permanent: response.status >= 400 && response.status < 500,
    errorCode:
      text(payload.name || payload.message, 200) || `email_${response.status}`,
  };
}

export async function deliverActionNotification(
  claimValue,
  config = {},
  { fetchImpl = fetch, webPushAdapter = null } = {},
) {
  const claim = normalizeDeliveryClaim(claimValue);
  if (claim.channel === "in_app")
    return { status: "sent", permanent: false, providerMessageId: null };
  if (claim.channel === "email") return deliverEmail(claim, config, fetchImpl);
  if (typeof webPushAdapter !== "function")
    return {
      status: "unconfigured",
      permanent: true,
      errorCode: "web_push_adapter_not_configured",
    };
  return webPushAdapter(claim, config);
}
