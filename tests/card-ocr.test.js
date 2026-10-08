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
