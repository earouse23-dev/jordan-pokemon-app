import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const rootArg = process.argv
  .find((arg) => arg.startsWith("--root="))
  ?.slice("--root=".length);
const root = rootArg
  ? new URL(`${rootArg.replace(/\/$/, "")}/`, new URL("../", import.meta.url))
  : new URL("../dist/", import.meta.url);
const files = await readdir(root, { recursive: true });
assert(files.some((name) => name === "app.js"));
assert(
  files.every(
    (name) => !/internal|certificate-fixture|certificate-workflow/i.test(name),
  ),
);
for (const name of files.filter((value) =>
  /\.(?:js|html|css|json)$/.test(value),
)) {
  const contents = await readFile(new URL(join(name), root), "utf8");
  for (const marker of [
    "__MICA_INTERNAL_CERTIFICATE_TEST__",
    "certificateLookupFromAdd",
    "certificateLookupFromCopy",
    "Internal certificate samples",
    "certificate-fixture-owner",
    "internalFixtureSave",
    "Sample record match",
    ".certificate-result",
  ])
    assert(
      !contents.includes(marker),
      `${name} includes deferred marker ${marker}`,
    );
}
console.info(
  `Shipping certificate exclusion passed across ${files.length} files.`,
);
