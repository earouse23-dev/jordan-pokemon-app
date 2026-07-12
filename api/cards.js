import { fetchJustTcgLookup, normalizeJustTcgCard } from '../lib/providers/justtcg.js';

const windows = new Map();
const SAFE_TEXT = /^[\p{L}\p{N} .:'&+\-/()#]{1,120}$/u;

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
  return current.count > 15;
}

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  return response.status(status).json(body);
}

function parseLookups(request) {
  let input;
  try { input = JSON.parse(String(request.query.lookups || '[]')); } catch { return null; }
  if (!Array.isArray(input) || !input.length || input.length > 8) return null;
  const seen = new Set();
  const lookups = [];
  for (const raw of input) {
    const lookup = {
      clientId: String(raw?.clientId || '').trim(),
      justtcgId: String(raw?.justtcgId || '').trim(),
      tcgplayerId: String(raw?.tcgplayerId || '').trim(),
      name: String(raw?.name || '').trim(),
      set: String(raw?.set || '').trim(),
      number: String(raw?.number || '').trim(),
    };
    if (!lookup.clientId || seen.has(lookup.clientId)) continue;
    const hasDirectId = /^[A-Za-z0-9-]{1,100}$/.test(lookup.justtcgId) || /^\d{1,12}$/.test(lookup.tcgplayerId);
    const hasSearch = SAFE_TEXT.test(lookup.name) && (!lookup.set || SAFE_TEXT.test(lookup.set)) && (!lookup.number || SAFE_TEXT.test(lookup.number));
    if (!hasDirectId && !hasSearch) return null;
    seen.add(lookup.clientId);
    lookups.push(lookup);
  }
  return lookups.length ? lookups : null;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { error: 'Method not allowed' });
  }
  if (isRateLimited(request)) return send(response, 429, { error: 'Too many pricing requests. Try again shortly.' }, { 'Retry-After': '60' });

  const lookups = parseLookups(request);
  if (!lookups) return send(response, 400, { error: 'Provide 1 to 8 valid card lookups.' });

  const apiKey = process.env.JUSTTCG_API_KEY || process.env.PRICING_PROVIDER_API_KEY;
  if (!apiKey) return send(response, 503, { error: 'Live pricing is not configured.', provider: 'justtcg' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  const retrievedAt = new Date().toISOString();
  try {
    const settled = await Promise.allSettled(lookups.map(lookup => fetchJustTcgLookup(apiKey, lookup, controller.signal)));
    const cards = [];
    const unavailable = [];
    let rateLimited = false;
    settled.forEach((result, index) => {
      const lookup = lookups[index];
      if (result.status === 'fulfilled' && result.value.card) cards.push(normalizeJustTcgCard(result.value.card, retrievedAt, lookup.clientId));
      else {
        unavailable.push(lookup.clientId);
        if (result.status === 'rejected' && result.reason?.status === 429) rateLimited = true;
      }
    });
    if (!cards.length && rateLimited) return send(response, 429, { error: 'The pricing plan rate limit was reached.', provider: 'justtcg', unavailable }, { 'Retry-After': '60' });
    return send(response, 200, { cards, unavailable, retrievedAt, provider: 'justtcg', partial: unavailable.length > 0 }, {
      'Cache-Control': 's-maxage=900, stale-while-revalidate=3600',
      'CDN-Cache-Control': 'max-age=900',
    });
  } catch (error) {
    console.error('[api/cards] provider request errored', { name: error?.name || 'Error' });
    return send(response, 502, { error: 'The pricing provider did not respond in time.', provider: 'justtcg' });
  } finally {
    clearTimeout(timeout);
  }
}
