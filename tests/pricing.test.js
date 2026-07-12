import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/cards.js';
import { finishForVariant, normalizeCard, selectCardmarketReference, selectReferenceQuote } from '../lib/pricing.js';

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

test('server endpoint keeps the API key in the upstream header and returns normalized data', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PRICING_PROVIDER_API_KEY;
  process.env.PRICING_PROVIDER_API_KEY = 'test-server-secret';
  let body;
  const headers = {};
  const response = {
    setHeader(name, value) { headers[name] = value; },
    status(status) { this.statusCode = status; return this; },
    json(value) { body = value; return value; },
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers['X-Api-Key'], 'test-server-secret');
    assert.match(String(url), /id%3Aset-1/);
    return new Response(JSON.stringify({ data: [card] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    await handler({ method:'GET', query:{ ids:'set-1' }, headers:{}, socket:{} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(body.cards[0].providerCardId, 'set-1');
    assert.equal(JSON.stringify(body).includes('test-server-secret'), false);
    assert.match(headers['Cache-Control'], /s-maxage=900/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PRICING_PROVIDER_API_KEY;
    else process.env.PRICING_PROVIDER_API_KEY = originalKey;
  }
});
