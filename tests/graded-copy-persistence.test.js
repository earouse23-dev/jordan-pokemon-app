import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function localDatabaseConfig() {
  const url = process.env.MICA_LOCAL_SUPABASE_URL;
  const anonKey = process.env.MICA_LOCAL_SUPABASE_ANON_KEY;
  const serviceKey = process.env.MICA_LOCAL_SUPABASE_SERVICE_KEY;
  if (!url || !anonKey || !serviceKey) return null;
  const parsed = new URL(url);
  assert.ok(
    ["127.0.0.1", "localhost"].includes(parsed.hostname) &&
      parsed.port === "54321",
    "Graded-copy persistence tests only run against local Supabase on port 54321.",
  );
  return { url, anonKey, serviceKey };
}

const local = localDatabaseConfig();

function identity(run, suffix) {
  return {
    name: "Pikachu",
    set: "Celebrations",
    number: "005/025",
    language: "en",
    variant: "Holofoil",
    providerCardId: `client-03-${run}-${suffix}`,
    externalIds: {},
    gradeClaimSource: "official",
  };
}

function gradedCreate(run, suffix, idempotencyKey, certificate = null) {
  return {
    p_identity: identity(run, suffix),
    p_card_id: null,
    p_variant_id: null,
    p_card_state: "graded",
    p_raw_condition: null,
    p_grader: "PSA",
    p_grade: 10,
    p_certification_number: certificate,
    p_quantity: 1,
    p_transaction_date: "2026-09-18",
    p_unit_price: 25,
    p_tax: 0,
    p_shipping: 0,
    p_marketplace_fees: 0,
    p_grading_fees: 0,
    p_other_costs: 0,
    p_currency: "USD",
    p_marketplace: null,
    p_notes: null,
    p_idempotency_key: idempotencyKey,
    p_acquisition_method: "direct_purchase",
  };
}

async function createSyntheticUser(admin, url, anonKey, run, label) {
  const email = `mica-client-03-${run}-${label}@example.invalid`;
  const password = `Mica-${randomUUID()}-9a!`;
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
  assert.ifError(createError);
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  assert.ifError(signInError);
  return { id: created.user.id, client, email, password };
}

async function signInSyntheticUser(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return client;
}

test(
  "local database enforces graded-copy concurrency, provenance, and ownership",
  { skip: !local && "isolated local Supabase is not configured" },
  async () => {
    const run = randomUUID();
    const admin = createClient(local.url, local.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const users = [];
    try {
      const owner = await createSyntheticUser(
        admin,
        local.url,
        local.anonKey,
        run,
        "owner",
      );
      const other = await createSyntheticUser(
        admin,
        local.url,
        local.anonKey,
        run,
        "other",
      );
      users.push(owner.id, other.id);

      const copyDefinitions = [
        {
          label: "A",
          certificate: `copy-a-${run}`,
          date: "2026-01-01",
          cost: 10,
        },
        {
          label: "B",
          certificate: `copy-b-${run}`,
          date: "2026-02-02",
          cost: 20,
        },
        {
          label: "C",
          certificate: `copy-c-${run}`,
          date: "2026-03-03",
          cost: 30,
        },
      ];
      const physicalCopies = new Map();
      for (const copy of copyDefinitions) {
        const { data, error } = await owner.client.rpc(
          "create_graded_copy_position",
          {
            ...gradedCreate(
              run,
              "copies-abc",
              `client-03-${run}-copy-${copy.label}`,
              copy.certificate,
            ),
            p_transaction_date: copy.date,
            p_unit_price: copy.cost,
          },
        );
        assert.ifError(error);
        physicalCopies.set(copy.label, data);
      }

      const resumedOwner = await signInSyntheticUser(
        local.url,
        local.anonKey,
        owner.email,
        owner.password,
      );
      const copyIds = [...physicalCopies.values()];
      const { data: reopenedCopies, error: reopenError } = await resumedOwner
        .from("collection_items")
        .select("id,certification_number,quantity,status,currency")
        .in("id", copyIds);
      assert.ifError(reopenError);
      assert.equal(reopenedCopies.length, 3);
      const { data: reopenedPurchases, error: purchaseError } =
        await resumedOwner
          .from("collection_transactions")
          .select(
            "collection_item_id,transaction_type,transaction_date,total_cost,currency",
          )
          .in("collection_item_id", copyIds)
          .eq("transaction_type", "purchase");
      assert.ifError(purchaseError);
      assert.equal(reopenedPurchases.length, 3);
      for (const copy of copyDefinitions) {
        const id = physicalCopies.get(copy.label);
        const item = reopenedCopies.find((row) => row.id === id);
        const purchase = reopenedPurchases.find(
          (row) => row.collection_item_id === id,
        );
        assert.equal(item.certification_number, copy.certificate);
        assert.equal(item.quantity, 1);
        assert.equal(item.status, "owned");
        assert.equal(item.currency, "USD");
        assert.equal(purchase.transaction_date, copy.date);
        assert.equal(Number(purchase.total_cost), copy.cost);
      }

      const copyB = physicalCopies.get("B");
      const { error: selectedSaleError } = await resumedOwner.rpc(
        "record_graded_copy_sale",
        {
          p_collection_item_id: copyB,
          p_transaction_date: "2026-04-04",
          p_quantity: 1,
          p_unit_price: 75,
          p_marketplace_fees: 5,
          p_shipping: 0,
          p_other_costs: 0,
          p_currency: "USD",
          p_marketplace: null,
          p_notes: null,
          p_idempotency_key: `client-03-${run}-copy-b-sale`,
        },
      );
      assert.ifError(selectedSaleError);
      const reopenedAfterSale = await signInSyntheticUser(
        local.url,
        local.anonKey,
        owner.email,
        owner.password,
      );
      const { data: afterSale, error: afterSaleError } = await reopenedAfterSale
        .from("collection_items")
        .select("id,certification_number,quantity,status")
        .in("id", copyIds);
      assert.ifError(afterSaleError);
      const byId = new Map(afterSale.map((row) => [row.id, row]));
      assert.deepEqual(
        ["A", "C"].map((label) => ({
          quantity: byId.get(physicalCopies.get(label)).quantity,
          status: byId.get(physicalCopies.get(label)).status,
        })),
        [
          { quantity: 1, status: "owned" },
          { quantity: 1, status: "owned" },
        ],
      );
      assert.equal(byId.get(copyB).quantity, 0);
      assert.equal(byId.get(copyB).status, "sold");
      const { data: copyBHistory, error: copyBHistoryError } =
        await reopenedAfterSale
          .from("collection_transactions")
          .select("transaction_type,transaction_date,total_cost,net_proceeds")
          .eq("collection_item_id", copyB)
          .order("transaction_date");
      assert.ifError(copyBHistoryError);
      assert.deepEqual(
        copyBHistory.map((row) => row.transaction_type),
        ["purchase", "sale"],
      );
      assert.equal(Number(copyBHistory[0].total_cost), 20);
      assert.equal(Number(copyBHistory[1].net_proceeds), 70);

      const unknownRequest = gradedCreate(
        run,
        "unknown-facts",
        `client-03-${run}-unknown-facts`,
        `unknown-${run}`,
      );
      unknownRequest.p_identity = {
        ...unknownRequest.p_identity,
        acquisitionCostKnown: false,
        acquisitionDateKnown: false,
      };
      unknownRequest.p_transaction_date = null;
      unknownRequest.p_unit_price = 0;
      const { data: unknownId, error: unknownError } = await owner.client.rpc(
        "create_graded_copy_position",
        unknownRequest,
      );
      assert.ifError(unknownError);

      const zeroRequest = gradedCreate(
        run,
        "known-zero",
        `client-03-${run}-known-zero`,
        `zero-${run}`,
      );
      zeroRequest.p_unit_price = 0;
      const { data: zeroId, error: zeroError } = await owner.client.rpc(
        "create_graded_copy_position",
        zeroRequest,
      );
      assert.ifError(zeroError);

      const { data: factLots, error: factLotsError } = await owner.client
        .from("purchase_lots")
        .select(
          "collection_item_id,total_cost,cost_basis_known,acquired_at_known,currency",
        )
        .in("collection_item_id", [unknownId, zeroId]);
      assert.ifError(factLotsError);
      const unknownLot = factLots.find(
        (row) => row.collection_item_id === unknownId,
      );
      const zeroLot = factLots.find((row) => row.collection_item_id === zeroId);
      assert.equal(unknownLot.cost_basis_known, false);
      assert.equal(unknownLot.acquired_at_known, false);
      assert.equal(Number(unknownLot.total_cost), 0);
      assert.equal(zeroLot.cost_basis_known, true);
      assert.equal(zeroLot.acquired_at_known, true);
      assert.equal(Number(zeroLot.total_cost), 0);
      const { data: factSummaries, error: factSummaryError } =
        await owner.client
          .from("portfolio_position_summary")
          .select("id,remaining_cost_basis")
          .in("id", [unknownId, zeroId]);
      assert.ifError(factSummaryError);
      assert.equal(
        factSummaries.find((row) => row.id === unknownId).remaining_cost_basis,
        null,
      );
      assert.equal(
        Number(
          factSummaries.find((row) => row.id === zeroId).remaining_cost_basis,
        ),
        0,
      );

      const eurRequest = gradedCreate(
        run,
        "eur-copy",
        `client-03-${run}-eur-copy`,
        `eur-${run}`,
      );
      eurRequest.p_currency = "EUR";
      const { data: eurId, error: eurError } = await owner.client.rpc(
        "create_graded_copy_position",
        eurRequest,
      );
      assert.ifError(eurError);
      const { error: currencyError } = await owner.client.rpc(
        "record_graded_copy_sale",
        {
          p_collection_item_id: eurId,
          p_transaction_date: "2026-09-19",
          p_quantity: 1,
          p_unit_price: 100,
          p_marketplace_fees: 0,
          p_shipping: 0,
          p_other_costs: 0,
          p_currency: "USD",
          p_marketplace: null,
          p_notes: null,
          p_idempotency_key: `client-03-${run}-eur-sale`,
        },
      );
      assert.match(currencyError?.message || "", /currency_mismatch/);
      const { data: eurCopy, error: eurReadError } = await owner.client
        .from("collection_items")
        .select("quantity,status,currency")
        .eq("id", eurId)
        .single();
      assert.ifError(eurReadError);
      assert.deepEqual(eurCopy, {
        quantity: 1,
        status: "owned",
        currency: "EUR",
      });

      const noCertKey = `client-03-${run}-no-cert`;
      const noCertRequest = gradedCreate(run, "no-cert", noCertKey, null);
      const noCertResults = await Promise.all([
        owner.client.rpc("create_graded_copy_position", noCertRequest),
        owner.client.rpc("create_graded_copy_position", noCertRequest),
      ]);
      for (const result of noCertResults) assert.ifError(result.error);
      assert.equal(noCertResults[0].data, noCertResults[1].data);

      const retryCert = `retry-${run}`;
      const retryRequest = gradedCreate(
        run,
        "same-cert-retry",
        `client-03-${run}-same-cert-retry`,
        retryCert,
      );
      const retryResults = await Promise.all([
        owner.client.rpc("create_graded_copy_position", retryRequest),
        owner.client.rpc("create_graded_copy_position", retryRequest),
      ]);
      for (const result of retryResults) assert.ifError(result.error);
      assert.equal(retryResults[0].data, retryResults[1].data);

      const competingCert = `competing-${run}`;
      const competingResults = await Promise.all([
        owner.client.rpc(
          "create_graded_copy_position",
          gradedCreate(
            run,
            "competing-a",
            `client-03-${run}-competing-a`,
            competingCert,
          ),
        ),
        owner.client.rpc(
          "create_graded_copy_position",
          gradedCreate(
            run,
            "competing-b",
            `client-03-${run}-competing-b`,
            competingCert,
          ),
        ),
      ]);
      const competingSuccesses = competingResults.filter(
        (result) => !result.error,
      );
      const competingFailures = competingResults.filter(
        (result) => result.error,
      );
      assert.equal(competingSuccesses.length, 1);
      assert.equal(competingFailures.length, 1);
      assert.match(
        competingFailures[0].error.message,
        /duplicate_active_certificate:/,
      );

      const soldCopyId = retryResults[0].data;
      const sale = (key) =>
        owner.client.rpc("record_graded_copy_sale", {
          p_collection_item_id: soldCopyId,
          p_transaction_date: "2026-09-19",
          p_quantity: 1,
          p_unit_price: 100,
          p_marketplace_fees: 5,
          p_shipping: 0,
          p_other_costs: 0,
          p_currency: "USD",
          p_marketplace: null,
          p_notes: null,
          p_idempotency_key: key,
        });
      const saleResults = await Promise.all([
        sale(`client-03-${run}-sale-a`),
        sale(`client-03-${run}-sale-b`),
      ]);
      const saleSuccesses = saleResults.filter((result) => !result.error);
      const saleFailures = saleResults.filter((result) => result.error);
      const saleDiagnostics = saleResults.map((result) => ({
        code: result.error?.code || null,
        message: result.error?.message || null,
      }));
      assert.equal(saleSuccesses.length, 1, JSON.stringify(saleDiagnostics));
      assert.equal(saleFailures.length, 1);
      assert.match(
        saleFailures[0].error.message,
        /graded_copy_sale_unavailable/,
      );
      const winningSaleKey = saleResults[0].error
        ? `client-03-${run}-sale-b`
        : `client-03-${run}-sale-a`;
      const saleRetry = await sale(winningSaleKey);
      assert.ifError(saleRetry.error);
      assert.equal(saleRetry.data, saleSuccesses[0].data);

      const copyId = noCertResults[0].data;
      const { data: createdCopy, error: readError } = await owner.client
        .from("collection_items")
        .select("identity_snapshot,certification_number")
        .eq("id", copyId)
        .single();
      assert.ifError(readError);
      assert.equal(createdCopy.identity_snapshot.gradeClaimSource, "user");

      const { data: correctedCopy, error: correctionError } = await owner.client
        .from("collection_items")
        .update({
          certification_number: `corrected-${run}`,
          identity_snapshot: {
            ...createdCopy.identity_snapshot,
            gradeClaimSource: "official",
          },
        })
        .eq("id", copyId)
        .select("identity_snapshot")
        .single();
      assert.ifError(correctionError);
      assert.equal(correctedCopy.identity_snapshot.gradeClaimSource, "user");

      const genericKey = `client-03-${run}-generic`;
      const genericInput = gradedCreate(
        run,
        "generic",
        genericKey,
        `generic-${run}`,
      );
      const { data: genericId, error: genericError } = await owner.client.rpc(
        "create_collection_position",
        genericInput,
      );
      assert.ifError(genericError);
      const { data: genericCopy, error: genericReadError } = await owner.client
        .from("collection_items")
        .select("identity_snapshot")
        .eq("id", genericId)
        .single();
      assert.ifError(genericReadError);
      assert.equal(genericCopy.identity_snapshot.gradeClaimSource, "user");

      const rawIdentity = identity(run, "grading-return");
      delete rawIdentity.gradeClaimSource;
      const { data: rawId, error: rawError } = await owner.client.rpc(
        "create_collection_position",
        {
          ...gradedCreate(
            run,
            "grading-return",
            `client-03-${run}-grading-return-create`,
          ),
          p_identity: rawIdentity,
          p_card_state: "raw",
          p_raw_condition: "near_mint",
          p_grader: null,
          p_grade: null,
          p_certification_number: null,
        },
      );
      assert.ifError(rawError);
      const { error: gradingReturnError } = await owner.client.rpc(
        "record_grading_result",
        {
          p_collection_item_id: rawId,
          p_transaction_date: "2026-09-19",
          p_grader: "BGS",
          p_grade: 9.5,
          p_total_grading_cost: 20,
          p_certification_number: `return-${run}`,
          p_notes: null,
          p_idempotency_key: `client-03-${run}-grading-return`,
        },
      );
      assert.ifError(gradingReturnError);
      const { data: returnedCopy, error: returnedReadError } =
        await owner.client
          .from("collection_items")
          .select("identity_snapshot")
          .eq("id", rawId)
          .single();
      assert.ifError(returnedReadError);
      assert.equal(returnedCopy.identity_snapshot.gradeClaimSource, "user");

      const { data: hidden, error: hiddenError } = await other.client
        .from("collection_items")
        .select("id")
        .eq("id", copyId);
      assert.ifError(hiddenError);
      assert.deepEqual(hidden, []);

      const { data: changed, error: changeError } = await other.client
        .from("collection_items")
        .update({ certification_number: `stolen-${run}` })
        .eq("id", copyId)
        .select("id");
      assert.ifError(changeError);
      assert.deepEqual(changed, []);

      const { error: transactionError } = await other.client
        .from("collection_transactions")
        .insert({
          user_id: other.id,
          collection_item_id: copyId,
          transaction_type: "adjustment",
          transaction_date: "2026-09-19",
          quantity: 1,
          currency: "USD",
          idempotency_key: `client-03-${run}-foreign-transaction`,
        });
      assert.ok(transactionError);

      const { error: saleError } = await other.client.rpc(
        "record_graded_copy_sale",
        {
          p_collection_item_id: copyId,
          p_transaction_date: "2026-09-19",
          p_quantity: 1,
          p_unit_price: 100,
          p_marketplace_fees: 0,
          p_shipping: 0,
          p_other_costs: 0,
          p_currency: "USD",
          p_marketplace: null,
          p_notes: null,
          p_idempotency_key: `client-03-${run}-foreign-sale`,
        },
      );
      assert.match(saleError?.message || "", /copy_not_found/);
    } finally {
      await Promise.all(users.map((id) => admin.auth.admin.deleteUser(id)));
    }
  },
);
