import test from "node:test";
import assert from "node:assert/strict";

const xml = `<?xml version="1.0" encoding="UTF-8"?><gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref"><gesmes:subject>Reference rates</gesmes:subject><gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender><Cube><Cube time='2026-09-24'><Cube currency='USD' rate='1.25'/></Cube></Cube></gesmes:Envelope>`;
const NOW = Date.parse("2026-09-24T17:00:00Z");
let sequence = 0;

function mockResponse() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function withRoute(stub, callback) {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  globalThis.fetch = stub;
  Date.now = () => NOW;
  try {
    const { default: handler } = await import(
      `../api/fx.js?test=${++sequence}`
    );
    await callback(handler);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
}

test("fixed URL, hash/provenance, public success cache and no parameters", async () => {
  let calls = 0;
  await withRoute(
    async (url, options) => {
      calls += 1;
      assert.equal(
        url,
        "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
      );
      assert.equal(options.redirect, "manual");
      return new Response(xml, { headers: { "content-type": "text/xml" } });
    },
    async (handler) => {
      const first = mockResponse();
      await handler({ method: "GET", url: "/api/fx" }, first);
      assert.equal(first.code, 200);
      assert.equal(first.headers.get("cache-control"), "public, s-maxage=3600");
      assert.equal(first.body.rate, 1.25);
      assert.equal(first.body.effectiveDate, "2026-09-24");
      assert.equal(first.body.fetchedAt, "2026-09-24T17:00:00.000Z");
      assert.match(
        first.body.rateRef,
        /^ecb-eurofxref-daily:2026-09-24:[a-f0-9]{64}$/,
      );
      const second = mockResponse();
      await handler({ method: "GET", url: "/api/fx" }, second);
      assert.deepEqual(second.body, first.body);
      assert.equal(calls, 1);
      const wrongMethod = mockResponse();
      await handler({ method: "POST", url: "/api/fx" }, wrongMethod);
      assert.equal(wrongMethod.code, 405);
      const bad = mockResponse();
      await handler(
        { method: "GET", url: "/api/fx?url=https://evil.example" },
        bad,
      );
      assert.equal(bad.code, 400);
      assert.equal(calls, 1);
    },
  );
});

test("cache expiry fetches a new record without extending the old fetchedAt", async () => {
  let calls = 0;
  await withRoute(
    async () => {
      calls += 1;
      return new Response(xml.replace("1.25", calls === 1 ? "1.25" : "1.30"), {
        headers: { "content-type": "application/xml" },
      });
    },
    async (handler) => {
      const first = mockResponse();
      await handler({ method: "GET", url: "/api/fx" }, first);
      const originalNow = Date.now;
      Date.now = () => NOW + 1_800_000;
      const halfway = mockResponse();
      await handler({ method: "GET", url: "/api/fx" }, halfway);
      assert.equal(
        halfway.headers.get("cache-control"),
        "public, s-maxage=1800",
      );
      assert.equal(halfway.body.fetchedAt, first.body.fetchedAt);
      Date.now = () => NOW + 3_600_001;
      try {
        const second = mockResponse();
        await handler({ method: "GET", url: "/api/fx" }, second);
        assert.equal(second.code, 200);
        assert.equal(second.body.rate, 1.3);
        assert.notEqual(second.body.rateRef, first.body.rateRef);
        assert.equal(calls, 2);
      } finally {
        Date.now = originalNow;
      }
    },
  );
});

test("redirect, wrong type, oversized body, malformed rate and transport errors fail closed", async () => {
  for (const upstream of [
    new Response("", {
      status: 302,
      headers: { location: "https://evil.example" },
    }),
    new Response(xml, { headers: { "content-type": "text/html" } }),
    new Response("x".repeat(16_385), {
      headers: { "content-type": "text/xml" },
    }),
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(16_385));
          controller.close();
        },
      }),
      { headers: { "content-type": "text/xml" } },
    ),
    new Response(xml.replace("1.25", "0"), {
      headers: { "content-type": "text/xml" },
    }),
    new Error("timeout"),
  ]) {
    await withRoute(
      async () => {
        if (upstream instanceof Error) throw upstream;
        return upstream;
      },
      async (handler) => {
        const result = mockResponse();
        await handler({ method: "GET", url: "/api/fx" }, result);
        assert.equal(result.code, 502);
        assert.equal(result.headers.get("cache-control"), "no-store");
        assert.equal(result.body.rate, undefined);
      },
    );
  }
});

test("aged ECB quote is unavailable while its validated record remains retained", async () => {
  let calls = 0;
  await withRoute(
    async () => {
      calls += 1;
      return new Response(xml, { headers: { "content-type": "text/xml" } });
    },
    async (handler) => {
      const first = mockResponse();
      await handler({ method: "GET", url: "/api/fx" }, first);
      assert.equal(first.code, 200);
      const originalNow = Date.now;
      Date.now = () => Date.parse("2026-09-30T00:00:00Z");
      try {
        const stale = mockResponse();
        await handler({ method: "GET", url: "/api/fx" }, stale);
        assert.equal(stale.code, 503);
        assert.equal(stale.body.code, "rate_stale");
        assert.equal(stale.headers.get("cache-control"), "no-store");
        assert.equal(calls, 2);
      } finally {
        Date.now = originalNow;
      }
    },
  );
});

test("success cache cannot carry an age-four quote past UTC midnight", async () => {
  let calls = 0;
  await withRoute(
    async () => {
      calls += 1;
      return new Response(xml, { headers: { "content-type": "text/xml" } });
    },
    async (handler) => {
      const originalNow = Date.now;
      Date.now = () => Date.parse("2026-09-28T23:59:59Z");
      try {
        const fresh = mockResponse();
        await handler({ method: "GET", url: "/api/fx" }, fresh);
        assert.equal(fresh.code, 200);
        assert.equal(fresh.headers.get("cache-control"), "public, s-maxage=1");
        Date.now = () => Date.parse("2026-09-29T00:00:01Z");
        const stale = mockResponse();
        await handler({ method: "GET", url: "/api/fx" }, stale);
        assert.equal(stale.code, 503);
        assert.equal(stale.headers.get("cache-control"), "no-store");
        assert.equal(calls, 2);
      } finally {
        Date.now = originalNow;
      }
    },
  );
});
