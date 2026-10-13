import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createPosition } from "../lib/supabase-data.js";
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
const privateDir = "/tmp/mica-beta-recovery-" + randomUUID();
fs.mkdirSync(privateDir, { mode: 0o700 });
const run = (args, options = {}) =>
  execFileSync(
    "docker",
    [
      "--context",
      context,
      "exec",
      ...(options.input ? ["-i"] : []),
      container,
      ...args,
    ],
    { encoding: "utf8", ...options },
  );
const sql = (q) =>
  run([
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-Atq",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    q,
  ]).trim();
const admin = createClient(cfg.API_URL, cfg.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  users = [];
for (const u of (await admin.auth.admin.listUsers()).data.users.filter((u) =>
  u.email.startsWith("beta-restore-"),
))
  await admin.auth.admin.deleteUser(u.id);
const password = "Mica-" + randomUUID() + "-9a!";
const owner = await admin.auth.admin.createUser({
  email: "beta-restore-" + randomUUID() + "@example.invalid",
  password,
  email_confirm: true,
});
assert.ifError(owner.error);
users.push(owner.data.user.id);
const uid = owner.data.user.id,
  client = createClient(cfg.API_URL, cfg.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
assert.ifError(
  (
    await client.auth.signInWithPassword({
      email: owner.data.user.email,
      password,
    })
  ).error,
);
await createPosition(client, {
  identity: {
    name: "Synthetic restore",
    set: "Recovery fixture",
    number: "1/100",
    language: "en",
    variant: "Holofoil",
    providerCardId: "beta-restore-" + randomUUID(),
    externalIds: {},
    acquisitionCostKnown: true,
    acquisitionDateKnown: true,
  },
  cardState: "raw",
  rawCondition: "near_mint",
  quantity: 3,
  transactionDate: "2026-01-01",
  unitPrice: 25,
  currency: "USD",
  idempotencyKey: randomUUID(),
  acquisitionMethod: "direct_purchase",
});
const item = sql(
  `select id from public.collection_items where user_id='${uid}' limit 1`,
);
sql(
  `insert into public.position_price_observations(user_id,collection_item_id,provider,currency,valuation_type,finish,card_state,raw_condition,amount,observed_at) values('${uid}','${item}','synthetic','USD','market','holo','raw','near_mint',200,'2026-01-01'),('${uid}','${item}','synthetic','USD','market','holo','raw','near_mint',250,'2026-01-02'); update public.portfolio_views set view='{"checkedDay":"2026-01-02","total":750,"history":[{"date":"2026-01-01","value":600},{"date":"2026-01-02","value":750}]}' where user_id='${uid}'`,
);
const bucket = admin.storage.from("collection-item-files"),
  object = uid + "/restore/photo.png",
  bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+y5WQAAAAASUVORK5CYII=",
    "base64",
  );
assert.ifError(
  (await bucket.upload(object, bytes, { contentType: "image/png" })).error,
);
const downloaded = await bucket.download(object);
assert.ifError(downloaded.error);
const saved = Buffer.from(await downloaded.data.arrayBuffer());
fs.writeFileSync(privateDir + "/photo.png", saved, { mode: 0o600 });
assert.deepEqual(saved, bytes);
const snapshot = sql(
  `select jsonb_build_object('copies',(select count(*) from public.collection_items where user_id='${uid}'),'quantity',(select sum(quantity) from public.collection_items where user_id='${uid}'),'transactions',(select count(*) from public.collection_transactions where user_id='${uid}'),'history',(select jsonb_agg(jsonb_build_array(amount,observed_at) order by observed_at) from public.position_price_observations where user_id='${uid}'),'view',(select view from public.portfolio_views where user_id='${uid}'),'cost',(select sum(quantity*unit_price) from public.collection_transactions where user_id='${uid}'))`,
);
const dump = run(
  [
    "pg_dump",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-Fc",
    "--exclude-schema=cron",
    "--exclude-schema=net",
    "--exclude-schema=vault",
  ],
  { encoding: "buffer", maxBuffer: 100e6 },
);
fs.writeFileSync(privateDir + "/database.dump", dump, { mode: 0o600 });
const toc = run(["pg_restore", "-l"], { input: dump })
  .split("\n")
  .filter(
    (line) =>
      !/EXTENSION.*(pg_cron|pg_net|supabase_vault)|\b(cron|net|vault)\b/.test(
        line,
      ),
  )
  .join("\n");
run(["dropdb", "-U", "postgres", "--if-exists", "mica_beta_restore"]);
run(["createdb", "-U", "postgres", "mica_beta_restore"]);
run(["sh", "-c", "cat > /tmp/mica-beta-restore.list"], { input: toc });
try {
  run(
    [
      "pg_restore",
      "-U",
      "supabase_admin",
      "-d",
      "mica_beta_restore",
      "--exit-on-error",
      "--use-list=/tmp/mica-beta-restore.list",
    ],
    { input: dump, maxBuffer: 5e6 },
  );
} catch (e) {
  console.log("RESTORE_FAILURE", String(e.stderr).slice(-3000));
  throw e;
}
const restored = run([
  "psql",
  "-U",
  "postgres",
  "-d",
  "mica_beta_restore",
  "-Atq",
  "-c",
  `select jsonb_build_object('copies',(select count(*) from public.collection_items where user_id='${uid}'),'quantity',(select sum(quantity) from public.collection_items where user_id='${uid}'),'transactions',(select count(*) from public.collection_transactions where user_id='${uid}'),'history',(select jsonb_agg(jsonb_build_array(amount,observed_at) order by observed_at) from public.position_price_observations where user_id='${uid}'),'view',(select view from public.portfolio_views where user_id='${uid}'),'cost',(select sum(quantity*unit_price) from public.collection_transactions where user_id='${uid}'))`,
]).trim();
assert.equal(restored, snapshot);
const isolated = run([
  "psql",
  "-U",
  "postgres",
  "-d",
  "mica_beta_restore",
  "-Atq",
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  `begin;set local role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);select count(*) from public.collection_items where user_id='${uid}';select count(*) from public.position_price_observations where user_id='${uid}';select count(*) from public.portfolio_views where user_id='${uid}';rollback;`,
])
  .trim()
  .split("\n")
  .slice(-3);
assert.deepEqual(isolated, ["0", "0", "0"]);
assert.ifError((await bucket.remove([object])).error);
assert.ifError(
  (
    await bucket.upload(object, fs.readFileSync(privateDir + "/photo.png"), {
      contentType: "image/png",
    })
  ).error,
);
const recovered = await bucket.download(object);
assert.ifError(recovered.error);
assert.deepEqual(Buffer.from(await recovered.data.arrayBuffer()), bytes);
const result = {
  checkedAt: new Date().toISOString(),
  source: "owned synthetic local database",
  restoredDatabase: "mica_beta_restore",
  reconciled: JSON.parse(snapshot),
  databaseBytes: dump.length,
  storageSha256: createHash("sha256").update(bytes).digest("hex"),
  storageRestored: true,
  restoredOtherAccountReadsDenied: true,
  productionData: false,
  productionBackupNotEstablished: true,
};
fs.writeFileSync(
  new URL(
    "../docs/evidence/beta-readiness-2026-10-12/step-5-restore.json",
    import.meta.url,
  ),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
assert.ifError((await bucket.remove([object])).error);
for (const id of users)
  assert.ifError((await admin.auth.admin.deleteUser(id)).error);
run(["dropdb", "-U", "postgres", "mica_beta_restore"]);
fs.rmSync(privateDir, { recursive: true });
