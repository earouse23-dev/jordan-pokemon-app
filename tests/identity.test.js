import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  IDENTITY_RULE_VERSION,
  canonicalCollectorNumber,
  canonicalEdition,
  canonicalFinish,
  canonicalLanguage,
  canonicalPromoType,
  collectibleIdentitySnapshot,
  normalizeVariantOption,
  resolveIdentityCandidates,
  sealedProductMatches,
  selectVariantOption,
  variantDifferenceFields,
  variantOptionSummary,
} from "../lib/identity.js";

test("sealed provider refresh cannot substitute language, type or package variant", () => {
  const saved = { id: "sealed:42", cardState: "sealed", name: "Crown Zenith Elite Trainer Box", set: "Crown Zenith", language: "ja", productType: "elite_trainer_box", sealedVariant: "Pokemon Center", sealedRegion: "JP" };
  assert.equal(sealedProductMatches(saved, { ...saved, language: "Japanese" }), true);
  for (const change of [{ language: "en" }, { productType: "booster_box" }, { sealedVariant: "Standard" }, { sealedRegion: null }, { name: "Another Box" }])
    assert.equal(sealedProductMatches(saved, { ...saved, ...change }), false);
});

const benchmark = JSON.parse(
  await readFile(
    new URL("./fixtures/identity-benchmark-v1.json", import.meta.url),
    "utf8",
  ),
);

test("copy snapshots preserve saved legacy printing without inferring edition or verification", () => {
  const saved = {
    uid: "owned-copy", collectibleId: "saved-unresolved-identity", variantId: null,
    name: "Pikachu", set: "Synthetic beta", number: "01", language: "en",
    variant: "holo", finish: "holo", edition: "unlimited", promoType: "unknown",
    cardState: "graded", identityStatus: "needs_review", variantMetadata: {},
  };
  const option = selectVariantOption(saved, saved.variant);
  assert.equal(option.id, null);
  assert.equal(normalizeVariantOption(option).id, null, "an unresolved collectible is not a variant ID");
  const copy = collectibleIdentitySnapshot(saved, option.label);
  for (const field of ["collectibleId", "variantId", "variant", "finish", "edition", "promoType", "language"])
    assert.equal(copy[field], saved[field], field);
  assert.equal(copy.identityStatus, "needs_review");
  assert.equal(selectVariantOption({ ...saved, finish: null, edition: null }, saved.variant).finish, "unknown");
  assert.equal(selectVariantOption({ ...saved, finish: null, edition: null }, saved.variant).edition, "unknown");
  const removed = selectVariantOption({ ...saved, variantOptions: [] }, saved.variant);
  assert.notEqual(removed.status, "exact");
  assert.equal(removed.finish, "unknown");
});

test("canonical identity normalizes supported language and variant aliases", () => {
  assert.equal(canonicalLanguage("Japanese"), "ja");
  assert.equal(canonicalLanguage("zh-TW"), "zh-tw");
  assert.equal(canonicalLanguage("not a language"), null);
  assert.equal(canonicalCollectorNumber("025 / 165"), "25/165");
  assert.equal(canonicalCollectorNumber("SM01"), "sm01");
  assert.equal(canonicalFinish("Reverse Holo"), "reverse_holofoil");
  assert.equal(canonicalFinish("1st Edition Holofoil"), "holofoil");
  assert.equal(canonicalEdition("1st Edition Holofoil"), "first_edition");
  assert.equal(canonicalPromoType("Black Star Promo"), "black_star");
});

test("variant options keep stable IDs and expose the fields that differ", () => {
  const options = [
    normalizeVariantOption({
      id: "normal-id",
      finish: "normal",
      edition: "",
      language: "en",
    }),
    normalizeVariantOption({
      id: "reverse-id",
      finish: "reverse holofoil",
      edition: "",
      language: "en",
    }),
  ];
  assert.equal(options[0].id, "normal-id");
  assert.equal(options[1].finish, "reverse_holofoil");
  assert.deepEqual(variantDifferenceFields(options), ["finish"]);
  assert.equal(
    selectVariantOption({ variantOptions: options }, "reverse-id").id,
    "reverse-id",
  );
});

test("snapshots separate stable identity fields from condition and grade state", () => {
  const snapshot = collectibleIdentitySnapshot(
    {
      id: "provider-card",
      cardId: "card-id",
      name: "Pikachu",
      set: "151",
      number: "025/165",
      language: "en",
      variantOptions: [
        {
          id: "variant-id",
          collectibleId: "variant-id",
          finish: "reverse_holofoil",
          edition: "unlimited",
          language: "en",
        },
      ],
    },
    "variant-id",
  );
  assert.equal(snapshot.collectibleId, "variant-id");
  assert.equal(snapshot.variantId, "variant-id");
  assert.equal(snapshot.finish, "reverse_holofoil");
  assert.equal(snapshot.identityRuleVersion, IDENTITY_RULE_VERSION);
  assert.equal("grade" in snapshot, false);
  assert.equal("condition" in snapshot, false);
});

for (const fixture of benchmark) {
  test(`identity benchmark: ${fixture.caseId}`, () => {
    const result = resolveIdentityCandidates(
      fixture.observed,
      fixture.candidates,
    );
    assert.equal(result.recommendedId, fixture.expectedId);
    assert.equal(result.requiresConfirmation, true);
    if (fixture.expectedId) assert.equal(result.status, "exact");
    else {
      assert.equal(result.status, "review");
      assert.ok(result.ambiguity.length > 0);
    }
  });
}

test("a close variant can never win when an observed discriminator conflicts", () => {
  const result = resolveIdentityCandidates(
    {
      name: "Pikachu",
      set: "151",
      number: "025/165",
      language: "ja",
      finish: "reverse holo",
      edition: "unlimited",
      promoType: "none",
    },
    [
      {
        id: "wrong-language",
        name: "Pikachu",
        set: "151",
        number: "025/165",
        language: "en",
        finish: "reverse holo",
        edition: "unlimited",
        promoType: "none",
      },
    ],
  );
  assert.equal(result.status, "unsupported");
  assert.equal(result.recommendedId, null);
});

test("profile action snapshots keep language, finish, and unknown distinctions exact", () => {
  const base = {
    id: "shared-provider-id",
    name: "Pikachu",
    set: "Test Set",
    number: "25/100",
  };
  const snapshots = [
    ["en-reverse", "en", "reverse_holofoil"],
    ["en-holo", "en", "holofoil"],
    ["ja-reverse", "ja", "reverse_holofoil"],
    ["ja-holo", "ja", "holofoil"],
  ].map(([id, language, finish]) =>
    collectibleIdentitySnapshot(
      {
        ...base,
        language,
        variantId: id,
        variantOptions: [
          {
            id,
            collectibleId: id,
            label: finish,
            finish,
            edition: "unknown",
            promoType: "unknown",
            language,
            status: "needs_review",
          },
        ],
      },
      id,
    ),
  );
  assert.equal(new Set(snapshots.map((item) => item.variantId)).size, 4);
  assert.deepEqual(
    snapshots.map(({ language, finish, edition, promoType }) => ({
      language,
      finish,
      edition,
      promoType,
    })),
    [
      { language: "en", finish: "reverse_holofoil", edition: "unknown", promoType: "unknown" },
      { language: "en", finish: "holofoil", edition: "unknown", promoType: "unknown" },
      { language: "ja", finish: "reverse_holofoil", edition: "unknown", promoType: "unknown" },
      { language: "ja", finish: "holofoil", edition: "unknown", promoType: "unknown" },
    ],
  );
});

test("variant summary removes repeated display fragments without clearing printing facts", () => {
  const option = normalizeVariantOption({ label: "Holofoil", finish: "holofoil", language: "en", edition: "first_edition", promoType: "stamped", status: "needs_review" });
  const before = structuredClone(option);
  const summary = variantOptionSummary(option);
  assert.equal(summary.split(" · ").filter(value => value === "Holofoil").length, 1);
  assert.match(summary, /EN/); assert.match(summary, /confirm details/);
  assert.deepEqual(option, before);
  assert.equal(option.edition, "first_edition"); assert.equal(option.promoType, "stamped");
});

test("identity snapshots retain an explicit release year without deriving purchase dates", () => {
  assert.equal(collectibleIdentitySnapshot({ releaseYear: 1999 }).release, 1999);
  assert.equal(collectibleIdentitySnapshot({ release: "2000-04-01", releaseYear: 1999 }).release, "2000-04-01");
  assert.equal(collectibleIdentitySnapshot({ purchaseDate: "2026-01-01" }).release, null);
});
