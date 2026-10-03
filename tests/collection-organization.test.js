import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCollectionGoal,
  filterCollectionOrganization,
  groupCollectionOrganization,
  normalizeCustomFields,
  normalizeOrganizationLabels,
  normalizeSavedView,
  organizationVariantAliases,
  previewBulkOrganization,
  sortCollectionOrganization,
} from "../lib/collection-organization.js";

const items = [
  {
    uid: "one",
    collectibleId: "collectible-one",
    variantId: "variant-one",
    externalIds: { tcgdex: "sv-001" },
    name: "Pikachu",
    set: "Test Set",
    number: "001",
    language: "en",
    variant: "Holo",
    rarity: "Rare",
    artist: "Test Artist",
    condition: "Near Mint",
    rawCondition: "near_mint",
    quantity: 2,
    price: 10,
    tags: ["Binder", "binder", "Favorites"],
    location: "Shelf A · Binder 1",
    collectionId: "folder-a",
    status: "owned",
    customFields: { owner_code: "P-1" },
    updatedAt: "2026-09-03T02:00:00Z",
  },
  {
    uid: "two",
    externalIds: { tcgdex: "sv-002" },
    name: "Charizard",
    set: "Test Set",
    number: "002",
    language: "ja",
    variant: "Reverse",
    rarity: "Ultra Rare",
    artist: "Other Artist",
    condition: "Lightly Played",
    rawCondition: "lightly_played",
    quantity: 1,
    price: null,
    tags: ["Trade"],
    location: "Case B",
    collectionId: "folder-b",
    status: "owned",
    updatedAt: "2026-09-01T02:00:00Z",
  },
];

test("organization labels are bounded, case-insensitively unique, and stable", () => {
  assert.deepEqual(
    normalizeOrganizationLabels([" Binder ", "binder", "Trade"]),
    ["binder", "Trade"],
  );
  assert.equal(normalizeOrganizationLabels(Array(60).fill("x")).length, 1);
});

test("custom fields keep only safe scalar values", () => {
  assert.deepEqual(
    normalizeCustomFields({
      "Owner Code": " P-1 ",
      insured: true,
      count: 2,
      bad: {},
    }),
    { owner_code: "P-1", insured: true, count: 2 },
  );
});

test("saved views only retain the versioned organization filter contract", () => {
  assert.deepEqual(
    normalizeSavedView({ query: " pika ", sort: "broken", setFilter: "151" }),
    {
      version: "mica-organization-v1",
      ledgerView: "all",
      query: "pika",
      sort: "value-desc",
      groupBy: "none",
      collectionId: "",
      set: "151",
      condition: "",
      label: "",
      location: "",
      language: "",
      grader: "",
      grade: "",
      rarity: "",
      artist: "",
      character: "",
      minimumValue: "",
      maximumValue: "",
    },
  );
});

test("grouping keeps each position once and labels missing organization", () => {
  const grouped = groupCollectionOrganization(
    [
      { ...items[0], folderName: "Main binder" },
      { ...items[1], folderName: "" },
    ],
    "folder",
  );
  assert.deepEqual(
    grouped.map((group) => group.label),
    ["Main binder", "No digital folder"],
  );
  assert.equal(grouped.flatMap((group) => group.items).length, 2);
});

test("organization search covers identity, label, and physical location", () => {
  assert.deepEqual(
    filterCollectionOrganization(items, { query: "pika binder" }).map(
      (item) => item.uid,
    ),
    ["one"],
  );
  assert.deepEqual(
    filterCollectionOrganization(items, { location: "shelf a" }).map(
      (item) => item.uid,
    ),
    ["one"],
  );
  assert.deepEqual(
    filterCollectionOrganization(items, { language: "ja" }).map(
      (item) => item.uid,
    ),
    ["two"],
  );
});

test("organization search never treats missing price as zero", () => {
  assert.deepEqual(
    filterCollectionOrganization(items, { maximumValue: "5" }),
    [],
  );
  assert.deepEqual(
    filterCollectionOrganization(items, { minimumValue: "15" }).map(
      (item) => item.uid,
    ),
    ["one"],
  );
});

test("organization sorting is deterministic", () => {
  assert.deepEqual(
    sortCollectionOrganization(items, "name").map((item) => item.uid),
    ["two", "one"],
  );
  assert.deepEqual(
    sortCollectionOrganization(items, "location").map((item) => item.uid),
    ["two", "one"],
  );
  assert.deepEqual(
    sortCollectionOrganization(items, "updated-desc").map((item) => item.uid),
    ["one", "two"],
  );
});

test("exact checklist goals match aliases and return missing exact variants", () => {
  const progress = calculateCollectionGoal(
    {
      goalType: "checklist",
      metadataStatus: "verified",
      criteria: { set: "Test Set" },
      targets: [
        { key: "sv-001", label: "Pikachu 001" },
        { key: "sv-002", label: "Charizard 002" },
        { key: "sv-003", label: "Mew 003" },
      ],
    },
    items,
  );
  assert.equal(progress.current, 2);
  assert.equal(progress.target, 3);
  assert.equal(progress.complete, false);
  assert.deepEqual(
    progress.missing.map((item) => item.key),
    ["sv-003"],
  );
});

test("unsupported goal metadata never produces false completion", () => {
  assert.deepEqual(
    calculateCollectionGoal(
      { goalType: "checklist", metadataStatus: "unsupported", targets: [] },
      items,
    ),
    {
      status: "unsupported",
      current: null,
      target: null,
      percent: null,
      complete: false,
      missing: [],
      excludedItems: 2,
    },
  );
});

test("count goals derive from live owned quantities", () => {
  const progress = calculateCollectionGoal(
    {
      goalType: "quantity",
      dimension: "language",
      criteria: { language: "en" },
      targetCount: 2,
      metadataStatus: "verified",
    },
    items,
  );
  assert.equal(progress.current, 2);
  assert.equal(progress.complete, true);
});

test("variant aliases prefer canonical and provider identities", () => {
  assert.deepEqual(organizationVariantAliases(items[0]), [
    "collectible-one",
    "variant-one",
    "sv-001",
  ]);
});

test("bulk organization previews exact before and after state", () => {
  const preview = previewBulkOrganization(items, {
    ids: ["one", "two"],
    labelMode: "add",
    label: "Show box",
    locationMode: "set",
    location: "Table 3",
    status: "archived",
  });
  assert.equal(preview.count, 2);
  assert.equal(preview.changed[0].before.location, "Shelf A · Binder 1");
  assert.equal(preview.changed[0].after.location, "Table 3");
  assert.deepEqual(preview.changed[1].after.tags, ["Trade", "Show box"]);
  assert.equal(preview.changed[1].after.status, "archived");
});

test("bulk organization rejects missing rows and no-op changes", () => {
  assert.throws(
    () =>
      previewBulkOrganization(items, {
        ids: ["missing"],
        locationMode: "clear",
      }),
    /unavailable/,
  );
  assert.throws(
    () => previewBulkOrganization(items, { ids: ["one"] }),
    /at least one change/,
  );
});
