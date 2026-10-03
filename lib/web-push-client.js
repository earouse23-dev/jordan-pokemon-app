import { nativeBuild } from "./native-runtime.js";
// Device consent and owner binding are separate from account-wide alert preferences.
export function notificationTimeZone(value) {
  const zone = String(value || "").trim();
  if (!zone || zone.length > 100) throw new Error("Choose a valid timezone, such as America/Chicago.");
  try { return new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone; }
  catch { throw new Error("Choose a valid timezone, such as America/Chicago."); }
}

export function deviceTimeZone() {
  return notificationTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function pushSupport(env = globalThis) {
  return Boolean(!nativeBuild && env.isSecureContext && env.navigator?.serviceWorker && env.PushManager && env.Notification);
}

export async function pushRegistration(env = globalThis) {
  if (!pushSupport(env)) throw new Error("Notifications aren’t supported here. On iPhone, open Mica from the Home Screen.");
  let timer;
  try { return await Promise.race([env.navigator.serviceWorker.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Notifications aren’t ready. Reload Mica and retry.")), 8000); })]); }
  finally { clearTimeout(timer); }
}

export function pushOwnerMessage(registration, ownerId, { status = false, timeout = 4000, Channel = globalThis.MessageChannel } = {}) {
  return new Promise((resolve, reject) => {
    if (!registration.active || !Channel) return reject(new Error("Notifications aren’t ready. Reload Mica and retry."));
    const channel = new Channel();
    const finish = (error, value) => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => finish(new Error("Couldn’t confirm device security. Please retry.")), timeout);
    channel.port1.onmessage = event => event.data?.ok ? finish(null, event.data) : finish(new Error("Couldn’t secure notifications for this account."));
    try { registration.active.postMessage(status ? { type: "MICA_PUSH_OWNER_STATUS" } : { type: "MICA_PUSH_OWNER", ownerId: ownerId || "" }, [channel.port2]); }
    catch (error) { finish(error); }
  });
}

export function applicationServerKey(value) {
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(String(value || ""))) throw new Error("Device notifications aren’t available yet.");
  const decoded = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(decoded, character => character.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error("Device notifications aren’t available yet.");
  return bytes;
}

export async function enableDevicePush({ ownerId, publicKey, save, remove, isCurrent, env = globalThis }) {
  if (!ownerId || !isCurrent()) throw new Error("Sign in again to enable device notifications.");
  if (!pushSupport(env)) throw new Error("Notifications aren’t supported here. On iPhone, open Mica from the Home Screen.");
  const key = applicationServerKey(publicKey);
  // Call permission directly from the user gesture, before waiting for SW readiness.
  const permission = await env.Notification.requestPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked. Allow them in your browser or device settings, then retry." : "Permission wasn’t granted. Tap Enable on this device to try again.");
  const registration = await pushRegistration(env);
  let subscription;
  try {
    if (!isCurrent()) throw new Error("Account changed. Please retry.");
    subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const binding = await pushOwnerMessage(registration, "", { status: true });
      if (binding.ownerId !== ownerId) { await subscription.unsubscribe(); subscription = null; }
    }
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    if (!isCurrent()) throw new Error("Account changed. Please retry.");
    await pushOwnerMessage(registration, ownerId);
    if (!isCurrent()) throw new Error("Account changed. Please retry.");
    await save(subscription.toJSON());
    if (!isCurrent()) throw new Error("Account changed. Please retry.");
    return subscription;
  } catch (error) {
    await pushOwnerMessage(registration, "").catch(() => {});
    if (subscription) {
      await subscription.unsubscribe().catch(() => {});
      if (isCurrent()) await remove(subscription.endpoint).catch(() => {});
    }
    throw error;
  }
}

export async function disableDevicePush({ remove, env = globalThis } = {}) {
  if (!pushSupport(env)) return;
  const registration = await pushRegistration(env);
  const subscription = await registration.pushManager.getSubscription();
  let failure;
  try { await pushOwnerMessage(registration, ""); } catch (error) { failure = error; }
  if (subscription) {
    try { if (!await subscription.unsubscribe()) throw new Error("Device unsubscribe failed"); } catch (error) { failure = error; }
    try { if (remove) await remove(subscription.endpoint); } catch (error) { failure = error; }
  }
  if (failure) throw new Error("Couldn’t confirm every device setting. Retry disabling notifications.");
}

export async function devicePushStatus(ownerId, env = globalThis) {
  if (!pushSupport(env)) return "unsupported";
  if (env.Notification.permission === "denied") return "blocked";
  const registration = await pushRegistration(env);
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return "disabled";
  const binding = await pushOwnerMessage(registration, "", { status: true });
  return binding.ownerId === ownerId ? "enabled" : "disabled";
}
