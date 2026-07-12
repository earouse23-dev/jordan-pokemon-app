import { createClient } from 'npm:@supabase/supabase-js@2';

const TCGDEX_BASE = 'https://api.tcgdex.net/v2';
const LANGUAGES = new Set(['en', 'fr', 'es', 'de', 'it', 'pt', 'ja', 'zh-tw', 'id', 'th']);
const TCG_FIELDS: Record<string, string> = {
  lowPrice: 'low', midPrice: 'mid', highPrice: 'high', marketPrice: 'market', directLowPrice: 'low',
};
const CARDMARKET_FIELDS = new Set([
  'avg', 'low', 'trend', 'avg1', 'avg7', 'avg30',
  'avg-holo', 'low-holo', 'trend-holo', 'avg1-holo', 'avg7-holo', 'avg30-holo',
]);

type Card = {
  id: string; localId: string | number; name: string; rarity?: string; illustrator?: string;
  image?: string; set: { id: string; name: string }; variants?: Record<string, boolean>;
  pricing?: Record<string, Record<string, unknown>>;
};

type Quote = {
  provider: 'tcgplayer' | 'cardmarket'; externalId: string; currency: string; finish: string; edition: string;
  priceType: string; amount: number; observedAt: string; quality: Record<string, unknown>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function decodeRole(request: Request) {
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(encoded)).role || null;
  } catch { return null; }
}

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function finishAndEdition(value: string) {
  const key = value.toLowerCase();
  const edition = key.includes('1st') ? 'first_edition' : '';
  if (key.includes('reverse')) return { finish: 'reverseHolofoil', edition };
  if (key.includes('holo') || key.includes('foil')) return { finish: 'holofoil', edition };
  return { finish: 'normal', edition };
}

function quotesFor(card: Card): Quote[] {
  const quotes: Quote[] = [];
  const tcgplayer = card.pricing?.tcgplayer;
  if (tcgplayer) {
    const observedAt = String(tcgplayer.updated || '');
    for (const [variant, raw] of Object.entries(tcgplayer)) {
      if (variant === 'updated' || variant === 'unit' || !raw || typeof raw !== 'object') continue;
      const identity = finishAndEdition(variant);
      for (const [field, priceType] of Object.entries(TCG_FIELDS)) {
        const amount = positive((raw as Record<string, unknown>)[field]);
        if (!amount || !observedAt) continue;
        quotes.push({
          provider: 'tcgplayer', externalId: `tcgplayer:${card.id}:${variant}`, currency: String(tcgplayer.unit || 'USD'),
          ...identity, priceType, amount, observedAt,
          quality: { aggregator: 'tcgdex', field, direct: false, sourceFrequency: 'hourly-to-daily' },
        });
      }
    }
  }
  const cardmarket = card.pricing?.cardmarket;
  if (cardmarket) {
    const observedAt = String(cardmarket.updated || '');
    for (const [field, raw] of Object.entries(cardmarket)) {
      if (!CARDMARKET_FIELDS.has(field)) continue;
      const amount = positive(raw);
      if (!amount || !observedAt) continue;
      const holo = field.endsWith('-holo');
      const base = field.replace(/-holo$/, '');
      const windowDays = /^avg(1|7|30)$/.exec(base)?.[1];
      quotes.push({
        provider: 'cardmarket', externalId: `cardmarket:${card.id}:${holo ? 'holo' : 'normal'}`,
        currency: String(cardmarket.unit || 'EUR'), finish: holo ? 'holofoil' : 'normal', edition: '',
        priceType: base === 'trend' ? 'trend' : base === 'low' ? 'low' : 'average', amount, observedAt,
        quality: { aggregator: 'tcgdex', field, direct: false, windowDays: windowDays ? Number(windowDays) : null, sourceFrequency: 'daily' },
      });
    }
  }
  return quotes;
}

function variantsFor(card: Card, quotes: Quote[]) {
  const values = new Map<string, { finish: string; edition: string }>();
  const add = (finish: string, edition = '') => values.set(`${finish}|${edition}`, { finish, edition });
  if (card.variants?.normal) add('normal');
  if (card.variants?.holo) add('holofoil');
  if (card.variants?.reverse) add('reverseHolofoil');
  if (card.variants?.firstEdition) {
    if (card.variants?.holo) add('holofoil', 'first_edition');
    if (card.variants?.normal || !card.variants?.holo) add('normal', 'first_edition');
  }
  if (card.variants?.wPromo) add('normal', 'w_promo');
  for (const quote of quotes) add(quote.finish, quote.edition);
  if (!values.size) add('normal');
  return [...values.values()];
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'MicaCatalogSync/1.0' } });
  if (!response.ok) throw new Error(`TCGdex ${response.status}`);
  return response.json();
}

async function fetchDetails(language: string, briefs: Array<{ id: string }>, concurrency = 8) {
  const results: Card[] = [];
  for (let offset = 0; offset < briefs.length; offset += concurrency) {
    const chunk = briefs.slice(offset, offset + concurrency);
    results.push(...await Promise.all(chunk.map(brief =>
      fetchJson(`${TCGDEX_BASE}/${language}/cards/${encodeURIComponent(brief.id)}`) as Promise<Card>,
    )));
  }
  return results;
}

function assertResult(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (decodeRole(request) !== 'service_role') return json({ error: 'Service-role authorization required' }, 403);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Supabase runtime configuration is unavailable' }, 503);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const input = await request.json().catch(() => ({}));
  const language = String(input.language || 'en').toLowerCase();
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(input.pageSize) || 40)));
  if (!LANGUAGES.has(language)) return json({ error: 'Unsupported catalog language' }, 400);

  const { data: run, error: runError } = await supabase.from('catalog_sync_runs').insert({
    provider: 'tcgdex', status: 'running', cursor: JSON.stringify({ language, page }),
  }).select('id').single();
  if (runError || !run) return json({ error: 'Unable to create catalog sync run' }, 500);

  try {
    const listUrl = new URL(`${TCGDEX_BASE}/${language}/cards`);
    listUrl.searchParams.set('pagination:page', String(page));
    listUrl.searchParams.set('pagination:itemsPerPage', String(pageSize));
    const briefs = await fetchJson(listUrl.toString()) as Array<{ id: string }>;
    const cards = await fetchDetails(language, Array.isArray(briefs) ? briefs : []);
    const allQuotes = new Map<string, Quote[]>();
    for (const card of cards) allQuotes.set(card.id, quotesFor(card));

    const setRows = [...new Map(cards.map(card => [card.set.id, {
      name: card.set.name, canonical_key: `tcgdex:${language}:${card.set.id}`, language,
    }])).values()];
    const { data: sets, error: setError } = await supabase.from('card_sets').upsert(setRows, {
      onConflict: 'language,canonical_key', ignoreDuplicates: false,
    }).select('id,name,canonical_key');
    assertResult(setError, 'upsert sets');
    const setIdByExternal = new Map((sets || []).map(set => [String(set.canonical_key).split(':').at(-1), set.id]));

    const setExternalRows = cards.map(card => ({
      set_id: setIdByExternal.get(card.set.id), provider: 'tcgdex', external_id: `${language}:${card.set.id}`,
    })).filter(row => row.set_id);
    const { error: setExternalError } = await supabase.from('set_external_ids').upsert(setExternalRows, { onConflict: 'provider,external_id' });
    assertResult(setExternalError, 'upsert set IDs');

    const cardRows = cards.map(card => ({
      set_id: setIdByExternal.get(card.set.id), name: card.name, collector_number: String(card.localId),
      rarity: card.rarity || null, artist: card.illustrator || null, language,
    })).filter(row => row.set_id);
    const { data: storedCards, error: cardError } = await supabase.from('cards').upsert(cardRows, {
      onConflict: 'set_id,collector_number,language', ignoreDuplicates: false,
    }).select('id,set_id,collector_number,language');
    assertResult(cardError, 'upsert cards');
    const cardIdByIdentity = new Map((storedCards || []).map(card => [`${card.set_id}|${card.collector_number}|${card.language}`, card.id]));
    const internalCardId = (card: Card) => cardIdByIdentity.get(`${setIdByExternal.get(card.set.id)}|${String(card.localId)}|${language}`);

    const cardExternalRows = cards.map(card => ({
      card_id: internalCardId(card), provider: 'tcgdex', external_id: `${language}:${card.id}`,
    })).filter(row => row.card_id);
    const { error: externalError } = await supabase.from('card_external_ids').upsert(cardExternalRows, { onConflict: 'provider,external_id' });
    assertResult(externalError, 'upsert card IDs');

    const imageRows = cards.flatMap(card => card.image ? [
      { card_id: internalCardId(card), provider: 'tcgdex', size: 'small', url: `${card.image}/low.webp` },
      { card_id: internalCardId(card), provider: 'tcgdex', size: 'large', url: `${card.image}/high.png` },
    ] : []).filter(row => row.card_id);
    if (imageRows.length) {
      const { error } = await supabase.from('card_images').upsert(imageRows, { onConflict: 'card_id,provider,size' });
      assertResult(error, 'upsert images');
    }

    const variantRows = cards.flatMap(card => variantsFor(card, allQuotes.get(card.id) || []).map(variant => ({
      card_id: internalCardId(card), finish: variant.finish, edition: variant.edition, language,
    }))).filter(row => row.card_id);
    const { data: variants, error: variantError } = await supabase.from('card_variants').upsert(variantRows, {
      onConflict: 'card_id,finish,edition,language', ignoreDuplicates: false,
    }).select('id,card_id,finish,edition,language');
    assertResult(variantError, 'upsert variants');
    const variantIdByIdentity = new Map((variants || []).map(variant => [
      `${variant.card_id}|${variant.finish}|${variant.edition}|${variant.language}`, variant.id,
    ]));

    const { data: sources, error: sourceError } = await supabase.from('price_sources').upsert([
      { provider: 'tcgplayer', attribution: 'TCGplayer market pricing via TCGdex', terms_url: 'https://tcgdex.dev/markets-prices', status: 'active', capabilities: { currentPrices: true, gradedPrices: false } },
      { provider: 'cardmarket', attribution: 'Cardmarket pricing via TCGdex', terms_url: 'https://tcgdex.dev/markets-prices', status: 'active', capabilities: { currentPrices: true, gradedPrices: false } },
    ], { onConflict: 'provider' }).select('id,provider');
    assertResult(sourceError, 'upsert price sources');
    const sourceId = new Map((sources || []).map(source => [source.provider, source.id]));

    const productRows = cards.flatMap(card => (allQuotes.get(card.id) || []).map(quote => {
      const cardId = internalCardId(card);
      return {
        source_id: sourceId.get(quote.provider),
        variant_id: variantIdByIdentity.get(`${cardId}|${quote.finish}|${quote.edition}|${language}`),
        external_id: `${language}:${quote.externalId}`, condition: 'Unspecified', grading_company: '', grade: 0, currency: quote.currency,
      };
    })).filter(row => row.source_id && row.variant_id);
    const uniqueProducts = [...new Map(productRows.map(row => [`${row.source_id}|${row.external_id}|${row.currency}`, row])).values()];
    let products: Array<Record<string, unknown>> = [];
    if (uniqueProducts.length) {
      const { data, error } = await supabase.from('price_products').upsert(uniqueProducts, {
        onConflict: 'source_id,external_id,condition,grading_company,grade', ignoreDuplicates: false,
      }).select('id,source_id,external_id,currency');
      assertResult(error, 'upsert price products'); products = data || [];
    }
    const productId = new Map(products.map(product => [`${product.source_id}|${product.external_id}|${product.currency}`, product.id]));

    const snapshots = cards.flatMap(card => (allQuotes.get(card.id) || []).map(quote => ({
      product_id: productId.get(`${sourceId.get(quote.provider)}|${language}:${quote.externalId}|${quote.currency}`),
      price_type: quote.priceType, amount: quote.amount, observed_at: quote.observedAt, retrieved_at: new Date().toISOString(),
      provider_url: null, quality: quote.quality,
    }))).filter(row => row.product_id);
    if (snapshots.length) {
      const { error } = await supabase.from('price_snapshots').upsert(snapshots, {
        onConflict: 'product_id,price_type,observed_at,amount', ignoreDuplicates: true,
      });
      assertResult(error, 'upsert price snapshots');
    }

    const { count: catalogCount } = await supabase.from('cards').select('id', { count: 'exact', head: true }).eq('language', language);
    await supabase.from('catalog_coverage_snapshots').insert({
      provider: 'tcgdex', language, entity_type: 'cards', expected_count: null,
      imported_count: catalogCount || 0, mapped_price_count: new Set(snapshots.map(row => row.product_id)).size,
    });
    const nextPage = cards.length === pageSize ? page + 1 : null;
    await supabase.from('catalog_sync_runs').update({
      status: 'completed', cursor: nextPage ? JSON.stringify({ language, page: nextPage }) : null,
      records_processed: cards.length, finished_at: new Date().toISOString(),
    }).eq('id', run.id);
    return json({ runId: run.id, language, page, processed: cards.length, quoteSnapshots: snapshots.length, nextPage, hasMore: nextPage !== null });
  } catch (error) {
    await supabase.from('catalog_sync_runs').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', run.id);
    console.error('[sync-catalog]', error instanceof Error ? error.message : 'Unknown error');
    return json({ error: 'Catalog sync failed', runId: run.id }, 502);
  }
});
