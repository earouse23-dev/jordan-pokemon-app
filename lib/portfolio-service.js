import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { serverEnvironment } from "./env.js";
import { loadPortfolio } from "./supabase-data.js";
import {
  buildPortfolioView,
  portfolioPricingKey,
  portfolioCondition,
} from "./portfolio-view.js";
import {
  fetchPkmnPricesLookup,
  normalizePkmnPricesCard,
  fetchPkmnPricesSales,
  fetchPkmnPricesSealedProduct,
} from "./providers/pkmnprices.js";
import {
  selectReferenceQuote,
  mergePriceHistory,
  latestEbaySoldValuation,
  priceFreshness,
} from "./pricing.js";
import { selectVariantOption } from "./identity.js";

const checked = (result) => {
  if (result.error) throw result.error;
  return result.data;
};
const database = (config) =>
  createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
function lookupFor(item) {
  return {
    clientId: item.id,
    pkmnpricesId: item.externalIds?.pkmnprices,
    name: item.name,
    set: item.set,
    number: item.number,
    language: item.language || "en",
    variant: item.variant,
    condition: portfolioCondition(item),
    currency: item.currency,
  };
}
export async function refreshPortfolioView(
  db,
  owner,
  config,
  { signal = AbortSignal.timeout(48_000), now = new Date().toISOString() } = {},
) {
  const token = randomUUID();
  if (
    !checked(
      await db.rpc("claim_portfolio_refresh", {
        p_user_id: owner,
        p_token: token,
      }),
    )
  )
    return checked(
      await db
        .from("portfolio_views")
        .select("view")
        .eq("user_id", owner)
        .single(),
    )?.view;
  try {
    const saved = checked(
      await db
        .from("portfolio_views")
        .select("view")
        .eq("user_id", owner)
        .single(),
    )?.view;
    const items = await loadPortfolio(db, owner);
    const inventorySignature = (entries) =>
      JSON.stringify(
        entries.map((i) => [
          i.uid,
          portfolioPricingKey(i),
          i.quantity,
          i.lots,
          i.transactions,
        ]),
      );
    const inventoryKey = inventorySignature(items);
    if (
      saved?.inventoryKey === inventoryKey &&
      saved.updatedAt?.slice(0, 10) === now.slice(0, 10) &&
      !saved.refreshIncomplete
    ) {
      checked(
        await db
          .from("portfolio_views")
          .update({ refresh_until: null, refresh_token: null })
          .eq("user_id", owner)
          .eq("refresh_token", token),
      );
      return saved;
    }
    const prior = new Map(
      (saved?.pendingPricing || saved?.pricing || []).map((p) => [p.uid, p]),
    );
    const refreshed = [...items];
    let next = 0,
      failed = false;
    const groups = new Map();
    for (let index = 0; index < items.length; index++) {
      const key = portfolioPricingKey(items[index]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    }
    const jobs = [...groups.values()];
    await Promise.all(
      Array.from({ length: Math.min(3, jobs.length) }, async () => {
        while (next < jobs.length && !signal.aborted) {
          const indexes = jobs[next++],
            item = items[indexes[0]],
            key = portfolioPricingKey(item),
            old = prior.get(item.uid);
          let pricing = old?.key === key ? old : null;
          try {
            const lookup = lookupFor(item);
            let card;
            if (item.cardState === "sealed") {
              const result = await fetchPkmnPricesSealedProduct(
                config.pkmnpricesApiKey,
                item.externalIds?.pkmnpricesSealed ||
                  String(item.id).replace(/^sealed:/, ""),
                signal,
                {
                  includeHistory: true,
                  currencies: [item.currency.toLowerCase()],
                },
              );
              card = result;
            } else {
              const result = await fetchPkmnPricesLookup(
                config.pkmnpricesApiKey,
                lookup,
                signal,
                {
                  includeHistory: !(
                    item.gradingCompany || item.cardState === "graded"
                  ),
                  historyPeriod: "365d",
                  historyLimit: 365,
                  includeEur: item.currency === "EUR",
                  currencies: [item.currency.toLowerCase()],
                },
              );
              if (!result.card) throw Error("card_not_found");
              card = normalizePkmnPricesCard(
                result.card,
                result.history,
                now,
                item.id,
                result.historyStatus,
                { eur: result.eurStatus },
              );
            }
            if (!card) throw Error("card_not_found");
            if (
              card.historyStatus &&
              !["live", "not_requested"].includes(card.historyStatus)
            )
              failed = true;
            const merged = {
              ...item,
              quotes: card.quotes || [],
              priceHistory: mergePriceHistory(
                pricing?.priceHistory || [],
                item.priceHistory || [],
                card.history || card.priceHistory || [],
              ),
            };
            const candidate = selectReferenceQuote(
              merged.quotes,
              item.variant,
              item.currency,
              { ...item, condition: lookup.condition },
            );
            const quote =
              candidate &&
              priceFreshness(candidate, { now: Date.parse(now) }).band !==
                "stale"
                ? candidate
                : null;
            if (!quote && !(item.gradingCompany || item.cardState === "graded"))
              failed = true;
            pricing = {
              ...pricing,
              uid: item.uid,
              key,
              quotes: merged.quotes,
              priceHistory: merged.priceHistory,
              historyStatus: card.historyStatus,
              price: quote?.amount ?? pricing?.price ?? null,
              pricingStatus: quote
                ? "live"
                : pricing?.pricingStatus || "missing",
              pricingUpdatedAt: quote?.observedAt || pricing?.pricingUpdatedAt,
              externalIds: { ...item.externalIds, ...card.externalIds },
            };
            if (item.gradingCompany || item.cardState === "graded") {
              pricing.price = pricing.soldValuation?.estimate ?? null;
              pricing.pricingStatus =
                pricing.soldValuation?.status === "ready" ? "live" : "missing";
              const printing = selectVariantOption(card, item.variant);
              const finish =
                item.finish && item.finish !== "unknown"
                  ? item.finish
                  : printing.finish;
              const edition =
                item.edition && item.edition !== "unknown"
                  ? item.edition
                  : printing.edition;
              const promoType =
                item.promoType && item.promoType !== "unknown"
                  ? item.promoType
                  : printing.promoType;
              const qualifier =
                item.gradeQualifier ??
                (item.gradingCompany === "PSA" || String(item.grade) !== "10"
                  ? ""
                  : null);
              if (
                [finish, edition, promoType].some(
                  (v) => !v || v === "unknown",
                ) ||
                qualifier == null
              )
                throw Error("printing_confirmation_required");
              const context = {
                canonicalId: item.id,
                identityStatus: "exact",
                name: item.name,
                set: item.set,
                number: item.number,
                language: item.language,
                variant: item.variant,
                finish,
                edition,
                promoType,
                grader: item.gradingCompany,
                grade: item.grade,
                qualifier,
                currency: item.currency,
              };
              const previous = pricing?.exactSaleEvidence;
              const pollSince = previous?.nextCursor
                ? previous.pollSince
                : previous?.syncedThrough || null;
              let cursor = previous?.nextCursor || null,
                result,
                highest =
                  previous?.highestIngestedAt ||
                  previous?.syncedThrough ||
                  null;
              const retained = new Map(
                (previous?.sales || []).map((s) => [s.providerSaleId, s]),
              );
              // ponytail: four pages per refresh within the existing deadline/budget; resume from the saved cursor.
              for (let page = 0; page < 4; page++) {
                result = await fetchPkmnPricesSales(
                  config.pkmnpricesApiKey,
                  {
                    ...lookup,
                    grader: item.gradingCompany,
                    grade: String(item.grade),
                    finish,
                    edition,
                    promoType,
                    gradeQualifier: qualifier,
                  },
                  signal,
                  { limit: 20, cursor, since: pollSince },
                );
                for (const sale of result.sales)
                  retained.set(sale.providerSaleId, sale);
                if (
                  result.highestIngestedAt &&
                  (!highest || result.highestIngestedAt > highest)
                )
                  highest = result.highestIngestedAt;
                cursor = result.hasMore ? result.nextCursor : null;
                if (!result.hasMore) break;
                if (!cursor) throw Error("sales_cursor_missing");
              }
              if (result.hasMore) failed = true;
              result.sales = [...retained.values()];
              const validatedContext = {
                ...lookup,
                providerCardId: result.cardId,
                canonicalValidated: true,
                completedSaleValidated: true,
                grader: item.gradingCompany,
                grade: String(item.grade),
                finish,
                edition,
                promoType,
                gradeQualifier: qualifier,
              };
              const saleEvidence = {
                sales: result.sales,
                validatedContext,
                retrievedAt: now,
                salesStatus: "live",
                hasMore: result.hasMore,
                nextCursor: cursor,
                pollSince,
                highestIngestedAt: highest,
                syncedThrough: result.hasMore
                  ? previous?.syncedThrough || null
                  : highest,
              };
              const soldValuation = latestEbaySoldValuation(
                result.sales,
                context,
                { validatedContext, retrievedAt: now, hasMore: result.hasMore },
              );
              if (!["ready", "stale"].includes(soldValuation.status))
                throw Error("matching_sold_price_unavailable");
              pricing = {
                ...pricing,
                finish,
                edition,
                promoType,
                gradeQualifier: qualifier,
                identityStatus: "exact",
                soldValuation: { ...soldValuation, contextValidated: true },
                exactSaleEvidence: saleEvidence,
                price: soldValuation.estimate,
                pricingStatus:
                  soldValuation.status === "ready" ? "live" : "stale",
                matchedHistory: soldValuation.evidence
                  .filter((s) =>
                    (
                      soldValuation.eligibleEvidenceIds ||
                      soldValuation.contributingEvidenceIds
                    ).includes(s.transactionKey),
                  )
                  .map((s) => ({
                    recordedAt: s.soldAt,
                    amount: s.amount,
                    currency: s.currency,
                    verifiedExactSold: true,
                    contextValidated: true,
                  })),
              };
            }
          } catch (error) {
            failed = true;
            pricing = {
              ...(pricing || { uid: item.uid, key }),
              pricingReason: error.code || error.message || "refresh_failed",
            };
          }
          for (const index of indexes)
            refreshed[index] = {
              ...items[index],
              ...pricing,
              uid: items[index].uid,
              quantity: items[index].quantity,
              lots: items[index].lots,
              transactions: items[index].transactions,
            };
        }
      }),
    );
    if (inventorySignature(await loadPortfolio(db, owner)) !== inventoryKey)
      throw Error("inventory_changed_during_refresh");
    const view = buildPortfolioView(refreshed, now);
    const complete = view.summaries.every((s) => s.total !== null);
    const pricing = refreshed.map((i) => {
      const {
        uid,
        quotes,
        priceHistory,
        price,
        pricingStatus,
        pricingReason,
        pricingUpdatedAt,
        historyStatus,
        soldValuation,
        exactSaleEvidence,
        matchedHistory,
        externalIds,
        finish,
        edition,
        promoType,
        gradeQualifier,
        identityStatus,
      } = i;
      return {
        uid,
        key: portfolioPricingKey(items.find((x) => x.uid === uid)),
        resolvedKey: portfolioPricingKey(i),
        quotes,
        priceHistory,
        price,
        pricingStatus,
        pricingReason,
        pricingUpdatedAt,
        historyStatus,
        soldValuation,
        exactSaleEvidence,
        matchedHistory,
        externalIds,
        finish,
        edition,
        promoType,
        gradeQualifier,
        identityStatus,
      };
    });
    const nextView = {
      ...view,
      pricing,
      complete,
      inventoryKey,
      refreshIncomplete: failed || signal.aborted,
    };
    // A failed refresh cannot replace a complete saved total/chart with an incomplete subset.
    const publish =
      (!complete || failed || signal.aborted) && saved?.summaries
        ? { ...saved, pendingPricing: pricing, refreshIncomplete: true }
        : nextView;
    checked(
      await db
        .from("portfolio_views")
        .update({
          view: publish,
          updated_at: now,
          error_code: complete && !failed ? null : "incomplete_refresh",
          refresh_until: null,
          refresh_token: null,
        })
        .eq("user_id", owner)
        .eq("refresh_token", token),
    );
    return publish;
  } catch (error) {
    await db
      .from("portfolio_views")
      .update({
        error_code: error.code || "refresh_failed",
        refresh_until: null,
        refresh_token: null,
      })
      .eq("user_id", owner)
      .eq("refresh_token", token);
    throw error;
  }
}
export async function portfolioService(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  const send = (status, body) => response.status(status).json(body);
  if (!["GET", "POST"].includes(request.method))
    return send(405, { error: "Method not allowed" });
  const config = serverEnvironment();
  if (!config.supabaseUrl || !config.supabaseSecretKey)
    return send(503, { error: "Portfolio storage unavailable" });
  const db = database(config),
    bearer = String(request.headers?.authorization || "").match(
      /^Bearer (\S+)$/,
    )?.[1];
  if (request.query?.surface === "portfolio-sync") {
    if (
      request.method !== "GET" ||
      !config.cronSecret ||
      bearer !== config.cronSecret
    )
      return send(401, { error: "Unauthorized" });
    const due = checked(
      await db
        .from("portfolio_views")
        .select("user_id,updated_at")
        .order("updated_at", { ascending: true, nullsFirst: true })
        .limit(100),
    );
    const signal = AbortSignal.timeout(48_000);
    let updated = 0;
    for (const row of due) {
      if (signal.aborted) break;
      if (
        row.updated_at &&
        Date.now() - Date.parse(row.updated_at) < 20 * 3_600_000
      )
        continue;
      try {
        await refreshPortfolioView(db, row.user_id, config, { signal });
        updated++;
      } catch {}
    }
    return send(200, { updated, deferred: signal.aborted });
  }
  if (!bearer) return send(401, { error: "Authentication required" });
  const auth = await db.auth.getUser(bearer);
  if (auth.error || !auth.data?.user)
    return send(401, { error: "Authentication required" });
  const owner = auth.data.user.id;
  try {
    if (request.method === "GET") {
      const row = checked(
        await db
          .from("portfolio_views")
          .select("view,attempted_at,error_code")
          .eq("user_id", owner)
          .maybeSingle(),
      );
      return send(200, {
        view: row?.view || null,
        refreshStatus: row?.error_code || null,
      });
    }
    return send(200, { view: await refreshPortfolioView(db, owner, config) });
  } catch {
    return send(503, {
      error: "Portfolio could not refresh; saved values are unchanged",
    });
  }
}
