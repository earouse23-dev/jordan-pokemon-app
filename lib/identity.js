export const IDENTITY_SCHEMA_VERSION = 1;
export const IDENTITY_RULE_VERSION = "identity-match-v1";

const LANGUAGE_ALIASES = new Map([
  ["english", "en"],
  ["eng", "en"],
  ["en", "en"],
  ["japanese", "ja"],
  ["japan", "ja"],
  ["jp", "ja"],
  ["jpn", "ja"],
  ["ja", "ja"],
  ["french", "fr"],
  ["fr", "fr"],
  ["german", "de"],
  ["de", "de"],
  ["spanish", "es"],
  ["es", "es"],
  ["italian", "it"],
  ["it", "it"],
  ["portuguese", "pt"],
  ["pt", "pt"],
  ["traditional chinese", "zh-tw"],
  ["chinese traditional", "zh-tw"],
  ["zh-tw", "zh-tw"],
  ["indonesian", "id"],
  ["id", "id"],
  ["thai", "th"],
  ["th", "th"],
]);

const FINISH_ALIASES = new Map([
  ["normal", "non_holo"],
  ["non holo", "non_holo"],
  ["non holofoil", "non_holo"],
  ["nonholo", "non_holo"],
  ["non_holo", "non_holo"],
  ["holo", "holofoil"],
  ["holofoil", "holofoil"],
  ["traditional holo", "holofoil"],
  ["reverse", "reverse_holofoil"],
  ["reverse holo", "reverse_holofoil"],
  ["reverse holofoil", "reverse_holofoil"],
  ["reverse_holofoil", "reverse_holofoil"],
  ["parallel", "parallel"],
  ["parallel foil", "parallel"],
  ["cosmos holo", "cosmos_holofoil"],
  ["cosmos holofoil", "cosmos_holofoil"],
  ["etched", "etched_holofoil"],
  ["etched holo", "etched_holofoil"],
  ["etched holofoil", "etched_holofoil"],
  ["textured", "textured_holofoil"],
  ["textured holo", "textured_holofoil"],
  ["textured holofoil", "textured_holofoil"],
  ["rainbow", "rainbow_holofoil"],
  ["rainbow holo", "rainbow_holofoil"],
  ["radiant", "radiant_holofoil"],
]);

const EDITION_ALIASES = new Map([
  ["", "unlimited"],
  ["unlimited", "unlimited"],
  ["first edition", "first_edition"],
  ["1st edition", "first_edition"],
  ["first_edition", "first_edition"],
  ["shadowless", "shadowless"],
  ["unlimited shadowless", "shadowless"],
  ["parallel", "parallel"],
]);

const PROMO_ALIASES = new Map([
  ["", "none"],
  ["none", "none"],
  ["promo", "promo"],
  ["black star promo", "black_star"],
  ["black star", "black_star"],
  ["prerelease", "prerelease"],
  ["pre release", "prerelease"],
  ["staff", "staff"],
  ["league", "league"],
  ["deck exclusive", "deck_exclusive"],
  ["store exclusive", "store_exclusive"],
]);

const MATCH_FIELDS = Object.freeze([
  ["name", 8],
  ["set", 7],
  ["number", 8],
  ["language", 6],
  ["finish", 5],
  ["edition", 4],
  ["promoType", 4],
  ["productType", 4],
  ["grader", 3],
  ["grade", 3],
]);
const DISCRIMINATORS = Object.freeze([
  "language",
  "finish",
  "edition",
  "promoType",
  "productType",
  "grader",
  "grade",
]);

function clean(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function rawVariantText(value) {
  if (typeof value === "string") return value;
  return [
    value?.edition,
    value?.finish,
    value?.variant,
    value?.variant_type,
    value?.variantType,
  ]
    .filter(Boolean)
    .join(" ");
}

export function canonicalLanguage(value) {
  const original = String(value ?? "").trim();
  const normalized = LANGUAGE_ALIASES.get(original.toLowerCase());
  if (normalized) return normalized;
  const tag = original.toLowerCase();
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(tag) ? tag : null;
}

export function canonicalCollectorNumber(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .split("/")
    .map((part) => (/^\d+$/.test(part) ? part.replace(/^0+(?=\d)/, "") : part))
    .join("/");
}

export function canonicalFinish(value) {
  const key = clean(rawVariantText(value));
  if (!key) return "unknown";
  const aliased = FINISH_ALIASES.get(key);
  if (aliased) return aliased;
  if (key.includes("reverse")) return "reverse_holofoil";
  if (key.includes("cosmos")) return "cosmos_holofoil";
  if (key.includes("etched")) return "etched_holofoil";
  if (key.includes("texture")) return "textured_holofoil";
  if (key.includes("rainbow") || key.includes("hyper"))
    return "rainbow_holofoil";
  if (key.includes("radiant")) return "radiant_holofoil";
  if (key.includes("parallel")) return "parallel";
  if (key.includes("holo")) return "holofoil";
  return "unknown";
}

export function canonicalEdition(value) {
  if (typeof value === "object" && value) {
    if (value.is_first_edition || value.isFirstEdition) return "first_edition";
    if (value.is_shadowless || value.isShadowless) return "shadowless";
    value = value.edition;
  }
  const key = clean(value);
  if (key.includes("first edition") || key.includes("1st edition"))
    return "first_edition";
  if (key.includes("shadowless")) return "shadowless";
  if (key.includes("parallel")) return "parallel";
  return (
    EDITION_ALIASES.get(key) || (key ? key.replaceAll(" ", "_") : "unlimited")
  );
}

export function canonicalPromoType(value) {
  if (typeof value === "object" && value) {
    if (!(value.is_promo || value.isPromo || value.promo || value.promoType))
      return "none";
    value = value.promoType || value.promo_type || value.variant || "promo";
  }
  const key = clean(value);
  return PROMO_ALIASES.get(key) || (key ? key.replaceAll(" ", "_") : "none");
}

function title(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Non Holo", "Non-holo")
    .replace("First Edition", "1st Edition");
}

export function normalizeVariantOption(value, defaults = {}) {
  const source = typeof value === "object" && value ? value : {};
  const raw = typeof value === "string" ? value : rawVariantText(source);
  const finish = canonicalFinish(source.finish || raw);
  const edition = canonicalEdition(source.edition ?? raw);
  const promoType = canonicalPromoType(
    source.promoType || source.promo_type || (source.is_promo ? "promo" : ""),
  );
  const language =
    canonicalLanguage(source.language || defaults.language) || "unknown";
  const id = String(
    source.collectibleId ||
      source.collectible_id ||
      source.id ||
      source.variantId ||
      source.variant_id ||
      defaults.id ||
      "",
  );
  const parts = [];
  if (edition !== "unlimited") parts.push(title(edition));
  parts.push(title(finish));
  if (
    promoType !== "none" &&
    !parts.some((part) => clean(part).includes("promo"))
  )
    parts.push(title(promoType));
  const label =
    String(source.label || "").trim() ||
    parts.join(" · ") ||
    raw ||
    "Unknown version";
  return {
    id: id || null,
    collectibleId:
      String(source.collectibleId || source.collectible_id || id || "") || null,
    label,
    finish,
    edition,
    promoType,
    language,
    status:
      source.status ||
      (id && finish !== "unknown" && language !== "unknown"
        ? "exact"
        : "needs_review"),
    metadata:
      source.metadata && typeof source.metadata === "object"
        ? source.metadata
        : {},
  };
}

export function variantOptionSummary(value) {
  const option = normalizeVariantOption(value);
  const parts = [option.label];
  if (option.language !== "unknown") parts.push(option.language.toUpperCase());
  if (option.status !== "exact") parts.push("confirm details");
  return [...new Set(parts)].join(" · ");
}

export function variantDifferenceFields(options = []) {
  const normalized = options.map((option) => normalizeVariantOption(option));
  return ["finish", "edition", "promoType", "language"].filter(
    (field) => new Set(normalized.map((option) => option[field])).size > 1,
  );
}

export function selectVariantOption(card = {}, selected = "") {
  const rawOptions = Array.isArray(card.variantOptions)
    ? card.variantOptions
    : Array.isArray(card.variants)
      ? card.variants
      : [card.variant || selected].filter(Boolean);
  const options = rawOptions.map((option, index) =>
    normalizeVariantOption(option, {
      language: card.language,
      id:
        typeof option === "string"
          ? `${card.id || "card"}:${index}:${clean(option)}`
          : null,
    }),
  );
  if (!options.length)
    return normalizeVariantOption("", { language: card.language });
  if (typeof selected === "object" && selected)
    return normalizeVariantOption(selected, { language: card.language });
  const key = String(
    selected || card.variantId || card.collectibleId || card.variant || "",
  );
  return (
    options.find(
      (option) =>
        option.id === key ||
        option.collectibleId === key ||
        option.label === key ||
        option.finish === canonicalFinish(key),
    ) || options[0]
  );
}

export function collectibleIdentitySnapshot(card = {}, variant = "") {
  const option = selectVariantOption(card, variant);
  const sealed = card.cardState === "sealed" || Boolean(card.productType);
  return {
    identitySchemaVersion: IDENTITY_SCHEMA_VERSION,
    identityRuleVersion: IDENTITY_RULE_VERSION,
    identityStatus: option.status,
    collectibleId: option.collectibleId || card.collectibleId || null,
    providerCardId:
      card.providerCardId ||
      card.externalIds?.tcgdex ||
      card.catalogIdentityId ||
      card.id ||
      null,
    name: card.name || "",
    set: card.set || card.setName || "",
    setId: card.setId || null,
    number: card.number || card.collectorNumber || "",
    language: canonicalLanguage(card.language || option.language) || "unknown",
    rarity: card.rarity || null,
    variant: sealed ? "Sealed product" : option.label,
    finish: sealed ? "sealed" : option.finish,
    edition: sealed ? "sealed" : option.edition,
    promoType: sealed ? "none" : option.promoType,
    release: card.release || card.releaseDate || null,
    artist: card.artist || null,
    image: card.image || card.thumb || null,
    thumb: card.thumb || card.image || null,
    productType: card.productType || null,
    cardState: card.cardState || (sealed ? "sealed" : null),
    cardId: card.cardId || card.internalId || null,
    variantId: sealed ? null : option.id || card.variantId || null,
    externalIds: card.externalIds || {},
  };
}

function normalizedMatchValue(field, value) {
  if (field === "language") return canonicalLanguage(value) || "";
  if (field === "number") return canonicalCollectorNumber(value);
  if (field === "finish") return canonicalFinish(value);
  if (field === "edition") return canonicalEdition(value);
  if (field === "promoType") return canonicalPromoType(value);
  if (field === "grade") {
    const grade = Number(value);
    return Number.isFinite(grade) ? String(grade) : "";
  }
  return clean(value);
}

function matchShape(value = {}) {
  return {
    id: String(value.collectibleId || value.id || ""),
    name: value.name,
    set: value.set || value.setName,
    number: value.number || value.collectorNumber,
    language: value.language,
    finish: value.finish || value.variant,
    edition: value.edition,
    promoType: value.promoType || value.promo_type,
    productType: value.productType,
    grader: value.grader || value.gradingCompany,
    grade: value.grade,
  };
}

export function resolveIdentityCandidates(observedValue, candidateValues = []) {
  const observed = matchShape(observedValue);
  const candidates = candidateValues.map(matchShape);
  const varying = DISCRIMINATORS.filter(
    (field) =>
      new Set(
        candidates.map((candidate) =>
          normalizedMatchValue(field, candidate[field]),
        ),
      ).size > 1,
  );
  const missingDiscriminators = varying.filter(
    (field) => !normalizedMatchValue(field, observed[field]),
  );
  const ranked = candidates
    .map((candidate) => {
      let score = 0;
      let possible = 0;
      const mismatches = [];
      const matches = [];
      for (const [field, weight] of MATCH_FIELDS) {
        const wanted = normalizedMatchValue(field, observed[field]);
        if (!wanted || wanted === "unknown") continue;
        possible += weight;
        const actual = normalizedMatchValue(field, candidate[field]);
        if (wanted === actual) {
          score += weight;
          matches.push(field);
        } else mismatches.push(field);
      }
      const hardMismatch = mismatches.some((field) =>
        [
          "name",
          "set",
          "number",
          "language",
          "finish",
          "edition",
          "promoType",
          "productType",
        ].includes(field),
      );
      return {
        id: candidate.id || null,
        score,
        possible,
        confidence: possible ? score / possible : 0,
        matches,
        mismatches,
        disqualified: hardMismatch,
      };
    })
    .filter((candidate) => !candidate.disqualified)
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        right.score - left.score ||
        String(left.id).localeCompare(String(right.id)),
    );
  const top = ranked[0] || null;
  const runnerUp = ranked[1] || null;
  const tied = Boolean(
    top &&
    runnerUp &&
    top.confidence === runnerUp.confidence &&
    top.score === runnerUp.score,
  );
  const exact = Boolean(
    top &&
    top.id &&
    top.confidence === 1 &&
    !tied &&
    !missingDiscriminators.length,
  );
  const ambiguity = [];
  if (!ranked.length) ambiguity.push("no_compatible_identity");
  if (tied) ambiguity.push("tied_candidates");
  for (const field of missingDiscriminators)
    ambiguity.push(
      `missing_${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`,
    );
  return {
    ruleVersion: IDENTITY_RULE_VERSION,
    status: exact ? "exact" : ranked.length ? "review" : "unsupported",
    recommendedId: exact ? top.id : null,
    confidence: top?.confidence || 0,
    requiresConfirmation: true,
    ambiguity: [...new Set(ambiguity)],
    candidates: ranked,
  };
}
