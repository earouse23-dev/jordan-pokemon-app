function decimalParts(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^(-?)(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return null;
  return {
    negative: Boolean(match[1]),
    whole: match[2],
    fraction: (match[3] || "").padEnd(2, "0"),
  };
}

export function toMinorUnits(value) {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  const parts = decimalParts(value);
  if (!parts) return null;
  const amount = Number(BigInt(parts.whole) * 100n + BigInt(parts.fraction));
  return parts.negative ? -amount : amount;
}

export function fromMinorUnits(value) {
  return Number(value || 0) / 100;
}

export function watchPerformance({ startingPrice, currentPrice }) {
  const startingMinor = toMinorUnits(startingPrice);
  const currentMinor = toMinorUnits(currentPrice);
  if (
    startingMinor === null ||
    startingMinor <= 0 ||
    currentMinor === null ||
    currentMinor < 0
  )
    return null;
  const changeMinor = currentMinor - startingMinor;
  return {
    startingMinor,
    currentMinor,
    changeMinor,
    changePercent: Number(((changeMinor / startingMinor) * 100).toFixed(4)),
  };
}

export function targetAlertChanges(items, previous = {}) {
  const notifications = [];
  const next = {};
  for (const item of items || []) {
    const id = String(item.watchlistId || item.id || "");
    const targetMinor = toMinorUnits(item.targetPrice);
    const currentMinor = toMinorUnits(item.currentPrice);
    if (!id || targetMinor === null || currentMinor === null) continue;
    if (currentMinor <= targetMinor) {
      const key = `${item.currency || "USD"}:${targetMinor}`;
      next[id] = key;
      if (previous[id] !== key) notifications.push(item);
    }
  }
  return { notifications, next };
}

export function insuranceDocumentation(items = []) {
  const result = {
    positions: items.length,
    cards: 0,
    missingLocation: 0,
    missingCertification: 0,
    missingCost: 0,
    missingPrice: 0,
  };
  for (const item of items) {
    result.cards += Math.max(0, Number(item.quantity) || 0);
    if (!String(item.location || "").trim()) result.missingLocation += 1;
    if (
      (item.cardState === "graded" || item.gradingCompany) &&
      !String(item.certificationNumber || "").trim()
    )
      result.missingCertification += 1;
    if (
      item.costBasis === null ||
      item.costBasis === undefined ||
      !Number.isFinite(Number(item.costBasis))
    )
      result.missingCost += 1;
    if (
      item.price === null ||
      item.price === undefined ||
      !Number.isFinite(Number(item.price))
    )
      result.missingPrice += 1;
  }
  return result;
}

export function acquisitionTotal(input) {
  const quantity = Number(input.quantity);
  const unit = toMinorUnits(input.unitPrice);
  if (!Number.isInteger(quantity) || quantity <= 0 || unit === null || unit < 0)
    return null;
  const costs = [
    "tax",
    "shipping",
    "marketplaceFees",
    "gradingFees",
    "otherCosts",
  ].map((key) => toMinorUnits(input[key] ?? 0));
  if (costs.some((value) => value === null || value < 0)) return null;
  return unit * quantity + costs.reduce((sum, value) => sum + value, 0);
}

export function acquisitionFromTotal(total, quantity) {
  const totalMinor = toMinorUnits(total);
  const count = Number(quantity);
  if (
    totalMinor === null ||
    totalMinor < 0 ||
    !Number.isInteger(count) ||
    count <= 0
  )
    return null;
  const unitMinor = Math.floor(totalMinor / count);
  const remainderMinor = totalMinor - unitMinor * count;
  return {
    unitPrice: (unitMinor / 100).toFixed(2),
    tax: "0.00",
    shipping: "0.00",
    marketplaceFees: "0.00",
    gradingFees: "0.00",
    otherCosts: (remainderMinor / 100).toFixed(2),
    totalMinor,
  };
}

export function gradingEstimate({
  serviceFee,
  quantity = 1,
  shipping = 0,
  insurance = 0,
}) {
  const count = Number(quantity);
  const fee = toMinorUnits(serviceFee);
  const shippingMinor = toMinorUnits(shipping);
  const insuranceMinor = toMinorUnits(insurance);
  if (
    !Number.isInteger(count) ||
    count <= 0 ||
    [fee, shippingMinor, insuranceMinor].some(
      (value) => value === null || value < 0,
    )
  )
    return null;
  return fee * count + shippingMinor + insuranceMinor;
}

export function gradingDecision({
  rawValue,
  expectedGradedValue,
  quantity = 1,
  gradingCost,
  sellingCosts = 0,
  acquisitionCostPerCard = null,
}) {
  const count = Number(quantity);
  const raw = toMinorUnits(rawValue);
  const graded = toMinorUnits(expectedGradedValue);
  const grading = Number(gradingCost);
  const selling = toMinorUnits(sellingCosts);
  const acquisition =
    acquisitionCostPerCard == null
      ? null
      : toMinorUnits(acquisitionCostPerCard);
  if (
    !Number.isInteger(count) ||
    count <= 0 ||
    [raw, graded, selling].some((value) => value === null || value < 0) ||
    !Number.isInteger(grading) ||
    grading < 0 ||
    (acquisitionCostPerCard != null &&
      (acquisition === null || acquisition < 0))
  )
    return null;
  const rawTotal = raw * count;
  const expectedTotal = graded * count;
  const valueAdded = expectedTotal - rawTotal - grading - selling;
  return {
    rawValueTotalMinor: rawTotal,
    expectedGradedValueTotalMinor: expectedTotal,
    valueAddedMinor: valueAdded,
    breakEvenGradedValuePerCardMinor: Math.ceil(
      (rawTotal + grading + selling) / count,
    ),
    potentialProfitMinor:
      acquisition === null
        ? null
        : expectedTotal - acquisition * count - grading - selling,
  };
}

export function gradingBatchPlan({
  items = [],
  serviceFee,
  shipping = 0,
  insurance = 0,
  sellingCosts = 0,
}) {
  const fee = toMinorUnits(serviceFee);
  const shippingMinor = toMinorUnits(shipping);
  const insuranceMinor = toMinorUnits(insurance);
  const sellingMinor = toMinorUnits(sellingCosts);
  if (
    !items.length ||
    [fee, shippingMinor, insuranceMinor, sellingMinor].some(
      (value) => value === null || value < 0,
    )
  )
    return null;
  let cardCount = 0;
  let rawValue = 0;
  let expectedValue = 0;
  let acquisitionBasis = 0;
  let basisKnown = true;
  for (const item of items) {
    const quantity = Number(item.quantity);
    const available =
      item.availableQuantity === null || item.availableQuantity === undefined
        ? null
        : Number(item.availableQuantity);
    const raw = toMinorUnits(item.rawValue);
    const expected = toMinorUnits(item.expectedGradedValue);
    const acquisition =
      item.acquisitionCost === null || item.acquisitionCost === undefined
        ? null
        : toMinorUnits(item.acquisitionCost);
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      (available !== null &&
        (!Number.isInteger(available) ||
          available <= 0 ||
          quantity > available)) ||
      raw === null ||
      raw < 0 ||
      expected === null ||
      expected < 0 ||
      (acquisition !== null && acquisition < 0)
    )
      return null;
    cardCount += quantity;
    rawValue += raw * quantity;
    expectedValue += expected * quantity;
    if (acquisition === null) basisKnown = false;
    else acquisitionBasis += acquisition * quantity;
  }
  const gradingFees = fee * cardCount;
  const gradingCost = gradingFees + shippingMinor + insuranceMinor;
  const valueAdded = expectedValue - rawValue - gradingCost - sellingMinor;
  return {
    cardCount,
    rawValueTotalMinor: rawValue,
    expectedGradedValueTotalMinor: expectedValue,
    serviceFeesMinor: gradingFees,
    gradingCostMinor: gradingCost,
    valueAddedMinor: valueAdded,
    breakEvenAverageMinor: Math.ceil(
      (rawValue + gradingCost + sellingMinor) / cardCount,
    ),
    potentialProfitMinor: basisKnown
      ? expectedValue - acquisitionBasis - gradingCost - sellingMinor
      : null,
  };
}

export function tradeAnalysis({
  giveItems = [],
  receiveItems = [],
  giveCash = 0,
  receiveCash = 0,
}) {
  const sideTotal = (items, cash) => {
    const cashMinor = toMinorUnits(cash);
    if (cashMinor === null || cashMinor < 0) return null;
    let total = cashMinor;
    for (const item of items) {
      const quantity = Number(item.quantity);
      const value = toMinorUnits(item.valuePerCard);
      if (
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        value === null ||
        value < 0
      )
        return null;
      total += value * quantity;
    }
    return total;
  };
  const giveTotal = sideTotal(giveItems, giveCash);
  const receiveTotal = sideTotal(receiveItems, receiveCash);
  if (giveTotal === null || receiveTotal === null) return null;
  const difference = receiveTotal - giveTotal;
  const comparisonBase = Math.max(giveTotal, receiveTotal);
  const tolerance = Math.max(500, Math.round(comparisonBase * 0.02));
  return {
    giveTotalMinor: giveTotal,
    receiveTotalMinor: receiveTotal,
    differenceMinor: difference,
    differencePercent:
      comparisonBase === 0 ? 0 : (difference / comparisonBase) * 100,
    verdict:
      Math.abs(difference) <= tolerance
        ? "balanced"
        : difference > 0
          ? "in_your_favor"
          : "in_their_favor",
    cashToBalanceMinor: Math.abs(difference),
    cashGoesTo: difference > 0 ? "them" : difference < 0 ? "you" : null,
  };
}

export function tradeSummary(
  input,
  { date = new Date().toISOString().slice(0, 10) } = {},
) {
  const analysis = tradeAnalysis(input);
  if (!analysis || !input.giveItems?.length || !input.receiveItems?.length)
    return null;
  const amount = (minor) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  const side = (title, items, cash) => {
    const lines = [title];
    for (const item of items) {
      const quantity = Number(item.quantity);
      const each = toMinorUnits(item.valuePerCard);
      lines.push(
        `- ${quantity} x ${item.name || "Unknown card"} · ${item.set || "Set unavailable"} ${item.number || ""}${item.context ? ` · ${item.context}` : ""} · ${amount(each)} each = ${amount(each * quantity)}`,
      );
    }
    const cashMinor = toMinorUnits(cash);
    if (cashMinor > 0) lines.push(`- Cash: ${amount(cashMinor)}`);
    return lines;
  };
  const result =
    analysis.differenceMinor === 0
      ? "The agreed totals are exactly even."
      : analysis.differenceMinor > 0
        ? `You receive ${amount(analysis.differenceMinor)} more in agreed value.`
        : `You give ${amount(Math.abs(analysis.differenceMinor))} more in agreed value.`;
  return [
    "Mica trade check",
    `Prepared ${date}`,
    "",
    ...side("You give", input.giveItems, input.giveCash),
    `Give total: ${amount(analysis.giveTotalMinor)}`,
    "",
    ...side("You receive", input.receiveItems, input.receiveCash),
    `Receive total: ${amount(analysis.receiveTotalMinor)}`,
    "",
    result,
    `Difference: ${analysis.differencePercent >= 0 ? "+" : ""}${analysis.differencePercent.toFixed(1)}%`,
    "",
    "Agreed values are planning inputs, not an appraisal. Verify condition, grade, and authenticity before trading.",
    "Shared from Mica",
  ].join("\n");
}

export function salePlan({
  quantity,
  salePriceEach,
  feePercent = 0,
  shipping = 0,
  otherCosts = 0,
  costBasisMinor = 0,
  targetProfit = null,
}) {
  const count = Number(quantity);
  const unitPrice = toMinorUnits(salePriceEach);
  const shippingMinor = toMinorUnits(shipping);
  const otherMinor = toMinorUnits(otherCosts);
  const basis = Number(costBasisMinor);
  const feeRate = Number(feePercent);
  const target =
    targetProfit === null || String(targetProfit).trim() === ""
      ? null
      : toMinorUnits(targetProfit);
  if (
    !Number.isInteger(count) ||
    count <= 0 ||
    unitPrice === null ||
    unitPrice < 0 ||
    shippingMinor === null ||
    shippingMinor < 0 ||
    otherMinor === null ||
    otherMinor < 0 ||
    !Number.isInteger(basis) ||
    basis < 0 ||
    !Number.isFinite(feeRate) ||
    feeRate < 0 ||
    feeRate >= 100 ||
    (target !== null && (target < 0 || !Number.isInteger(target)))
  )
    return null;
  const gross = unitPrice * count;
  const marketplaceFees = Math.round((gross * feeRate) / 100);
  const net = gross - marketplaceFees - shippingMinor - otherMinor;
  const profit = net - basis;
  const retained = 1 - feeRate / 100;
  const breakEvenGross = Math.ceil(
    (basis + shippingMinor + otherMinor) / retained,
  );
  const targetGross =
    target === null
      ? null
      : Math.ceil((basis + shippingMinor + otherMinor + target) / retained);
  return {
    grossMinor: gross,
    marketplaceFeesMinor: marketplaceFees,
    netProceedsMinor: net,
    costBasisMinor: basis,
    profitMinor: profit,
    roiPercent: basis === 0 ? null : (profit / basis) * 100,
    breakEvenPriceEachMinor: Math.ceil(breakEvenGross / count),
    targetPriceEachMinor:
      targetGross === null ? null : Math.ceil(targetGross / count),
  };
}

export function portfolioReview(
  positions = [],
  watchlist = [],
  today = new Date().toISOString().slice(0, 10),
) {
  const needsPricing = positions.filter(
    (item) => item.price === null || item.price === undefined,
  );
  const belowCost = positions.filter(
    (item) =>
      item.price !== null &&
      item.price !== undefined &&
      Number(item.price) * Number(item.quantity || 0) <
        Number(item.costBasis || 0),
  );
  const olderInventory = positions.filter(
    (item) => item.purchaseDate && holdingDays(item.purchaseDate, today) >= 180,
  );
  const reachedTargets = watchlist.filter(
    (item) =>
      item.targetPrice !== null &&
      item.currentPrice !== null &&
      Number(item.currentPrice) <= Number(item.targetPrice),
  );
  return { needsPricing, belowCost, olderInventory, reachedTargets };
}

export function businessSummary(
  positions = [],
  { from = "0000-01-01", to = "9999-12-31", currency = "USD" } = {},
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    from > to
  )
    return null;
  const transactions = positions.flatMap((position) =>
    (position.transactions || []).map((transaction) => ({
      ...transaction,
      currency: transaction.currency || position.currency || "USD",
    })),
  );
  const inRange = transactions.filter(
    (transaction) => transaction.date >= from && transaction.date <= to,
  );
  const included = inRange.filter(
    (transaction) => transaction.currency === currency,
  );
  const purchases = included.filter(
    (transaction) => transaction.type === "purchase",
  );
  const sales = included.filter((transaction) => transaction.type === "sale");
  const sumMinor = (rows, field) =>
    rows.reduce((sum, row) => sum + (toMinorUnits(row[field]) || 0), 0);
  const acquisitionSpend = sumMinor(purchases, "totalCost");
  const netSales = sumMinor(sales, "netProceeds");
  const grossSales = sales.reduce((sum, sale) => {
    const gross = toMinorUnits(sale.subtotal);
    const net = toMinorUnits(sale.netProceeds);
    return sum + (gross === null ? net || 0 : gross);
  }, 0);
  const comparableSales = sales.filter(
    (sale) => sale.allocatedCost !== null && sale.allocatedCost !== undefined,
  );
  const realizedProfit = comparableSales.reduce(
    (sum, sale) =>
      sum +
      (toMinorUnits(sale.netProceeds) || 0) -
      (toMinorUnits(sale.allocatedCost) || 0),
    0,
  );
  return {
    currency,
    transactionCount: included.length,
    purchaseCount: purchases.length,
    saleCount: sales.length,
    unitsPurchased: purchases.reduce(
      (sum, purchase) => sum + Number(purchase.quantity || 0),
      0,
    ),
    unitsSold: sales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0),
    acquisitionSpendMinor: acquisitionSpend,
    grossSalesMinor: grossSales,
    netSalesMinor: netSales,
    sellingCostsMinor: Math.max(0, grossSales - netSales),
    cashFlowMinor: netSales - acquisitionSpend,
    realizedProfitMinor: realizedProfit,
    realizedCoverage: comparableSales.length,
    skippedCurrencyCount: inRange.length - included.length,
  };
}

export function validateAcquisition(
  input,
  today = new Date().toISOString().slice(0, 10),
) {
  const errors = {};
  const state = input.cardState;
  const condition = input.rawCondition || input.condition;
  if (!Number.isInteger(Number(input.quantity)) || Number(input.quantity) <= 0)
    errors.quantity = "Quantity must be a positive whole number.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.transactionDate || "")))
    errors.transactionDate = "Enter a valid acquisition date.";
  else if (input.transactionDate > today)
    errors.transactionDate = "Acquisition dates cannot be later than today.";
  if (
    toMinorUnits(input.unitPrice) === null ||
    toMinorUnits(input.unitPrice) < 0
  )
    errors.unitPrice = "Purchase price cannot be negative.";
  if (state === "graded") {
    if (!input.grader) errors.grader = "Choose the grading company.";
    if (!input.grade) errors.grade = "Enter the grade.";
    if (condition)
      errors.rawCondition = "Raw condition cannot be applied to a graded card.";
  } else if (state === "raw") {
    if (!condition) errors.rawCondition = "Choose the raw card condition.";
    if (input.grader || input.grade)
      errors.grade = "A raw card cannot have a grader or grade.";
  } else errors.cardState = "Choose raw or graded.";
  return { valid: Object.keys(errors).length === 0, errors };
}

export function allocateFifo(lots, saleQuantity) {
  let remaining = Number(saleQuantity);
  if (!Number.isInteger(remaining) || remaining <= 0)
    return {
      allocations: [],
      allocatedQuantity: 0,
      allocatedCost: 0,
      unallocatedQuantity: Math.max(0, remaining || 0),
    };
  const allocations = [];
  let allocatedCost = 0;
  const ordered = [...lots]
    .filter((lot) => Number(lot.quantityRemaining) > 0)
    .sort(
      (a, b) =>
        String(a.acquiredAt).localeCompare(String(b.acquiredAt)) ||
        String(a.id).localeCompare(String(b.id)),
    );
  for (const lot of ordered) {
    if (!remaining) break;
    const available = Number(lot.quantityRemaining);
    const quantity = Math.min(available, remaining);
    const totalQuantity = Number(lot.quantityAcquired);
    const lotCost = Number(lot.totalCostMinor);
    const allocated =
      quantity === available
        ? Math.round((lotCost * available) / totalQuantity)
        : Math.round((lotCost * quantity) / totalQuantity);
    allocations.push({ lotId: lot.id, quantity, costMinor: allocated });
    allocatedCost += allocated;
    remaining -= quantity;
  }
  return {
    allocations,
    allocatedQuantity: Number(saleQuantity) - remaining,
    allocatedCost,
    unallocatedQuantity: remaining,
  };
}

export function positionPerformance(input) {
  const quantity = Number(input.quantityOwned);
  const cost = Number(input.remainingCostBasisMinor);
  const price =
    input.currentUnitPrice == null
      ? null
      : toMinorUnits(input.currentUnitPrice);
  const currentValue = price === null ? null : price * quantity;
  const unrealized = currentValue === null ? null : currentValue - cost;
  return {
    quantityOwned: quantity,
    remainingCostBasisMinor: cost,
    currentValueMinor: currentValue,
    unrealizedGainMinor: unrealized,
    returnPercent:
      unrealized === null || cost === 0 ? null : (unrealized / cost) * 100,
    realizedGainMinor:
      Number(input.netSaleProceedsMinor || 0) -
      Number(input.allocatedSoldCostMinor || 0),
  };
}

export function holdingDays(
  acquiredAt,
  endedAt = new Date().toISOString().slice(0, 10),
) {
  const start = new Date(`${acquiredAt}T00:00:00Z`).getTime();
  const end = new Date(`${endedAt}T00:00:00Z`).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.floor((end - start) / 86_400_000)
    : null;
}

export function inventoryHealth(
  positions = [],
  { today = new Date().toISOString().slice(0, 10), currency = "USD" } = {},
) {
  const included = positions.filter(
    (position) => (position.currency || "USD") === currency,
  );
  const buckets = [
    {
      key: "0-30",
      label: "0–30 days",
      quantity: 0,
      costBasis: 0,
      currentValue: 0,
    },
    {
      key: "31-90",
      label: "31–90 days",
      quantity: 0,
      costBasis: 0,
      currentValue: 0,
    },
    {
      key: "91-180",
      label: "91–180 days",
      quantity: 0,
      costBasis: 0,
      currentValue: 0,
    },
    {
      key: "181+",
      label: "181+ days",
      quantity: 0,
      costBasis: 0,
      currentValue: 0,
    },
    {
      key: "unknown",
      label: "Date missing",
      quantity: 0,
      costBasis: 0,
      currentValue: 0,
    },
  ];
  const bucketFor = (date) => {
    const days = date ? holdingDays(date, today) : null;
    if (days === null) return buckets[4];
    if (days <= 30) return buckets[0];
    if (days <= 90) return buckets[1];
    if (days <= 180) return buckets[2];
    return buckets[3];
  };
  for (const position of included) {
    const price =
      position.price === null || position.price === undefined
        ? null
        : Number(position.price);
    const lots = (position.lots || []).filter(
      (lot) => Number(lot.quantityRemaining) > 0,
    );
    const agingRows = lots.length
      ? lots.map((lot) => ({
          date: lot.acquiredAt,
          quantity: Number(lot.quantityRemaining),
          costBasis: Number(lot.remainingCost || 0),
        }))
      : [
          {
            date: position.purchaseDate,
            quantity: Number(position.quantity || 0),
            costBasis: Number(position.costBasis || 0),
          },
        ];
    for (const row of agingRows) {
      const bucket = bucketFor(row.date);
      bucket.quantity += row.quantity;
      bucket.costBasis += row.costBasis;
      if (price !== null && Number.isFinite(price))
        bucket.currentValue += price * row.quantity;
    }
  }
  const valued = included
    .map((position) => ({
      name: position.name || "Unknown card",
      value:
        position.price === null || position.price === undefined
          ? null
          : Number(position.price) * Number(position.quantity || 0),
    }))
    .filter(
      (position) => position.value !== null && Number.isFinite(position.value),
    )
    .sort((left, right) => right.value - left.value);
  const totalValue = valued.reduce((sum, position) => sum + position.value, 0);
  const totalQuantity = included.reduce(
    (sum, position) => sum + Number(position.quantity || 0),
    0,
  );
  const pricedQuantity = included.reduce(
    (sum, position) =>
      sum +
      (position.price === null || position.price === undefined
        ? 0
        : Number(position.quantity || 0)),
    0,
  );
  return {
    currency,
    buckets,
    totalCostBasis: buckets.reduce((sum, bucket) => sum + bucket.costBasis, 0),
    totalValue,
    totalQuantity,
    pricedQuantity,
    topPosition: valued[0]
      ? {
          name: valued[0].name,
          sharePercent: totalValue ? (valued[0].value / totalValue) * 100 : 0,
        }
      : null,
    topThreeSharePercent: totalValue
      ? (valued.slice(0, 3).reduce((sum, position) => sum + position.value, 0) /
          totalValue) *
        100
      : null,
    skippedCurrencyPositions: positions.length - included.length,
  };
}
