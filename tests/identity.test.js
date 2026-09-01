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
  selectVariantOption,
  variantDifferenceFields,
} from "../lib/identity.js";

const benchmark = JSON.parse(
  await readFile(
    new URL("./fixtures/identity-benchmark-v1.json", import.meta.url),
    "utf8",
  ),
);

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
