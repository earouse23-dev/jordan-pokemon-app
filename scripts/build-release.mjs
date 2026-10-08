// Rebuild curated client-reset source over the accepted snapshot; never package the dirty worktree.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { heldRoutes, proRoutes, routedRoutes } from "../lib/held-routes.js";
const repo = path.resolve(import.meta.dirname, ".."),
  evidence = path.join(repo, "docs/evidence/client-reset-2026-10-03"),
  old = path.join(repo, "docs/evidence/sol-release-activation-04");
const stage = "/tmp/mica-client-reset-corrected",
  source = path.join(stage, "source");
const digest = (b) => createHash("sha256").update(b).digest("hex");
const hash = async (f) => digest(await fs.readFile(f));
const json = async (f) => JSON.parse(await fs.readFile(f, "utf8"));
const write = async (f, v) => {
  await fs.mkdir(path.dirname(f), { recursive: true });
  await fs.writeFile(
    f,
    typeof v === "string" ? v : JSON.stringify(v, null, 2) + "\n",
  );
};
async function files(root, relative = "") {
  const result = [];
  for (const n of (await fs.readdir(path.join(root, relative))).sort()) {
    const p = path.join(relative, n),
      s = await fs.lstat(path.join(root, p));
    if (s.isDirectory()) result.push(...(await files(root, p)));
    else {
      assert(s.isFile(), p);
      result.push(p);
    }
  }
  return result;
}
assert.equal(
  await hash(path.join(old, "configured-deployment.zip")),
  "d9a1ac3e908b4f01106841ff70eadd96ae219d74e64b849bbaec0cfcc5f26b09",
);
assert.equal(
  await hash(path.join(old, "configured-source.zip")),
  "44a1c4793a3820f5ee7337dc2eccd178dc98af92d967e0c8be10ecdaa212d7fb",
);
assert.equal(
  await hash(path.join(old, "configured-manifest.json")),
  "8966004f6297f2bad4089edd3644da271bf6b622d09ad68c61a5927263a8758c",
);
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(source, { recursive: true });
execFileSync("unzip", [
  "-q",
  path.join(old, "configured-deployment.zip"),
  "-d",
  stage,
]);
execFileSync("unzip", [
  "-q",
  path.join(old, "configured-source.zip"),
  "-d",
  source,
]);
const baseline = await json(path.join(old, "configured-manifest.json"));
for (const f of baseline.deployment)
  assert.equal(await hash(path.join(stage, f.path)), f.sha256, f.path);
for (const f of baseline.source)
  assert.equal(await hash(path.join(source, f.path)), f.sha256, f.path);
const changes = [
  "app.js",
  "sw.js",
  "assets/ocr/README.md",
  "lib/card-ocr.js",
  "lib/vision.js",
  "lib/capture-precision.js",
  "package-lock.json",
  "assets/ocr/eng.traineddata.gz",
  "assets/ocr/deu.traineddata.gz",
  "assets/ocr/jpn.traineddata.gz",
  "index.html",
  "themes.css",
  "lib/price-history.js",
  "lib/pricing.js",
  "lib/portfolio.js",
  "lib/supabase-data.js",
  "lib/identity.js",
  "lib/providers/pkmnprices.js",
  "lib/providers/tcgdex.js",
  "lib/pkmnprices-requests.js",
  "lib/native-cors.js",
  "lib/pkmnprices-readiness.js",
  "scripts/verify-pkmnprices.mjs",
  "scripts/build-release.mjs",
  "api/cards.js",
  "api/health.js",
  "api/capabilities.js",
  "api/vision.js",
  "api/sales.js",
  "api/offers.js",
  "api/sealed.js",
  "api/price-sync.js",
  "api/graded-valuation.js",
  "api/maintenance.js",
  "lib/held-routes.js",
  "package.json",
  "scripts/build.mjs",
  "vercel.json",
  "docs/evidence/sol-release-activation-04/public-config.json",
];
for (const f of changes) {
  await fs.mkdir(path.dirname(path.join(source, f)), { recursive: true });
  await fs.copyFile(path.join(repo, f), path.join(source, f));
}
await fs.symlink(
  path.join(repo, "node_modules"),
  path.join(source, "node_modules"),
  "dir",
);
execFileSync(process.execPath, ["scripts/build.mjs", "--release-config"], {
  cwd: source,
  stdio: "pipe",
});
const output = path.join(stage, ".vercel/output"),
  functions = path.join(output, "functions");
await fs.rm(path.join(output, "static"), { recursive: true });
await fs.cp(path.join(source, "dist"), path.join(output, "static"), {
  recursive: true,
});
for (const n of Object.keys(routedRoutes))
  await fs.rm(path.join(functions, "api", n + ".func"), { recursive: true });
const shared = path.join(functions, "_release-hold.func");
await fs.mkdir(shared);
const bundle = async (input, out) =>
  build({
    entryPoints: [input],
    outfile: out,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node24",
    minify: true,
    sourcemap: false,
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);',
    },
  });
await bundle(
  path.join(source, "lib/held-routes.js"),
  path.join(shared, "index.mjs"),
);
await write(path.join(shared, ".vc-config.json"), {
  runtime: "nodejs24.x",
  handler: "index.mjs",
  launcherType: "Nodejs",
  shouldAddHelpers: true,
  maxDuration: 60,
});
// Public configuration remains separate from the server-only Pro request gate.
for (const name of [
  "account",
  "capabilities",
  "card-image",
  "cards",
  "catalog",
  "fx",
  "health",
  "set",
])
  {
    await bundle(
      path.join(source, `api/${name}.js`),
      path.join(functions, `api/${name}.func/index.mjs`),
    );
    if (name === "cards") {
      const runtimePath = path.join(functions, `api/${name}.func/.vc-config.json`);
      const runtime = await json(runtimePath);
      runtime.maxDuration = 60;
      await write(runtimePath, runtime);
    }
  }
const config = await json(path.join(output, "config.json"));
// Prebuilt headers must follow the reviewed source, not the historical snapshot.
const sourceConfig = await json(path.join(source, "vercel.json"));
const securityRoute = config.routes.find((r) => r.headers?.["Content-Security-Policy"]);
assert(securityRoute, "Missing shipping security headers");
securityRoute.headers["Content-Security-Policy"] = sourceConfig.headers
  .flatMap((r) => r.headers)
  .find((h) => h.key === "Content-Security-Policy").value;
const start = config.routes.findIndex((r) => r.src === "^/profile/?$");
assert(start >= 0);
config.routes.splice(
  start,
  0,
  { src: "^/_release-hold(?:/.*)?$", status: 404, caseSensitive: true },
  ...Object.keys(routedRoutes).map((n) => ({
    src: `^/api/${n}$`,
    dest: "/_release-hold",
    caseSensitive: true,
    transforms: [{ type: "request.path", op: "set", args: `/api/${n}` }],
  })),
);
await write(path.join(output, "config.json"), config);
await fs.copyFile(
  path.join(repo, "vercel.json"),
  path.join(stage, "vercel.json"),
);
const deployedFunctions = (await files(functions)).filter((f) =>
  f.endsWith("/.vc-config.json"),
);
assert.equal(deployedFunctions.length, 9);
assert(deployedFunctions.length <= 12);
const deployment = await Promise.all(
  [
    ...(await files(output)).map((f) => ".vercel/output/" + f),
    ".vercel/project.json",
    "vercel.json",
  ]
    .sort()
    .map(async (p) => ({
      path: p,
      sha256: await hash(path.join(stage, p)),
      bytes: (await fs.stat(path.join(stage, p))).size,
    })),
);
const sourcePaths = [
  ...new Set([...baseline.source.map((f) => f.path), ...changes]),
].sort();
const sources = await Promise.all(
  sourcePaths.map(async (p) => ({
    path: p,
    sha256: await hash(path.join(source, p)),
    activation04Sha256:
      baseline.source.find((f) => f.path === p)?.sha256 || null,
  })),
);
const delta = {
  removed: baseline.deployment
    .filter((f) => !deployment.some((n) => n.path === f.path))
    .map((f) => f.path),
  added: deployment
    .filter((f) => !baseline.deployment.some((n) => n.path === f.path))
    .map((f) => f.path),
  changed: deployment
    .filter((f) =>
      baseline.deployment.some(
        (n) => n.path === f.path && n.sha256 !== f.sha256,
      ),
    )
    .map((f) => f.path),
};
// Every static byte must come from the just-built, explicit source overlay.
const builtStatic = await files(path.join(source, "dist"));
assert.equal(
  deployment.filter((f) => f.path.startsWith(".vercel/output/static/")).length,
  builtStatic.length,
);
for (const f of builtStatic)
  assert.equal(
    await hash(path.join(output, "static", f)),
    await hash(path.join(source, "dist", f)),
    f,
  );
const webConfig = JSON.parse(
  (await fs.readFile(path.join(output, "static/app-config.js"), "utf8"))
    .match(/^globalThis\.__APP_CONFIG__=Object\.freeze\((\{.*\})\);\s*$/)[1],
);
assert.deepEqual(Object.keys(webConfig).sort(), ["apiOrigin", "authReturnOrigin", "supabasePublishableKey", "supabaseUrl"]);
assert.equal(webConfig.authReturnOrigin, "https://jordan-pokemon-app.vercel.app");
assert.equal(webConfig.supabaseUrl, baseline.configuration.supabaseUrl);
assert.equal(webConfig.apiOrigin, baseline.configuration.apiOrigin);
assert.equal(digest(webConfig.supabasePublishableKey), baseline.configuration.publishableKeySha256);
const manifest = {
  activation04ManifestSha256: await hash(
    path.join(old, "configured-manifest.json"),
  ),
  buildScriptSha256: await hash(import.meta.filename),
  node: process.version,
  dependencies: baseline.dependencies,
  publicConfigSha256: baseline.publicConfigSha256,
  configuration: { ...baseline.configuration, authReturnOrigin: webConfig.authReturnOrigin },
  configuredPublicAssetSha256: await hash(path.join(output, "static/app-config.js")),
  functionCount: 9,
  observedFunctionLimit: 12,
  heldRoutes,
  proRoutes,
  crons: config.crons,
  source: sources,
  deployment,
  delta,
  outputTreeSha256: digest(
    JSON.stringify(
      deployment.filter((f) => f.path.startsWith(".vercel/output/")),
    ),
  ),
};
await write(path.join(evidence, "corrected-manifest.json"), manifest);
for (const [name, root, entries] of [
  ["corrected-deployment.zip", stage, deployment.map((f) => f.path)],
  ["corrected-source.zip", source, sourcePaths],
]) {
  const target = path.join(evidence, name);
  await fs.rm(target, { force: true });
  execFileSync("touch", ["-t", "202610020000", ...entries], { cwd: root });
  execFileSync("zip", ["-X", "-q", target, ...entries], { cwd: root });
}
console.log(
  JSON.stringify({
    stage,
    functions: 9,
    deployEntries: deployment.length,
    sourceEntries: sources.length,
    deploymentZipSha256: await hash(
      path.join(evidence, "corrected-deployment.zip"),
    ),
    sourceZipSha256: await hash(path.join(evidence, "corrected-source.zip")),
    manifestSha256: await hash(path.join(evidence, "corrected-manifest.json")),
  }),
);
