import test from "node:test";
import assert from "node:assert/strict";
import { portfolioService } from "../lib/portfolio-service.js";
const owner = "11111111-1111-4111-8111-111111111111";
const response = () => ({
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(n) {
    this.statusCode = n;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
test("saved views are owner scoped, refresh failures preserve the published view, and cron rejects browser tokens", async (t) => {
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: "https://portfolio-fixture.supabase.co",
    SUPABASE_SECRET_KEY: "fixture-service",
    CRON_SECRET: "fixture-cron",
  })) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    });
  }
  const saved = {
    version: 1,
    complete: true,
    updatedAt: "2026-01-01T00:00:00Z",
    summaries: [
      {
        currency: "USD",
        total: 400,
        history: [{ date: "2026-01-01", total: 400 }],
      },
    ],
  };
  let stored = structuredClone(saved),
    paid = 0, readFailure = true;
  t.mock.method(globalThis, "fetch", async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url || input);
    if (url.hostname !== "portfolio-fixture.supabase.co") {
      paid++;
      throw Error("Unexpected provider request");
    }
    if (url.pathname.endsWith("/auth/v1/user"))
      return Response.json({ id: owner });
    if (url.pathname.endsWith("/rpc/claim_portfolio_refresh"))
      return Response.json(true);
    if (url.pathname.endsWith("/portfolio_views")) {
      assert.equal(url.searchParams.get("user_id"), "eq." + owner);
      if (init.method === "PATCH") {
        const patch = JSON.parse(init.body);
        if (patch.view) stored = patch.view;
        return new Response(null, { status: 204 });
      }
      return Response.json({ view: stored });
    }
    if (url.pathname.endsWith("/collection_items") && !readFailure) return Response.json([]);
    if (url.pathname.endsWith("/collection_items"))
      return Response.json(
        { message: "Fixture read failure", code: "fixture_failure" },
        { status: 503 },
      );
    throw Error("Unexpected database path " + url.pathname);
  });
  let res = response();
  await portfolioService(
    {
      method: "GET",
      headers: { authorization: "Bearer fixture-user" },
      query: { surface: "portfolio", user_id: "other" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.view, saved);
  res = response();
  await portfolioService(
    {
      method: "POST",
      headers: { authorization: "Bearer fixture-user" },
      query: { surface: "portfolio" },
    },
    res,
  );
  assert.equal(res.statusCode, 503);
  assert.deepEqual(stored, saved);
  assert.equal(paid, 0);
  readFailure = false;
  res = response();
  await portfolioService({method:"POST",headers:{authorization:"Bearer fixture-user"},query:{surface:"portfolio"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(stored.summaries[0].total,0);
  assert.equal(stored.complete,true);
  assert.equal(stored.inventoryKey,"[]");
  assert.equal(paid,0);
  for (const request of [
    { method: "POST", headers: {}, query: { surface: "portfolio" } },
    {
      method: "GET",
      headers: { authorization: "Bearer fixture-user" },
      query: { surface: "portfolio-sync" },
    },
  ]) {
    res = response();
    await portfolioService(request, res);
    assert.equal(res.statusCode, 401);
  }
});
