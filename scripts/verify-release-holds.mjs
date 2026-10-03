// Offline checks for the committed release boundary, including populated provider credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
Object.assign(process.env,{PKMNPRICES_API_KEY:'synthetic-paid',JUSTTCG_API_KEY:'synthetic-paid',AI_GATEWAY_API_KEY:'synthetic-paid',VERCEL_OIDC_TOKEN:'synthetic-oidc',RESEND_API_KEY:'synthetic-paid',CRON_SECRET:'synthetic-cron'});
let outbound=0;globalThis.fetch=async()=>{outbound++;throw Error('Unexpected network request');};
const response=()=>({setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}});
for(const name of ['vision','graded-valuation','sales','offers','sealed','price-sync','maintenance','alert-delivery']){
 const {default:handler}=await import(`../api/${name}.js`),r=response();await handler({method:'GET',headers:{},query:{},body:{}},r);assert.equal(r.statusCode,503,name);assert.equal(r.body.code,'release_hold',name);
}
assert.equal(outbound,0);
const v=JSON.parse(await fs.readFile(new URL('../vercel.json',import.meta.url)));assert.equal(v.git.deploymentEnabled,false);assert.deepEqual(v.crons,[{path:'/api/capabilities?surface=grading-deletion',schedule:'15 5 * * *'}]);
const p=JSON.parse(await fs.readFile(new URL('../docs/evidence/sol-release-activation-04/public-config.json',import.meta.url)));
const config=await fs.readFile(new URL('../dist/app-config.js',import.meta.url),'utf8');assert.equal(config,`globalThis.__APP_CONFIG__=Object.freeze(${JSON.stringify(p)});\n`);
const {default:caps}=await import('../api/capabilities.js');const r=response();await caps({method:'GET',headers:{},query:{}},r);assert.equal(r.body.vision.status,'release_hold');assert.equal(r.body.pricing.status,'public_fallback');const deletion=response();await caps({method:'GET',headers:{},query:{surface:'grading-deletion'}},deletion);assert.equal(deletion.statusCode,401);assert.equal(outbound,0);
console.log('Committed release: eight holds, no outbound calls, public config, deletion authentication/schedule and Git deployment guard pass.');
