import test from "node:test";
import { createServer, request as httpRequest } from "node:http";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normalizeTcgdexCard } from "../lib/providers/tcgdex.js";
import { collectibleIdentitySnapshot } from "../lib/identity.js";
import {
  createPosition,
  loadActionCenter,
  loadCollectionOrganization,
  loadPortfolio,
  loadPortfolioValuationHistory,
  loadProfile,
  loadWatchlist,
  recordPortfolioValuationSnapshot,
  recordSale,
} from "../lib/supabase-data.js";
import { portfolioProfitLossHistory } from "../lib/portfolio.js";
import {
  createGradedValuationHandler,
  observationId,
} from "../api/graded-valuation.js";
import { exactSoldObservation } from "../lib/graded-valuation.js";

const atomic = process.env.MICA_CLIENT_06C_ATOMIC === "1";
const enabled = process.env.MICA_CLIENT_06_DISPOSABLE === "1";
const url = process.env.MICA_LOCAL_SUPABASE_URL;
const anonKey = process.env.MICA_LOCAL_SUPABASE_ANON_KEY;
const serviceKey = process.env.MICA_LOCAL_SUPABASE_SERVICE_KEY;
const projectId = process.env.MICA_CLIENT_06_PROJECT_ID;
const workdir = process.env.MICA_CLIENT_06_WORKDIR;
const dockerContext = process.env.MICA_CLIENT_06_DOCKER_CONTEXT;

function verifiedClient(key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        assert.equal(
          new URL(input instanceof Request ? input.url : input).origin,
          new URL(url).origin,
        );
        return fetch(input, { ...init, redirect: "error" });
      },
    },
  });
}

test(
  "CLIENT-06 owned disposable save, sale, duplicate snapshot, fresh reopen and account isolation",
  {
    skip: !enabled && "requires separately owned disposable CLIENT-06 database",
  },
  async () => {
    assert.ok(
      url && anonKey && serviceKey && projectId && workdir && dockerContext,
    );
    assert.match(projectId, /^mica-client-06[bc]?-[a-z0-9]+$/);
    assert.match(
      realpathSync(workdir),
      /^\/private\/tmp\/mica-client-06[bc]?-/,
    );
    assert.equal(new URL(url).hostname, "127.0.0.1");
    assert.notEqual(new URL(url).port, "54321");
    for (const name of [
      `supabase_db_${projectId}`,
      `supabase_kong_${projectId}`,
    ]) {
      const container = JSON.parse(
        execFileSync("docker", ["--context", dockerContext, "inspect", name], {
          encoding: "utf8",
        }),
      )[0];
      assert.equal(
        container.Config.Labels["com.supabase.cli.project"],
        projectId,
      );
      assert.equal(
        realpathSync(container.Config.Labels["com.supabase.cli.workdir"]),
        realpathSync(workdir),
      );
      if (name.includes("_db_"))
        assert.ok(
          container.Mounts.some((mount) => mount.Name?.includes(projectId)),
        );
      else
        assert.equal(
          container.HostConfig.PortBindings["8000/tcp"][0].HostPort,
          new URL(url).port,
        );
    }
    const atomicSupport = atomic
      ? await import("./graded-valuation-atomic.test-support.js")
      : null;
    const restoreTransport = atomic
      ? atomicSupport.installSyntheticTransport(new URL(url).origin)
      : () => {};
    const admin = verifiedClient(serviceKey);
    const users = [];
    let routeServer;
    const makeUser = async () => {
      const email = `mica-client-06-${randomUUID()}@example.invalid`;
      const password = `Mica-${randomUUID()}-9a!`;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ifError(created.error);
      users.push(created.data.user.id);
      const session = verifiedClient(anonKey);
      const signed = await session.auth.signInWithPassword({ email, password });
      assert.ifError(signed.error);
      return { id: created.data.user.id, email, password, session };
    };
    try {
      const owner = await makeUser();
      const other = await makeUser();
      const card = normalizeTcgdexCard(
        {
          id: "synthetic-06",
          localId: "6",
          name: "Synthetic",
          set: {
            id: "synthetic",
            name: "Synthetic Set",
            cardCount: { official: 100 },
          },
          variants_detailed: [
            {
              variantId: "plain",
              type: "holo",
              size: "standard",
              subtype: "unlimited",
              stamp: [],
            },
          ],
        },
        "en",
      );
      const identity = {
        ...collectibleIdentitySnapshot(card, card.variantOptions[0].id),
        acquisitionCostKnown: true,
        acquisitionDateKnown: true,
      };
      const specs = [
        ["A", "2026-09-01", 100],
        ["B", "2026-09-05", 200],
        ["C", "2026-09-20", 50],
      ];
      const ids = {};
      for (const [label, date, cost] of specs)
        ids[label] = await createPosition(owner.session, {
          identity,
          cardId: null,
          variantId: null,
          cardState: "raw",
          rawCondition: "near_mint",
          quantity: 1,
          transactionDate: date,
          unitPrice: cost,
          currency: "USD",
          idempotencyKey: `client-06-${randomUUID()}`,
          acquisitionMethod: "direct_purchase",
        });
      ids.D = await createPosition(owner.session, {
        identity,
        cardId: null,
        variantId: null,
        cardState: "graded",
        grader: "PSA",
        grade: "10",
        certificationNumber: `synthetic-06-D-${randomUUID()}`,
        quantity: 1,
        transactionDate: "2026-09-20",
        unitPrice: 10,
        currency: "USD",
        idempotencyKey: `client-06-${randomUUID()}`,
        acquisitionMethod: "direct_purchase",
      });
      await recordSale(owner.session, {
        collectionItemId: ids.B,
        cardState: "raw",
        transactionDate: "2026-09-15",
        quantity: 1,
        unitPrice: 300,
        marketplaceFees: 20,
        currency: "USD",
        idempotencyKey: `client-06-sale-${randomUUID()}`,
      });
      const raw = await owner.session
        .from("collection_items")
        .select("id,collectible_id,status,quantity")
        .in("id", Object.values(ids));
      assert.ifError(raw.error);
      assert.equal(raw.data.find((row) => row.id === ids.B).quantity, 0);
      const observations = [
        ["A", "2026-09-01", 120],
        ["A", "2026-09-10", 130],
        ["A", "2026-09-15", 140],
        ["A", "2026-09-20", 140],
        ["A", "2026-09-25", 150],
        ["B", "2026-09-05", 220],
        ["B", "2026-09-10", 250],
        ["C", "2026-09-20", 70],
        ["C", "2026-09-25", 70],
      ].map(([label, date, amount]) => ({
        user_id: owner.id,
        collection_item_id: ids[label],
        collectible_id: raw.data.find((row) => row.id === ids[label])
          .collectible_id,
        provider: "synthetic",
        provider_variant_id: "synthetic-06",
        currency: "USD",
        valuation_type: "market",
        finish: "holofoil",
        card_state: "raw",
        raw_condition: "near_mint",
        provider_condition: "Near Mint",
        grader: "",
        grade: null,
        grade_label: "",
        amount,
        observed_at: `${date}T12:00:00Z`,
      }));
      observations.push({
        user_id: owner.id,
        collection_item_id: ids.D,
        collectible_id: raw.data.find((row) => row.id === ids.D).collectible_id,
        provider: "synthetic",
        provider_variant_id: "synthetic-06",
        currency: "USD",
        valuation_type: "market",
        finish: "holofoil",
        card_state: "graded",
        raw_condition: "",
        provider_condition: null,
        grader: "PSA",
        grade: 10,
        grade_label: "10",
        amount: 900,
        observed_at: "2026-09-25T12:00:00Z",
      });
      const inserted = await admin
        .from("position_price_observations")
        .insert(observations);
      assert.ifError(inserted.error);
      const firstSnapshot = await recordPortfolioValuationSnapshot(
        owner.session,
        {
          total: 220,
          currency: "USD",
          pricedItems: 2,
          unpricedItems: 1,
          freshItems: 2,
        },
      );
      const duplicateSnapshot = await recordPortfolioValuationSnapshot(
        owner.session,
        {
          total: 220,
          currency: "USD",
          pricedItems: 2,
          unpricedItems: 1,
          freshItems: 2,
        },
      );
      assert.equal(duplicateSnapshot, firstSnapshot);
      const fresh = verifiedClient(anonKey);
      const signed = await fresh.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      });
      assert.ifError(signed.error);
      const reopened = await loadPortfolio(fresh, owner.id);
      const history = portfolioProfitLossHistory(
        reopened.map((item) => ({
          ...item,
          matchedHistory: item.priceHistory,
        })),
        "USD",
      );
      const latest = history.find((point) => point.date === "2026-09-25");
      assert.equal(latest.valueMinor, 22000);
      assert.equal(latest.unrealizedMinor, 7000);
      assert.equal(latest.realizedMinor, 8000);
      assert.equal(latest.missingUnits, 1);
      assert.equal(
        reopened.find((item) => item.uid === ids.D).priceHistory[0].amount,
        900,
      );
      assert.ok(
        reopened.find((item) => item.uid === ids.B).priceHistory.length >= 2,
      );
      const snapshots = await loadPortfolioValuationHistory(fresh, owner.id);
      assert.equal(
        snapshots.filter((row) => row.id === firstSnapshot).length,
        1,
      );
      assert.deepEqual(await loadPortfolio(other.session, other.id), []);
      assert.deepEqual(
        await loadPortfolioValuationHistory(other.session, other.id),
        [],
      );
      await Promise.all([
        loadCollectionOrganization(fresh, owner.id),
        loadProfile(fresh),
        loadWatchlist(fresh, owner.id),
        loadActionCenter(fresh, owner.id),
      ]);
      if (process.env.MICA_CLIENT_06_PREVIEW_URL) {
        const preview = new URL(process.env.MICA_CLIENT_06_PREVIEW_URL);
        assert.equal(preview.origin, "http://127.0.0.1:4189");
        const { chromium } = await import("playwright");
        const browser = await chromium.launch();
        try {
          const context = await browser.newContext({ serviceWorkers: "block" });
          const page = await context.newPage();
          const browserApi = "https://mica-client-06-test.supabase.co";
          await page.route("**/*", (route) => {
            const target = new URL(route.request().url());
            return [preview.origin, browserApi].includes(target.origin)
              ? route.fallback()
              : route.abort();
          });
          await page.route("**/api/**", (route) => route.abort());
          await page.route(`${browserApi}/**`, async (route) => {
            const request = new URL(route.request().url());
            const method = route.request().method();
            const headers = { ...route.request().headers() };
            delete headers.host;
            delete headers.origin;
            delete headers["content-length"];
            const response = await fetch(
              `${new URL(url).origin}${request.pathname}${request.search}`,
              {
                method,
                headers,
                body: ["GET", "HEAD"].includes(method)
                  ? undefined
                  : route.request().postDataBuffer(),
                redirect: "error",
              },
            );
            await route.fulfill({
              status: response.status,
              headers: {
                "content-type":
                  response.headers.get("content-type") || "application/json",
                "access-control-allow-origin": preview.origin,
                "access-control-allow-credentials": "true",
              },
              body: Buffer.from(await response.arrayBuffer()),
            });
          });
          await page.route("**/app-config.js*", (route) =>
            route.fulfill({
              contentType: "application/javascript",
              body: `globalThis.__APP_CONFIG__=${JSON.stringify({ supabaseUrl: browserApi, supabasePublishableKey: anonKey })};`,
            }),
          );
          await page.goto(preview.origin);
          await page.locator("#authEmail").fill(owner.email);
          await page.locator("#authPassword").fill(owner.password);
          await page.locator("#passwordSignIn").click();
          await page
            .locator("#onboardingDialog")
            .waitFor({ state: "visible", timeout: 20_000 });
          await page.locator("[data-skip-onboarding]").click();
          await page.locator("#onboardingDialog").waitFor({ state: "hidden" });
          await page
            .locator("#portfolioHistory")
            .getByText(/^\$70\.00 \(46\.7%\)$/)
            .waitFor({ timeout: 20_000 });
          assert.match(
            await page.locator("#portfolioHistory").innerText(),
            /Known realized P\/L[\s\S]*\$80\.00/i,
          );
          const evidence = new URL(
            "../docs/evidence/sol-client-06/local-db-reopen.png",
            import.meta.url,
          );
          await mkdir(
            new URL("../docs/evidence/sol-client-06/", import.meta.url),
            { recursive: true },
          );
          await page.screenshot({
            path: fileURLToPath(evidence),
            fullPage: true,
          });
          await context.close();
        } finally {
          await browser.close();
        }
      }

      // CLIENT-06B: the unapplied atomic RPC blocks the production write.
      // Independently validate existing storage/read/UI with server-computed
      // synthetic rows; this is not the final atomic production save proof.
      const exactIdentity = {
        providerCardId: `synthetic-06b-${randomUUID()}`,
        identityStatus: "exact",
        name: "Clefable",
        set: "Synthetic Jungle",
        number: "017/064",
        language: "en",
        variant: "Holofoil",
        finish: "holofoil",
        edition: "unlimited",
        promoType: "none",
        gradeQualifier: "",
        externalIds: { pkmnprices: "20618" },
        acquisitionCostKnown: true,
        acquisitionDateKnown: true,
      };
      const graded = {};
      for (const [label, date, cost, currency] of [
        ["A", "2026-09-01", 100, "USD"],
        ["B", "2026-09-05", 200, "USD"],
        ["C", "2026-09-20", 50, "USD"],
        ["EUR", "2026-09-20", 50, "EUR"],
      ]) {
        graded[label] = await createPosition(owner.session, {
          identity: {
            ...exactIdentity,
            providerCardId: `${exactIdentity.providerCardId}-${label}`,
          },
          cardState: "graded",
          grader: "PSA",
          grade: "10",
          certificationNumber: `synthetic-06b-${label}-${randomUUID()}`,
          quantity: 1,
          transactionDate: date,
          unitPrice: cost,
          currency,
          idempotencyKey: `client-06b-${randomUUID()}`,
          acquisitionMethod: "direct_purchase",
        });
      }
      const saleRows = (amounts, currency, offset) =>
        amounts.map((amount, index) => ({
          provider: "pkmnprices",
          providerSaleId: String(offset + index),
          source: "ebay",
          sourceUrl: `https://www.ebay.com/itm/${offset + index}`,
          attribution: "exact",
          evidenceKind: "completed_sale",
          gradingCompany: "PSA",
          grade: "10",
          gradeQualifier: "",
          printing: "Holofoil",
          language: "English",
          currency,
          amount,
          soldAt: "2026-09-20",
        }));
      const syntheticById = new Map([
        [graded.A, saleRows([130, 150, 170], "USD", 6100)],
        [graded.B, saleRows([230, 250, 270], "USD", 6200)],
        [graded.C, saleRows([50, 70, 90], "USD", 6300)],
        [graded.EUR, saleRows([90, 110, 130], "EUR", 6400)],
      ]);
      let valuationNow = Date.parse("2026-09-25T12:00:00Z");
      let providerCalls = 0;
      const handler = createGradedValuationHandler({
        createClientImpl: (_url, key) => {
          const client = verifiedClient(key),
            rpc = client.rpc.bind(client);
          client.rpc = async (...args) => {
            const result = await rpc(...args);
            if (atomic && result.error)
              console.log("RPC failure", result.error.message);
            return result;
          };
          return client;
        },
        environment: () => ({
          supabaseUrl: url,
          supabaseSecretKey: serviceKey,
          pkmnpricesApiKey: "synthetic-only",
          pkmnpricesPlan: "pro",
        }),
        now: () =>
          typeof valuationNow === "function" ? valuationNow() : valuationNow,
        fetchSales: async (_key, lookup, signal, options) => {
          providerCalls += 1;
          const match = Object.entries(graded).find(
            ([label]) =>
              lookup.clientId === `${exactIdentity.providerCardId}-${label}`,
          );
          assert.ok(match);
          if (atomic)
            return atomicSupport.syntheticAdapter(
              _key,
              lookup,
              signal,
              options,
              syntheticById.get(match[1]),
            );
          return {
            cardId: "20618",
            sales: syntheticById.get(match[1]),
            hasMore: false,
          };
        },
      });
      if (atomic) {
        routeServer = createServer(async (req, res) => {
          try {
            let json = "";
            for await (const chunk of req) json += chunk;
            req.body = JSON.parse(json || "{}");
            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
            res.json = (value) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(value));
              return res;
            };
            await handler(req, res);
          } catch (error) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
        await new Promise((resolve) =>
          routeServer.listen(0, "127.0.0.1", resolve),
        );
      }
      async function refresh(token, positionId, extras = {}) {
        if (atomic)
          return new Promise((resolve, reject) => {
            const request = httpRequest(
              {
                hostname: "127.0.0.1",
                port: routeServer.address().port,
                path: "/api/graded-valuation",
                method: "POST",
                headers: {
                  authorization: token ? `Bearer ${token}` : "",
                  "content-type": "application/json",
                },
              },
              (response) => {
                let body = "";
                response.on("data", (chunk) => (body += chunk));
                response.on("end", () =>
                  resolve({
                    status: response.statusCode,
                    body: JSON.parse(body),
                  }),
                );
              },
            );
            request.on("error", reject);
            request.end(JSON.stringify({ positionId, ...extras }));
          });
        let status, body;
        const response = {
          setHeader() {},
          status(code) {
            status = code;
            return response;
          },
          json(value) {
            body = value;
            return response;
          },
        };
        await handler(
          {
            method: "POST",
            headers: { authorization: `Bearer ${token}` },
            body: { positionId, ...extras },
          },
          response,
        );
        return { status, body };
      }
      let ownerToken = (await owner.session.auth.getSession()).data.session
        .access_token;
      const otherToken = (await other.session.auth.getSession()).data.session
        .access_token;
      const denied = await refresh(otherToken, graded.A, { amount: 999 });
      assert.equal(denied.status, 404);
      assert.equal(providerCalls, 0);
      const beforeBudget = await admin
        .from("provider_sync_status")
        .select("daily_credit_reserved")
        .eq("provider", "pkmnprices")
        .maybeSingle();
      assert.ifError(beforeBudget.error);
      if (atomic) {
        const { runAtomicChecks } =
          await import("./graded-valuation-atomic.test-support.js");
        await runAtomicChecks({
          admin,
          owner,
          other,
          graded,
          syntheticById,
          verifiedClient,
          refresh,
          ownerToken,
          otherToken,
          workdir,
          projectId,
          dockerContext,
          setNow: (value) => {
            valuationNow = value;
          },
        });
        ownerToken = owner.currentToken;
        for (const id of Object.values(graded)) {
          const written = await refresh(ownerToken, id, {
            amount: 999999,
            validated: true,
            ownerId: other.id,
            evidenceIds: ["forged"],
            sales: [{ amount: 999999, currency: "EUR" }],
          });
          assert.equal(written.status, 200, JSON.stringify(written.body));
        }
      } else {
        const blocked = await refresh(ownerToken, graded.A, {
          amount: 999,
          validated: true,
        });
        assert.equal(blocked.status, 503);
        assert.equal(blocked.body.code, "valuation_write_guard_unavailable");
        assert.equal(providerCalls, 0);
        const afterBudget = await admin
          .from("provider_sync_status")
          .select("daily_credit_reserved")
          .eq("provider", "pkmnprices")
          .maybeSingle();
        assert.ifError(afterBudget.error);
        assert.deepEqual(afterBudget.data, beforeBudget.data);
        const positions = await admin
          .from("collection_items")
          .select("*")
          .in("id", Object.values(graded));
        assert.ifError(positions.error);
        const computed = positions.data.map((position) => {
          const { result, row } = exactSoldObservation(
            position,
            {
              cardId: "20618",
              sales: syntheticById.get(position.id),
              hasMore: false,
            },
            "2026-09-25T12:00:00Z",
            Date.parse("2026-09-25T12:00:00Z"),
          );
          assert.equal(result.status, "ready");
          row.id = observationId(row);
          return row;
        });
        const storedComputed = await admin
          .from("position_price_observations")
          .upsert(computed, { onConflict: "id", ignoreDuplicates: true });
        assert.ifError(storedComputed.error);
        assert.ifError(
          (
            await admin
              .from("position_price_observations")
              .upsert(computed[0], { onConflict: "id", ignoreDuplicates: true })
          ).error,
        );
      }
      const stored = await admin
        .from("position_price_observations")
        .select("*")
        .in("collection_item_id", Object.values(graded))
        .contains("quality", { producer: "mica-server-exact-sold-v1" });
      assert.ifError(stored.error);
      assert.equal(stored.data.length, 4);
      assert.equal(
        Number(
          stored.data.find((row) => row.collection_item_id === graded.A).amount,
        ),
        150,
      );
      const forgedInsert = await owner.session
        .from("position_price_observations")
        .insert({ ...stored.data[0], id: randomUUID(), amount: 999 });
      assert.ok(
        forgedInsert.error,
        "authenticated browser cannot insert trusted price rows",
      );
      await recordSale(owner.session, {
        collectionItemId: graded.B,
        cardState: "graded",
        transactionDate: "2026-09-25",
        quantity: 1,
        unitPrice: 300,
        currency: "USD",
        idempotencyKey: `client-06b-sale-${randomUUID()}`,
      });
      if (atomic) assert.ifError((await owner.session.auth.signOut()).error);
      const reopenedGradedSession = verifiedClient(anonKey);
      assert.ifError(
        (
          await reopenedGradedSession.auth.signInWithPassword({
            email: owner.email,
            password: owner.password,
          })
        ).error,
      );
      const reopenedGraded = (
        await loadPortfolio(reopenedGradedSession, owner.id)
      ).filter((item) => Object.values(graded).includes(item.uid));
      assert.equal(reopenedGraded.length, 4);
      assert.deepEqual(
        reopenedGraded.map((item) => item.gradedValuations.length),
        [1, 1, 1, 1],
      );
      const gradedUsd = portfolioProfitLossHistory(
        reopenedGraded.map((item) => ({
          ...item,
          matchedHistory: item.gradedValuations.filter(
            (point) => point.contextValidated,
          ),
          soldValuation: item.gradedValuations[0]?.current,
        })),
        "USD",
      );
      const afterSale = gradedUsd.find((point) => point.date === "2026-09-25");
      assert.deepEqual(
        [
          afterSale.valueMinor,
          afterSale.unrealizedMinor,
          afterSale.realizedMinor,
        ],
        [22000, 7000, 10000],
      );
      const eurPoint = portfolioProfitLossHistory(
        reopenedGraded.map((item) => ({
          ...item,
          matchedHistory: item.gradedValuations,
        })),
        "EUR",
      ).find((point) => point.date === "2026-09-25");
      assert.equal(eurPoint.valueMinor, 11000);
      const otherRead = await other.session
        .from("position_price_observations")
        .select("id")
        .in("collection_item_id", Object.values(graded));
      assert.ifError(otherRead.error);
      assert.equal(otherRead.data.length, 0);
      if (process.env.MICA_CLIENT_06_PREVIEW_URL) {
        const preview = new URL(process.env.MICA_CLIENT_06_PREVIEW_URL);
        assert.equal(preview.origin, "http://127.0.0.1:4189");
        const { chromium, webkit, devices } = await import("playwright");
        for (const [label, engine, device] of [
          ["desktop-chromium", chromium, null],
          ["mobile-chromium", chromium, devices["Pixel 7"]],
          ["mobile-webkit", webkit, devices["iPhone 13"]],
        ]) {
          const browser = await engine.launch();
          try {
            const context = await browser.newContext({
              ...(device || {}),
              serviceWorkers: "block",
              reducedMotion: "reduce",
            });
            const page = await context.newPage();
            const durableRequests = [];
            page.on("request", (request) => {
              if (new URL(request.url()).pathname === "/api/graded-valuation")
                durableRequests.push(request.url());
            });
            const browserApi = "https://mica-client-06-test.supabase.co";
            await page.route("**/*", (route) => {
              const target = new URL(route.request().url());
              return [preview.origin, browserApi].includes(target.origin)
                ? route.fallback()
                : route.abort();
            });
            await page.route("**/api/**", (route) => route.abort());
            await page.route(`${browserApi}/**`, async (route) => {
              const request = new URL(route.request().url());
              const method = route.request().method();
              const headers = { ...route.request().headers() };
              delete headers.host;
              delete headers.origin;
              delete headers["content-length"];
              const response = await fetch(
                `${new URL(url).origin}${request.pathname}${request.search}`,
                {
                  method,
                  headers,
                  body: ["GET", "HEAD"].includes(method)
                    ? undefined
                    : route.request().postDataBuffer(),
                  redirect: "error",
                },
              );
              await route.fulfill({
                status: response.status,
                headers: {
                  "content-type":
                    response.headers.get("content-type") || "application/json",
                  "access-control-allow-origin": preview.origin,
                  "access-control-allow-credentials": "true",
                },
                body: Buffer.from(await response.arrayBuffer()),
              });
            });
            await page.route("**/app-config.js*", (route) =>
              route.fulfill({
                contentType: "application/javascript",
                body: `globalThis.__APP_CONFIG__=${JSON.stringify({ supabaseUrl: browserApi, supabasePublishableKey: anonKey })};`,
              }),
            );
            await page.goto(preview.origin);
            await page.locator("#authEmail").fill(owner.email);
            await page.locator("#authPassword").fill(owner.password);
            await page.locator("#passwordSignIn").click();
            await page
              .locator("#onboardingDialog")
              .waitFor({ state: "visible", timeout: 3_000 })
              .catch(() => {});
            if (await page.locator("#onboardingDialog").isVisible()) {
              await page.locator("[data-skip-onboarding]").click();
              await page
                .locator("#onboardingDialog")
                .waitFor({ state: "hidden" });
            }
            await page
              .locator("#portfolioHistory")
              .getByText(/^\$140\.00 \(.*%\)$/)
              .waitFor({ timeout: 8_000 })
              .catch(async () => {
                throw new Error(
                  `Fresh-login history: ${await page.locator("#portfolioHistory").innerText()}`,
                );
              });
            assert.match(
              await page.locator("#portfolioHistory").innerText(),
              /Known realized P\/L[\s\S]*\$180\.00/i,
            );
            await page
              .locator(
                "#portfolioHistory [data-portfolio-history-currency='EUR']",
              )
              .click();
            await page
              .locator("#portfolioHistory")
              .getByText(/^€60\.00 \(120\.0%\)$/)
              .waitFor({ timeout: 10_000 });
            const evidence = new URL(
              `../docs/evidence/sol-client-${atomic ? "06c" : "06b"}/${label}-fresh-login-eur.png`,
              import.meta.url,
            );
            await mkdir(
              new URL(
                `../docs/evidence/sol-client-${atomic ? "06c" : "06b"}/`,
                import.meta.url,
              ),
              { recursive: true },
            );
            await page.screenshot({
              path: fileURLToPath(evidence),
              fullPage: true,
            });
            await page
              .locator('[data-sidebar-target="collection"]:visible')
              .first()
              .click();
            await page.locator(`[data-open-position="${graded.A}"]`).click();
            await page.locator(".exact-sold-value > strong").waitFor();
            assert.equal(
              await page.locator(".exact-sold-value > strong").textContent(),
              "$150.00",
            );
            await page.locator("#recordedSoldValuations summary").click();
            await page
              .locator('[data-detail-tool="purchases"] > summary')
              .click();
            assert.match(
              await page.locator("#recordedSoldValuations").innerText(),
              /2026-09-25.*\$150\.00/,
            );
            assert.equal(await page.locator("#exactSaleEvidence a").count(), 3);
            assert.match(
              await page.locator(".position-summary").innerText(),
              /Current sold-derived estimate[\s\S]*\$150\.00/i,
            );
            if (atomic) {
              await page.locator("#exactSaleEvidence summary").click();
              await page.screenshot({
                path: fileURLToPath(
                  new URL(
                    `../docs/evidence/sol-client-06c/${label}-saved-detail.png`,
                    import.meta.url,
                  ),
                ),
                fullPage: true,
              });
            }
            if (atomic)
              await page.clock.setFixedTime(new Date("2026-11-01T12:00:00Z"));
            else
              await page.clock.install({
                time: new Date("2026-11-01T12:00:00Z"),
              });
            await page.locator("#detailBack").click();
            await page.locator(`[data-open-position="${graded.A}"]`).click();
            await page
              .locator(".exact-sold-value")
              .getByText(/Older completed sales/)
              .waitFor();
            assert.match(
              await page.locator(".position-summary").innerText(),
              /Current total value\s+Unavailable/i,
            );
            assert.equal(
              await page.locator("#recordedSoldValuations").count(),
              1,
            );
            if (atomic) {
              await page.locator(".exact-sold-value").scrollIntoViewIfNeeded();
              await page.screenshot({
                path: fileURLToPath(
                  new URL(
                    `../docs/evidence/sol-client-06c/${label}-stale-detail.png`,
                    import.meta.url,
                  ),
                ),
                fullPage: false,
              });
            }
            assert.equal(
              durableRequests.length,
              0,
              "fresh login/reopen never triggers a paid valuation refresh",
            );
            await context.close();
          } finally {
            await browser.close();
          }
        }
      }
      if (atomic)
        console.log(
          `PASS actual HTTP route + fresh-login browsers; ${atomicSupport.providerControl.calls} synthetic provider requests intercepted, zero external provider requests`,
        );
    } finally {
      if (routeServer)
        await new Promise((resolve) => routeServer.close(resolve));
      restoreTransport();
      for (const id of users) {
        const deleted = await admin.auth.admin.deleteUser(id);
        assert.ifError(deleted.error);
      }
    }
  },
);
