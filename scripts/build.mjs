import { access, mkdir, cp, rm, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const item of [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "icons",
]) {
  await access(new URL(item, root));
  await cp(new URL(item, root), new URL(item, dist), { recursive: true });
}
await build({
  entryPoints: [fileURLToPath(new URL("../app.js", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: fileURLToPath(new URL("../dist/app.js", import.meta.url)),
  minify: true,
  sourcemap: true,
});
const publicConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
};
await writeFile(
  new URL("../dist/app-config.js", import.meta.url),
  `globalThis.__APP_CONFIG__=Object.freeze(${JSON.stringify(publicConfig)});\n`,
  "utf8",
);
console.log("Production static bundle created in dist/.");
