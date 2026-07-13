import { fetchPkmnPricesSales } from '../lib/providers/pkmnprices.js';

const SAFE_TEXT = /^[\p{L}\p{N} .:'&+\-/()#]{1,120}$/u;

function send(response, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers)) response.setHeader(key, value);
  return response.status(status).json(body);
}

function parseLookup(request) {
  let raw;
  try { raw = JSON.parse(String(request.query.lookup || '{}')); } catch { return null; }
  const lookup = {
    clientId: String(raw?.clientId || '').trim(), pkmnpricesId: String(raw?.pkmnpricesId || '').trim(),
    name: String(raw?.name || '').trim(), set: String(raw?.set || '').trim(), number: String(raw?.number || '').trim(),
  };
  const direct = /^\d{1,12}$/.test(lookup.pkmnpricesId);
  const search = SAFE_TEXT.test(lookup.name) && (!lookup.set || SAFE_TEXT.test(lookup.set)) && (!lookup.number || SAFE_TEXT.test(lookup.number));
  return lookup.clientId && (direct || search) ? lookup : null;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return send(response, 405, { error: 'Method not allowed' });
  }
  const lookup = parseLookup(request);
  if (!lookup) return send(response, 400, { error: 'Provide one valid card lookup.' });
  const apiKey = process.env.PKMNPRICES_API_KEY;
  if (!apiKey) return send(response, 503, { error: 'Licensed sold-listing data is not configured.', provider: 'pkmnprices' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9_000);
  try {
    const result = await fetchPkmnPricesSales(apiKey, lookup, controller.signal);
    return send(response, 200, { clientId: lookup.clientId, providerCardId: result.cardId, sales: result.sales, retrievedAt: new Date().toISOString() }, {
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400', 'CDN-Cache-Control': 'max-age=3600',
    });
  } catch (error) {
    console.error('[api/sales] provider request failed', { status: error?.status || null, name: error?.name || 'Error' });
    if (error?.status === 403 && /pro|plan|listing/i.test(error?.providerMessage || '')) {
      return send(response, 403, { error: 'PkmnPrices Pro or higher is required for sold-listing evidence.', code: 'provider_plan_required', provider: 'pkmnprices' });
    }
    const status = error?.status === 429 ? 429 : 502;
    return send(response, status, { error: status === 429 ? 'The sales-provider rate limit was reached.' : 'Sold-listing data is temporarily unavailable.', code: status === 429 ? 'provider_rate_limited' : 'provider_unavailable', provider: 'pkmnprices' });
  } finally {
    clearTimeout(timeout);
  }
}
