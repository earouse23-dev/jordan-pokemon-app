import {
  canonicalEdition,
  canonicalFinish,
  canonicalLanguage,
  canonicalPromoType,
  normalizeVariantOption,
} from "./identity.js";

export function money(value, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(Number(value)))
    return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value));
}

export function localIsoDate(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(value.getTime())) return "";
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function collectionWindow(items, limit = 100) {
  const size = Math.max(1, Math.floor(Number(limit) || 100));
  const displayed = items.slice(0, size);
  return {
    displayed,
    total: items.length,
    remaining: Math.max(0, items.length - displayed.length),
  };
}

export async function importRecordKey(record, occurrence = 0) {
  const snapshot = {
    id: record.id || "",
    name: record.name || "",
    set: record.set || "",
    number: record.number || "",
    language: record.language || "en",
    variant: record.variant || "",
    cardState: record.cardState || "",
    rawCondition: record.rawCondition || "",
    gradingCompany: record.gradingCompany || "",
    grade: record.grade || "",
    certificationNumber: record.certificationNumber || "",
    quantity: Number(record.quantity) || 0,
    totalAcquisitionCost: record.totalAcquisitionCost ?? null,
    purchaseDate: record.purchaseDate || "",
    currency: record.currency || "USD",
    location: record.location || "",
    folder: record.folder || "",
    customFields:
      record.customFields && typeof record.customFields === "object"
        ? Object.fromEntries(
            Object.entries(record.customFields).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          )
        : {},
    tags: [...(record.tags || [])]
      .map(String)
      .sort((a, b) => a.localeCompare(b)),
    notes: record.notes || "",
    occurrence: Math.max(0, Number(occurrence) || 0),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `mica-csv-v1-${hash}`;
}

export async function runBoundedTasks(items, worker, options = {}) {
  const concurrency = Math.min(
    Math.max(1, Math.floor(Number(options.concurrency) || 4)),
    8,
  );
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;
  let succeeded = 0;
  let failed = 0;
  const run = async () => {
    while (!options.shouldStop?.()) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        const value = await worker(items[index], index);
        results[index] = { status: "fulfilled", value };
        succeeded += 1;
      } catch (reason) {
        results[index] = { status: "rejected", reason };
        failed += 1;
      }
      completed += 1;
      options.onProgress?.({
        completed,
        succeeded,
        failed,
        total: items.length,
      });
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run),
  );
  return {
    results,
    completed,
    succeeded,
    failed,
    unprocessed: items.filter((_, index) => results[index] === undefined),
  };
}

function normalizedIdentityPart(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function sameCatalogCard(left, right) {
  if (!left || !right) return false;
  const leftLanguage = canonicalLanguage(left.language || "en");
  const rightLanguage = canonicalLanguage(right.language || "en");
  if (!leftLanguage || leftLanguage !== rightLanguage) return false;
  if (left.id && right.id && String(left.id) === String(right.id)) return true;
  for (const provider of ["tcgdex", "pkmnprices", "justtcg", "tcgplayer"]) {
    const leftId = left.externalIds?.[provider];
    const rightId = right.externalIds?.[provider];
    if (leftId && rightId && String(leftId) === String(rightId)) return true;
  }
  return (
    normalizedIdentityPart(left.name) === normalizedIdentityPart(right.name) &&
    normalizedIdentityPart(left.set) === normalizedIdentityPart(right.set) &&
    normalizedIdentityPart(left.number) === normalizedIdentityPart(right.number)
  );
}

function catalogPrinting(card) {
  const selectedId = card.collectibleId || card.variantId;
  const selected = (card.variantOptions || []).find(
    (option) =>
      (selectedId &&
        [option.collectibleId, option.collectible_id, option.id].includes(
          selectedId,
        )) ||
      (card.variant && option.label === card.variant),
  );
  const source = {
    ...(typeof card.variant === "object" ? card.variant : {}),
    ...selected,
    ...card,
  };
  const variantText = typeof card.variant === "string" ? card.variant : "";
  // Finish labels are not editions. Legacy holdings store their finish in
  // `variant`, while current catalog results carry a selected variant option.
  const inferredEdition = /first edition|1st edition|shadowless|parallel/i.test(
    variantText,
  )
    ? canonicalEdition(variantText)
    : "unlimited";
  return normalizeVariantOption({
    ...source,
    collectibleId:
      source.collectibleId ||
      source.collectible_id ||
      selectedId ||
      selected?.id,
    finish: canonicalFinish(source.finish || variantText),
    edition: canonicalEdition(source.edition ?? inferredEdition),
    promoType: canonicalPromoType(
      source.promoType || source.promo_type || source,
    ),
  });
}

export function sameCatalogPrinting(left, right) {
  if (!sameCatalogCard(left, right)) return false;
  const leftPrinting = catalogPrinting(left);
  const rightPrinting = catalogPrinting(right);
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if (
    uuid.test(leftPrinting.collectibleId) &&
    uuid.test(rightPrinting.collectibleId) &&
    leftPrinting.collectibleId.toLowerCase() !==
      rightPrinting.collectibleId.toLowerCase()
  )
    return false;
  return ["finish", "edition", "promoType", "language"].every(
    (field) =>
      leftPrinting[field] !== "unknown" &&
      leftPrinting[field] === rightPrinting[field],
  );
}

export function ownedCardSummary(
  card,
  items = [],
  { exactPrinting = false } = {},
) {
  const matchesCard = exactPrinting ? sameCatalogPrinting : sameCatalogCard;
  const matches = items.filter(
    (item) => Number(item.quantity) > 0 && matchesCard(item, card),
  );
  return {
    quantity: matches.reduce((sum, item) => sum + Number(item.quantity), 0),
    positions: matches.length,
  };
}

export function calculateTotals(items, { currency = null } = {}) {
  return items.reduce(
    (acc, item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const compatibleCurrency =
        !currency ||
        !item.currency ||
        String(item.currency).toUpperCase() === String(currency).toUpperCase();
      const cost = Number(item.cost);
      const price = Number(item.price);
      const hasCost =
        item.cost !== null &&
        item.cost !== undefined &&
        item.cost !== "" &&
        Number.isFinite(cost) &&
        cost >= 0;
      const hasPrice =
        item.price !== null &&
        item.price !== undefined &&
        item.price !== "" &&
        Number.isFinite(price) &&
        price >= 0 &&
        (!item.pricingStatus ||
          ["live", "manual", "manual_override"].includes(item.pricingStatus));
      acc.quantity += quantity;
      if (!compatibleCurrency) {
        acc.excludedCurrency += quantity;
        return acc;
      }
      if (hasCost) {
        acc.cost += cost * quantity;
        acc.costKnown += quantity;
      } else {
        acc.unknownCost += quantity;
      }
      if (!hasPrice) {
        acc.unpriced += quantity;
      } else {
        acc.value += price * quantity;
        acc.priced += quantity;
        if (hasCost) {
          acc.comparableValue += price * quantity;
          acc.comparableCost += cost * quantity;
          acc.gainCoverage += quantity;
        }
      }
      return acc;
    },
    {
      quantity: 0,
      cost: 0,
      costKnown: 0,
      unknownCost: 0,
      value: 0,
      priced: 0,
      unpriced: 0,
      comparableValue: 0,
      comparableCost: 0,
      gainCoverage: 0,
      excludedCurrency: 0,
    },
  );
}

export function portfolioSnapshot(
  items,
  {
    includePerformance = false,
    date = new Date().toISOString().slice(0, 10),
  } = {},
) {
  const totals = calculateTotals(items, { currency: "USD" });
  const automaticUnits = items.reduce(
    (sum, item) =>
      sum + (item.pricingStatus === "live" ? Number(item.quantity || 0) : 0),
    0,
  );
  const ownerEnteredUnits = items.reduce(
    (sum, item) =>
      sum +
      (["manual", "manual_override"].includes(item.pricingStatus)
        ? Number(item.quantity || 0)
        : 0),
    0,
  );
  const unclassifiedPricedUnits = Math.max(
    0,
    totals.priced - automaticUnits - ownerEnteredUnits,
  );
  const coverageDetails = [
    `${automaticUnits} live automatic`,
    `${ownerEnteredUnits} owner-entered`,
  ];
  if (unclassifiedPricedUnits)
    coverageDetails.push(`${unclassifiedPricedUnits} status not recorded`);
  const positions = [...items]
    .filter(
      (item) =>
        (!item.currency || String(item.currency).toUpperCase() === "USD") &&
        item.price !== null &&
        item.price !== undefined &&
        Number.isFinite(Number(item.price)) &&
        (!item.pricingStatus ||
          ["live", "manual", "manual_override"].includes(item.pricingStatus)),
    )
    .sort(
      (a, b) =>
        Number(b.price) * Number(b.quantity || 0) -
        Number(a.price) * Number(a.quantity || 0),
    )
    .slice(0, 5);
  const lines = [
    "My Mica Pokémon collection",
    `${totals.quantity} card${totals.quantity === 1 ? "" : "s"} across ${items.length} position${items.length === 1 ? "" : "s"}`,
    `Estimated collection value: ${money(totals.value)}`,
    `Pricing coverage: ${totals.priced} of ${totals.quantity} cards · ${coverageDetails.join(" · ")}`,
  ];
  if (includePerformance) {
    lines.push(
      `Recorded cost basis: ${totals.costKnown ? money(totals.cost) : "Unavailable"}`,
    );
    lines.push(
      `Known gain/loss: ${totals.gainCoverage ? `${totals.comparableValue - totals.comparableCost >= 0 ? "+" : ""}${money(totals.comparableValue - totals.comparableCost)}` : "Unavailable"}`,
    );
  }
  if (positions.length) {
    lines.push("", "Top positions:");
    positions.forEach((item, index) =>
      lines.push(
        `${index + 1}. ${item.name} · ${item.set} ${item.number} · ${money(Number(item.price) * Number(item.quantity || 0))} · ${compactPricingEvidence(item)}`,
      ),
    );
  }
  lines.push(
    "",
    `Snapshot ${date} · Market references and any owner-entered values are estimates, not an appraisal.`,
    "Shared from Mica",
  );
  return lines.join("\n");
}

function compactPricingEvidence(item) {
  if (["manual", "manual_override"].includes(item?.pricingStatus))
    return "owner-entered value; no market source or confidence";
  const status = String(
    item?.pricingStatus || "status not recorded",
  ).replaceAll("_", " ");
  const provider = item?.referenceProvider || "source not recorded";
  const aggregator = item?.referenceAggregator
    ? ` via ${item.referenceAggregator}`
    : "";
  const observed = item?.referenceObservedAt
    ? ` · observed ${String(item.referenceObservedAt).slice(0, 10)}`
    : " · observation date not recorded";
  const confidence = item?.pricingConfidence
    ? ` · ${item.pricingConfidence}`
    : " · confidence not recorded";
  return `${provider}${aggregator} · ${status}${observed}${confidence}`;
}

function publicInventoryContext(item) {
  if (item.cardState === "sealed" || item.productType) return "Sealed";
  if (item.gradingCompany)
    return `${item.gradingCompany} ${item.grade || "grade not recorded"}`;
  return `Raw · ${item.condition || "condition not recorded"}`;
}

export function selectedInventoryShare(
  items,
  {
    mode = "showcase",
    includeCertification = false,
    date = new Date().toISOString().slice(0, 10),
  } = {},
) {
  const priceMode = ["asking", "market"].includes(mode) ? mode : "showcase";
  const positions = (items || []).filter(
    (item) =>
      Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0,
  );
  const rows = positions.map((item) => {
    const candidate =
      priceMode === "asking"
        ? item.status === "listed"
          ? item.askingPrice
          : null
        : priceMode === "market" && item.pricingStatus === "live"
          ? item.price
          : null;
    const numericPrice = Number(candidate);
    const priceEach =
      candidate !== null &&
      candidate !== undefined &&
      candidate !== "" &&
      Number.isFinite(numericPrice) &&
      numericPrice >= 0
        ? numericPrice
        : null;
    return {
      name: item.name || "Unknown item",
      set: item.set || "Set unavailable",
      number: item.number || "",
      language: item.language || "en",
      variant: item.variant || "Printing unknown",
      cardState: item.cardState || (item.gradingCompany ? "graded" : "raw"),
      context: publicInventoryContext(item),
      certificationNumber:
        includeCertification && item.gradingCompany
          ? item.certificationNumber || ""
          : "",
      quantity: Number(item.quantity),
      priceEach,
      priceKind:
        priceMode === "asking"
          ? "Asking price"
          : priceMode === "market"
            ? "Current market reference"
            : "Not shared",
      currency: item.currency || "USD",
      pricingStatus:
        priceMode === "asking"
          ? priceEach === null
            ? "ask_not_set"
            : "owner_asking_price"
          : priceMode === "market"
            ? priceEach === null
              ? "unavailable"
              : "live_exact_reference"
            : "not_shared",
      referenceProvider:
        priceMode === "market" && priceEach !== null
          ? item.referenceProvider || "Matching provider"
          : "",
      referenceAggregator:
        priceMode === "market" && priceEach !== null
          ? item.referenceAggregator || ""
          : "",
      referenceObservedAt:
        priceMode === "market" && priceEach !== null
          ? String(
              item.referenceObservedAt || item.pricingUpdatedAt || "",
            ).slice(0, 10)
          : "",
      pricingConfidence:
        priceMode === "market" && priceEach !== null
          ? item.pricingConfidence || "Confidence not recorded"
          : "",
    };
  });
  const units = rows.reduce((sum, row) => sum + row.quantity, 0);
  const priced = rows.filter((row) => row.priceEach !== null);
  const textRows = rows.slice(0, 50);
  const lines = [
    priceMode === "asking"
      ? "Selected Pokémon cards available"
      : "Selected Mica Pokémon collection list",
    `${units} item${units === 1 ? "" : "s"} across ${rows.length} position${rows.length === 1 ? "" : "s"}`,
    "",
  ];
  textRows.forEach((row, index) => {
    const identity = `${row.name} · ${row.set}${row.number ? ` ${row.number}` : ""} · ${row.variant} · ${row.context}${row.certificationNumber ? ` · Cert ${row.certificationNumber}` : ""} · Qty ${row.quantity}`;
    const price =
      priceMode === "showcase"
        ? ""
        : ` · ${row.priceKind}: ${row.priceEach === null ? "Not available" : `${money(row.priceEach, row.currency)} each${priceMode === "market" ? ` · ${row.referenceProvider}${row.referenceAggregator ? ` via ${row.referenceAggregator}` : ""}${row.referenceObservedAt ? ` · observed ${row.referenceObservedAt}` : " · observation date not recorded"} · ${row.pricingConfidence}` : ""}`}`;
    lines.push(`${index + 1}. ${identity}${price}`);
  });
  const omittedFromText = rows.length - textRows.length;
  if (omittedFromText)
    lines.push(
      `…and ${omittedFromText} more position${omittedFromText === 1 ? "" : "s"}. Use the CSV for the complete list.`,
    );
  if (priceMode !== "showcase") {
    lines.push(
      "",
      `${priceMode === "asking" ? "Asking-price" : "Live exact-reference"} coverage: ${priced.length} of ${rows.length} positions`,
    );
    if (priced.length === rows.length && rows.length) {
      const totals = new Map();
      rows.forEach((row) =>
        totals.set(
          row.currency,
          (totals.get(row.currency) || 0) + row.priceEach * row.quantity,
        ),
      );
      lines.push(
        `${priceMode === "asking" ? "Total asking value" : "Total market reference"}: ${[...totals].map(([currency, value]) => money(value, currency)).join(" + ")}`,
      );
    } else {
      lines.push(
        "Total unavailable until every selected position has a price.",
      );
    }
  }
  lines.push(
    "",
    priceMode === "asking"
      ? "Owner-entered asking prices; availability and final terms must be confirmed."
      : priceMode === "market"
        ? "Matching live market references, not asking prices, completed sales, or appraisals."
        : "Showcase only; no purchase costs, market values, or asking prices included.",
    `Prepared ${date} · Shared from Mica`,
  );

  const headers = [
    "name",
    "set",
    "number",
    "language",
    "variant",
    "card_state",
    "condition_or_grade",
    "certification_number",
    "quantity",
    "price_kind",
    "price_each",
    "currency",
    "pricing_status",
    "reference_provider",
    "reference_aggregator",
    "reference_observed_at",
    "pricing_confidence",
  ];
  const csvRows = rows.map((row) =>
    [
      row.name,
      row.set,
      row.number,
      row.language,
      row.variant,
      row.cardState,
      row.context,
      row.certificationNumber,
      row.quantity,
      row.priceKind,
      row.priceEach ?? "",
      row.currency,
      row.pricingStatus,
      row.referenceProvider,
      row.referenceAggregator,
      row.referenceObservedAt,
      row.pricingConfidence,
    ]
      .map(safeCsvCell)
      .join(","),
  );
  return {
    text: lines.join("\n"),
    csv: [headers.join(","), ...csvRows].join("\r\n"),
    positions: rows.length,
    units,
    pricedPositions: priced.length,
    omittedFromText,
    mode: priceMode,
  };
}

export function isStale(updatedAt, now = Date.now(), thresholdDays = 7) {
  const observed = new Date(updatedAt).getTime();
  return (
    !Number.isFinite(observed) || now - observed > thresholdDays * 86400000
  );
}

export function safeCsvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function collectionToCsv(items) {
  const headers = [
    "provider_card_id",
    "name",
    "set",
    "set_id",
    "number",
    "language",
    "variant",
    "card_state",
    "product_type",
    "condition",
    "raw_condition",
    "grading_company",
    "grade",
    "certification_number",
    "quantity",
    "purchase_date",
    "purchase_price_each",
    "total_acquisition_cost",
    "currency",
    "market_reference",
    "market_reference_status",
    "market_reference_provider",
    "market_reference_aggregator",
    "market_reference_observed_at",
    "market_reference_confidence",
    "tags",
    "digital_folder",
    "storage_location",
    "custom_fields_json",
    "notes",
  ];
  const rows = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const totalCost =
      item.costBasis !== null &&
      item.costBasis !== undefined &&
      item.costBasis !== ""
        ? Number(item.costBasis)
        : item.cost !== null && item.cost !== undefined && item.cost !== ""
          ? Number(item.cost) * quantity
          : "";
    return [
      item.id,
      item.name,
      item.set,
      item.setId,
      item.number,
      item.language || "en",
      item.variant,
      item.cardState || (item.gradingCompany ? "graded" : "raw"),
      item.productType,
      item.condition,
      item.rawCondition,
      item.gradingCompany,
      item.grade,
      item.certificationNumber,
      item.quantity,
      item.purchaseDate,
      item.cost,
      totalCost,
      item.currency || "USD",
      item.price,
      item.pricingStatus || "",
      item.referenceProvider || "",
      item.referenceAggregator || "",
      item.referenceObservedAt || item.pricingUpdatedAt || "",
      item.pricingConfidence || "",
      (item.tags || []).join("|"),
      item.folderName || "",
      item.location,
      Object.keys(item.customFields || {}).length
        ? JSON.stringify(item.customFields)
        : "",
      item.notes,
    ]
      .map(safeCsvCell)
      .join(",");
  });
  return [headers.join(","), ...rows].join("\r\n");
}

export function accountBackupJson({
  items = [],
  watchlist = [],
  accountEmail = "",
  exportedAt = new Date().toISOString(),
} = {}) {
  const collection = items.map((item) => ({
    positionId: item.uid || null,
    providerCardId: item.id || null,
    cardId: item.cardId || null,
    name: item.name || "",
    set: item.set || "",
    setId: item.setId || "",
    number: item.number || "",
    language: item.language || "en",
    variant: item.variant || "",
    cardState: item.cardState || (item.gradingCompany ? "graded" : "raw"),
    productType: item.productType || null,
    externalIds:
      item.externalIds && typeof item.externalIds === "object"
        ? { ...item.externalIds }
        : {},
    condition: item.condition || "",
    rawCondition: item.rawCondition || null,
    gradingCompany: item.gradingCompany || null,
    grade: item.grade || null,
    certificationNumber: item.certificationNumber || null,
    quantity: Number(item.quantity) || 0,
    currency: item.currency || "USD",
    totalAcquisitionCost:
      item.costBasis === null || item.costBasis === undefined
        ? null
        : Number(item.costBasis),
    currentMarketReference:
      item.price === null || item.price === undefined
        ? null
        : Number(item.price),
    marketReferenceEvidence: {
      status: item.pricingStatus || null,
      provider: item.referenceProvider || null,
      aggregator: item.referenceAggregator || null,
      observedAt: item.referenceObservedAt || item.pricingUpdatedAt || null,
      retrievedAt: item.referenceRetrievedAt || null,
      confidence: item.pricingConfidence || null,
      confidenceScore:
        item.pricingConfidenceScore === null ||
        item.pricingConfidenceScore === undefined
          ? null
          : Number(item.pricingConfidenceScore),
    },
    firstPurchaseDate: item.purchaseDate || null,
    labels: [...(item.tags || [])],
    digitalFolder: item.folderName || "",
    storageLocation: item.location || "",
    customFields:
      item.customFields && typeof item.customFields === "object"
        ? { ...item.customFields }
        : {},
    notes: item.notes || "",
    transactions: (item.transactions || []).map((transaction) => ({
      type: transaction.type,
      date: transaction.date,
      quantity: Number(transaction.quantity),
      unitAmount:
        transaction.unitPrice === null || transaction.unitPrice === undefined
          ? null
          : Number(transaction.unitPrice),
      totalAcquisitionCost:
        transaction.totalCost === null || transaction.totalCost === undefined
          ? null
          : Number(transaction.totalCost),
      grossSale:
        transaction.subtotal === null || transaction.subtotal === undefined
          ? null
          : Number(transaction.subtotal),
      netProceeds:
        transaction.netProceeds === null ||
        transaction.netProceeds === undefined
          ? null
          : Number(transaction.netProceeds),
      fifoSoldBasis:
        transaction.allocatedCost === null ||
        transaction.allocatedCost === undefined
          ? null
          : Number(transaction.allocatedCost),
      realizedGain:
        transaction.realizedGain === null ||
        transaction.realizedGain === undefined
          ? null
          : Number(transaction.realizedGain),
      currency: transaction.currency || item.currency || "USD",
      marketplace: transaction.marketplace || "",
      notes: transaction.notes || "",
    })),
    purchaseLots: (item.lots || []).map((lot) => ({
      acquiredAt: lot.acquisitionDateKnown === false ? null : lot.acquiredAt,
      quantityAcquired: Number(lot.quantityAcquired),
      quantityRemaining: Number(lot.quantityRemaining),
      totalCost: lot.totalCost == null ? null : Number(lot.totalCost),
      remainingCost:
        lot.remainingCost == null ? null : Number(lot.remainingCost),
      costBasisKnown: lot.costBasisKnown !== false,
      acquisitionDateKnown: lot.acquisitionDateKnown !== false,
      currency: lot.currency || item.currency || "USD",
    })),
  }));
  const watchedCards = watchlist.map((item) => ({
    providerCardId: item.id || null,
    cardId: item.cardId || null,
    name: item.name || "",
    set: item.set || "",
    setId: item.setId || "",
    number: item.number || "",
    language: item.language || "en",
    variant: item.variant || "",
    cardState: item.cardState || (item.gradingCompany ? "graded" : "raw"),
    condition: item.condition || "",
    rawCondition: item.rawCondition || null,
    gradingCompany: item.gradingCompany || null,
    grade: item.grade || null,
    targetPrice:
      item.targetPrice === null || item.targetPrice === undefined
        ? null
        : Number(item.targetPrice),
    startingMarketPrice:
      item.startingMarketPrice === null ||
      item.startingMarketPrice === undefined
        ? null
        : Number(item.startingMarketPrice),
    currentMarketReference:
      item.currentPrice === null || item.currentPrice === undefined
        ? null
        : Number(item.currentPrice),
    marketReferenceEvidence: {
      status: item.pricingStatus || null,
      provider: item.referenceProvider || null,
      aggregator: item.referenceAggregator || null,
      observedAt: item.referenceObservedAt || item.pricingUpdatedAt || null,
      retrievedAt: item.referenceRetrievedAt || null,
      confidence: item.pricingConfidence || null,
      confidenceScore:
        item.pricingConfidenceScore === null ||
        item.pricingConfidenceScore === undefined
          ? null
          : Number(item.pricingConfidenceScore),
    },
    currency: item.currency || "USD",
    notes: item.notes || "",
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  }));
  return JSON.stringify(
    {
      format: "mica-account-backup",
      version: 1,
      exportedAt,
      account: { email: accountEmail },
      collection,
      watchlist: watchedCards,
    },
    null,
    2,
  );
}

export function transactionReportCsv(
  positions,
  { from = "0000-01-01", to = "9999-12-31", currency = "USD" } = {},
) {
  const headers = [
    "date",
    "type",
    "card",
    "set",
    "number",
    "quantity",
    "currency",
    "unit_amount",
    "total_acquisition_cost",
    "gross_sale",
    "net_proceeds",
    "fifo_sold_basis",
    "realized_profit",
    "marketplace",
  ];
  const rows = positions
    .flatMap((position) =>
      (position.transactions || []).map((transaction) => ({
        position,
        transaction,
      })),
    )
    .filter(
      ({ position, transaction }) =>
        transaction.date >= from &&
        transaction.date <= to &&
        (transaction.currency || position.currency || "USD") === currency,
    )
    .sort(
      (left, right) =>
        left.transaction.date.localeCompare(right.transaction.date) ||
        String(left.position.name || "").localeCompare(
          String(right.position.name || ""),
        ),
    )
    .map(({ position, transaction }) => {
      const sale = transaction.type === "sale";
      const realized =
        sale &&
        transaction.allocatedCost !== null &&
        transaction.allocatedCost !== undefined &&
        transaction.netProceeds !== null &&
        transaction.netProceeds !== undefined
          ? Number(transaction.netProceeds) - Number(transaction.allocatedCost)
          : "";
      return [
        transaction.date,
        transaction.type,
        position.name,
        position.set,
        position.number,
        transaction.quantity,
        transaction.currency || position.currency || currency,
        transaction.unitPrice ?? "",
        sale ? "" : (transaction.totalCost ?? ""),
        sale ? (transaction.subtotal ?? "") : "",
        sale ? (transaction.netProceeds ?? "") : "",
        sale ? (transaction.allocatedCost ?? "") : "",
        realized,
        transaction.marketplace || "",
      ]
        .map(safeCsvCell)
        .join(",");
    });
  return [headers.join(","), ...rows].join("\r\n");
}

export function missingSetChecklist(catalog, ownedIds = new Set()) {
  const normalize = (value) =>
    String(value ?? "")
      .toUpperCase()
      .replace(/^0+/, "")
      .replace(/[^A-Z0-9]/g, "");
  const owned = new Set(
    [...(ownedIds instanceof Set ? ownedIds : new Set(ownedIds || []))].map(
      normalize,
    ),
  );
  const missing = (catalog?.cards || []).filter(
    (card) => !owned.has(normalize(card.localId)),
  );
  const lines = [
    `Missing from ${catalog?.name || "Pokémon set"}`,
    `${missing.length} of ${catalog?.totalCount || catalog?.cards?.length || 0} cards missing`,
    "",
    ...missing.map((card) => `#${card.localId} ${card.name}`),
    "",
    "Shared from Mica",
  ];
  return lines.join("\n");
}

function csvRows(text) {
  const source = String(text);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export const COLLECTION_IMPORT_FIELDS = Object.freeze([
  { key: "name", label: "Card name", required: true },
  { key: "quantity", label: "Quantity", required: true },
  { key: "set", label: "Set" },
  { key: "number", label: "Collector number" },
  { key: "language", label: "Language" },
  { key: "variant", label: "Printing / variant" },
  { key: "condition", label: "Condition" },
  { key: "gradingCompany", label: "Grading company" },
  { key: "grade", label: "Grade" },
  { key: "certificationNumber", label: "Certification number" },
  { key: "unitCost", label: "Purchase price each" },
  { key: "totalCost", label: "Total acquisition cost" },
  { key: "purchaseDate", label: "Purchase date" },
  { key: "currency", label: "Currency" },
  { key: "tags", label: "Tags / labels" },
  { key: "folder", label: "Digital folder" },
  { key: "location", label: "Storage location" },
  { key: "customFields", label: "Custom fields JSON" },
  { key: "notes", label: "Notes" },
  { key: "tcgplayerId", label: "TCGplayer product ID" },
]);

const COLLECTION_IMPORT_ALIASES = Object.freeze({
  name: ["name", "product_name", "card_name"],
  quantity: ["quantity", "total_quantity", "count", "qty"],
  set: ["set", "set_name"],
  number: ["number", "card_number", "collector_number"],
  language: ["language", "card_language"],
  variant: ["variant", "printing", "variance"],
  condition: ["raw_condition", "condition"],
  gradingCompany: ["grading_company", "grader"],
  grade: ["grade", "card_grade"],
  certificationNumber: ["certification_number", "cert_number"],
  unitCost: ["purchase_price_each", "purchase_price", "cost_each", "unit_cost"],
  totalCost: ["total_acquisition_cost", "purchase_cost", "cost_basis"],
  purchaseDate: ["purchase_date", "acquired_at", "date_purchased"],
  currency: ["currency", "purchase_currency"],
  tags: ["tags", "labels"],
  folder: ["digital_folder", "folder", "collection"],
  location: ["storage_location", "location"],
  customFields: ["custom_fields_json", "custom_fields"],
  notes: ["notes", "note"],
  tcgplayerId: ["product_id", "tcgplayer_id"],
});

export function normalizeImportHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function collectionCsvSource(headers) {
  return headers.includes("product_line") &&
    headers.includes("product_name") &&
    (headers.includes("tcgplayer_id") || headers.includes("product_id"))
    ? "TCGplayer"
    : headers.includes("provider_card_id")
      ? "Mica"
      : "Generic CSV";
}

export function inspectCollectionCsv(text, limit = 5000) {
  const rows = csvRows(text);
  if (!rows.length)
    return {
      headers: [],
      normalizedHeaders: [],
      suggestedMapping: {},
      source: "Generic CSV",
      rowCount: 0,
      errors: ["No header row found"],
    };
  const headers = rows[0].map((value) => String(value || "").trim());
  const normalizedHeaders = headers.map(normalizeImportHeader);
  const duplicates = normalizedHeaders.filter(
    (header, index) => header && normalizedHeaders.indexOf(header) !== index,
  );
  const suggestedMapping = Object.fromEntries(
    COLLECTION_IMPORT_FIELDS.map(({ key }) => [
      key,
      COLLECTION_IMPORT_ALIASES[key]?.find((name) =>
        normalizedHeaders.includes(name),
      ) || "",
    ]),
  );
  const errors = [];
  if (duplicates.length)
    errors.push(
      `Duplicate column name${duplicates.length === 1 ? "" : "s"}: ${[
        ...new Set(duplicates),
      ].join(", ")}`,
    );
  if (rows.length < 2) errors.push("No data rows found");
  return {
    headers,
    normalizedHeaders,
    suggestedMapping,
    source: collectionCsvSource(normalizedHeaders),
    rowCount: Math.min(Math.max(0, rows.length - 1), limit),
    totalRowCount: Math.max(0, rows.length - 1),
    truncated: rows.length - 1 > limit,
    headerSignature: [...normalizedHeaders].sort().join("|"),
    errors,
  };
}

export function parseCollectionCsv(text, limitOrOptions = 5000) {
  const options =
    typeof limitOrOptions === "object" && limitOrOptions
      ? limitOrOptions
      : { limit: limitOrOptions };
  const limit = Math.min(
    5000,
    Math.max(1, Math.floor(Number(options.limit) || 5000)),
  );
  const rows = csvRows(text);
  if (rows.length < 2) return { records: [], errors: ["No data rows found"] };
  const headers = rows[0].map(normalizeImportHeader);
  const mapping = Object.fromEntries(
    Object.entries(options.mapping || {}).map(([key, value]) => [
      key,
      normalizeImportHeader(value),
    ]),
  );
  const headerFor = (key) =>
    (mapping[key] && headers.includes(mapping[key]) ? mapping[key] : "") ||
    COLLECTION_IMPORT_ALIASES[key]?.find((name) => headers.includes(name));
  const missing = ["name", "quantity"].filter((key) => !headerFor(key));
  if (missing.length)
    return {
      records: [],
      errors: [
        `Missing required column${missing.length === 1 ? "" : "s"}: ${missing.map((key) => COLLECTION_IMPORT_ALIASES[key].join(" / ")).join(", ")}`,
      ],
    };
  const detectedSource = collectionCsvSource(headers);
  const records = [];
  const errors = [];
  rows.slice(1, limit + 1).forEach((values, rowIndex) => {
    const source = Object.fromEntries(
      headers.map((header, index) => [
        header,
        String(values[index] ?? "").trim(),
      ]),
    );
    const pick = (...keys) => {
      const key =
        keys.find(
          (candidate) =>
            source[candidate] !== undefined && source[candidate] !== "",
        ) || keys.find((candidate) => source[candidate] !== undefined);
      return key ? source[key] : "";
    };
    const field = (key, ...fallback) =>
      pick(
        headerFor(key),
        ...(COLLECTION_IMPORT_ALIASES[key] || []),
        ...fallback,
      );
    const name = field("name");
    const quantity = Number(field("quantity"));
    const costSource = field("unitCost");
    const cost = costSource === "" ? null : Number(costSource);
    const totalSource = field("totalCost");
    const totalAcquisitionCost =
      totalSource === "" ? null : Number(totalSource);
    const marketSource = pick(
      "market_reference",
      "tcg_market_price",
      "market_price",
    );
    const price = marketSource === "" ? null : Number(marketSource);
    if (!name) {
      errors.push(`Row ${rowIndex + 2}: card name is blank`);
      return;
    }
    if (
      source.product_line &&
      !String(source.product_line).toLowerCase().includes("pokemon")
    ) {
      errors.push(`Row ${rowIndex + 2}: ${source.product_line} is not Pokémon`);
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      errors.push(
        `Row ${rowIndex + 2}: quantity must be a whole number from 1 to 999`,
      );
      return;
    }
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      errors.push(`Row ${rowIndex + 2}: purchase price is invalid`);
      return;
    }
    if (
      totalAcquisitionCost !== null &&
      (!Number.isFinite(totalAcquisitionCost) || totalAcquisitionCost < 0)
    ) {
      errors.push(`Row ${rowIndex + 2}: total acquisition cost is invalid`);
      return;
    }
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      errors.push(`Row ${rowIndex + 2}: market reference is invalid`);
      return;
    }
    const originalCondition = field("condition");
    const condition =
      originalCondition.match(
        /^(near mint|lightly played|moderately played|heavily played|damaged)/i,
      )?.[1] || originalCondition;
    const printing = field("variant");
    const variant = printing
      ? /^foil$/i.test(printing)
        ? "Holofoil"
        : printing
      : /reverse\s+holo/i.test(originalCondition)
        ? "Reverse Holofoil"
        : /\b(?:holo)?foil\b/i.test(originalCondition)
          ? "Holofoil"
          : "Unknown";
    const tcgplayerId = field("tcgplayerId");
    let customFields = {};
    const customFieldSource = field("customFields");
    if (customFieldSource) {
      try {
        const parsed = JSON.parse(customFieldSource);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("not an object");
        customFields = parsed;
      } catch {
        errors.push(`Row ${rowIndex + 2}: custom fields must be a JSON object`);
        return;
      }
    }
    const record = {
      name,
      set: field("set") || "",
      number: field("number") || "",
      variant,
      condition,
      gradingCompany: field("gradingCompany") || "",
      grade: field("grade") || "",
      quantity,
      cost,
      price,
      tags: field("tags")
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean),
      folder: field("folder") || "",
      location: field("location") || "",
      customFields,
      notes: field("notes") || "",
      source: detectedSource,
    };
    if (source.provider_card_id) record.id = source.provider_card_id;
    else if (tcgplayerId) record.id = `tcgplayer:${tcgplayerId}`;
    if (tcgplayerId) record.externalIds = { tcgplayer: tcgplayerId };
    if (pick("set_id", "set_code")) record.setId = pick("set_id", "set_code");
    if (field("language")) record.language = field("language");
    if (source.card_state) record.cardState = source.card_state;
    if (source.product_type) record.productType = source.product_type;
    if (source.raw_condition) record.rawCondition = source.raw_condition;
    if (field("certificationNumber"))
      record.certificationNumber = field("certificationNumber");
    if (field("purchaseDate")) record.purchaseDate = field("purchaseDate");
    if (totalAcquisitionCost !== null)
      record.totalAcquisitionCost = totalAcquisitionCost;
    if (field("currency")) record.currency = field("currency").toUpperCase();
    records.push(record);
  });
  if (rows.length - 1 > limit)
    errors.push(`Only the first ${limit} records can be imported at once`);
  return { records, errors, source: detectedSource };
}

export function normalizeSearch(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

export function matchesSearch(item, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch(
    [
      item.name,
      item.set,
      item.number,
      item.variant,
      item.rarity,
      item.condition,
      item.rawCondition,
      item.gradingCompany,
      item.grade,
      item.purchaseDate,
      item.certificationNumber,
      item.location,
      ...(item.tags || []),
    ].join(" "),
  );
  return q.split(" ").every((token) => haystack.includes(token));
}
