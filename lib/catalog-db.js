import { parseCatalogQuery, rankTcgdexCard } from "./providers/tcgdex.js";

const SELECT = `
  id,
  name,
  collector_number,
  rarity,
  artist,
  language,
  card_sets!inner(
    id,
    name,
    canonical_key,
    series,
    release_date,
    language,
    official_count,
    total_count,
    set_external_ids(provider,external_id)
  ),
  card_variants(id,finish,edition,language),
  card_images(provider,size,url),
  card_external_ids(provider,external_id)
`;

function collectorKeys(value) {
  const compact = String(value || "").replace(/[^a-z0-9]/gi, "");
  const match = /^([a-z]*)(\d+)([a-z]*)$/i.exec(compact);
  if (!match) return compact ? [compact.toUpperCase()] : [];
  const prefix = match[1].toUpperCase();
  const number = String(Number(match[2]));
  const suffix = match[3].toUpperCase();
  return [
    ...new Set(
      [
        number,
        number.padStart(2, "0"),
        number.padStart(3, "0"),
        number.padStart(4, "0"),
      ].map((digits) => `${prefix}${digits}${suffix}`),
    ),
  ];
}

function nameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function firstExternal(rows, provider) {
  return (
    (Array.isArray(rows) ? rows : []).find(
      (row) => row?.provider === provider && row?.external_id,
    )?.external_id || null
  );
}

function internalCard(row, language) {
  const set = row.card_sets || {};
  const storedTcgdexId = firstExternal(row.card_external_ids, "tcgdex");
  const storedSetTcgdexId = firstExternal(set.set_external_ids, "tcgdex");
  const tcgdexId = storedTcgdexId?.startsWith(`${language}:`)
    ? storedTcgdexId.slice(language.length + 1)
    : storedTcgdexId;
  const setTcgdexId = storedSetTcgdexId?.startsWith(`${language}:`)
    ? storedSetTcgdexId.slice(language.length + 1)
    : storedSetTcgdexId;
  const images = Array.isArray(row.card_images) ? row.card_images : [];
  const preferredImage =
    images.find(
      (entry) => entry.provider === "tcgplayer" && entry.size === "large",
    ) ||
    images.find((entry) => entry.size === "large") ||
    images.find((entry) => entry.size === "small") ||
    null;
  const image = preferredImage?.url || null;
  const thumb =
    images.find((entry) => entry.size === "small")?.url || image || null;
  const finishes = [
    ...new Set(
      (Array.isArray(row.card_variants) ? row.card_variants : [])
        .filter(
          (entry) =>
            !entry?.language ||
            String(entry.language).toLowerCase() === language,
        )
        .map((entry) =>
          [entry?.edition, entry?.finish].filter(Boolean).join(" "),
        )
        .filter(Boolean),
    ),
  ];
  const official = Number(set.official_count) || null;
  const localId = String(row.collector_number || "");
  return {
    id: tcgdexId ? `tcgdex:${language}:${tcgdexId}` : `catalog:${row.id}`,
    internalId: row.id,
    externalIds: tcgdexId ? { tcgdex: tcgdexId } : {},
    name: row.name || "",
    set: set.name || "",
    setId: setTcgdexId || "",
    number: official ? `${localId}/${official}` : localId,
    localId,
    rarity: row.rarity || null,
    artist: row.artist || null,
    language: row.language || language,
    release: set.release_date || null,
    variants: finishes,
    image,
    imageProvider: preferredImage?.provider || null,
    referenceImages: images
      .filter((entry) => entry?.url)
      .map((entry) => ({
        provider: entry.provider || "catalog",
        size: entry.size || "unknown",
        url: entry.url,
      })),
    thumb,
    _rankShape: {
      id: tcgdexId || row.id,
      name: row.name || "",
      localId,
      rarity: row.rarity || null,
      variants: Object.fromEntries(finishes.map((finish) => [finish, true])),
      image,
      set: {
        id: setTcgdexId || set.id,
        name: set.name || "",
        cardCount: {
          official,
          total: Number(set.total_count) || null,
        },
      },
    },
  };
}

async function runQuery(build) {
  const result = await build().limit(60);
  if (result.error) throw result.error;
  return Array.isArray(result.data) ? result.data : [];
}

export function summarizeCatalogResolution(cards, parsed) {
  if (!cards.length)
    return {
      status: "no_match",
      recommendedId: null,
      confidence: 0,
      ambiguity: ["no_internal_match"],
      requiresConfirmation: true,
    };
  const exact = cards.filter(
    (card) => card.match?.confidence === "Exact match",
  );
  const top = cards[0];
  const runnerUp = cards[1];
  const margin =
    Number(top.match?.score || 0) - Number(runnerUp?.match?.score || 0);
  const hasNameAndNumber = Boolean(parsed.name && parsed.localId);
  const uniqueExact = exact.length === 1 && top.id === exact[0].id;
  const decisiveStrong =
    hasNameAndNumber &&
    top.match?.confidence === "Strong match" &&
    Number(top.match?.score || 0) >= 250 &&
    margin >= 45;
  const recommended = uniqueExact || decisiveStrong;
  const ambiguity = [];
  if (exact.length > 1) ambiguity.push("multiple_exact_printings");
  if (!parsed.name && parsed.localId)
    ambiguity.push("collector_number_not_unique");
  if (!hasNameAndNumber) ambiguity.push("insufficient_printed_identity");
  if (!recommended && runnerUp && margin < 45)
    ambiguity.push("close_candidates");
  return {
    status: recommended ? "exact" : "review",
    recommendedId: recommended ? top.id : null,
    confidence: uniqueExact ? 0.98 : decisiveStrong ? 0.88 : 0.55,
    ambiguity: [...new Set(ambiguity)],
    requiresConfirmation: true,
  };
}

export async function searchInternalCatalog(
  database,
  query,
  language = "en",
  limit = 12,
) {
  const parsed = parseCatalogQuery(query);
  const queries = [];
  const numberKeys = collectorKeys(parsed.localId);
  const name = nameKey(parsed.name);
  const base = () =>
    database.from("cards").select(SELECT).eq("language", language);

  if (numberKeys.length && name)
    queries.push(() =>
      base().in("collector_key", numberKeys).eq("name_key", name),
    );
  if (numberKeys.length)
    queries.push(() => base().in("collector_key", numberKeys));
  if (name) {
    queries.push(() => base().eq("name_key", name));
    const safePrefix = name.replace(/[%_,()]/g, " ").trim();
    if (safePrefix) queries.push(() => base().ilike("name", `${safePrefix}%`));
  }
  if (!queries.length)
    return {
      cards: [],
      parsedQuery: parsed,
      resolution: summarizeCatalogResolution([], parsed),
      source: "internal",
    };

  const pages = await Promise.all(queries.slice(0, 4).map(runQuery));
  const unique = new Map();
  for (const row of pages.flat())
    if (row?.id && !unique.has(row.id)) unique.set(row.id, row);
  const ranked = [...unique.values()]
    .map((row) => internalCard(row, language))
    .map((card) => {
      const match = rankTcgdexCard(card._rankShape, parsed, language);
      const { _rankShape, ...normalized } = card;
      return { ...normalized, match };
    })
    .filter((card) => !name || nameKey(card.name) === name)
    .filter(
      (card) =>
        !parsed.total ||
        String(card.number || "").split("/")[1] === String(parsed.total),
    )
    .filter(
      (card) =>
        !parsed.setName || nameKey(card.set) === nameKey(parsed.setName),
    )
    .sort(
      (left, right) =>
        right.match.score - left.match.score ||
        Number(Boolean(right.image)) - Number(Boolean(left.image)) ||
        left.name.localeCompare(right.name),
    );
  const cards = ranked.slice(0, Math.min(24, Math.max(1, Number(limit) || 12)));
  return {
    cards,
    parsedQuery: parsed,
    resolution: summarizeCatalogResolution(cards, parsed),
    source: "internal",
  };
}
