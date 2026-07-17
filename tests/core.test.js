import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, collectionToCsv, parseCollectionCsv, isStale, matchesSearch, missingSetChecklist, money, portfolioSnapshot, safeCsvCell, transactionReportCsv } from '../lib/core.js';

test('portfolio totals respect quantity and exclude unpriced values', () => {
  const totals = calculateTotals([{quantity:2,cost:10,price:15},{quantity:3,cost:4,price:null}]);
  assert.deepEqual(totals,{quantity:5,cost:32,costKnown:5,unknownCost:0,value:30,priced:2,unpriced:3,comparableValue:30,comparableCost:20,gainCoverage:2});
});
test('gain coverage excludes copies with unknown cost instead of treating them as free', () => {
  const totals = calculateTotals([{quantity:2,cost:null,price:20},{quantity:1,cost:5,price:10},{quantity:1,cost:0,price:3}]);
  assert.equal(totals.value,53);
  assert.equal(totals.cost,5);
  assert.equal(totals.unknownCost,2);
  assert.equal(totals.comparableValue,13);
  assert.equal(totals.comparableCost,5);
  assert.equal(totals.gainCoverage,2);
});
test('money preserves explicit currency',()=>{ assert.equal(money(12.5,'EUR'),'€12.50'); });
test('share snapshot omits private fields and only includes performance by opt in',()=>{
  const items=[{name:'Charizard',set:'Base Set',number:'4/102',quantity:1,cost:100,price:150,notes:'private note',location:'safe',certificationNumber:'123'}];
  const standard=portfolioSnapshot(items,{date:'2026-07-17'});
  assert.match(standard,/Estimated market value: \$150\.00/);
  assert.doesNotMatch(standard,/private note|safe|123|cost basis|gain\/loss/i);
  const performance=portfolioSnapshot(items,{includePerformance:true,date:'2026-07-17'});
  assert.match(performance,/Recorded cost basis: \$100\.00/);
  assert.match(performance,/Known gain\/loss: \+\$50\.00/);
});
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
test('CSV backup round-trips owned records without turning blank costs into zero',()=>{
  const source=[{name:'Mew ex',set:'151',number:'151/165',variant:'Holofoil',condition:'Near Mint',gradingCompany:'',grade:'',quantity:2,cost:null,price:9.25,tags:['Favorites'],location:'Binder 1',notes:'Clean, centered'}];
  const parsed=parseCollectionCsv(collectionToCsv(source));
  assert.equal(parsed.errors.length,0);
  assert.deepEqual(parsed.records,source);
});
test('transaction report exports period FIFO profit and neutralizes spreadsheet formulas',()=>{
  const csv=transactionReportCsv([{name:'=Charizard',set:'Base Set',number:'4/102',currency:'USD',transactions:[{type:'purchase',date:'2026-06-01',quantity:1,unitPrice:100,totalCost:100,currency:'USD'},{type:'sale',date:'2026-07-01',quantity:1,unitPrice:150,subtotal:150,netProceeds:135,allocatedCost:80,currency:'USD',marketplace:'@market'},{type:'sale',date:'2025-01-01',quantity:1,netProceeds:10,allocatedCost:5,currency:'USD'}]}],{from:'2026-01-01',to:'2026-12-31',currency:'USD'});
  assert.match(csv,/'=Charizard/);
  assert.match(csv,/"55","'@market"/);
  assert.doesNotMatch(csv,/2025-01-01/);
});
test('missing set checklist includes only unowned collector numbers and no private collection fields',()=>{
  const text=missingSetChecklist({name:'Base Set',totalCount:3,cards:[{localId:'1',name:'Alakazam'},{localId:'2',name:'Blastoise'},{localId:'3',name:'Chansey'}]},new Set(['2']));
  assert.match(text,/2 of 3 cards missing/);
  assert.match(text,/#1 Alakazam/);
  assert.match(text,/#3 Chansey/);
  assert.doesNotMatch(text,/Blastoise|cost|location|cert/i);
});
