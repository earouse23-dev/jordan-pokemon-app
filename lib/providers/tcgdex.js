const API_URL = 'https://api.tcgdex.net/v2';
const PRICE_FIELDS = { lowPrice: 'low', midPrice: 'mid', highPrice: 'high', marketPrice: 'market', directLowPrice: 'low' };
const CARDMARKET_FIELDS = new Set(['avg', 'low', 'trend', 'avg1', 'avg7', 'avg30', 'avg-holo', 'low-holo', 'trend-holo', 'avg1-holo', 'avg7-holo', 'avg30-holo']);

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function comparable(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function finishFromPricingKey(value) {
  const key = String(value || '').toLowerCase();
  if (key.includes('1st') && (key.includes('holo') || key.includes('foil'))) return '1stEditionHolofoil';
  if (key.includes('1st')) return '1stEditionNormal';
  if (key.includes('reverse')) return 'reverseHolofoil';
  if (key.includes('unlimited') && (key.includes('holo') || key.includes('foil'))) return 'holofoil';
  if (key.includes('holo') || key.includes('foil')) return 'holofoil';
  return 'normal';
}

function imageUrls(card) {
  const base = card?.image || null;
  return { small: base ? `${base}/low.webp` : null, large: base ? `${base}/high.png` : null };
}

export function normalizeTcgdexCard(card, language) {
  const variants = Object.entries(card?.variants || {}).filter(([, enabled]) => enabled).map(([name]) => name);
  const images = imageUrls(card);
  return {
    id: `tcgdex:${language}:${card.id}`,
    externalIds: { tcgdex: card.id },
    name: card.name || '', set: card.set?.name || '', setId: card.set?.id || '', number: card.localId || '',
    rarity: card.rarity || null, artist: card.illustrator || null, language,
    release: card.set?.releaseDate?.slice?.(0, 4) || null, variants,
    image: images.large, thumb: images.small,
  };
}

export function normalizeTcgdexPricingCard(card, retrievedAt = new Date().toISOString(), clientId = null, language = 'en') {
  const quotes = [];
  const tcgplayer = card?.pricing?.tcgplayer;
  if (tcgplayer && typeof tcgplayer === 'object') {
    for (const [variantName, prices] of Object.entries(tcgplayer)) {
      if (variantName === 'updated' || variantName === 'unit' || !prices || typeof prices !== 'object') continue;
      const finish = finishFromPricingKey(variantName);
      for (const [field, priceType] of Object.entries(PRICE_FIELDS)) {
        const value = amount(prices[field]);
        if (value === null) continue;
        quotes.push({
          provider: 'tcgplayer', providerProductId: String(card.id), providerVariantId: `${card.id}:${variantName}`,
          currency: tcgplayer.unit || 'USD', region: 'US', condition: null, finish, printing: variantName,
          language, gradingCompany: null, grade: null, priceType, amount: value,
          observedAt: tcgplayer.updated || null, retrievedAt, providerUrl: null,
          attribution: 'TCGplayer market pricing via TCGdex', derivation: 'aggregated',
          quality: { direct: false, aggregator: 'tcgdex', field, sourceFrequency: 'hourly-to-daily' },
        });
      }
    }
  }

  const cardmarket = card?.pricing?.cardmarket;
  if (cardmarket && typeof cardmarket === 'object') {
    for (const [field, rawValue] of Object.entries(cardmarket)) {
      if (!CARDMARKET_FIELDS.has(field)) continue;
      const value = amount(rawValue);
      if (value === null) continue;
      const holo = field.endsWith('-holo');
      const baseField = field.replace(/-holo$/, '');
      const windowDays = /^avg(1|7|30)$/.exec(baseField)?.[1] || null;
      const priceType = baseField === 'trend' ? 'trend' : baseField === 'low' ? 'low' : 'average';
      quotes.push({
        provider: 'cardmarket', providerProductId: String(card.id), providerVariantId: `${card.id}:${holo ? 'holo' : 'normal'}`,
        currency: cardmarket.unit || 'EUR', region: 'EU', condition: null, finish: holo ? 'holofoil' : 'normal',
        printing: holo ? 'holo' : 'normal', language, gradingCompany: null, grade: null, priceType, amount: value,
        observedAt: cardmarket.updated || null, retrievedAt, providerUrl: null,
        attribution: 'Cardmarket pricing via TCGdex', derivation: 'aggregated',
        quality: { direct: false, aggregator: 'tcgdex', field, windowDays: windowDays ? Number(windowDays) : null, sourceFrequency: 'daily' },
      });
    }
  }

  return {
    providerCardId: clientId || `tcgdex:${language}:${card.id}`, providerCanonicalId: String(card.id),
    externalIds: { tcgdex: card.id }, name: card.name || '', setName: card.set?.name || '',
    collectorNumber: card.localId || '', rarity: card.rarity || null, artist: card.illustrator || null,
    language, images: imageUrls(card), quotes, history: [],
  };
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  return response.ok ? response.json() : null;
}

function selectRawMatch(cards, lookup) {
  const wantedName = comparable(lookup.name);
  const wantedSet = comparable(lookup.set);
  const wantedNumber = comparable(String(lookup.number || '').split('/')[0]);
  return [...cards].sort((left, right) => {
    const score = card => (comparable(card.name) === wantedName ? 8 : 0)
      + (comparable(card.set?.name) === wantedSet ? 4 : 0)
      + (comparable(card.localId) === wantedNumber ? 2 : 0);
    return score(right) - score(left);
  })[0] || null;
}

function externalIdFromLookup(lookup, language) {
  if (lookup.tcgdexId) return lookup.tcgdexId;
  const prefix = `tcgdex:${language}:`;
  if (String(lookup.clientId).startsWith(prefix)) return String(lookup.clientId).slice(prefix.length);
  if (/^[A-Za-z0-9.-]+-[A-Za-z0-9.-]+$/.test(lookup.clientId)) return lookup.clientId;
  return null;
}

export async function fetchTcgdexPricingLookup(lookup, signal, language = 'en') {
  const externalId = externalIdFromLookup(lookup, language);
  if (externalId) {
    const direct = await fetchJson(`${API_URL}/${language}/cards/${encodeURIComponent(externalId)}`, signal);
    if (direct?.id) return direct;
  }
  const search = new URL(`${API_URL}/${language}/cards`);
  search.searchParams.set('name', lookup.name);
  const number = String(lookup.number || '').split('/')[0].trim();
  if (number) search.searchParams.set('localId', number);
  search.searchParams.set('pagination:page', '1');
  search.searchParams.set('pagination:itemsPerPage', '12');
  const briefs = await fetchJson(search, signal);
  const details = await Promise.all((Array.isArray(briefs) ? briefs : []).slice(0, 12).map(brief =>
    fetchJson(`${API_URL}/${language}/cards/${encodeURIComponent(brief.id)}`, signal),
  ));
  return selectRawMatch(details.filter(Boolean), lookup);
}

export async function searchTcgdexCards(query, language, limit, signal) {
  const search = new URL(`${API_URL}/${language}/cards`);
  search.searchParams.set('name', query);
  search.searchParams.set('pagination:page', '1');
  search.searchParams.set('pagination:itemsPerPage', String(limit));
  const briefs = await fetchJson(search, signal);
  if (!Array.isArray(briefs)) throw new Error('TCGdex search failed');
  const details = await Promise.all(briefs.slice(0, limit).map(brief =>
    fetchJson(`${API_URL}/${language}/cards/${encodeURIComponent(brief.id)}`, signal),
  ));
  return details.filter(Boolean).map(card => normalizeTcgdexCard(card, language));
}
