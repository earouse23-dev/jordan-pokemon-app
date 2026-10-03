export const COLLECTION_ORGANIZATION_VERSION = "mica-organization-v1";

export const ORGANIZATION_DIMENSIONS = Object.freeze([
  "set",
  "subset",
  "artist",
  "character",
  "rarity",
  "language",
  "finish",
  "condition",
]);

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const boundedText = (value, maximum) =>
  String(value ?? "")
    .trim()
    .slice(0, maximum);

export function normalizeOrganizationLabels(values = []) {
  const source = Array.isArray(values) ? values : String(values).split(",");
  return [
    ...new Map(
      source
        .map((value) => boundedText(value, 40))
        .filter(Boolean)
        .map((value) => [normalize(value), value]),
    ).values(),
  ].slice(0, 50);
}

export function normalizeCustomFields(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  return Object.fromEntries(
    Object.entries(values)
      .filter(
        ([, value]) =>
          typeof value === "string" ||
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isFinite(value)),
      )
      .map(([key, value]) => [
        boundedText(key, 40)
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "_")
          .replace(/^_+|_+$/g, ""),
        typeof value === "string" ? boundedText(value, 500) : value,
      ])
      .filter(([key, value]) => key && value !== "")
      .slice(0, 20),
  );
}

export function normalizeSavedView(input = {}) {
  const allowedSorts = new Set([
    "value-desc",
    "name",
    "updated-desc",
    "location",
  ]);
  const filters =
    input.filters && typeof input.filters === "object" ? input.filters : input;
  const allowedGroups = new Set([
    "none",
    "folder",
    "set",
    "location",
    "language",
    "condition",
  ]);
  return {
    version: COLLECTION_ORGANIZATION_VERSION,
    ledgerView: boundedText(filters.ledgerView || "all", 30),
    query: boundedText(filters.query, 200),
    sort: allowedSorts.has(filters.sort) ? filters.sort : "value-desc",
    groupBy: allowedGroups.has(filters.groupBy) ? filters.groupBy : "none",
    collectionId: boundedText(filters.collectionId, 80),
    set: boundedText(filters.set || filters.setFilter, 200),
    condition: boundedText(filters.condition || filters.conditionFilter, 80),
    label: boundedText(filters.label || filters.labelFilter, 40),
    location: boundedText(filters.location || filters.locationFilter, 250),
    language: boundedText(filters.language || filters.languageFilter, 20),
    grader: boundedText(filters.grader || filters.graderFilter, 40),
    grade: boundedText(filters.grade || filters.gradeFilter, 20),
    rarity: boundedText(filters.rarity || filters.rarityFilter, 120),
    artist: boundedText(filters.artist || filters.artistFilter, 160),
    character: boundedText(filters.character || filters.characterFilter, 160),
    minimumValue: boundedText(filters.minimumValue, 30),
    maximumValue: boundedText(filters.maximumValue, 30),
  };
}

export function groupCollectionOrganization(items = [], groupBy = "none") {
  if (groupBy === "none") return [{ key: "all", label: "", items: [...items] }];
  const valueFor = (item) => {
    if (groupBy === "folder") return item.folderName || "No digital folder";
    if (groupBy === "location") return item.location || "Location not recorded";
    if (groupBy === "condition")
      return item.gradingCompany
        ? `${item.gradingCompany} ${item.grade}`.trim()
        : item.rawCondition || item.condition || "Condition not recorded";
    return (
      item[groupBy] ||
      `${groupBy[0].toUpperCase()}${groupBy.slice(1)} not recorded`
    );
  };
  const groups = new Map();
  for (const item of items) {
    const label = String(valueFor(item));
    const key = normalize(label);
    const group = groups.get(key) || { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function organizationVariantAliases(item = {}) {
  const external = item.externalIds || item.external_ids || {};
  const aliases = [
    item.collectibleId || item.collectible_id,
    item.variantId || item.variant_id,
    external.tcgdex,
    external.pkmnprices,
    external.tcgplayer,
    external.justtcg,
  ]
    .map((value) => boundedText(value, 200))
    .filter(Boolean);
  if (!aliases.length) {
    const identity = [
      item.language || "unknown",
      item.setId || item.set_id || item.set || "",
      item.number || item.collectorNumber || "",
      item.variant || item.finish || "",
    ].map(normalize);
    if (identity.every(Boolean)) aliases.push(`identity:${identity.join(":")}`);
  }
  return [...new Set(aliases)];
}

function itemDimension(item, dimension) {
  if (dimension === "condition")
    return item.gradingCompany
      ? `${item.gradingCompany} ${item.grade}`
      : item.rawCondition || item.condition;
  if (dimension === "finish") return item.finish || item.variant;
  if (dimension === "character")
    return item.character || item.pokemon || item.name;
  if (dimension === "subset") return item.subset || item.set;
  return item[dimension];
}

function matchesCriteria(item, criteria = {}) {
  return ORGANIZATION_DIMENSIONS.every((dimension) => {
    const expected = criteria[dimension];
    if (expected === undefined || expected === null || expected === "")
      return true;
    const actual = itemDimension(item, dimension);
    if (!actual) return false;
    return normalize(actual) === normalize(expected);
  });
}

export function calculateCollectionGoal(goal = {}, items = []) {
  const metadataStatus = ["verified", "incomplete", "unsupported"].includes(
    goal.metadataStatus,
  )
    ? goal.metadataStatus
    : "incomplete";
  if (metadataStatus !== "verified") {
    return {
      status: metadataStatus,
      current: null,
      target: null,
      percent: null,
      complete: false,
      missing: [],
      excludedItems: items.length,
    };
  }
  const active = items.filter(
    (item) =>
      Number(item.quantity) > 0 &&
      !["sold", "deleted"].includes(String(item.status || "owned")),
  );
  if (goal.goalType === "checklist") {
    const targets = Array.isArray(goal.targets) ? goal.targets : [];
    if (!targets.length)
      return {
        status: "incomplete",
        current: null,
        target: null,
        percent: null,
        complete: false,
        missing: [],
        excludedItems: active.length,
      };
    const ownedAliases = new Set(
      active
        .filter((item) => matchesCriteria(item, goal.criteria))
        .flatMap(organizationVariantAliases),
    );
    const missing = targets.filter((target) => {
      const aliases = [target.key, ...(target.aliases || [])].filter(Boolean);
      return !aliases.some((alias) => ownedAliases.has(String(alias)));
    });
    const current = targets.length - missing.length;
    return {
      status: "ready",
      current,
      target: targets.length,
      percent: (current / targets.length) * 100,
      complete: missing.length === 0,
      missing,
      excludedItems: 0,
    };
  }
  const dimension = ORGANIZATION_DIMENSIONS.includes(goal.dimension)
    ? goal.dimension
    : "set";
  const relevant = active.filter((item) =>
    matchesCriteria(item, goal.criteria),
  );
  const unavailable = relevant.filter(
    (item) => !itemDimension(item, dimension),
  );
  const count = relevant
    .filter((item) => itemDimension(item, dimension))
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const target = Math.max(1, Math.floor(Number(goal.targetCount) || 1));
  return {
    status: unavailable.length ? "partial" : "ready",
    current: count,
    target,
    percent: Math.min(100, (count / target) * 100),
    complete: count >= target,
    missing: [],
    excludedItems: unavailable.length,
  };
}

export function filterCollectionOrganization(items = [], view = {}) {
  const config = normalizeSavedView(view);
  const queryParts = normalize(config.query).split(/\s+/).filter(Boolean);
  const minimum =
    config.minimumValue === "" ? null : Number(config.minimumValue);
  const maximum =
    config.maximumValue === "" ? null : Number(config.maximumValue);
  return items.filter((item) => {
    if (
      config.collectionId &&
      String(item.collectionId || "") !== config.collectionId
    )
      return false;
    if (config.set && normalize(item.set) !== normalize(config.set))
      return false;
    if (
      config.condition &&
      normalize(itemDimension(item, "condition")) !==
        normalize(config.condition)
    )
      return false;
    if (
      config.label &&
      !normalizeOrganizationLabels(item.tags).some(
        (tag) => normalize(tag) === normalize(config.label),
      )
    )
      return false;
    if (
      config.location &&
      !normalize(item.location).includes(normalize(config.location))
    )
      return false;
    if (
      config.language &&
      normalize(item.language) !== normalize(config.language)
    )
      return false;
    if (
      config.grader &&
      normalize(item.gradingCompany) !== normalize(config.grader)
    )
      return false;
    if (config.grade && normalize(item.grade) !== normalize(config.grade))
      return false;
    if (config.rarity && normalize(item.rarity) !== normalize(config.rarity))
      return false;
    if (config.artist && normalize(item.artist) !== normalize(config.artist))
      return false;
    if (
      config.character &&
      normalize(itemDimension(item, "character")) !==
        normalize(config.character)
    )
      return false;
    const value =
      item.price == null
        ? null
        : Number(item.price) * Number(item.quantity || 0);
    if (minimum !== null && (!Number.isFinite(value) || value < minimum))
      return false;
    if (maximum !== null && (!Number.isFinite(value) || value > maximum))
      return false;
    if (!queryParts.length) return true;
    const haystack = normalize(
      [
        item.name,
        item.set,
        item.number,
        item.artist,
        item.rarity,
        item.location,
        ...(item.tags || []),
      ].join(" "),
    );
    return queryParts.every((part) => haystack.includes(part));
  });
}

export function sortCollectionOrganization(items = [], sort = "name") {
  const copy = [...items];
  if (sort === "updated-desc")
    return copy.sort(
      (left, right) =>
        String(right.updatedAt || right.updated_at || "").localeCompare(
          String(left.updatedAt || left.updated_at || ""),
        ) ||
        String(left.uid || left.id).localeCompare(
          String(right.uid || right.id),
        ),
    );
  if (sort === "location")
    return copy.sort(
      (left, right) =>
        String(left.location || "").localeCompare(
          String(right.location || ""),
        ) || String(left.name || "").localeCompare(String(right.name || "")),
    );
  if (sort === "value-desc")
    return copy.sort(
      (left, right) =>
        Number(right.price ?? -1) * Number(right.quantity || 0) -
          Number(left.price ?? -1) * Number(left.quantity || 0) ||
        String(left.name || "").localeCompare(String(right.name || "")),
    );
  return copy.sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || "")),
  );
}

export function previewBulkOrganization(items = [], input = {}) {
  const selected = new Set((input.ids || []).map(String));
  if (!selected.size || selected.size > 500)
    throw new Error("Choose between 1 and 500 positions.");
  const labels = normalizeOrganizationLabels(input.label);
  const label = labels[0] || "";
  const changed = items
    .filter((item) => selected.has(String(item.uid || item.id)))
    .map((item) => {
      const before = {
        collectionId: item.collectionId || null,
        tags: normalizeOrganizationLabels(item.tags),
        location: item.location || "",
        status: item.status || "owned",
        customFields: normalizeCustomFields(item.customFields),
      };
      const after = structuredClone(before);
      if (input.collectionMode === "set")
        after.collectionId = input.collectionId || null;
      if (input.labelMode === "add" && label)
        after.tags = normalizeOrganizationLabels([...after.tags, label]);
      if (input.labelMode === "remove" && label)
        after.tags = after.tags.filter(
          (value) => normalize(value) !== normalize(label),
        );
      if (input.locationMode === "set")
        after.location = boundedText(input.location, 250);
      if (input.locationMode === "clear") after.location = "";
      if (["owned", "archived"].includes(input.status))
        after.status = input.status;
      if (input.customFieldMode === "set" && input.customFieldKey)
        after.customFields = normalizeCustomFields({
          ...after.customFields,
          [input.customFieldKey]: input.customFieldValue,
        });
      if (input.customFieldMode === "clear" && input.customFieldKey) {
        delete after.customFields[input.customFieldKey];
      }
      return { id: String(item.uid || item.id), before, after };
    });
  if (changed.length !== selected.size)
    throw new Error("Some selected positions are unavailable.");
  const hasChanges = changed.some(
    ({ before, after }) => JSON.stringify(before) !== JSON.stringify(after),
  );
  if (!hasChanges) throw new Error("Choose at least one change.");
  return {
    version: COLLECTION_ORGANIZATION_VERSION,
    count: changed.length,
    changed,
  };
}
