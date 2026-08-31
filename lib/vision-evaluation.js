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

const PSA_NUMERIC_LABELS = new Set([
  1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10,
]);

function canonicalPsaLabel(value) {
  if (value == null || value === "") return null;
  const text = String(value)
    .trim()
    .toUpperCase()
    .replace(/^PSA\s+/, "");
  const qualified = text.match(/^(\d+(?:\.5)?)\s+(OC|PD|ST|OF|MK|MC)$/);
  if (qualified) {
    const grade = Number(qualified[1]);
    return PSA_NUMERIC_LABELS.has(grade) ? `${grade} ${qualified[2]}` : null;
  }
  const grade = Number(text);
  if (PSA_NUMERIC_LABELS.has(grade)) return String(grade);
  if (/^N[1-9]$/.test(text)) return text;
  if (["AUTHENTIC", "AUTHENTIC ALTERED"].includes(text)) return text;
  return null;
}

function expectedPsaLabel(entry) {
  return canonicalPsaLabel(entry.expectedReturnedLabel ?? entry.expectedGrade);
}

function predictedPsaLabel(entry, allowConditionFallback = false) {
  const prediction = entry.analysis?.psaPrediction || {};
  const explicit = canonicalPsaLabel(
    prediction.returnedLabel ?? prediction.mostLikelyGrade,
  );
  if (prediction.status === "validated" && explicit) return explicit;
  return allowConditionFallback
    ? canonicalPsaLabel(predictedGrade(entry))
    : null;
}

function wilsonInterval(successes, total, z = 1.959963984540054) {
  if (!total) return { low: null, high: null };
  const proportion = successes / total;
  const denominator = 1 + z ** 2 / total;
  const center = (proportion + z ** 2 / (2 * total)) / denominator;
  const margin =
    (z *
      Math.sqrt(
        (proportion * (1 - proportion)) / total + z ** 2 / (4 * total ** 2),
      )) /
    denominator;
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
  };
}

function calibrationMetrics(entries, bins = 10) {
  const rows = entries
    .map((entry) => {
      const predicted = predictedPsaLabel(entry);
      const expected = expectedPsaLabel(entry);
      const probabilities = gradeProbabilities(entry);
      const selected = probabilities.find(
        (row) =>
          canonicalPsaLabel(row.returnedLabel ?? row.grade) === predicted,
      );
      const confidence = Number(selected?.probability);
      return predicted && expected && Number.isFinite(confidence)
        ? { confidence, correct: predicted === expected ? 1 : 0 }
        : null;
    })
    .filter(Boolean);
  if (!rows.length) return { expectedCalibrationError: null, bins: [] };
  const output = [];
  let weightedError = 0;
  for (let index = 0; index < bins; index += 1) {
    const low = index / bins;
    const high = (index + 1) / bins;
    const members = rows.filter(
      (row) =>
        row.confidence >= low &&
        (index === bins - 1 ? row.confidence <= high : row.confidence < high),
    );
    if (!members.length) continue;
    const averageConfidence =
      members.reduce((sum, row) => sum + row.confidence, 0) / members.length;
    const accuracy =
      members.reduce((sum, row) => sum + row.correct, 0) / members.length;
    weightedError +=
      (members.length / rows.length) * Math.abs(accuracy - averageConfidence);
    output.push({
      low,
      high,
      cases: members.length,
      averageConfidence,
      accuracy,
    });
  }
  return { expectedCalibrationError: weightedError, bins: output };
}

function partitionLeakage(entries) {
  const partitionsByCard = new Map();
  for (const entry of entries) {
    if (!entry.physicalCardId || !entry.datasetPartition) continue;
    const partitions = partitionsByCard.get(entry.physicalCardId) || new Set();
    partitions.add(entry.datasetPartition);
    partitionsByCard.set(entry.physicalCardId, partitions);
  }
  return [...partitionsByCard.entries()]
    .filter(([, partitions]) => partitions.size > 1)
    .map(([physicalCardId, partitions]) => ({
      physicalCardId,
      partitions: [...partitions].sort(),
    }));
}

function confusionMatrix(entries) {
  const matrix = {};
  for (const entry of entries) {
    const expected = expectedPsaLabel(entry);
    const predicted = predictedPsaLabel(entry);
    if (!expected || !predicted) continue;
    matrix[expected] ||= {};
    matrix[expected][predicted] = (matrix[expected][predicted] || 0) + 1;
  }
  return matrix;
}

function predictedGrade(entry) {
  const calibrated = Number(entry.analysis?.psaPrediction?.mostLikelyGrade);
  if (Number.isFinite(calibrated)) return calibrated;
  const low = Number(entry.analysis?.condition?.estimatedGradeLow);
  const high = Number(entry.analysis?.condition?.estimatedGradeHigh);
  return Number.isFinite(low) && Number.isFinite(high)
    ? (low + high) / 2
    : null;
}

function gradeProbabilities(entry) {
  return Array.isArray(entry.analysis?.psaPrediction?.probabilities)
    ? entry.analysis.psaPrediction.probabilities
    : [];
}

function psaPredictionConfidence(entry) {
  const predicted = predictedPsaLabel(entry);
  if (!predicted) return null;
  const selected = gradeProbabilities(entry).find(
    (row) => canonicalPsaLabel(row.returnedLabel ?? row.grade) === predicted,
  );
  const probability = Number(
    selected?.probability ?? entry.analysis?.psaPrediction?.confidence,
  );
  return Number.isFinite(probability)
    ? Math.max(0, Math.min(1, probability))
    : null;
}

function psaBrierScore(entries) {
  const scores = entries
    .map((entry) => {
      const expected = expectedPsaLabel(entry);
      const probabilities = gradeProbabilities(entry)
        .map((row) => ({
          label: canonicalPsaLabel(row.returnedLabel ?? row.grade),
          probability: Number(row.probability),
        }))
        .filter(
          (row) =>
            row.label &&
            Number.isFinite(row.probability) &&
            row.probability >= 0 &&
            row.probability <= 1,
        );
      if (!expected || !probabilities.length) return null;
      const totalProbability = probabilities.reduce(
        (sum, row) => sum + row.probability,
        0,
      );
      if (Math.abs(totalProbability - 1) > 0.02) return null;
      const byLabel = new Map(
        probabilities.map((row) => [row.label, row.probability]),
      );
      const labels = new Set([...byLabel.keys(), expected]);
      return [...labels].reduce((sum, label) => {
        const observed = label === expected ? 1 : 0;
        return sum + ((byLabel.get(label) || 0) - observed) ** 2;
      }, 0);
    })
    .filter((value) => value !== null);
  return {
    cases: scores.length,
    score: scores.length
      ? scores.reduce((sum, value) => sum + value, 0) / scores.length
      : null,
  };
}

function accuracyCoverageCurve(entries) {
  const ranked = entries
    .map((entry) => ({ entry, confidence: psaPredictionConfidence(entry) }))
    .filter((row) => row.confidence !== null)
    .sort((left, right) => right.confidence - left.confidence);
  if (!ranked.length) return [];
  return Array.from({ length: 10 }, (_, index) => (index + 1) / 10).map(
    (targetCoverage) => {
      const count = Math.max(1, Math.ceil(ranked.length * targetCoverage));
      const shown = ranked.slice(0, count).map((row) => row.entry);
      const exact = shown.filter(
        (entry) => predictedPsaLabel(entry) === expectedPsaLabel(entry),
      ).length;
      const numeric = shown.filter(
        (entry) =>
          Number.isFinite(Number(predictedPsaLabel(entry))) &&
          Number.isFinite(Number(expectedPsaLabel(entry))),
      );
      const withinOne = numeric.filter(
        (entry) =>
          Math.abs(
            Number(predictedPsaLabel(entry)) - Number(expectedPsaLabel(entry)),
          ) <= 1,
      ).length;
      return {
        targetCoverage,
        casesShown: shown.length,
        coverage: shown.length / entries.length,
        minimumConfidence: psaPredictionConfidence(shown.at(-1)),
        exactAgreement: exact / shown.length,
        exactWilson95: wilsonInterval(exact, shown.length),
        withinOneAgreement: ratio(withinOne, numeric.length),
      };
    },
  );
}

function cohortKey(entry) {
  if (entry.cohortKey) return String(entry.cohortKey);
  const cohort = entry.cohort || {};
  const parts = [
    cohort.finish ?? entry.finish,
    cohort.era ?? entry.era,
    cohort.language ?? entry.language,
    cohort.deviceTier ?? entry.deviceTier,
    cohort.gradeBand ?? entry.gradeBand,
  ].map((value) => String(value || "unlabeled"));
  return parts.join("|");
}

function psaCohortMetrics(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = cohortKey(entry);
    const values = groups.get(key) || [];
    values.push(entry);
    groups.set(key, values);
  }
  return Object.fromEntries(
    [...groups.entries()].map(([key, values]) => {
      const predicted = values.filter((entry) => predictedPsaLabel(entry));
      const exact = predicted.filter(
        (entry) => predictedPsaLabel(entry) === expectedPsaLabel(entry),
      ).length;
      const numeric = predicted.filter(
        (entry) =>
          Number.isFinite(Number(predictedPsaLabel(entry))) &&
          Number.isFinite(Number(expectedPsaLabel(entry))),
      );
      const withinOne = numeric.filter(
        (entry) =>
          Math.abs(
            Number(predictedPsaLabel(entry)) - Number(expectedPsaLabel(entry)),
          ) <= 1,
      ).length;
      return [
        key,
        {
          cases: values.length,
          predictedCases: predicted.length,
          coverage: ratio(predicted.length, values.length),
          exactAgreement: ratio(exact, predicted.length),
          exactWilson95: wilsonInterval(exact, predicted.length),
          withinOneAgreement: ratio(withinOne, numeric.length),
          supported: values.some((entry) => entry.supportedCohort === true),
        },
      ];
    }),
  );
}

function extendedLeakage(entries) {
  const crossPartition = (field) => {
    const seen = new Map();
    for (const entry of entries) {
      if (!entry[field] || !entry.datasetPartition) continue;
      const partitions = seen.get(entry[field]) || new Set();
      partitions.add(entry.datasetPartition);
      seen.set(entry[field], partitions);
    }
    return [...seen.entries()]
      .filter(([, partitions]) => partitions.size > 1)
      .map(([value, partitions]) => ({
        value,
        partitions: [...partitions].sort(),
      }));
  };
  const temporalViolations = entries
    .filter((entry) => {
      if (entry.capturedBeforeOutcome === false) return true;
      const capturedAt = Date.parse(entry.capturedAt || "");
      const outcomeAt = Date.parse(entry.outcomeRecordedAt || "");
      return (
        Number.isFinite(capturedAt) &&
        Number.isFinite(outcomeAt) &&
        capturedAt >= outcomeAt
      );
    })
    .map((entry) => entry.caseId || entry.scanSessionId || "unknown");
  return {
    physicalCards: partitionLeakage(entries),
    captureHashes: crossPartition("sourceHash"),
    lineageRoots: crossPartition("lineageRootId"),
    temporalViolations,
  };
}

function groupedMetrics(entries, field) {
  const groups = new Map();
  for (const entry of entries) {
    const key = String(entry[field] || "not_labeled");
    const values = groups.get(key) || [];
    values.push(entry);
    groups.set(key, values);
  }
  return Object.fromEntries(
    [...groups.entries()].map(([key, values]) => {
      const scored = values.filter((entry) =>
        Number.isFinite(Number(entry.expectedGrade)),
      );
      const withinOne = scored.filter((entry) => {
        const predicted = predictedGrade(entry);
        return (
          predicted !== null &&
          Math.abs(predicted - Number(entry.expectedGrade)) <= 1
        );
      }).length;
      return [
        key,
        {
          cases: values.length,
          scoredCases: scored.length,
          withinOneGradeAgreement: ratio(withinOne, scored.length),
        },
      ];
    }),
  );
}

export function evaluateVisionBenchmark(cases, thresholds = {}) {
  const rows = Array.isArray(cases) ? cases : [];
  const identify = rows.filter((entry) => entry.mode === "identify");
  const grade = rows.filter((entry) => entry.mode === "grade");
  const identifyScored = identify.filter((entry) => entry.expectedCatalogId);
  const gradeScored = grade.filter((entry) =>
    Number.isFinite(Number(entry.expectedGrade)),
  );
  const psaScored = grade.filter((entry) => expectedPsaLabel(entry));
  const psaPredicted = psaScored.filter((entry) => predictedPsaLabel(entry));
  const exactPsaLabels = psaPredicted.filter(
    (entry) => predictedPsaLabel(entry) === expectedPsaLabel(entry),
  ).length;
  const exactPsaInterval = wilsonInterval(exactPsaLabels, psaPredicted.length);
  const psaNumericPredicted = psaPredicted.filter(
    (entry) =>
      Number.isFinite(Number(predictedPsaLabel(entry))) &&
      Number.isFinite(Number(expectedPsaLabel(entry))),
  );
  const psaWithinOne = psaNumericPredicted.filter(
    (entry) =>
      Math.abs(
        Number(predictedPsaLabel(entry)) - Number(expectedPsaLabel(entry)),
      ) <= 1,
  ).length;
  const predictedPsaTens = psaPredicted.filter(
    (entry) => predictedPsaLabel(entry) === "10",
  );
  const falsePsaTens = predictedPsaTens.filter(
    (entry) => expectedPsaLabel(entry) !== "10",
  ).length;
  const calibration = calibrationMetrics(psaPredicted);
  const leakage = partitionLeakage(rows);
  const allLeakage = extendedLeakage(rows);
  const psaBrier = psaBrierScore(psaScored);
  const cohortMetrics = psaCohortMetrics(psaScored);
  const supportedCohorts = Object.values(cohortMetrics).filter(
    (cohort) => cohort.supported,
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
  const exactGrade = gradeScored.filter((entry) => {
    const predicted = predictedGrade(entry);
    return (
      predicted !== null &&
      Math.abs(predicted - Number(entry.expectedGrade)) < 0.25
    );
  }).length;
  const withinOneGrade = gradeScored.filter((entry) => {
    const predicted = predictedGrade(entry);
    return (
      predicted !== null &&
      Math.abs(predicted - Number(entry.expectedGrade)) <= 1
    );
  }).length;
  const falseGemMint = gradeScored.filter((entry) => {
    const predicted = predictedGrade(entry);
    return (
      predicted !== null &&
      predicted >= 9.5 &&
      Number(entry.expectedGrade) < 9.5
    );
  }).length;
  const absoluteGradeErrors = gradeScored
    .map((entry) => {
      const predicted = predictedGrade(entry);
      return predicted === null
        ? null
        : Math.abs(predicted - Number(entry.expectedGrade));
    })
    .filter((value) => value !== null);
  const brierScores = gradeScored
    .map((entry) => {
      const probabilities = gradeProbabilities(entry);
      if (!probabilities.length) return null;
      const expected = Math.round(Number(entry.expectedGrade));
      return (
        probabilities.reduce((sum, row) => {
          const observed = Number(row.grade) === expected ? 1 : 0;
          return sum + (Number(row.probability) - observed) ** 2;
        }, 0) / 10
      );
    })
    .filter((value) => value !== null);
  const repeatGroups = new Map();
  for (const entry of grade.filter((candidate) => candidate.repeatGroup)) {
    const values = repeatGroups.get(entry.repeatGroup) || [];
    const predicted = predictedGrade(entry);
    if (predicted !== null) values.push(predicted);
    repeatGroups.set(entry.repeatGroup, values);
  }
  const repeatable = [...repeatGroups.values()].filter(
    (values) => values.length >= 2,
  );
  const repeatConsistent = repeatable.filter(
    (values) => Math.max(...values) - Math.min(...values) <= 0.5,
  ).length;
  const psaRepeatGroups = new Map();
  for (const entry of psaPredicted.filter(
    (candidate) => candidate.repeatGroup,
  )) {
    const values = psaRepeatGroups.get(entry.repeatGroup) || [];
    values.push(predictedPsaLabel(entry));
    psaRepeatGroups.set(entry.repeatGroup, values);
  }
  const psaRepeatable = [...psaRepeatGroups.values()].filter(
    (values) => values.length >= 2,
  );
  const psaRepeatExact = psaRepeatable.filter((values) =>
    values.every((value) => value === values[0]),
  ).length;
  const psaRepeatWithinOne = psaRepeatable.filter(
    (values) =>
      values.every((value) => Number.isFinite(Number(value))) &&
      Math.max(...values.map(Number)) - Math.min(...values.map(Number)) <= 1,
  ).length;
  const successfulScans = grade.filter(
    (entry) =>
      entry.scanCompleted !== false &&
      (entry.analysis?.quality?.usable === false ||
        entry.analysis?.psaPrediction?.status === "estimate" ||
        entry.analysis?.psaPrediction?.status === "abstained" ||
        predictedGrade(entry) !== null),
  ).length;
  const defectScored = grade.filter(
    (entry) =>
      Number.isFinite(Number(entry.expectedDefectCount)) &&
      Number.isFinite(Number(entry.matchedDefectCount)),
  );
  const expectedDefects = defectScored.reduce(
    (sum, entry) => sum + Number(entry.expectedDefectCount),
    0,
  );
  const reportedDefects = defectScored.reduce(
    (sum, entry) => sum + Number(entry.reportedDefectCount || 0),
    0,
  );
  const matchedDefects = defectScored.reduce(
    (sum, entry) => sum + Number(entry.matchedDefectCount),
    0,
  );
  const centeringErrors = grade
    .map((entry) => Number(entry.centeringErrorPoints))
    .filter((value) => Number.isFinite(value) && value >= 0);
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
    minimumIdentifyCases: thresholds.minimumIdentifyCases ?? 100,
    minimumGradeCases: thresholds.minimumGradeCases ?? 500,
    minimumRepeatGroups: thresholds.minimumRepeatGroups ?? 100,
    topOneAccuracy: thresholds.topOneAccuracy ?? 0.9,
    topThreeAccuracy: thresholds.topThreeAccuracy ?? 0.98,
    falseConfidenceRate: thresholds.falseConfidenceRate ?? 0.02,
    gradeRangeCoverage: thresholds.gradeRangeCoverage ?? 0.85,
    abstentionAccuracy: thresholds.abstentionAccuracy ?? 0.9,
    p95LatencyMs: thresholds.p95LatencyMs ?? 20_000,
    withinOneGradeAgreement: thresholds.withinOneGradeAgreement ?? 0.95,
    falseGemMintRate: thresholds.falseGemMintRate ?? 0.05,
    repeatScanConsistency: thresholds.repeatScanConsistency ?? 0.95,
    scanCompletionRate: thresholds.scanCompletionRate ?? 0.9,
    requirePsaValidation: thresholds.requirePsaValidation ?? false,
    minimumPsaOutcomeCases: thresholds.minimumPsaOutcomeCases ?? 5_000,
    exactPsaLabelAgreement: thresholds.exactPsaLabelAgreement ?? 0.95,
    exactPsaWilsonLowerBound: thresholds.exactPsaWilsonLowerBound ?? 0.9,
    psaWithinOneAgreement: thresholds.psaWithinOneAgreement ?? 0.99,
    falsePsa10Rate: thresholds.falsePsa10Rate ?? 0.005,
    expectedCalibrationError: thresholds.expectedCalibrationError ?? 0.03,
    minimumSupportedCohortCases: thresholds.minimumSupportedCohortCases ?? 100,
    maximumCohortGateGap: thresholds.maximumCohortGateGap ?? 0.03,
    psaRepeatExact: thresholds.psaRepeatExact ?? 0.98,
    psaRepeatWithinOne: thresholds.psaRepeatWithinOne ?? 0.995,
  };
  const metrics = {
    cases: rows.length,
    identifyCases: identify.length,
    gradeCases: grade.length,
    topOneAccuracy: ratio(topOne, identifyScored.length),
    topThreeAccuracy: ratio(topThree, identifyScored.length),
    falseConfidenceRate: ratio(falseConfident, identifyScored.length),
    correctionRate: ratio(corrections, rows.length),
    gradeRangeCoverage: ratio(gradeCovered, gradeScored.length),
    exactGradeAgreement: ratio(exactGrade, gradeScored.length),
    withinOneGradeAgreement: ratio(withinOneGrade, gradeScored.length),
    falseGemMintRate: ratio(falseGemMint, gradeScored.length),
    meanAbsoluteGradeError: absoluteGradeErrors.length
      ? absoluteGradeErrors.reduce((sum, value) => sum + value, 0) /
        absoluteGradeErrors.length
      : null,
    brierScore: brierScores.length
      ? brierScores.reduce((sum, value) => sum + value, 0) / brierScores.length
      : null,
    averageGradeRangeWidth: gradeWidths.length
      ? gradeWidths.reduce((sum, value) => sum + value, 0) / gradeWidths.length
      : null,
    abstentionAccuracy: ratio(abstained, abstentionScored.length),
    abstentionRate: ratio(
      grade.filter(
        (entry) =>
          entry.analysis?.quality?.usable === false ||
          predictedGrade(entry) === null,
      ).length,
      grade.length,
    ),
    repeatScanConsistency: ratio(repeatConsistent, repeatable.length),
    repeatGroups: repeatable.length,
    scanCompletionRate: ratio(successfulScans, grade.length),
    defectPrecision: ratio(matchedDefects, reportedDefects),
    defectRecall: ratio(matchedDefects, expectedDefects),
    averageCenteringErrorPoints: centeringErrors.length
      ? centeringErrors.reduce((sum, value) => sum + value, 0) /
        centeringErrors.length
      : null,
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
    psaOutcomeCases: psaScored.length,
    psaPredictedCases: psaPredicted.length,
    psaPredictionCoverage: ratio(psaPredicted.length, psaScored.length),
    exactPsaLabelAgreement: ratio(exactPsaLabels, psaPredicted.length),
    exactPsaLabelWilson95: exactPsaInterval,
    psaWithinOneAgreement: ratio(psaWithinOne, psaNumericPredicted.length),
    falsePsa10Rate: predictedPsaTens.length
      ? ratio(falsePsaTens, predictedPsaTens.length)
      : 0,
    expectedCalibrationError: calibration.expectedCalibrationError,
    calibrationBins: calibration.bins,
    psaBrierScore: psaBrier.score,
    psaBrierCases: psaBrier.cases,
    psaAccuracyCoverageCurve: accuracyCoverageCurve(psaScored),
    psaConfusionMatrix: confusionMatrix(psaPredicted),
    physicalCardPartitionLeakage: leakage,
    dataLeakage: allLeakage,
    psaRepeatGroups: psaRepeatable.length,
    psaRepeatExactAgreement: ratio(psaRepeatExact, psaRepeatable.length),
    psaRepeatWithinOneAgreement: ratio(
      psaRepeatWithinOne,
      psaRepeatable.length,
    ),
    byPsaCohort: cohortMetrics,
    byCardType: groupedMetrics(grade, "cardType"),
    byPhotoQuality: groupedMetrics(grade, "photoQuality"),
    byExpectedGrade: groupedMetrics(
      grade.map((entry) => ({
        ...entry,
        expectedGradeBand: Number.isFinite(Number(entry.expectedGrade))
          ? String(Math.round(Number(entry.expectedGrade)))
          : "not_labeled",
      })),
      "expectedGradeBand",
    ),
    byConfidence: groupedMetrics(
      grade.map((entry) => ({
        ...entry,
        confidenceBand:
          Number(entry.analysis?.condition?.confidence) >= 0.8
            ? "high"
            : Number(entry.analysis?.condition?.confidence) >= 0.6
              ? "medium"
              : "low",
      })),
      "confidenceBand",
    ),
  };
  const checks = {
    identifySample: identifyScored.length >= Number(gates.minimumIdentifyCases),
    gradeSample: gradeScored.length >= Number(gates.minimumGradeCases),
    repeatSample: repeatable.length >= Number(gates.minimumRepeatGroups),
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
    withinOneGrade:
      metrics.withinOneGradeAgreement !== null &&
      metrics.withinOneGradeAgreement >= gates.withinOneGradeAgreement,
    falseGemMint:
      metrics.falseGemMintRate !== null &&
      metrics.falseGemMintRate <= gates.falseGemMintRate,
    repeatability:
      metrics.repeatScanConsistency !== null &&
      metrics.repeatScanConsistency >= gates.repeatScanConsistency,
    completion:
      metrics.scanCompletionRate !== null &&
      metrics.scanCompletionRate >= gates.scanCompletionRate,
    physicalCardIsolation: leakage.length === 0,
    captureIsolation:
      allLeakage.captureHashes.length === 0 &&
      allLeakage.lineageRoots.length === 0,
    temporalIsolation: allLeakage.temporalViolations.length === 0,
    supportedCohortMinimums:
      supportedCohorts.length === 0 ||
      supportedCohorts.every(
        (cohort) => cohort.cases >= gates.minimumSupportedCohortCases,
      ),
    supportedCohortSafety:
      supportedCohorts.length === 0 ||
      supportedCohorts.every(
        (cohort) =>
          cohort.exactAgreement !== null &&
          cohort.exactAgreement >=
            gates.exactPsaLabelAgreement - gates.maximumCohortGateGap &&
          cohort.withinOneAgreement !== null &&
          cohort.withinOneAgreement >=
            gates.psaWithinOneAgreement - gates.maximumCohortGateGap,
      ),
    psaValidation:
      !gates.requirePsaValidation ||
      (metrics.psaOutcomeCases >= gates.minimumPsaOutcomeCases &&
        metrics.exactPsaLabelAgreement !== null &&
        metrics.exactPsaLabelAgreement >= gates.exactPsaLabelAgreement &&
        metrics.exactPsaLabelWilson95.low !== null &&
        metrics.exactPsaLabelWilson95.low >= gates.exactPsaWilsonLowerBound &&
        metrics.psaWithinOneAgreement !== null &&
        metrics.psaWithinOneAgreement >= gates.psaWithinOneAgreement &&
        metrics.falsePsa10Rate !== null &&
        metrics.falsePsa10Rate <= gates.falsePsa10Rate &&
        metrics.expectedCalibrationError !== null &&
        metrics.expectedCalibrationError <= gates.expectedCalibrationError),
  };

  return {
    status: Object.values(checks).every(Boolean) ? "pass" : "not_ready",
    gates,
    metrics,
    checks,
  };
}
