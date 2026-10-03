// Local aggregate checks only; never emits customer rows or identifiers.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const baseline = process.argv[2] || 'mica-activation-baseline-20260930';
const upgraded = process.argv[3] || 'mica-activation-rehearsal-20260930';
const psql = (container, sql) => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At'], { input: sql, encoding: 'utf8', maxBuffer: 8e6 });
const columns = JSON.parse(psql(baseline, `select jsonb_agg(row_to_json(c) order by table_schema,table_name,ordinal_position) from information_schema.columns c where table_schema in ('public','grading_private','auth','storage','supabase_migrations') and exists(select 1 from information_schema.tables t where t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE');`));
const tables = new Map();
for (const c of columns) {
  const key = `${c.table_schema}.${c.table_name}`;
  if (!tables.has(key)) tables.set(key, []);
  tables.get(key).push(c);
}
const quote = s => '"' + s.replaceAll('"', '""') + '"';
function query(preserve) {
  const pieces = [];
  for (const [key, cols] of tables) {
    const projection = cols.filter(c => !(preserve && c.table_schema === 'public' && c.column_name === 'updated_at')).map(c => {
      let value = `to_jsonb(t.${quote(c.column_name)})`;
      if (preserve && key === 'public.profiles' && c.column_name === 'preferences') value = `(${value}-'softwareMode')`;
      return `select '${c.column_name}' k, ${value} v`;
    }).join(' union all ');
    // Buckets intentionally gain a private attachment bucket; compare existing data separately.
    const where = preserve && key === 'storage.buckets' ? " where id<>'collection-item-files'" : '';
    pieces.push(`select '${key}' as relation,count(*) as rows,md5(coalesce(string_agg(h,E'\\n' order by h),'')) as digest from (select md5((select jsonb_object_agg(k,v) from (${projection}) c)::text) h from ${cols[0].table_schema}.${quote(cols[0].table_name)} t${where}) h`);
  }
  return `select jsonb_agg(row_to_json(s) order by relation) from (${pieces.join(' union all ')}) s;`;
}
const before = JSON.parse(psql(baseline, query(true)));
const after = JSON.parse(psql(upgraded, query(true)));
const differences = before.filter((x, i) => JSON.stringify(x) !== JSON.stringify(after[i]));
console.log(JSON.stringify({ checkedRelations: before.length, differences: differences.map(x => ({ relation: x.relation, beforeRows: x.rows, afterRows: after.find(y => y.relation === x.relation).rows })), counts: before.filter(x => ['public.collection_items','public.collection_transactions','public.purchase_lots','auth.users','storage.objects'].includes(x.relation)) }));
assert.deepEqual(differences, [], 'Unexpected original-record change');
