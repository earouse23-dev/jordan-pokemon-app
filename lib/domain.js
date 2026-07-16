export const RAW_CONDITIONS = Object.freeze([
  "near_mint",
  "lightly_played",
  "moderately_played",
  "heavily_played",
  "damaged",
]);
export const GRADERS = Object.freeze(["PSA", "BGS", "CGC", "SGC", "OTHER"]);

const CONDITION_ALIASES = new Map([
  ["nm", "near_mint"],
  ["near mint", "near_mint"],
  ["near_mint", "near_mint"],
  ["lp", "lightly_played"],
  ["light play", "lightly_played"],
  ["lightly played", "lightly_played"],
  ["lightly_played", "lightly_played"],
  ["mp", "moderately_played"],
  ["moderate play", "moderately_played"],
  ["moderately played", "moderately_played"],
  ["moderately_played", "moderately_played"],
  ["hp", "heavily_played"],
  ["heavy play", "heavily_played"],
  ["heavily played", "heavily_played"],
  ["heavily_played", "heavily_played"],
  ["dmg", "damaged"],
  ["damage", "damaged"],
  ["damaged", "damaged"],
]);

const GRADER_ALIASES = new Map([
  ["PSA", "PSA"],
  ["PROFESSIONAL SPORTS AUTHENTICATOR", "PSA"],
  ["BGS", "BGS"],
  ["BECKETT", "BGS"],
  ["BECKETT GRADING SERVICES", "BGS"],
  ["CGC", "CGC"],
  ["CERTIFIED GUARANTY COMPANY", "CGC"],
  ["SGC", "SGC"],
  ["SPORTSCARD GUARANTY", "SGC"],
]);

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeRawCondition(value) {
  const original = String(value ?? "").trim();
  return {
    normalized:
      CONDITION_ALIASES.get(original.toLowerCase().replaceAll("-", " ")) ||
      null,
    original,
  };
}

export function normalizeGrader(value) {
  const original = String(value ?? "").trim();
  if (!original) return { normalized: null, original };
  return {
    normalized: GRADER_ALIASES.get(original.toUpperCase()) || "OTHER",
    original,
  };
}

export function normalizeGrade(value) {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  const grade = Number(value);
  if (
    !Number.isFinite(grade) ||
    grade < 1 ||
    grade > 10 ||
    Math.round(grade * 10) !== grade * 10
  )
    return null;
  return Number.isInteger(grade) ? String(grade) : grade.toFixed(1);
}

export function canonicalCardFingerprint(card) {
  const identity = [
    card.game || "pokemon",
    card.language,
    card.setCode || card.set_id,
    card.setName || card.set,
    card.cardNumber || card.number,
    card.printedTotal,
    card.name,
    card.releaseYear || card.releaseDate,
    card.rarity,
    card.variant,
    card.finish,
    card.edition,
    card.firstEdition,
    card.shadowless,
    card.promo,
  ].map(normalizeText);
  return identity.join("|");
}

export function assetKey(value) {
  const cardState =
    value.cardState ||
    (value.gradingCompany || value.grader ? "graded" : "raw");
  return [
    value.cardId || value.id,
    value.cardVariantId || value.variantId || value.variant,
    cardState,
    cardState === "raw"
      ? normalizeRawCondition(value.rawCondition || value.condition).normalized
      : "",
    cardState === "graded"
      ? normalizeGrader(value.grader || value.gradingCompany).normalized
      : "",
    cardState === "graded" ? normalizeGrade(value.grade) : "",
    String(value.currency || "USD").toUpperCase(),
  ].join("|");
}

export function isCompatibleObservation(observation, position) {
  if (
    !observation ||
    Number(observation.marketPrice ?? observation.amount) <= 0
  )
    return false;
  if (
    String(observation.currency || "").toUpperCase() !==
    String(position.currency || "USD").toUpperCase()
  )
    return false;
  const state =
    position.cardState ||
    (position.gradingCompany || position.grader ? "graded" : "raw");
  const observationState =
    observation.cardState ||
    (observation.gradingCompany || observation.grader ? "graded" : "raw");
  if (state !== observationState) return false;
  if (
    position.finish &&
    observation.finish &&
    normalizeText(position.finish) !== normalizeText(observation.finish)
  )
    return false;
  if (
    position.edition &&
    observation.edition &&
    normalizeText(position.edition) !== normalizeText(observation.edition)
  )
    return false;
  if (state === "graded") {
    return (
      normalizeGrader(position.grader || position.gradingCompany).normalized ===
        normalizeGrader(observation.grader || observation.gradingCompany)
          .normalized &&
      normalizeGrade(position.grade) === normalizeGrade(observation.grade)
    );
  }
  const requested = normalizeRawCondition(
    position.rawCondition || position.condition,
  ).normalized;
  const observed = normalizeRawCondition(
    observation.rawCondition || observation.condition,
  ).normalized;
  return !requested || !observed || requested === observed;
}

export function observationTimestamp(observation) {
  return new Date(
    observation.providerUpdatedAt ||
      observation.observedAt ||
      observation.retrievedAt ||
      0,
  ).getTime();
}

export function selectValuation(observations, position, options = {}) {
  const staleAfterHours = Number(options.staleAfterHours ?? 72);
  const now = Number(options.now ?? Date.now());
  const authority =
    position.cardState === "graded" || position.gradingCompany
      ? ["pkmnprices", "cardladder", "alt"]
      : ["pkmnprices", "tcgplayer", "tcgdex", "cardmarket"];
  const compatible = (observations || []).filter(
    (item) => isCompatibleObservation(item, position) && !item.anomalous,
  );
  compatible.sort((left, right) => {
    const providerRank = (value) => {
      const provider = String(
        value.provider || value.source || "",
      ).toLowerCase();
      const exact = authority.indexOf(provider);
      const aggregate =
        provider === "tcgplayer" &&
        String(value.quality?.aggregator || "").toLowerCase() === "pkmnprices"
          ? 0
          : exact;
      return aggregate < 0 ? authority.length : aggregate;
    };
    return (
      providerRank(left) - providerRank(right) ||
      observationTimestamp(right) - observationTimestamp(left)
    );
  });
  const selected = compatible[0] || null;
  if (!selected)
    return {
      selected: null,
      compatible: [],
      stale: false,
      reason: "unavailable",
    };
  const ageHours = (now - observationTimestamp(selected)) / 3_600_000;
  return {
    selected,
    compatible,
    stale: !Number.isFinite(ageHours) || ageHours > staleAfterHours,
    reason: "exact_match",
  };
}

export function observationKey(observation) {
  return [
    assetKey(observation),
    observation.provider,
    observation.market,
    observation.valuationType || observation.priceType,
    observation.observedAt,
    observation.marketPrice ?? observation.amount,
  ].join("|");
}

export function detectPriceAnomaly(previous, next, thresholdPercent = 40) {
  const before = Number(previous?.marketPrice ?? previous?.amount);
  const after = Number(next?.marketPrice ?? next?.amount);
  if (!(before > 0) || !(after > 0)) return null;
  const changePercent = Math.abs((after - before) / before) * 100;
  return changePercent > thresholdPercent
    ? { type: "price_jump", changePercent }
    : null;
}
