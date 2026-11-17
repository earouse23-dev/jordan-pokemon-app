import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCollectionIdentificationPhotos } from '../lib/supabase-data.js';
const owner='11111111-1111-4111-8111-111111111111', a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function fixture(rows, failure=null) {
  const filters=[], batches=[];
  const query={select:()=>query,eq:(...args)=>{filters.push(args);return query;},in:(...args)=>{filters.push(args);return query;},order:async()=>({data:rows,error:failure})};
  const client={from:table=>{assert.equal(table,'collection_item_attachments');return query;},storage:{from:bucket=>({createSignedUrls:async(paths,ttl)=>{assert.equal(bucket,'collection-item-files');assert.equal(ttl,300);batches.push(paths);return {data:paths.map(path=>({path,signedUrl:'https://private.example/'+path+'?token=fixture'}))};}})}};
  return {client,filters,batches};
}
test('identification photos use one owner-filtered metadata read and one bounded private signing batch',async()=>{
  const path=`${owner}/${a}/front.jpg`;
  const f=fixture([
    {collection_item_id:a,storage_path:path,caption:'Front identification photo · user confirmed'},
    {collection_item_id:a,storage_path:`${owner}/${a}/old.jpg`,caption:'Front identification photo · user confirmed'},
    {collection_item_id:b,storage_path:`${owner}/${b}/receipt.jpg`,caption:'Receipt'},
    {collection_item_id:b,storage_path:`other-owner/${b}/front.jpg`,caption:'Front identification photo · user confirmed'},
    {collection_item_id:b,storage_path:`${owner}/${b}/../front.jpg`,caption:'Front identification photo · user confirmed'},
  ]);
  assert.deepEqual(await loadCollectionIdentificationPhotos(f.client,owner,[a,b,a,'bad-id']),[{uid:a,url:'https://private.example/'+path+'?token=fixture'}]);
  assert.deepEqual(f.filters,[['user_id',owner],['kind','photo'],['collection_item_id',[a,b]]]);
  assert.deepEqual(f.batches,[[path]]);
});
test('missing photos do not sign artwork or receipts; metadata failure is recoverable',async()=>{
  const f=fixture([]);assert.deepEqual(await loadCollectionIdentificationPhotos(f.client,owner,[a]),[]);assert.equal(f.batches.length,0);
  assert.deepEqual(await loadCollectionIdentificationPhotos(f.client,'not-owner',[a]),[]);
  await assert.rejects(()=>loadCollectionIdentificationPhotos(fixture([],new Error('offline')).client,owner,[a]),/offline/);
});
