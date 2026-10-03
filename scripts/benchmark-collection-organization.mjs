import { performance } from "node:perf_hooks";
import {
  calculateCollectionGoal,
  filterCollectionOrganization,
  groupCollectionOrganization,
  sortCollectionOrganization,
} from "../lib/collection-organization.js";

const sizes = [100, 1_000, 10_000, 100_000];
const budgets = new Map([
  [100, 25],
  [1_000, 60],
  [10_000, 300],
  [100_000, 2_500],
]);

const createItems = (size) =>
  Array.from({ length: size }, (_, index) => ({
    uid: `position-${String(index).padStart(6, "0")}`,
    externalIds: { tcgdex: `benchmark-${index % 400}` },
    name: index % 997 === 0 ? `Mica Target ${index}` : `Card ${index % 400}`,
    set: `Set ${index % 25}`,
    number: String(index % 400),
    language: ["en", "ja", "de", "fr"][index % 4],
    variant: index % 2 ? "Holofoil" : "Normal",
    rarity: ["Common", "Rare", "Ultra Rare"][index % 3],
    artist: `Artist ${index % 80}`,
    rawCondition: ["near_mint", "lightly_played"][index % 2],
    quantity: (index % 3) + 1,
    price: index % 9 ? (index % 500) / 10 + 0.5 : null,
    tags: [`Label ${index % 12}`],
    location: `Room ${index % 3} · Shelf ${index % 20} · Binder ${index % 100}`,
    collectionId: `folder-${index % 8}`,
    status: "owned",
    updatedAt: new Date(1_780_000_000_000 - index * 1000).toISOString(),
  }));

const measure = (work, repeats = 5) => {
  const durations = [];
  for (let index = 0; index < repeats; index += 1) {
    const start = performance.now();
    work();
    durations.push(performance.now() - start);
  }
  return durations.sort((left, right) => left - right)[
    Math.floor(durations.length / 2)
  ];
};

const results = [];
for (const size of sizes) {
  const items = createItems(size);
  const openMs = measure(() =>
    sortCollectionOrganization(items, "updated-desc").slice(0, 100),
  );
  const searchMs = measure(() =>
    sortCollectionOrganization(
      filterCollectionOrganization(items, {
        query: "mica target",
        sort: "name",
      }),
      "name",
    ).slice(0, 100),
  );
  const filterMs = measure(() =>
    sortCollectionOrganization(
      filterCollectionOrganization(items, {
        collectionId: "folder-3",
        language: "fr",
        label: "Label 3",
        location: "Room 0",
        sort: "location",
      }),
      "location",
    ).slice(0, 100),
  );
  const goalMs = measure(() =>
    calculateCollectionGoal(
      {
        goalType: "checklist",
        metadataStatus: "verified",
        targets: Array.from({ length: 400 }, (_, index) => ({
          key: `benchmark-${index}`,
        })),
      },
      items,
    ),
  );
  const groupMs = measure(() => groupCollectionOrganization(items, "location"));
  const worstMs = Math.max(openMs, searchMs, filterMs, goalMs, groupMs);
  const budgetMs = budgets.get(size);
  results.push({
    size,
    openMs,
    searchMs,
    filterMs,
    goalMs,
    groupMs,
    worstMs,
    budgetMs,
  });
}

for (const result of results)
  console.info(
    [
      `${result.size.toLocaleString()} items`,
      `open ${result.openMs.toFixed(1)}ms`,
      `search ${result.searchMs.toFixed(1)}ms`,
      `filter ${result.filterMs.toFixed(1)}ms`,
      `group ${result.groupMs.toFixed(1)}ms`,
      `goal ${result.goalMs.toFixed(1)}ms`,
      `budget ${result.budgetMs}ms`,
    ].join(" · "),
  );

const failures = results.filter((result) => result.worstMs > result.budgetMs);
if (failures.length)
  throw new Error(
    `Collection organization performance budget exceeded: ${failures
      .map(
        (result) =>
          `${result.size.toLocaleString()}=${result.worstMs.toFixed(1)}ms>${result.budgetMs}ms`,
      )
      .join(", ")}`,
  );

console.info(
  "Collection organization benchmark passed for 100, 1,000, 10,000, and 100,000 owned positions.",
);
