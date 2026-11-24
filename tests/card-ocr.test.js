import test from "node:test";
import assert from "node:assert/strict";
import { parseCardText, matchOcrCards, packageSearchQuery } from "../lib/card-ocr.js";
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
const japanese = parseCardText('ピカチュウex ０２３／１０６', 'ja');
assert.equal(japanese.query, '23/106');
assert.equal(matchOcrCards(japanese, [{name:'ピカチュウex',number:'023/106',language:'ja'}]).exact,true);
assert.equal(matchOcrCards(japanese, [{name:'Pikachu ex',number:'023/106',language:'en'}]).exact,false);
const { enhanceReadingPixels } = await import('../lib/card-ocr.js');
const dim = new Uint8ClampedArray(Array.from({length:100}, (_,i)=>[i<50?30:150,i<50?30:150,i<50?30:150,255]).flat());
enhanceReadingPixels(dim);assert.equal(dim[0],0);assert.equal(dim[200],255);assert.equal(dim[203],255);
assert.equal(matchOcrCards(parseCardText('ビ カ チ ュ ウ ex 023/106','ja'),[{name:'ピカチュウex',number:'023/106',language:'ja'}]).exact,true);
assert.equal(matchOcrCards(parseCardText('リザードンex 023/106','ja'),[{name:'ピカチュウex',number:'023/106',language:'ja'}]).exact,false);
assert.equal(matchOcrCards(japanese,[{name:'',number:'023/106',language:'ja'}]).exact,false);
assert.equal(matchOcrCards(parseCardText('リザ ー ド ン 2 々 201/165','ja'),[{name:'リザードンex',number:'201/165',language:'ja'}]).exact,true);

assert.equal(packageSearchQuery("POKEMON\nTRADING CARD GAME\nCROWN ZENITH\nELITE TRAINER BOX\nAges 6+"), "CROWN ZENITH ELITE TRAINER BOX");
assert.equal(packageSearchQuery("Surging Sparks Booster Box\nWarning: choking hazard"), "Surging Sparks Booster Box");
assert.equal(packageSearchQuery(""), "");


test("modern PSA headers require a coherent grade, language, expansion and certificate", async () => {
  const { parseModernSlabLabel } = await import("../lib/card-ocr.js");
  const text = "2025 POKEMON MEG EN #140\nSNOVER GEM MT\nILLUSTRATION RARE 10\n144250291";
  assert.equal(parseModernSlabLabel(text).providerId, "me01-140");
  for (const invalid of [text.replace("EN","JP"), text.replace("MEG","XYZ"), text.replace("GEM MT","MINT"), text.replace("RARE","OC"), text.slice(0,-3)]) {
    assert.equal(parseModernSlabLabel(invalid), null);
  }
});

test("vintage PSA labels need a complete standard layout and matching issue", async () => {
  const { parseLegacyPsaLabel, matchesLegacyPsaCard } = await import("../lib/psa-label.js");
  const text = "2008 POKEMON JAPANESE #092\nCHARIZARD-HOLO GEM MT\nSTORMFRONT-1ST ED. 10\n123456789";
  const label = parseLegacyPsaLabel(text);
  const card = { name:"Charizard", set:"Intense Fight in the Destroyed Sky", number:"092/092", language:"ja" };
  assert.equal(label.edition, "first_edition");
  assert.equal(matchesLegacyPsaCard(label, card), true);
  for (const change of [{language:"en"},{set:"Stormfront"},{number:"091/092"},{name:"Charizard ex"}])
    assert.equal(matchesLegacyPsaCard(label, {...card,...change}), false);
  for (const invalid of [text.replace("HOLO","REVERSE"),text.replace("10\n","9\n"),text.replace("ED.","ED. OC"),text.replace("STORMFRONT","STORM"),text+"\nSTAFF"])
    assert.equal(parseLegacyPsaLabel(invalid), null);
});

test("movie VS Pack label resolves only to its Japanese printing and retains an unknown finish", async () => {
  const { parseLegacyPsaLabel, matchesLegacyPsaCard } = await import("../lib/psa-label.js");
  const text = "2004 POKEMON JAPANESE #003\nSKY'S RAYQUAZA GEM MT\nMOVIE COMM. VS PACK 10\n123456789";
  const label = parseLegacyPsaLabel(text);
  assert.equal(label.finish, null);
  assert.equal(matchesLegacyPsaCard(label, {name:"Sky's Rayquaza", language:"ja", set:label.catalogSet, number:"003/019"}), true);
  assert.equal(parseLegacyPsaLabel(text.replace("PACK 10","PACK 9")), null);
  assert.equal(parseLegacyPsaLabel(text.replace("RAYQUAZA","RAYQUAZA OC")), null);
});
