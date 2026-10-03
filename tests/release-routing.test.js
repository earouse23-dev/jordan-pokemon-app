import test from "node:test";
import assert from "node:assert/strict";
import sharedHold, { heldRoutes } from "../lib/held-routes.js";
import shippingCards from "../api/cards.js";
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
  end() {
    return this;
  },
});
test("shipping and shared holds preserve every route method/CORS boundary with zero outbound calls", async () => {
  const env = { ...process.env },
    fetch = globalThis.fetch;
  let outbound = 0;
  Object.assign(process.env, {
    PKMNPRICES_API_KEY: "synthetic-paid",
    JUSTTCG_API_KEY: "synthetic-paid",
    JUSTTCG_COMMERCIAL_LICENSE_APPROVED: "true",
    AI_GATEWAY_API_KEY: "synthetic-paid",
    VERCEL_OIDC_TOKEN: "synthetic-oidc",
    RESEND_API_KEY: "synthetic-paid",
    CRON_SECRET: "synthetic-cron",
  });
  globalThis.fetch = async () => {
    outbound++;
    throw Error("Unexpected outbound");
  };
  try {
    for (const [name, methods] of Object.entries(heldRoutes)) {
      const { default: shipping } = await import(`../api/${name}.js`);
      for (const handler of [shipping, sharedHold]) {
        for (const method of [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "HEAD",
        ]) {
          const r = response();
          await handler(
            {
              url: `/api/${name}?route=price-sync`,
              query: { route: "price-sync" },
              method,
              headers: {
                host: "jordan-pokemon-app.vercel.app",
                origin: "capacitor://localhost",
              },
            },
            r,
          );
          assert.equal(r.statusCode, 503, name);
          assert.equal(r.body.code, "release_hold");
          assert.equal(r.headers["Cache-Control"], "private, no-store");
          assert.equal(
            r.headers["Access-Control-Allow-Origin"],
            "capacitor://localhost",
          );
        }
        for (const method of ["GET", "POST", "DELETE"]) {
          const r = response();
          await handler(
            {
              url: `/api/${name}`,
              method: "OPTIONS",
              headers: {
                origin: "capacitor://localhost",
                "access-control-request-method": method,
                "access-control-request-headers": "Authorization, Content-Type",
              },
            },
            r,
          );
          assert.equal(
            r.statusCode,
            methods.includes(method) ? 204 : 403,
            name,
          );
          if (r.statusCode === 204)
            assert.equal(
              r.headers["Access-Control-Allow-Methods"],
              methods.join(", "),
            );
        }
        for (const origin of [
          "https://hostile.example",
          "https://jordan-pokemon-app.vercel.app.evil.example",
        ]) {
          const r = response();
          await handler(
            {
              url: `/api/${name}`,
              method: "GET",
              headers: { origin, host: "jordan-pokemon-app.vercel.app" },
            },
            r,
          );
          assert.equal(r.statusCode, 403);
          assert.equal(r.headers["Access-Control-Allow-Origin"], undefined);
        }
        const badHeader = response();
        await handler(
          {
            url: `/api/${name}`,
            method: "OPTIONS",
            headers: {
              origin: "capacitor://localhost",
              "access-control-request-method": methods[0],
              "access-control-request-headers": "X-Privileged",
            },
          },
          badHeader,
        );
        assert.equal(badHeader.statusCode, 403);
      }
    }
    assert.equal(outbound, 0);
  } finally {
    process.env = env;
    globalThis.fetch = fetch;
  }
});
test("unknown paths and forged query/header route selectors never become held endpoints", async () => {
  for (const url of [
    "/api/unknown",
    "/_release-hold",
    "/api/vision/extra",
    "/api/Vision",
    "/api/vision/",
    "/api/%76ision",
  ]) {
    const r = response();
    await sharedHold(
      {
        url,
        method: "GET",
        query: { route: "vision" },
        headers: { "x-mica-held-route": "vision" },
      },
      r,
    );
    assert.equal(r.statusCode, 404, url);
    assert.notEqual(r.body.code, "release_hold");
  }
});
test("shipping cards ignore paid credentials and only use the public TCGdex tier", async () => {
  const env = { ...process.env },
    fetch = globalThis.fetch;
  const calls = [];
  Object.assign(process.env, {
    PKMNPRICES_API_KEY: "synthetic-paid",
    JUSTTCG_API_KEY: "synthetic-paid",
    JUSTTCG_COMMERCIAL_LICENSE_APPROVED: "true",
  });
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    assert(url.startsWith("https://api.tcgdex.net/"));
    return new Response(
      JSON.stringify({
        id: "base1-4",
        localId: "4",
        name: "Charizard",
        set: { name: "Base" },
        pricing: {},
      }),
    );
  };
  try {
    const r = response();
    await shippingCards(
      {
        method: "GET",
        query: {
          lookups: JSON.stringify([
            { clientId: "synthetic-public", tcgdexId: "base1-4" },
          ]),
        },
        headers: {},
        socket: { remoteAddress: "shipping-public-check" },
      },
      r,
    );
    assert.equal(r.statusCode, 200);
    assert.deepEqual(r.body.providers, ["tcgdex"]);
    assert(calls.length > 0);
    assert(!JSON.stringify(r.body).includes("synthetic-paid"));
  } finally {
    process.env = env;
    globalThis.fetch = fetch;
  }
});
