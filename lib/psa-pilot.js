import { PSA_NUMERIC_LABELS } from "./grading.js";

export const PSA_PILOT_QUOTAS = Object.freeze({
  finish_reflective_specialty: 12,
  finish_standard_foil: 10,
  finish_non_holo: 10,
  language_ja: 8,
  language_en: 30,
  era_vintage: 10,
  era_modern: 30,
  known_damage: 10,
  grade_low: 8,
  grade_mid: 12,
  grade_high: 20,
  grade_10: 8,
});

const SPECIALTY_FINISHES = new Set([
  "rainbow_hyper_rare",
  "textured_full_art",
  "etched",
  "radiant",
  "vintage_foil",
]);
const STANDARD_FOILS = new Set(["traditional_holo", "reverse_holo"]);

function canonicalLanguage(value) {
  const language = String(value || "")
    .trim()
    .toLowerCase();
  if (language === "japanese") return "ja";
  if (language === "english") return "en";
  return language;
}

function gradeBand(grade) {
  if (grade === 10) return "grade_10";
  if (grade >= 8) return "grade_high";
  if (grade >= 4.5) return "grade_mid";
  return "grade_low";
}

function tagsFor(entry) {
  const finish = String(entry.finishClass || "unknown").toLowerCase();
  const language = canonicalLanguage(entry.language);
  const era = String(entry.manufacturingEra || "unknown").toLowerCase();
  const tags = new Set([gradeBand(Number(entry.returnedGrade))]);
  if (SPECIALTY_FINISHES.has(finish)) tags.add("finish_reflective_specialty");
  if (STANDARD_FOILS.has(finish)) tags.add("finish_standard_foil");
  if (finish === "non_holo") tags.add("finish_non_holo");
  if (language === "ja") tags.add("language_ja");
  if (language === "en") tags.add("language_en");
  if (era === "vintage") tags.add("era_vintage");
  if (era === "modern") tags.add("era_modern");
  if (entry.knownDamage === true) tags.add("known_damage");
  return tags;
}

function eligible(entry) {
  return Boolean(
    entry?.physicalCardId &&
    PSA_NUMERIC_LABELS.includes(Number(entry.returnedGrade)) &&
    entry.verificationStatus === "independently_verified" &&
    entry.proofVerified === true &&
    entry.front &&
    entry.back,
  );
}

function currentCounts(selected) {
  const counts = Object.fromEntries(
    Object.keys(PSA_PILOT_QUOTAS).map((key) => [key, 0]),
  );
  for (const entry of selected) {
    for (const tag of tagsFor(entry)) {
      if (counts[tag] != null) counts[tag] += 1;
    }
  }
  return counts;
}

export function selectStratifiedPsaPilot(entries = [], target = 50) {
  const desired = Math.max(1, Math.min(500, Math.trunc(Number(target) || 50)));
  const seenCards = new Set();
  const candidates = (Array.isArray(entries) ? entries : [])
    .filter(eligible)
    .filter((entry) => {
      if (seenCards.has(entry.physicalCardId)) return false;
      seenCards.add(entry.physicalCardId);
      return true;
    })
    .sort((left, right) =>
      String(left.physicalCardId).localeCompare(String(right.physicalCardId)),
    );
  const selected = [];
  const remaining = [...candidates];
  while (selected.length < desired && remaining.length) {
    const counts = currentCounts(selected);
    let bestIndex = 0;
    let bestScore = -1;
    remaining.forEach((entry, index) => {
      const score = [...tagsFor(entry)].reduce((sum, tag) => {
        const quota = PSA_PILOT_QUOTAS[tag];
        if (!quota || counts[tag] >= quota) return sum;
        return sum + 1 + (quota - counts[tag]) / quota;
      }, 0);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  const counts = currentCounts(selected);
  const gaps = Object.fromEntries(
    Object.entries(PSA_PILOT_QUOTAS)
      .map(([key, quota]) => [key, Math.max(0, quota - counts[key])])
      .filter(([, gap]) => gap > 0),
  );
  if (selected.length < desired)
    gaps.total_verified_cards = desired - selected.length;
  return {
    status:
      selected.length === desired && !Object.keys(gaps).length
        ? "ready"
        : "blocked",
    target: desired,
    eligibleCandidates: candidates.length,
    selected,
    counts,
    quotas: { ...PSA_PILOT_QUOTAS },
    gaps,
  };
}
