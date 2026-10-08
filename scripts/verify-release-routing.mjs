// Focused offline check of actual Build Output routing, function count and held bundle.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { heldRoutes, proRoutes } from "../lib/held-routes.js";
const stage = process.argv[2] || "/tmp/mica-client-reset-corrected";
const manifest = JSON.parse(
  await fs.readFile(
    process.argv[3] || new URL(
      "../docs/evidence/client-reset-2026-10-03/corrected-manifest.json",
      import.meta.url,
    ),
  ),
);
for (const f of manifest.deployment)
  assert.equal(
    createHash("sha256")
      .update(await fs.readFile(path.join(stage, f.path)))
      .digest("hex"),
    f.sha256,
    f.path,
  );
const config = JSON.parse(
  await fs.readFile(path.join(stage, ".vercel/output/config.json")),
);
const functionRoot = path.join(stage, ".vercel/output/functions");
const names = [];
async function walk(d) {
  for (const e of await fs.readdir(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.name.endsWith(".func")) {
      assert(e.isDirectory());
      names.push(path.relative(functionRoot, p));
    } else if (e.isDirectory()) await walk(p);
  }
}
await walk(functionRoot);
assert.equal(names.length, 9);
assert(names.length <= 12);
assert.deepEqual(
  names.sort(),
  [
    "_release-hold.func",
    ...[
      "account",
      "capabilities",
      "card-image",
      "cards",
      "catalog",
      "fx",
      "health",
      "set",
    ].map((n) => "api/" + n + ".func"),
  ].sort(),
);
assert.deepEqual(config.crons, [
  {
    path: "/api/capabilities?surface=grading-deletion",
    schedule: "15 5 * * *",
  },
]);
const resolve = (url) =>
  config.routes.find((r) => r.src && r.dest && new RegExp(r.src).test(url));
const handler = (
  await import(
    pathToFileURL(path.join(functionRoot, "_release-hold.func/index.mjs"))
  )
).default;
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
let outbound = 0;
globalThis.fetch = async () => {
  outbound++;
  throw Error("Outbound call forbidden");
};
for (const [name, methods] of Object.entries(heldRoutes)) {
  const url = "/api/" + name,
    r = resolve(url);
  assert.equal(r.dest, "/_release-hold");
  assert.equal(r.caseSensitive, true);
  assert.deepEqual(r.transforms, [
    { type: "request.path", op: "set", args: url },
  ]);
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    const result = response();
    await handler(
      { url: r.transforms[0].args, method, headers: {}, query: {} },
      result,
    );
    assert.equal(result.statusCode, 503);
    assert.equal(result.body.code, "release_hold");
    assert.equal(result.headers["Cache-Control"], "private, no-store");
  }
  for (const method of ["GET", "POST", "DELETE"]) {
    const result = response();
    await handler(
      {
        url,
        method: "OPTIONS",
        headers: {
          origin: "capacitor://localhost",
          "access-control-request-method": method,
        },
      },
      result,
    );
    assert.equal(result.statusCode, methods.includes(method) ? 204 : 403, name);
  }
  const denied = response();
  await handler(
    { url, method: "GET", headers: { origin: "https://hostile.example" } },
    denied,
  );
  assert.equal(denied.statusCode, 403);
}
// Real packaged exports must reach authentication, never an unconditional hold.
process.env.PKMNPRICES_API_KEY = "synthetic-pro-routing-check";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://routing-check.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-routing-key";
const lookup = JSON.stringify({ clientId: "routing-check", pkmnpricesId: "10195", language: "en", grader: "PSA", grade: "9", variant: "Holofoil" });
for (const [name, methods] of Object.entries(proRoutes)) {
  const url = "/api/" + name, r = resolve(url);
  assert.equal(r.dest, "/_release-hold");
  assert.equal(r.caseSensitive, true);
  assert.deepEqual(r.transforms, [{ type: "request.path", op: "set", args: url }]);
  const request = { url: url + (name === "sealed" ? "?id=33" : "?lookup=" + encodeURIComponent(lookup)), query: name === "sealed" ? { id: "33" } : { lookup }, headers: {}, body: name === "vision" ? { mode: "identify", images: ["data:image/jpeg;base64,AA=="] } : {} };
  const anonymous = response();
  await handler({ ...request, method: methods[0] }, anonymous);
  assert.equal(anonymous.statusCode, 401, name);
  assert.notEqual(anonymous.body.code, "release_hold");
  assert.match(anonymous.headers["Cache-Control"], /no-store/);
  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"].filter(m => !methods.includes(m))) {
    const result = response();
    await handler({ ...request, method }, result);
    assert.equal(result.statusCode, 405, name);
  }
  for (const method of ["GET", "POST", "DELETE"]) {
    const result = response();
    await handler({ ...request, method: "OPTIONS", headers: { origin: "capacitor://localhost", "access-control-request-method": method, "access-control-request-headers": "Authorization, Content-Type" } }, result);
    assert.equal(result.statusCode, methods.includes(method) ? 204 : 403, name);
  }
  const hostile = response();
  await handler({ ...request, method: methods[0], headers: { origin: "https://hostile.example" } }, hostile);
  assert.equal(hostile.statusCode, 403, name);
}
for (const url of [
  "/api/no-such-endpoint",
  "/api/vision/extra",
  "/api/Vision",
  "/_release-hold",
]) {
  assert.equal(resolve(url), undefined, url);
  const result = response();
  await handler({ url, method: "GET", headers: {} }, result);
  assert.equal(result.statusCode, 404);
}
assert(
  config.routes.some(
    (r) => r.src === "^/_release-hold(?:/.*)?$" && r.status === 404,
  ),
);
assert.equal(outbound, 0);
console.log(
  JSON.stringify({
    artifactEntries: manifest.deployment.length,
    functionCount: names.length,
    limit: 12,
    exactHeldRoutes: Object.keys(heldRoutes).length,
    ordinaryMethods: Object.keys(heldRoutes).length * 5,
    preflightMethods: Object.keys(heldRoutes).length * 3,
    hostileOrigins: Object.keys(heldRoutes).length,
    activeProRoutes: Object.keys(proRoutes).length,
    proAuthenticationChecks: Object.keys(proRoutes).length,
    proPreflightChecks: Object.keys(proRoutes).length * 3,
    unknownPaths: 4,
    realOutboundCalls: 0,
    independentDeletion: true,
  }),
);
