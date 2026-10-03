import { toMinorUnits } from "./portfolio.js";

// One card, one currency, the same selling fee assumption on both paths.
export function compareGradingOutcome({
  rawValue,
  gradedValue,
  gradingCost,
  sellingFeePercent,
}) {
  const raw = toMinorUnits(rawValue);
  const graded = toMinorUnits(gradedValue);
  const cost = toMinorUnits(gradingCost);
  const fee = toMinorUnits(sellingFeePercent);
  if (
    [raw, graded, cost, fee].some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    ) ||
    fee >= 10000
  )
    return null;
  const rate = BigInt(fee);
  const fees = (amount) => (BigInt(amount) * rate + 5000n) / 10000n;
  const rawNet = BigInt(raw) - fees(raw);
  const gradedNet = BigInt(graded) - fees(graded) - BigInt(cost);
  const numerator = (rawNet + BigInt(cost)) * 10000n - 4999n;
  const denominator = 10000n - rate;
  const breakEven =
    numerator <= 0n ? 0n : (numerator + denominator - 1n) / denominator;
  const result = {
    rawNetMinor: Number(rawNet),
    gradedNetMinor: Number(gradedNet),
    gradingCostMinor: cost,
    gradedSellingFeesMinor: Number(fees(graded)),
    differenceMinor: Number(gradedNet - rawNet),
    breakEvenGradedMinor: Number(breakEven),
  };
  return Object.values(result).every(Number.isSafeInteger) ? result : null;
}
