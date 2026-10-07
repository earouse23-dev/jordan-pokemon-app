import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Native file isolation keeps provider fixture hooks out of auth-boundary tests.
const files = readdirSync(import.meta.dirname).filter(name => name.endsWith(".test.js")).sort();
const result = spawnSync(process.execPath, ["--test", ...files.map(name => join(import.meta.dirname, name))], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
