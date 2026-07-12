const API_URL = 'https://api.justtcg.com/v1/cards';

function finiteAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function finiteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoFromUnix(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return new Date(parsed * 1000).toISOString();
}

export function normalizePrinting(value) {
  const printing = String(value || '').trim().toLowerCase();
  if (printing.includes('1st') && printing.includes('holo')) return '1stEditionHolofoil';
  if (printing.includes('1st')) return '1stEditionNormal';
  if (printing.includes('reverse')) return 'reverseHolofoil';
  if (printing.includes('holo') || printing.includes('foil')) return 'holofoil';
  if (printing.includes('shadowless')) return 'shadowless';
  return 'normal';
}

export function normalizeJustTcgCard(card, retrievedAt = new Date().toISOString(), clientId = null) {
  const quotes = [];
  const history = [];

  for (const variant of Array.isArray(card?.variants) ? card.variants : []) {
    const price = finiteAmount(variant.price);
    const variantId = String(variant.uuid || variant.id || '');
    const observedAt = isoFromUnix(variant.lastUpdated);
    const finish = normalizePrinting(variant.printing);
    const quality = {
      direct: true,
      providerVariantId: variantId,
      priceChange24h: finiteNumber(variant.priceChange24hr),
      priceChange7d: finiteNumber(variant.priceChange7d),
      priceChange30d: finiteNumber(variant.priceChange30d),
      average7d: finiteAmount(variant.avgPrice),
      average30d: finiteAmount(variant.avgPrice30d),
      min7d: finiteAmount(variant.minPrice7d),
      max7d: finiteAmount(variant.maxPrice7d),
    };

    if (price !== null) {
      quotes.push({
        provider: 'justtcg',
        providerProductId: String(card.uuid || card.id || ''),
        providerVariantId: variantId,
        currency: 'USD',
        region: 'US',
        condition: variant.condition || null,
        finish,
        printing: variant.printing || null,
        language: variant.language || 'English',
        gradingCompany: null,
        grade: null,
        priceType: 'market',
        amount: price,
        observedAt,
        retrievedAt,
        providerUrl: null,
        attribution: 'Market pricing via JustTCG',
        derivation: 'aggregated',
        quality,
      });
    }

    for (const point of Array.isArray(variant.priceHistory) ? variant.priceHistory : []) {
      const amount = finiteAmount(point?.p);
      const recordedAt = isoFromUnix(point?.t);
      if (amount === null || !recordedAt) continue;
      history.push({
        provider: 'justtcg', providerVariantId: variantId, currency: 'USD', condition: variant.condition || null,
        finish, amount, recordedAt, granularity: 'day',
      });
    }
  }

  return {
    providerCardId: clientId || String(card.uuid || card.id || ''),
    providerCanonicalId: String(card.uuid || card.id || ''),
    externalIds: { justtcg: card.uuid || card.id || null, tcgplayer: card.tcgplayerId || null },
    name: card.name || '',
    setName: card.set_name || card.set || '',
    collectorNumber: card.number || '',
    rarity: card.rarity || null,
    language: card.variants?.[0]?.language || 'English',
    images: { small: null, large: null },
    quotes,
    history,
  };
}

function comparable(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function selectMatch(cards, lookup) {
  const wantedName = comparable(lookup.name);
  const wantedSet = comparable(lookup.set);
  const wantedNumber = comparable(String(lookup.number || '').split('/')[0]);
  return [...cards].sort((left, right) => {
    const score = card => (comparable(card.name) === wantedName ? 8 : 0)
      + (comparable(card.set_name) === wantedSet ? 4 : 0)
      + (comparable(card.number) === wantedNumber ? 2 : 0);
    return score(right) - score(left);
  })[0] || null;
}

export async function fetchJustTcgLookup(apiKey, lookup, signal) {
  const url = new URL(API_URL);
  if (lookup.justtcgId) url.searchParams.set('cardId', lookup.justtcgId);
  else if (lookup.tcgplayerId) url.searchParams.set('tcgplayerId', lookup.tcgplayerId);
  else {
    url.searchParams.set('game', 'Pokemon');
    url.searchParams.set('q', lookup.name);
    const number = String(lookup.number || '').split('/')[0].trim();
    if (number) url.searchParams.set('number', number);
    url.searchParams.set('limit', '5');
  }
  url.searchParams.set('include_price_history', 'true');
  url.searchParams.set('priceHistoryDuration', '30d');
  url.searchParams.set('include_statistics', '7d,30d');

  const response = await fetch(url, { headers: { 'x-api-key': apiKey, Accept: 'application/json' }, signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('JustTCG request failed');
    error.status = response.status;
    error.retryAfter = response.headers.get('retry-after');
    throw error;
  }
  const cards = Array.isArray(payload.data) ? payload.data : [];
  return { card: lookup.justtcgId || lookup.tcgplayerId ? cards[0] || null : selectMatch(cards, lookup), metadata: payload._metadata || null };
}
