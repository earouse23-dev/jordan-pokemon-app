import { parseCatalogQuery, searchTcgdexCards } from '../lib/providers/tcgdex.js';

const LANGUAGES = new Set(['en', 'fr', 'es', 'de', 'it', 'pt', 'ja', 'zh-tw', 'id', 'th']);

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  return response.status(status).json(body);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { error: 'Method not allowed' });
  }
  const query = String(request.query.q || '').trim();
  const language = String(request.query.language || 'en').toLowerCase();
  const limit = Math.min(12, Math.max(1, Number(request.query.limit) || 8));
  if (query.length < 2 || query.length > 80 || !LANGUAGES.has(language)) return send(response, 400, { error: 'Provide a valid query and supported language.' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const cards = await searchTcgdexCards(query, language, limit, controller.signal);
    return send(response, 200, { cards, parsedQuery:parseCatalogQuery(query), provider: 'tcgdex', retrievedAt: new Date().toISOString() }, {
      'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800', 'CDN-Cache-Control': 'max-age=86400',
    });
  } catch (error) {
    console.error('[api/catalog] provider request failed', { name: error?.name || 'Error' });
    return send(response, 502, { error: 'The catalog provider is temporarily unavailable.', provider: 'tcgdex' });
  } finally { clearTimeout(timeout); }
}
