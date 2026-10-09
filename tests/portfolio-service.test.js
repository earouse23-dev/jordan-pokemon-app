import test from "node:test";
import assert from "node:assert/strict";
import { portfolioService } from "../lib/portfolio-service.js";
const owner = "11111111-1111-4111-8111-111111111111";
const response = () => ({
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(n) {
    this.statusCode = n;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
test("saved views are owner scoped, refresh failures preserve the published view, and cron rejects browser tokens", async (t) => {
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: "https://portfolio-fixture.supabase.co",
    SUPABASE_SECRET_KEY: "fixture-service",
    CRON_SECRET: "fixture-cron",
  })) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    });
  }
  const saved = {
    version: 1,
    complete: true,
    updatedAt: "2026-01-01T00:00:00Z",
    summaries: [
      {
        currency: "USD",
        total: 400,
        history: [{ date: "2026-01-01", total: 400 }],
      },
    ],
  };
  let stored = structuredClone(saved),
    paid = 0, readFailure = true;
  t.mock.method(globalThis, "fetch", async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url || input);
    if (url.hostname !== "portfolio-fixture.supabase.co") {
      paid++;
      throw Error("Unexpected provider request");
    }
    if (url.pathname.endsWith("/auth/v1/user"))
      return Response.json({ id: owner });
    if (url.pathname.endsWith("/rpc/claim_portfolio_refresh"))
      return Response.json(true);
    if (url.pathname.endsWith("/portfolio_views")) {
      assert.equal(url.searchParams.get("user_id"), "eq." + owner);
      if (init.method === "PATCH") {
        const patch = JSON.parse(init.body);
        if (patch.view) stored = patch.view;
        return new Response(null, { status: 204 });
      }
      return Response.json({ view: stored });
    }
    if (url.pathname.endsWith("/collection_items") && !readFailure) return Response.json([]);
    if (url.pathname.endsWith("/collection_items"))
      return Response.json(
        { message: "Fixture read failure", code: "fixture_failure" },
        { status: 503 },
      );
    throw Error("Unexpected database path " + url.pathname);
  });
  let res = response();
  await portfolioService(
    {
      method: "GET",
      headers: { authorization: "Bearer fixture-user" },
      query: { surface: "portfolio", user_id: "other" },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.view, saved);
  res = response();
  await portfolioService(
    {
      method: "POST",
      headers: { authorization: "Bearer fixture-user" },
      query: { surface: "portfolio" },
    },
    res,
  );
  assert.equal(res.statusCode, 503);
  assert.deepEqual(stored, saved);
  assert.equal(paid, 0);
  readFailure = false;
  res = response();
  await portfolioService({method:"POST",headers:{authorization:"Bearer fixture-user"},query:{surface:"portfolio"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(stored.summaries[0].total,0);
  assert.equal(stored.complete,true);
  assert.equal(stored.inventoryKey,"[]");
  assert.equal(paid,0);
  for (const request of [
    { method: "POST", headers: {}, query: { surface: "portfolio" } },
    {
      method: "GET",
      headers: { authorization: "Bearer fixture-user" },
      query: { surface: "portfolio-sync" },
    },
  ]) {
    res = response();
    await portfolioService(request, res);
    assert.equal(res.statusCode, 401);
  }
});

test('service history uses an explicit owner and exhausted first refresh recovers the legacy snapshot', async t => {
 const {createClient}=await import('@supabase/supabase-js');
 const {loadPortfolio}=await import('../lib/supabase-data.js');
 const {refreshPortfolioView}=await import('../lib/portfolio-service.js');
 const {pkmnPricesRequests}=await import('../lib/pkmnprices-requests.js');
 const {hasPortfolioValue}=await import('../lib/portfolio-view.js');
 const uid='22222222-2222-4222-8222-222222222222';
 let stored={version:1,updatedAt:'2026-01-01T00:00:00Z',summaries:[{currency:'USD',total:null,knownTotal:null,history:[]}],pricing:[]},legacy=true,ownerHistoryReads=0;
 t.mock.method(pkmnPricesRequests,'claim',async()=>{throw Object.assign(Error('Daily limit'),{code:'provider_daily_budget_reached',status:429});});
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const u=new URL(typeof input==='string'?input:input.url||input);
  assert.equal(u.hostname,'portfolio-recovery-fixture.supabase.co','No external provider network request');
  const table=u.pathname.split('/').at(-1);
  if(table==='claim_portfolio_refresh')return Response.json(true);
  if(table==='get_portfolio_price_history')throw Error('Service clients cannot use auth.uid() history RPC');
  if(table==='portfolio_views'){
   assert.equal(u.searchParams.get('user_id'),'eq.'+owner);
   if(init.method==='PATCH'){const p=JSON.parse(init.body);if(p.view)stored=p.view;return new Response(null,{status:204});}
   return Response.json({view:stored});
  }
  if(table==='valuation_snapshots'){assert.equal(u.searchParams.get('user_id'),'eq.'+owner);return Response.json(legacy?[{total:400,currency:'USD',priced_items:2,unpriced_items:1,snapshot_date:'2026-01-01',observed_at:'2026-01-01T12:00:00Z'}]:[]);}
  if(table==='collection_items'){assert.equal(u.searchParams.get('user_id'),'eq.'+owner);return Response.json([{id:uid,user_id:owner,quantity:1,currency:'USD',card_state:'raw',status:'owned',raw_condition:'near_mint',identity_snapshot:{id:'fixture',name:'Fixture',set:'Fixture',number:'1',variant:'Holofoil',externalIds:{pkmnprices:'123'}}}]);}
  if(table==='position_price_observations'){assert.equal(u.searchParams.get('user_id'),'eq.'+owner);ownerHistoryReads++;return Response.json([{collection_item_id:uid,provider:'tcgplayer',currency:'USD',finish:'holofoil',provider_condition:'Near Mint',amount:100,observed_at:'2026-01-01T00:00:00Z'}]);}
  return Response.json([]);
 });
 const db=createClient('https://portfolio-recovery-fixture.supabase.co','fixture-service',{auth:{persistSession:false}});
 const items=await loadPortfolio(db,owner,{serverOwnerRead:true});assert.equal(items[0].priceHistory[0].amount,100);
 const view=await refreshPortfolioView(db,owner,{pkmnpricesApiKey:'fixture'}, {now:'2026-01-02T12:00:00Z'});
 assert.equal(view.summaries[0].knownTotal,400);assert.equal(view.summaries[0].missingUnits,1);assert.equal(view.updatedAt,'2026-01-01T12:00:00Z');assert.equal(view.refreshReason,'provider_daily_budget_reached');assert.equal(view.pendingPricing[0].priceHistory[0].amount,100);assert.ok(ownerHistoryReads>=3);
 legacy=false;stored=null;
 const first=await refreshPortfolioView(db,owner,{pkmnpricesApiKey:'fixture'},{now:'2026-01-02T12:00:00Z'});assert.equal(hasPortfolioValue(first),false);assert.equal(first.updatedAt,undefined,'failed first refresh is not a newly updated empty valuation');
});
