export function money(value, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value));
}

export function calculateTotals(items) {
  return items.reduce((acc, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    acc.quantity += quantity;
    acc.cost += (Number(item.cost) || 0) * quantity;
    if (item.price === null || item.price === undefined || Number.isNaN(Number(item.price))) {
      acc.unpriced += quantity;
    } else {
      acc.value += Number(item.price) * quantity;
      acc.priced += quantity;
    }
    return acc;
  }, { quantity: 0, cost: 0, value: 0, priced: 0, unpriced: 0 });
}

export function isStale(updatedAt, now = Date.now(), thresholdDays = 7) {
  const observed = new Date(updatedAt).getTime();
  return !Number.isFinite(observed) || now - observed > thresholdDays * 86400000;
}

export function safeCsvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function collectionToCsv(items) {
  const headers = ['name','set','number','variant','condition','grading_company','grade','quantity','purchase_price','market_reference','tags','storage_location','notes'];
  const rows = items.map(item => [item.name,item.set,item.number,item.variant,item.condition,item.gradingCompany,item.grade,item.quantity,item.cost,item.price,(item.tags || []).join('|'),item.location,item.notes].map(safeCsvCell).join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim();
}

export function matchesSearch(item, query) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const haystack = normalizeSearch([item.name, item.set, item.number, item.variant, item.rarity, ...(item.tags || [])].join(' '));
  return q.split(' ').every(token => haystack.includes(token));
}
