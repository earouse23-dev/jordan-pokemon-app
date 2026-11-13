import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

let bundle;
const appUrl = '/app.js?v=121';
test.use({ serviceWorkers: 'block' });
test.beforeAll(async () => {
  const source = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  bundle = (await build({ stdin: {
    contents: source.replace('void bootstrap();', '') + '\nexport { state, bindEvents, bindAuthUI, routeTo, renderCollection, renderDetail, openFilterSheet, openPositionEditSheet, openSaleSheet, chartInstance, portfolioChartInstance };',
    resolveDir: fileURLToPath(new URL('../../', import.meta.url)), sourcefile: 'app.js',
  }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false })).outputFiles[0].text;
});

async function boot(page) {
  await page.route('**/app-config.js*', r => r.fulfill({contentType:'application/javascript',body:'globalThis.__APP_CONFIG__={};'}));
  await page.route('**/app.js?v=121', r => r.fulfill({contentType:'application/javascript',body:bundle}));
  await page.route('**/api/**', r => r.fulfill({json:{}}));
  await page.goto('/');
  await page.evaluate(async url => {
    const app = await import(url); window.polishApp = app;
    Object.assign(app.state, { session: {user:{id:'11111111-1111-4111-8111-111111111111'}}, accountLoading:false, accountLoadError:null, gradingActivityStatus:'ready' });
    app.state.organization.status = 'ready';
    const card = { uid:'22222222-2222-4222-8222-222222222222', id:'base1-4', name:'Charizard', set:'Base Set', number:'4/102', cardState:'raw', status:'owned', condition:'Near Mint', variant:'Holofoil', language:'en', currency:'USD', quantity:1, price:240, referencePrice:240, pricingStatus:'live', pricingUpdatedAt:new Date().toISOString(), cost:125, costBasis:125, thumb:'/icons/icon.svg', image:'/icons/icon.svg', quotes:[], priceHistory:[], transactions:[], lots:[], tags:[] };
    card.priceHistory = [1,2,3,4,5,6,7].map((day,index)=>({recordedAt:new Date(Date.now()-day*86400000).toISOString(),amount:240-index*5,currency:'USD',finish:'holofoil',condition:'Near Mint',provider:'synthetic'}));
    card.lots = [{acquiredAt:'2026-01-01',quantityAcquired:1,quantityRemaining:1,totalCost:125,currency:'USD',costBasisKnown:true,acquisitionDateKnown:true}];
    app.state.items = [card, {...card,uid:'33333333-3333-4333-8333-333333333333',id:'base1-2',name:'Blastoise',number:'2/102',price:180}];
    app.state.portfolioHistory = [1,2,3,4,5,6,7].reverse().map((day,index)=>({date:new Date(Date.now()-day*86400000).toISOString().slice(0,10),total:380+index*7,currency:'USD',pricedItems:2,unpricedItems:0,freshItems:2}));
    app.state.detailId = card.uid; app.state.detailCard = card;
    app.state.gradingReports.set(card.uid, []);
    app.state.organization.attachments.set(card.uid,{status:'ready',items:[]});
    document.body.dataset.uiTheme='mica'; document.body.dataset.workspace='collector'; document.body.dataset.softwareMode='collector'; document.body.classList.add('authenticated');
    document.querySelector('#authGate').hidden=true;
    document.querySelector('#appShell').removeAttribute('aria-hidden');
    app.bindEvents(); app.bindAuthUI(); app.renderCollection();
  }, appUrl);
}

for (const appearance of ['light', 'dark']) {
  test(`${appearance} screen and form matrix`, async ({page}, info) => {
    await boot(page);
    for (const width of [320,390,430,667,768,1024,1440,1920]) {
      await page.setViewportSize({width,height:width===667?375:width<500?844:1000});
      await page.evaluate(a=>document.body.dataset.appearance=a,appearance);
      for (const route of ['dashboard','collection','detail','scan','profile']) {
        await page.evaluate(r=>window.polishApp.routeTo(r,{instant:true}),route);
        await expect(page.locator(`#view-${route}`)).toBeVisible();
        await page.waitForFunction(r=>Number(getComputedStyle(document.querySelector(`#view-${r}`)).opacity)===1,route);
        if(route==='dashboard') await expect(page.locator('#portfolioHistoryChart')).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),`${appearance} ${width} ${route} overflow`).toBeLessThanOrEqual(1);
        if(['detail','dashboard'].includes(route)) await page.waitForFunction(r=>{const c=r==='detail'?polishApp.chartInstance:polishApp.portfolioChartInstance; return !c?.$historyReveal || c.$historyReveal.progress>=1;},route);
        if ([390,1440].includes(width)) await page.screenshot({path:info.outputPath(`${process.env.MICA_UNSLOP_BASELINE?'before':'after'}-${route}-${width}.png`)});
      }
      await page.evaluate(()=>window.polishApp.openFilterSheet());
      await expect(page.locator('#bottomSheet')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
      if(width===390) await page.screenshot({path:info.outputPath('filter.png')});
      await page.locator('#bottomSheet .sheet-close').click();
      if(!process.env.MICA_UNSLOP_BASELINE) {
        const values=await page.locator('#view-profile h1').evaluate(el=>({weight:getComputedStyle(el).fontWeight,tracking:getComputedStyle(el).letterSpacing}));
        expect(Number(values.weight)).toBeLessThanOrEqual(600);
      }
    }
    await page.evaluate(()=>{document.body.classList.remove('authenticated');document.querySelector('#authGate').hidden=false; document.querySelector('#appShell').setAttribute('aria-hidden','true');});
    await expect(page.locator('#authEmail')).toBeVisible();
    if(!process.env.MICA_UNSLOP_BASELINE) await expect(page.locator('#authTitle')).toHaveText('Sign in to Mica');
    await page.screenshot({path:info.outputPath('auth.png')});
  });
}
