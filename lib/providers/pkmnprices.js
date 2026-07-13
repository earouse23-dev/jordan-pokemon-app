const API_URL = 'https://api.pkmnprices.com/v1';

function comparable(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function selectCard(cards, lookup) {
  const wantedName = comparable(lookup.name);
  const wantedSet = comparable(lookup.set);
  const wantedNumber = comparable(String(lookup.number || '').split('/')[0]);
  return [...cards].sort((left, right) => {
    const score = card => (comparable(card.name) === wantedName ? 8 : 0)
      + (comparable(card.set?.name) === wantedSet ? 4 : 0)
      + (comparable(card.number) === wantedNumber ? 2 : 0);
    return score(right) - score(left);
  })[0] || null;
}

function safeSaleUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)ebay\.[a-z.]+$/i.test(url.hostname) ? url.toString() : null;
  } catch { return null; }
}

export function normalizePkmnPricesSale(sale) {
  const amount = Number(sale?.price);
  if (!Number.isFinite(amount) || amount < 0 || !sale?.sold_at) return null;
  return {
    provider: 'pkmnprices', source: 'ebay', providerSaleId: String(sale.ebay_listing_id || sale.id || ''),
    title: String(sale.title || ''), amount, currency: 'USD', soldAt: String(sale.sold_at),
    gradingCompany: sale.grader || null, grade: sale.grade == null ? null : String(sale.grade),
    saleType: sale.sale_type || null, sourceUrl: safeSaleUrl(sale.listing_url),
  };
}

async function request(url, apiKey, signal) {
  const response = await fetch(url, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' }, signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('PkmnPrices request failed');
    error.status = response.status;
    error.providerCode = String(body?.error?.code || '');
    error.providerMessage = String(body?.error?.message || '');
    throw error;
  }
  return body;
}

export async function fetchPkmnPricesSales(apiKey, lookup, signal) {
  let cardId = lookup.pkmnpricesId;
  if (!cardId) {
    const search = new URL(`${API_URL}/cards`);
    search.searchParams.set('name', lookup.name);
    const number = String(lookup.number || '').split('/')[0].trim();
    if (number) search.searchParams.set('number', number);
    search.searchParams.set('per_page', '10');
    const result = await request(search, apiKey, signal);
    cardId = selectCard(Array.isArray(result.data) ? result.data : [], lookup)?.id;
  }
  if (!cardId) return { cardId: null, sales: [] };
  const listings = new URL(`${API_URL}/cards/${encodeURIComponent(cardId)}/listings/ebay`);
  listings.searchParams.set('limit', '10');
  listings.searchParams.set('sort', 'date_desc');
  const result = await request(listings, apiKey, signal);
  return { cardId: String(cardId), sales: (Array.isArray(result.data) ? result.data : []).map(normalizePkmnPricesSale).filter(Boolean) };
}
