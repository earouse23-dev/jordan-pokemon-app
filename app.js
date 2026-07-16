import { money, calculateTotals, collectionToCsv, parseCollectionCsv, isStale, matchesSearch } from './lib/core.js';
import { finishForVariant, mergePriceHistory, selectCardmarketReference, selectReferenceQuote } from './lib/pricing.js';

const STORAGE_KEY = 'mica.collection.v1';
const PRICE_HISTORY_KEY = 'mica.price-history.v1';
const DEMO_DATE = '2026-07-08';
let storageIssue = false;
let catalog = [
  { id:'sv3pt5-199', name:'Charizard ex', set:'151', number:'199/165', rarity:'Special Illustration Rare', variant:'Holofoil', image:'https://images.pokemontcg.io/sv3pt5/199_hires.png', thumb:'https://images.pokemontcg.io/sv3pt5/199.png', price:184.25, move:4.8, artist:'miki kudo', release:'2023' },
  { id:'swsh7-215', name:'Umbreon VMAX', set:'Evolving Skies', number:'215/203', rarity:'Alternate Art Secret', variant:'Holofoil', image:'https://images.pokemontcg.io/swsh7/215_hires.png', thumb:'https://images.pokemontcg.io/swsh7/215.png', price:1218.40, move:2.7, artist:'KEIICHIRO ITO', release:'2021' },
  { id:'base1-4', name:'Charizard', set:'Base Set', number:'4/102', rarity:'Rare Holo', variant:'Unlimited Holofoil', image:'https://images.pokemontcg.io/base1/4_hires.png', thumb:'https://images.pokemontcg.io/base1/4.png', price:386.91, move:-1.4, artist:'Mitsuhiro Arita', release:'1999' },
  { id:'swsh12pt5gg-GG44', name:'Mewtwo VSTAR', set:'Crown Zenith: Galarian Gallery', number:'GG44/GG70', rarity:'Rare Holo VSTAR', variant:'Holofoil', image:'https://images.pokemontcg.io/swsh12pt5gg/GG44_hires.png', thumb:'https://images.pokemontcg.io/swsh12pt5gg/GG44.png', price:129.62, move:7.2, artist:'GOSSAN', release:'2023' },
  { id:'sv3pt5-151', name:'Mew ex', set:'151', number:'151/165', rarity:'Double Rare', variant:'Holofoil', image:'https://images.pokemontcg.io/sv3pt5/151_hires.png', thumb:'https://images.pokemontcg.io/sv3pt5/151.png', price:18.74, move:.6, artist:'5ban Graphics', release:'2023' },
  { id:'neo4-17', name:'Espeon', set:'Neo Discovery', number:'1/75', rarity:'Rare Holo', variant:'Unlimited Holofoil', image:'https://images.pokemontcg.io/neo2/1_hires.png', thumb:'https://images.pokemontcg.io/neo2/1.png', price:null, move:null, artist:'Ken Sugimori', release:'2001' },
  { id:'sv6-211', name:'Greninja ex', set:'Twilight Masquerade', number:'214/167', rarity:'Special Illustration Rare', variant:'Holofoil', image:'https://images.pokemontcg.io/sv6/214_hires.png', thumb:'https://images.pokemontcg.io/sv6/214.png', price:298.13, move:10.4, artist:'Teeziro', release:'2024' },
  { id:'sm115-28', name:'Pikachu', set:'Detective Pikachu', number:'10/18', rarity:'Common', variant:'Holofoil', image:'https://images.pokemontcg.io/sm115/10_hires.png', thumb:'https://images.pokemontcg.io/sm115/10.png', price:3.12, move:-.2, artist:'MPC Film', release:'2019' }
];

const seedItems = [
  { ...catalog[1], uid:'copy-umbreon', quantity:2, condition:'Near Mint', gradingCompany:'', grade:'', cost:670, purchaseDate:'2024-02-11', tags:['Favorites'], location:'Toploader case · A2', notes:'One clean copy, one with light edge wear.' },
  { ...catalog[0], uid:'copy-charizard151', quantity:1, condition:'Graded', gradingCompany:'PSA', grade:'10', cost:142, purchaseDate:'2024-01-18', tags:['Graded'], location:'Slab case · 01', notes:'' },
  { ...catalog[2], uid:'copy-charizardbase', quantity:1, condition:'Lightly Played', gradingCompany:'', grade:'', cost:210, purchaseDate:'2022-09-06', tags:['Vintage'], location:'Binder 01 · Page 2', notes:'Small whitening at lower-right edge.' },
  { ...catalog[3], uid:'copy-mewtwo', quantity:2, condition:'Near Mint', gradingCompany:'', grade:'', cost:76, purchaseDate:'2023-06-12', tags:['Gallery'], location:'Binder 02 · Page 8', notes:'' },
  { ...catalog[4], uid:'copy-mew', quantity:3, condition:'Near Mint', gradingCompany:'', grade:'', cost:12.25, purchaseDate:'2024-05-03', tags:['151'], location:'Binder 02 · Page 3', notes:'' },
  { ...catalog[5], uid:'copy-espeon', quantity:1, condition:'Moderately Played', gradingCompany:'', grade:'', cost:58, purchaseDate:'2021-11-20', tags:['Needs pricing'], location:'Binder 01 · Page 9', notes:'Pricing unavailable for selected printing and condition.' }
];

const state = { items:loadItems(), route:'collection', ledgerView:'all', query:'', sort:'value-desc', setFilter:'', conditionFilter:'', detailId:null, detailCard:null, detailReturnRoute:'scan', detailCanPop:false, lastFocus:null, sheetHistory:false, pricingStatus:'demo', pricingRetrievedAt:null, storageStatus:storageIssue?'error':'local' };
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const languageName = code => ({en:'English',ja:'Japanese',fr:'French',de:'German',es:'Spanish',it:'Italian',pt:'Portuguese','zh-tw':'Traditional Chinese',id:'Indonesian',th:'Thai'})[String(code || '').toLowerCase()] || String(code || 'English');
const optionalNumber = value => String(value ?? '').trim()==='' ? null : Number(value);
const normalizeIdentity = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');

function loadItems() {
  try { const raw=localStorage.getItem(STORAGE_KEY); if (raw===null) return structuredClone(seedItems); const stored=JSON.parse(raw); if (Array.isArray(stored)) return stored; storageIssue=true; } catch { storageIssue=true; }
  return structuredClone(seedItems);
}
function saveItems() {
  const persisted = state.items.map(({ quotes, priceHistory, historyStatus, sales, salesStatus, pricingStatus, pricingUpdatedAt, demoPrice, ...item }) => ({
    ...item,
    price: demoPrice ?? item.price,
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    state.storageStatus='local';
    return true;
  } catch {
    state.storageStatus='error';
    return false;
  }
}

function historyKey(item) {
  return [item.id, item.variant, item.condition, item.gradingCompany, item.grade].map(value => String(value || '')).join('|');
}

function recordPriceObservation(item, quote, providerHistory = []) {
  let journal = {};
  try { journal = JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY)) || {}; } catch {}
  const key = historyKey(item);
  const observation = quote ? {
    provider:quote.provider, providerVariantId:quote.providerVariantId || quote.providerProductId,
    currency:quote.currency, condition:quote.condition, finish:quote.finish, amount:quote.amount,
    recordedAt:quote.observedAt || quote.retrievedAt, granularity:'observation',
  } : null;
  const localHistory = mergePriceHistory(journal[key] || [], observation ? [observation] : []).slice(-400);
  journal[key] = localHistory;
  try { localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(journal)); } catch {}
  return mergePriceHistory(providerHistory, localHistory);
}
function itemValue(item) { return item.price == null ? null : Number(item.price) * Number(item.quantity || 0); }

function priceStatusText(item) {
  if (item.price == null) return 'Pricing unavailable';
  if (item.pricingStatus === 'live') return `Updated ${item.pricingUpdatedAt || 'recently'}`;
  if (item.pricingStatus === 'stale') return `Stale · observed ${item.pricingUpdatedAt || 'date unknown'}`;
  return 'Preview fixture';
}

function quoteStatus(quote) {
  if (!quote) return 'unavailable';
  return isStale(quote.observedAt || quote.retrievedAt) ? 'stale' : 'live';
}

function renderQuoteRow(quote, label) {
  if (!quote) return '';
  const source = quote.providerUrl
    ? `<a href="${esc(quote.providerUrl)}" target="_blank" rel="noreferrer">${esc(label)}</a>`
    : `<strong>${esc(label)}</strong>`;
  return `<div class="price-source"><div>${source}<span>${esc(quote.priceType)} · ${esc(quote.finish)} · ${esc(quote.condition || 'Condition-neutral')} · ${esc(quote.currency)}</span><span>Observed ${esc(quote.observedAt || 'date unavailable')} · retrieved ${esc(quote.retrievedAt?.slice?.(0,10) || 'date unavailable')}</span></div><div class="source-value"><b>${money(quote.amount, quote.currency)}</b><small>${esc(quote.attribution)}</small></div></div>`;
}

function historyForItem(item) {
  if (item.gradingCompany) return [];
  const finish = finishForVariant(item.variant);
  const exact = (item.priceHistory || []).filter(point => point.finish === finish && point.condition === item.condition);
  return (exact.length ? exact : (item.priceHistory || []).filter(point => point.finish === finish))
    .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt));
}

function renderHistory(item) {
  const history = historyForItem(item);
  if (item.historyStatus === 'plan_required' && history.length < 2) return `<div class="unavailable-panel"><strong>Price history is plan-limited.</strong><br>The connected PkmnPrices key can return current prices, but historical observations require a higher provider plan. Mica does not invent a trend.</div>`;
  if (history.length < 2) return `<div class="unavailable-panel">Not enough comparable observations exist for a price chart yet. Daily source data is never expanded into artificial minute-by-minute points.</div>`;
  const values = history.map(point => point.amount);
  const min = Math.min(...values); const max = Math.max(...values); const spread = max - min || 1;
  const points = history.map((point, index) => `${(index / (history.length - 1)) * 100},${38 - ((point.amount - min) / spread) * 34}`).join(' ');
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const first = history[0]; const last = history.at(-1);
  return `<div class="history-summary"><div><span>Observed average</span><strong>${money(average, last.currency)}</strong></div><div><span>Observed range</span><strong>${money(min, last.currency)}–${money(max, last.currency)}</strong></div><div><span>Samples</span><strong>${history.length} observations</strong></div></div>
    <svg class="price-chart" viewBox="0 0 100 42" role="img" aria-label="Price history from ${esc(first.recordedAt.slice(0,10))} to ${esc(last.recordedAt.slice(0,10))}"><path d="M0 40H100"/><polyline points="${points}"/></svg>
    <div class="chart-dates"><span>${esc(first.recordedAt.slice(0,10))}</span><span>${esc(last.recordedAt.slice(0,10))}</span></div>`;
}

function comparableSales(item) {
  return (item.sales || []).filter(sale => item.gradingCompany
    ? sale.sourceUrl && sale.gradingCompany === item.gradingCompany && String(sale.grade) === String(item.grade)
    : sale.sourceUrl && !sale.gradingCompany);
}

function renderSales(item) {
  if (item.salesStatus === 'loading') return `<div class="unavailable-panel">Loading licensed sold-listing evidence…</div>`;
  const sales = comparableSales(item);
  if (!sales.length) {
    const copy = item.salesStatus === 'unconfigured'
      ? 'No licensed sold-listing provider is connected. Active listings are not presented as completed sales.'
      : item.salesStatus === 'plan_required'
        ? 'The connected PkmnPrices key is valid, but linked sold evidence requires a Pro or higher plan.'
        : item.salesStatus === 'error'
          ? 'The sold-data provider could not be reached. This is not evidence that the card has no sales.'
          : 'No verified sales matched this exact raw/graded context. A broader card sale is not substituted.';
    return `<div class="unavailable-panel">${copy}${item.salesStatus==='error'?'<br><button class="inline-retry" id="retrySalesButton" type="button">Try sales again</button>':''}</div>`;
  }
  return `<div class="sales-list">${sales.slice(0,5).map(sale => `<a class="sale-row" href="${esc(sale.sourceUrl)}" target="_blank" rel="noreferrer"><div><strong>${esc(sale.title)}</strong><span>${esc(sale.soldAt)} · ${esc(sale.gradingCompany ? `${sale.gradingCompany} ${sale.grade}` : 'Raw')}</span></div><b>${money(sale.amount, sale.currency)}</b></a>`).join('')}</div>`;
}

async function loadSales(item, force=false) {
  if (item.salesStatus && !force) return;
  item.salesStatus = 'loading';
  if (state.route === 'detail' && (state.detailId === item.uid || state.detailId === item.id)) renderDetail();
  const lookup = { clientId:item.id, pkmnpricesId:item.externalIds?.pkmnprices || '', name:item.name, set:item.set, number:item.number };
  try {
    const response = await fetch(`/api/sales?lookup=${encodeURIComponent(JSON.stringify(lookup))}`, { headers:{ Accept:'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 503) { item.salesStatus = 'unconfigured'; item.sales = []; }
    else if (response.status === 403 && payload.code === 'provider_plan_required') { item.salesStatus = 'plan_required'; item.sales = []; }
    else if (!response.ok) { item.salesStatus = 'error'; item.sales = []; }
    else { item.salesStatus = 'live'; item.sales = payload.sales || []; }
  } catch { item.salesStatus = 'error'; item.sales = []; }
  if (state.route === 'detail' && (state.detailId === item.uid || state.detailId === item.id)) renderDetail();
}

function routeTo(route, options={}) {
  const changed = state.route !== route;
  state.route = route;
  $$('.view').forEach(view => {
    const active = view.id === `view-${route}`;
    view.classList.toggle('active', active);
    view.hidden = !active;
    view.setAttribute('aria-hidden', String(!active));
  });
  $$('.nav-item').forEach(button => {
    const active = button.dataset.route === route;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('.bottom-nav').classList.toggle('hidden', route === 'detail');
  if (route === 'detail') renderDetail();
  window.scrollTo({top:0, behavior: options.instant ? 'auto' : 'smooth'});
  if (changed && options.focus !== false) requestAnimationFrame(()=>$('#main').focus({preventScroll:true}));
  const url = route === 'collection' ? `${location.pathname}${location.search}` : `#${route}`;
  const historyMode = options.history || (options.instant ? 'replace' : 'push');
  if (historyMode === 'push' && changed) history.pushState({route}, '', url);
  else if (historyMode === 'replace') history.replaceState({route}, '', url);
}

function renderCollection() {
  const totals = calculateTotals(state.items);
  const gain = totals.comparableValue - totals.comparableCost;
  $('#portfolioValue').textContent = money(totals.value);
  $('#costBasis').textContent = totals.costKnown ? money(totals.cost) : '—';
  $('#unrealized').textContent = totals.gainCoverage ? `${gain >= 0 ? '+' : ''}${money(gain)}` : '—';
  $('#gainLabel').textContent = totals.gainCoverage === totals.quantity ? 'Gain / loss' : 'Known gain / loss';
  $('#ownedCount').textContent = `${totals.quantity} card${totals.quantity === 1 ? '' : 's'}`;
  const partial = totals.unpriced ? ` · ${totals.unpriced} unpriced card${totals.unpriced === 1 ? '' : 's'} excluded` : '';
  const costCoverage = totals.unknownCost ? ` · ${totals.unknownCost} missing purchase cost` : '';
  const hasProviderPricing = ['live','partial'].includes(state.pricingStatus);
  $('#portfolioChange').textContent = hasProviderPricing ? `Current matching provider snapshots${partial}${costCoverage}` : `Preview pricing${partial}${costCoverage}`;
  $('#valuationNote').firstChild.textContent = totals.gainCoverage === totals.quantity ? 'Based on matching market prices. ' : `Gain/loss uses ${totals.gainCoverage} of ${totals.quantity} copies with both price and cost. `;
  $('#allCount').textContent = state.items.length;
  const pricedCount = state.items.filter(item=>item.price!=null).length;
  const pricingLabel = state.pricingStatus === 'loading' ? 'Updating live prices…'
    : state.pricingStatus === 'live' ? `${pricedCount} of ${state.items.length} live prices`
    : state.pricingStatus === 'partial' ? `${pricedCount} live · ${state.items.length-pricedCount} need review`
    : state.pricingStatus === 'error' ? 'Provider unavailable · preview prices'
    : `${pricedCount} of ${state.items.length} preview prices`;
  $('.status-label').innerHTML = `<i></i> ${pricingLabel}`;
  const syncLabels = {
    loading:'Prices updating', live:'Prices current', partial:'Partial prices', error:'Local only', demo:'Preview data',
  };
  const syncLabel = state.storageStatus==='error' ? 'Session only' : syncLabels[state.pricingStatus] || 'Local only';
  $('#syncState span:last-child').textContent = syncLabel;
  $('#syncState').setAttribute('aria-label', state.storageStatus==='error' ? 'Session only. Device storage is unavailable, so changes may be lost when this page closes.' : `${syncLabel}. Collection changes are saved on this device.`);
  let visible = state.items.filter(item => matchesSearch(item, state.query));
  if (state.ledgerView === 'favorites') visible = visible.filter(item => (item.tags||[]).some(tag=>String(tag).toLowerCase()==='favorites'));
  if (state.ledgerView === 'graded') visible = visible.filter(item => item.gradingCompany || item.grade);
  if (state.ledgerView === 'unpriced') visible = visible.filter(item => item.price == null);
  if (state.setFilter) visible = visible.filter(item => item.set === state.setFilter);
  if (state.conditionFilter === 'Raw') visible = visible.filter(item => !item.gradingCompany && item.condition !== 'Graded');
  else if (state.conditionFilter === 'Graded') visible = visible.filter(item => item.gradingCompany || item.condition === 'Graded');
  else if (state.conditionFilter) visible = visible.filter(item => item.condition === state.conditionFilter);
  visible.sort((a,b) => state.sort === 'value-desc' ? (itemValue(b) ?? -1) - (itemValue(a) ?? -1) : a.name.localeCompare(b.name));
  $('#resultCount').textContent = `${visible.length} card${visible.length === 1 ? '' : 's'}`;
  $('#sortButton').firstChild.textContent = state.sort === 'value-desc' ? 'Value, high to low ' : 'Name, A to Z ';
  $('#cardLedger').innerHTML = visible.map(item => {
    const total = itemValue(item);
    const moveClass = item.move == null ? 'none' : item.move >= 0 ? 'up' : 'down';
    const hasMovement = Number.isFinite(Number(item.move));
    const movementLabel = item.pricingStatus === 'live' || item.price == null || !hasMovement
      ? priceStatusText(item)
      : `${item.move >= 0 ? '↑' : '↓'} ${Math.abs(item.move).toFixed(1)}% preview`;
    const tags = [item.gradingCompany ? `${item.gradingCompany} ${item.grade}` : item.condition, ...(item.tags || []).slice(0,1)];
    return `<article class="ledger-row" tabindex="0" role="button" aria-label="Open ${esc(item.name)}, ${total == null ? 'price unavailable' : money(total)}" data-id="${esc(item.uid)}">
      <img class="card-thumb" src="${esc(item.thumb)}" alt="${esc(item.name)} from ${esc(item.set)}" loading="lazy">
      <div class="card-main"><div class="card-name-line"><span class="card-name">${esc(item.name)}</span><span class="quantity">×${Number(item.quantity)||0}</span></div><span class="card-set">${esc(item.set)} · ${esc(item.number)}</span><div class="card-tags">${tags.map((tag,i)=>`<span class="micro-tag ${i===0&&item.gradingCompany?'graded':''} ${item.price==null?'warn':''}">${esc(tag)}</span>`).join('')}</div></div>
      <div class="price-cell"><span class="row-value">${total == null ? '—' : money(total)}</span><span class="row-unit">${item.price == null ? 'pricing unavailable' : `${money(item.price)} each`}</span><span class="row-move ${moveClass}">${esc(movementLabel)}</span></div>
    </article>`;
  }).join('');
  $('#collectionEmpty').classList.toggle('hidden', visible.length > 0);
  const trulyEmpty=state.items.length===0;
  $('#collectionEmptyTitle').textContent=trulyEmpty?'Your library is empty':'No cards match this view';
  $('#collectionEmptyCopy').textContent=trulyEmpty?'Search or photograph a card to add your first owned copy.':'Try clearing the search or changing your filters.';
  $('#emptyAddCard').classList.toggle('hidden',!trulyEmpty);
  $('#clearFilters').classList.toggle('hidden',trulyEmpty);
  const activeFilterCount=(state.ledgerView!=='all'?1:0)+(state.setFilter?1:0)+(state.conditionFilter?1:0);
  $('#filterLabel').textContent=activeFilterCount?`Filter · ${activeFilterCount}`:'Filter';
  $$('.ledger-row').forEach(row => {
    const open = () => openCardDetail(state.items.find(item => item.uid === row.dataset.id), true);
    row.addEventListener('click', open); row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
}

function openCardDetail(card, preferOwned=false) {
  if (!card) return;
  const owned = preferOwned ? card : state.items.find(item => item.id === card.id);
  if (state.route !== 'detail') state.detailReturnRoute = state.route;
  state.detailCanPop = state.route !== 'detail';
  state.detailId = owned?.uid || card.id;
  state.detailCard = owned || card;
  routeTo('detail');
  if (!owned && !card.quotes?.length) void loadCardPreviewPricing(card);
}

async function loadCardPreviewPricing(card) {
  const lookup = [{ clientId:card.id, pkmnpricesId:card.externalIds?.pkmnprices || '', tcgdexId:card.externalIds?.tcgdex || '', name:card.name, set:card.set, number:card.number }];
  try {
    const response = await fetch(`/api/cards?lookups=${encodeURIComponent(JSON.stringify(lookup))}`, { headers:{Accept:'application/json'} });
    if (!response.ok) {
      if (state.detailId !== card.id) return;
      state.detailCard={...card,price:null,pricingStatus:response.status===429?'rate_limited':'error'};
      renderDetail();
      return;
    }
    const payload = await response.json();
    const priced = payload.cards?.[0];
    if (!priced || state.detailId !== card.id) return;
    const quote = selectReferenceQuote(priced.quotes, card.variant, 'USD', { condition:'Near Mint' });
    const updated = { ...card, externalIds:{...(card.externalIds||{}),...(priced.externalIds||{})}, price:quote?.amount ?? null, quotes:priced.quotes || [], priceHistory:priced.history || [], historyStatus:priced.historyStatus || null, pricingStatus:quote?quoteStatus(quote):'unavailable', pricingUpdatedAt:quote?.observedAt || quote?.retrievedAt?.slice(0,10) || null };
    catalog = catalog.map(item => item.id === card.id ? updated : item);
    state.detailCard = updated;
    renderDetail();
  } catch {
    if (state.detailId !== card.id) return;
    state.detailCard = { ...card, price:null, pricingStatus:'error' };
    renderDetail();
  }
}

function renderOwnedDetailLegacy() {
  const item = state.items.find(candidate => candidate.uid === state.detailId);
  if (!item) return routeTo('collection');
  const total = itemValue(item);
  const tcgQuote = selectReferenceQuote(item.quotes, item.variant, 'USD', item);
  const cardmarketQuote = selectCardmarketReference(item.quotes, item.variant);
  const sourceRows = item.price == null ? `<div class="unavailable-panel"><strong>Pricing unavailable for this printing.</strong><br>The collection record is preserved and excluded from estimated totals. Mica will not substitute a different variant or condition.</div>`
    : item.pricingStatus === 'live'
      ? `${renderQuoteRow(tcgQuote, tcgQuote?.provider === 'justtcg' ? 'JustTCG market estimate' : 'TCGplayer reference')}${renderQuoteRow(cardmarketQuote, 'Cardmarket reference')}`
      : `<div class="price-source"><div><strong>Preview reference</strong><span>Fixture · ${esc(item.variant)} · USD</span><span>Live provider refresh has not completed.</span></div><div class="source-value"><b>${money(item.price)}</b><small>Clearly labeled demo data</small></div></div>`;
  $('#detailContent').innerHTML = `<button class="detail-back" id="detailBack" type="button"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>Collection</button>
    <div class="detail-identity"><img src="${esc(item.image)}" alt="${esc(item.name)} from ${esc(item.set)}"><div><p class="eyebrow">${esc(item.rarity)}</p><h1 id="detailTitle">${esc(item.name)}</h1><p class="detail-set">${esc(item.set)} · ${esc(item.number)}</p><div class="detail-meta"><div><span>Printing</span><strong>${esc(item.variant)}</strong></div><div><span>Language</span><strong>English</strong></div><div><span>Released</span><strong>${esc(item.release)}</strong></div><div><span>Artist</span><strong>${esc(item.artist)}</strong></div></div></div></div>
    <div class="owned-banner"><div><span>Your position</span><strong>${item.quantity} owned · ${total==null?'Unpriced':money(total)}</strong></div><button id="editCopyButton" type="button">Edit record</button></div>
    <section class="detail-section"><div class="detail-section-head"><h2>Market references</h2><span>${item.price==null?'No supported quote':item.pricingStatus==='live'?'Live provider data':'Preview data · not live'}</span></div>${sourceRows}<p class="legal-copy">These values are market references, not guaranteed value or an appraisal. Condition and venue can materially affect realized price.</p></section>
    <section class="detail-section"><div class="detail-section-head"><h2>Owned copy</h2><span>${esc(item.location)}</span></div><div class="copy-row"><div><strong>${item.gradingCompany ? `${esc(item.gradingCompany)} ${esc(item.grade)}` : esc(item.condition)}</strong><span>Purchased ${esc(item.purchaseDate || 'date not recorded')} · ${money(item.cost)} each</span></div><b>×${item.quantity}</b></div>${item.notes?`<div class="unavailable-panel">${esc(item.notes)}</div>`:''}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Price history</h2><span>Provider observations · no synthetic ticks</span></div>${renderHistory(item)}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Recent sold evidence</h2><span>${item.salesStatus === 'live' ? 'Linked completed sales' : 'Licensed source required'}</span></div>${renderSales(item)}</section>`;
  $('#detailBack').addEventListener('click', () => routeTo('collection'));
  $('#editCopyButton').addEventListener('click', () => openOwnershipSheet(item, true));
  void loadSales(item);
}

function renderDetail() {
  const owned = state.items.find(candidate => candidate.uid === state.detailId) || null;
  const item = owned || state.detailCard || catalog.find(candidate => candidate.id === state.detailId);
  if (!item) return routeTo('scan');
  const conditionContext = owned || { condition:'Near Mint', gradingCompany:'', grade:'' };
  const tcgQuote = selectReferenceQuote(item.quotes, item.variant, 'USD', conditionContext);
  const cardmarketQuote = selectCardmarketReference(item.quotes, item.variant);
  const pricingStatus = item.pricingStatus || (state.pricingStatus === 'error' ? 'error' : item.price != null ? 'preview' : 'loading');
  const livePrice = ['live','stale'].includes(pricingStatus) ? tcgQuote?.amount ?? null : null;
  const previewPrice = ['preview','error'].includes(pricingStatus) ? item.demoPrice ?? item.price ?? null : null;
  const displayPrice = livePrice ?? previewPrice;
  const marketLabel = pricingStatus === 'live' ? 'Current market'
    : pricingStatus === 'stale' ? 'Stale market reference'
      : previewPrice != null ? 'Preview fixture' : 'Current market';
  const statusCopy = pricingStatus === 'live' ? `Updated ${esc(item.pricingUpdatedAt || 'recently')}`
    : pricingStatus === 'stale' ? `Last observed ${esc(item.pricingUpdatedAt || 'date unknown')} · refresh needed`
      : pricingStatus === 'preview' ? 'Demo data · not a live quote'
        : pricingStatus === 'error' ? 'Provider refresh failed · preview only'
          : pricingStatus === 'rate_limited' ? 'Provider rate limit reached · retry shortly'
          : pricingStatus === 'unavailable' ? 'No exact-printing quote available' : 'Checking this exact printing';
  const sourceRows = ['live','stale'].includes(pricingStatus)
    ? `${renderQuoteRow(tcgQuote, tcgQuote?.provider === 'justtcg' ? 'JustTCG market' : 'TCGplayer market')}${renderQuoteRow(cardmarketQuote, 'Cardmarket')}`
    : pricingStatus === 'preview' || (pricingStatus === 'error' && previewPrice != null)
      ? `<div class="price-source"><div><strong>Preview fixture</strong><span>${esc(item.variant || 'Printing unknown')} · USD</span><span>${pricingStatus === 'error' ? 'The live provider could not be reached.' : 'Live refresh has not completed.'}</span></div><div class="source-value"><b>${money(previewPrice)}</b><small>Demo data · not live</small></div></div>`
      : `<div class="unavailable-panel">${pricingStatus === 'unavailable' ? 'No matching market price is available for this printing, finish, and condition yet. Mica did not substitute another card.' : pricingStatus === 'rate_limited' ? 'The pricing provider asked Mica to slow down. No value is being guessed.' : pricingStatus === 'error' ? 'The pricing provider could not be reached. No value is being guessed.' : 'Loading the latest matching market price…'}${['error','rate_limited'].includes(pricingStatus)?'<br><button class="inline-retry" id="retryPricingButton" type="button">Try pricing again</button>':''}</div>`;
  const backLabel = state.detailReturnRoute === 'collection' ? 'My library' : 'Find cards';
  const ownedSection = owned ? `<section class="detail-section"><div class="detail-section-head"><h2>Your copy</h2><span>${esc(item.location || 'Location not set')}</span></div><div class="copy-row"><div><strong>${item.gradingCompany ? `${esc(item.gradingCompany)} ${esc(item.grade)}` : esc(item.condition)}</strong><span>${item.purchaseDate ? `Bought ${esc(item.purchaseDate)}` : 'Purchase date not added'}${item.cost!==null&&item.cost!==undefined ? ` · ${money(item.cost)} each` : ' · Cost not recorded'}</span></div><b>×${item.quantity}</b></div>${item.notes?`<div class="unavailable-panel">${esc(item.notes)}</div>`:''}<button class="record-remove" id="removeCopyButton" type="button">Remove this owned record</button></section>` : '';
  const favorite=owned&&(item.tags||[]).some(tag=>String(tag).toLowerCase()==='favorites');
  const action = owned
    ? `<div class="owned-banner"><div><span>In your library</span><strong>${item.quantity} owned · ${displayPrice==null?'Price unavailable':`${money(displayPrice)} each`}</strong></div><div class="owned-actions"><button id="favoriteCopyButton" type="button" aria-pressed="${String(favorite)}">${favorite?'Favorited':'Favorite'}</button><button id="duplicateCopyButton" type="button">Add copy</button><button id="editCopyButton" type="button">Edit</button></div></div>`
    : `<div class="detail-sticky-action"><button id="addLibraryButton" type="button">Add to Library</button></div>`;
  const matchDetails = !owned && item.match?.reasons?.length ? `<section class="match-explanation" aria-label="Why this card matched"><strong>${esc(item.match.confidence || 'Possible match')}</strong><span>${esc(item.match.reasons.join(' · '))}</span><small>TCGdex ID ${esc(item.externalIds?.tcgdex || item.id)}</small></section>` : '';
  $('#detailContent').innerHTML = `<button class="detail-back" id="detailBack" type="button"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>${backLabel}</button>
    <div class="detail-identity"><img src="${esc(item.image || item.thumb)}" alt="${esc(item.name)} from ${esc(item.set)}"><div><p class="eyebrow">${esc(item.rarity || 'Pokémon card')}</p><h1 id="detailTitle">${esc(item.name)}</h1><p class="detail-set">${esc(item.set)} · ${esc(item.number)}</p><div class="detail-meta"><div><span>Printing</span><strong>${esc(item.variant || 'Unknown')}</strong></div><div><span>Language</span><strong>${esc(languageName(item.language))}</strong></div><div><span>Released</span><strong>${esc(item.release || '—')}</strong></div><div><span>Artist</span><strong>${esc(item.artist || '—')}</strong></div></div></div></div>
    ${matchDetails}
    <section class="market-hero" role="status"><span>${marketLabel}</span><strong>${displayPrice == null ? pricingStatus === 'loading' ? 'Checking…' : 'Price unavailable' : money(displayPrice)}</strong><small>${statusCopy}</small></section>
    ${action}
    <section class="detail-section"><div class="detail-section-head"><h2>Market prices</h2><span>Matching printing only</span></div>${sourceRows}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Price trend</h2><span>Real observations</span></div>${renderHistory(item)}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Recent sales</h2><span>${item.salesStatus === 'live' ? 'Completed listings' : 'Verified links when available'}</span></div>${renderSales(item)}</section>
    ${ownedSection}
    <p class="legal-copy">Prices are market references, not guaranteed sale values. Condition can materially change what a card is worth.</p>`;
  $('#detailBack').addEventListener('click', () => state.detailCanPop ? history.back() : routeTo(state.detailReturnRoute || (owned ? 'collection' : 'scan')));
  $('#editCopyButton')?.addEventListener('click', () => openOwnershipSheet(item, true));
  $('#duplicateCopyButton')?.addEventListener('click', () => openQuickAddSheet(item));
  $('#addLibraryButton')?.addEventListener('click', () => openQuickAddSheet(item));
  $('#favoriteCopyButton')?.addEventListener('click', () => toggleFavorite(item));
  $('#removeCopyButton')?.addEventListener('click', () => openDeleteCopySheet(item));
  $('#retryPricingButton')?.addEventListener('click',()=>{if(owned)void refreshLivePricing();else{state.detailCard={...item,pricingStatus:'loading',price:null};renderDetail();void loadCardPreviewPricing(item);}});
  $('#retrySalesButton')?.addEventListener('click',()=>void loadSales(item,true));
  void loadSales(item);
}

function openQuickAddSheet(card) {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Add to Library</h2><p>${esc(card.name)} · ${esc(card.set)} ${esc(card.number)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="quickAddForm"><div class="quick-add-fields"><div class="field"><label for="quickQuantity">How many?</label><input id="quickQuantity" name="quantity" type="number" min="1" max="999" value="1" required></div><div class="field"><label for="quickCondition">Condition</label><select id="quickCondition" name="condition"><option>Near Mint</option><option>Lightly Played</option><option>Moderately Played</option><option>Heavily Played</option><option>Damaged</option></select></div></div><details class="optional-details"><summary>Add purchase or storage details</summary><div class="form-grid"><div class="field"><label for="quickCost">What you paid · each</label><input id="quickCost" name="cost" type="number" min="0" step=".01" placeholder="Optional"></div><div class="field"><label for="quickLocation">Where you keep it</label><input id="quickLocation" name="location" placeholder="Binder, case, box…"></div></div></details><div class="sheet-actions"><button class="secondary" type="button" id="quickAddCancel">Not now</button><button class="primary" type="submit">Add to Library</button></div></form>`);
  $('#quickAddCancel').addEventListener('click', closeSheet);
  $('#quickAddForm').addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const added = { ...card, uid:`copy-${card.id}-${Date.now()}`, quantity:Number(data.get('quantity'))||1, condition:String(data.get('condition')), gradingCompany:'', grade:'', cost:optionalNumber(data.get('cost')), purchaseDate:'', tags:[], location:String(data.get('location')||''), notes:'' };
    state.items.unshift(added); const saved=saveItems(); closeSheet(); renderCollection(); state.detailId=added.uid; state.detailCard=added; renderDetail(); toast(saved?'Added to your library':'Added for this session · device storage unavailable');
  });
}

function toggleFavorite(item) {
  const tags=[...(item.tags||[])];
  const index=tags.findIndex(tag=>String(tag).toLowerCase()==='favorites');
  if(index===-1)tags.push('Favorites');else tags.splice(index,1);
  state.items=state.items.map(candidate=>candidate.uid===item.uid?{...candidate,tags}:candidate);
  const updated=state.items.find(candidate=>candidate.uid===item.uid);
  state.detailCard=updated;
  const saved=saveItems();renderCollection();renderDetail();toast(saved?(index===-1?'Added to favorites':'Removed from favorites'):'Changed for this session · device storage unavailable');
}

function openDeleteCopySheet(item) {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Remove owned record?</h2><p>${esc(item.name)} · ${esc(item.set)} ${esc(item.number)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="warning-panel"><strong>This removes your quantity, purchase, storage, and notes for this record.</strong><p>Your other copies and catalog search results are not affected.</p></div><div class="sheet-actions"><button class="secondary" id="keepCopyButton" type="button">Keep record</button><button class="danger-action" id="confirmRemoveCopy" type="button">Remove record</button></div>`);
  $('#keepCopyButton').addEventListener('click',closeSheet);
  $('#confirmRemoveCopy').addEventListener('click',()=>{state.items=state.items.filter(candidate=>candidate.uid!==item.uid);const saved=saveItems();closeSheet({discardHistory:true});state.detailId=null;state.detailCard=null;state.detailCanPop=false;routeTo('collection');renderCollection();toast(saved?'Owned record removed':'Removed for this session · device storage unavailable');});
}

function openSheet(content, trigger=document.activeElement) {
  const wasOpen = !$('#bottomSheet').hidden;
  if (!wasOpen) state.lastFocus = trigger;
  if (!wasOpen && trigger?.setAttribute) trigger.setAttribute('aria-expanded','true');
  $('#sheetContent').innerHTML = content;
  $('#sheetBackdrop').hidden = false; $('#bottomSheet').hidden = false;
  $('#appShell').inert = true;
  $('#appShell').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => $('.sheet-close, input, button', $('#sheetContent'))?.focus());
  $$('.sheet-close').forEach(button => button.addEventListener('click', closeSheet));
  if (!wasOpen) {
    history.pushState({route:state.route, sheet:true}, '', location.href);
    state.sheetHistory = true;
  }
}
function closeSheet(options={}) {
  $('#sheetBackdrop').hidden = true; $('#bottomSheet').hidden = true; document.body.style.overflow = '';
  $('#appShell').inert = false;
  $('#appShell').removeAttribute('aria-hidden');
  state.lastFocus?.setAttribute?.('aria-expanded','false');
  state.lastFocus?.focus?.();
  const shouldPop = state.sheetHistory && !options.fromHistory && !options.discardHistory;
  if (state.sheetHistory && options.discardHistory) history.replaceState({route:state.route}, '', state.route === 'collection' ? `${location.pathname}${location.search}` : `#${state.route}`);
  state.sheetHistory = false;
  if (shouldPop) history.back();
}

function handleDialogKeydown(event) {
  if ($('#bottomSheet').hidden) return;
  if (event.key === 'Escape') { closeSheet(); return; }
  if (event.key !== 'Tab') return;
  const focusable = $$('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]', $('#bottomSheet')).filter(node => node.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function openFilterSheet() {
  const sets=[...new Set(state.items.map(item=>item.set).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Filter & sort</h2><p>Choose which cards you want to see.</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <div class="field"><label for="sheetView">Show</label><select id="sheetView"><option value="all">All cards</option><option value="favorites">Favorites only</option><option value="graded">Graded only</option><option value="unpriced">Needs pricing review</option></select></div>
    <div class="field"><label for="sheetSet">Set</label><select id="sheetSet"><option value="">Every set</option>${sets.map(set=>`<option value="${esc(set)}">${esc(set)}</option>`).join('')}</select></div>
    <div class="field"><label for="sheetCondition">Condition</label><select id="sheetCondition"><option value="">Every condition</option><option>Raw</option><option>Graded</option>${['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged'].map(value=>`<option>${value}</option>`).join('')}</select></div>
    <div class="field"><label for="sheetSort">Sort by</label><select id="sheetSort"><option value="value-desc">Value, high to low</option><option value="name">Name, A to Z</option></select></div>
    <div class="sheet-actions"><button class="secondary" id="resetSheet">Reset</button><button class="primary" id="applySheet">Apply filters</button></div>`);
  $('#sheetView').value=state.ledgerView; $('#sheetSet').value=state.setFilter; $('#sheetCondition').value=state.conditionFilter; $('#sheetSort').value=state.sort;
  $('#resetSheet').addEventListener('click', () => { state.ledgerView='all';state.setFilter='';state.conditionFilter='';state.sort='value-desc';state.query='';$('#collectionSearch').value='';closeSheet();syncTabs();renderCollection(); });
  $('#applySheet').addEventListener('click', () => { state.ledgerView=$('#sheetView').value;state.setFilter=$('#sheetSet').value;state.conditionFilter=$('#sheetCondition').value;state.sort=$('#sheetSort').value;closeSheet();syncTabs();renderCollection();toast('Collection view updated'); });
}

function openMethodSheet() {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">How your value is calculated</h2><p>Simple and transparent.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy"><p><strong>Collection value</strong> is each card's matching market price multiplied by how many you own.</p><p><strong>Known gain/loss</strong> uses only copies that have both a matching market price and a recorded purchase cost. A blank cost is unknown, never treated as free.</p><p>Raw and graded cards are kept separate. We also match the printing and condition whenever the source supports it.</p><p>Cards without a reliable matching price stay in your library but are not counted in the total.</p></div>`);
}

function showProcessing(file) {
  const url = URL.createObjectURL(file);
  $('#capturePreview').innerHTML = `<img src="${url}" alt="Selected card photograph">`;
  let loadedImages=0; const releaseUrl=()=>{loadedImages+=1;if(loadedImages===2)URL.revokeObjectURL(url);};
  $('#capturePreview img').addEventListener('load',releaseUrl,{once:true});
  $('#qualityChip').innerHTML = '<span></span> Photo ready';
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Photo ready</h2><p>Use the visible card details to find the exact printing.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="photo-assist"><img id="photoAssistImage" src="${url}" alt="Selected card photograph"><p><strong>Mica will not guess from this image.</strong> Automated image recognition is not connected in this build. Search the name, set, or collector number and confirm the matching card.</p></div><div class="sheet-actions"><button class="secondary" id="photoAssistCancel" type="button">Choose another</button><button class="primary" id="photoAssistSearch" type="button">Search card details</button></div>`);
  $('#photoAssistImage').addEventListener('load',releaseUrl,{once:true});
  $('#photoAssistCancel').addEventListener('click',closeSheet);
  $('#photoAssistSearch').addEventListener('click',()=>{closeSheet();routeTo('scan');setTimeout(()=>$('#quickCardSearch').focus(),0);toast('Enter the name, set, or number shown on the card');});
}

function catalogItem(item) {
  return {
    ...item,
    variant:item.variants?.includes('holo') ? 'Holofoil'
      : item.variants?.includes('normal') ? 'Normal'
        : item.variants?.includes('reverse') ? 'Reverse Holofoil' : item.variants?.[0] || 'Unknown',
    price:null, move:null, cost:null, quantity:1, condition:'Near Mint', gradingCompany:'', grade:'', tags:[], location:'', notes:'', pricingStatus:'loading',
  };
}

function rememberCatalogItems(items) {
  for (const item of items) {
    const index = catalog.findIndex(existing => existing.id === item.id);
    if (index === -1) catalog.push(item); else catalog[index] = { ...catalog[index], ...item };
  }
}

async function searchCatalog(query, language, limit=12) {
  const response = await fetch(`/api/catalog?q=${encodeURIComponent(query)}&language=${encodeURIComponent(language)}&limit=${limit}`, { headers:{Accept:'application/json'} });
  if (!response.ok) throw new Error('catalog');
  const payload = await response.json();
  const items = (payload.cards || []).map(catalogItem);
  rememberCatalogItems(items);
  return { items, parsedQuery:payload.parsedQuery || null };
}

function matchReason(item) {
  if (!item.match?.reasons?.length) return '';
  return `<small class="match-reason"><strong>${esc(item.match.confidence || 'Possible match')}</strong> · ${esc(item.match.reasons.slice(0,3).join(' · '))}</small>`;
}

function setFilterMarkup(results, selected='') {
  const sets = [...new Set(results.map(item => item.set).filter(Boolean))].slice(0,5);
  if (results.length < 6 || sets.length < 2) return '';
  return `<div class="result-filters" role="group" aria-label="Filter search results by set"><button type="button" data-result-set="" aria-pressed="${String(!selected)}">All</button>${sets.map(set => `<button type="button" data-result-set="${esc(set)}" aria-pressed="${String(selected===set)}">${esc(set)}</button>`).join('')}</div>`;
}

function openManualSearch() {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Search catalog</h2><p>Use a name, set, number, rarity, finish, or any combination.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="form-grid"><label class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="catalogQuery" type="search" placeholder="Charizard Base Set 4/102" aria-label="Search catalog by card details"></label><div class="field"><label for="catalogLanguage">Language</label><select id="catalogLanguage"><option value="en">English</option><option value="ja">Japanese</option><option value="fr">French</option><option value="de">German</option><option value="es">Spanish</option><option value="it">Italian</option><option value="pt">Portuguese</option><option value="zh-tw">Traditional Chinese</option><option value="id">Indonesian</option><option value="th">Thai</option></select></div></div><div class="manual-results" id="manualResults" aria-live="polite"><div class="unavailable-panel">Type at least two characters to search.</div></div>`);
  const input=$('#catalogQuery'); const language=$('#catalogLanguage'); let timer; let requestId=0;
  let allResults=[]; let selectedSet='';
  const bindResults=()=>{ const visible=selectedSet?allResults.filter(item=>item.set===selectedSet):allResults; $('#manualResults').innerHTML=allResults.length?`${setFilterMarkup(allResults,selectedSet)}${visible.map(item=>`<button class="catalog-result" type="button" data-catalog-id="${esc(item.id)}" aria-label="Review ${esc(item.name)} from ${esc(item.set)}, number ${esc(item.number)}"><img src="${esc(item.thumb||'')}" alt="${esc(item.name)} card"><span><strong>${esc(item.name)}</strong>${esc(item.set||'Set unavailable')} · ${esc(item.number)}<small>${esc(item.rarity||'Rarity unavailable')} · ${esc(languageName(item.language || language.value))} · ${esc(item.variant)}</small>${matchReason(item)}</span><b>Review</b></button>`).join('')}`:'<div class="unavailable-panel">No catalog matches found. Try fewer details or verify the language.</div>'; $$('[data-result-set]', $('#manualResults')).forEach(button=>button.addEventListener('click',()=>{selectedSet=button.dataset.resultSet;bindResults();})); $$('[data-catalog-id]', $('#manualResults')).forEach(button=>button.addEventListener('click',()=>{const card=catalog.find(item=>item.id===button.dataset.catalogId);closeSheet({discardHistory:true});openCardDetail(card);})); };
  const renderResults=async()=>{ const q=input.value.trim(); const current=++requestId; if(q.length<2){$('#manualResults').innerHTML='<div class="unavailable-panel">Type at least two characters to search.</div>';return;} $('#manualResults').setAttribute('aria-busy','true'); $('#manualResults').innerHTML='<div class="unavailable-panel">Searching exact printings…</div>'; try{const result=await searchCatalog(q,language.value,12);if(current!==requestId)return;allResults=result.items;selectedSet='';bindResults();}catch{if(current===requestId)$('#manualResults').innerHTML='<div class="unavailable-panel">Catalog search is temporarily unavailable.</div>';}finally{if(current===requestId)$('#manualResults').setAttribute('aria-busy','false');}};
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(renderResults,250);}; input.addEventListener('input',schedule); language.addEventListener('change',renderResults); input.focus();
}

function openOwnershipSheet(card, editing=false) {
  const source = editing ? card : { ...card, uid:`copy-${card.id}-${Date.now()}`, quantity:1, condition:'Near Mint', gradingCompany:'', grade:'', cost:'', purchaseDate:'', tags:[], location:'', notes:'' };
  const startsGraded = source.condition === 'Graded' || Boolean(source.gradingCompany);
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${editing?'Edit your card':'Add to Library'}</h2><p>${esc(card.name)} · ${esc(card.set)} ${esc(card.number)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="ownershipForm"><div class="form-grid">
    <div class="field"><label for="ownQuantity">Quantity</label><input id="ownQuantity" name="quantity" type="number" min="1" max="999" required value="${Number(source.quantity)||1}"></div>
    <div class="field"><label for="ownCondition">Condition</label><select id="ownCondition" name="condition">${['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged','Graded'].map(v=>`<option ${source.condition===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="field graded-field" ${startsGraded?'':'hidden'}><label for="ownGrader">Grading company</label><select id="ownGrader" name="gradingCompany"><option value="">Choose company</option>${['PSA','CGC','BGS'].map(v=>`<option ${source.gradingCompany===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="field graded-field" ${startsGraded?'':'hidden'}><label for="ownGrade">Grade</label><input id="ownGrade" name="grade" inputmode="decimal" value="${esc(source.grade)}" placeholder="e.g. 9.5"></div>
    <div class="field"><label for="ownCost">Purchase price · each</label><input id="ownCost" name="cost" type="number" min="0" step=".01" value="${esc(source.cost)}" placeholder="0.00"></div>
    <div class="field"><label for="ownDate">Purchase date</label><input id="ownDate" name="purchaseDate" type="date" value="${esc(source.purchaseDate)}"></div>
    <div class="field full"><label for="ownLocation">Storage location</label><input id="ownLocation" name="location" value="${esc(source.location)}" placeholder="Binder 01 · Page 4"></div>
    <div class="field full"><label for="ownTags">Tags · comma separated</label><input id="ownTags" name="tags" value="${esc((source.tags||[]).join(', '))}" placeholder="Favorites, Trade binder"></div>
    <div class="field full"><label for="ownNotes">Notes</label><textarea id="ownNotes" name="notes" placeholder="Private notes">${esc(source.notes)}</textarea></div>
  </div><div class="sheet-actions"><button class="secondary" type="button" id="ownershipCancel">Cancel</button><button class="primary" type="submit">${editing?'Save changes':'Add to collection'}</button></div></form>`);
  $('#ownershipCancel').addEventListener('click',closeSheet);
  const syncGradingFields=()=>{
    const graded=$('#ownCondition').value==='Graded';
    $$('.graded-field').forEach(field=>field.hidden=!graded);
    $('#ownGrader').required=graded; $('#ownGrade').required=graded;
    if(!graded){$('#ownGrader').value='';$('#ownGrade').value='';}
  };
  $('#ownCondition').addEventListener('change',syncGradingFields); syncGradingFields();
  $('#ownershipForm').addEventListener('submit',event=>{
    event.preventDefault(); const data=new FormData(event.currentTarget); const graded=data.get('condition')==='Graded';
    if(graded&&(!data.get('gradingCompany')||!String(data.get('grade')).trim())){toast('Add the grading company and grade');$('#ownGrader').focus();return;}
    const updated={...source, quantity:Number(data.get('quantity')), condition:data.get('condition'), gradingCompany:graded?data.get('gradingCompany'):'', grade:graded?String(data.get('grade')).trim():'', cost:optionalNumber(data.get('cost')), purchaseDate:data.get('purchaseDate'), location:data.get('location'), tags:String(data.get('tags')).split(',').map(v=>v.trim()).filter(Boolean), notes:data.get('notes')};
    if (editing) state.items=state.items.map(item=>item.uid===source.uid?updated:item); else state.items.unshift(updated);
    const saved=saveItems(); closeSheet(); renderCollection(); state.detailId=updated.uid;state.detailCard=updated;routeTo('detail');toast(saved?(editing?'Record updated':'Card added to your collection'):'Saved for this session · device storage unavailable');
  });
}

function openInfo(kind) {
  const content = {
    sources:'Live quotes are requested through server-side provider adapters. PkmnPrices is preferred, with JustTCG and public TCGdex pricing used only as configured fallbacks. Every quote preserves provider IDs, condition, printing, currency, timestamps, attribution, and quality metadata. Provider keys are never sent to the browser.',
    retention:'Original scan uploads should be private and deleted after identification or within 24 hours. Derived crops should be removed within 7 days unless the user explicitly saves one. This preview processes the image only in the browser.',
    privacy:'Collection records are private. Production uses Supabase Auth, ownership-based Row Level Security, private storage, data export, and an account-deletion workflow. Never place service-role credentials in the client.'
  }[kind];
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${kind==='sources'?'Data sources':kind==='retention'?'Scan retention':'Privacy & deletion'}</h2></div><button class="sheet-close" aria-label="Close">×</button></div><p class="info-copy">${esc(content)}</p>`);
}

function exportCsv() {
  const blob=new Blob([collectionToCsv(state.items)],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`mica-collection-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url); toast('Library backup downloaded');
}

function handleCsv(file) {
  const reader=new FileReader();reader.onerror=()=>toast('Mica could not read that CSV');reader.onload=()=>{
    const {records,errors}=parseCollectionCsv(String(reader.result));
    if(!records.length){toast(errors[0]||'No importable rows found');return;}
    const errorCopy=errors.length?`<div class="unavailable-panel">${errors.length} row${errors.length===1?'':'s'} will be skipped. ${esc(errors.slice(0,3).join(' · '))}</div>`:'';
    openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Import ${records.length} card record${records.length===1?'':'s'}?</h2><p>Choose how this CSV should update your on-device library.</p></div><button class="sheet-close" aria-label="Close">×</button></div>${errorCopy}<div class="info-copy"><p>Names, sets, numbers, conditions, quantities, costs, tags, locations, and notes are preserved. Live pricing is checked again when possible.</p></div><div class="sheet-actions import-actions"><button class="secondary" id="cancelCsvImport" type="button">Cancel</button><button class="secondary" id="replaceCsvImport" type="button">Replace library</button><button class="primary" id="addCsvImport" type="button">Add records</button></div>`);
    const importRecords=mode=>{
      const stamp=Date.now();const imported=records.map((record,index)=>{
        const exact=catalog.find(item=>normalizeIdentity(item.name)===normalizeIdentity(record.name)&&normalizeIdentity(item.set)===normalizeIdentity(record.set)&&normalizeIdentity(item.number)===normalizeIdentity(record.number));
        return {...(exact||{}),...record,id:exact?.id||`import:${normalizeIdentity(`${record.name}-${record.set}-${record.number}`)||'card'}:${stamp}:${index}`,uid:`copy-import-${stamp}-${index}`,image:exact?.image||'./icons/icon.svg',thumb:exact?.thumb||'./icons/icon.svg',move:null,pricingStatus:'preview'};
      });
      state.items=mode==='replace'?imported:[...imported,...state.items];const saved=saveItems();state.ledgerView='all';state.query='';state.setFilter='';state.conditionFilter='';$('#collectionSearch').value='';syncTabs();renderCollection();closeSheet({discardHistory:true});routeTo('collection');toast(saved?`${imported.length} record${imported.length===1?'':'s'} imported`:'Imported for this session · device storage unavailable');
    };
    $('#cancelCsvImport').addEventListener('click',closeSheet);$('#addCsvImport').addEventListener('click',()=>importRecords('add'));$('#replaceCsvImport').addEventListener('click',()=>importRecords('replace'));
  };reader.readAsText(file);
}

function openResetDemoSheet() {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Restore preview cards?</h2><p>This replaces your current on-device library.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="warning-panel"><strong>Download a backup first if you want to keep your records.</strong><p>This action cannot be undone inside Mica.</p></div><div class="sheet-actions"><button class="secondary" id="cancelRestoreDemo" type="button">Keep my library</button><button class="danger-action" id="confirmRestoreDemo" type="button">Replace library</button></div>`);
  $('#cancelRestoreDemo').addEventListener('click',closeSheet);
  $('#confirmRestoreDemo').addEventListener('click',()=>{state.items=structuredClone(seedItems);state.query='';state.ledgerView='all';state.setFilter='';state.conditionFilter='';$('#collectionSearch').value='';const saved=saveItems();renderCollection();syncTabs();closeSheet();toast(saved?'Preview records restored':'Restored for this session · device storage unavailable');});
}

async function refreshLivePricing() {
  const uniqueItems = [...new Map(state.items.filter(item => item.id).map(item => [item.id, item])).values()];
  if (!uniqueItems.length) return;
  const lookups = uniqueItems.map(item => ({
    clientId: item.id,
    pkmnpricesId: item.externalIds?.pkmnprices || '',
    justtcgId: item.externalIds?.justtcg || '',
    tcgplayerId: item.externalIds?.tcgplayer || '',
    tcgdexId: item.externalIds?.tcgdex || '',
    name: item.name,
    set: item.set,
    number: item.number,
  }));
  state.pricingStatus = 'loading';
  renderCollection();
  try {
    const cards = new Map(); const processedIds=new Set(); let partial=false; let rateLimited=false; let retrievedAt=null;
    for(let start=0;start<lookups.length;start+=8){
      const batch=lookups.slice(start,start+8);
      const response = await fetch(`/api/cards?lookups=${encodeURIComponent(JSON.stringify(batch))}`, { headers: { Accept: 'application/json' } });
      if(response.status===429){rateLimited=true;partial=true;break;}
      if(!response.ok) throw new Error(`Pricing request failed with ${response.status}`);
      const payload=await response.json(); retrievedAt=payload.retrievedAt||retrievedAt;
      batch.forEach(lookup=>processedIds.add(lookup.clientId));
      (payload.cards||[]).forEach(card=>cards.set(card.providerCardId,card));
      partial=partial||Boolean(payload.partial)||(payload.unavailable?.length>0);
    }
    const applyPricing = item => {
      const card = cards.get(item.id);
      const demoPrice = item.demoPrice ?? item.price;
      if (!processedIds.has(item.id)) return rateLimited ? {...item,demoPrice,pricingStatus:item.price==null?'rate_limited':item.pricingStatus} : item;
      if (!card) return { ...item, demoPrice, price:null, move:null, quotes:[], pricingStatus:'unavailable', pricingUpdatedAt:null };
      const quote = selectReferenceQuote(card.quotes, item.variant, 'USD', item);
      return {
        ...item,
        externalIds:{...(item.externalIds||{}),...(card.externalIds||{})},
        demoPrice,
        price: quote?.amount ?? null,
        move: null,
        quotes: card.quotes,
        historyStatus: card.historyStatus || null,
        priceHistory: quote ? recordPriceObservation(item, quote, card.history || []) : card.history || [],
        pricingStatus: quote ? quoteStatus(quote) : 'unavailable',
        pricingUpdatedAt: quote?.observedAt || quote?.retrievedAt?.slice(0,10) || null,
      };
    };
    state.items = state.items.map(applyPricing);
    catalog = catalog.map(item => cards.has(item.id) ? applyPricing(item) : item);
    state.pricingStatus = partial ? 'partial' : 'live';
    state.pricingRetrievedAt = retrievedAt;
    renderCollection();
    renderInsights();
    if (state.route === 'detail') renderDetail();
  } catch {
    state.pricingStatus = 'error';
    state.items = state.items.map(item => ({...item, pricingStatus:item.price == null?'error':item.pricingStatus}));
    renderCollection();
    renderInsights();
  }
}

function renderInsights() {
  const priced = state.items.filter(item => item.price != null).length;
  if (['live','partial'].includes(state.pricingStatus)) {
    $('.insight-feature').innerHTML = `<div class="insight-kicker">${state.pricingStatus==='partial'?'Partial':'Live'} pricing status</div><strong>${priced} of ${state.items.length} cards priced</strong><span>Exact-printing matches only · ${state.items.length-priced} need review</span><div class="unavailable-panel">Price trends appear after matching prices have been collected over time.</div>`;
    $('#moversList').innerHTML = '<div class="data-boundary"><strong>Movement history is not available yet</strong><p>Mica will not infer a trend from one quote or from incompatible variants.</p></div>';
    return;
  }
  $('.insight-feature').innerHTML = `<div class="insight-kicker">Preview movement · fixture data</div><strong>+$124.18</strong><span>Illustrative only · replaced when live comparable history exists</span>`;
  $('#moversList').innerHTML = [...state.items].filter(i=>i.move!=null).sort((a,b)=>Math.abs(b.move)-Math.abs(a.move)).slice(0,4).map(item=>`<div class="mover"><img src="${item.thumb}" alt=""><div><strong>${esc(item.name)}</strong><span>${esc(item.set)} · preview fixture</span></div><b style="color:${item.move<0?'var(--danger)':''}">${item.move>=0?'+':''}${item.move.toFixed(1)}%</b></div>`).join('');
}

function syncTabs() { $$('.view-tab').forEach(tab=>{const active=tab.dataset.ledgerView===state.ledgerView;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));}); }
function toast(message) { const node=document.createElement('div');node.className='toast';node.textContent=message;$('#toastRegion').append(node);setTimeout(()=>node.remove(),3000); }

function bindQuickCardSearch() {
  const input = $('#quickCardSearch'); const language = $('#quickSearchLanguage'); const resultsNode = $('#quickSearchResults');
  let timer; let requestId=0;
  let allResults=[]; let selectedSet='';
  const showResults = results => {
    if (results) { allResults=results; selectedSet=''; }
    const visible=selectedSet?allResults.filter(item=>item.set===selectedSet):allResults;
    resultsNode.innerHTML = allResults.length ? `${setFilterMarkup(allResults,selectedSet)}${visible.map(item => `<button class="quick-card-result" type="button" data-quick-card="${esc(item.id)}" aria-label="View ${esc(item.name)} from ${esc(item.set)}, number ${esc(item.number)}"><img src="${esc(item.thumb || item.image || '')}" alt="${esc(item.name)} card"><span><strong>${esc(item.name)}</strong><small>${esc(item.set || 'Set unavailable')} · ${esc(item.number || 'Number unavailable')}</small><em>${esc(item.rarity || 'Rarity unavailable')} · ${esc(languageName(item.language || language.value))} · ${esc(item.variant || 'Printing unknown')}</em>${matchReason(item)}</span><b>View</b></button>`).join('')}` : '<div class="find-empty"><strong>No matching cards</strong><span>Try fewer details, verify the language, or search the collector number by itself.</span></div>';
    $$('[data-result-set]', resultsNode).forEach(button=>button.addEventListener('click',()=>{selectedSet=button.dataset.resultSet;showResults();}));
    $$('[data-quick-card]', resultsNode).forEach(button => button.addEventListener('click', () => openCardDetail(catalog.find(card => card.id === button.dataset.quickCard))));
  };
  const search = async () => {
    const q=input.value.trim(); const current=++requestId;
    if(q.length<2){resultsNode.innerHTML='<div class="find-empty"><strong>Find the exact printing</strong><span>Results show the set and card number so you can pick the right one.</span></div>';return;}
    resultsNode.setAttribute('aria-busy','true');
    resultsNode.innerHTML='<div class="searching-cards"><i></i><span>Finding exact printings…</span></div>';
    try {
      const result=await searchCatalog(q,language.value,12); if(current!==requestId)return;
      showResults(result.items);
    } catch {
      if(current!==requestId)return;
      const offlineMatches=catalog.filter(item=>matchesSearch(item,q)).slice(0,12);
      if(offlineMatches.length)showResults(offlineMatches);
      else resultsNode.innerHTML='<div class="find-empty"><strong>Search is temporarily unavailable</strong><span>Your library is still safe. Try again in a moment.</span></div>';
    } finally { if(current===requestId)resultsNode.setAttribute('aria-busy','false'); }
  };
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(search,220);};
  input.addEventListener('input',schedule); language.addEventListener('change',search);
  $$('[data-search-example]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.searchExample;search();input.focus();}));
}

function bindEvents() {
  $$('[data-route]').forEach(button=>button.addEventListener('click',()=>{const route=button.dataset.route; if(route==='insights')renderInsights();routeTo(route);}));
  $$('.view-tab').forEach(tab=>tab.addEventListener('click',()=>{state.ledgerView=tab.dataset.ledgerView;syncTabs();renderCollection();}));
  $$('.view-tab').forEach(tab=>tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=$$('.view-tab');const current=tabs.indexOf(event.currentTarget);const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();tabs[next].click();}));
  $('#collectionSearch').addEventListener('input',event=>{state.query=event.target.value;renderCollection();});
  $('#filterButton').addEventListener('click',openFilterSheet);
  $('#sortButton').addEventListener('click',()=>{state.sort=state.sort==='value-desc'?'name':'value-desc';renderCollection();});
  $('#clearFilters').addEventListener('click',()=>{state.query='';state.ledgerView='all';state.setFilter='';state.conditionFilter='';$('#collectionSearch').value='';syncTabs();renderCollection();});
  $('#emptyAddCard').addEventListener('click',()=>routeTo('scan'));
  $('#methodButton').addEventListener('click',openMethodSheet);
  $('#syncState').addEventListener('click',()=>{if(state.storageStatus==='error')toast('Device storage is unavailable · changes last only for this session');else if(state.pricingStatus!=='loading')void refreshLivePricing();});
  $('#manualSearchButton').addEventListener('click',openManualSearch);
  $('#cameraInput').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';validateImage(file);});
  $('#galleryInput').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';validateImage(file);});
  $('#sheetBackdrop').addEventListener('click',closeSheet);
  $('#exportButton').addEventListener('click',exportCsv); $('#importButton').addEventListener('click',()=>$('#csvInput').click());
  $('#csvInput').addEventListener('change',event=>{const file=event.target.files[0];event.target.value='';if(file)handleCsv(file);});
  $$('[data-info]').forEach(button=>button.addEventListener('click',()=>openInfo(button.dataset.info)));
  $('#currencyButton').addEventListener('click',()=>toast('USD display currency · source currencies preserved'));
  $('#motionButton').addEventListener('click',()=>toast('Motion follows your device preference'));
  $('#moreButton').addEventListener('click',()=>openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Library options</h2><p>Backup or reset your card library.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="settings-group"><button type="button" id="sheetExport"><span>Download a backup<small>Save a copy of every card</small></span><b>›</b></button><button type="button" id="restoreDemo"><span>Restore preview cards<small>Replace local changes with the starter library</small></span><b>›</b></button></div>`));
  document.addEventListener('click',event=>{ if(event.target.closest('#sheetExport')){exportCsv();closeSheet();} if(event.target.closest('#restoreDemo'))openResetDemoSheet(); });
  document.addEventListener('keydown',handleDialogKeydown);
  window.addEventListener('popstate',event=>{if(!$('#bottomSheet').hidden){closeSheet({fromHistory:true});return;}const route=event.state?.route||(['scan','insights','profile'].includes(location.hash.slice(1))?location.hash.slice(1):'collection');state.detailCanPop=false;routeTo(route,{instant:true,history:'none'});});
  bindQuickCardSearch();
}

function validateImage(file) {
  if (!file) return; const allowed=['image/jpeg','image/png','image/webp','image/heic','image/heif'];
  if(!allowed.includes(file.type)){toast('Choose a JPEG, PNG, WebP, HEIC, or HEIF image');return;}
  if(file.size>12*1024*1024){toast('Image is over the 12 MB capture limit');return;}
  showProcessing(file);
}

bindEvents(); renderCollection(); renderInsights(); routeTo(location.hash && ['scan','insights','profile'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'collection', {instant:true,history:'replace'}); refreshLivePricing();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
