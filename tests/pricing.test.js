import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/cards.js';
import { finishForVariant, normalizeCard, selectCardmarketReference, selectReferenceQuote } from '../lib/pricing.js';
import { normalizeJustTcgCard, normalizePrinting } from '../lib/providers/justtcg.js';
import { normalizePkmnPricesSale } from '../lib/providers/pkmnprices.js';
import { normalizeTcgdexCard, normalizeTcgdexPricingCard } from '../lib/providers/tcgdex.js';

const card = {
  id: 'set-1', name: 'Test card', number: '1', set: { name: 'Test Set', releaseDate: '2026/01/02' },
  images: { small: 'small.png', large: 'large.png' },
  tcgplayer: { url: 'https://example.com/us', updatedAt: '2026/07/10', prices: {
    holofoil: { low: 8, mid: 10, market: 9.5 }, reverseHolofoil: { market: 7.25 },
  } },
  cardmarket: { url: 'https://example.com/eu', updatedAt: '2026/07/09', prices: {
    trendPrice: 8.2, reverseHoloTrend: 6.7,
  } },
};

test('normalizes provider quotes without exposing provider response schemas', () => {
  const normalized = normalizeCard(card, '2026-07-12T00:00:00.000Z');
  assert.equal(normalized.providerCardId, 'set-1');
  assert.equal(normalized.quotes.length, 6);
  assert.deepEqual(normalized.quotes[0].observedAt, '2026-07-10');
});

test('selects only a compatible TCGplayer finish and preferred price type', () => {
  const quotes = normalizeCard(card).quotes;
  assert.equal(selectReferenceQuote(quotes, 'Holofoil').amount, 9.5);
  assert.equal(selectReferenceQuote(quotes, 'Reverse Holofoil').amount, 7.25);
  assert.equal(selectReferenceQuote(quotes, 'Normal'), null);
});

test('selects compatible Cardmarket reference without mixing currencies', () => {
  const quotes = normalizeCard(card).quotes;
  assert.equal(selectCardmarketReference(quotes, 'Holofoil').amount, 8.2);
  assert.equal(selectCardmarketReference(quotes, 'Reverse Holofoil').amount, 6.7);
  assert.equal(finishForVariant('1st Edition Holofoil'), '1stEditionHolofoil');
});

test('normalizes JustTCG condition, printing, timestamps, statistics and daily history', () => {
  const normalized = normalizeJustTcgCard({
    id: 'pokemon-test-set-test-card-1', uuid: 'card-uuid', name: 'Test card', set_name: 'Test Set', number: '1', rarity: 'Rare', tcgplayerId: '123',
    variants: [{
      id: 'variant-slug', uuid: 'variant-uuid', condition: 'Near Mint', printing: 'Holofoil', language: 'English',
      price: 12.5, lastUpdated: 1783814400, priceChange24hr: -1.2, avgPrice: 11.9,
      priceHistory: [{ p: 10.25, t: 1783728000 }],
    }],
  }, '2026-07-12T00:00:00.000Z', 'client-card');
  assert.equal(normalized.providerCardId, 'client-card');
  assert.equal(normalized.externalIds.tcgplayer, '123');
  assert.equal(normalized.quotes[0].finish, 'holofoil');
  assert.equal(normalized.quotes[0].quality.priceChange24h, -1.2);
  assert.equal(normalized.history[0].granularity, 'day');
  assert.equal(normalizePrinting('1st Edition Holofoil'), '1stEditionHolofoil');
  assert.equal(selectReferenceQuote(normalized.quotes, 'Holofoil').amount, 12.5);
});

test('normalizes catalog variants and only preserves safe sold-listing links', () => {
  const catalogCard = normalizeTcgdexCard({ id:'base1-4', localId:'4', name:'Charizard', image:'https://assets.tcgdex.net/en/base/base1/4', set:{ id:'base1', name:'Base Set' }, variants:{ normal:false, holo:true, firstEdition:true } }, 'en');
  assert.equal(catalogCard.id, 'tcgdex:en:base1-4');
  assert.deepEqual(catalogCard.variants, ['holo', 'firstEdition']);
  const sale = normalizePkmnPricesSale({ ebay_listing_id:'123', title:'Charizard PSA 10', price:100, grader:'PSA', grade:'10', sold_at:'2026-07-10', listing_url:'https://www.ebay.com/itm/123' });
  assert.equal(sale.sourceUrl, 'https://www.ebay.com/itm/123');
  const unsafe = normalizePkmnPricesSale({ id:'x', title:'Bad link', price:1, sold_at:'2026-07-10', listing_url:'javascript:alert(1)' });
  assert.equal(unsafe.sourceUrl, null);
});

test('normalizes public TCGdex TCGplayer and Cardmarket price fields', () => {
  const normalized = normalizeTcgdexPricingCard({
    id:'base1-4', localId:'4', name:'Charizard', set:{name:'Base Set'}, pricing:{
      tcgplayer:{updated:'2026-07-12T10:00:00Z',unit:'USD','unlimited-holofoil':{marketPrice:350,lowPrice:300}},
      cardmarket:{updated:'2026-07-12T00:00:00Z',unit:'EUR','trend-holo':275,'avg7-holo':270},
    },
  }, '2026-07-12T12:00:00Z', 'client-base');
  assert.equal(normalized.providerCardId, 'client-base');
  assert.equal(normalized.quotes.find(quote => quote.provider === 'tcgplayer' && quote.priceType === 'market').finish, 'holofoil');
  assert.equal(normalized.quotes.find(quote => quote.provider === 'cardmarket' && quote.priceType === 'trend').amount, 275);
  assert.equal(normalized.quotes.find(quote => quote.quality.windowDays === 7).amount, 270);
});

test('server endpoint keeps the JustTCG key in the upstream header and returns normalized data', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.JUSTTCG_API_KEY;
  process.env.JUSTTCG_API_KEY = 'test-server-secret';
  let body;
  const headers = {};
  const response = {
    setHeader(name, value) { headers[name] = value; },
    status(status) { this.statusCode = status; return this; },
    json(value) { body = value; return value; },
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers['x-api-key'], 'test-server-secret');
    assert.match(String(url), /q=Test\+card/);
    return new Response(JSON.stringify({ data: [{
      id:'pokemon-test-set-test-card-1', uuid:'just-card', name:'Test card', set_name:'Test Set', number:'1', rarity:'Rare', tcgplayerId:'123',
      variants:[{ id:'v', uuid:'variant', condition:'Near Mint', printing:'Holofoil', language:'English', price:9.5, lastUpdated:1783814400, priceHistory:[] }],
    }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const lookups = JSON.stringify([{ clientId:'set-1', name:'Test card', set:'Test Set', number:'1/100' }]);
    await handler({ method:'GET', query:{ lookups }, headers:{}, socket:{} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(body.cards[0].providerCardId, 'set-1');
    assert.deepEqual(body.providers, ['justtcg']);
    assert.equal(JSON.stringify(body).includes('test-server-secret'), false);
    assert.match(headers['Cache-Control'], /s-maxage=900/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.JUSTTCG_API_KEY;
    else process.env.JUSTTCG_API_KEY = originalKey;
  }
});

test('server endpoint returns public TCGdex market pricing when no paid key is configured', async () => {
  const originalFetch = globalThis.fetch;
  const originalJustKey = process.env.JUSTTCG_API_KEY;
  const originalPricingKey = process.env.PRICING_PROVIDER_API_KEY;
  delete process.env.JUSTTCG_API_KEY; delete process.env.PRICING_PROVIDER_API_KEY;
  let body;
  const response = {
    setHeader() {}, status(status) { this.statusCode = status; return this; }, json(value) { body = value; return value; },
  };
  globalThis.fetch = async url => {
    assert.match(String(url), /api\.tcgdex\.net\/v2\/en\/cards\/base1-4/);
    return new Response(JSON.stringify({
      id:'base1-4', localId:'4', name:'Charizard', set:{name:'Base Set'},
      pricing:{tcgplayer:{updated:'2026-07-12T10:00:00Z',unit:'USD',holofoil:{marketPrice:350}}},
    }), { status:200, headers:{'Content-Type':'application/json'} });
  };
  try {
    const lookups = JSON.stringify([{ clientId:'base1-4', name:'Charizard', set:'Base Set', number:'4/102' }]);
    await handler({ method:'GET', query:{lookups}, headers:{}, socket:{} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.providers, ['tcgdex']);
    assert.equal(body.cards[0].quotes[0].amount, 350);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalJustKey === undefined) delete process.env.JUSTTCG_API_KEY; else process.env.JUSTTCG_API_KEY = originalJustKey;
    if (originalPricingKey === undefined) delete process.env.PRICING_PROVIDER_API_KEY; else process.env.PRICING_PROVIDER_API_KEY = originalPricingKey;
  }
});
