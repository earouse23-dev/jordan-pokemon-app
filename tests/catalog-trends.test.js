import test from 'node:test';
import assert from 'node:assert/strict';
import { cachedPkmnPricesCatalogTrends } from '../lib/providers/pkmnprices.js';
import { pkmnPricesRequests } from '../lib/pkmnprices-requests.js';
const card={id:'tcgdex:en:base1-2',name:'Blastoise',set:'Base Set',number:'2/102',language:'en',variantOptions:[{id:'holo',label:'Holofoil',finish:'holofoil',edition:'unlimited',promoType:'none',language:'en',status:'exact'}]};
const provider={id:27,name:'Blastoise',number:'2',total_set_number:102,language:'English',set:{name:'Base Set'},prices:[{source:'tcgplayer',currency:'USD',condition:'Near Mint',variant:'Unlimited Holofoil'}]};
test('catalog trends batch only public saved exact raw NM history; gaps never call a provider or expose raw cache data',async()=>{
  const originalRead=pkmnPricesRequests.readCaches, originalFetch=globalThis.fetch;
  let reads=[];
  globalThis.fetch=()=>{throw new Error('No outbound requests allowed');};
  try {
    pkmnPricesRequests.readCaches=async keys=>{
      reads.push(keys);
      if(reads.length===1)return new Map(keys.map(key=>[key,{body:{data:[provider]},expires:0}]));
      const date=new Date(Date.now()-86400000).toISOString().slice(0,10), old=new Date(Date.now()-10*86400000).toISOString().slice(0,10);
      const row={source:'tcgplayer',currency:'USD',condition:'Near Mint',variant:'Unlimited Holofoil'};
      return new Map(keys.map(key=>[key,{body:{rows:[{...row,date:old,avg:100},{...row,date,avg:125},{...row,date,avg:900,grader:'PSA',grade:'10'},{...row,date,avg:1,condition:'Heavily Played'},{...row,date,avg:5,source:'cardmarket'},{...row,date,avg:500,variant:'1st Edition Holofoil'}]}}]));
    };
    const result=await cachedPkmnPricesCatalogTrends('private-key',[card],AbortSignal.timeout(1000));
    assert.equal(reads.length,2);assert.equal(reads[0].length,1);assert.equal(reads[1].length,4);
    assert.equal(result[0].referenceTrend.percent,25);assert.equal(result[0].referenceTrend.days,2);
    assert.deepEqual(result[0].referenceTrend.context,{language:'en',variantId:'holo',finish:'holofoil',edition:'unlimited',promoType:'none',currency:'USD',condition:'Near Mint'});
    assert.ok(!JSON.stringify(result).includes('private-key'));assert.ok(!JSON.stringify(result).includes('grader'));
    pkmnPricesRequests.readCaches=async()=>new Map();
    assert.deepEqual(await cachedPkmnPricesCatalogTrends('private-key',[card]),[card]);
    pkmnPricesRequests.readCaches=async keys=>new Map(keys.map(key=>[key,{body:{data:[{...provider,language:'Japanese'}]}}]));
    assert.deepEqual(await cachedPkmnPricesCatalogTrends('private-key',[card]),[card]);
  } finally { pkmnPricesRequests.readCaches=originalRead;globalThis.fetch=originalFetch; }
});
