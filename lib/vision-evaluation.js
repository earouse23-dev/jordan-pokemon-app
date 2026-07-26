function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function percentile(values, target) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(target * sorted.length) - 1];
}

function normalizedId(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function evaluateVisionBenchmark(cases, thresholds = {}) {
  const rows = Array.isArray(cases) ? cases : [];
  const identify = rows.filter((entry) => entry.mode === "identify");
  const grade = rows.filter((entry) => entry.mode === "grade");
  const receipt = rows.filter((entry) => entry.mode === "receipt");
  const identifyScored = identify.filter((entry) => entry.expectedCatalogId);
  const gradeScored = grade.filter((entry) =>
    Number.isFinite(Number(entry.expectedGrade)),
  );
  const abstentionScored = rows.filter(
    (entry) => entry.expectedAbstain === true,
  );

  const topOne = identifyScored.filter(
    (entry) =>
      normalizedId(entry.candidateIds?.[0]) ===
      normalizedId(entry.expectedCatalogId),
  ).length;
  const topThree = identifyScored.filter((entry) =>
    (entry.candidateIds || [])
      .slice(0, 3)
      .some(
        (candidate) =>
          normalizedId(candidate) === normalizedId(entry.expectedCatalogId),
      ),
  ).length;
  const falseConfident = identifyScored.filter((entry) => {
    const wrong =
      normalizedId(entry.candidateIds?.[0]) !==
      normalizedId(entry.expectedCatalogId);
    return wrong && Number(entry.analysis?.identity?.confidence) >= 0.8;
  }).length;
  const gradeCovered = gradeScored.filter((entry) => {
    const gradeValue = Number(entry.expectedGrade);
    const low = Number(entry.analysis?.condition?.estimatedGradeLow);
    const high = Number(entry.analysis?.condition?.estimatedGradeHigh);
    return Number.isFinite(low) && Number.isFinite(high)
      ? gradeValue >= low && gradeValue <= high
      : false;
  }).length;
  const gradeWidths = gradeScored
    .map((entry) => {
      const low = Number(entry.analysis?.condition?.estimatedGradeLow);
      const high = Number(entry.analysis?.condition?.estimatedGradeHigh);
      return Number.isFinite(low) && Number.isFinite(high) ? high - low : null;
    })
    .filter((value) => value !== null);
  const abstained = abstentionScored.filter(
    (entry) =>
      entry.analysis?.quality?.usable === false ||
      Number(entry.analysis?.identity?.confidence || 0) < 0.5,
  ).length;
  const latencies = rows
    .map((entry) => Number(entry.latencyMs))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const costs = rows
    .map((entry) => Number(entry.estimatedCostUsd))
    .filter((value) => Number.isFinite(value) && value >= 0);
  const corrections = rows.filter((entry) => entry.corrected === true).length;

  const gates = {
    minimumIdentifyCases: thresholds.minimumIdentifyCases ?? 30,
    minimumGradeCases: thresholds.minimumGradeCases ?? 30,
    topOneAccuracy: thresholds.topOneAccuracy ?? 0.9,
    topThreeAccuracy: thresholds.topThreeAccuracy ?? 0.98,
    falseConfidenceRate: thresholds.falseConfidenceRate ?? 0.02,
    gradeRangeCoverage: thresholds.gradeRangeCoverage ?? 0.85,
    abstentionAccuracy: thresholds.abstentionAccuracy ?? 0.9,
    p95LatencyMs: thresholds.p95LatencyMs ?? 20_000,
  };
  const metrics = {
    cases: rows.length,
    identifyCases: identify.length,
    gradeCases: grade.length,
    receiptCases: receipt.length,
    topOneAccuracy: ratio(topOne, identifyScored.length),
    topThreeAccuracy: ratio(topThree, identifyScored.length),
    falseConfidenceRate: ratio(falseConfident, identifyScored.length),
    correctionRate: ratio(corrections, rows.length),
    gradeRangeCoverage: ratio(gradeCovered, gradeScored.length),
    averageGradeRangeWidth: gradeWidths.length
      ? gradeWidths.reduce((sum, value) => sum + value, 0) / gradeWidths.length
      : null,
    abstentionAccuracy: ratio(abstained, abstentionScored.length),
    averageLatencyMs: latencies.length
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : null,
    p95LatencyMs: percentile(latencies, 0.95),
    totalEstimatedCostUsd: costs.length
      ? costs.reduce((sum, value) => sum + value, 0)
      : null,
    averageEstimatedCostUsd: costs.length
      ? costs.reduce((sum, value) => sum + value, 0) / costs.length
      : null,
  };
  const checks = {
    identifySample: identifyScored.length >= Number(gates.minimumIdentifyCases),
    gradeSample: gradeScored.length >= Number(gates.minimumGradeCases),
    topOne:
      metrics.topOneAccuracy !== null &&
      metrics.topOneAccuracy >= gates.topOneAccuracy,
    topThree:
      metrics.topThreeAccuracy !== null &&
      metrics.topThreeAccuracy >= gates.topThreeAccuracy,
    falseConfidence:
      metrics.falseConfidenceRate !== null &&
      metrics.falseConfidenceRate <= gates.falseConfidenceRate,
    gradeCoverage:
      metrics.gradeRangeCoverage !== null &&
      metrics.gradeRangeCoverage >= gates.gradeRangeCoverage,
    abstention:
      metrics.abstentionAccuracy !== null &&
      metrics.abstentionAccuracy >= gates.abstentionAccuracy,
    latency:
      metrics.p95LatencyMs !== null &&
      metrics.p95LatencyMs <= gates.p95LatencyMs,
  };

  return {
    status: Object.values(checks).every(Boolean) ? "pass" : "not_ready",
    gates,
    metrics,
    checks,
  };
}
