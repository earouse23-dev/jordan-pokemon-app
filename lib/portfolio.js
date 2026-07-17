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
  if (totalMinor === null || totalMinor < 0 || !Number.isInteger(count) || count <= 0)
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

export function gradingEstimate({ serviceFee, quantity = 1, shipping = 0, insurance = 0 }) {
  const count = Number(quantity);
  const fee = toMinorUnits(serviceFee);
  const shippingMinor = toMinorUnits(shipping);
  const insuranceMinor = toMinorUnits(insurance);
  if (
    !Number.isInteger(count) ||
    count <= 0 ||
    [fee, shippingMinor, insuranceMinor].some((value) => value === null || value < 0)
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
  const acquisition = acquisitionCostPerCard == null ? null : toMinorUnits(acquisitionCostPerCard);
  if (
    !Number.isInteger(count) ||
    count <= 0 ||
    [raw, graded, selling].some((value) => value === null || value < 0) ||
    !Number.isInteger(grading) ||
    grading < 0 ||
    (acquisitionCostPerCard != null && (acquisition === null || acquisition < 0))
  )
    return null;
  const rawTotal = raw * count;
  const expectedTotal = graded * count;
  const valueAdded = expectedTotal - rawTotal - grading - selling;
  return {
    rawValueTotalMinor: rawTotal,
    expectedGradedValueTotalMinor: expectedTotal,
    valueAddedMinor: valueAdded,
    breakEvenGradedValuePerCardMinor: Math.ceil((rawTotal + grading + selling) / count),
    potentialProfitMinor:
      acquisition === null
        ? null
        : expectedTotal - acquisition * count - grading - selling,
  };
}

export function tradeAnalysis({ giveItems = [], receiveItems = [], giveCash = 0, receiveCash = 0 }) {
  const sideTotal = (items, cash) => {
    const cashMinor = toMinorUnits(cash);
    if (cashMinor === null || cashMinor < 0) return null;
    let total = cashMinor;
    for (const item of items) {
      const quantity = Number(item.quantity);
      const value = toMinorUnits(item.valuePerCard);
      if (!Number.isInteger(quantity) || quantity <= 0 || value === null || value < 0)
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

export function salePlan({
  quantity,
  salePriceEach,
  feePercent = 0,
  shipping = 0,
  otherCosts = 0,
  costBasisMinor = 0,
  targetProfit = null,
}) {
  const count=Number(quantity);
  const unitPrice=toMinorUnits(salePriceEach);
  const shippingMinor=toMinorUnits(shipping);
  const otherMinor=toMinorUnits(otherCosts);
  const basis=Number(costBasisMinor);
  const feeRate=Number(feePercent);
  const target=targetProfit===null||String(targetProfit).trim()===''?null:toMinorUnits(targetProfit);
  if(!Number.isInteger(count)||count<=0||unitPrice===null||unitPrice<0||shippingMinor===null||shippingMinor<0||otherMinor===null||otherMinor<0||!Number.isInteger(basis)||basis<0||!Number.isFinite(feeRate)||feeRate<0||feeRate>=100||(target!==null&&(target<0||!Number.isInteger(target))))return null;
  const gross=unitPrice*count;
  const marketplaceFees=Math.round(gross*feeRate/100);
  const net=gross-marketplaceFees-shippingMinor-otherMinor;
  const profit=net-basis;
  const retained=1-feeRate/100;
  const breakEvenGross=Math.ceil((basis+shippingMinor+otherMinor)/retained);
  const targetGross=target===null?null:Math.ceil((basis+shippingMinor+otherMinor+target)/retained);
  return {
    grossMinor:gross,
    marketplaceFeesMinor:marketplaceFees,
    netProceedsMinor:net,
    costBasisMinor:basis,
    profitMinor:profit,
    roiPercent:basis===0?null:profit/basis*100,
    breakEvenPriceEachMinor:Math.ceil(breakEvenGross/count),
    targetPriceEachMinor:targetGross===null?null:Math.ceil(targetGross/count),
  };
}

export function portfolioReview(positions=[],watchlist=[],today=new Date().toISOString().slice(0,10)) {
  const needsPricing=positions.filter(item=>item.price===null||item.price===undefined);
  const belowCost=positions.filter(item=>item.price!==null&&item.price!==undefined&&Number(item.price)*Number(item.quantity||0)<Number(item.costBasis||0));
  const olderInventory=positions.filter(item=>item.purchaseDate&&holdingDays(item.purchaseDate,today)>=180);
  const reachedTargets=watchlist.filter(item=>item.targetPrice!==null&&item.currentPrice!==null&&Number(item.currentPrice)<=Number(item.targetPrice));
  return {needsPricing,belowCost,olderInventory,reachedTargets};
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
