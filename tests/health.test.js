import test from "node:test";
import assert from "node:assert/strict";
import healthHandler from "../api/health.js";

function responseRecorder() {
  const result = { statusCode: null, body: null, headers: {} };
  return {
    result,
    setHeader(name, value) {
      result.headers[name] = value;
    },
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
  };
}

test("health endpoint verifies core auth without exposing configuration secrets", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    fetch: globalThis.fetch,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "private-test-value";
  globalThis.fetch = async () => ({ ok: true });
  const response = responseRecorder();
  try {
    await healthHandler({ method: "GET" }, response);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previous.key;
  }
  assert.equal(response.result.statusCode, 200);
  assert.equal(response.result.body.status, "healthy");
  assert.equal(response.result.body.services.database, "healthy");
  assert.equal(response.result.body.services.auth, "healthy");
  assert.equal(response.result.body.services.appSchema, "healthy");
  assert.doesNotMatch(
    JSON.stringify(response.result.body),
    /private-test-value/,
  );
});

test("health endpoint fails closed when the core database is unavailable", async () => {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    fetch: globalThis.fetch,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  globalThis.fetch = async (url) => ({
    ok: !String(url).includes("supabase.co"),
  });
  const response = responseRecorder();
  try {
    await healthHandler({ method: "GET" }, response);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.key === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previous.key;
  }
  assert.equal(response.result.statusCode, 503);
  assert.equal(response.result.body.status, "degraded");
});

test("prebuilt release reports its supplied source commit", async () => {
  const previous = {
    fetch: globalThis.fetch,
    commit: process.env.MICA_RELEASE_COMMIT,
    vercel: process.env.VERCEL_GIT_COMMIT_SHA,
  };
  globalThis.fetch = async () => ({ ok: true });
  process.env.MICA_RELEASE_COMMIT = "a".repeat(40);
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    const response = responseRecorder();
    await healthHandler({ method: "GET" }, response);
    assert.equal(response.result.body.release, "a".repeat(12));
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of [
      ["MICA_RELEASE_COMMIT", previous.commit],
      ["VERCEL_GIT_COMMIT_SHA", previous.vercel],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
