import { createECDH, createPrivateKey, createCipheriv, createHmac, randomBytes, sign, timingSafeEqual } from "node:crypto";

function decode(value, length) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_push_key");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== length || bytes.toString("base64url") !== value) throw new Error("invalid_push_key");
  return bytes;
}

export function pushEndpoint(value) {
  const url = new URL(value);
  const host = url.hostname;
  const allowed = host === "fcm.googleapis.com" || host.endsWith(".push.apple.com") ||
    host === "updates.push.services.mozilla.com" || host.endsWith(".notify.windows.com");
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || !allowed || String(value).length > 2000)
    throw new Error("unsupported_push_endpoint");
  return url;
}

export function vapidConfiguration(config = {}) {
  try {
    const privateBytes = decode(config.webPushVapidPrivateKey, 32);
    const publicBytes = decode(config.webPushVapidPublicKey, 65);
    const pair = createECDH("prime256v1");
    pair.setPrivateKey(privateBytes);
    if (!timingSafeEqual(pair.getPublicKey(), publicBytes)) return null;
    const subject = new URL(config.webPushVapidSubject);
    if (!["https:", "mailto:"].includes(subject.protocol) || subject.username || subject.password || subject.href.length > 500) return null;
    return { privateBytes, publicBytes, subject: subject.href };
  } catch { return null; }
}

const hmac = (key, input) => createHmac("sha256", key).update(input).digest();
// All requested lengths fit one SHA-256 HKDF expansion block.
const expand = (key, info, length) => hmac(key, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);

export function encryptPushPayload(subscription, payload, { salt = randomBytes(16), privateKey = null } = {}) {
  const receiver = decode(subscription.p256dh, 65);
  if (receiver[0] !== 4) throw new Error("invalid_push_key");
  const auth = decode(subscription.auth_secret, 16);
  const plaintext = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (plaintext.length > 3993 || salt.length !== 16) throw new Error("push_payload_too_large");
  const sender = createECDH("prime256v1");
  if (privateKey) sender.setPrivateKey(privateKey); else sender.generateKeys();
  const publicKey = sender.getPublicKey();
  const shared = sender.computeSecret(receiver);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), receiver, publicKey]);
  const ikm = expand(hmac(auth, shared), keyInfo, 32);
  const prk = hmac(salt, ikm);
  const key = expand(prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = expand(prk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = createCipheriv("aes-128-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header); header.writeUInt32BE(4096, 16); header[20] = publicKey.length;
  return Buffer.concat([header, publicKey, ciphertext]);
}

export function vapidAuthorization(endpoint, config, now = Date.now()) {
  const keys = vapidConfiguration(config);
  if (!keys) throw new Error("web_push_not_configured");
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const message = `${encode({ typ: "JWT", alg: "ES256" })}.${encode({ aud: pushEndpoint(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: keys.subject })}`;
  const key = createPrivateKey({ format: "jwk", key: { kty: "EC", crv: "P-256", x: keys.publicBytes.subarray(1,33).toString("base64url"), y: keys.publicBytes.subarray(33).toString("base64url"), d: keys.privateBytes.toString("base64url") } });
  const signature = sign("sha256", Buffer.from(message), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `vapid t=${message}.${signature}, k=${config.webPushVapidPublicKey}`;
}

export async function sendWebPush(subscription, payload, config, { fetchImpl = fetch } = {}) {
  if (!vapidConfiguration(config)) return { status: "unconfigured", permanent: true, errorCode: "web_push_not_configured" };
  let endpoint, body, authorization;
  try {
    endpoint = pushEndpoint(subscription.endpoint);
    body = encryptPushPayload(subscription, JSON.stringify(payload));
    authorization = vapidAuthorization(endpoint.href, config);
  } catch { return { status: "failed", permanent: true, errorCode: "invalid_push_subscription" }; }
  try {
    const response = await fetchImpl(endpoint.href, { method: "POST", redirect: "error", signal: AbortSignal.timeout(8000), headers: { Authorization: authorization, "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "3600", Urgency: "normal" }, body });
    if (response.status >= 200 && response.status < 300) return { status: "sent", permanent: false };
    if ([404,410].includes(response.status)) return { status: "failed", permanent: true, expired: true, errorCode: "push_subscription_expired" };
    // A rejected server credential does not mean the user's subscription expired.
    return { status: "failed", permanent: response.status >= 400 && response.status < 500 && response.status !== 429, errorCode: `web_push_${response.status}` };
  } catch { return { status: "failed", permanent: false, errorCode: "web_push_network_error" }; }
}

export async function deliverPushToDevices(database, claim, config, { send = sendWebPush } = {}) {
  if (!vapidConfiguration(config)) return { status: "unconfigured", permanent: true, errorCode: "web_push_not_configured" };
  const { data: subscriptions, error } = await database.from("web_push_subscriptions").select("id,endpoint,p256dh,auth_secret").eq("user_id", claim.recipientUserId).eq("enabled", true).order("id").limit(20);
  if (error) throw new Error("push_subscriptions_unavailable");
  if (!subscriptions?.length) return { status: "failed", permanent: true, errorCode: "no_push_subscriptions" };
  const { data: previous, error: previousError } = await database.from("web_push_delivery_attempts").select("subscription_id,status,permanent").eq("delivery_id", claim.deliveryId);
  if (previousError) throw new Error("push_history_unavailable");
  let sent = false, retry = false;
  const deadline = Date.now() + 15_000;
  for (const subscription of subscriptions) {
    const prior = (previous || []).find(row => row.subscription_id === subscription.id);
    if (prior?.status === "sent") { sent = true; continue; }
    if (prior?.permanent) continue;
    if (Date.now() >= deadline) { retry = true; break; }
    const result = await send(subscription, { title: "Mica", body: "A collection update is ready to review.", tag: claim.idempotencyKey, data: { url: claim.action.destinationUrl, ownerId: claim.recipientUserId } }, config);
    const { error: saveError } = await database.from("web_push_delivery_attempts").upsert({ delivery_id: claim.deliveryId, subscription_id: subscription.id, user_id: claim.recipientUserId, status: result.status === "sent" ? "sent" : "failed", permanent: result.permanent === true, error_code: result.errorCode || null, updated_at: new Date().toISOString() }, { onConflict: "delivery_id,subscription_id" });
    if (saveError) throw new Error("push_history_save_failed");
    if (result.expired) {
      const { error: disableError } = await database.from("web_push_subscriptions").update({ enabled: false, last_failure_at: new Date().toISOString() }).eq("id", subscription.id).eq("user_id", claim.recipientUserId);
      if (disableError) throw new Error("push_expiry_save_failed");
    }
    sent ||= result.status === "sent";
    retry ||= result.status !== "sent" && !result.permanent;
  }
  return retry ? { status: "failed", permanent: false, errorCode: "some_push_devices_pending" } : sent ? { status: "sent", permanent: false } : { status: "failed", permanent: true, errorCode: "push_devices_unavailable" };
}
