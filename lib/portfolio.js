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
