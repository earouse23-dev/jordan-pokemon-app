import { createClient } from "@supabase/supabase-js";

let singleton;

export function createAppSupabase() {
  if (singleton) return singleton;
  const config = globalThis.__APP_CONFIG__ || {};
  if (
    !/^https:\/\/.+\.supabase\.co$/i.test(config.supabaseUrl || "") ||
    !config.supabasePublishableKey
  )
    return null;
  singleton = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { headers: { "X-Client-Info": "pokemon-portfolio-pwa/1.0" } },
  });
  return singleton;
}

export async function signUpWithPassword(client, email, password) {
  return client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: globalThis.location?.origin },
  });
}

export async function signInWithPassword(client, email, password) {
  return client.auth.signInWithPassword({ email, password });
}
export async function sendMagicLink(client, email) {
  return client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: globalThis.location?.origin,
      shouldCreateUser: true,
    },
  });
}
export async function signOut(client) {
  return client.auth.signOut();
}
function number(value) {
  return value === null || value === undefined ? null : Number(value);
}

export function hydratePosition(
  row,
  transactions = [],
  lots = [],
  allocations = [],
  observations = [],
) {
  const identity = row.identity_snapshot || {};
  const purchases = transactions.filter(
    (item) => item.transaction_type === "purchase",
  );
  const sales = transactions.filter((item) => item.transaction_type === "sale");
  const costBasis = lots.reduce(
    (sum, lot) => sum + Number(lot.remaining_cost || 0),
    0,
  );
  const allocatedCost = allocations.reduce(
    (sum, item) => sum + Number(item.allocated_cost || 0),
    0,
  );
  const netProceeds = sales.reduce(
    (sum, item) => sum + Number(item.net_proceeds || 0),
    0,
  );
  return {
    id: identity.providerCardId || identity.id || row.id,
    uid: row.id,
    cardId: row.card_id,
    variantId: row.variant_id,
    name: identity.name || "Unknown item",
    set: identity.set || identity.setName || "Set unavailable",
    setId: identity.setId || "",
    number: identity.number || identity.collectorNumber || "",
    variant: identity.variant || identity.finish || "Unknown printing",
    language: identity.language || "en",
    rarity: identity.rarity || null,
    release: identity.release || identity.releaseYear || "",
    artist: identity.artist || "",
    image: identity.image || identity.imageLarge || "./icons/icon.svg",
    thumb:
      identity.thumb ||
      identity.imageSmall ||
      identity.image ||
      "./icons/icon.svg",
    externalIds: identity.externalIds || {},
    productType: identity.productType || null,
    cardState: row.card_state,
    condition:
      row.card_state === "sealed"
        ? "Sealed"
        : row.card_state === "graded"
          ? "Graded"
          : identity.conditionLabel ||
            String(row.raw_condition || "")
              .split("_")
              .map((part) => part[0]?.toUpperCase() + part.slice(1))
              .join(" "),
    rawCondition: row.raw_condition,
    gradingCompany: row.grader || "",
    grade: row.grade == null ? "" : String(row.grade),
    certificationNumber: row.certification_number || "",
    quantity: Number(row.quantity),
    status: row.status,
    askingPrice: number(row.asking_price),
    listingVenue: row.listing_venue || "",
    listedAt: row.listed_at || "",
    priceReviewedAt: row.price_reviewed_at || "",
    currency: row.currency,
    notes: row.notes || "",
    location: row.storage_location || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    costBasis,
    cost: row.quantity ? costBasis / Number(row.quantity) : null,
    realizedGain: netProceeds - allocatedCost,
    netSaleProceeds: netProceeds,
    allocatedSoldCost: allocatedCost,
    purchaseDate:
      purchases.map((item) => item.transaction_date).sort()[0] || "",
    transactions: transactions.map((item) => {
      const saleAllocations =
        item.transaction_type === "sale"
          ? allocations.filter(
              (allocation) => allocation.sale_transaction_id === item.id,
            )
          : [];
      const transactionAllocatedCost = saleAllocations.length
        ? saleAllocations.reduce(
            (sum, allocation) => sum + Number(allocation.allocated_cost || 0),
            0,
          )
        : null;
      const transactionNetProceeds = number(item.net_proceeds);
      return {
        id: item.id,
        type: item.transaction_type,
        date: item.transaction_date,
        quantity: Number(item.quantity),
        unitPrice: number(item.unit_price),
        subtotal: number(item.subtotal),
        tax: number(item.tax),
        shipping: number(item.shipping),
        marketplaceFees: number(item.marketplace_fees),
        gradingFees: number(item.grading_fees),
        otherCosts: number(item.other_costs),
        totalCost: number(item.total_cost),
        netProceeds: transactionNetProceeds,
        allocatedCost: transactionAllocatedCost,
        realizedGain:
          transactionNetProceeds === null || transactionAllocatedCost === null
            ? null
            : transactionNetProceeds - transactionAllocatedCost,
        currency: item.currency,
        marketplace: item.marketplace,
        notes: item.notes,
      };
    }),
    lots: lots.map((lot) => ({
      id: lot.id,
      acquiredAt: lot.acquired_at,
      quantityAcquired: Number(lot.quantity_acquired),
      quantityRemaining: Number(lot.quantity_remaining),
      totalCost: Number(lot.total_cost),
      remainingCost: Number(lot.remaining_cost),
      currency: lot.currency,
    })),
    priceHistory: observations.map((observation) => ({
      provider: observation.provider,
      providerVariantId: observation.provider_variant_id || null,
      currency: observation.currency,
      condition: observation.provider_condition || null,
      finish: observation.finish,
      gradingCompany: observation.grader || null,
      grade:
        observation.grade_label ||
        (observation.grade == null ? null : String(observation.grade)),
      amount: Number(observation.amount),
      low: number(observation.price_low),
      high: number(observation.price_high),
      saleCount: number(observation.sales_count),
      recordedAt: observation.observed_at,
      granularity: observation.granularity,
      quality: observation.quality || {},
    })),
  };
}

export async function loadPortfolio(client) {
  const { data: rows, error } = await client
    .from("collection_items")
    .select(
      "id,user_id,card_id,variant_id,identity_snapshot,card_state,raw_condition,grader,grade,certification_number,quantity,notes,storage_location,tags,status,asking_price,listing_venue,listed_at,price_reviewed_at,currency,created_at,updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!rows?.length) return [];
  const ids = rows.map((row) => row.id);
  const [transactionResult, lotResult, historyResult] = await Promise.all([
    client
      .from("collection_transactions")
      .select("*")
      .in("collection_item_id", ids)
      .order("transaction_date"),
    client
      .from("purchase_lots")
      .select("*")
      .in("collection_item_id", ids)
      .order("acquired_at"),
    client.rpc("get_portfolio_price_history", {
      p_days: 400,
      p_per_position: 400,
    }),
  ]);
  if (transactionResult.error) throw transactionResult.error;
  if (lotResult.error) throw lotResult.error;
  if (historyResult.error) throw historyResult.error;
  const saleIds = (transactionResult.data || [])
    .filter((row) => row.transaction_type === "sale")
    .map((row) => row.id);
  const allocationResult = saleIds.length
    ? await client
        .from("fifo_lot_allocations")
        .select("*")
        .in("sale_transaction_id", saleIds)
    : { data: [], error: null };
  if (allocationResult.error) throw allocationResult.error;
  const historyByPosition = new Map();
  for (const observation of historyResult.data || []) {
    const history = historyByPosition.get(observation.collection_item_id) || [];
    history.push(observation);
    historyByPosition.set(observation.collection_item_id, history);
  }
  return rows.map((row) => {
    const rowTransactions = (transactionResult.data || []).filter(
      (item) => item.collection_item_id === row.id,
    );
    const rowSaleIds = rowTransactions
      .filter((item) => item.transaction_type === "sale")
      .map((item) => item.id);
    return hydratePosition(
      row,
      rowTransactions,
      (lotResult.data || []).filter(
        (item) => item.collection_item_id === row.id,
      ),
      (allocationResult.data || []).filter((item) =>
        rowSaleIds.includes(item.sale_transaction_id),
      ),
      historyByPosition.get(row.id) || [],
    );
  });
}

export function hydrateWatchlistEntry(row) {
  const identity = row.identity_snapshot || {};
  return {
    id: identity.providerCardId || row.provider_card_id,
    watchlistId: row.id,
    cardId: row.card_id,
    name: identity.name || "Unknown card",
    set: identity.set || identity.setName || "Set unavailable",
    setId: identity.setId || "",
    number: identity.number || identity.collectorNumber || "",
    variant: identity.variant || row.variant_key || "Unknown printing",
    language: identity.language || "en",
    rarity: identity.rarity || null,
    release: identity.release || "",
    artist: identity.artist || "",
    image: identity.image || identity.thumb || "./icons/icon.svg",
    thumb: identity.thumb || identity.image || "./icons/icon.svg",
    externalIds: identity.externalIds || {},
    productType: identity.productType || null,
    cardState: row.card_state,
    rawCondition: row.raw_condition,
    condition:
      row.card_state === "sealed"
        ? "Sealed"
        : row.card_state === "graded"
          ? "Graded"
          : String(row.raw_condition || "")
              .split("_")
              .map((part) => part[0]?.toUpperCase() + part.slice(1))
              .join(" "),
    gradingCompany: row.grader || "",
    grade: row.grade == null ? "" : String(row.grade),
    targetPrice: number(row.target_price),
    startingMarketPrice: number(row.starting_market_price),
    currentPrice: null,
    currency: row.currency,
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pricingStatus: "loading",
  };
}

export async function loadWatchlist(client) {
  const { data, error } = await client
    .from("card_watchlist")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(hydrateWatchlistEntry);
}

export async function createWatchlistEntry(client, input) {
  const { data, error } = await client
    .from("card_watchlist")
    .insert({
      user_id: input.userId,
      card_id: input.cardId || null,
      provider_card_id: input.identity.providerCardId,
      variant_key: input.identity.variant || "",
      identity_snapshot: input.identity,
      card_state: input.cardState,
      raw_condition: input.cardState === "raw" ? input.rawCondition : null,
      grader: input.cardState === "graded" ? input.grader : null,
      grade: input.cardState === "graded" ? input.grade : null,
      target_price: input.targetPrice ?? null,
      starting_market_price: input.startingMarketPrice ?? null,
      currency: input.currency || "USD",
      notes: input.notes || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return hydrateWatchlistEntry(data);
}

export async function updateWatchlistEntry(client, id, input) {
  const { data, error } = await client
    .from("card_watchlist")
    .update({
      target_price: input.targetPrice ?? null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return hydrateWatchlistEntry(data);
}

export async function deleteWatchlistEntry(client, id) {
  const { error } = await client.from("card_watchlist").delete().eq("id", id);
  if (error) throw error;
}

export async function createPosition(client, input) {
  const { data, error } = await client.rpc("create_collection_position", {
    p_identity: input.identity,
    p_card_id: input.cardId || null,
    p_variant_id: input.variantId || null,
    p_card_state: input.cardState,
    p_raw_condition: input.cardState === "raw" ? input.rawCondition : null,
    p_grader: input.cardState === "graded" ? input.grader : null,
    p_grade: input.cardState === "graded" ? input.grade : null,
    p_certification_number: input.certificationNumber || null,
    p_quantity: input.quantity,
    p_transaction_date: input.transactionDate,
    p_unit_price: input.unitPrice,
    p_tax: input.tax || 0,
    p_shipping: input.shipping || 0,
    p_marketplace_fees: input.marketplaceFees || 0,
    p_grading_fees: input.gradingFees || 0,
    p_other_costs: input.otherCosts || 0,
    p_currency: input.currency || "USD",
    p_marketplace: input.marketplace || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function recordPurchaseLot(client, input) {
  const { data, error } = await client.rpc("record_collection_purchase", {
    p_collection_item_id: input.collectionItemId,
    p_transaction_date: input.transactionDate,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
    p_tax: input.tax || 0,
    p_shipping: input.shipping || 0,
    p_marketplace_fees: input.marketplaceFees || 0,
    p_grading_fees: input.gradingFees || 0,
    p_other_costs: input.otherCosts || 0,
    p_currency: input.currency || "USD",
    p_marketplace: input.marketplace || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function recordSale(client, input) {
  const { data, error } = await client.rpc("record_collection_sale", {
    p_collection_item_id: input.collectionItemId,
    p_transaction_date: input.transactionDate,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
    p_marketplace_fees: input.marketplaceFees || 0,
    p_shipping: input.shipping || 0,
    p_other_costs: input.otherCosts || 0,
    p_currency: input.currency || "USD",
    p_marketplace: input.marketplace || null,
    p_notes: input.notes || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function updatePosition(client, id, values) {
  const payload = {};
  if ("notes" in values) payload.notes = values.notes;
  if ("location" in values) payload.storage_location = values.location;
  if ("certificationNumber" in values)
    payload.certification_number = values.certificationNumber;
  if ("status" in values) payload.status = values.status;
  if ("askingPrice" in values)
    payload.asking_price =
      values.askingPrice === "" ? null : values.askingPrice;
  if ("listingVenue" in values)
    payload.listing_venue = values.listingVenue || null;
  if ("listedAt" in values) payload.listed_at = values.listedAt || null;
  if ("priceReviewedAt" in values)
    payload.price_reviewed_at = values.priceReviewedAt || null;
  if ("imageOverrideUrl" in values)
    payload.image_override_url = values.imageOverrideUrl;
  if ("tags" in values) payload.tags = values.tags;
  if (!Object.keys(payload).length) return;
  const { error } = await client
    .from("collection_items")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

export async function bulkOrganizePositions(client, input) {
  const ids = [...new Set((input.ids || []).map(String).filter(Boolean))];
  if (!ids.length || ids.length > 500)
    throw new Error("Choose between 1 and 500 positions.");
  const labelMode = ["keep", "add", "remove"].includes(input.labelMode)
    ? input.labelMode
    : "keep";
  const locationMode = ["keep", "set", "clear"].includes(input.locationMode)
    ? input.locationMode
    : "keep";
  const status = ["keep", "owned", "archived"].includes(input.status)
    ? input.status
    : "keep";
  const label = String(input.label || "").trim();
  const location = String(input.location || "").trim();
  if (labelMode !== "keep" && (!label || label.length > 40))
    throw new Error("Enter a label with 40 characters or fewer.");
  if (locationMode === "set" && (!location || location.length > 250))
    throw new Error("Enter a storage location with 250 characters or fewer.");
  if (labelMode === "keep" && locationMode === "keep" && status === "keep")
    throw new Error("Choose at least one change.");
  const { data, error } = await client.rpc("bulk_organize_collection_items", {
    p_ids: ids,
    p_label: label || null,
    p_label_mode: labelMode,
    p_location: location || null,
    p_location_mode: locationMode,
    p_status: status,
  });
  if (error) throw error;
  const updatedIds = (data || []).map((row) => row.collection_item_id || row);
  if (updatedIds.length !== ids.length)
    throw new Error(
      "Some selected positions were unavailable. Refresh and try again.",
    );
  return updatedIds;
}
export async function deletePosition(client, id) {
  const { error } = await client.from("collection_items").delete().eq("id", id);
  if (error) throw error;
}
export async function loadDiagnostics(client) {
  const [providers, anomalies, mappings] = await Promise.all([
    client.from("provider_sync_status").select("*").order("provider"),
    client
      .from("price_anomalies")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("card_provider_mappings")
      .select("id,provider,match_status,match_confidence,updated_at")
      .in("match_status", ["ambiguous", "missing"])
      .limit(50),
  ]);
  return {
    providers: providers.data || [],
    anomalies: anomalies.data || [],
    mappings: mappings.data || [],
    errors: [providers.error, anomalies.error, mappings.error].filter(Boolean),
  };
}
