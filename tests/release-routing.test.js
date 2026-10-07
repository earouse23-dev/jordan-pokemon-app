import test from "node:test";
import assert from "node:assert/strict";
import sharedHold, { heldRoutes, proRoutes } from "../lib/held-routes.js";
import shippingCards from "../api/cards.js";
import { pkmnPricesRequests, requestCreditBound } from "../lib/pkmnprices-requests.js";
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
test("shipping cards retain public fallback when Pro is absent and never enable another paid adapter", async () => {
  const env = { ...process.env },
    fetch = globalThis.fetch;
  const calls = [];
  Object.assign(process.env, {
    JUSTTCG_API_KEY: "synthetic-paid",
    JUSTTCG_COMMERCIAL_LICENSE_APPROVED: "true",
  });
  delete process.env.PKMNPRICES_API_KEY;
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

test('shipping Pro routes and shared dispatch require authentication, enforce methods and CORS before outbound', async () => {
  const env={...process.env}, fetch=globalThis.fetch;let outbound=0;
  Object.assign(process.env,{PKMNPRICES_API_KEY:'synthetic-pro',PKMNPRICES_PLAN:'pro',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SECRET_KEY:'synthetic-server'});
  globalThis.fetch=async()=>{outbound++;throw Error('Unexpected outbound');};
  const lookup=JSON.stringify({clientId:'route-fixture',pkmnpricesId:'10195',language:'en',grader:'PSA',grade:'9',variant:'Holofoil'});
  try {
    assert.deepEqual(Object.keys(proRoutes).sort(),['graded-valuation','offers','sales','sealed']);
    for(const [name,methods] of Object.entries(proRoutes)){
      const shipping=(await import(`../api/${name}.js`)).default;
      const suffix=name==='sealed'?'?id=33':`?lookup=${encodeURIComponent(lookup)}`;
      for(const handler of [shipping,sharedHold]){
        const request={url:`/api/${name}${suffix}`,query:name==='sealed'?{id:'33'}:{lookup},headers:{host:'jordan-pokemon-app.vercel.app',origin:'capacitor://localhost'},body:{positionId:'11111111-1111-4111-8111-111111111111'}};
        const anonymous=response();await handler({...request,method:methods[0]},anonymous);
        assert.equal(anonymous.statusCode,401,name);assert.notEqual(anonymous.body.code,'release_hold');assert.match(anonymous.headers['Cache-Control'],/no-store/);
        for(const method of ['GET','POST','PUT','PATCH','DELETE','HEAD'].filter(m=>!methods.includes(m))){const r=response();await handler({...request,method},r);assert.equal(r.statusCode,405,name);assert.equal(r.headers.Allow,methods.join(', '));}
        for(const method of ['GET','POST','DELETE']){const r=response();await handler({...request,method:'OPTIONS',headers:{origin:'capacitor://localhost','access-control-request-method':method,'access-control-request-headers':'Authorization, Content-Type'}},r);assert.equal(r.statusCode,methods.includes(method)?204:403,name);}
        const hostile=response();await handler({...request,method:methods[0],headers:{origin:'https://hostile.example',host:'jordan-pokemon-app.vercel.app'}},hostile);assert.equal(hostile.statusCode,403);
        const privileged=response();await handler({...request,method:'OPTIONS',headers:{origin:'capacitor://localhost','access-control-request-method':methods[0],'access-control-request-headers':'X-Privileged'}},privileged);assert.equal(privileged.statusCode,403);
      }
    }
    const cards=response();await shippingCards({method:'GET',query:{lookups:JSON.stringify([{clientId:'anonymous',pkmnpricesId:'10195'}])},headers:{},socket:{remoteAddress:'anonymous-pro'}},cards);assert.equal(cards.statusCode,401);
    assert.equal(outbound,0);
  } finally {process.env=env;globalThis.fetch=fetch;}
});

test('shipping known-card Pro lookup uses one bounded detail, returns EUR and USD, and caches repeat without other providers', async t => {
  const env={...process.env},fetch=globalThis.fetch;const calls=[],claims=[];
  Object.assign(process.env,{PKMNPRICES_API_KEY:'synthetic-pro',PKMNPRICES_PLAN:'pro',JUSTTCG_API_KEY:'synthetic-other-paid',JUSTTCG_COMMERCIAL_LICENSE_APPROVED:'true'});
  t.mock.method(pkmnPricesRequests,'authenticate',async request=>request.headers.authorization==='Bearer fixture-owner');
  t.mock.method(pkmnPricesRequests,'claim',async url=>claims.push(requestCreditBound(url)));
  pkmnPricesRequests.cache.clear();pkmnPricesRequests.pending.clear();
  globalThis.fetch=async input=>{const url=String(input);calls.push(url);assert.equal(url,'https://api.pkmnprices.com/v1/cards/10195');return new Response(JSON.stringify({id:10195,name:'Pikachu',number:'006',total_set_number:'015',set:{name:"McDonald's Promos 2023"},prices:[{source:'tcgplayer',currency:'USD',condition:'Near Mint',variant:'Holofoil',market_price:10,updated_at:'2026-10-05T12:00:00Z'},{source:'cardmarket',currency:'EUR',condition:'Near Mint',variant:'Holofoil',market_price:9,updated_at:'2026-10-05T12:00:00Z'}]}));};
  try {
    for(let i=0;i<2;i++){
      const r=response();await shippingCards({method:'GET',query:{lookups:JSON.stringify([{clientId:'one-confirmed-card',pkmnpricesId:'10195',language:'en'}])},headers:{authorization:'Bearer fixture-owner'},socket:{remoteAddress:'confirmed-pro'}},r);
      assert.equal(r.statusCode,200);assert.deepEqual(r.body.providers,['pkmnprices']);assert(!JSON.stringify(r.body).includes('synthetic-pro'));assert.match(JSON.stringify(r.body),/EUR/);assert.match(JSON.stringify(r.body),/USD/);
    }
    assert.equal(calls.length,1);assert.deepEqual(claims,[1]);
  } finally {process.env=env;globalThis.fetch=fetch;pkmnPricesRequests.cache.clear();pkmnPricesRequests.pending.clear();}
});
