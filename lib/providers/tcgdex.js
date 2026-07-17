const API_URL = 'https://api.tcgdex.net/v2';
const PRICE_FIELDS = { lowPrice: 'low', midPrice: 'mid', highPrice: 'high', marketPrice: 'market', directLowPrice: 'low' };
const CARDMARKET_FIELDS = new Set(['avg', 'low', 'trend', 'avg1', 'avg7', 'avg30', 'avg-holo', 'low-holo', 'trend-holo', 'avg1-holo', 'avg7-holo', 'avg30-holo']);
const SET_ALIASES = [
  ['crown zenith galarian gallery', 'Crown Zenith: Galarian Gallery'],
  ['galarian gallery', 'Crown Zenith: Galarian Gallery'],
  ['twilight masquerade', 'Twilight Masquerade'],
  ['evolving skies', 'Evolving Skies'],
  ['crown zenith', 'Crown Zenith'],
  ['base set', 'Base Set'],
  ['pokemon 151', '151'],
  ['scarlet violet 151', '151'],
  ['sv 151', '151'],
  ['151', '151'],
];
const SEARCH_HINTS = [
  [/\b(?:special illustration rare|sir)\b/gi, 'Special illustration rare'],
  [/\b(?:illustration rare|ir)\b/gi, 'Illustration rare'],
  [/\bfull[ -]?art\b/gi, 'Full art'],
  [/\breverse(?: holo)?\b/gi, 'Reverse holo'],
  [/\b(?:holo|holofoil)\b/gi, 'Holo'],
  [/\bpromo(?:tional)?\b/gi, 'Promo'],
  [/\b1st[ -]?edition\b/gi, 'First edition'],
  [/\bshadowless\b/gi, 'Shadowless'],
];

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function comparable(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function words(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function collectorPart(value) {
  const match = /^([a-z]*)(\d+)([a-z]*)$/i.exec(String(value || '').trim());
  return match ? `${match[1].toUpperCase()}${Number(match[2])}${match[3].toUpperCase()}` : String(value || '').toUpperCase();
}

function fullCollectorNumber(card) {
  const total = card?.set?.cardCount?.official;
  return total ? `${card.localId}/${total}` : String(card?.localId || '');
}

export function parseCatalogQuery(query) {
  const original = String(query || '').trim();
  let remainder = original;
  const hints = [];
  const providerId = /^[A-Za-z0-9.]+-[A-Za-z0-9]+$/.test(original) && !original.includes('/') ? original : null;
  if (providerId) return { original, name:'', localId:'', total:'', setName:'', setCode:'', providerId, hints };

  const numberMatch = /\b([A-Za-z]{0,3}\d{1,4}[A-Za-z]?)\s*\/\s*([A-Za-z]{0,3}\d{1,4}[A-Za-z]?)\b/i.exec(remainder);
  const explicitNumber = /(?:#|\bno\.?\s*)([A-Za-z]{0,3}\d{1,4}[A-Za-z]?)\b/i.exec(remainder);
  const localId = collectorPart(numberMatch?.[1] || explicitNumber?.[1] || '');
  const total = collectorPart(numberMatch?.[2] || '');
  if (numberMatch) remainder = remainder.replace(numberMatch[0], ' ');
  else if (explicitNumber) remainder = remainder.replace(explicitNumber[0], ' ');

  let setName = '';
  const normalizedRemainder = words(remainder);
  for (const [alias, canonical] of SET_ALIASES) {
    const aliasWords = words(alias);
    const pattern = new RegExp(`(^|\\s)${aliasWords.replace(/\s+/g, '\\s+')}($|\\s)`, 'i');
    if (!pattern.test(normalizedRemainder)) continue;
    setName = canonical;
    remainder = remainder.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
    break;
  }

  let setCode = '';
  const setCodeMatch = /\b(?:set\s+)?([a-z]{1,8}\d{1,3}(?:\.\d+)?)\b/i.exec(remainder);
  if (setCodeMatch) {
    setCode = setCodeMatch[1];
    remainder = remainder.replace(setCodeMatch[0], ' ');
  }

  for (const [pattern, label] of SEARCH_HINTS) {
    pattern.lastIndex = 0;
    if (pattern.test(remainder)) hints.push(label);
    pattern.lastIndex = 0;
    remainder = remainder.replace(pattern, ' ');
  }

  const name = remainder.replace(/\s+/g, ' ').trim();
  return { original, name, localId, total, setName, setCode, providerId:null, hints };
}

function rankTcgdexCard(card, parsed, language) {
  let score = 0;
  const reasons = [];
  const cardName = words(card.name);
  const wantedName = words(parsed.name);
  const cardSet = words(card.set?.name);
  const wantedSet = words(parsed.setName);
  const cardLocal = collectorPart(card.localId);
  const officialTotal = collectorPart(card.set?.cardCount?.official);
  const exactChecks = [];

  if (wantedName) {
    exactChecks.push(cardName === wantedName);
    if (cardName === wantedName) { score += 130; reasons.push('exact name'); }
    else if (cardName.startsWith(wantedName)) { score += 90; reasons.push('name starts with search'); }
    else {
      const tokens = wantedName.split(' ').filter(Boolean);
      const matched = tokens.filter(token => cardName.includes(token)).length;
      score += matched * 22;
      if (matched === tokens.length) reasons.push('all name terms');
    }
  }
  if (parsed.localId) exactChecks.push(cardLocal === collectorPart(parsed.localId));
  if (parsed.localId && cardLocal === collectorPart(parsed.localId)) { score += 125; reasons.push('exact collector number'); }
  if (parsed.total) exactChecks.push(officialTotal === collectorPart(parsed.total));
  if (parsed.total && officialTotal === collectorPart(parsed.total)) { score += 105; reasons.push('exact set number'); }
  if (wantedSet) exactChecks.push(cardSet === wantedSet);
  if (wantedSet && cardSet === wantedSet) { score += 115; reasons.push('exact set'); }
  else if (wantedSet && cardSet.includes(wantedSet)) { score += 70; reasons.push('matching set'); }
  if (parsed.setCode) exactChecks.push(comparable(card.set?.id) === comparable(parsed.setCode));
  if (parsed.setCode && comparable(card.set?.id) === comparable(parsed.setCode)) { score += 115; reasons.push('exact set code'); }
  if (parsed.providerId) exactChecks.push(card.id === parsed.providerId);
  if (parsed.providerId && card.id === parsed.providerId) { score += 400; reasons.push('exact provider ID'); }
  const hintText = words([card.rarity, ...Object.entries(card.variants || {}).filter(([, enabled]) => enabled).map(([key]) => key)].join(' '));
  for (const hint of parsed.hints) {
    const hintWords = words(hint);
    if (hintWords.split(' ').every(token => hintText.includes(token) || (token === 'first' && hintText.includes('firstedition')))) {
      score += 18;
      reasons.push(hint.toLowerCase());
    }
  }
  if (card.image) score += 3;
  if (language) score += 2;
  const allExplicitDetailsMatch = exactChecks.length > 0 && exactChecks.every(Boolean);
  return { score, reasons, confidence: allExplicitDetailsMatch ? 'Exact match' : score >= 130 ? 'Strong match' : 'Possible match' };
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
    name: card.name || '', set: card.set?.name || '', setId: card.set?.id || '', number: fullCollectorNumber(card), localId: card.localId || '',
    rarity: card.rarity || null, artist: card.illustrator || null, language,
    release: card.set?.releaseDate?.slice?.(0, 4) || null, variants,
    image: images.large, thumb: images.small,
  };
}

export async function fetchTcgdexSet(setId, language = 'en', signal) {
  const set=await fetchJson(`${API_URL}/${language}/sets/${encodeURIComponent(setId)}`,signal);
  if(!set?.id||!Array.isArray(set.cards))return null;
  const total=Number(set.cardCount?.total)||set.cards.length;
  const official=Number(set.cardCount?.official)||null;
  return {
    id:set.id,
    name:set.name||set.id,
    language,
    release:set.releaseDate||null,
    officialCount:official,
    totalCount:total,
    logo:set.logo?`${set.logo}.webp`:null,
    cards:set.cards.map(card=>({
      id:`tcgdex:${language}:${card.id}`,
      externalIds:{tcgdex:card.id},
      name:card.name||'Unknown card',
      set:set.name||set.id,
      setId:set.id,
      localId:String(card.localId||''),
      number:official?`${card.localId}/${official}`:String(card.localId||''),
      language,
      thumb:card.image?`${card.image}/low.webp`:null,
      image:card.image?`${card.image}/high.png`:null,
    })),
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
  const parsed = parseCatalogQuery(query);
  if (parsed.providerId) {
    const card = await fetchJson(`${API_URL}/${language}/cards/${encodeURIComponent(parsed.providerId)}`, signal);
    if (!card?.id) return [];
    const ranked = rankTcgdexCard(card, parsed, language);
    return [{ ...normalizeTcgdexCard(card, language), match:ranked }];
  }

  const queryShapes = [];
  const addShape = shape => {
    const entries = Object.entries(shape).filter(([, value]) => value);
    if (!entries.length) return;
    const key = JSON.stringify(entries);
    if (!queryShapes.some(candidate => candidate.key === key)) queryShapes.push({ key, entries });
  };
  const exact = {
    name:parsed.name, localId:parsed.localId, 'set.name':parsed.setName,
    'set.id':parsed.setCode, 'set.cardCount.official':parsed.total,
  };
  addShape(exact);
  addShape({ name:parsed.name, localId:parsed.localId });
  addShape({ name:parsed.name, 'set.name':parsed.setName, 'set.id':parsed.setCode });
  addShape({ localId:parsed.localId, 'set.cardCount.official':parsed.total });
  addShape({ name:parsed.name });
  addShape({ localId:parsed.localId });
  addShape({ 'set.name':parsed.setName, 'set.id':parsed.setCode });

  const searches = queryShapes.map(({ entries }) => {
    const url = new URL(`${API_URL}/${language}/cards`);
    for (const [key, value] of entries) url.searchParams.set(key, value);
    url.searchParams.set('pagination:page', '1');
    url.searchParams.set('pagination:itemsPerPage', '60');
    return url;
  });
  const pages = await Promise.all(searches.map(url => fetchJson(url, signal)));
  if (!pages.some(Array.isArray)) throw new Error('TCGdex search failed');
  const briefs = new Map();
  for (const page of pages) for (const brief of Array.isArray(page) ? page : []) if (brief?.id && !briefs.has(brief.id)) briefs.set(brief.id, brief);
  const candidateLimit = Math.max(48, limit * 4);
  const details = await Promise.all([...briefs.values()].slice(0, candidateLimit).map(brief =>
    fetchJson(`${API_URL}/${language}/cards/${encodeURIComponent(brief.id)}`, signal),
  ));
  return details.filter(Boolean).map(card => {
    const match = rankTcgdexCard(card, parsed, language);
    return { ...normalizeTcgdexCard(card, language), match };
  }).sort((left, right) => right.match.score - left.match.score || Number(Boolean(right.image)) - Number(Boolean(left.image)) || left.name.localeCompare(right.name)).slice(0, limit);
}
