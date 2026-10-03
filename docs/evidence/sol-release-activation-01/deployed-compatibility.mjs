// Actual deployed JS -> installed Supabase client -> isolated PostgREST/PostgreSQL.
// No host port, real account, Auth service, Storage service or provider is used.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHmac, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createGradingScanSession, saveGradingScanReport, confirmGradingPrediction } from '../../../lib/supabase-data.js';
const container = 'mica-consent-rehearsal';
assert.equal(execFileSync('docker',['inspect','--format','{{.HostConfig.NetworkMode}}',container],{encoding:'utf8'}).trim(),'none');
const sourcePath = '/Users/elliottrouse/Mica Recovery/20260930T014818Z-kdkzdflrxajfdcithrfj/activation-rehearsal/deployed-supabase-data.js';
const source = readFileSync(sourcePath,'utf8');
const dependency = pathToFileURL(createRequire(import.meta.url).resolve('@supabase/supabase-js')).href;
const deployed = await import('data:text/javascript;base64,'+Buffer.from(source.replace('"@supabase/supabase-js"',JSON.stringify(dependency))).toString('base64'));
const sql = text => execFileSync('docker',['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-At'],{input:text,encoding:'utf8'}).trim();
const owners = [randomUUID(),randomUUID()];
const secret = 'synthetic-consent-test-secret-32-characters';
function token(owner) {
  const encode = x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const payload = encode({alg:'HS256',typ:'JWT'})+'.'+encode({role:'authenticated',sub:owner,exp:Math.floor(Date.now()/1000)+3600});
  return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
let requests = 0;
function client(owner) {
  return createClient('http://127.0.0.1:3001','synthetic-public-key',{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+token(owner)},fetch:async (input,init={})=>{
      const url=new URL(String(input));
      assert.equal(url.hostname,'127.0.0.1');
      url.pathname=url.pathname.replace(/^\/rest\/v1/,'');
      const args=['exec','-i',container,'curl','-sS','-X',init.method||'GET'];
      for (const [name,value] of new Headers(init.headers)) args.push('-H',name+': '+value);
      if (init.body!==undefined) args.push('--data-binary','@-');
      args.push('-w','\n%{http_code}',url.href);
      const raw=execFileSync('docker',args,{input:init.body||'',encoding:'utf8'});
      const split=raw.lastIndexOf('\n'); const status=Number(raw.slice(split+1));
      requests++;
      return new Response(status===204?null:raw.slice(0,split),{status,headers:{'content-type':'application/json'}});
    }}
  });
}
try {
  for(const owner of owners) sql(`insert into auth.users(id) values('${owner}');`);
  const first=client(owners[0]),other=client(owners[1]);
  const saved=[];
  for(const [cardState,currency] of [['raw','USD'],['sealed','EUR'],['graded','USD']]) {
    const id=await deployed.createPosition(first,{identity:{name:'Synthetic compatibility',set:'Test',number:'001',language:'en',variant:cardState,providerCardId:'synthetic-'+randomUUID(),identityStatus:'confirmed'},cardState,rawCondition:'near_mint',grader:'PSA',grade:9,quantity:1,transactionDate:'2026-09-01',unitPrice:10,currency,idempotencyKey:randomUUID()});
    saved.push({id,cardState,currency});
  }
  let reopened=await deployed.loadPortfolio(client(owners[0]),owners[0]);
  assert.equal(reopened.length,3);
  assert.deepEqual(await deployed.loadPortfolio(other,owners[1]),[]);
  assert.equal((await other.from('collection_items').select('id').in('id',saved.map(x=>x.id))).data.length,0);
  const sale={collectionItemId:saved[2].id,quantity:1,transactionDate:'2026-09-20',unitPrice:30,currency:'USD',idempotencyKey:randomUUID()};
  const saleId=await deployed.recordSale(first,sale);
  // The unchanged legacy RPC validates quantity before its unique retry key.
  // Assert the existing error AND exactly one sale, rather than inventing a successful retry contract.
  await assert.rejects(deployed.recordSale(first,sale),error=>error.message==='insufficient_quantity');
  const sales=await first.from('collection_transactions').select('id').eq('collection_item_id',saved[2].id).eq('transaction_type','sale');
  assert.deepEqual(sales.data,[{id:saleId}]);
  const wrappedRetry=await first.rpc('record_graded_copy_sale',{p_collection_item_id:saved[2].id,p_transaction_date:sale.transactionDate,p_quantity:1,p_unit_price:30,p_currency:'USD',p_idempotency_key:sale.idempotencyKey});
  assert.ifError(wrappedRetry.error);
  assert.equal(wrappedRetry.data,saleId);
  reopened=await deployed.loadPortfolio(client(owners[0]),owners[0]);
  assert.equal(reopened.find(x=>x.uid===saved[2].id).quantity,0);
  assert.equal(reopened.find(x=>x.uid===saved[1].id).currency,'EUR');
  const denied=await other.rpc('record_collection_sale',{p_collection_item_id:saved[0].id,p_transaction_date:'2026-09-20',p_quantity:1,p_unit_price:30,p_currency:'USD'});
  assert.ok(denied.error);
  await deployed.updatePosition(first,saved[0].id,{notes:'Synthetic correction',tags:['synthetic']});
  assert.equal((await first.from('collection_items').select('notes').eq('id',saved[0].id).single()).data.notes,'Synthetic correction');
  const correction={collectionItemId:saved[0].id,identity:{name:'Synthetic corrected',set:'Test',number:'002',language:'en',variant:'Normal',providerCardId:'synthetic-corrected',externalIds:{}}};
  assert.equal(await deployed.remapCollectionPosition(first,correction),saved[0].id);
  await assert.rejects(deployed.remapCollectionPosition(other,correction),error=>error.message==='position_not_found');
  assert.equal((await first.from('identity_corrections').select('id').eq('collection_item_id',saved[0].id)).data.length,1);
  // Auth service is deliberately absent: only this identity lookup is a fixture.
  first.auth.getUser=async()=>({data:{user:{id:owners[0]}},error:null});
  const profile=await deployed.loadProfile(first);
  assert.equal(profile.id,owners[0]);
  sql(`insert into public.grading_research_consents(user_id,consented,consent_version,consented_at,training_allowed,outcome_linkage_allowed,retention_policy_version) values('${owners[0]}',true,'mica-grading-research-v2',now(),true,true,'synthetic');`);
  const session=await createGradingScanSession(first,{collectionItemId:saved[0].id,identitySnapshot:correction.identity,idempotencyKey:randomUUID(),modelBundleVersion:'mica-pregrade-v2'});
  const captures=['front','back','alternate_front','alternate_back'].map((captureType,i)=>({captureType,side:captureType.includes('back')?'back':'front',width:100,height:100,imageHash:String(i+1).repeat(64)}));
  const prediction=marker=>({collectionItemId:saved[0].id,conditionStatus:'estimate',conditionScore:7,conditionLow:6,conditionHigh:8,professionalPredictionStatus:'unavailable',pregradeScore:7,pregradeBasis:'visible_condition_measurement',modelBundleVersion:'mica-pregrade-v2',rubricVersion:'synthetic-rubric',calibrationVersion:'synthetic-calibration',confidence:0.8,reportSnapshot:{marker}});
  const report=await saveGradingScanReport(first,{scanSessionId:session,captures,prediction:prediction('original')});
  await confirmGradingPrediction(first,{scanSessionId:session,collectionItemId:saved[0].id});
  assert.equal(await saveGradingScanReport(first,{scanSessionId:session,captures,prediction:prediction('replayed')}),report);
  const retained=await first.from('grading_predictions').select('estimate_status,report_snapshot').eq('id',report).single();
  assert.ifError(retained.error);
  assert.equal(retained.data.estimate_status,'confirmed');
  assert.equal(retained.data.report_snapshot.marker,'original');
  assert.equal(sql(`select count(*) from grading_private.training_examples where owner_id='${owners[0]}';`),'0');
  console.log(JSON.stringify({sourceSha256:createHash('sha256').update(source).digest('hex'),requests,rawSealedGradedSave:true,newClientReopen:true,ownerIsolation:true,legacyRetryRejectedWithoutDuplicate:true,gradedWrapperRetrySameId:true,selectedCopySold:true,nativeEurPreserved:true,legacyRemapAudited:true,legacyUpdateAndProfile:true,candidateConfirmedReportPreserved:true,normalSessionResearchDenied:true}));
} finally {
  for(const owner of owners) sql(`delete from auth.users where id='${owner}';`);
}
