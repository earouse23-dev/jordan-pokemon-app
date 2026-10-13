import assert from "node:assert/strict";
import test from "node:test";
import { listPrivateBucketPaths } from "../api/account.js";

test("account storage inventory includes root files and recursively paginates folders", async () => {
  const rootFiles = Array.from({ length: 101 }, (_, index) => ({
    id: `root-${index}`,
    name: `root-${String(index).padStart(3, "0")}.jpg`,
  }));
  const listings = new Map([
    ["owner", [...rootFiles, { id: null, name: "scan" }]],
    ["owner/scan", [{ id: null, name: "nested" }]],
    ["owner/scan/nested", [{ id: "deep", name: "capture.jpg" }]],
  ]);
  const list = async (prefix, { limit, offset }) => ({
    data: (listings.get(prefix) || []).slice(offset, offset + limit),
    error: null,
  });
  const database = {
    storage: { from: () => ({ list }) },
  };

  const inventory = await listPrivateBucketPaths(
    database,
    "owner",
    "grading-research",
  );

  assert.equal(inventory.paths.length, 102);
  assert.ok(inventory.paths.includes("owner/root-000.jpg"));
  assert.ok(inventory.paths.includes("owner/root-100.jpg"));
  assert.ok(inventory.paths.includes("owner/scan/nested/capture.jpg"));
});

test("unrelated profile saves preserve an existing currency; explicit supported changes are bounded", async () => {
  const { saveProfile } = await import("../lib/supabase-data.js");
  const stored = { id: "fixture-owner", display_currency: "EUR", preferences: {} };
  const payloads = [];
  const query = {
    upsert(row) { payloads.push(row); Object.assign(stored, row); return query; },
    select() { return query; },
    async single() { return { data: { ...stored }, error: null }; },
  };
  const client = { auth: { getUser: async () => ({ data: { user: { id: stored.id } } }) }, from: table => { assert.equal(table, "profiles"); return query; } };
  const saved = await saveProfile(client, { displayName: "Fixture name", preferences: {} });
  assert.equal(saved.displayCurrency, "EUR");
  assert.equal(Object.hasOwn(payloads[0], "display_currency"), false);
  assert.equal((await saveProfile(client, { displayCurrency: "USD" })).displayCurrency, "USD");
  await assert.rejects(saveProfile(client, { displayCurrency: "invalid" }), /Unsupported display currency/);
  assert.equal(payloads.length, 2, "invalid currency never reaches persistence");
});

test('account deletion keeps failures retryable and never deletes the account before private cleanup succeeds', async t => {
  const {default: handler}=await import('../api/account.js');
  const owner='77777777-1111-4111-8111-111111111111';
  t.mock.property(process,'env',{...process.env,NEXT_PUBLIC_SUPABASE_URL:'https://account-fixture.supabase.co',SUPABASE_SECRET_KEY:'fixture-service-key'});
  let failure,removed=new Set(),deleted=false,events=[];
  t.mock.method(globalThis,'fetch',async(input,init={})=>{
    const url=new URL(input instanceof Request?input.url:input);
    assert.equal(url.origin,'https://account-fixture.supabase.co','No real account request');
    const path=url.pathname;
    const fail=stage=>failure===stage?Response.json({message:'Synthetic failure'},{status:500}):null;
    if(path==='/auth/v1/user')return Response.json({id:owner,email:'owner@example.invalid'});
    if(path.includes('/object/list/')){
      const body=JSON.parse(init.body); assert.equal(body.prefix,owner);
      return fail('inventory')||Response.json(removed.has(path.split('/').at(-1))?[]:[{id:'fixture-object',name:'photo.jpg'}]);
    }
    if(path.endsWith('/rpc/grading_withdraw_account_training_service')){
      assert.equal(JSON.parse(init.body).p_owner_id,owner);events.push('withdraw');return fail('withdraw')||Response.json(null);
    }
    if(path.includes('/storage/v1/object/')){
      const body=JSON.parse(init.body);assert.deepEqual(body.prefixes,[owner+'/photo.jpg']);
      events.push('remove');const error=fail('remove');if(error)return error;removed.add(path.split('/').at(-1));return Response.json([]);
    }
    if(path==='/auth/v1/logout'){events.push('revoke');return fail('revoke')||Response.json({});}
    if(path==='/auth/v1/admin/users/'+owner){assert.equal(init.method,'DELETE');events.push('delete');const error=fail('delete');if(error)return error;deleted=true;return Response.json({id:owner});}
    throw Error('Unexpected account operation '+path);
  });
  const invoke=async()=>{
    const res={setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
    await handler({method:'DELETE',headers:{authorization:'Bearer fixture-owner'},body:{confirmation:'owner@example.invalid'}},res);return res;
  };
  for(const stage of ['inventory','withdraw','remove','revoke','delete']){
    failure=stage;removed=new Set();deleted=false;events=[];
    assert.equal((await invoke()).statusCode,500);assert.equal(deleted,false);
    if(['inventory','withdraw','remove'].includes(stage))assert.equal(events.includes('delete'),false);
    failure=null;assert.equal((await invoke()).statusCode,200);assert.equal(deleted,true);
    assert.equal(removed.size,4);assert(events.lastIndexOf('delete')>events.lastIndexOf('remove'));
  }
});
