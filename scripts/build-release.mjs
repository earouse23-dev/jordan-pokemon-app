// Build only the explicit release source list. No private ZIP or workstation snapshot is required.
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
const baseline = await json(path.join(old, "configured-manifest.json"));
await fs.rm(stage, { recursive: true, force: true });
await fs.mkdir(source, { recursive: true });
// A local prebuilt deployment must keep its existing project link. Otherwise
// the CLI can create a new project named after this temporary directory.
try {
  const project = await json(path.join(repo, ".vercel/project.json"));
  assert.match(project.projectId, /^prj_[A-Za-z0-9]+$/);
  assert.match(project.orgId, /^team_[A-Za-z0-9]+$/);
  await write(path.join(stage, ".vercel/project.json"), {
    projectId: project.projectId, orgId: project.orgId,
    ...(project.projectName ? { projectName: project.projectName } : {}),
  });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const changes = [
  "app.js",
  "sw.js",
  "styles.css",
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
  "lib/image-source.js",
  "lib/pricing.js",
  "lib/portfolio.js",
  "lib/portfolio-view.js",
  "lib/portfolio-service.js",
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
  "docs/evidence/sol-release-activation-04/configured-manifest.json",
];
const sourcePaths = [...new Set([...baseline.source.map(f => f.path), ...changes])].sort();
for (const f of sourcePaths) {
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
await fs.mkdir(functions, { recursive: true });
await fs.cp(path.join(source, "dist"), path.join(output, "static"), {
  recursive: true,
});
const shared = path.join(functions, "_release-hold.func");
await fs.mkdir(shared, { recursive: true });
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
const publicConfig = await json(path.join(source, "docs/evidence/sol-release-activation-04/public-config.json"));
const releaseCommit = process.env.MICA_RELEASE_COMMIT;
if (releaseCommit) assert.match(releaseCommit, /^[a-f0-9]{40}$/);
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
    await fs.mkdir(path.join(functions, `api/${name}.func`), { recursive: true });
    await bundle(
      path.join(source, `api/${name}.js`),
      path.join(functions, `api/${name}.func/index.mjs`),
    );
    await write(path.join(functions, `api/${name}.func/.vc-config.json`), {
      runtime: "nodejs24.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: true,
      maxDuration: ["cards", "capabilities"].includes(name) ? 60 : 10,
      environment: {NEXT_PUBLIC_SUPABASE_URL: publicConfig.supabaseUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicConfig.supabasePublishableKey, ...(releaseCommit ? {MICA_RELEASE_COMMIT: releaseCommit} : {})},
    });
  }
const sourceConfig = await json(path.join(source, "vercel.json"));
const config = {
  version: 3,
  routes: [
    ...sourceConfig.headers.map(rule => ({src: rule.source, headers: Object.fromEntries(rule.headers.map(h => [h.key,h.value])), continue: true})),
    {src:"^/profile/?$",dest:"/"},
    {src:"^/index\\.html$",dest:"/"},
    {handle:"filesystem"},
  ],
  crons: sourceConfig.crons,
};
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
    "vercel.json",
  ]
    .sort()
    .map(async (p) => ({
      path: p,
      sha256: await hash(path.join(stage, p)),
      bytes: (await fs.stat(path.join(stage, p))).size,
    })),
);

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
