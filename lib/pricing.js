const TCG_PRICE_TYPES = ['market', 'low', 'mid', 'high', 'directLow'];
const CARDMARKET_PRICE_TYPES = {
  trendPrice: 'trend',
  lowPrice: 'low',
  averageSellPrice: 'average',
  avg1: 'average',
  avg7: 'average',
  avg30: 'average',
  reverseHoloTrend: 'trend',
  reverseHoloLow: 'low',
  reverseHoloSell: 'average',
  reverseHoloAvg1: 'average',
  reverseHoloAvg7: 'average',
  reverseHoloAvg30: 'average',
};

function amount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function observedAt(value) {
  return value ? String(value).replaceAll('/', '-') : null;
}

export function finishForVariant(variant) {
  const value = String(variant || '').toLowerCase();
  if (value.includes('1st edition') && value.includes('holo')) return '1stEditionHolofoil';
  if (value.includes('1st edition')) return '1stEditionNormal';
  if (value.includes('reverse')) return 'reverseHolofoil';
  if (value.includes('holo')) return 'holofoil';
  return 'normal';
}

export function normalizeCard(card, retrievedAt = new Date().toISOString()) {
  const quotes = [];
  for (const [finish, prices] of Object.entries(card?.tcgplayer?.prices || {})) {
    for (const priceType of TCG_PRICE_TYPES) {
      const value = amount(prices?.[priceType]);
      if (value === null) continue;
      quotes.push({
        provider: 'tcgplayer',
        providerProductId: card.id,
        currency: 'USD',
        region: 'US',
        condition: null,
        finish,
        gradingCompany: null,
        grade: null,
        priceType: priceType === 'directLow' ? 'low' : priceType,
        amount: value,
        observedAt: observedAt(card.tcgplayer.updatedAt),
        retrievedAt,
        providerUrl: card.tcgplayer.url || null,
        attribution: 'TCGplayer pricing via Pokémon TCG API',
        quality: { direct: true, field: priceType },
      });
    }
  }

  for (const [field, priceType] of Object.entries(CARDMARKET_PRICE_TYPES)) {
    const value = amount(card?.cardmarket?.prices?.[field]);
    if (value === null) continue;
    const windowDays = /^.*Avg(1|7|30)$/.exec(field)?.[1] || /^avg(1|7|30)$/.exec(field)?.[1] || null;
    quotes.push({
      provider: 'cardmarket',
      providerProductId: card.id,
      currency: 'EUR',
      region: 'EU',
      condition: field === 'lowPriceExPlus' ? 'EX+' : null,
      finish: field.startsWith('reverseHolo') ? 'reverseHolofoil' : 'normal',
      gradingCompany: null,
      grade: null,
      priceType,
      amount: value,
      observedAt: observedAt(card.cardmarket.updatedAt),
      retrievedAt,
      providerUrl: card.cardmarket.url || null,
      attribution: 'Cardmarket pricing via Pokémon TCG API',
      quality: { direct: true, field, windowDays: windowDays ? Number(windowDays) : null },
    });
  }

  return {
    providerCardId: card.id,
    name: card.name,
    setName: card.set?.name || '',
    collectorNumber: card.number || '',
    rarity: card.rarity || null,
    artist: card.artist || null,
    releaseDate: card.set?.releaseDate || null,
    images: { small: card.images?.small || null, large: card.images?.large || null },
    quotes,
  };
}

export function selectReferenceQuote(quotes, variant, currency = 'USD') {
  const finish = finishForVariant(variant);
  const compatible = (quotes || []).filter(quote => quote.currency === currency && quote.finish === finish);
  for (const provider of ['justtcg', 'tcgplayer']) {
    const fromProvider = compatible.filter(quote => quote.provider === provider);
    for (const priceType of ['market', 'mid', 'low']) {
      const nearMint = fromProvider.find(candidate => candidate.priceType === priceType && candidate.condition === 'Near Mint');
      if (nearMint) return nearMint;
      const quote = fromProvider.find(candidate => candidate.priceType === priceType);
      if (quote) return quote;
    }
  }
  return null;
}

export function selectCardmarketReference(quotes, variant) {
  const requestedFinish = finishForVariant(variant) === 'reverseHolofoil' ? 'reverseHolofoil' : 'normal';
  const compatible = (quotes || []).filter(quote =>
    quote.provider === 'cardmarket' && quote.currency === 'EUR' && quote.finish === requestedFinish,
  );
  return compatible.find(quote => quote.priceType === 'trend')
    || compatible.find(quote => quote.priceType === 'average')
    || compatible.find(quote => quote.priceType === 'low')
    || null;
}
