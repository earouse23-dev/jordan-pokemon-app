const API_URL = 'https://api.tcgdex.net/v2';

export function normalizeTcgdexCard(card, language) {
  const baseImage = card?.image || null;
  const variants = Object.entries(card?.variants || {}).filter(([, enabled]) => enabled).map(([name]) => name);
  return {
    id: `tcgdex:${language}:${card.id}`,
    externalIds: { tcgdex: card.id },
    name: card.name || '', set: card.set?.name || '', setId: card.set?.id || '', number: card.localId || '',
    rarity: card.rarity || null, artist: card.illustrator || null, language,
    release: card.set?.releaseDate?.slice?.(0, 4) || null, variants,
    image: baseImage ? `${baseImage}/high.png` : null, thumb: baseImage ? `${baseImage}/low.webp` : null,
  };
}

export async function searchTcgdexCards(query, language, limit, signal) {
  const search = new URL(`${API_URL}/${language}/cards`);
  search.searchParams.set('name', query);
  search.searchParams.set('pagination:page', '1');
  search.searchParams.set('pagination:itemsPerPage', String(limit));
  const response = await fetch(search, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error('TCGdex search failed');
  const briefs = await response.json();
  const details = await Promise.all((Array.isArray(briefs) ? briefs.slice(0, limit) : []).map(async brief => {
    const detail = await fetch(`${API_URL}/${language}/cards/${encodeURIComponent(brief.id)}`, { headers: { Accept: 'application/json' }, signal });
    return detail.ok ? detail.json() : brief;
  }));
  return details.map(card => normalizeTcgdexCard(card, language));
}
