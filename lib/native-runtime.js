// The web build folds this to false and does not import native plugins.
export const nativeBuild =
  typeof __MICA_NATIVE__ !== "undefined" && __MICA_NATIVE__;
export const AUTH_STORAGE_KEY = "mica.auth";
const AUTH_KEYS = [
  AUTH_STORAGE_KEY,
  "mica.auth-code-verifier",
  "mica.auth-user",
  "mica.auth-return",
];
let runtime;

export function publicNativeConfig(input) {
  const keys = [
    "supabaseUrl",
    "supabasePublishableKey",
    "apiOrigin",
    "authCallback",
  ];
  if (!input || Object.keys(input).some((key) => !keys.includes(key)))
    throw new Error("Only explicit public native configuration is permitted.");
  if (keys.some((key) => typeof input[key] !== "string"))
    throw new Error("All public native configuration fields are required.");
  const https = (value) => {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash)
      throw new Error(
        "Native configuration requires credential-free HTTPS URLs.",
      );
    return url;
  };
  const api = https(input.apiOrigin);
  const callback = https(input.authCallback);
  const supabase = https(input.supabaseUrl);
  if (
    api.href !== `${api.origin}/` ||
    api.search ||
    callback.pathname !== "/auth/native-return" ||
    callback.search ||
    !/^[a-z0-9-]+\.supabase\.co$/i.test(supabase.hostname) ||
    supabase.href !== `${supabase.origin}/` ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(input.supabasePublishableKey)
  )
    throw new Error("Native public configuration is invalid.");
  return {
    ...input,
    apiOrigin: api.origin,
    supabaseUrl: supabase.origin,
    authCallback: callback.href,
  };
}

export function createNativeRuntime(
  config,
  { keychain, preferences, app },
  onFailure = () => {},
) {
  config = Object.freeze({ ...config });
  let failed = false;
  let clearing = false;
  let callbackChain = Promise.resolve();
  let preferenceChain = Promise.resolve();
  const secure = async (method, key, value) => {
    if (!AUTH_KEYS.includes(key))
      throw new Error("Unsupported auth storage key.");
    if (failed && !clearing)
      throw new Error(
        "Secure session storage is unavailable. Restart Mica to retry.",
      );
    try {
      const result = await keychain[method]({
        key,
        ...(value === undefined ? {} : { value }),
      });
      const stored = result?.value ?? null;
      if (
        stored !== null &&
        (typeof stored !== "string" || stored.length > 128_000)
      )
        throw new Error("Invalid secure storage result.");
      return stored;
    } catch {
      failed = true;
      onFailure();
      throw new Error(
        "Secure session storage is unavailable. Restart Mica to retry.",
      );
    }
  };
  const storage = {
    getItem: (key) => secure("get", key),
    setItem: (key, value) => secure("set", key, value),
    removeItem: (key) => secure("remove", key),
  };
  const ready = () => {
    if (failed)
      throw new Error(
        "Secure session storage is unavailable. Restart Mica to retry.",
      );
  };
  const preferenceTask = (task) => {
    const result = preferenceChain.then(task);
    preferenceChain = result.catch(() => {});
    return result;
  };
  const draftKey = (owner, kind = "intake-queue") => {
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(owner))
      throw new Error("Draft owner is required.");
    if (!["intake-queue", "position-draft"].includes(kind))
      throw new Error("Unsupported draft kind.");
    return `mica:${kind}:v1:${owner}`;
  };
  return {
    config,
    storage,
    ready,
    get failed() {
      return failed;
    },
    async clearAuth() {
      clearing = true;
      let error;
      try {
        for (const key of AUTH_KEYS) {
          try {
            await storage.removeItem(key);
          } catch (failure) {
            error = failure;
          }
        }
      } finally {
        clearing = false;
      }
      if (error) throw error;
    },
    async returnUrl(purpose) {
      ready();
      if (!["signup", "recovery"].includes(purpose))
        throw new Error("Unsupported auth return.");
      const url = new URL(config.authCallback);
      const state = crypto.randomUUID();
      await storage.setItem(
        "mica.auth-return",
        JSON.stringify({ state, purpose, expires: Date.now() + 5 * 60_000 }),
      );
      url.searchParams.set("state", state);
      url.searchParams.set("purpose", purpose);
      return url.href;
    },
    handleReturn(value, client) {
      // One pending PKCE flow; SDK overwrites its verifier when a new flow starts.
      const result = callbackChain.then(async () => {
        ready();
        const url = new URL(value);
        const allowed = new URL(config.authCallback);
        if (
          url.origin !== allowed.origin ||
          url.pathname !== allowed.pathname ||
          url.username ||
          url.password ||
          url.hash ||
          [...url.searchParams.keys()].some(
            (key) => !["state", "purpose", "code"].includes(key),
          ) ||
          ["state", "purpose", "code"].some(
            (key) => url.searchParams.getAll(key).length !== 1,
          )
        )
          throw new Error("This sign-in link is not valid for Mica.");
        const pending = JSON.parse(
          (await storage.getItem("mica.auth-return")) || "null",
        );
        const code = url.searchParams.get("code");
        if (
          !pending ||
          pending.expires <= Date.now() ||
          !Number.isFinite(pending.expires) ||
          pending.state !== url.searchParams.get("state") ||
          pending.purpose !== url.searchParams.get("purpose") ||
          !["signup", "recovery"].includes(pending.purpose) ||
          !code ||
          code.length > 2048 ||
          !(await storage.getItem("mica.auth-code-verifier"))
        )
          throw new Error(
            "This sign-in link has expired. Request a new link on this device.",
          );
        await storage.removeItem("mica.auth-return");
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error)
          throw new Error(
            "Sign-in could not finish. Request a new link on this device.",
          );
        return pending.purpose;
      });
      callbackChain = result.catch(() => {});
      return result;
    },
    fetch(input, options = {}, transport = globalThis.fetch) {
      ready();
      if (
        typeof input !== "string" ||
        !/^\/api\/[a-z-]+(?:\?|$)/.test(input) ||
        /[\\#]/.test(input)
      )
        throw new Error("Unsupported native API request.");
      if (!config.apiOrigin)
        throw new Error("Mica cannot connect yet. Please try again later.");
      const url = new URL(input, config.apiOrigin);
      if (url.origin !== config.apiOrigin || !url.pathname.startsWith("/api/"))
        throw new Error("Unsupported native API request.");
      return transport(url.href, {
        ...options,
        redirect: "error",
        credentials: "omit",
      });
    },
    supabaseFetch(input, options = {}, transport = globalThis.fetch) {
      ready();
      const url = new URL(typeof input === "string" ? input : input.url);
      if (url.origin !== config.supabaseUrl || url.username || url.password)
        throw new Error("Unsupported account request.");
      return transport(input, {
        ...options,
        redirect: "error",
        credentials: "omit",
      });
    },
    readDraft(owner, kind) {
      return preferenceTask(async () => {
        const { value } = await preferences.get({ key: draftKey(owner, kind) });
        return value || "[]";
      });
    },
    writeDraft(owner, value, kind) {
      // Preferences is metadata only. Never put session or source images here.
      if (
        typeof value !== "string" ||
        value.length > 128_000 ||
        /"(?:access_token|refresh_token|password|code_verifier|authorization)"\s*:|data:image|blob:/i.test(
          value,
        )
      )
        return Promise.reject(
          new Error("Only bounded nonsecret draft metadata can be kept."),
        );
      return preferenceTask(() =>
        preferences.set({ key: draftKey(owner, kind), value }),
      );
    },
    clearDraft(owner, kind) {
      return preferenceTask(() =>
        preferences.remove({ key: draftKey(owner, kind) }),
      );
    },
    async bind(client, { onActive, onReturnError }) {
      const returned = ({ url }) =>
        this.handleReturn(url, client).catch(onReturnError);
      await app.addListener("appUrlOpen", returned);
      await app.addListener("appStateChange", ({ isActive }) => {
        if (isActive && !failed) client.auth.startAutoRefresh();
        else client.auth.stopAutoRefresh();
        onActive(isActive);
      });
      const state = await app.getState();
      if (state.isActive && !failed) client.auth.startAutoRefresh();
      else {
        client.auth.stopAutoRefresh();
        onActive(false);
      }
      const launch = await app.getLaunchUrl();
      if (launch?.url) await returned(launch);
    },
  };
}

export async function initializeNative() {
  if (!nativeBuild) return null;
  const [{ Capacitor, registerPlugin }, { App }, { Preferences }] =
    await Promise.all([
      import("@capacitor/core"),
      import("@capacitor/app"),
      import("@capacitor/preferences"),
    ]);
  if (Capacitor.getPlatform() !== "ios")
    throw new Error("This bundle requires the Mica iPhone app.");
  const supplied = globalThis.__APP_CONFIG__ || {};
  const config = supplied.supabaseUrl ? publicNativeConfig(supplied) : supplied;
  runtime = createNativeRuntime(
    config,
    {
      keychain: registerPlugin("MicaKeychain"),
      preferences: Preferences,
      app: App,
    },
    () => globalThis.dispatchEvent(new Event("mica-secure-storage-error")),
  );
  await runtime.storage.getItem(AUTH_STORAGE_KEY);
  return runtime;
}
export function nativeRuntime() {
  return runtime;
}
export function appFetch(input, options) {
  if (nativeBuild) {
    if (!runtime)
      throw new Error("Mica could not start securely. Restart to retry.");
    return runtime.fetch(input, options);
  }
  return globalThis.fetch(input, options);
}
