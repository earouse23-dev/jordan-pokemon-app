import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const packageJson = JSON.parse(await read("package.json"));
const lock = JSON.parse(await read("package-lock.json"));
const pins = {
  core: "8.5.2",
  ios: "8.5.2",
  app: "8.1.1",
  preferences: "8.0.1",
  cli: "8.5.2",
};
for (const [name, version] of Object.entries(pins)) {
  const field = name === "cli" ? "devDependencies" : "dependencies";
  assert.equal(packageJson[field][`@capacitor/${name}`], version);
  assert.equal(lock.packages[""][field][`@capacitor/${name}`], version);
  assert.equal(
    lock.packages[`node_modules/@capacitor/${name}`].version,
    version,
  );
  assert(lock.packages[`node_modules/@capacitor/${name}`].integrity);
}
assert(!packageJson.dependencies["@capacitor/camera"]);
assert(!packageJson.dependencies["@capacitor/network"]);
const config = JSON.parse(await read("capacitor.config.json"));
const copied = JSON.parse(await read("ios/App/App/capacitor.config.json"));
assert.equal(config.webDir, "dist-native");
assert.equal(config.appId, "dev.mica.client07.local");
assert(!config.server?.url && !copied.server?.url);
const manifest = [];
const assets = await readdir(new URL("dist-native/", root), {
  recursive: true,
});
for (const name of assets.sort()) {
  if (!/\.[a-z]+$/i.test(name)) continue;
  assert(
    !/\.env|private|fixture|internal|\.map$/i.test(name),
    `Unexpected native asset ${name}`,
  );
  const bytes = await readFile(new URL(`dist-native/${name}`, root));
  const copy = await readFile(new URL(`ios/App/App/public/${name}`, root));
  assert(bytes.equals(copy), `Unsynced asset ${name}`);
  if (/\.(js|html|css|json)$/.test(name)) {
    assert(
      !/sb_secret_[A-Za-z0-9_-]{12,}|sk_live_[A-Za-z0-9]{12,}/.test(
        bytes.toString(),
      ),
      `Secret-shaped asset ${name}`,
    );
    assert(
      !/__nativeBridge|__nativeListeners|Synthetic beta Pikachu|synthetic-refresh/.test(
        bytes.toString(),
      ),
      `Test transport leaked into ${name}`,
    );
  }
  manifest.push({
    path: name,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const copiedAssets = (
  await readdir(new URL("ios/App/App/public/", root), { recursive: true })
).filter((name) => /\.[a-z]+$/i.test(name));
// Capacitor copy supplies these two empty Cordova compatibility files even without Cordova plugins.
for (const name of ["cordova.js", "cordova_plugins.js"]) {
  assert.equal((await read(`ios/App/App/public/${name}`)).trim(), "");
}
assert.deepEqual(
  copiedAssets
    .filter((name) => !["cordova.js", "cordova_plugins.js"].includes(name))
    .sort(),
  manifest.map((entry) => entry.path).sort(),
);
const publicConfig = await read("dist-native/app-config.js");
assert(!/secret|service.role|pkmnprices/i.test(publicConfig));
const project = await read("ios/App/App.xcodeproj/project.pbxproj");
assert(project.includes("IPHONEOS_DEPLOYMENT_TARGET = 15.0;"));
for (const file of ["MicaKeychain.swift", "MicaViewController.swift"])
  assert(project.includes(`${file} in Sources`));
assert(project.includes("PrivacyInfo.xcprivacy in Resources"));
assert(
  (await read("ios/App/CapApp-SPM/Package.swift")).includes('exact: "8.5.2"'),
);
assert(
  (await read("ios/App/App/SceneDelegate.swift")).includes(
    "MicaViewController()",
  ),
);
assert(
  (await read("ios/App/App/Base.lproj/Main.storyboard")).includes(
    'customClass="MicaViewController"',
  ),
);
assert(
  (await read("ios/App/App/Info.plist")).includes("NSCameraUsageDescription"),
);
const keychain = await read("ios/App/App/MicaKeychain.swift");
assert(keychain.includes("kSecAttrAccessibleWhenUnlockedThisDeviceOnly"));
assert(!/UserDefaults|print\(/.test(keychain));
const exclusion = spawnSync(
  process.execPath,
  ["scripts/verify-certificate-exclusion.mjs", "--root=dist-native"],
  { cwd: new URL("../", import.meta.url), encoding: "utf8" },
);
assert.equal(exclusion.status, 0, exclusion.stdout + exclusion.stderr);
await writeFile(
  new URL("docs/evidence/sol-client-07/native-asset-manifest.json", root),
  JSON.stringify(
    {
      pins,
      neutralPublicConfiguration: publicConfig.includes('"supabaseUrl":""'),
      assets: manifest,
    },
    null,
    2,
  ) + "\n",
);
console.info(
  `Native artifact, exact pins, shipping exclusion and copied-asset hashes verified: ${manifest.length} assets. Swift build/device validation is separate.`,
);
