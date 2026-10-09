import test from "node:test";
import assert from "node:assert/strict";
import { withNativeCors } from "../lib/native-cors.js";

const routes = {
  account: ["DELETE"],
  capabilities: ["GET", "POST"],
  "card-image": ["GET"],
  cards: ["GET"],
  catalog: ["GET"],
  fx: ["GET"],
  "graded-valuation": ["POST"],
  offers: ["GET"],
  "price-sync": ["GET", "POST"],
  sales: ["GET"],
  sealed: ["GET"],
  set: ["GET"],
  vision: ["POST"],
};

function invoke(handler, method, headers = {}) {
  const result = { status: null, headers: {} };
  const response = {
    setHeader(key, value) {
      result.headers[key.toLowerCase()] = value;
    },
    status(value) {
      result.status = value;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    },
    end() {
      result.ended = true;
      return this;
    },
  };
  return Promise.resolve(handler({ method, headers }, response)).then(
    () => result,
  );
}

test("every native-used route answers exact-origin OPTIONS without entering its handler", async () => {
  for (const [name, methods] of Object.entries(routes)) {
    const { default: handler } = await import(`../api/${name}.js`);
    for (const method of methods) {
      const result = await invoke(handler, "OPTIONS", {
        origin: "capacitor://localhost",
        "access-control-request-method": method,
        "access-control-request-headers": "Authorization, Content-Type",
      });
      assert.equal(result.status, 204, name);
      assert.equal(result.ended, true, name);
      assert.equal(
        result.headers["access-control-allow-origin"],
        "capacitor://localhost",
        name,
      );
      assert.equal(
        result.headers["access-control-allow-methods"],
        methods.join(", "),
        name,
      );
      assert.equal(
        result.headers["access-control-allow-credentials"],
        undefined,
        name,
      );
    }
  }
});

test("unknown origins, methods and headers fail before paid or data handlers", async () => {
  let calls = 0;
  const handler = withNativeCors(() => calls++, ["POST"]);
  for (const headers of [
    { origin: "https://evil.invalid", "access-control-request-method": "POST" },
    { origin: "capacitor://localhost", "access-control-request-method": "GET" },
    {
      origin: "capacitor://localhost",
      "access-control-request-method": "POST",
      "access-control-request-headers": "X-Secret",
    },
  ]) {
    const result = await invoke(handler, "OPTIONS", headers);
    assert.equal(result.status, 403);
  }
  assert.equal(calls, 0);
});

test("approved native requests retain route auth; same-origin web requests remain unchanged", async () => {
  let calls = 0;
  const handler = withNativeCors(
    (request, response) => {
      calls++;
      return response
        .status(request.headers.authorization ? 200 : 401)
        .json({});
    },
    ["POST"],
  );
  const native = await invoke(handler, "POST", {
    origin: "capacitor://localhost",
  });
  assert.equal(native.status, 401);
  assert.equal(
    native.headers["access-control-allow-origin"],
    "capacitor://localhost",
  );
  const web = await invoke(handler, "POST", {
    host: "mica.example.invalid",
    origin: "https://mica.example.invalid",
    authorization: "Bearer synthetic",
  });
  assert.equal(web.status, 200);
  assert.equal(web.headers["access-control-allow-origin"], undefined);
  const denied = await invoke(handler, "POST", {
    origin: "https://evil.invalid",
  });
  assert.equal(denied.status, 403);
  const downgraded = await invoke(handler, "POST", {
    host: "mica.example.invalid",
    origin: "http://mica.example.invalid",
  });
  assert.equal(downgraded.status, 403);
  assert.equal(calls, 2);
});

test("absent and denied Origin responses vary by Origin before cache reuse", async () => {
  let calls = 0;
  const handler = withNativeCors(
    (_request, response) => {
      calls++;
      response.setHeader("Cache-Control", "s-maxage=60");
      return response.status(200).json({});
    },
    ["GET"],
  );
  const absent = await invoke(handler, "GET");
  assert.match(absent.headers.vary || "", /(?:^|,\s*)Origin(?:,|$)/i);
  const denied = await invoke(handler, "GET", {
    origin: "https://evil.invalid",
  });
  assert.match(denied.headers.vary || "", /(?:^|,\s*)Origin(?:,|$)/i);
  // A shared cache must miss when the next request changes Origin.
  const cachedForNative = !/\borigin\b/i.test(absent.headers.vary || "");
  const native = cachedForNative
    ? absent
    : await invoke(handler, "GET", { origin: "capacitor://localhost" });
  assert.equal(
    native.headers["access-control-allow-origin"],
    "capacitor://localhost",
  );
  assert.equal(calls, 2);
});

test("vision downstream Authorization variation retains Origin for every request", async () => {
  const { visionHandler } = await import("../api/vision.js");
  const handler = withNativeCors(visionHandler, ["POST"]);
  for (const headers of [
    {},
    { origin: "capacitor://localhost" },
    { host: "mica.example.invalid", origin: "https://mica.example.invalid" },
  ]) {
    const result = await invoke(handler, "GET", headers);
    assert.equal(result.status, 405);
    assert.match(result.headers.vary || "", /\bOrigin\b/i);
    assert.match(result.headers.vary || "", /\bAuthorization\b/i);
  }
});
