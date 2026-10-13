import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";

test("browser harnesses import the shipping entry point so they cannot bootstrap a second app", () => {
  const root = new URL("../", import.meta.url);
  const entry = readFileSync(new URL("index.html", root), "utf8").match(/src="(app\.js\?v=\d+)"/)[1];
  for (const file of readdirSync(new URL("tests/browser/", root)).filter(name => name.endsWith(".spec.js"))) {
    const source = readFileSync(new URL(`tests/browser/${file}`, root), "utf8");
    for (const match of source.matchAll(/\/app\.js\?v=\d+/g)) assert.equal(match[0], "/" + entry, file);
  }
});
