import { access, mkdir, cp, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import { publicNativeConfig } from "../lib/native-runtime.js";

const native = process.argv.includes("--native");
const noEnv =
  process.argv.includes("--release-config") ||
  native ||
  process.argv.includes("--neutral-public-config") ||
  process.argv.includes("--internal-certificates");
if (!noEnv) {
  try {
    loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const nativeConfigPath = process.argv
  .find((arg) => arg.startsWith("--public-config="))
  ?.slice("--public-config=".length);
if (
  native &&
  !nativeConfigPath &&
  !process.argv.includes("--neutral-public-config")
)
  throw new Error(
    "Native build needs --public-config=<public JSON> or --neutral-public-config.",
  );
const nativeConfig = nativeConfigPath
  ? publicNativeConfig(JSON.parse(await readFile(nativeConfigPath, "utf8")))
  : {
      supabaseUrl: "",
      supabasePublishableKey: "",
      apiOrigin: "",
      authCallback: "",
    };
const root = new URL("../", import.meta.url);
const internalCertificates = process.argv.includes("--internal-certificates");
if (native && internalCertificates)
  throw new Error(
    "Deferred certificate workflows cannot ship in native builds.",
  );
const dist = new URL(
  native
    ? "../dist-native/"
    : internalCertificates
      ? "../dist-internal/"
      : "../dist/",
  import.meta.url,
);
const neutralPublicConfig =
  internalCertificates || process.argv.includes("--neutral-public-config");
if (neutralPublicConfig || native || process.argv.includes("--release-config"))
  process.env.MICA_SOURCE_MAPS = "false";
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of [
  "index.html",
  "styles.css",
  "themes.css",
  "manifest.webmanifest",
  "sw.js",
  "icons",
  "assets",
]) {
  await access(new URL(item, root));
  await cp(new URL(item, root), new URL(item, dist), { recursive: true });
}
if (internalCertificates) {
  await cp(
    new URL("../internal/certificates.css", import.meta.url),
    new URL("internal-certificates.css", dist),
  );
  await cp(
    new URL("../internal/certificate-sample.svg", import.meta.url),
    new URL("certificate-sample.svg", dist),
  );
}
await build({
  entryPoints: [fileURLToPath(new URL("../app.js", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outdir: fileURLToPath(dist),
  entryNames: "[name]",
  chunkNames: "chunks/[name]-[hash]",
  splitting: true,
  minify: true,
  sourcemap: process.env.MICA_SOURCE_MAPS === "true",
  define: {
    __MICA_INTERNAL_CERTIFICATES__: String(internalCertificates),
    __MICA_NATIVE__: String(native),
  },
});
const releaseConfig = process.argv.includes("--release-config")
  ? publicNativeConfig({
      ...JSON.parse(
        await readFile(
          new URL(
            "../docs/evidence/sol-release-activation-04/public-config.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
      authCallback: "https://jordan-pokemon-app.vercel.app/auth/native-return",
    })
  : null;
const publicConfig = releaseConfig
  ? {
      supabaseUrl: releaseConfig.supabaseUrl,
      supabasePublishableKey: releaseConfig.supabasePublishableKey,
      apiOrigin: releaseConfig.apiOrigin,
      authReturnOrigin: new URL(releaseConfig.authCallback).origin,
    }
  : native
    ? nativeConfig
    : {
        supabaseUrl: neutralPublicConfig
          ? ""
          : process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        supabasePublishableKey: neutralPublicConfig
          ? ""
          : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
      };
await writeFile(
  new URL("app-config.js", dist),
  `globalThis.__APP_CONFIG__=Object.freeze(${JSON.stringify(publicConfig)});\n`,
  "utf8",
);
console.log(
  `${native ? "Native" : internalCertificates ? "Internal" : "Production"} static bundle created in ${native ? "dist-native" : internalCertificates ? "dist-internal" : "dist"}/.`,
);
