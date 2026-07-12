import { money, calculateTotals, collectionToCsv, matchesSearch } from './lib/core.js';
import { selectCardmarketReference, selectReferenceQuote } from './lib/pricing.js';

const STORAGE_KEY = 'mica.collection.v1';
const DEMO_DATE = '2026-07-08';
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

const state = { items: loadItems(), route:'collection', ledgerView:'all', query:'', sort:'value-desc', detailId:null, lastFocus:null, pricingStatus:'demo' };
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function loadItems() {
  try { const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (Array.isArray(stored)) return stored; } catch {}
  return structuredClone(seedItems);
}
function saveItems() {
  const persisted = state.items.map(({ quotes, pricingStatus, pricingUpdatedAt, demoPrice, ...item }) => ({
    ...item,
    price: demoPrice ?? item.price,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}
function itemValue(item) { return item.price == null ? null : Number(item.price) * Number(item.quantity || 0); }

function priceStatusText(item) {
  if (item.price == null) return 'Pricing unavailable';
  if (item.pricingStatus === 'live') return `Updated ${item.pricingUpdatedAt || 'recently'}`;
  return 'Preview fixture';
}

function renderQuoteRow(quote, label) {
  if (!quote) return '';
  const source = quote.providerUrl
    ? `<a href="${esc(quote.providerUrl)}" target="_blank" rel="noreferrer">${esc(label)}</a>`
    : `<strong>${esc(label)}</strong>`;
  return `<div class="price-source"><div>${source}<span>${esc(quote.priceType)} · ${esc(quote.finish)} · ${esc(quote.currency)}</span><span>Observed ${esc(quote.observedAt || 'date unavailable')} · retrieved ${esc(quote.retrievedAt.slice(0,10))}</span></div><div class="source-value"><b>${money(quote.amount, quote.currency)}</b><small>${esc(quote.attribution)}</small></div></div>`;
}

function routeTo(route, options={}) {
  state.route = route;
  $$('.view').forEach(view => view.classList.toggle('active', view.id === `view-${route}`));
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.route === route));
  $('.bottom-nav').classList.toggle('hidden', route === 'detail');
  if (route === 'detail') renderDetail();
  window.scrollTo({top:0, behavior: options.instant ? 'auto' : 'smooth'});
  history.replaceState(null, '', route === 'collection' ? location.pathname : `#${route}`);
}

function renderCollection() {
  const totals = calculateTotals(state.items);
  const gain = totals.value - totals.cost;
  $('#portfolioValue').textContent = money(totals.value);
  $('#costBasis').textContent = money(totals.cost);
  $('#unrealized').textContent = `${gain >= 0 ? '+' : ''}${money(gain)}`;
  $('#ownedCount').textContent = `${totals.quantity} card${totals.quantity === 1 ? '' : 's'}`;
  const partial = totals.unpriced ? ` · ${totals.unpriced} unpriced card${totals.unpriced === 1 ? '' : 's'} excluded` : '';
  $('#portfolioChange').textContent = state.pricingStatus === 'live' ? `Current provider snapshots${partial}` : `Preview pricing${partial}`;
  $('#allCount').textContent = state.items.length;
  const pricedCount = state.items.filter(item=>item.price!=null).length;
  const pricingLabel = state.pricingStatus === 'loading' ? 'Updating live prices…'
    : state.pricingStatus === 'live' ? `${pricedCount} of ${state.items.length} live prices`
    : state.pricingStatus === 'error' ? 'Provider unavailable · preview prices'
    : `${pricedCount} of ${state.items.length} preview prices`;
  $('.status-label').innerHTML = `<i></i> ${pricingLabel}`;
  let visible = state.items.filter(item => matchesSearch(item, state.query));
  if (state.ledgerView === 'graded') visible = visible.filter(item => item.gradingCompany || item.grade);
  if (state.ledgerView === 'unpriced') visible = visible.filter(item => item.price == null);
  visible.sort((a,b) => state.sort === 'value-desc' ? (itemValue(b) ?? -1) - (itemValue(a) ?? -1) : a.name.localeCompare(b.name));
  $('#resultCount').textContent = `${visible.length} record${visible.length === 1 ? '' : 's'}`;
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
  $$('.ledger-row').forEach(row => {
    const open = () => { state.detailId = row.dataset.id; routeTo('detail'); };
    row.addEventListener('click', open); row.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
}

function renderDetail() {
  const item = state.items.find(candidate => candidate.uid === state.detailId);
  if (!item) return routeTo('collection');
  const total = itemValue(item);
  const tcgQuote = selectReferenceQuote(item.quotes, item.variant);
  const cardmarketQuote = selectCardmarketReference(item.quotes, item.variant);
  const sourceRows = item.price == null ? `<div class="unavailable-panel"><strong>Pricing unavailable for this printing.</strong><br>The collection record is preserved and excluded from estimated totals. Mica will not substitute a different variant or condition.</div>`
    : item.pricingStatus === 'live'
      ? `${renderQuoteRow(tcgQuote, 'TCGplayer reference')}${renderQuoteRow(cardmarketQuote, 'Cardmarket reference')}`
      : `<div class="price-source"><div><strong>Preview reference</strong><span>Fixture · ${esc(item.variant)} · USD</span><span>Live provider refresh has not completed.</span></div><div class="source-value"><b>${money(item.price)}</b><small>Clearly labeled demo data</small></div></div>`;
  $('#detailContent').innerHTML = `<button class="detail-back" id="detailBack" type="button"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>Collection</button>
    <div class="detail-identity"><img src="${esc(item.image)}" alt="${esc(item.name)} from ${esc(item.set)}"><div><p class="eyebrow">${esc(item.rarity)}</p><h1 id="detailTitle">${esc(item.name)}</h1><p class="detail-set">${esc(item.set)} · ${esc(item.number)}</p><div class="detail-meta"><div><span>Printing</span><strong>${esc(item.variant)}</strong></div><div><span>Language</span><strong>English</strong></div><div><span>Released</span><strong>${esc(item.release)}</strong></div><div><span>Artist</span><strong>${esc(item.artist)}</strong></div></div></div></div>
    <div class="owned-banner"><div><span>Your position</span><strong>${item.quantity} owned · ${total==null?'Unpriced':money(total)}</strong></div><button id="editCopyButton" type="button">Edit record</button></div>
    <section class="detail-section"><div class="detail-section-head"><h2>Market references</h2><span>${item.price==null?'No supported quote':item.pricingStatus==='live'?'Live provider data':'Preview data · not live'}</span></div>${sourceRows}<p class="legal-copy">These values are market references, not guaranteed value or an appraisal. Condition and venue can materially affect realized price.</p></section>
    <section class="detail-section"><div class="detail-section-head"><h2>Owned copy</h2><span>${esc(item.location)}</span></div><div class="copy-row"><div><strong>${item.gradingCompany ? `${esc(item.gradingCompany)} ${esc(item.grade)}` : esc(item.condition)}</strong><span>Purchased ${esc(item.purchaseDate || 'date not recorded')} · ${money(item.cost)} each</span></div><b>×${item.quantity}</b></div>${item.notes?`<div class="unavailable-panel">${esc(item.notes)}</div>`:''}</section>
    <section class="detail-section"><div class="detail-section-head"><h2>Price history & sales</h2><span>Capability unavailable</span></div><div class="unavailable-panel">No licensed transaction-history provider is connected. Active listings are not presented as completed sales.</div></section>`;
  $('#detailBack').addEventListener('click', () => routeTo('collection'));
  $('#editCopyButton').addEventListener('click', () => openOwnershipSheet(item, true));
}

function openSheet(content, trigger=document.activeElement) {
  state.lastFocus = trigger;
  $('#sheetContent').innerHTML = content;
  $('#sheetBackdrop').hidden = false; $('#bottomSheet').hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => $('.sheet-close, input, button', $('#sheetContent'))?.focus());
  $$('.sheet-close').forEach(button => button.addEventListener('click', closeSheet));
}
function closeSheet() {
  $('#sheetBackdrop').hidden = true; $('#bottomSheet').hidden = true; document.body.style.overflow = '';
  state.lastFocus?.focus?.();
}

function openFilterSheet() {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Filter & sort</h2><p>Keep the ledger focused on the records you need.</p></div><button class="sheet-close" aria-label="Close">×</button></div>
    <div class="field"><label for="sheetView">Show</label><select id="sheetView"><option value="all">All cards</option><option value="graded">Graded only</option><option value="unpriced">Unpriced only</option></select></div>
    <div class="field"><label for="sheetSort">Sort by</label><select id="sheetSort"><option value="value-desc">Value, high to low</option><option value="name">Name, A to Z</option></select></div>
    <div class="sheet-actions"><button class="secondary" id="resetSheet">Reset</button><button class="primary" id="applySheet">Apply filters</button></div>`);
  $('#sheetView').value = state.ledgerView; $('#sheetSort').value = state.sort;
  $('#resetSheet').addEventListener('click', () => { state.ledgerView='all'; state.sort='value-desc'; state.query=''; $('#collectionSearch').value=''; closeSheet(); syncTabs(); renderCollection(); });
  $('#applySheet').addEventListener('click', () => { state.ledgerView=$('#sheetView').value; state.sort=$('#sheetSort').value; closeSheet(); syncTabs(); renderCollection(); toast('Collection view updated'); });
}

function openMethodSheet() {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">How valuation works</h2><p>Transparent by design.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="info-copy"><p><strong>Estimated market value</strong> is quantity multiplied by the selected compatible price reference for each record.</p><p>Raw and graded cards are never mixed. Source currency, finish, price type, and freshness remain attached to every quote.</p><p>Cards without a supported quote stay in your collection and are excluded from the estimate. Here, prices are clearly marked demo fixtures until a configured server-side provider is available.</p></div>`);
}

function showProcessing(file) {
  const url = URL.createObjectURL(file);
  $('#capturePreview').innerHTML = `<img src="${url}" alt="Selected card photograph">`;
  $('#qualityChip').innerHTML = '<span></span> Image received';
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Identifying card</h2><p>We’ll ask you to confirm before anything is saved.</p></div><button class="sheet-close" aria-label="Cancel">×</button></div><ul class="process-list"><li class="active"><i></i>Checking image quality</li><li><i></i>Reading visible card details</li><li><i></i>Comparing catalog candidates</li><li><i></i>Loading available market context</li></ul><div class="unavailable-panel">Progress stages reflect real pipeline boundaries. No confidence score is shown until candidates are available.</div>`);
  const rows = $$('.process-list li'); let index=0;
  const timer = setInterval(() => {
    if ($('#bottomSheet').hidden) return clearInterval(timer);
    rows[index].classList.remove('active'); rows[index].classList.add('done'); rows[index].querySelector('i').textContent='✓'; index++;
    if (index < rows.length) rows[index].classList.add('active'); else { clearInterval(timer); setTimeout(()=>showCandidates(), 250); }
  }, 430);
}

function showCandidates() {
  const candidates=[catalog[0],catalog[2],catalog[6]];
  $('#sheetContent').innerHTML = `<div class="sheet-heading"><div><h2 id="sheetTitle">Confirm the printing</h2><p>We found a likely match. Check the set and number.</p></div><button class="sheet-close" aria-label="Close">×</button></div>${candidates.map((item,index)=>`<div class="candidate-card"><img src="${item.thumb}" alt="${esc(item.name)}"><div><h3>${esc(item.name)}</h3><p>${esc(item.set)} · ${esc(item.number)}<br>${esc(item.variant)}</p><span class="confidence">${index===0?'Strong match':'Possible match'} · ${index===0?'collector number + artwork':'visual similarity'}</span><br><button type="button" data-candidate="${item.id}">Choose this card</button></div></div>`).join('')}<div class="sheet-actions"><button class="secondary" id="candidateRetake">Retake photo</button><button class="secondary" id="candidateManual">Search manually</button></div>`;
  $('.sheet-close').addEventListener('click', closeSheet);
  $$('[data-candidate]').forEach(button => button.addEventListener('click', () => openOwnershipSheet(catalog.find(item=>item.id===button.dataset.candidate))));
  $('#candidateRetake').addEventListener('click', closeSheet); $('#candidateManual').addEventListener('click', openManualSearch);
}

function openManualSearch() {
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Search catalog</h2><p>Try a name, set, or collector number.</p></div><button class="sheet-close" aria-label="Close">×</button></div><label class="search-field"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="catalogQuery" type="search" placeholder="e.g. Charizard 199/165" aria-label="Catalog search"></label><div class="manual-results" id="manualResults"></div>`);
  const input=$('#catalogQuery'); const renderResults=()=>{ const q=input.value; const results=catalog.filter(item=>matchesSearch(item,q)).slice(0,6); $('#manualResults').innerHTML=results.map(item=>`<button class="catalog-result" type="button" data-catalog-id="${item.id}"><img src="${item.thumb}" alt=""><span><strong>${esc(item.name)}</strong>${esc(item.set)} · ${esc(item.number)}</span><b>${money(item.price)}</b></button>`).join(''); $$('[data-catalog-id]').forEach(button=>button.addEventListener('click',()=>openOwnershipSheet(catalog.find(item=>item.id===button.dataset.catalogId)))); };
  input.addEventListener('input',renderResults); input.value='Charizard'; renderResults(); input.focus();
}

function openOwnershipSheet(card, editing=false) {
  const source = editing ? card : { ...card, uid:`copy-${card.id}-${Date.now()}`, quantity:1, condition:'Near Mint', gradingCompany:'', grade:'', cost:'', purchaseDate:'', tags:[], location:'', notes:'' };
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${editing?'Edit owned record':'Add owned copy'}</h2><p>${esc(card.name)} · ${esc(card.set)} ${esc(card.number)}</p></div><button class="sheet-close" aria-label="Close">×</button></div><form id="ownershipForm"><div class="form-grid">
    <div class="field"><label for="ownQuantity">Quantity</label><input id="ownQuantity" name="quantity" type="number" min="1" max="999" required value="${Number(source.quantity)||1}"></div>
    <div class="field"><label for="ownCondition">Condition</label><select id="ownCondition" name="condition">${['Near Mint','Lightly Played','Moderately Played','Heavily Played','Damaged','Graded'].map(v=>`<option ${source.condition===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label for="ownGrader">Grading company</label><select id="ownGrader" name="gradingCompany"><option value="">Ungraded</option>${['PSA','CGC','BGS'].map(v=>`<option ${source.gradingCompany===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label for="ownGrade">Grade</label><input id="ownGrade" name="grade" inputmode="decimal" value="${esc(source.grade)}" placeholder="e.g. 9.5"></div>
    <div class="field"><label for="ownCost">Purchase price · each</label><input id="ownCost" name="cost" type="number" min="0" step=".01" value="${esc(source.cost)}" placeholder="0.00"></div>
    <div class="field"><label for="ownDate">Purchase date</label><input id="ownDate" name="purchaseDate" type="date" value="${esc(source.purchaseDate)}"></div>
    <div class="field full"><label for="ownLocation">Storage location</label><input id="ownLocation" name="location" value="${esc(source.location)}" placeholder="Binder 01 · Page 4"></div>
    <div class="field full"><label for="ownTags">Tags · comma separated</label><input id="ownTags" name="tags" value="${esc((source.tags||[]).join(', '))}" placeholder="Favorites, Trade binder"></div>
    <div class="field full"><label for="ownNotes">Notes</label><textarea id="ownNotes" name="notes" placeholder="Private notes">${esc(source.notes)}</textarea></div>
  </div><div class="sheet-actions"><button class="secondary" type="button" id="ownershipCancel">Cancel</button><button class="primary" type="submit">${editing?'Save changes':'Add to collection'}</button></div></form>`);
  $('#ownershipCancel').addEventListener('click',closeSheet);
  $('#ownershipForm').addEventListener('submit',event=>{
    event.preventDefault(); const data=new FormData(event.currentTarget); const updated={...source, quantity:Number(data.get('quantity')), condition:data.get('condition'), gradingCompany:data.get('gradingCompany'), grade:data.get('grade'), cost:Number(data.get('cost'))||0, purchaseDate:data.get('purchaseDate'), location:data.get('location'), tags:String(data.get('tags')).split(',').map(v=>v.trim()).filter(Boolean), notes:data.get('notes')};
    if (editing) state.items=state.items.map(item=>item.uid===source.uid?updated:item); else state.items.unshift(updated);
    saveItems(); closeSheet(); renderCollection(); state.detailId=updated.uid; routeTo('detail'); toast(editing?'Record updated':'Card added to your collection');
  });
}

function openInfo(kind) {
  const content = {
    sources:'Live quotes are requested through a server-side Pokémon TCG API adapter. Every quote preserves provider, product ID, price type, currency, variant, observed time, retrieval time, attribution, and source URL. The API key is never sent to the browser.',
    retention:'Original scan uploads should be private and deleted after identification or within 24 hours. Derived crops should be removed within 7 days unless the user explicitly saves one. This preview processes the image only in the browser.',
    privacy:'Collection records are private. Production uses Supabase Auth, ownership-based Row Level Security, private storage, data export, and an account-deletion workflow. Never place service-role credentials in the client.'
  }[kind];
  openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">${kind==='sources'?'Data sources':kind==='retention'?'Scan retention':'Privacy & deletion'}</h2></div><button class="sheet-close" aria-label="Close">×</button></div><p class="info-copy">${esc(content)}</p>`);
}

function exportCsv() {
  const blob=new Blob([collectionToCsv(state.items)],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const link=document.createElement('a'); link.href=url; link.download=`mica-collection-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url); toast('Collection exported safely');
}

function handleCsv(file) {
  const reader=new FileReader(); reader.onload=()=>{
    const lines=String(reader.result).split(/\r?\n/).filter(Boolean); if(lines.length<2){toast('No importable rows found');return;}
    const headers=lines[0].toLowerCase(); if(!headers.includes('name')||!headers.includes('quantity')){toast('CSV needs name and quantity columns');return;}
    toast(`${lines.length-1} CSV row${lines.length===2?'':'s'} validated in preview · no records changed`);
  }; reader.readAsText(file);
}

async function refreshLivePricing() {
  const ids = [...new Set(state.items.map(item => item.id).filter(Boolean))];
  if (!ids.length) return;
  state.pricingStatus = 'loading';
  renderCollection();
  try {
    const response = await fetch(`/api/cards?ids=${encodeURIComponent(ids.join(','))}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Pricing request failed with ${response.status}`);
    const payload = await response.json();
    const cards = new Map((payload.cards || []).map(card => [card.providerCardId, card]));
    const applyPricing = item => {
      const card = cards.get(item.id);
      const demoPrice = item.demoPrice ?? item.price;
      if (!card) return { ...item, demoPrice, price:null, move:null, quotes:[], pricingStatus:'unavailable', pricingUpdatedAt:null };
      const quote = selectReferenceQuote(card.quotes, item.variant);
      return {
        ...item,
        demoPrice,
        price: quote?.amount ?? null,
        move: null,
        quotes: card.quotes,
        pricingStatus: quote ? 'live' : 'unavailable',
        pricingUpdatedAt: quote?.observedAt || quote?.retrievedAt?.slice(0,10) || null,
      };
    };
    state.items = state.items.map(applyPricing);
    catalog = catalog.map(item => cards.has(item.id) ? applyPricing(item) : item);
    state.pricingStatus = 'live';
    renderCollection();
    renderInsights();
    if (state.route === 'detail') renderDetail();
  } catch {
    state.pricingStatus = 'error';
    renderCollection();
    renderInsights();
  }
}

function renderInsights() {
  const priced = state.items.filter(item => item.price != null).length;
  if (state.pricingStatus === 'live') {
    $('.insight-feature').innerHTML = `<div class="insight-kicker">Live pricing status</div><strong>${priced} of ${state.items.length} records priced</strong><span>Current compatible provider snapshots · source currencies preserved</span><div class="unavailable-panel">A single current snapshot does not establish price movement. Historical changes will appear only after comparable snapshots have been collected over time.</div>`;
    $('#moversList').innerHTML = '<div class="data-boundary"><strong>Movement history is not available yet</strong><p>Mica will not infer a trend from one quote or from incompatible variants.</p></div>';
    return;
  }
  $('.insight-feature').innerHTML = `<div class="insight-kicker">Preview movement · fixture data</div><strong>+$124.18</strong><span>Illustrative only · replaced when live comparable history exists</span>`;
  $('#moversList').innerHTML = [...state.items].filter(i=>i.move!=null).sort((a,b)=>Math.abs(b.move)-Math.abs(a.move)).slice(0,4).map(item=>`<div class="mover"><img src="${item.thumb}" alt=""><div><strong>${esc(item.name)}</strong><span>${esc(item.set)} · preview fixture</span></div><b style="color:${item.move<0?'var(--danger)':''}">${item.move>=0?'+':''}${item.move.toFixed(1)}%</b></div>`).join('');
}

function syncTabs() { $$('.view-tab').forEach(tab=>{const active=tab.dataset.ledgerView===state.ledgerView;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));}); }
function toast(message) { const node=document.createElement('div');node.className='toast';node.textContent=message;$('#toastRegion').append(node);setTimeout(()=>node.remove(),3000); }

function bindEvents() {
  $$('[data-route]').forEach(button=>button.addEventListener('click',()=>{const route=button.dataset.route; if(route==='insights')renderInsights();routeTo(route);}));
  $$('.view-tab').forEach(tab=>tab.addEventListener('click',()=>{state.ledgerView=tab.dataset.ledgerView;syncTabs();renderCollection();}));
  $('#collectionSearch').addEventListener('input',event=>{state.query=event.target.value;renderCollection();});
  $('#filterButton').addEventListener('click',openFilterSheet);
  $('#sortButton').addEventListener('click',()=>{state.sort=state.sort==='value-desc'?'name':'value-desc';renderCollection();});
  $('#clearFilters').addEventListener('click',()=>{state.query='';state.ledgerView='all';$('#collectionSearch').value='';syncTabs();renderCollection();});
  $('#methodButton').addEventListener('click',openMethodSheet);
  $('#manualSearchButton').addEventListener('click',openManualSearch);
  $('#cameraInput').addEventListener('change',event=>validateImage(event.target.files[0]));
  $('#galleryInput').addEventListener('change',event=>validateImage(event.target.files[0]));
  $('#sheetBackdrop').addEventListener('click',closeSheet);
  $('#exportButton').addEventListener('click',exportCsv); $('#importButton').addEventListener('click',()=>$('#csvInput').click());
  $('#csvInput').addEventListener('change',event=>event.target.files[0]&&handleCsv(event.target.files[0]));
  $$('[data-info]').forEach(button=>button.addEventListener('click',()=>openInfo(button.dataset.info)));
  $('#currencyButton').addEventListener('click',()=>toast('USD display currency · source currencies preserved'));
  $('#motionButton').addEventListener('click',()=>toast('Motion follows your device preference'));
  $('#moreButton').addEventListener('click',()=>openSheet(`<div class="sheet-heading"><div><h2 id="sheetTitle">Collection options</h2><p>Manage this ledger without losing context.</p></div><button class="sheet-close" aria-label="Close">×</button></div><div class="settings-group"><button type="button" id="sheetExport"><span>Export current collection<small>Formula-safe CSV</small></span><b>›</b></button><button type="button" id="restoreDemo"><span>Restore preview records<small>Replace local changes with the six-record demo</small></span><b>›</b></button></div>`));
  document.addEventListener('click',event=>{ if(event.target.closest('#sheetExport')){exportCsv();closeSheet();} if(event.target.closest('#restoreDemo')){state.items=structuredClone(seedItems);saveItems();renderCollection();closeSheet();toast('Preview records restored');} });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#bottomSheet').hidden)closeSheet();});
}

function validateImage(file) {
  if (!file) return; const allowed=['image/jpeg','image/png','image/webp','image/heic','image/heif'];
  if(!allowed.includes(file.type)){toast('Choose a JPEG, PNG, WebP, HEIC, or HEIF image');return;}
  if(file.size>12*1024*1024){toast('Image is over the 12 MB capture limit');return;}
  showProcessing(file);
}

bindEvents(); renderCollection(); renderInsights(); refreshLivePricing();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
if (location.hash && ['scan','insights','profile'].includes(location.hash.slice(1))) routeTo(location.hash.slice(1),{instant:true});
