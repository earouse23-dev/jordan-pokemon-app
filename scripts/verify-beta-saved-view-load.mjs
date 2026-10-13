import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { portfolioService } from "../lib/portfolio-service.js";
import { createServer } from "node:http";
const workdir = process.env.MICA_CLIENT_06_WORKDIR,
  project = process.env.MICA_CLIENT_06_PROJECT_ID,
  context = process.env.MICA_CLIENT_06_DOCKER_CONTEXT,
  container = "supabase_db_" + project;
assert.equal(process.env.MICA_CLIENT_06_DISPOSABLE, "1");
assert.match(project || "", /^mica-client-06[bc]?-[a-z0-9]+$/);
assert.match(fs.realpathSync(workdir), /^\/private\/tmp\/mica-client-06[bc]?-/);
assert.equal(context, "colima-mica-dev");
const metadata = JSON.parse(
  execFileSync("docker", ["--context", context, "inspect", container], {
    encoding: "utf8",
  }),
)[0];
assert.equal(metadata.Config.Labels["com.supabase.cli.project"], project);
assert.equal(
  fs.realpathSync(metadata.Config.Labels["com.supabase.cli.workdir"]),
  fs.realpathSync(workdir),
);
const cfg = JSON.parse(
  execFileSync("supabase", ["status", "--workdir", workdir, "-o", "json"], {
    env: { ...process.env, DOCKER_CONTEXT: context },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
assert.equal(new URL(cfg.API_URL).hostname, "127.0.0.1");
assert.notEqual(new URL(cfg.API_URL).port, "54321");
// This qualifies the saved-summary read path only, not 100,000 inventory writes.
process.env.NEXT_PUBLIC_SUPABASE_URL = cfg.API_URL;
process.env.SUPABASE_SECRET_KEY = cfg.SERVICE_ROLE_KEY;
const nativeFetch = globalThis.fetch;
let externalRequests = 0;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url || input);
  if (url.hostname !== "127.0.0.1") {
    externalRequests++;
    throw new Error("External request blocked");
  }
  return nativeFetch(input, options);
};
const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const owners = [],
  tokens = [];
const sql = (q) =>
  execFileSync(
    "docker",
    [
      "--context",
      context,
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  req.query = Object.fromEntries(url.searchParams);
  res.status = (value) => {
    res.statusCode = value;
    return res;
  };
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  };
  void portfolioService(req, res);
});
try {
  for (let i = 0; i < 20; i++) {
    const email = "beta-load-" + randomUUID() + "@example.invalid",
      password = "Mica-" + randomUUID() + "-9a!";
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(user.error);
    owners.push(user.data.user.id);
    const client = createClient(cfg.API_URL, cfg.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    tokens.push(login.data.session.access_token);
  }
  for (let i = 20; i < 100; i++) owners.push(randomUUID());
  sql(
    `insert into auth.users(id) values ${owners
      .slice(20)
      .map((id) => `('${id}')`)
      .join(",")};`,
  );
  const now = new Date().toISOString(),
    history = Array.from({ length: 365 }, (_, i) => ({
      date: new Date(Date.now() - (364 - i) * 86400000)
        .toISOString()
        .slice(0, 10),
      total: 100000 + i,
    }));
  const view = {
    version: 1,
    updatedAt: now,
    checkedDay: now.slice(0, 10),
    dailyVersion: 1,
    summaries: [
      {
        currency: "USD",
        total: 100364,
        knownTotal: 100364,
        pricedUnits: 1000,
        missingUnits: 0,
        history,
        historyPositions: Array.from({ length: 1000 }, (_, i) => [
          "synthetic-" + i,
          "synthetic",
        ]),
      },
    ],
    pricing: Array.from({ length: 1000 }, (_, i) => ({
      uid: "synthetic-" + i,
      price: 100,
    })),
  };
  const encoded = JSON.stringify(view).replaceAll("'", "''");
  sql(
    `insert into public.portfolio_views(user_id,view) values ${owners.map((id) => `('${id}','${encoded}'::jsonb)`).join(",")} on conflict(user_id) do update set view=excluded.view;`,
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const timings = [],
    sizes = [];
  for (let round = 0; round < 3; round++)
    await Promise.all(
      tokens.map(async (token) => {
        const start = performance.now(),
          response = await fetch(
            origin + "/?surface=portfolio&display=summary",
            { headers: { authorization: "Bearer " + token } },
          ),
          body = await response.text();
        assert.equal(response.status, 200);
        const result = JSON.parse(body).view;
        assert.equal(result.summaries[0].total, 100364);
        assert.equal(result.summaries[0].history.length, 365);
        assert.equal(result.pricing, undefined);
        timings.push(performance.now() - start);
        sizes.push(Buffer.byteLength(body));
      }),
    );
  assert.equal(externalRequests, 0);
  timings.sort((a, b) => a - b);
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Owned local Auth/Postgres plus real portfolioService HTTP GET; synthetic saved summaries only",
    accounts: 100,
    simultaneousReaders: 20,
    requests: 60,
    historyDays: 365,
    representedCopiesPerSummary: 1000,
    physicalInventoryCapacityQualified: false,
    p50Ms: Math.round(timings[29]),
    p95Ms: Math.round(timings[56]),
    maxMs: Math.round(timings.at(-1)),
    responseBytes: Math.max(...sizes),
    externalRequests,
    providerRequests: 0,
    customerWrites: 0,
  };
  fs.writeFileSync(
    "docs/evidence/beta-readiness-2026-10-12/step-7-saved-read-load.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await new Promise((resolve) => server.close(resolve));
  if (owners.length)
    sql(
      `delete from auth.users where id in (${owners.map((id) => `'${id}'`).join(",")});`,
    );
  globalThis.fetch = nativeFetch;
}
