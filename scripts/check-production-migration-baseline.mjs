import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const migrationsDirectory = path.join(root, "supabase", "migrations");
const evidenceDirectory = path.join(root, "docs", "evidence");

const [production, expected, filenames] = await Promise.all([
  readFile(
    path.join(evidenceDirectory, "MICA_PRODUCTION_MIGRATIONS.json"),
    "utf8",
  ).then(JSON.parse),
  readFile(
    path.join(evidenceDirectory, "MICA_MIGRATION_RECONCILIATION.json"),
    "utf8",
  ).then(JSON.parse),
  readdir(migrationsDirectory),
]);

const local = filenames
  .filter((filename) => filename.endsWith(".sql"))
  .sort()
  .map((filename) => {
    const match = filename.match(/^(\d{14})_(.+)\.sql$/);
    if (!match) throw new Error(`Invalid migration filename: ${filename}`);
    return { filename, version: match[1], name: match[2] };
  });

const localNames = new Set();
const duplicateLocalNames = [];
for (const migration of local) {
  if (localNames.has(migration.name)) duplicateLocalNames.push(migration.name);
  localNames.add(migration.name);
}

const productionByName = new Map();
for (const migration of production.migrations || []) {
  const versions = productionByName.get(migration.name) || [];
  versions.push(migration.version);
  productionByName.set(migration.name, versions);
}

const missingLocalNames = [...productionByName.keys()]
  .filter((name) => !localNames.has(name))
  .sort();
const pendingLocalNames = local
  .filter((migration) => !productionByName.has(migration.name))
  .map((migration) => migration.name)
  .sort();
const versionMismatches = [...productionByName.entries()]
  .flatMap(([name, versions]) => {
    const migration = local.find((entry) => entry.name === name);
    return migration && !versions.includes(migration.version)
      ? [
          {
            name,
            local_version: migration.version,
            production_versions: versions,
          },
        ]
      : [];
  })
  .sort((left, right) => left.name.localeCompare(right.name));
const duplicateProductionNames = [...productionByName.entries()]
  .filter(([, versions]) => versions.length > 1)
  .map(([name, versions]) => ({ name, versions }))
  .sort((left, right) => left.name.localeCompare(right.name));

function canonical(value) {
  return JSON.stringify(value);
}

const failures = [];
if (duplicateLocalNames.length)
  failures.push(`Duplicate local migration names: ${duplicateLocalNames.join(", ")}`);
if (missingLocalNames.length)
  failures.push(`Production migrations missing locally: ${missingLocalNames.join(", ")}`);
if (
  canonical(pendingLocalNames) !==
  canonical([...(expected.approved_pending_local_names || [])].sort())
)
  failures.push("Pending local migration names differ from the approved baseline.");
if (
  canonical(versionMismatches) !==
  canonical(
    [...(expected.known_version_mismatches || [])].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  )
)
  failures.push("Migration version mismatches differ from the recorded baseline.");
if (
  canonical(duplicateProductionNames) !==
  canonical(
    [...(expected.duplicate_production_names || [])].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  )
)
  failures.push("Duplicate production migration names differ from the recorded baseline.");

if (failures.length) {
  for (const failure of failures) console.error(`migration-baseline: ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Migration baseline verified: ${local.length} local files, ` +
      `${production.migrations.length} production history rows, ` +
      `${pendingLocalNames.length} approved pending migrations, ` +
      `${versionMismatches.length} recorded version mismatches.`,
  );
}
