import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeTcgdexCard } from "../lib/providers/tcgdex.js";
import {
  collectibleIdentitySnapshot,
  selectVariantOption,
} from "../lib/identity.js";
import { createPosition, loadPortfolio } from "../lib/supabase-data.js";
import { exactSoldValuation } from "../lib/pricing.js";

const frozenSource = JSON.stringify({
  id: "synthetic-25",
  localId: "25",
  name: "Pikachu",
  set: {
    id: "synthetic",
    name: "Synthetic Violet",
    cardCount: { official: 100 },
  },
  variants: { holo: true, firstEdition: true },
  variants_detailed: [
    {
      variantId: "plain",
      type: "holo",
      size: "standard",
      subtype: "unlimited",
      stamp: [],
    },
    {
      variantId: "first",
      type: "holo",
      size: "standard",
      stamp: ["1st-edition"],
    },
    { variantId: "unknown", type: "holo", size: "standard" },
    {
      variantId: "restricted",
      type: "holo",
      size: "standard",
      subtype: "unlimited",
      stamp: [],
      languages: ["ja"],
      foil: "masterball",
    },
  ],
});
const ids = ["plain", "first", "unknown", "restricted"];
const localUrl = process.env.MICA_LOCAL_SUPABASE_URL;
const anonKey = process.env.MICA_LOCAL_SUPABASE_ANON_KEY;
const serviceKey = process.env.MICA_LOCAL_SUPABASE_SERVICE_KEY;
const projectId = process.env.MICA_CLIENT_05I_PROJECT_ID;
const workdir = process.env.MICA_CLIENT_05I_WORKDIR;
const dockerContext = process.env.MICA_CLIENT_05I_DOCKER_CONTEXT;
const enabled = process.env.MICA_CLIENT_05I_DISPOSABLE === "1";
if (enabled) {
  assert.ok(
    localUrl && anonKey && serviceKey && projectId && workdir && dockerContext,
    "CLIENT-05I disposable ownership and credentials must be complete",
  );
  const url = new URL(localUrl);
  assert.ok(
    url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      Number(url.port) > 1024 &&
      url.port !== "54321" &&
      /^mica-client-05i-[a-z0-9]{6,}$/.test(projectId) &&
      realpathSync(workdir).startsWith("/private/tmp/mica-client-05i-") &&
      Boolean(dockerContext),
    "CLIENT-05I requires its own disposable project and loopback endpoint",
  );
  const inspect = (name) =>
    JSON.parse(
      execFileSync("docker", ["--context", dockerContext, "inspect", name], {
        encoding: "utf8",
      }),
    )[0];
  const database = inspect(`supabase_db_${projectId}`);
  const gateway = inspect(`supabase_kong_${projectId}`);
  for (const container of [database, gateway]) {
    assert.equal(
      container.Config.Labels["com.supabase.cli.project"],
      projectId,
    );
    assert.equal(
      realpathSync(container.Config.Labels["com.supabase.cli.workdir"]),
      realpathSync(workdir),
    );
  }
  assert.equal(
    gateway.HostConfig.PortBindings["8000/tcp"][0].HostPort,
    url.port,
  );
  assert.ok(database.Mounts.some((mount) => mount.Name?.includes(projectId)));
}
const localFetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input);
  assert.ok(
    url.origin === new URL(localUrl).origin,
    "External request blocked",
  );
  return fetch(input, { ...init, redirect: "error" });
};
const client = (key) =>
  createClient(localUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: localFetch },
  });

test("CLIENT-05I save adapter keeps the source reference out of the UUID argument", async () => {
  const catalog = normalizeTcgdexCard(JSON.parse(frozenSource), "en");
  const identity = collectibleIdentitySnapshot(
    catalog,
    catalog.variantOptions[0].id,
  );
  let call;
  const fake = {
    async rpc(name, args) {
      call = { name, args };
      return { data: "synthetic-copy", error: null };
    },
  };
  const result = await createPosition(fake, {
    identity,
    cardId: null,
    variantId: null,
    cardState: "graded",
    grader: "PSA",
    grade: "10",
    certificationNumber: "synthetic-cert",
    quantity: 1,
    transactionDate: "2026-09-20",
    unitPrice: 10,
    currency: "USD",
    idempotencyKey: "synthetic-retry",
  });
  assert.equal(result, "synthetic-copy");
  assert.equal(call.name, "create_graded_copy_position");
  assert.equal(call.args.p_variant_id, null);
  assert.equal(call.args.p_identity.variantId, catalog.variantOptions[0].id);
  assert.deepEqual(call.args.p_identity.variantMetadata.stamp, []);
});

test(
  "CLIENT-05I persists source printing through owner RPC and fresh load",
  { skip: !enabled && "owned disposable CLIENT-05I stack is not configured" },
  async () => {
    const run = randomUUID();
    const admin = client(serviceKey);
    const users = [];
    const makeUser = async (label) => {
      const email = `mica-client-05i-${run}-${label}@example.invalid`;
      const password = `Mica-${randomUUID()}-9a!`;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ifError(created.error);
      users.push(created.data.user.id);
      const session = client(anonKey);
      const signed = await session.auth.signInWithPassword({ email, password });
      assert.ifError(signed.error);
      return { id: created.data.user.id, email, password, session };
    };
    try {
      const owner = await makeUser("owner");
      const other = await makeUser("other");
      let catalog = normalizeTcgdexCard(JSON.parse(frozenSource), "en");
      let snapshots = ids.map((sourceId) => ({
        ...collectibleIdentitySnapshot(
          catalog,
          `tcgdex:en:synthetic-25:variant:${sourceId}`,
        ),
        gradeClaimSource: "user",
        acquisitionCostKnown: true,
        acquisitionDateKnown: true,
      }));
      assert.deepEqual(
        snapshots.map((row) => row.identityStatus),
        ["exact", "exact", "needs_review", "needs_review"],
      );
      const saved = [];
      for (let index = 0; index < ids.length; index += 1) {
        const idempotencyKey = `client-05i-${run}-${ids[index]}`;
        const input = {
          identity: snapshots[index],
          cardId: null,
          variantId: null,
          cardState: "graded",
          grader: "PSA",
          grade: "10",
          certificationNumber: `05i-${run}-${ids[index]}`,
          quantity: 1,
          transactionDate: "2026-09-20",
          unitPrice: 10 + index,
          currency: "USD",
          idempotencyKey,
          acquisitionMethod: "direct_purchase",
        };
        const copyId = await createPosition(owner.session, input);
        saved.push({
          sourceId: ids[index],
          copyId,
          certificate: input.certificationNumber,
          cost: input.unitPrice,
        });
        if (index === 0)
          assert.equal(await createPosition(owner.session, input), copyId);
      }
      const raw = await owner.session
        .from("collection_items")
        .select(
          "id,variant_id,identity_snapshot,certification_number,quantity,status",
        )
        .in(
          "id",
          saved.map((row) => row.copyId),
        );
      assert.ifError(raw.error);
      assert.equal(raw.data.length, 4);
      for (const expected of saved) {
        const row = raw.data.find((item) => item.id === expected.copyId);
        assert.equal(row.variant_id, null);
        assert.equal(
          row.identity_snapshot.variantId,
          `tcgdex:en:synthetic-25:variant:${expected.sourceId}`,
        );
        assert.equal(
          row.identity_snapshot.variantMetadata.sourceVariantId,
          expected.sourceId,
        );
        assert.equal(row.identity_snapshot.externalIds.tcgdex, "synthetic-25");
        assert.equal(row.certification_number, expected.certificate);
        assert.equal(row.quantity, 1);
        assert.equal(row.status, "owned");
      }
      assert.deepEqual(
        raw.data.find(
          (row) =>
            row.identity_snapshot.variantMetadata.sourceVariantId === "plain",
        ).identity_snapshot.variantMetadata.stamp,
        [],
      );
      assert.equal(
        raw.data.find(
          (row) =>
            row.identity_snapshot.variantMetadata.sourceVariantId === "unknown",
        ).identity_snapshot.variantMetadata.stampPresent,
        false,
      );
      assert.deepEqual(
        raw.data.find(
          (row) =>
            row.identity_snapshot.variantMetadata.sourceVariantId ===
            "restricted",
        ).identity_snapshot.variantMetadata.languages,
        ["ja"],
      );
      assert.equal(
        raw.data.find(
          (row) =>
            row.identity_snapshot.variantMetadata.sourceVariantId ===
            "restricted",
        ).identity_snapshot.variantMetadata.foil,
        "masterball",
      );

      await owner.session.auth.signOut();
      owner.session = null;
      catalog = null;
      snapshots = null;
      const fresh = client(anonKey);
      assert.ifError(
        (
          await fresh.auth.signInWithPassword({
            email: owner.email,
            password: owner.password,
          })
        ).error,
      );
      const loaded = await loadPortfolio(fresh, owner.id);
      const copies = saved.map((row) =>
        loaded.find((item) => item.uid === row.copyId),
      );
      assert.ok(copies.every(Boolean));
      for (let index = 0; index < copies.length; index += 1) {
        assert.equal(
          copies[index].variantId,
          `tcgdex:en:synthetic-25:variant:${ids[index]}`,
        );
        assert.equal(copies[index].variantMetadata.sourceVariantId, ids[index]);
        assert.equal(
          copies[index].certificationNumber,
          saved[index].certificate,
        );
        assert.equal(copies[index].costBasis, saved[index].cost);
        assert.equal(
          copies[index].transactions.filter((row) => row.type === "purchase")
            .length,
          1,
        );
      }
      const reordered = normalizeTcgdexCard(
        {
          ...JSON.parse(frozenSource),
          variants_detailed:
            JSON.parse(frozenSource).variants_detailed.reverse(),
        },
        "en",
      );
      assert.equal(
        selectVariantOption(
          { ...copies[0], variantOptions: reordered.variantOptions },
          copies[0].variantId,
        ).metadata.sourceVariantId,
        "plain",
      );
      const removed = normalizeTcgdexCard(
        {
          ...JSON.parse(frozenSource),
          variants_detailed: JSON.parse(frozenSource).variants_detailed.filter(
            (row) => row.variantId !== "plain",
          ),
        },
        "en",
      );
      const unavailable = selectVariantOption(
        { ...copies[0], variantOptions: removed.variantOptions },
        copies[0].variantId,
      );
      assert.equal(unavailable.id, copies[0].variantId);
      assert.equal(unavailable.status, "needs_review");
      for (const item of copies.slice(2)) {
        assert.equal(item.identityStatus, "needs_review");
        assert.equal(
          exactSoldValuation([], {
            ...item,
            canonicalId: item.id,
            grader: "PSA",
            qualifier: "",
            currency: "USD",
          }).status,
          "unresolved_context",
        );
      }
      const hidden = await other.session
        .from("collection_items")
        .select("id")
        .in(
          "id",
          saved.map((row) => row.copyId),
        );
      assert.ifError(hidden.error);
      assert.deepEqual(hidden.data, []);
      const denied = await other.session
        .from("collection_items")
        .update({ certification_number: `stolen-${run}` })
        .eq("id", saved[0].copyId)
        .select("id");
      assert.ok(denied.error || denied.data.length === 0);
      const anonymousClient = client(anonKey);
      const anonymous = await anonymousClient
        .from("collection_items")
        .select("id")
        .in(
          "id",
          saved.map((row) => row.copyId),
        );
      assert.ok(anonymous.error || anonymous.data.length === 0);
      const anonymousUpdate = await anonymousClient
        .from("collection_items")
        .update({ certification_number: `anonymous-${run}` })
        .eq("id", saved[0].copyId)
        .select("id");
      assert.ok(anonymousUpdate.error || anonymousUpdate.data.length === 0);
      assert.equal(
        selectVariantOption(copies[0], copies[0].variantId).status,
        "exact",
      );
      const ownerAfterDenials = await fresh
        .from("collection_items")
        .select("id,certification_number,identity_snapshot")
        .in(
          "id",
          saved.map((row) => row.copyId),
        );
      assert.ifError(ownerAfterDenials.error);
      assert.equal(ownerAfterDenials.data.length, saved.length);
      for (const expected of saved) {
        const row = ownerAfterDenials.data.find(
          (item) => item.id === expected.copyId,
        );
        assert.equal(row.certification_number, expected.certificate);
        assert.equal(
          row.identity_snapshot.variantMetadata.sourceVariantId,
          expected.sourceId,
        );
      }
      assert.ifError((await fresh.auth.signOut()).error);
      assert.ifError((await other.session.auth.signOut()).error);
    } finally {
      for (const id of users) {
        const deleted = await admin.auth.admin.deleteUser(id);
        assert.ifError(deleted.error);
      }
    }
  },
);
