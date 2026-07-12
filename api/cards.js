import { normalizeCard } from '../lib/pricing.js';

const API_URL = 'https://api.pokemontcg.io/v2/cards';
const ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;
const windows = new Map();

function isRateLimited(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const key = forwarded || request.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    windows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  if (windows.size > 1000) {
    for (const [entry, value] of windows) if (now - value.startedAt >= 60_000) windows.delete(entry);
  }
  return current.count > 30;
}

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { error: 'Method not allowed' });
  }
  if (isRateLimited(request)) {
    return send(response, 429, { error: 'Too many pricing requests. Try again shortly.' }, { 'Retry-After': '60' });
  }

  const ids = [...new Set(String(request.query.ids || '').split(',').map(value => value.trim()).filter(Boolean))];
  if (!ids.length || ids.length > 25 || ids.some(id => !ID_PATTERN.test(id))) {
    return send(response, 400, { error: 'Provide 1 to 25 valid card IDs.' });
  }

  const apiKey = process.env.PRICING_PROVIDER_API_KEY || process.env.CATALOG_PROVIDER_API_KEY;
  if (!apiKey) return send(response, 503, { error: 'Live pricing is not configured.' });

  const query = ids.map(id => `id:${id}`).join(' OR ');
  const url = new URL(API_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('pageSize', String(ids.length));
  url.searchParams.set('select', 'id,name,set,number,rarity,artist,images,tcgplayer,cardmarket');

  try {
    const upstream = await fetch(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok) {
      console.error('[api/cards] provider request failed', { status: upstream.status });
      return send(response, 502, { error: 'The pricing provider is temporarily unavailable.' });
    }
    const payload = await upstream.json();
    const retrievedAt = new Date().toISOString();
    const cards = Array.isArray(payload.data) ? payload.data.map(card => normalizeCard(card, retrievedAt)) : [];
    return send(response, 200, { cards, retrievedAt }, {
      'Cache-Control': 's-maxage=900, stale-while-revalidate=3600',
      'CDN-Cache-Control': 'max-age=900',
    });
  } catch (error) {
    console.error('[api/cards] provider request errored', { name: error?.name || 'Error' });
    return send(response, 502, { error: 'The pricing provider did not respond in time.' });
  }
}
