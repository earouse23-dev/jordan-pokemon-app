import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const appUrl='/app.js?v=118';
let bundle;
test.use({serviceWorkers:'block'});
test.beforeAll(async()=>{
 const source=await readFile(new URL('../../app.js',import.meta.url),'utf8');
 bundle=(await build({stdin:{contents:source+'\nexport { state, bindEvents, openSheet, closeSheet, openSecondaryPanel, openGradingActivityReport, openPsaOutcomeLinkSheet, openGradingResultSheet, openSaleSheet, openFilterSheet, renderGradingActivity };',resolveDir:fileURLToPath(new URL('../../',import.meta.url)),sourcefile:'app.js'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false})).outputFiles[0].text;
});
async function boot(page){
 await page.route('**/app-config.js*',r=>r.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={};'}));
 await page.route('**/app.js?v=118',r=>r.fulfill({contentType:'application/javascript',body:bundle}));
 await page.route('**/api/**',r=>r.fulfill({json:{}}));
 await page.goto('/');
 await page.evaluate(async url=>{
  const app=await import(url);window.reviewApp=app;
  app.state.session={user:{id:'11111111-1111-4111-8111-111111111111'}};
  app.state.route='profile';history.replaceState({route:'profile'},'', '#profile');app.state.accountLoading=false;app.state.organization.status='ready';app.state.gradingActivityStatus='ready';
  document.body.dataset.uiTheme='mica';document.body.classList.add('authenticated');
  document.querySelector('#authGate').hidden=true;document.querySelector('#appShell').removeAttribute('aria-hidden');
  document.querySelectorAll('.view').forEach(v=>{v.hidden=v.id!=='view-profile';v.classList.toggle('active',!v.hidden);v.setAttribute('aria-hidden',String(v.hidden));});
  app.bindEvents();
  window.reviewSession={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',workflow_status:'completed',started_at:'2026-07-30',completed_at:'2026-07-30',identity_snapshot:{},outcomes:[],evidence:[],prediction:{pregrade_score:8,condition_score:8,confidence:.6,professional_prediction_status:'withheld',subscores:[]}};
 },appUrl);
}
async function contrast(page,selector){return page.locator(selector).evaluate(el=>{
 const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);const lum=a=>a.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
 let parent=el,bg;do{bg=getComputedStyle(parent).backgroundColor;parent=parent.parentElement;}while(parent&&(bg==='rgba(0, 0, 0, 0)'||bg==='transparent'));
 const [hi,lo]=[lum(rgb(getComputedStyle(el).color)),lum(rgb(bg))].sort((a,b)=>b-a);return(hi+.05)/(lo+.05);
});}

test('secondary settings open separately, preserve their live nodes and restore focus',async({page})=>{
 await boot(page);
 await page.locator('#profileCollectionTools>summary').click();
 await page.locator('#collectionInsights>summary').click();
 await expect(page.locator('#bottomSheet #collectionInsights')).toBeVisible();
 await page.evaluate(()=>{const input=document.createElement('input');input.id='retained-review-value';input.value='kept';document.querySelector('#collectionInsights').append(input);});
 await page.locator('#bottomSheet .sheet-close').click();
 await expect(page.locator('#profileCollectionTools #collectionInsights')).toHaveCount(1);
 await page.locator('#collectionInsights>summary').click();
 await expect(page.locator('#retained-review-value')).toHaveValue('kept');
 await page.evaluate(()=>reviewApp.openSheet('<h2>Next task</h2><button class="sheet-close">Close</button>'));
 await expect(page.locator('#bottomSheet #collectionInsights')).toHaveCount(0);
 await expect(page.locator('#profileCollectionTools #collectionInsights')).toHaveCount(1);
});

test('saved reports never invent verified identity and new proof sheets discard report styling',async({page},info)=>{
 await boot(page);
 for(const appearance of ['light','dark']){
  await page.evaluate(a=>{document.body.dataset.appearance=a;},appearance);
  await page.evaluate(()=>reviewApp.openGradingActivityReport(reviewSession.id,reviewSession));
  await expect(page.locator('.grading-report-top')).toContainText('Card identity pending');
  await expect(page.locator('.grading-report-top')).toContainText('Printing not confirmed');
  await expect(page.locator('.compact-submission>strong')).toHaveText('Unavailable');
  expect(await contrast(page,'.grading-report-top strong')).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({path:info.outputPath(`report-${appearance}.png`)});
  await page.evaluate(()=>reviewApp.openPsaOutcomeLinkSheet(reviewSession,{name:'Review card'}));
  await expect(page.locator('#bottomSheet')).not.toHaveAttribute('data-experience','grading');
  expect(await contrast(page,'label[for="psaReturnedGrade"]')).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('#psaReturnedGrade')).toBeVisible();
  expect(await contrast(page,'.psa-return-note strong')).toBeGreaterThanOrEqual(4.5);
  expect(await contrast(page,'.psa-return-note p')).toBeGreaterThanOrEqual(4.5);
 }
});

test('type and condition filters retain exact saved choices without mixing slab and raw filters',async({page})=>{
 await boot(page);
 await page.evaluate(()=>{reviewApp.state.items=[{name:'Raw',cardState:'raw',condition:'Near Mint',digitalGrade:{low:8}},{name:'Slab',cardState:'graded',gradingCompany:'PSA',grade:'10'}];reviewApp.state.conditionFilter='Near Mint';reviewApp.openFilterSheet();});
 await expect(page.locator('#sheetCardType')).toHaveValue('Raw');
 await expect(page.locator('#sheetCondition')).toHaveValue('Near Mint');
 await expect(page.locator('#sheetGrader')).toBeHidden();
 await expect(page.getByLabel('Digital estimate',{exact:true})).toBeVisible();
 await expect(page.locator('#sheetGrade option')).toHaveText(['Every grade','8']);
 await page.locator('#sheetCardType').selectOption('Graded');
 await expect(page.locator('#sheetCondition')).toBeHidden();
 await expect(page.locator('#sheetGrader')).toBeVisible();
 await expect(page.locator('#sheetGrade option')).toHaveText(['Every grade','10']);
 await page.locator('#sheetGrader').selectOption('');
 await page.locator('#applySheet').click();
 expect(await page.evaluate(()=>reviewApp.state.conditionFilter)).toBe('Graded');
});

test('report and proof forms fit responsive viewports in both appearances',async({page},info)=>{
 await boot(page);
 for(const appearance of ['light','dark'])for(const width of [320,375,390,430,667,768,1024,1440,1920]){
  await page.setViewportSize({width,height:width===667?375:width<500?844:1000});
  await page.evaluate(a=>{document.body.dataset.appearance=a;reviewApp.openPsaOutcomeLinkSheet(reviewSession,{name:'A long Pokémon name with a complete printed card identity'});},appearance);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${appearance} ${width}`).toBeLessThanOrEqual(0);
  const field=page.locator('#psaOutcomeNotes');await field.scrollIntoViewIfNeeded();
  const result=await field.evaluate(el=>{const r=el.getBoundingClientRect();const f=document.querySelector('#bottomSheet .sheet-actions').getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom,footer:f.top,width:innerWidth};});
  expect(result.left).toBeGreaterThanOrEqual(0);expect(result.right).toBeLessThanOrEqual(width);expect(result.bottom).toBeLessThanOrEqual(result.footer+1);
  if([390,1440].includes(width))await page.screenshot({path:info.outputPath(`proof-${appearance}-${width}.png`)});
 }
});
