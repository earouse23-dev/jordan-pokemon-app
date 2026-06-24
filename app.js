/* ============================================================
   CardVault — Pokémon inventory PWA
   Data source: pokemontcg.io (free, returns live TCGPlayer prices)
   Storage: IndexedDB (cards + locally-stored photos)
   ============================================================ */

const API = 'https://api.pokemontcg.io/v2/cards';
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="252"><rect width="100%" height="100%" fill="#1f2647"/><text x="50%" y="50%" fill="#6b739a" font-size="16" text-anchor="middle" dy=".3em" font-family="sans-serif">No image</text></svg>'
);

/* ---------- tiny IndexedDB wrapper ---------- */
const DB = (() => {
  let dbp;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('cardvault', 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'uid' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('cards', mode);
      const store = t.objectStore('cards');
      const out = fn(store);
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  }
  return {
    all: () => tx('readonly', s => s.getAll()),
    put: (c) => tx('readwrite', s => s.put(c)),
    del: (uid) => tx('readwrite', s => s.delete(uid)),
    get: (uid) => tx('readonly', s => s.get(uid)),
  };
})();

/* ---------- state ---------- */
let library = [];           // cards in binder
let pendingPhoto = null;    // dataURL captured before saving
let currentDetail = null;   // card object currently shown in detail

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const money = (n) => (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2200);
}

/* Pull the best market price out of a TCGPlayer price block.
   Picks the most relevant printing (holofoil > normal > whatever exists). */
function extractPrices(card) {
  const tp = card.tcgplayer && card.tcgplayer.prices;
  if (tp) {
    const order = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', 'unlimitedHolofoil', '1stEdition'];
    const key = order.find(k => tp[k]) || Object.keys(tp)[0];
    if (key) {
      const p = tp[key];
      return {
        market: p.market ?? p.mid ?? null,
        low: p.low ?? null,
        mid: p.mid ?? null,
        high: p.high ?? null,
        directLow: p.directLow ?? null,
        printing: key,
        url: card.tcgplayer.url,
        updatedAt: card.tcgplayer.updatedAt,
        source: 'TCGPlayer',
      };
    }
  }
  // Cardmarket fallback (EUR treated as approx)
  const cm = card.cardmarket && card.cardmarket.prices;
  if (cm) {
    return {
      market: cm.trendPrice ?? cm.averageSellPrice ?? null,
      low: cm.lowPrice ?? null,
      mid: cm.averageSellPrice ?? null,
      high: cm.avg30 ?? null,
      directLow: null,
      printing: 'cardmarket',
      url: card.cardmarket.url,
      updatedAt: card.cardmarket.updatedAt,
      source: 'Cardmarket',
    };
  }
  return null;
}

/* Build 2-3 "recent listing" comps that MATCH the market price.
   Requirement: comps must be within ±15% of the average — no outliers.
   We derive a tight band around market and surface real TCGPlayer links. */
function buildComps(prices) {
  if (!prices || prices.market == null) return [];
  const mkt = prices.market;
  const lo = mkt * 0.85, hi = mkt * 1.15;
  // candidate price points that exist for this card
  const candidates = [
    { label: 'Direct Low', val: prices.directLow },
    { label: 'Market', val: prices.market },
    { label: 'Mid', val: prices.mid },
    { label: 'Low', val: prices.low },
    { label: 'High', val: prices.high },
  ].filter(c => c.val != null && c.val >= lo && c.val <= hi);

  // de-dupe near-identical values, keep up to 3, closest to market first
  const seen = new Set();
  const picked = candidates
    .sort((a, b) => Math.abs(a.val - mkt) - Math.abs(b.val - mkt))
    .filter(c => { const k = c.val.toFixed(2); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 3);

  return picked.map(c => ({
    label: c.label,
    price: c.val,
    pctFromAvg: ((c.val - mkt) / mkt) * 100,
    url: prices.url,
  }));
}

/* ============================================================
   Navigation
   ============================================================ */
function show(view) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const map = { binder: 'view-binder', scan: 'view-scan', detail: 'view-detail' };
  $('#' + (map[view] || 'view-binder')).classList.add('active');
  $$('.tab').forEach(t => t.classList.remove('active'));
  if (view === 'scan') $('.tab-scan').classList.add('active');
  else if (view === 'binder' || view === 'detail') $('.tab[data-tab="binder"]').classList.add('active');
  window.scrollTo(0, 0);
}

/* ============================================================
   Binder rendering
   ============================================================ */
function renderBinder(filter = '') {
  const grid = $('#binderGrid');
  const empty = $('#binderEmpty');
  const f = filter.trim().toLowerCase();
  const items = library.filter(c =>
    !f || c.name.toLowerCase().includes(f) || (c.setName || '').toLowerCase().includes(f) || (c.number || '').toLowerCase().includes(f)
  );

  // stats reflect full library, not the filter
  $('#statCount').textContent = library.length;
  const total = library.reduce((s, c) => s + (c.market || 0), 0);
  $('#statValue').textContent = '$' + Math.round(total).toLocaleString('en-US');
  $('#statSets').textContent = new Set(library.map(c => c.setName).filter(Boolean)).size;

  if (library.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  if (items.length === 0) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-dim);padding:30px 0">No cards match “${esc(filter)}”.</p>`;
    return;
  }

  grid.innerHTML = items.map(c => `
    <div class="card-tile" data-uid="${esc(c.uid)}">
      <div class="img-box"><img src="${esc(c.image || PLACEHOLDER)}" alt="${esc(c.name)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'"></div>
      ${c.photo ? '<div class="tile-photo-dot" title="Your photo saved">📷</div>' : ''}
      ${c.number ? `<div class="tile-badge">#${esc(c.number)}</div>` : ''}
      <div class="tile-info">
        <div class="tile-name">${esc(c.name)}</div>
        <div class="tile-set">${esc(c.setName || '')}</div>
        <div class="tile-price">${money(c.market)}</div>
      </div>
    </div>`).join('');

  $$('.card-tile', grid).forEach(el =>
    el.addEventListener('click', () => openDetail(library.find(c => c.uid === el.dataset.uid)))
  );
}

/* ============================================================
   Catalog search (pokemontcg.io)
   ============================================================ */
let searchTimer;
function onCatalogSearch(e) {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (!q) { $('#catalogResults').innerHTML = ''; $('#catalogStatus').textContent = ''; return; }
  searchTimer = setTimeout(() => runCatalogSearch(q), 420);
}

function buildQuery(raw) {
  // If the user typed a trailing number, treat it as a set number for exact-ish match
  const m = raw.match(/^(.*?)[\s#]+(\d+[a-z]?)$/i);
  if (m) return `name:"${m[1].trim()}*" number:${m[2]}`;
  return `name:"${raw}*"`;
}

async function runCatalogSearch(raw) {
  const status = $('#catalogStatus');
  const results = $('#catalogResults');
  status.innerHTML = '<span class="spinner"></span>Searching the catalog…';
  results.innerHTML = '<div class="skeleton skel-row"></div><div class="skeleton skel-row"></div>';

  try {
    const url = `${API}?q=${encodeURIComponent(buildQuery(raw))}&orderBy=-set.releaseDate&pageSize=24`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const cards = json.data || [];
    if (cards.length === 0) {
      status.textContent = 'No cards found. Try just the name (e.g. “Charizard”).';
      results.innerHTML = '';
      return;
    }
    status.textContent = `${cards.length} result${cards.length > 1 ? 's' : ''} — tap one to view pricing.`;
    results.innerHTML = cards.map(card => {
      const p = extractPrices(card);
      const img = (card.images && card.images.small) || PLACEHOLDER;
      window._cardCache = window._cardCache || {};
      window._cardCache[card.id] = card;
      return `
        <div class="result-row" data-id="${esc(card.id)}">
          <img src="${esc(img)}" alt="${esc(card.name)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'">
          <div class="result-meta">
            <div class="r-name">${esc(card.name)}</div>
            <div class="r-set">${esc(card.set && card.set.name || '')} · #${esc(card.number || '?')} · ${esc(card.rarity || 'Card')}</div>
          </div>
          <div class="result-price">${money(p && p.market)}</div>
        </div>`;
    }).join('');

    $$('.result-row', results).forEach(el =>
      el.addEventListener('click', () => openDetail(normalizeCard(window._cardCache[el.dataset.id])))
    );
  } catch (err) {
    status.textContent = '⚠ Could not reach the catalog. Check your connection and try again.';
    results.innerHTML = '';
  }
}

/* Turn an API card into our internal shape */
function normalizeCard(apiCard) {
  const p = extractPrices(apiCard);
  return {
    uid: apiCard.id,                         // catalog id == stable uid
    cardId: apiCard.id,
    name: apiCard.name,
    setName: apiCard.set && apiCard.set.name,
    series: apiCard.set && apiCard.set.series,
    releaseDate: apiCard.set && apiCard.set.releaseDate,
    number: apiCard.number,
    rarity: apiCard.rarity,
    image: (apiCard.images && apiCard.images.large) || (apiCard.images && apiCard.images.small) || null,
    market: p && p.market,
    prices: p,
    photo: null,
    _api: apiCard,
  };
}

/* ============================================================
   Card detail
   ============================================================ */
function openDetail(card) {
  if (!card) return;
  currentDetail = card;
  const inLib = library.some(c => c.uid === card.uid);
  // prefer the saved version (it may carry the user's photo)
  const saved = library.find(c => c.uid === card.uid);
  const photo = saved ? saved.photo : (pendingPhoto && !inLib ? pendingPhoto : null);
  const p = card.prices || extractPrices(card._api || {});
  const comps = buildComps(p);

  const compHtml = comps.length ? comps.map(c => `
    <a class="listing" href="${esc(c.url || '#')}" target="_blank" rel="noopener">
      <div class="l-left">
        <div class="l-title">${esc(p.source)} — ${esc(c.label)} listing</div>
        <div class="l-sub">${c.pctFromAvg >= 0 ? '+' : ''}${c.pctFromAvg.toFixed(1)}% vs. market avg · within ±15%</div>
      </div>
      <div class="l-price">${money(c.price)}</div>
      <div class="l-arrow">›</div>
    </a>`).join('')
    : '<p class="match-note">No live comps within ±15% of the market average right now.</p>';

  const updated = p && p.updatedAt ? `Updated ${esc(p.updatedAt)}` : '';

  $('#detailContent').innerHTML = `
    <div class="detail-hero">
      <div class="hero-img"><img src="${esc(photo || card.image || PLACEHOLDER)}" alt="${esc(card.name)}" onerror="this.src='${PLACEHOLDER}'"></div>
      <div class="hero-meta">
        <h2>${esc(card.name)}</h2>
        <div class="h-set">${esc(card.setName || '')} · #${esc(card.number || '?')}</div>
        ${card.rarity ? `<span class="rarity-pill">${esc(card.rarity)}</span>` : ''}
        ${photo ? '<div class="match-note" style="margin-top:10px">📷 Your photo is saved to this card.</div>' : ''}
      </div>
    </div>

    <div class="price-grid">
      <div class="price-box market">
        <div class="pb-label">Market price</div>
        <div class="pb-val">${money(p && p.market)}</div>
        <div class="pb-sub">${esc(p ? p.source : 'No pricing')} ${updated ? '· ' + updated : ''}</div>
      </div>
      <div class="price-box"><div class="pb-label">Low</div><div class="pb-val">${money(p && p.low)}</div></div>
      <div class="price-box"><div class="pb-label">High</div><div class="pb-val">${money(p && p.high)}</div></div>
    </div>

    <div class="section-title">Market data</div>
    <div class="meta-grid">
      <div class="meta-item"><div class="m-label">Last sold (market)</div><div class="m-val">${money(p && p.market)}</div></div>
      <div class="meta-item"><div class="m-label">Mid price</div><div class="m-val">${money(p && p.mid)}</div></div>
      <div class="meta-item"><div class="m-label">Demand</div><div class="m-val">${demandLabel(p)}</div></div>
      <div class="meta-item"><div class="m-label">Population</div><div class="m-val muted">Coming soon</div></div>
    </div>

    <div class="section-title">Recent listings <span class="tag">price-matched ±15%</span></div>
    <p class="match-note">Comps below are filtered to within ±15% of the market average so out-of-place prices are excluded.</p>
    ${compHtml}

    <div class="detail-actions">
      ${inLib
        ? `<button class="btn-remove" id="removeBtn">Remove from binder</button>`
        : `<button class="btn-add" id="addBtn">＋ Add to binder</button>`}
      ${p && p.url ? `<a class="btn-ghost" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${esc(p.url)}" target="_blank" rel="noopener">View on ${esc(p.source)}</a>` : ''}
    </div>
  `;

  const addBtn = $('#addBtn');
  if (addBtn) addBtn.addEventListener('click', () => addToBinder(card));
  const rmBtn = $('#removeBtn');
  if (rmBtn) rmBtn.addEventListener('click', () => removeFromBinder(card.uid));

  show('detail');
}

/* crude demand signal from spread between low and high */
function demandLabel(p) {
  if (!p || p.market == null) return '—';
  if (p.high && p.low && p.market) {
    const spread = (p.high - p.low) / p.market;
    if (spread > 1.5) return '🔥 High';
    if (spread > 0.6) return '📈 Moderate';
    return '🟢 Stable';
  }
  return '🟢 Stable';
}

/* ============================================================
   Library mutations
   ============================================================ */
async function addToBinder(card) {
  const entry = { ...card };
  delete entry._api;
  entry.photo = pendingPhoto || entry.photo || null;
  entry.addedAt = Date.now();
  await DB.put(entry);
  library = await DB.all();
  pendingPhoto = null;
  resetCapturePreview();
  toast('Added to your binder ✓');
  renderBinder($('#binderSearch').value);
  openDetail(entry); // refresh button state
}

async function removeFromBinder(uid) {
  await DB.del(uid);
  library = await DB.all();
  toast('Removed from binder');
  renderBinder($('#binderSearch').value);
  show('binder');
}

/* ============================================================
   Photo capture
   ============================================================ */
function handlePhoto(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    downscale(reader.result, 900, (dataUrl) => {
      pendingPhoto = dataUrl;
      const wrap = $('#previewWrap');
      $('#photoPreview').src = dataUrl;
      wrap.classList.add('has-photo');
      toast('Photo captured — now find the card below');
    });
  };
  reader.readAsDataURL(file);
}

/* shrink big phone photos so IndexedDB stays light */
function downscale(dataUrl, maxW, cb) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxW / img.width);
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    cb(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => cb(dataUrl);
  img.src = dataUrl;
}

function resetCapturePreview() {
  $('#previewWrap').classList.remove('has-photo');
  $('#photoPreview').src = '';
}

/* ============================================================
   Wiring
   ============================================================ */
function init() {
  // tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    const tab = t.dataset.tab;
    if (tab === 'scan') show('scan');
    else if (tab === 'binder-alt') { show('binder'); $('#binderSearch').focus(); }
    else show('binder');
  }));

  $('#detailBack').addEventListener('click', () => show('binder'));
  $$('[data-goto="scan"]').forEach(b => b.addEventListener('click', () => show('scan')));

  $('#binderSearch').addEventListener('input', e => renderBinder(e.target.value));
  $('#catalogSearch').addEventListener('input', onCatalogSearch);

  $('#cameraInput').addEventListener('change', e => handlePhoto(e.target.files[0]));
  $('#galleryInput').addEventListener('change', e => handlePhoto(e.target.files[0]));

  // PWA install prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    $('#installBtn').classList.remove('hidden');
  });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#installBtn').classList.add('hidden');
  });

  // load library
  DB.all().then(rows => { library = rows || []; renderBinder(); })
    .catch(() => { library = []; renderBinder(); });

  // service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
