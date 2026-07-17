export function money(value, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value));
}

export function calculateTotals(items) {
  return items.reduce((acc, item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const cost = Number(item.cost);
    const price = Number(item.price);
    const hasCost = item.cost !== null && item.cost !== undefined && item.cost !== '' && Number.isFinite(cost) && cost >= 0;
    const hasPrice = item.price !== null && item.price !== undefined && item.price !== '' && Number.isFinite(price) && price >= 0;
    acc.quantity += quantity;
    if (hasCost) {
      acc.cost += cost * quantity;
      acc.costKnown += quantity;
    } else {
      acc.unknownCost += quantity;
    }
    if (!hasPrice) {
      acc.unpriced += quantity;
    } else {
      acc.value += price * quantity;
      acc.priced += quantity;
      if (hasCost) {
        acc.comparableValue += price * quantity;
        acc.comparableCost += cost * quantity;
        acc.gainCoverage += quantity;
      }
    }
    return acc;
  }, { quantity:0, cost:0, costKnown:0, unknownCost:0, value:0, priced:0, unpriced:0, comparableValue:0, comparableCost:0, gainCoverage:0 });
}

export function portfolioSnapshot(items,{includePerformance=false,date=new Date().toISOString().slice(0,10)}={}) {
  const totals=calculateTotals(items);
  const positions=[...items].filter(item=>item.price!==null&&item.price!==undefined&&Number.isFinite(Number(item.price))).sort((a,b)=>Number(b.price)*Number(b.quantity||0)-Number(a.price)*Number(a.quantity||0)).slice(0,5);
  const lines=[
    'My Mica Pokémon collection',
    `${totals.quantity} card${totals.quantity===1?'':'s'} across ${items.length} position${items.length===1?'':'s'}`,
    `Estimated market value: ${money(totals.value)}`,
    `Pricing coverage: ${totals.priced} of ${totals.quantity} cards`,
  ];
  if(includePerformance){
    lines.push(`Recorded cost basis: ${totals.costKnown?money(totals.cost):'Unavailable'}`);
    lines.push(`Known gain/loss: ${totals.gainCoverage?`${totals.comparableValue-totals.comparableCost>=0?'+':''}${money(totals.comparableValue-totals.comparableCost)}`:'Unavailable'}`);
  }
  if(positions.length){lines.push('','Top positions:');positions.forEach((item,index)=>lines.push(`${index+1}. ${item.name} · ${item.set} ${item.number} · ${money(Number(item.price)*Number(item.quantity||0))}`));}
  lines.push('',`Snapshot ${date} · Matching market references, not an appraisal.`,'Shared from Mica');
  return lines.join('\n');
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

function csvRows(text) {
  const source=String(text);const rows=[];let row=[];let cell='';let quoted=false;
  for(let index=0;index<source.length;index+=1){
    const char=source[index];const next=source[index+1];
    if(char==='"'&&quoted&&next==='"'){cell+='"';index+=1;continue;}
    if(char==='"'){quoted=!quoted;continue;}
    if(char===','&&!quoted){row.push(cell);cell='';continue;}
    if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&next==='\n')index+=1;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell='';continue;}
    cell+=char;
  }
  row.push(cell);if(row.some(value=>value.trim()))rows.push(row);
  return rows;
}

export function parseCollectionCsv(text, limit=5000) {
  const rows=csvRows(text);
  if(rows.length<2)return {records:[],errors:['No data rows found']};
  const headers=rows[0].map(value=>value.trim().toLowerCase().replace(/\s+/g,'_'));
  const missing=['name','quantity'].filter(header=>!headers.includes(header));
  if(missing.length)return {records:[],errors:[`Missing required column${missing.length===1?'':'s'}: ${missing.join(', ')}`]};
  const records=[];const errors=[];
  rows.slice(1,limit+1).forEach((values,rowIndex)=>{
    const source=Object.fromEntries(headers.map((header,index)=>[header,String(values[index]??'').trim()]));
    const quantity=Number(source.quantity);const cost=source.purchase_price===''?null:Number(source.purchase_price);const price=source.market_reference===''?null:Number(source.market_reference);
    if(!source.name){errors.push(`Row ${rowIndex+2}: card name is blank`);return;}
    if(!Number.isInteger(quantity)||quantity<1||quantity>999){errors.push(`Row ${rowIndex+2}: quantity must be a whole number from 1 to 999`);return;}
    if(cost!==null&&(!Number.isFinite(cost)||cost<0)){errors.push(`Row ${rowIndex+2}: purchase price is invalid`);return;}
    if(price!==null&&(!Number.isFinite(price)||price<0)){errors.push(`Row ${rowIndex+2}: market reference is invalid`);return;}
    records.push({name:source.name,set:source.set||'',number:source.number||'',variant:source.variant||'Unknown',condition:source.condition||'Near Mint',gradingCompany:source.grading_company||'',grade:source.grade||'',quantity,cost,price,tags:(source.tags||'').split('|').map(value=>value.trim()).filter(Boolean),location:source.storage_location||'',notes:source.notes||''});
  });
  if(rows.length-1>limit)errors.push(`Only the first ${limit} records can be imported at once`);
  return {records,errors};
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
