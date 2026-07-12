import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, collectionToCsv, isStale, matchesSearch, money, safeCsvCell } from '../lib/core.js';

test('portfolio totals respect quantity and exclude unpriced values', () => {
  const totals = calculateTotals([{quantity:2,cost:10,price:15},{quantity:3,cost:4,price:null}]);
  assert.deepEqual(totals,{quantity:5,cost:32,value:30,priced:2,unpriced:3});
});
test('money preserves explicit currency',()=>{ assert.equal(money(12.5,'EUR'),'€12.50'); });
test('staleness uses the configured threshold',()=>{
  const now=new Date('2026-07-12T00:00:00Z').getTime();
  assert.equal(isStale('2026-07-01',now,7),true); assert.equal(isStale('2026-07-10',now,7),false);
});
test('search normalizes accents and punctuation',()=>{
  assert.equal(matchesSearch({name:'Flabébé',set:'Paldea',number:'4/102',tags:[]},'flabebe 4/102'),true);
});
test('CSV cells neutralize spreadsheet formulas and escape quotes',()=>{
  assert.equal(safeCsvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');
  const csv=collectionToCsv([{name:'@SUM(A1)',quantity:1,tags:[]}]); assert.match(csv,/"'@SUM\(A1\)"/);
});
