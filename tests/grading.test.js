import test from "node:test";
import assert from "node:assert/strict";
import {
  calibratePsaProbabilities,
  calculateMicaPregrade,
  calculateMicaConditionScore,
  compareDigitalGradeStability,
  compareGradeIdentity,
  compareGradingPredictions,
  determineGradingAbstention,
  digitalGradeTier,
  inferDefectRegion,
  gradingEvidenceProfile,
  normalizePsaOutcome,
  probabilityWeightedPsaPregrade,
  resolveAutomaticGradeMatch,
  verifyDefectEvidence,
} from "../lib/grading.js";

test("PSA outcomes use the real label space and reject nonexistent 9.5", () => {
  assert.deepEqual(normalizePsaOutcome({ returnedGrade: 8.5 }), {
    outcomeKind: "numeric",
    returnedGrade: 8.5,
    returnedLabel: "8.5",
    qualifier: null,
    noGradeCode: null,
  });
  assert.equal(normalizePsaOutcome({ returnedGrade: 9.5 }), null);
  assert.equal(
    normalizePsaOutcome({
      outcomeKind: "qualified",
      returnedGrade: 8,
      qualifier: "OC",
    }).returnedLabel,
    "8 OC",
  );
  assert.equal(
    normalizePsaOutcome({ outcomeKind: "no_grade", noGradeCode: "N6" })
      .returnedLabel,
    "N6",
  );
});

test("Mica decimal pregrades are probability-weighted PSA expectations", () => {
  assert.equal(
    probabilityWeightedPsaPregrade([
      { grade: 9, probability: 0.9 },
      { grade: 10, probability: 0.1 },
    ]),
    9.1,
  );
  assert.equal(
    probabilityWeightedPsaPregrade([
      { grade: 9, probability: 0.1 },
      { grade: 10, probability: 0.9 },
    ]),
    9.9,
  );
  assert.equal(
    probabilityWeightedPsaPregrade([
      { grade: 8, probability: 0.5 },
      { grade: 10, probability: 0.5 },
    ]),
    9,
  );
});

test("validated PSA probabilities override the visible midpoint without inventing PSA 9.5", () => {
  const pregrade = calculateMicaPregrade({
    conditionScore: { status: "estimate", score: 8.7 },
    psaPrediction: {
      status: "estimate",
      validated: true,
      mostLikelyGrade: 10,
      probabilities: [
        { grade: 9, probability: 0.08 },
        { grade: 10, probability: 0.92 },
      ],
    },
  });
  assert.equal(pregrade.score, 9.9);
  assert.equal(pregrade.basis, "calibrated_expected_psa_outcome");
  assert.equal(pregrade.mostLikelyGrade, 10);
  assert.equal(pregrade.validatedPsaProbabilities, true);
});

test("evidence profile separates coverage, identity, and reviewer agreement", () => {
  const profile = gradingEvidenceProfile({
    quality: { usable: true, confidence: 0.9 },
    identity: { confidence: 0.96, finish: "Rainbow rare" },
    condition: {
      confidence: 0.86,
      subscores: [
        "centering",
        "corners",
        "edges",
        "surface",
        "structural_integrity",
      ].map((category) => ({
        category,
        scoreLow: 8,
        scoreHigh: 9,
        confidence: 0.82,
      })),
    },
    consensus: { overallGradeDisagreement: 0.2 },
  });
  assert.equal(profile.complete, true);
  assert.equal(profile.identityConfidence, 0.96);
  assert.equal(profile.reviewAgreement, 0.9);
  assert.equal(profile.finish, "Rainbow rare");
});

test("digital grades expose stable one-glance tiers", () => {
  assert.equal(digitalGradeTier(9.8), "Exceptional visible condition");
  assert.equal(digitalGradeTier(8.4), "Excellent visible condition");
  assert.equal(digitalGradeTier(7.4), "Strong visible condition");
  assert.equal(digitalGradeTier(6.5), "Moderate visible wear");
  assert.equal(digitalGradeTier(1.2), "Severe visible wear");
});

test("a digital grade cannot attach to a conflicting card identity", () => {
  const match = compareGradeIdentity(
    { name: "Mew ex", set: "151", number: "151/165", language: "en" },
    {
      name: "Mew ex",
      setName: "151",
      collectorNumber: "151/165",
      language: "en",
    },
  );
  assert.equal(match.status, "match");
  const mismatch = compareGradeIdentity(
    { name: "Mew ex", set: "151", number: "151/165", language: "en" },
    {
      name: "Mew ex",
      setName: "151",
      collectorNumber: "151/165",
      language: "ja",
    },
  );
  assert.equal(mismatch.status, "mismatch");
  assert.deepEqual(mismatch.mismatches, ["language"]);
});

test("a digital grade cannot attach when an expected identity field is unreadable", () => {
  const result = compareGradeIdentity(
    {
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      language: "en",
    },
    {
      name: "Charizard",
      setName: "Base Set",
      collectorNumber: "4/102",
    },
  );
  assert.equal(result.status, "insufficient");
  assert.deepEqual(result.missingFields, ["language"]);
});

test("language names and catalog codes agree without crossing languages", () => {
  assert.equal(
    compareGradeIdentity(
      {
        name: "Pikachu",
        set: "151",
        number: "025/165",
        language: "en",
      },
      {
        name: "Pikachu",
        setName: "151",
        collectorNumber: "025/165",
        language: "English",
      },
    ).status,
    "match",
  );
  assert.equal(
    compareGradeIdentity(
      {
        name: "Pikachu",
        set: "151",
        number: "025/165",
        language: "ja",
      },
      {
        name: "Pikachu",
        setName: "151",
        collectorNumber: "025/165",
        language: "English",
      },
    ).status,
    "mismatch",
  );
});

test("a scanned printing automatically resolves to its eligible raw collection card", () => {
  const rawMewtwo = {
    uid: "raw-mewtwo",
    id: "sm12-76",
    name: "Mewtwo GX",
    set: "Hidden Fates",
    number: "76/73",
    language: "en",
    status: "owned",
    cardState: "raw",
    quantity: 1,
  };
  const result = resolveAutomaticGradeMatch({
    items: [
      rawMewtwo,
      { ...rawMewtwo, uid: "professional", gradingCompany: "PSA" },
      { ...rawMewtwo, uid: "sealed", cardState: "sealed" },
    ],
    observed: {
      name: "Mewtwo GX",
      setName: "Hidden Fates",
      collectorNumber: "76/73",
      language: "English",
    },
  });
  assert.equal(result.status, "matched");
  assert.equal(result.item.uid, "raw-mewtwo");
});

test("automatic grading never attaches an uncertain identity to a collection card", () => {
  const result = resolveAutomaticGradeMatch({
    items: [
      {
        uid: "mewtwo",
        name: "Mewtwo GX",
        set: "Hidden Fates",
        number: "76/73",
        language: "en",
        status: "owned",
        cardState: "raw",
      },
    ],
    observed: {
      name: "Mewtwo GX",
      setName: "Hidden Fates",
      collectorNumber: "76/73",
    },
  });
  assert.equal(result.status, "not_found");
  assert.equal(result.item, null);
});

test("a wildly different regrade protects the saved DG number", () => {
  const unstable = compareDigitalGradeStability(
    { predictedGrade: 9.1, confidence: 0.85, defects: [] },
    { predictedGrade: 7.7, confidence: 0.82, defects: [] },
  );
  assert.equal(unstable.stable, false);
  assert.equal(unstable.gradeDelta, 1.4);
  const stable = compareDigitalGradeStability(
    { predictedGrade: 8.4, confidence: 0.8, defects: [] },
    { predictedGrade: 8.8, confidence: 0.78, defects: [] },
  );
  assert.equal(stable.stable, true);
});

test("Mica condition score is decimal, conservative, and explicitly unvalidated", () => {
  const result = calculateMicaConditionScore({
    quality: { confidence: 0.92 },
    condition: {
      confidence: 0.88,
      subscores: [
        { category: "centering", scoreLow: 9, scoreHigh: 10, confidence: 0.9 },
        { category: "corners", scoreLow: 8, scoreHigh: 9, confidence: 0.85 },
        { category: "edges", scoreLow: 8, scoreHigh: 9, confidence: 0.84 },
        { category: "surface", scoreLow: 7, scoreHigh: 8, confidence: 0.8 },
      ],
    },
  });
  assert.equal(result.status, "estimate");
  assert.equal(result.validated, false);
  assert.equal(result.rubricVersion, "mica-condition-rubric-v4");
  assert.equal(Number.isInteger(result.score), false);
  assert.ok(result.score >= result.low && result.score <= result.high);
  assert.ok(result.score < 9);
});

test("defect evidence must remain tied to a bounded visible region", () => {
  const localized = verifyDefectEvidence({
    side: "front",
    area: "top-left corner",
    category: "corners",
    severity: "minor",
    evidence: "A small white point is visible against the dark border.",
    confidence: 0.82,
    region: { x: 0.01, y: 0.02, width: 0.12, height: 0.13 },
  });
  assert.equal(localized.verificationStatus, "localized");
  assert.deepEqual(localized.region, {
    x: 0.01,
    y: 0.02,
    width: 0.12,
    height: 0.13,
  });
  const unsupported = verifyDefectEvidence({
    side: "unknown",
    category: "surface",
    evidence: "Scratch",
    confidence: 0.9,
  });
  assert.equal(unsupported.verificationStatus, "unverified");
  assert.deepEqual(inferDefectRegion("bottom right corner", "corners"), {
    x: 0.72,
    y: 0.72,
    width: 0.28,
    height: 0.28,
  });
});

test("PSA odds remain unavailable until a held-out calibration is supplied", () => {
  const input = {
    quality: { usable: true, confidence: 0.91, issues: [] },
    condition: {
      estimatedGradeLow: 8,
      estimatedGradeHigh: 10,
      confidence: 0.86,
      blockers: [],
      subscores: [
        { category: "centering", scoreLow: 9, scoreHigh: 10, confidence: 0.9 },
        { category: "corners", scoreLow: 8, scoreHigh: 9, confidence: 0.8 },
        { category: "edges", scoreLow: 9, scoreHigh: 9, confidence: 0.85 },
        { category: "surface", scoreLow: 8, scoreHigh: 9, confidence: 0.8 },
      ],
    },
    defects: [],
  };
  const withheld = calibratePsaProbabilities(input);
  assert.equal(withheld.status, "unavailable");
  assert.equal(withheld.validated, false);
  assert.equal(withheld.mostLikelyGrade, null);
  assert.deepEqual(withheld.probabilities, []);
  const result = calibratePsaProbabilities({
    ...input,
    calibration: {
      validated: true,
      version: "psa-heldout-2026-08",
      confidence: 0.78,
      probabilities: [
        { grade: 8, probability: 0.2 },
        { grade: 9, probability: 0.5 },
        { grade: 10, probability: 0.3 },
      ],
    },
  });
  assert.equal(result.status, "estimate");
  assert.equal(result.validated, true);
  assert.equal(result.targetGrader, "PSA");
  assert.equal(result.probabilities.length, 3);
  assert.ok(result.mostLikelyGrade >= 8 && result.mostLikelyGrade <= 10);
  assert.ok(
    Math.abs(
      result.probabilities.reduce((sum, row) => sum + row.probability, 0) - 1,
    ) < 0.0001,
  );
});

test("low-quality grading abstains instead of manufacturing a grade", () => {
  const input = {
    quality: {
      usable: false,
      confidence: 0.3,
      issues: [
        {
          severity: "blocking",
          message: "Glare hides the upper half of the card.",
        },
      ],
    },
    condition: {
      estimatedGradeLow: 8,
      estimatedGradeHigh: 10,
      confidence: 0.4,
      subscores: [],
      blockers: [],
    },
  };
  const abstention = determineGradingAbstention(input);
  const prediction = calibratePsaProbabilities(input);
  assert.equal(abstention.abstained, true);
  assert.equal(prediction.status, "abstained");
  assert.equal(prediction.mostLikelyGrade, null);
  assert.equal(prediction.probabilities.length, 0);
});

test("major structural damage blocks a deceptively high digital grade", () => {
  const input = {
    quality: { usable: true, confidence: 0.94, issues: [] },
    condition: {
      estimatedGradeLow: 8.5,
      estimatedGradeHigh: 9.5,
      confidence: 0.9,
      blockers: [],
      subscores: [
        { category: "centering", scoreLow: 9, scoreHigh: 10, confidence: 0.9 },
        { category: "corners", scoreLow: 9, scoreHigh: 10, confidence: 0.9 },
        { category: "edges", scoreLow: 9, scoreHigh: 10, confidence: 0.9 },
        { category: "surface", scoreLow: 8, scoreHigh: 9, confidence: 0.9 },
      ],
      defects: [
        {
          side: "back",
          area: "center",
          category: "crease",
          severity: "major",
          evidence: "A long visible fold crosses the card stock.",
          confidence: 0.92,
          region: { x: 0.2, y: 0.2, width: 0.6, height: 0.5 },
        },
      ],
    },
  };
  const score = calculateMicaConditionScore(input);
  const prediction = calibratePsaProbabilities({
    ...input,
    defects: input.condition.defects,
  });
  assert.equal(score.status, "unavailable");
  assert.match(score.reason, /structural damage/i);
  assert.equal(prediction.status, "abstained");
  assert.match(prediction.reasons.join(" "), /in-person review/i);
});

test("a major localized finding cannot coexist with a high condition score", () => {
  const input = {
    quality: { usable: true, confidence: 0.91, issues: [] },
    condition: {
      estimatedGradeLow: 8,
      estimatedGradeHigh: 9,
      confidence: 0.88,
      blockers: [],
      subscores: [
        { category: "centering", scoreLow: 9, scoreHigh: 9, confidence: 0.9 },
        { category: "corners", scoreLow: 8, scoreHigh: 9, confidence: 0.86 },
        { category: "edges", scoreLow: 8, scoreHigh: 9, confidence: 0.86 },
        { category: "surface", scoreLow: 8, scoreHigh: 9, confidence: 0.86 },
      ],
      defects: [
        {
          side: "back",
          area: "top edge",
          category: "edges",
          severity: "major",
          evidence: "A long chipped section is visible along the top edge.",
          confidence: 0.9,
          region: { x: 0.15, y: 0, width: 0.7, height: 0.12 },
        },
      ],
    },
  };
  const score = calculateMicaConditionScore(input);
  const prediction = calibratePsaProbabilities({
    ...input,
    defects: input.condition.defects,
  });
  assert.equal(score.status, "unavailable");
  assert.match(score.reason, /conflicts with the high condition range/i);
  assert.equal(prediction.status, "abstained");
});

test("report comparison identifies changed findings without changing history", () => {
  const base = {
    mostLikelyGrade: 8,
    defects: [
      {
        side: "back",
        area: "top edge",
        category: "edges",
        severity: "minor",
        evidence: "Small white point is visible.",
        confidence: 0.8,
        region: { x: 0.3, y: 0, width: 0.2, height: 0.12 },
      },
    ],
  };
  const comparison = compareGradingPredictions(base, {
    mostLikelyGrade: 9,
    defects: [],
  });
  assert.equal(comparison.gradeChange, 1);
  assert.equal(comparison.removedFindings.length, 1);
  assert.equal(comparison.addedFindings.length, 0);
});

test("intentional rainbow foil and moving reflections cannot become defects", () => {
  const region = { x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
  const intentional = verifyDefectEvidence({
    side: "front",
    area: "artwork",
    category: "holo_scratch",
    severity: "major",
    evidence: "Rainbow line follows the intentional textured foil pattern.",
    confidence: 0.94,
    region,
    visualCause: "intentional_print_effect",
    confirmedAcrossViews: true,
  });
  assert.equal(intentional.verificationStatus, "unverified");

  const reflection = verifyDefectEvidence({
    side: "front",
    area: "artwork",
    category: "surface_scuff",
    severity: "moderate",
    evidence: "Bright patch moved when the lighting angle changed.",
    confidence: 0.88,
    region,
    visualCause: "physical_damage",
    confirmedAcrossViews: false,
  });
  assert.equal(reflection.verificationStatus, "unverified");

  const scratch = verifyDefectEvidence({
    side: "front",
    area: "artwork",
    category: "holo_scratch",
    severity: "minor",
    evidence: "A localized physical line repeats at the same coordinates.",
    confidence: 0.86,
    region,
    visualCause: "physical_damage",
    confirmedAcrossViews: true,
  });
  assert.equal(scratch.verificationStatus, "localized");

  const impossibleClaim = verifyDefectEvidence(
    {
      side: "front",
      area: "artwork",
      category: "holo_scratch",
      severity: "minor",
      evidence: "A localized line was claimed across multiple views.",
      confidence: 0.86,
      region,
      visualCause: "physical_damage",
      confirmedAcrossViews: true,
    },
    0,
    {
      enforceSameSideEvidence: true,
      sideViewCounts: { front: 1, back: 1 },
    },
  );
  assert.equal(impossibleClaim.confirmedAcrossViews, false);
  assert.equal(impossibleClaim.verificationStatus, "unverified");

  const corroborated = verifyDefectEvidence(
    {
      side: "front",
      area: "artwork",
      category: "holo_scratch",
      severity: "minor",
      evidence: "A localized line repeats at the same coordinates.",
      confidence: 0.86,
      region,
      visualCause: "physical_damage",
      confirmedAcrossViews: true,
    },
    0,
    {
      enforceSameSideEvidence: true,
      sideViewCounts: { front: 2, back: 1 },
    },
  );
  assert.equal(corroborated.confirmedAcrossViews, true);
  assert.equal(corroborated.verificationStatus, "localized");
});
