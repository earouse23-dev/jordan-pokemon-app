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
    tags: [...(record.tags || [])].map(String).sort((a, b) => a.localeCompare(b)),
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
      options.onProgress?.({ completed, succeeded, failed, total: items.length });
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
  if (left.id && right.id && String(left.id) === String(right.id)) return true;
  for (const provider of ["tcgdex", "pkmnprices", "justtcg", "tcgplayer"]) {
    const leftId = left.externalIds?.[provider];
    const rightId = right.externalIds?.[provider];
    if (leftId && rightId && String(leftId) === String(rightId)) return true;
  }
  const leftLanguage = String(left.language || "en").toLowerCase();
  const rightLanguage = String(right.language || "en").toLowerCase();
  return (
    leftLanguage === rightLanguage &&
    normalizedIdentityPart(left.name) === normalizedIdentityPart(right.name) &&
    normalizedIdentityPart(left.set) === normalizedIdentityPart(right.set) &&
    normalizedIdentityPart(left.number) === normalizedIdentityPart(right.number)
  );
}

export function ownedCardSummary(card, items = []) {
  const matches = items.filter(
    (item) => Number(item.quantity) > 0 && sameCatalogCard(item, card),
  );
  return {
    quantity: matches.reduce((sum, item) => sum + Number(item.quantity), 0),
    positions: matches.length,
  };
}

export function calculateTotals(items) {
  return items.reduce(
    (acc, item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
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
        price >= 0;
      acc.quantity += quantity;
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
  const totals = calculateTotals(items);
  const positions = [...items]
    .filter(
      (item) =>
        item.price !== null &&
        item.price !== undefined &&
        Number.isFinite(Number(item.price)),
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
    `Estimated market value: ${money(totals.value)}`,
    `Pricing coverage: ${totals.priced} of ${totals.quantity} cards`,
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
        `${index + 1}. ${item.name} · ${item.set} ${item.number} · ${money(Number(item.price) * Number(item.quantity || 0))}`,
      ),
    );
  }
  lines.push(
    "",
    `Snapshot ${date} · Matching market references, not an appraisal.`,
    "Shared from Mica",
  );
  return lines.join("\n");
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
    "tags",
    "storage_location",
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
      (item.tags || []).join("|"),
      item.location,
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
    firstPurchaseDate: item.purchaseDate || null,
    labels: [...(item.tags || [])],
    storageLocation: item.location || "",
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

export function parseCollectionCsv(text, limit = 5000) {
  const rows = csvRows(text);
  if (rows.length < 2) return { records: [], errors: ["No data rows found"] };
  const headers = rows[0].map((value) =>
    value
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, ""),
  );
  const aliases = {
    name: ["name", "product_name", "card_name"],
    quantity: ["quantity", "total_quantity", "count", "qty"],
  };
  const headerFor = (key) => aliases[key].find((name) => headers.includes(name));
  const missing = Object.keys(aliases).filter((key) => !headerFor(key));
  if (missing.length)
    return {
      records: [],
      errors: [
        `Missing required column${missing.length === 1 ? "" : "s"}: ${missing.map((key) => aliases[key].join(" / ")).join(", ")}`,
      ],
    };
  const detectedSource =
    headers.includes("product_line") &&
    headers.includes("product_name") &&
    (headers.includes("tcgplayer_id") || headers.includes("product_id"))
      ? "TCGplayer"
      : headers.includes("provider_card_id")
        ? "Mica"
        : "Generic CSV";
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
    const name = pick("name", "product_name", "card_name");
    const quantity = Number(pick("quantity", "total_quantity", "count", "qty"));
    const costSource =
      pick("purchase_price_each", "purchase_price", "cost_each", "unit_cost");
    const cost = costSource === "" ? null : Number(costSource);
    const totalSource = pick(
      "total_acquisition_cost",
      "purchase_cost",
      "cost_basis",
    );
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
    const originalCondition = pick("raw_condition", "condition") || "Near Mint";
    const condition =
      originalCondition.match(
        /^(near mint|lightly played|moderately played|heavily played|damaged)/i,
      )?.[1] || originalCondition;
    const printing = pick("variant", "printing", "variance");
    const variant = printing
      ? /^foil$/i.test(printing)
        ? "Holofoil"
        : printing
      : /reverse\s+holo/i.test(originalCondition)
        ? "Reverse Holofoil"
        : /\b(?:holo)?foil\b/i.test(originalCondition)
          ? "Holofoil"
          : "Unknown";
    const tcgplayerId = pick("product_id", "tcgplayer_id");
    const record = {
      name,
      set: pick("set", "set_name") || "",
      number: pick("number", "card_number", "collector_number") || "",
      variant,
      condition,
      gradingCompany: pick("grading_company", "grader") || "",
      grade: pick("grade", "card_grade") || "",
      quantity,
      cost,
      price,
      tags: pick("tags", "labels")
        .split("|")
        .map((value) => value.trim())
        .filter(Boolean),
      location: pick("storage_location", "location") || "",
      notes: pick("notes", "note") || "",
      source: detectedSource,
    };
    if (source.provider_card_id) record.id = source.provider_card_id;
    else if (tcgplayerId) record.id = `tcgplayer:${tcgplayerId}`;
    if (tcgplayerId) record.externalIds = { tcgplayer: tcgplayerId };
    if (pick("set_id", "set_code")) record.setId = pick("set_id", "set_code");
    if (pick("language", "card_language"))
      record.language = pick("language", "card_language");
    if (source.card_state) record.cardState = source.card_state;
    if (source.product_type) record.productType = source.product_type;
    if (source.raw_condition) record.rawCondition = source.raw_condition;
    if (source.certification_number)
      record.certificationNumber = source.certification_number;
    if (pick("purchase_date", "acquired_at", "date_purchased"))
      record.purchaseDate = pick(
        "purchase_date",
        "acquired_at",
        "date_purchased",
      );
    if (totalAcquisitionCost !== null)
      record.totalAcquisitionCost = totalAcquisitionCost;
    if (pick("currency", "purchase_currency"))
      record.currency = pick("currency", "purchase_currency").toUpperCase();
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
