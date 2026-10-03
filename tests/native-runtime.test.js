import test from "node:test";
import assert from "node:assert/strict";
import {
  createNativeRuntime,
  publicNativeConfig,
  AUTH_STORAGE_KEY,
} from "../lib/native-runtime.js";

const config = {
  supabaseUrl: "https://mica-native-test.supabase.co",
  supabasePublishableKey: "sb_publishable_synthetic_only",
  apiOrigin: "https://mica-api.example.invalid",
  authCallback: "https://mica-beta.example.invalid/auth/native-return",
};
const ownerA = "11111111-1111-4111-8111-111111111111";
const ownerB = "22222222-2222-4222-8222-222222222222";
function fixture() {
  const secrets = new Map(),
    drafts = new Map(),
    listeners = new Map(),
    calls = [];
  let failure = "",
    failures = 0;
  const bridge =
    (method) =>
    async ({ key, value }) => {
      calls.push([method, key]);
      if (failure === method)
        throw new Error("private OS diagnostic must stay private");
      if (method === "set") secrets.set(key, value);
      if (method === "remove") secrets.delete(key);
      return { value: secrets.get(key) ?? null };
    };
  const plugins = {
    keychain: {
      get: bridge("get"),
      set: bridge("set"),
      remove: bridge("remove"),
    },
    preferences: {
      async get({ key }) {
        return { value: drafts.get(key) ?? null };
      },
      async set({ key, value }) {
        drafts.set(key, value);
      },
      async remove({ key }) {
        drafts.delete(key);
      },
    },
    app: {
      async addListener(name, fn) {
        listeners.set(name, fn);
      },
      async getState() {
        return { isActive: true };
      },
      async getLaunchUrl() {
        return { url: plugins.launch };
      },
    },
  };
  const runtime = createNativeRuntime(config, plugins, () => failures++);
  return {
    runtime,
    secrets,
    drafts,
    listeners,
    calls,
    plugins,
    fail(method) {
      failure = method;
    },
    get failures() {
      return failures;
    },
  };
}

test("explicit public inputs reject secrets, unsafe origins and arbitrary callback paths", () => {
  assert.equal(publicNativeConfig(config).apiOrigin, config.apiOrigin);
  for (const patch of [
    { serviceRoleKey: "secret" },
    { supabasePublishableKey: "sb_secret_no" },
    { supabasePublishableKey: "eyJhbGciOiJIUzI1NiJ9.fake.service_role" },
    { apiOrigin: "http://example.invalid" },
    { apiOrigin: "https://a.invalid/api" },
    { apiOrigin: "https://user:pass@example.invalid" },
    { authCallback: "https://mica-beta.example.invalid/anything" },
    { authCallback: config.authCallback + "?state=static" },
    { supabaseUrl: "https://evil.invalid" },
  ])
    assert.throws(() => publicNativeConfig({ ...config, ...patch }));
});

test("API forwarding retains method, bearer, abort and all error statuses; redirects are prohibited", async () => {
  const { runtime } = fixture();
  const abort = new AbortController();
  for (const status of [200, 401, 403, 429, 503]) {
    const response = await runtime.fetch(
      "/api/graded-valuation?test=synthetic",
      {
        method: "POST",
        headers: { Authorization: "Bearer synthetic" },
        body: "{}",
        signal: abort.signal,
      },
      async (url, options) => {
        assert.equal(
          url,
          config.apiOrigin + "/api/graded-valuation?test=synthetic",
        );
        assert.equal(options.headers.Authorization, "Bearer synthetic");
        assert.equal(options.signal, abort.signal);
        assert.equal(options.method, "POST");
        assert.equal(options.body, "{}");
        assert.equal(options.redirect, "error");
        assert.equal(options.credentials, "omit");
        return new Response("{}", { status });
      },
    );
    assert.equal(response.status, status);
  }
  for (const value of [
    "//evil.invalid/api/sales",
    "https://evil.invalid/api/sales",
    "/api/../sales",
    "/api/%2e%2e/sales",
    "/api/sales#x",
    "/api/sales\\x",
  ]) {
    assert.throws(() =>
      runtime.fetch(value, {}, () => {
        throw new Error("must not reach transport");
      }),
    );
  }
  await assert.rejects(
    runtime.fetch("/api/sales", {}, async () => {
      throw new TypeError("offline");
    }),
    /offline/,
  );
  assert.throws(() =>
    runtime.supabaseFetch("https://evil.invalid/auth", {}, () => {}),
  );
});

test("Keychain adapter supports restart but rejects read/write/delete failures without fallback", async () => {
  const f = fixture();
  await f.runtime.storage.setItem(AUTH_STORAGE_KEY, "synthetic session");
  const fresh = createNativeRuntime(config, f.plugins);
  assert.equal(
    await fresh.storage.getItem(AUTH_STORAGE_KEY),
    "synthetic session",
  );
  assert.equal(f.drafts.size, 0);
  await assert.rejects(f.runtime.storage.getItem("other-app"), /Unsupported/);
  for (const method of ["get", "set", "remove"]) {
    const failing = fixture();
    failing.fail(method);
    await assert.rejects(
      failing.runtime.storage[
        method === "get"
          ? "getItem"
          : method === "set"
            ? "setItem"
            : "removeItem"
      ](AUTH_STORAGE_KEY, "synthetic"),
      /Secure session storage/,
    );
    assert.equal(failing.failures, 1);
    assert.throws(
      () => failing.runtime.fetch("/api/sales", {}, () => {}),
      /Secure/,
    );
    assert.throws(
      () =>
        failing.runtime.supabaseFetch(
          config.supabaseUrl + "/rest/v1/collection_items",
          {},
          () => {},
        ),
      /Secure/,
    );
    assert.equal(failing.drafts.size, 0);
  }
});

test("signout clears exactly all app auth keys and attempts remaining deletes after a failure", async () => {
  const f = fixture();
  for (const key of [
    AUTH_STORAGE_KEY,
    "mica.auth-code-verifier",
    "mica.auth-user",
    "mica.auth-return",
  ])
    await f.runtime.storage.setItem(key, "synthetic");
  f.secrets.set("unrelated", "preserved");
  await f.runtime.clearAuth();
  assert.deepEqual([...f.secrets], [["unrelated", "preserved"]]);
  const failing = fixture();
  failing.fail("remove");
  await assert.rejects(failing.runtime.clearAuth());
  assert.equal(
    failing.calls.filter(([method]) => method === "remove").length,
    4,
  );
});

test("auth state and SDK verifier gate exchange; expiry, arbitrary links and replay make zero exchanges", async () => {
  const f = fixture();
  let exchanges = 0;
  const client = {
    auth: {
      async exchangeCodeForSession(code) {
        assert.equal(code, "synthetic-code");
        exchanges++;
        return { error: null };
      },
    },
  };
  const link = new URL(await f.runtime.returnUrl("recovery"));
  link.searchParams.set("code", "synthetic-code");
  await f.runtime.storage.setItem(
    "mica.auth-code-verifier",
    "synthetic-verifier/recovery",
  );
  for (const bad of [
    link.href.replace("mica-beta.example.invalid", "evil.invalid"),
    link.href.replace("/auth/native-return", "/wrong"),
    link.href + "#access_token=bad",
    link.href.replace("state=", "state=wrong"),
    link.href + "&code=duplicate",
    link.href + "&arbitrary=bad",
  ])
    await assert.rejects(f.runtime.handleReturn(bad, client));
  assert.equal(exchanges, 0);
  const pending = JSON.parse(f.secrets.get("mica.auth-return"));
  f.secrets.set("mica.auth-return", JSON.stringify({ ...pending, expires: 0 }));
  await assert.rejects(f.runtime.handleReturn(link.href, client));
  f.secrets.set("mica.auth-return", JSON.stringify(pending));
  const outcomes = await Promise.allSettled([
    f.runtime.handleReturn(link.href, client),
    f.runtime.handleReturn(link.href, client),
  ]);
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  assert.equal(exchanges, 1);
  await assert.rejects(f.runtime.handleReturn(link.href, client));
  assert.equal(exchanges, 1);
});

test("cold and warm callbacks use the same gate; lifecycle refresh follows foreground", async () => {
  const f = fixture(),
    refresh = [],
    active = [],
    errors = [];
  let exchanges = 0;
  const client = {
    auth: {
      startAutoRefresh() {
        refresh.push("start");
      },
      stopAutoRefresh() {
        refresh.push("stop");
      },
      async exchangeCodeForSession() {
        exchanges++;
        return { error: null };
      },
    },
  };
  const cold = new URL(await f.runtime.returnUrl("signup"));
  cold.searchParams.set("code", "cold");
  await f.runtime.storage.setItem("mica.auth-code-verifier", "verifier");
  f.plugins.launch = cold.href;
  await f.runtime.bind(client, {
    onActive: (value) => active.push(value),
    onReturnError: (error) => errors.push(error),
  });
  assert.equal(exchanges, 1);
  const warm = new URL(await f.runtime.returnUrl("recovery"));
  warm.searchParams.set("code", "warm");
  await f.listeners.get("appUrlOpen")({ url: warm.href });
  assert.equal(exchanges, 2);
  await f.listeners.get("appUrlOpen")({ url: warm.href });
  assert.equal(errors.length, 1);
  f.listeners.get("appStateChange")({ isActive: false });
  f.listeners.get("appStateChange")({ isActive: true });
  assert.deepEqual(refresh, ["start", "stop", "start"]);
  assert.deepEqual(active, [false, true]);
});

test("owner-bound Preferences survive fresh runtime, preserve retry IDs, clear prior owner and reject secrets/images", async () => {
  const f = fixture();
  const queue = JSON.stringify([
    {
      operationId: ownerB,
      quantity: 1,
      pending: { idempotencyKey: ownerB },
      card: { name: "Synthetic", image: "https://example.invalid/card.png" },
    },
  ]);
  await f.runtime.writeDraft(ownerA, queue);
  const fresh = createNativeRuntime(config, f.plugins);
  assert.equal(await fresh.readDraft(ownerA), queue);
  assert.equal(await fresh.readDraft(ownerB), "[]");
  await f.runtime.writeDraft(ownerA, '{"draft":"separate"}', "position-draft");
  assert.equal(await fresh.readDraft(ownerA, "position-draft"), '{"draft":"separate"}');
  await f.runtime.clearDraft(ownerA, "position-draft");
  assert.equal(await fresh.readDraft(ownerA, "position-draft"), "[]");
  assert.equal(await fresh.readDraft(ownerA), queue);
  await Promise.all([
    f.runtime.writeDraft(ownerA, queue),
    f.runtime.clearDraft(ownerA),
  ]);
  assert.equal(await fresh.readDraft(ownerA), "[]");
  for (const value of [
    '{"refresh_token":"synthetic"}',
    '{"image":"data:image/png;base64,AA"}',
    '{"image":"blob:source"}',
    "x".repeat(128001),
  ])
    await assert.rejects(f.runtime.writeDraft(ownerA, value), /nonsecret/);
  await assert.rejects(f.runtime.writeDraft("", queue));
  assert.equal(f.secrets.size, 0);
});
