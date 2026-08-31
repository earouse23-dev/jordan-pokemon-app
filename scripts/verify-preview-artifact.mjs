import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
const evidence = new URL(
  "../docs/evidence/MICA_REPRODUCIBLE_PREVIEW.sha256",
  import.meta.url,
);

execFileSync(
  process.execPath,
  ["scripts/build.mjs", "--neutral-public-config"],
  {
    cwd: fileURLToPath(root),
    stdio: "inherit",
  },
);

async function collectFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(
        ...(await collectFiles(
          new URL(`${entry.name}/`, directory),
          relativePath,
        )),
      );
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

const expected = (await readFile(evidence, "utf8"))
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#"));
const files = (await collectFiles(dist)).sort();
const actual = [];
for (const relativePath of files) {
  const contents = await readFile(new URL(relativePath, dist));
  const digest = createHash("sha256").update(contents).digest("hex");
  actual.push(`${digest}  ./${relativePath}`);
}

if (actual.join("\n") !== expected.join("\n")) {
  const expectedPaths = new Set(expected.map((line) => line.slice(66)));
  const actualPaths = new Set(actual.map((line) => line.slice(66)));
  const changed = actual
    .filter((line, index) => line !== expected[index])
    .map((line) => line.slice(66));
  const missing = [...expectedPaths].filter((path) => !actualPaths.has(path));
  const added = [...actualPaths].filter((path) => !expectedPaths.has(path));
  throw new Error(
    `Preview artifact differs from its recorded baseline. Changed: ${changed.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}; added: ${added.join(", ") || "none"}`,
  );
}

console.log(
  `Preview artifact verified: ${actual.length} files match the baseline.`,
);
