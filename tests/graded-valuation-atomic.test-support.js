import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { fetchPkmnPricesSales } from "../lib/providers/pkmnprices.js";
import { valuationPositionContract } from "../api/graded-valuation.js";
import { readExactSoldObservation } from "../lib/graded-valuation.js";

const contexts = new AsyncLocalStorage();
export const providerControl = { pause: null, calls: 0, fail: false };
export function installSyntheticTransport(localOrigin) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin === localOrigin) return original(input, init);
    assert.equal(
      url.origin,
      "https://api.pkmnprices.com",
      "no external network allowed",
    );
    const { lookup, sales } = contexts.getStore() || {};
    assert.ok(lookup, "provider traffic must be inside synthetic transport");
    providerControl.calls++;
    if (providerControl.fail)
      return Response.json({ error: "synthetic failure" }, { status: 503 });
    if (url.pathname === "/v1/cards/20618")
      return Response.json({
        id: 20618,
        name: lookup.name,
        number: "017",
        total_set_number: "064",
        set: { name: lookup.set },
        language: "English",
        prices: [{ variant: lookup.variant, currency: lookup.currency }],
      });
    assert.equal(url.pathname, "/v1/cards/20618/listings/ebay");
    assert.equal(url.searchParams.get("limit"), "10");
    return Response.json({
      data: sales.map((row) => ({
        id: row.providerSaleId,
        ebay_listing_id: row.providerSaleId,
        title: `${lookup.name} ${lookup.set} ${lookup.number} ${lookup.variant} PSA ${lookup.grade}`,
        price: row.amount,
        currency: row.currency,
        grader: "PSA",
        grade: lookup.grade,
        variant: lookup.variant,
        language: "English",
        sold_at: row.soldAt,
        listing_url: row.sourceUrl,
        attribution: "exact",
      })),
      pagination: { has_more: false },
    });
  };
  return () => {
    globalThis.fetch = original;
  };
}
export async function syntheticAdapter(key, lookup, signal, options, sales) {
  const result = await contexts.run({ lookup, sales }, () =>
    fetchPkmnPricesSales(key, lookup, signal, options),
  );
  if (providerControl.pause) await providerControl.pause();
  return result;
}

const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
export async function runAtomicChecks({
  admin,
  owner,
  other,
  graded,
  syntheticById,
  verifiedClient,
  refresh,
  ownerToken,
  otherToken,
  projectId,
  dockerContext,
  setNow,
}) {
  const dockerArgs = [
    "--context",
    dockerContext,
    "exec",
    "-i",
    `supabase_db_${projectId}`,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-Atq",
    "-v",
    "ON_ERROR_STOP=1",
  ];
  const sql = (text) =>
    execFileSync("docker", [...dockerArgs, "-c", text], {
      encoding: "utf8",
    }).trim();
  const held = new Set();
  function transaction() {
    const child = spawn("docker", dockerArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    held.add(child);
    let output = "",
      errors = "";
    const waiting = new Map();
    child.stdout.on("data", (chunk) => {
      output += chunk;
      for (const [marker, resolve] of waiting)
        if (output.includes(marker)) {
          waiting.delete(marker);
          resolve(output);
        }
    });
    child.stderr.on("data", (chunk) => (errors += chunk));
    child.on("exit", (code) => {
      held.delete(child);
      if (code)
        for (const [, resolve] of waiting)
          resolve(Promise.reject(new Error(errors)));
    });
    return {
      async run(command) {
        const marker = "barrier_" + randomUUID().replaceAll("-", "");
        const done = new Promise((resolve) => waiting.set(marker, resolve));
        child.stdin.write(command + ";\n\\echo " + marker + "\n");
        return Promise.race([
          done,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("transaction barrier timeout")),
              10000,
            ).unref(),
          ),
        ]);
      },
      close() {
        child.stdin.end("rollback;\n\\q\n");
      },
    };
  }
  async function blockedOn(pid) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (
        Number(
          sql(
            `select count(*) from pg_stat_activity where ${pid}=any(pg_blocking_pids(pid))`,
          ),
        ) > 0
      )
        return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("database lock barrier was not reached");
  }
  const row = async (id) => {
    const r = await admin
      .from("collection_items")
      .select("*")
      .eq("id", id)
      .single();
    assert.ifError(r.error);
    return r.data;
  };
  const observations = async (id) => {
    const r = await admin
      .from("position_price_observations")
      .select("*")
      .eq("collection_item_id", id)
      .contains("quality", { producer: "mica-server-exact-sold-v1" });
    assert.ifError(r.error);
    return r.data;
  };
  const budget = () =>
    sql(
      "select coalesce(daily_credit_reserved,0) from public.provider_sync_status where provider='pkmnprices'",
    );
  const signature =
    "public.persist_verified_graded_valuation(uuid,uuid,uuid,jsonb,jsonb)";
  const sessionId = JSON.parse(
    Buffer.from(ownerToken.split(".")[1], "base64url"),
  ).session_id;
  const args = (position, observation = null, sid = sessionId) => ({
    p_owner_id: owner.id,
    p_session_id: sid,
    p_position_id: position.id,
    p_expected: valuationPositionContract(position),
    p_observation: observation,
  });
  try {
    const before = budget(),
      calls = providerControl.calls;
    assert.equal((await refresh("", graded.A)).status, 401);
    assert.equal((await refresh(otherToken, graded.A)).status, 404);
    sql(`revoke execute on function ${signature} from service_role`);
    assert.equal((await refresh(ownerToken, graded.A)).status, 503);
    assert.equal(budget(), before);
    assert.equal(providerControl.calls, calls);
    sql(`grant execute on function ${signature} to service_role`);
    const position = await row(graded.A);
    for (const client of [
      verifiedClient(process.env.MICA_LOCAL_SUPABASE_ANON_KEY),
      owner.session,
      other.session,
    ]) {
      assert.ok(
        (await client.rpc("persist_verified_graded_valuation", args(position)))
          .error,
      );
    }
    for (const invalid of [
      randomUUID(),
      JSON.parse(Buffer.from(otherToken.split(".")[1], "base64url")).session_id,
    ])
      assert.ok(
        (
          await admin.rpc(
            "persist_verified_graded_valuation",
            args(position, null, invalid),
          )
        ).error,
      );
    sql(
      `update auth.sessions set not_after=now()-interval '1 minute' where id=${quote(sessionId)}`,
    );
    assert.equal((await refresh(ownerToken, graded.A)).status, 503);
    assert.equal(budget(), before);
    assert.equal(providerControl.calls, calls);
    sql(`update auth.sessions set not_after=null where id=${quote(sessionId)}`);
    console.log(
      "PASS actual grants, ownership, expired/invalid sessions, revoked EXECUTE: no reservation/transport/write",
    );

    const cSales = syntheticById.get(graded.C);
    syntheticById.set(graded.C, cSales.slice(0, 2));
    const insufficient = await refresh(ownerToken, graded.C);
    assert.equal(insufficient.status, 200);
    assert.equal(insufficient.body.valuation, null);
    assert.equal((await observations(graded.C)).length, 0);
    syntheticById.set(graded.C, cSales);
    providerControl.fail = true;
    const errorCalls = providerControl.calls;
    const providerFailure = await refresh(ownerToken, graded.C);
    assert.equal(providerFailure.status, 502);
    assert.equal(providerControl.calls, errorCalls + 1);
    assert.equal((await observations(graded.C)).length, 0);
    providerControl.fail = false;
    console.log(
      "PASS actual adapter insufficient/failing synthetic transport: no write and no retry",
    );

    // Completed changes first: provider-return barrier, then independent DB commit.
    const changes = [
      ["grade", "grade=9"],
      [
        "identity",
        "identity_snapshot=jsonb_set(identity_snapshot,'{edition}','\"first_edition\"')",
      ],
      ["currency", "currency='EUR'"],
      ["status", "status='sold'"],
    ];
    for (const [label, change] of changes) {
      let reached, release;
      const ready = new Promise((resolve) => (reached = resolve)),
        gate = new Promise((resolve) => (release = resolve));
      providerControl.pause = async () => {
        reached();
        await gate;
      };
      const pending = refresh(ownerToken, graded.A);
      await ready;
      const tx = transaction();
      await tx.run(
        `begin;update public.collection_items set ${change} where id=${quote(graded.A)};commit`,
      );
      tx.close();
      release();
      assert.equal((await pending).status, 409, label);
      assert.equal((await observations(graded.A)).length, 0);
      sql(
        `update public.collection_items set grade=10,currency='USD',user_id=${quote(owner.id)},status='owned',identity_snapshot=${quote(JSON.stringify(position.identity_snapshot))}::jsonb where id=${quote(graded.A)}`,
      );
      providerControl.pause = null;
      console.log(`PASS change commits first: ${label}`);
    }

    // Ownership cannot be reassigned while existing owner-bound transactions exist.
    let ownerReached, ownerRelease;
    const ownerReady = new Promise((resolve) => (ownerReached = resolve)),
      ownerGate = new Promise((resolve) => (ownerRelease = resolve));
    providerControl.pause = async () => {
      ownerReached();
      await ownerGate;
    };
    const ownerPending = refresh(ownerToken, graded.A);
    await ownerReady;
    assert.throws(
      () =>
        sql(
          `update public.collection_items set user_id=${quote(other.id)} where id=${quote(graded.A)}`,
        ),
      /foreign key constraint/,
    );
    assert.equal((await row(graded.A)).user_id, owner.id);
    ownerRelease();
    const ownedResponse = await ownerPending;
    assert.equal(ownedResponse.status, 200);
    providerControl.pause = null;
    sql(
      `delete from public.position_price_observations where collection_item_id=${quote(graded.A)} and quality->>'producer'='mica-server-exact-sold-v1'`,
    );
    console.log(
      "PASS delayed ownership reassignment is rejected by retained composite FK; original owner write remains valid",
    );

    // Writer first: test-only insertion barrier holds session/copy row locks.
    sql(
      `create function public.client06c_insert_barrier() returns trigger language plpgsql as $$begin perform pg_advisory_xact_lock(606606);return new;end$$;create trigger client06c_barrier before insert on public.position_price_observations for each row execute function public.client06c_insert_barrier()`,
    );
    for (const [label, change] of changes) {
      const lock = transaction();
      const out = await lock.run(
        "begin;select pg_backend_pid();select pg_advisory_xact_lock(606606)",
      );
      const pid = Number(out.split("\n").find((line) => /^\d+$/.test(line)));
      const pending = refresh(ownerToken, graded.A);
      await blockedOn(pid);
      const mutation = transaction();
      const update = mutation.run(
        `begin;update public.collection_items set ${change} where id=${quote(graded.A)};commit`,
      );
      const deadline = Date.now() + 10000;
      while (
        Number(
          sql(
            "select count(*) from pg_stat_activity where cardinality(pg_blocking_pids(pid))>0",
          ),
        ) < 2
      ) {
        assert.ok(Date.now() < deadline, "mutation must reach lock barrier");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await lock.run("commit");
      lock.close();
      assert.equal((await pending).status, 200, label);
      await update;
      mutation.close();
      const changed = await row(graded.A),
        saved = await observations(graded.A);
      assert.equal(saved.length, 1);
      assert.equal(saved[0].user_id, owner.id);
      if (label !== "status")
        assert.equal(
          readExactSoldObservation(saved[0], changed)?.current ?? null,
          null,
          label,
        );
      else {
        assert.equal(changed.status, "sold");
        assert.equal(readExactSoldObservation(saved[0], changed).current, null);
        assert.equal(readExactSoldObservation(saved[0], changed).amount, 150);
      }
      sql(
        `update public.collection_items set grade=10,currency='USD',user_id=${quote(owner.id)},status='owned',identity_snapshot=${quote(JSON.stringify(position.identity_snapshot))}::jsonb where id=${quote(graded.A)};delete from public.position_price_observations where collection_item_id=${quote(graded.A)} and quality->>'producer'='mica-server-exact-sold-v1'`,
      );
      console.log(`PASS writer locks first: ${label}`);
    }
    const revokeSession = verifiedClient(
      process.env.MICA_LOCAL_SUPABASE_ANON_KEY,
    );
    const revSigned = await revokeSession.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    assert.ifError(revSigned.error);
    const revToken = revSigned.data.session.access_token;
    const revSid = JSON.parse(
      Buffer.from(revToken.split(".")[1], "base64url"),
    ).session_id;
    const sessionLock = transaction();
    const sessionOut = await sessionLock.run(
      "begin;select pg_backend_pid();select pg_advisory_xact_lock(606606)",
    );
    const sessionPid = Number(
      sessionOut.split("\n").find((line) => /^\d+$/.test(line)),
    );
    const sessionWrite = refresh(revToken, graded.A);
    await blockedOn(sessionPid);
    const revoker = transaction();
    const revoking = revoker.run(
      `begin;delete from auth.sessions where id=${quote(revSid)};commit`,
    );
    const sessionDeadline = Date.now() + 10000;
    while (
      Number(
        sql(
          "select count(*) from pg_stat_activity where cardinality(pg_blocking_pids(pid))>0",
        ),
      ) < 2
    ) {
      assert.ok(Date.now() < sessionDeadline);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await sessionLock.run("commit");
    sessionLock.close();
    assert.equal((await sessionWrite).status, 200);
    await revoking;
    revoker.close();
    assert.equal(
      sql(`select count(*) from auth.sessions where id=${quote(revSid)}`),
      "0",
    );
    assert.equal((await observations(graded.A)).length, 1);
    assert.equal(
      (await refresh(revToken, graded.A)).status === 401 ||
        (await refresh(revToken, graded.A)).status === 503,
      true,
    );
    sql(
      `delete from public.position_price_observations where collection_item_id=${quote(graded.A)} and quality->>'producer'='mica-server-exact-sold-v1'`,
    );
    console.log(
      "PASS writer session lock commits before concurrent session deletion; later requests denied",
    );
    sql(
      "drop trigger client06c_barrier on public.position_price_observations;drop function public.client06c_insert_barrier()",
    );

    // A real completed revocation during a delayed provider response.
    let reached, release;
    const ready = new Promise((resolve) => (reached = resolve)),
      gate = new Promise((resolve) => (release = resolve));
    providerControl.pause = async () => {
      reached();
      await gate;
    };
    const pending = refresh(ownerToken, graded.A);
    await ready;
    const revoked = await owner.session.auth.signOut();
    assert.ifError(revoked.error);
    assert.equal(
      sql(`select count(*) from auth.sessions where id=${quote(sessionId)}`),
      "0",
    );
    release();
    assert.equal((await pending).status, 401);
    providerControl.pause = null;
    assert.equal((await observations(graded.A)).length, 0);
    console.log(
      "PASS actual Auth signout commits before final persistence: no write",
    );
    const signed = await owner.session.auth.signInWithPassword({
      email: owner.email,
      password: owner.password,
    });
    assert.ifError(signed.error);
    // Return new token to caller, which must not reuse the revoked one.
    owner.currentToken = signed.data.session.access_token;

    const token = owner.currentToken;
    const raced = await Promise.all([
      refresh(token, graded.A),
      refresh(token, graded.A),
    ]);
    raced.forEach((result) =>
      assert.equal(result.status, 200, JSON.stringify(result.body)),
    );
    const original = raced[0].body.valuation;
    syntheticById.set(graded.A, [...syntheticById.get(graded.A)].reverse());
    const reordered = await refresh(token, graded.A);
    assert.equal(reordered.status, 200);
    assert.deepEqual(reordered.body.valuation, original);
    assert.equal((await observations(graded.A)).length, 1);
    const saved = (await observations(graded.A))[0];
    assert.equal(
      Date.parse(saved.observed_at),
      Date.parse(original.evaluatedAt),
    );
    for (const client of [
      owner.session,
      other.session,
      verifiedClient(process.env.MICA_LOCAL_SUPABASE_ANON_KEY),
    ]) {
      assert.ok(
        (
          await client
            .from("position_price_observations")
            .insert({ ...saved, id: randomUUID() })
        ).error,
      );
      assert.ok(
        (
          await client
            .from("position_price_observations")
            .update({ amount: 999 })
            .eq("id", saved.id)
        ).error,
      );
    }
    const secondOwner = await other.session
      .from("position_price_observations")
      .select("*")
      .eq("id", saved.id);
    assert.ifError(secondOwner.error);
    assert.equal(secondOwner.data.length, 0);
    const current = await row(graded.A),
      newSid = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url"),
      ).session_id;
    for (const patch of [
      { amount: 999 },
      { user_id: other.id },
      { collection_item_id: graded.C },
      { currency: "EUR" },
      { grade: 9 },
      { valuation_type: "market" },
      { observed_at: "2099-01-01T00:00:00Z" },
      { retrieved_at: "2000-01-01T00:00:00Z" },
      { quality: { producer: "forged" } },
      { source_metadata: {} },
    ]) {
      const bad = { ...saved, ...patch };
      const rejected = await admin.rpc(
        "persist_verified_graded_valuation",
        args(current, bad, newSid),
      );
      assert.ok(rejected.error, JSON.stringify(patch));
    }
    // Same ID, altered amount is a conflict, not success; malformed refs rejected by reader/server contract.
    const malformed = {
      ...saved,
      id: randomUUID(),
      source_metadata: {
        ...saved.source_metadata,
        contributingEvidenceIds: ["forged"],
      },
    };
    assert.equal(readExactSoldObservation(malformed, current), null);
    for (const patch of [
      { amount: 999 },
      { user_id: other.id },
      { collection_item_id: graded.C },
      { quality: { producer: "forged" } },
    ]) {
      const mutation = await admin
        .from("position_price_observations")
        .update(patch)
        .eq("id", saved.id);
      if (!mutation.error) {
        assert.equal(
          (await refresh(token, graded.A)).status,
          503,
          "existing conflicting record must not return success",
        );
        assert.ifError(
          (
            await admin
              .from("position_price_observations")
              .update(saved)
              .eq("id", saved.id)
          ).error,
        );
      }
    }
    setNow(Date.parse("2026-09-25T12:00:01Z"));
    const retryLater = await refresh(token, graded.A);
    assert.equal(retryLater.status, 200);
    assert.deepEqual(retryLater.body.valuation, original);
    let ticking = Date.parse("2026-09-25T12:00:01Z");
    setNow(() => ++ticking);
    const tickingRetry = await refresh(token, graded.A);
    assert.equal(
      tickingRetry.status,
      200,
      "retrieval precedes evaluation on a ticking server clock",
    );
    assert.deepEqual(tickingRetry.body.valuation, original);
    setNow(Date.parse("2026-09-25T12:00:01Z"));
    const priorSales = syntheticById.get(graded.A);
    syntheticById.set(graded.A, [
      ...priorSales,
      {
        ...priorSales[0],
        providerSaleId: "6999",
        sourceUrl: "https://www.ebay.com/itm/6999",
        soldAt: "2026-09-21",
        amount: 155,
      },
    ]);
    const next = await refresh(token, graded.A);
    assert.equal(next.status, 200);
    assert.notEqual(next.body.valuation.id, original.id);
    assert.equal(
      Date.parse(next.body.valuation.evaluatedAt),
      Date.parse("2026-09-25T12:00:01Z"),
    );
    assert.equal((await observations(graded.A)).length, 2);
    sql(
      `delete from public.position_price_observations where id=${quote(next.body.valuation.id)}`,
    );
    syntheticById.set(graded.A, priorSales);
    setNow(Date.parse("2026-09-25T12:00:00Z"));
    const corrected = await refresh(token, graded.A);
    assert.equal(corrected.status, 200);
    assert.deepEqual(corrected.body.valuation, original);
    console.log(
      "PASS concurrent/reordered duplicate, persisted time, conflicting same-ID and direct client write denial",
    );

    const count = sql(
      "select count(*) from public.position_price_observations",
    );
    sql(`revoke execute on function ${signature} from service_role`);
    const credits = budget(),
      transport = providerControl.calls;
    assert.equal((await refresh(token, graded.C)).status, 503);
    assert.equal(budget(), credits);
    assert.equal(providerControl.calls, transport);
    sql(`drop function ${signature}`);
    assert.equal(
      sql("select count(*) from public.position_price_observations"),
      count,
    );
    const source = execFileSync(
      "cat",
      [
        "docs/evidence/sol-client-06c/20260926030038_persist_verified_graded_valuation.sql",
      ],
      { encoding: "utf8" },
    );
    execFileSync("docker", dockerArgs, { input: source, encoding: "utf8" });
    sql("notify pgrst,'reload schema'");
    const reloadDeadline = Date.now() + 5000;
    while (
      (
        await admin.rpc(
          "persist_verified_graded_valuation",
          args(await row(graded.A), null, newSid),
        )
      ).error
    ) {
      assert.ok(Date.now() < reloadDeadline, "PostgREST schema readiness");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    console.log(
      "PASS disable/drop preserve records; local restore and schema readiness only",
    );
  } finally {
    providerControl.pause = null;
    providerControl.fail = false;
    for (const child of held) {
      child.stdin.end("rollback;\n\\q\n");
    }
    const cleanupDeadline = Date.now() + 5000;
    while (held.size) {
      assert.ok(Date.now() < cleanupDeadline, "held transaction cleanup");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(
      sql(
        "select count(*) from pg_stat_activity where state='idle in transaction'",
      ),
      "0",
    );
    sql(
      "drop trigger if exists client06c_barrier on public.position_price_observations;drop function if exists public.client06c_insert_barrier()",
    );
  }
}
