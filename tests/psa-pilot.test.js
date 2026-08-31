import test from "node:test";
import assert from "node:assert/strict";
import { selectStratifiedPsaPilot } from "../lib/psa-pilot.js";

function candidate(index) {
  const grade = index < 8 ? 3 : index < 20 ? 6 : index < 42 ? 9 : 10;
  return {
    physicalCardId: `physical-${String(index).padStart(3, "0")}`,
    returnedGrade: grade,
    verificationStatus: "independently_verified",
    proofVerified: true,
    front: `/private/front-${index}.jpg`,
    back: `/private/back-${index}.jpg`,
    finishClass:
      index < 12
        ? "rainbow_hyper_rare"
        : index < 22
          ? "traditional_holo"
          : "non_holo",
    language: index < 8 ? "ja" : "en",
    manufacturingEra: index < 10 ? "vintage" : "modern",
    knownDamage: index < 10,
  };
}

test("the 50-card PSA pilot is balanced, proof-backed, and physical-card unique", () => {
  const result = selectStratifiedPsaPilot(
    Array.from({ length: 55 }, (_, index) => candidate(index)),
    50,
  );
  assert.equal(result.status, "ready");
  assert.equal(result.selected.length, 50);
  assert.equal(
    new Set(result.selected.map((entry) => entry.physicalCardId)).size,
    50,
  );
  assert.equal(Object.keys(result.gaps).length, 0);
});

test("the pilot reports exact cohort shortages instead of padding with weak labels", () => {
  const weak = Array.from({ length: 12 }, (_, index) => ({
    ...candidate(index),
    proofVerified: index < 4,
  }));
  const result = selectStratifiedPsaPilot(weak, 50);
  assert.equal(result.status, "blocked");
  assert.equal(result.eligibleCandidates, 4);
  assert.equal(result.gaps.total_verified_cards, 46);
});
