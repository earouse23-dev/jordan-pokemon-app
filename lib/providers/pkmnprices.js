const API_URL = 'https://api.pkmnprices.com/v1';

function finiteAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function comparable(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function finishFromVariant(value) {
  const variant = String(value || '').toLowerCase();
  if (variant.includes('1st') && (variant.includes('holo') || variant.includes('foil'))) return '1stEditionHolofoil';
  if (variant.includes('1st')) return '1stEditionNormal';
  if (variant.includes('reverse')) return 'reverseHolofoil';
  if (variant.includes('holo') || variant.includes('foil')) return 'holofoil';
  return 'normal';
}

function sourceProvider(value) {
  const source = String(value || '').toLowerCase();
  if (source.includes('cardmarket')) return 'cardmarket';
  return 'tcgplayer';
}

function sourceCurrency(value) {
  return sourceProvider(value) === 'cardmarket' ? 'EUR' : 'USD';
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

export function normalizePkmnPricesCard(card, historyRows = [], retrievedAt = new Date().toISOString(), clientId = null, historyStatus = 'live') {
  const quotes = [];
  const history = [];

  for (const price of Array.isArray(card?.prices) ? card.prices : []) {
    const provider = sourceProvider(price.source);
    const currency = String(price.currency || sourceCurrency(price.source)).toUpperCase();
    const finish = finishFromVariant(price.variant);
    const providerVariantId = [
      card.id,
      provider,
      price.condition || '',
      price.variant || '',
      price.grader || '',
      price.grade || '',
    ].join(':');
    const baseQuote = {
      provider,
      providerProductId: String(card.id || ''),
      providerVariantId,
      currency,
      region: provider === 'cardmarket' ? 'EU' : 'US',
      condition: price.condition || null,
      finish,
      printing: price.variant || null,
      language: card.language || 'English',
      gradingCompany: price.grader || null,
      grade: price.grade == null ? null : String(price.grade),
      observedAt: price.created_at || price.updated_at || null,
      retrievedAt,
      providerUrl: provider === 'cardmarket' ? card.cardmarket_url || null : null,
      attribution: `${provider === 'cardmarket' ? 'Cardmarket' : 'TCGplayer'} pricing via PkmnPrices`,
      derivation: 'aggregated',
      quality: { direct: false, aggregator: 'pkmnprices', source: price.source || provider },
    };

    for (const [field, priceType] of Object.entries({ market_price: 'market', avg: 'average', average: 'average', low: 'low', low_price: 'low', high: 'high', high_price: 'high' })) {
      const amount = finiteAmount(price[field]);
      if (amount === null) continue;
      quotes.push({ ...baseQuote, priceType, amount, quality: { ...baseQuote.quality, field } });
    }
  }

  for (const point of Array.isArray(historyRows) ? historyRows : []) {
    const amount = finiteAmount(point.avg ?? point.average ?? point.market_price);
    const recordedAt = point.date ? new Date(`${point.date}T00:00:00Z`).toISOString() : null;
    if (amount === null || !recordedAt) continue;
    const provider = sourceProvider(point.source);
    history.push({
      provider,
      providerVariantId: [card.id, provider, point.condition || '', point.variant || ''].join(':'),
      currency: String(point.currency || sourceCurrency(point.source)).toUpperCase(),
      condition: point.condition || null,
      finish: finishFromVariant(point.variant),
      amount,
      recordedAt,
      granularity: 'day',
      quality: { aggregator: 'pkmnprices', saleCount: Number.isFinite(Number(point.sale_count)) ? Number(point.sale_count) : null },
    });
  }

  return {
    providerCardId: clientId || String(card.id || ''),
    providerCanonicalId: String(card.id || ''),
    externalIds: { pkmnprices: card.id || null, tcgplayer: card.tcg_player_id || null },
    name: card.name || '',
    setName: card.set?.name || '',
    collectorNumber: card.number || '',
    rarity: card.rarity || null,
    artist: card.artist || null,
    language: card.language || 'English',
    images: { small: card.image_url || null, large: card.image_url || null },
    quotes,
    history,
    historyStatus,
  };
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

export async function fetchPkmnPricesLookup(apiKey, lookup, signal) {
  let cardId = lookup.pkmnpricesId;
  if (!cardId) {
    const search = new URL(`${API_URL}/cards`);
    if (lookup.tcgplayerId) search.searchParams.set('tcg_player_id', lookup.tcgplayerId);
    else {
      search.searchParams.set('name', lookup.name);
      const number = String(lookup.number || '').split('/')[0].trim();
      if (number) search.searchParams.set('number', number);
    }
    search.searchParams.set('per_page', '10');
    const result = await request(search, apiKey, signal);
    cardId = selectCard(Array.isArray(result.data) ? result.data : [], lookup)?.id;
  }
  if (!cardId) return { card: null, history: [] };

  const cardUrl = new URL(`${API_URL}/cards/${encodeURIComponent(cardId)}`);
  cardUrl.searchParams.set('currency', 'usd');
  const card = await request(cardUrl, apiKey, signal);

  const historyUrl = new URL(`${API_URL}/cards/${encodeURIComponent(cardId)}/prices/history`);
  historyUrl.searchParams.set('currency', 'usd');
  historyUrl.searchParams.set('period', '90d');
  historyUrl.searchParams.set('limit', '90');
  let historyStatus = 'live';
  const historyResult = await request(historyUrl, apiKey, signal).catch(error => {
    if (error?.status === 403) { historyStatus = 'plan_required'; return { data: [] }; }
    if (error?.status === 404) { historyStatus = 'unavailable'; return { data: [] }; }
    throw error;
  });

  return { card, history: Array.isArray(historyResult.data) ? historyResult.data : [], historyStatus };
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
