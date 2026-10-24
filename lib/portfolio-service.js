import { normalizeCardImageSource } from "./image-source.js";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { serverEnvironment } from "./env.js";
import {
  loadPortfolio,
  loadPortfolioValuationHistory,
} from "./supabase-data.js";
import {
  buildPortfolioView,
  PORTFOLIO_VIEW_VERSION,
  portfolioPricingKey,
  portfolioCondition,
  hasPortfolioValue,
  compactPortfolioView,
} from "./portfolio-view.js";
import {
  fetchPkmnPricesLookup,
  normalizePkmnPricesCard,
  fetchPkmnPricesSalesHistory,
  fetchPkmnPricesSealedProduct,
} from "./providers/pkmnprices.js";
import {
  selectReferenceQuote,
  mergePriceHistory,
  latestEbaySoldValuation,
  priceFreshness,
} from "./pricing.js";
import { selectVariantOption } from "./identity.js";
import { completedSalePriceHistory } from "./price-history.js";

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
async function recoverSavedPortfolio(db, owner, saved) {
  if (hasPortfolioValue(saved)) return saved;
  const snapshots = await loadPortfolioValuationHistory(db, owner);
  const latest = [...new Map(snapshots.map((s) => [s.currency, s])).values()];
  return latest.length
    ? {
        ...saved,
        version: 1,
        legacySnapshot: true,
        complete: false,
        refreshIncomplete: true,
        updatedAt: latest.at(-1).observedAt,
        pricing: [],
        summaries: latest.map((s) => ({
          currency: s.currency,
          total: s.unpricedItems ? null : s.total,
          knownTotal: s.total,
          missingUnits: s.unpricedItems,
          history: [],
          historyStartsAt: null,
        })),
      }
    : saved;
}
export async function refreshPortfolioView(
  db,
  owner,
  config,
  { signal = AbortSignal.timeout(48_000), now = new Date().toISOString() } = {},
) {
  // The daily no-op needs one owner-scoped row, never the whole inventory.
  const readSaved = async () =>
    checked(
      await db
        .from("portfolio_views")
        .select("view,inventory_revision,dirty_from,attempted_at")
        .eq("user_id", owner)
        .maybeSingle(),
    );
  const reusable = (row) =>
    row?.view?.version === PORTFOLIO_VIEW_VERSION &&
    row?.view?.dailyVersion === 1 &&
    row.view.inventoryRevision === row.inventory_revision &&
    row.view.checkedDay === now.slice(0, 10) &&
    !row.view.refreshIncomplete &&
    !row.view.historyBackfillPending;
  const initial = await readSaved();
  if (reusable(initial)) return initial.view;
  // Backoff bounds failures; useful continuation work does not exhaust retries.
  // Inventory edits and the next UTC valuation day reset the failure limit.
  if (
    initial?.view?.version === PORTFOLIO_VIEW_VERSION &&
    initial?.view?.attemptDay === now.slice(0, 10) &&
    initial.view.attemptRevision === initial.inventory_revision &&
    (initial.view.attemptCount >= 3 ||
      Date.parse(now) - Date.parse(initial.attempted_at) < 300_000)
  )
    return initial.view;
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
  let failureView = initial?.view,
    failureRevision = initial?.inventory_revision;
  try {
    const row = await readSaved();
    failureView = row?.view;
    failureRevision = row?.inventory_revision;
    let saved = await recoverSavedPortfolio(db, owner, row?.view);
    const revision = row?.inventory_revision;
    const items = await loadPortfolio(db, owner, { serverOwnerRead: true });
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
    const prior = new Map(
      (saved?.pendingPricing || saved?.pricing || []).map((p) => [p.uid, p]),
    );
    const priorByKey = new Map([...prior.values()].map((p) => [p.key, p]));
    // A chart-model upgrade uses retained facts even on a new pricing day.
    // Publish it first; ordinary daily pricing can then refresh independently.
    const rebuildOnly = saved?.version !== PORTFOLIO_VIEW_VERSION && saved?.pricing?.length && items.every(item => {
      const key = portfolioPricingKey(item);
      return (prior.get(item.uid) || priorByKey.get(key))?.key === key;
    });
    const refreshed = [...items];
    let next = 0,
      failed = false,
      withdrawnPrice = false;
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
            old = prior.get(item.uid) || priorByKey.get(key);
          let pricing = old?.key === key ? old : null;
          try {
            if (
              pricing && (rebuildOnly || (pricing.checkedDay === now.slice(0, 10) &&
              !pricing.exactSaleEvidence?.hasMore && !pricing.exactSaleEvidence?.nextCursor))
            ) {
              for (const index of indexes)
                refreshed[index] = {
                  ...items[index],
                  ...pricing,
                  uid: items[index].uid,
                  quantity: items[index].quantity,
                  lots: items[index].lots,
                  transactions: items[index].transactions,
                };
              continue;
            }
            const lookup = lookupFor({
              ...item,
              externalIds: { ...item.externalIds, ...pricing?.externalIds },
            });
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
                  includeEur: ["pro", "business"].includes(config.pkmnpricesPlan),
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
              pricingReason: null,
              price: quote?.amount ?? pricing?.price ?? null,
              pricingStatus: quote
                ? "live"
                : pricing?.pricingStatus || "missing",
              pricingUpdatedAt: quote?.observedAt || pricing?.pricingUpdatedAt,
              externalIds: { ...item.externalIds, ...card.externalIds },
              image:
                normalizeCardImageSource(card.images?.large || card.image)
                  ?.href ||
                pricing?.image ||
                item.image,
              thumb:
                normalizeCardImageSource(
                  card.images?.small || card.thumb || card.image,
                )?.href ||
                pricing?.thumb ||
                item.thumb,
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
              const result = await fetchPkmnPricesSalesHistory(
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
              );
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
                correctedSaleIds: result.correctedSaleIds || [],
                correctionsThrough: result.correctionsThrough || null,
                validatedContext,
                retrievedAt: now,
                salesStatus: "live",
                hasMore: result.hasMore,
                nextCursor: result.nextCursor,
                highestIngestedAt: result.highestIngestedAt,
                syncedThrough: result.syncedThrough,
              };
              const soldValuation = latestEbaySoldValuation(
                result.sales,
                context,
                { validatedContext, retrievedAt: now, hasMore: result.hasMore },
              );
              saleEvidence.chartHistory = completedSalePriceHistory(soldValuation, pricing?.exactSaleEvidence?.chartHistory);
              if (!["ready", "stale"].includes(soldValuation.status)) {
                const withdrawn = result.correctedSaleIds?.some(id => pricing?.exactSaleEvidence?.sales?.some(sale => sale.providerSaleId === id));
                if (withdrawn) withdrawnPrice = true;
                pricing = {
                  ...pricing,
                  ...(withdrawn ? { price: null, referencePrice: null, soldValuation: { ...soldValuation, contextValidated: true }, matchedHistory: [], pricingStatus: "missing" } : {}),
                  exactSaleEvidence: saleEvidence,
                  pricingReason: "matching_sold_price_unavailable",
                };
                throw Error("matching_sold_price_unavailable");
              }
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
            if (
              ![
                "matching_sold_price_unavailable",
                "card_not_found",
                "printing_confirmation_required",
              ].includes(error.message)
            )
              failed = true;
            pricing = {
              ...(pricing || { uid: item.uid, key }),
              pricingReason: error.code || error.message || "refresh_failed",
            };
          }
          if (
            pricing &&
            !signal.aborted &&
            (!pricing.pricingReason ||
              [
                "card_not_found",
                "printing_confirmation_required",
                "matching_sold_price_unavailable",
              ].includes(pricing.pricingReason)) &&
            (!pricing.historyStatus ||
              ["live", "not_requested"].includes(pricing.historyStatus))
          )
            pricing.checkedDay = now.slice(0, 10);
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
    const view = buildPortfolioView(refreshed, now, {
      previousView: saved?.dailyVersion === 1 ? saved : null,
      recalculateFrom: row?.dirty_from,
    });
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
        checkedDay,
        historyStatus,
        soldValuation,
        exactSaleEvidence,
        matchedHistory,
        externalIds,
        image,
        thumb,
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
        checkedDay,
        historyStatus,
        soldValuation,
        exactSaleEvidence,
        matchedHistory,
        externalIds,
        image,
        thumb,
        finish,
        edition,
        promoType,
        gradeQualifier,
        identityStatus,
      };
    });
    const refreshReason = pricing.some(
      (p) => p.pricingReason === "provider_daily_budget_reached",
    )
      ? "provider_daily_budget_reached"
      : "incomplete_refresh";
    const nextView = {
      ...view,
      pricingVersion: 2,
      dailyVersion: 1,
      inventoryRevision: revision,
      checkedDay: rebuildOnly ? saved.checkedDay : now.slice(0, 10),
      updatedAt: rebuildOnly ? saved.updatedAt : now,
      pricing,
      complete,
      inventoryKey,
      historyBackfillPending: pricing.some(
        (p) => p.exactSaleEvidence?.hasMore || p.exactSaleEvidence?.nextCursor,
      ),
      refreshIncomplete: failed || signal.aborted,
      refreshReason: failed ? refreshReason : null,
    };
    // Preserve useful prices on failure, but never republish an officially withdrawn comp.
    const publish = withdrawnPrice ? nextView :
      (failed ||
        signal.aborted ||
        (!complete && saved?.complete === true) ||
        saved?.summaries?.some((previous) => {
          const next = view.summaries.find(
            (s) => s.currency === previous.currency,
          );
          return (
            next &&
            (next.missingUnits > previous.missingUnits ||
              (previous.history?.length > 1 && next.history.length < 2))
          );
        })) &&
      hasPortfolioValue(saved)
        ? {
            ...saved,
            pendingPricing: pricing,
            refreshIncomplete: true,
            refreshReason,
          }
        : failed || signal.aborted
          ? {
              ...saved,
              pendingPricing: pricing,
              refreshIncomplete: true,
              refreshReason,
            }
          : nextView;
    // Rebuilding presentation from retained facts is not a failed price attempt.
    // Allow the ordinary new-day refresh immediately after that one-time repair.
    publish.attemptDay = rebuildOnly ? null : now.slice(0, 10);
    publish.attemptRevision = revision;
    const progressed = pricing.some((p) => {
      const previous = prior.get(p.uid) || priorByKey.get(p.key);
      return (
        (p.priceHistory?.length || 0) > (previous?.priceHistory?.length || 0) ||
        (p.checkedDay === now.slice(0, 10) &&
          previous?.checkedDay !== p.checkedDay) ||
        (Boolean(p.exactSaleEvidence) &&
          (p.exactSaleEvidence.nextCursor !==
            previous?.exactSaleEvidence?.nextCursor ||
            p.exactSaleEvidence.highestIngestedAt !==
              previous?.exactSaleEvidence?.highestIngestedAt ||
            p.exactSaleEvidence.sales?.length !==
              previous?.exactSaleEvidence?.sales?.length))
      );
    });
    publish.attemptCount = rebuildOnly || progressed
      ? 0
      : saved?.attemptDay === publish.attemptDay &&
          saved.attemptRevision === revision
        ? (saved.attemptCount || 0) + 1
        : 1;
    if (
      !checked(
        await db.rpc("publish_saved_portfolio", {
          p_user_id: owner,
          p_token: token,
          p_revision: revision,
          p_view: publish,
          p_now: now,
          p_error: failed || signal.aborted ? refreshReason : null,
        }),
      )
    )
      throw Error("inventory_changed_during_refresh");
    return publish;
  } catch (error) {
    await db
      .from("portfolio_views")
      .update({
        view: {
          ...failureView,
          attemptDay: now.slice(0, 10),
          attemptRevision: failureRevision,
          attemptCount:
            failureView?.attemptDay === now.slice(0, 10) &&
            failureView.attemptRevision === failureRevision
              ? (failureView.attemptCount || 0) + 1
              : 1,
        },
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
      ![config.cronSecret, config.portfolioDispatchToken]
        .filter(Boolean)
        .includes(bearer)
    )
      return send(401, { error: "Unauthorized" });
    const now = new Date().toISOString();
    const due = checked(
      await db.rpc("due_portfolio_refreshes", { p_now: now, p_limit: 100 }),
    );
    const signal = AbortSignal.timeout(48_000);
    let updated = 0,
      failed = 0,
      pending = 0,
      nextOwner = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, due.length) }, async () => {
        while (nextOwner < due.length) {
          if (signal.aborted) break;
          const row = due[nextOwner++];
          try {
            const view = await refreshPortfolioView(db, row.user_id, config, {
              signal,
              now,
            });
            if (!view || view.refreshIncomplete || view.historyBackfillPending)
              pending++;
            else updated++;
          } catch {
            failed++;
          }
        }
      }),
    );
    return send(200, {
      updated,
      failed,
      pending,
      deferred: due.length - nextOwner,
      interrupted: signal.aborted,
    });
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
      const view = (await recoverSavedPortfolio(db, owner, row?.view)) || null;
      return send(200, {
        view:
          request.query?.display === "summary"
            ? compactPortfolioView(view)
            : view,
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
