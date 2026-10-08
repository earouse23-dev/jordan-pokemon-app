import assert from "node:assert/strict";
import { parseCardText, matchOcrCards } from "../lib/card-ocr.js";
const card = {
  name: "Mewtwo GX",
  number: "076/073",
  language: "en",
  variant: "Holofoil",
};
const raw = parseCardText("Mewtwo GX\n76/73");
assert.equal(raw.query, "76/73");
assert.equal(raw.cardState, "raw");
assert.equal(matchOcrCards(raw, [card]).exact, true);
const graded = parseCardText("PSA\nGEM MT 10\nMewtwo GX\n76/73");
assert.equal(graded.grade, "10");
assert.equal(matchOcrCards(graded, [card]).exact, true);
assert.equal(
  matchOcrCards(parseCardText("PSA Mewtwo GX 76/73"), [card]).exact,
  false,
);
assert.equal(
  matchOcrCards(raw, [card, { ...card, variant: "Reverse holo" }]).exact,
  false,
);
assert.equal(
  matchOcrCards(raw, [
    { ...card, number: "77/73" },
    { ...card, name: "Mew GX" },
    { ...card, language: "de" },
  ]).cards.length,
  0,
);
assert.equal(parseCardText("Mewtwo GX 76/73 Pikachu 25/165").query, "");
assert.equal(parseCardText("No card here").query, "");
console.log("Local OCR identity boundaries passed");

assert.equal(
  matchOcrCards(parseCardText("@harizard@? 199/165"), [
    { name: "Charizard ex", number: "199/165", language: "en" },
  ]).exact,
  true,
);
assert.equal(
  matchOcrCards(parseCardText("Charmeleon 199/165"), [
    { name: "Charizard ex", number: "199/165", language: "en" },
  ]).cards.length,
  0,
);
assert.equal(
  matchOcrCards(parseCardText("Mewtwo 76/73"), [
    { name: "Mew ex", number: "76/73", language: "en" },
  ]).cards.length,
  0,
);

assert.equal(parseCardText("PSA GEM MT 10 00123456 Mewtwo GX 76/73").certificationNumber, "00123456");
assert.equal(parseCardText("PSA GEM MT 10 00123456 99887766 Mewtwo GX 76/73").certificationNumber, "");
assert.equal(parseCardText("00123456 Mewtwo GX 76/73").certificationNumber, "");
