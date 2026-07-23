import test from 'node:test';
import assert from 'node:assert/strict';
import catalogHandler from '../api/catalog.js';
import setHandler from '../api/set.js';
import { fetchTcgdexSet, parseCatalogQuery, searchTcgdexCards } from '../lib/providers/tcgdex.js';

const cards = [
  { id:'sv03.5-151', localId:'151', name:'Mew ex', image:'https://assets.tcgdex.net/en/sv/sv03.5/151', rarity:'Double rare', variants:{holo:true}, set:{id:'sv03.5', name:'151', cardCount:{official:165,total:207}, releaseDate:'2023-09-22'} },
  { id:'ecard1-151', localId:'151', name:'Super Scoop Up', image:'https://assets.tcgdex.net/en/ecard/ecard1/151', rarity:'Uncommon', variants:{normal:true}, set:{id:'ecard1', name:'Expedition Base Set', cardCount:{official:165,total:165}, releaseDate:'2002-09-15'} },
  { id:'base1-4', localId:'4', name:'Charizard', image:'https://assets.tcgdex.net/en/base/base1/4', rarity:'Rare', variants:{holo:true}, set:{id:'base1', name:'Base Set', cardCount:{official:102,total:102}, releaseDate:'1999-01-09'} },
  { id:'base4-4', localId:'4', name:'Charizard', image:'https://assets.tcgdex.net/en/base/base4/4', rarity:'Rare', variants:{holo:true}, set:{id:'base4', name:'Base Set 2', cardCount:{official:130,total:130}, releaseDate:'2000-02-24'} },
  { id:'sv06-214', localId:'214', name:'Greninja ex', image:'https://assets.tcgdex.net/en/sv/sv06/214', rarity:'Special illustration rare', variants:{holo:true}, set:{id:'sv06', name:'Twilight Masquerade', cardCount:{official:167,total:226}, releaseDate:'2024-05-24'} },
  { id:'sv03.5-025', localId:'025', name:'Pikachu', image:'https://assets.tcgdex.net/en/sv/sv03.5/025', rarity:'Common', variants:{normal:true,reverse:true}, set:{id:'sv03.5', name:'151', cardCount:{official:165,total:207}, releaseDate:'2023-09-22'} },
  { id:'base1-58', localId:'58', name:'Pikachu', image:'https://assets.tcgdex.net/en/base/base1/58', rarity:'Common', variants:{normal:true}, set:{id:'base1', name:'Base Set', cardCount:{official:102,total:102}, releaseDate:'1999-01-09'} },
];

function comparable(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function installCatalogFetch({ ignoreName = false } = {}) {
  const requested = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async rawUrl => {
    const url = new URL(String(rawUrl));
    requested.push(url);
    const directId = decodeURIComponent(url.pathname.split('/cards/')[1] || '');
    if (directId) {
      const card = cards.find(candidate => candidate.id === directId);
      return new Response(JSON.stringify(card || {}), { status:card ? 200 : 404 });
    }
    const name = comparable(url.searchParams.get('name'));
    const localId = comparable(url.searchParams.get('localId'));
    const setName = comparable(url.searchParams.get('set.name'));
    const setId = comparable(url.searchParams.get('set.id'));
    const total = comparable(url.searchParams.get('set.cardCount.official'));
    const matches = cards.filter(card => (!name || ignoreName || comparable(card.name).includes(name))
      && (!localId || comparable(card.localId) === localId)
      && (!setName || comparable(card.set.name) === setName)
      && (!setId || comparable(card.set.id) === setId)
      && (!total || comparable(card.set.cardCount.official) === total));
    return new Response(JSON.stringify(matches.map(({id,localId,name,image}) => ({id,localId,name,image}))), { status:200 });
  };
  return { requested, restore:() => { globalThis.fetch = originalFetch; } };
}

test('does not call an unrelated name a strong match solely because its collector number matches', async () => {
  const mock = installCatalogFetch({ ignoreName:true });
  try {
    const results = await searchTcgdexCards('Mew ex 151/165', 'en', 12);
    assert.equal(results[0].externalIds.tcgdex, 'sv03.5-151');
    const unrelated = results.find(card => card.externalIds.tcgdex === 'ecard1-151');
    assert.ok(unrelated);
    assert.equal(unrelated.match.confidence, 'Number-only alternative');
  } finally { mock.restore(); }
});

test('parses mixed collector searches without treating the full query as a name', () => {
  assert.deepEqual(parseCatalogQuery('Mew ex 151/165'), {
    original:'Mew ex 151/165', name:'Mew ex', localId:'151', total:'165', setName:'', setCode:'', providerId:null, hints:[],
  });
  assert.equal(parseCatalogQuery('Pikachu 151').name, 'Pikachu');
  assert.equal(parseCatalogQuery('Pikachu 151').setName, '151');
  assert.equal(parseCatalogQuery('Pikachu 151').localId, '');
  assert.deepEqual(parseCatalogQuery('Charizard Base Set 4/102').hints, []);
  assert.equal(parseCatalogQuery('Charizard holo 1st edition').hints.join('|'), 'Holo|First edition');
});

for (const [query, expectedId] of [
  ['Mew ex 151/165', 'sv03.5-151'],
  ['Charizard 4/102', 'base1-4'],
  ['Greninja 214/167', 'sv06-214'],
  ['Pikachu 151', 'sv03.5-025'],
]) {
  test(`ranks the exact printing first for ${query}`, async () => {
    const mock = installCatalogFetch();
    try {
      const results = await searchTcgdexCards(query, 'en', 12);
      assert.equal(results[0].externalIds.tcgdex, expectedId);
      assert.match(results[0].match.confidence, /Exact|Strong/);
      assert.ok(results[0].match.reasons.length > 0);
    } finally { mock.restore(); }
  });
}

test('number-only 151/165 returns localId 151 matches and includes Mew ex from 151', async () => {
  const mock = installCatalogFetch();
  try {
    const results = await searchTcgdexCards('151/165', 'en', 12);
    assert.ok(results.length >= 2);
    assert.ok(results.every(card => card.localId === '151'));
    assert.ok(results.some(card => card.externalIds.tcgdex === 'sv03.5-151' && card.set === '151'));
  } finally { mock.restore(); }
});

test('catalog endpoint preserves the selected language and never serializes provider secrets', async () => {
  const mock = installCatalogFetch();
  const originalSecret = process.env.PKMNPRICES_API_KEY;
  process.env.PKMNPRICES_API_KEY = 'never-return-this-secret';
  let body;
  const response = { setHeader() {}, status(status) { this.statusCode=status; return this; }, json(value) { body=value; return value; } };
  try {
    await catalogHandler({ method:'GET', query:{q:'Pikachu 151',language:'ja',limit:'8'} }, response);
    assert.equal(response.statusCode, 200);
    assert.ok(mock.requested.every(url => url.pathname.includes('/v2/ja/cards')));
    assert.equal(body.cards[0].language, 'ja');
    assert.equal(body.parsedQuery.setName, '151');
    assert.equal(JSON.stringify(body).includes('never-return-this-secret'), false);
  } finally {
    mock.restore();
    if (originalSecret === undefined) delete process.env.PKMNPRICES_API_KEY; else process.env.PKMNPRICES_API_KEY = originalSecret;
  }
});

test('set catalog returns the exact checklist and rejects invalid set identifiers', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async rawUrl=>{
    const url=new URL(String(rawUrl));
    assert.equal(url.pathname,'/v2/en/sets/base1');
    return new Response(JSON.stringify({id:'base1',name:'Base Set',releaseDate:'1999-01-09',cardCount:{official:102,total:102},cards:cards.filter(card=>card.set.id==='base1').map(({id,localId,name,image})=>({id,localId,name,image}))}),{status:200});
  };
  try{
    const set=await fetchTcgdexSet('base1','en');
    assert.equal(set.name,'Base Set');
    assert.equal(set.totalCount,102);
    assert.equal(set.cards[0].number,'4/102');
    assert.equal(set.cards[0].externalIds.tcgdex,'base1-4');
    let body;const response={setHeader(){},status(status){this.statusCode=status;return this;},json(value){body=value;return value;}};
    await setHandler({method:'GET',query:{setId:'base1',language:'en'}},response);
    assert.equal(response.statusCode,200);
    assert.equal(body.set.cards.length,2);
    await setHandler({method:'GET',query:{setId:'../secret',language:'en'}},response);
    assert.equal(response.statusCode,400);
  }finally{globalThis.fetch=originalFetch;}
});
