// Frozen source + explicit reviewed overlay; no .env read, remote build or upload.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { build, version as esbuildVersion } from 'esbuild';

const repo=path.resolve(import.meta.dirname,'../../..');
const evidence=import.meta.dirname;
const stage='/tmp/mica-activation-04-configured';
const frozen=path.join(repo,'docs/evidence/sol-client-07g');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=file=>fs.readFile(file,'utf8').then(JSON.parse);
const hash=async file=>digest(await fs.readFile(file));
const write=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
async function files(root,relative='') {
  const result=[];
  for(const name of (await fs.readdir(path.join(root,relative))).sort()) {
    const child=path.join(relative,name),info=await fs.lstat(path.join(root,child));
    if(info.isDirectory())result.push(...await files(root,child));
    else {assert(info.isFile(),`Unexpected symlink: ${child}`);result.push(child);}
  }
  return result;
}
assert.equal(await hash(path.join(frozen,'release-snapshot.zip')),'391b748260cf17124cded8dc18960b23b8e020af3f178aa899d0f84d3dd33b47');
assert.equal(await hash(path.join(frozen,'release-manifest.json')),'4e1710477b1af0846532cf906315f3f48b81878857b6b0d7c729f9970614dc58');
await fs.rm(stage,{recursive:true,force:true});await fs.mkdir(stage,{recursive:true});
execFileSync('unzip',['-q',path.join(frozen,'release-snapshot.zip'),'-d',stage]);
const original=await json(path.join(frozen,'release-manifest.json'));
assert.deepEqual(await files(stage),[...original.inputs,...original.outputs].map(x=>x.path).sort());
for(const entry of [...original.inputs,...original.outputs])assert.equal(await hash(path.join(stage,entry.path)),entry.sha256,entry.path);
const overrides=await files(path.join(evidence,'overlay'));
for(const name of overrides) {await fs.mkdir(path.dirname(path.join(stage,name)),{recursive:true});await fs.copyFile(path.join(evidence,'overlay',name),path.join(stage,name));}
const publicConfig=await json(path.join(evidence,'public-config.json'));
assert.equal(publicConfig.supabaseUrl,'https://kdkzdflrxajfdcithrfj.supabase.co');
assert.equal(publicConfig.apiOrigin,'https://jordan-pokemon-app.vercel.app');
assert.match(publicConfig.supabasePublishableKey,/^sb_publishable_[A-Za-z0-9_-]+$/);
assert.deepEqual(Object.keys(publicConfig).sort(),['apiOrigin','supabasePublishableKey','supabaseUrl']);
await fs.symlink(path.join(repo,'node_modules'),path.join(stage,'node_modules'),'dir');
execFileSync(process.execPath,['scripts/build.mjs','--neutral-public-config'],{cwd:stage,env:{PATH:process.env.PATH},stdio:'inherit'});
await write(path.join(stage,'dist/app-config.js'),`globalThis.__APP_CONFIG__=Object.freeze(${JSON.stringify(publicConfig)});\n`);
const output=path.join(stage,'.vercel/output');
await fs.cp(path.join(stage,'dist'),path.join(output,'static'),{recursive:true});
const deployment=await json(path.join(stage,'vercel.json'));
const routes=deployment.headers.map(r=>({src:r.source,headers:Object.fromEntries(r.headers.map(h=>[h.key,h.value])),continue:true}));
routes.push({src:'^/profile/?$',dest:'/index.html'},{handle:'filesystem'});
await write(path.join(output,'config.json'),{version:3,routes,crons:deployment.crons});
const apiFiles=(await files(path.join(stage,'api'))).filter(f=>f.endsWith('.js'));
for(const name of apiFiles) {
  const folder=path.join(output,'functions/api',name.replace(/\.js$/,'.func'));
  await fs.mkdir(folder,{recursive:true});
  await build({entryPoints:[path.join(stage,'api',name)],outfile:path.join(folder,'index.mjs'),bundle:true,platform:'node',format:'esm',target:'node24',minify:true,sourcemap:false,
    banner:{js:'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);'}});
  await write(path.join(folder,'.vc-config.json'),{runtime:'nodejs24.x',handler:'index.mjs',launcherType:'Nodejs',shouldAddHelpers:true,maxDuration:deployment.functions['api/'+name]?.maxDuration||10,
    environment:{NEXT_PUBLIC_SUPABASE_URL:publicConfig.supabaseUrl,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:publicConfig.supabasePublishableKey}});
}
await write(path.join(stage,'.vercel/project.json'),{orgId:'team_txwalREE56wdO0c6DX4hfwjQ',projectId:'prj_ICSEVLitTA6RdwTTy14BThiAvPEQ',projectName:'jordan-pokemon-app'});
const sourcePaths=[...new Set([...original.inputs.map(x=>x.path),...overrides])].sort();
const sourceEntries=await Promise.all(sourcePaths.map(async name=>({path:name,sha256:await hash(path.join(stage,name)),originalSha256:original.inputs.find(f=>f.path===name)?.sha256||null})));
const outputPaths=(await files(output)).map(f=>'.vercel/output/'+f);
const deployPaths=[...outputPaths,'.vercel/project.json','vercel.json'].sort();
const deployEntries=await Promise.all(deployPaths.map(async name=>({path:name,sha256:await hash(path.join(stage,name)),bytes:(await fs.stat(path.join(stage,name))).size})));
const sourcePackage=await json(path.join(stage,'package.json'));
const dependencies=await Promise.all(Object.keys(sourcePackage.dependencies).concat('esbuild').sort().map(async name=>({name,version:(await json(path.join(repo,'node_modules',name,'package.json'))).version})));
const provenance={frozenZipSha256:await hash(path.join(frozen,'release-snapshot.zip')),frozenManifestSha256:await hash(path.join(frozen,'release-manifest.json')),node:process.version,esbuild:esbuildVersion,
  buildScriptSha256:await hash(import.meta.filename),publicConfigSha256:await hash(path.join(evidence,'public-config.json')),dependencies,
  outputTreeSha256:digest(JSON.stringify(deployEntries.filter(x=>x.path.startsWith('.vercel/output/')))),
  staticTreeSha256:digest(JSON.stringify(deployEntries.filter(x=>x.path.startsWith('.vercel/output/static/')))),
  configuration:{supabaseUrl:publicConfig.supabaseUrl,apiOrigin:publicConfig.apiOrigin,publishableKeySha256:digest(publicConfig.supabasePublishableKey)},crons:deployment.crons,source:sourceEntries,deployment:deployEntries};
await write(path.join(evidence,'configured-manifest.json'),provenance);
for(const [archive,entries] of [['configured-deployment.zip',deployPaths],['configured-source.zip',sourcePaths]]) {
  const target=path.join(evidence,archive);await fs.rm(target,{force:true});
  execFileSync('touch',['-t','202610020000',...entries],{cwd:stage});
  execFileSync('zip',['-X','-q',target,...entries],{cwd:stage});
}
console.log(JSON.stringify({stage,staticFiles:await files(path.join(output,'static')).then(x=>x.length),functions:apiFiles.length,deployFiles:deployEntries.length,
  sourceZipSha256:await hash(path.join(evidence,'configured-source.zip')),deploymentZipSha256:await hash(path.join(evidence,'configured-deployment.zip')),manifestSha256:await hash(path.join(evidence,'configured-manifest.json'))}));
