import { normalizeTcgdexCard } from "./providers/tcgdex.js";

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
  const id = source.id === null ? "" : String(
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
  const parts = option.label.split(" · ");
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

function savedDetailedOption(card, key) {
  const metadata = card.variantMetadata;
  if (metadata?.identityEvidence !== "tcgdex_detailed_variant") return null;
  const sourceCardId = metadata.sourceCardId;
  const sourceVariantId = metadata.sourceVariantId;
  const language = card.language;
  const sourceKey = `tcgdex:${language}:${sourceCardId}:variant:${sourceVariantId}`;
  const type = {
    non_holo: "normal",
    holofoil: "holo",
    reverse_holofoil: "reverse",
    cosmos_holofoil: "holo",
  }[card.finish];
  const fields = [
    "size",
    "subtypePresent",
    "subtype",
    "stampPresent",
    "stamp",
    "foilPresent",
    "foil",
    "languagesPresent",
    "languages",
  ];
  let status = "needs_review";
  if (
    sourceCardId &&
    sourceVariantId &&
    key === sourceKey &&
    card.externalIds?.tcgdex === sourceCardId &&
    type &&
    canonicalFinish(card.variant) === card.finish &&
    (!Object.hasOwn(metadata, "type") || metadata.type === type) &&
    metadata.size === "standard"
  ) {
    const value = {
      variantId: sourceVariantId,
      type,
      size: metadata.size,
      ...(metadata.subtypePresent ? { subtype: metadata.subtype } : {}),
      ...(metadata.stampPresent ? { stamp: metadata.stamp } : {}),
      ...(metadata.foilPresent ? { foil: metadata.foil } : {}),
      ...(metadata.languagesPresent ? { languages: metadata.languages } : {}),
    };
    const source = normalizeTcgdexCard(
      {
        id: sourceCardId,
        localId: String(card.number || "").split("/")[0],
        name: card.name,
        set: { name: card.set },
        variants_detailed: [value],
      },
      language,
    ).variantOptions[0];
    if (
      source.status === "exact" &&
      card.identityStatus === "exact" &&
      ["finish", "edition", "promoType", "language"].every(
        (field) => card[field] === source[field],
      ) &&
      fields.every(
        (field) =>
          JSON.stringify(metadata[field]) ===
          JSON.stringify(source.metadata[field]),
      )
    )
      status = "exact";
  }
  return normalizeVariantOption({
    id: key,
    label: card.variant,
    finish: card.finish,
    edition: card.edition,
    promoType: card.promoType,
    language,
    status,
    metadata,
  });
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
  if (typeof selected === "object" && selected)
    return normalizeVariantOption(selected, { language: card.language });
  const key = String(
    selected || card.variantId || card.collectibleId || card.variant || "",
  );
  // No option array means no catalog result was loaded. An explicit array,
  // including [], is a completed result and can prove a selected source vanished.
  if (!Array.isArray(card.variantOptions) && key) {
    const saved = savedDetailedOption(card, key);
    if (saved) return saved;
    if (card.uid && [card.variantId, card.collectibleId, card.variant].filter(Boolean).includes(key)) {
      // A saved legacy copy is ownership evidence, not a new catalog match.
      // Preserve its printing facts; never infer edition from its display label.
      return {
        id: card.variantId || null,
        collectibleId: card.collectibleId || null,
        label: card.variant || "Unknown version",
        finish: card.finish || "unknown",
        edition: card.edition || "unknown",
        promoType: card.promoType || "unknown",
        language: canonicalLanguage(card.language) || "unknown",
        status: "needs_review",
        metadata: card.variantMetadata || {},
      };
    }
  }
  const exact = options.find(
    (option) =>
      option.id === key || option.collectibleId === key || option.label === key,
  );
  if (exact) return exact;
  if (
    key &&
    (/^tcgdex:[^:]+:[^:]+:variant:.+/.test(key) ||
      card.variantMetadata?.identityEvidence === "tcgdex_detailed_variant" ||
      options.some(
        (option) =>
          option.metadata.identityEvidence === "tcgdex_detailed_variant",
      ))
  )
    return normalizeVariantOption({
      id: key,
      label: "Unavailable printing",
      finish: "unknown",
      edition: "unknown",
      promoType: "unknown",
      language: card.language,
      status: "needs_review",
      metadata: { identityEvidence: "missing_detailed_variant" },
    });
  if (!options.length)
    return normalizeVariantOption("", { language: card.language });
  return (
    options.find((option) => option.finish === canonicalFinish(key)) ||
    options[0]
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
    release: card.release || card.releaseDate || card.releaseYear || null,
    artist: card.artist || null,
    image: card.image || card.thumb || null,
    thumb: card.thumb || card.image || null,
    productType: card.productType || null,
    sealedVariant: sealed ? card.sealedVariant || null : null,
    sealedRegion: sealed ? card.sealedRegion || null : null,
    cardState: card.cardState || (sealed ? "sealed" : null),
    cardId: card.cardId || card.internalId || null,
    variantId: sealed ? null : option.id || card.variantId || null,
    variantMetadata: sealed ? {} : option.metadata,
    externalIds: card.externalIds || {},
  };
}

export function sealedProductMatches(saved, candidate) {
  if (saved?.cardState !== "sealed" || candidate?.cardState !== "sealed") return false;
  const same = (a, b) => String(a || "").trim().toLowerCase().replace(/\s+/g, " ") === String(b || "").trim().toLowerCase().replace(/\s+/g, " ");
  const language = canonicalLanguage(saved.language);
  if (!language || language !== canonicalLanguage(candidate.language)) return false;
  if (!same(saved.id, candidate.id) || !same(saved.name, candidate.name) || !same(saved.set, candidate.set)) return false;
  if (saved.productType && !same(saved.productType, candidate.productType)) return false;
  if (saved.sealedVariant && !same(saved.sealedVariant, candidate.sealedVariant)) return false;
  if (saved.sealedRegion && !same(saved.sealedRegion, candidate.sealedRegion)) return false;
  return true;
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

// Searchable listing identity; never fill unknown printing facts with a guess.
export function cardListingTitle(item, printing, context = {}) {
  const label = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const finish = canonicalFinish(printing.finish);
  const edition = printing.edition;
  const year = /^(\d{4})(?:$|-)/.exec(String(item.release || item.releaseYear || ''))?.[1];
  const language = canonicalLanguage(item.language);
  return [year, item.name || 'Printed name unknown', item.set, item.number ? '#' + item.number : 'Number unconfirmed',
    finish === 'unknown' ? 'Finish unconfirmed' : finish === 'non_holo' ? 'Non-Holo' : label(finish),
    !edition || edition === 'unknown' ? 'Edition unconfirmed' : edition === 'first_edition' ? '1st Edition' : label(edition),
    printing.promoType && !['none','unknown'].includes(printing.promoType) ? label(printing.promoType) : '',
    ({en:'English',ja:'Japanese',de:'German',fr:'French',es:'Spanish',it:'Italian',pt:'Portuguese'})[language] || item.language || 'Language unconfirmed',
    context.cardState === 'graded' || item.gradingCompany ? [context.gradingCompany || item.gradingCompany, context.grade || item.grade, context.gradeQualifier || item.gradeQualifier].filter(Boolean).join(' ') : ''
  ].filter(Boolean).join(' · ');
}
