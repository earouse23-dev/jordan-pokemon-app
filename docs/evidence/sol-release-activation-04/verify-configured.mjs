// Focused checks against the actual prebuilt files; no hosted writes/provider calls.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const evidence=import.meta.dirname,stage='/tmp/mica-activation-04-configured';
const manifest=JSON.parse(await fs.readFile(path.join(evidence,'configured-manifest.json')));
for(const item of manifest.deployment)assert.equal(createHash('sha256').update(await fs.readFile(path.join(stage,item.path))).digest('hex'),item.sha256,item.path);
const output=JSON.parse(await fs.readFile(path.join(stage,'.vercel/output/config.json')));
assert.equal(output.version,3);
assert.deepEqual(output.crons,[{path:'/api/capabilities?surface=grading-deletion',schedule:'15 5 * * *'}]);
const pub=JSON.parse(await fs.readFile(path.join(evidence,'public-config.json')));
Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:pub.supabaseUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:pub.supabasePublishableKey,
  SUPABASE_SECRET_KEY:'synthetic-server-secret',PKMNPRICES_API_KEY:'synthetic-paid-key',JUSTTCG_API_KEY:'synthetic-paid-key',JUSTTCG_COMMERCIAL_LICENSE_APPROVED:'true',
  AI_GATEWAY_API_KEY:'synthetic-paid-key',VERCEL_OIDC_TOKEN:'synthetic-oidc',VERCEL:'1',PKMNPRICES_PLAN:'pro',RESEND_API_KEY:'synthetic-delivery-key',CRON_SECRET:'synthetic-cron'});
let requests=[];
globalThis.fetch=async input=>{requests.push(String(input));throw Error('Unexpected outbound request');};
const load=async name=>(await import(pathToFileURL(path.join(stage,`.vercel/output/functions/api/${name}.func/index.mjs`)))).default;
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;return this;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(){return this;}});
const blocked=['vision','graded-valuation','sales','offers','sealed','price-sync','maintenance','alert-delivery'];
for(const name of blocked) {
  const handler=await load(name),res=response();
  await handler({method:name==='vision'||name==='graded-valuation'?'POST':'GET',headers:{authorization:'Bearer synthetic-authorized',host:'jordan-pokemon-app.vercel.app'},query:{},body:{}},res);
  assert.equal(res.statusCode,503,name);assert.equal(res.body.code,'release_hold',name);assert.equal(requests.length,0,name);
  const denied=response();await handler({method:'GET',headers:{origin:'https://untrusted.example',host:'jordan-pokemon-app.vercel.app'}},denied);assert.equal(denied.statusCode,403);
}
const caps=await load('capabilities'),res=response();await caps({method:'GET',headers:{},query:{}},res);
assert.equal(res.statusCode,200);assert.equal(res.body.vision.status,'release_hold');assert.equal(res.body.advisor.status,'release_hold');
assert.equal(res.body.pricing.status,'public_fallback');assert.equal(res.body.notifications.email,'release_hold');assert.equal(res.body.notifications.inApp,'active');
const deletion=response();await caps({method:'GET',headers:{},query:{surface:'grading-deletion'}},deletion);assert.equal(deletion.statusCode,401);assert.equal(requests.length,0);
const account=response();await (await load('account'))({method:'DELETE',headers:{},query:{}},account);assert.equal(account.statusCode,401);assert.equal(requests.length,0);
globalThis.fetch=async input=>{const url=String(input);assert(url.startsWith(pub.supabaseUrl+'/'),url);requests.push(url);return new Response('{}',{status:200});};
const health=response();await (await load('health'))({method:'GET',headers:{},query:{}},health);assert.equal(health.statusCode,200);
assert.equal(health.body.services.pricingProvider,'release_hold');assert.equal(requests.length,2);
// An expected private-table rejection is distinct from a bad key or outage.
requests=[];
globalThis.fetch=async input=>{const url=String(input);assert(url.startsWith(pub.supabaseUrl+'/'));requests.push(url);return url.includes('/rest/')
  ? new Response(JSON.stringify({code:'42501'}),{status:401}) : new Response('{}',{status:200});};
const restricted=response();await (await load('health'))({method:'GET',headers:{},query:{}},restricted);
assert.equal(restricted.statusCode,200);assert.equal(restricted.body.services.appSchema,'access_restricted');
assert.equal(restricted.body.services.schemaVerification,'requires_authenticated_acceptance');
globalThis.fetch=async input=>String(input).includes('/rest/') ? new Response(JSON.stringify({code:'invalid_key'}),{status:401}) : new Response('{}',{status:200});
const invalid=response();await (await load('health'))({method:'GET',headers:{},query:{}},invalid);assert.equal(invalid.statusCode,503);
globalThis.fetch=async()=>{throw Error('synthetic outage');};
const outage=response();await (await load('health'))({method:'GET',headers:{},query:{}},outage);assert.equal(outage.statusCode,503);
requests=[];
globalThis.fetch=async input=>{const url=String(input);assert(url.startsWith('https://api.tcgdex.net/'),url);requests.push(url);return new Response(JSON.stringify({id:'base1-1',name:'Synthetic',localId:'1',set:{name:'Base',id:'base1'},pricing:{}}),{status:200});};
const cards=response();await (await load('cards'))({method:'GET',headers:{},query:{lookups:JSON.stringify([{clientId:'synthetic',tcgdexId:'base1-1'}])}},cards);
assert.equal(cards.statusCode,200);assert(requests.length>0);assert(requests.every(url=>url.startsWith('https://api.tcgdex.net/')));
// Verify deletion/withdrawal dependencies and public APIs still import successfully.
for(const name of (await fs.readdir(path.join(stage,'.vercel/output/functions/api'))).map(x=>x.replace('.func','')))assert.equal(typeof await load(name),'function');
for(const item of manifest.source.filter(x=>/\.m?js$/.test(x.path)))execFileSync(process.execPath,['--check',path.join(stage,item.path)]);
const serialized=await fs.readFile(path.join(stage,'dist/app-config.js'),'utf8');assert(serialized.includes(pub.supabasePublishableKey));assert(!serialized.includes('synthetic-server-secret'));
for(const item of manifest.deployment) {
  assert(!/(?:^|\/)(?:\.env|internal|tests)(?:[./]|$)|\.map$|certificate-fixture/.test(item.path));
  if(!/\.(?:js|mjs|json|html|css)$/.test(item.path))continue;
  const text=await fs.readFile(path.join(stage,item.path),'utf8');
  assert(!/sb_secret_[A-Za-z0-9_-]+/.test(text),item.path);
  for(const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    const payload=JSON.parse(Buffer.from(token[0].split('.')[1],'base64url'));assert.notEqual(payload.role,'service_role',item.path);
  }
  assert(!text.includes('synthetic-server-secret')&&!text.includes('synthetic-paid-key'),item.path);
}
console.log(JSON.stringify({artifactFilesVerified:manifest.deployment.length,heldRoutes:blocked.length,hostileOriginChecks:blocked.length,capabilitiesHonest:true,
  deletionAuthPreserved:true,accountAuthPreserved:true,healthSupabaseOnly:true,cardsPublicOnlyWithPaidKeys:true,all16FunctionsImport:true,sourceSyntax:true,privilegedCredentialScan:true,outboundCallsReal:0}));
