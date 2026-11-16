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
    contents: source.replace('void bootstrap();', '') + '\nexport { state, bindEvents, bindAuthUI, routeTo, renderCollection, renderDetail, openFilterSheet, openPositionEditSheet, openSaleSheet, openSheet, closeSheet, openPasswordResetDialog, chartInstance, portfolioChartInstance };',
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
        if(route==='scan') {
          const contained = await page.locator('.add-cards-layout').evaluate(el=>{
            const box=el.getBoundingClientRect();
            return [...el.children].filter(child=>getComputedStyle(child).display!=='none').every(child=>{const r=child.getBoundingClientRect();return r.top>=box.top && r.bottom<=box.bottom+1;});
          });
          expect(contained, `${appearance} ${width} capture/search panels stay inside their workspace`).toBe(true);
          await expect.poll(()=>page.locator('#autoCaptureButton').evaluate(el=>getComputedStyle(el.querySelector('svg')).color===getComputedStyle(el).color)).toBe(true);
          if(width<760) {
            const spare=await page.locator('.add-cards-layout').evaluate(el=>el.clientWidth-parseFloat(getComputedStyle(el).paddingLeft)-parseFloat(getComputedStyle(el).paddingRight)-el.querySelector('.add-search-panel').getBoundingClientRect().width);
            expect(spare, 'empty search results must not create an implicit phone column').toBeLessThanOrEqual(1);
          }
        }
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


for (const appearance of ['light', 'dark']) test(`${appearance} shared controls cover editing, recovery and account setup`, async ({page}, info) => {
  await boot(page);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(a=>document.body.dataset.appearance=a,appearance);
  for (const width of [320,402,599,844,1440]) {
    await page.setViewportSize({width,height:width===844?390:844});
    await page.evaluate(()=>polishApp.openPositionEditSheet(polishApp.state.items[0]));
    await expect(page.locator('#editNotes')).toBeVisible();
    await page.locator('#editNotes').fill('Retained draft');
    const field = await page.locator('#editNotes').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),radius:getComputedStyle(el).borderRadius}));
    expect(field.font).toBeGreaterThanOrEqual(16);
    expect(field.radius).toBe('10px');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.locator('#editNotes').scrollIntoViewIfNeeded();
    await expect(page.locator('#editNotes')).toHaveValue('Retained draft');
    if(width===402) await page.screenshot({path:info.outputPath(`edit-${appearance}.png`),animations:"disabled"});
    await page.evaluate(()=>polishApp.closeSheet({discardHistory:true}));
  }
  await page.setViewportSize({width:402,height:874});
  // Use the actual recovery dialog, not a separately styled fixture.
  await page.evaluate(()=>{document.querySelector('#authGate').hidden=false;document.body.classList.remove('authenticated');});
  await page.evaluate(()=>polishApp.openPasswordResetDialog());
  await expect(page.locator('#passwordResetDialog')).toBeVisible();
  const recovery=await page.locator('#passwordResetDialog').evaluate(el=>({animation:getComputedStyle(el).animationDuration,color:getComputedStyle(el).color}));
  expect(recovery.animation).toBe('0.16s');
  await page.screenshot({path:info.outputPath(`recovery-${appearance}.png`),animations:"disabled"});
  await page.locator('[data-close-reset-dialog]').first().click();
  await page.evaluate(()=>{document.querySelector('#authGate').hidden=true;document.body.classList.add('authenticated');polishApp.openOnboarding();});
  await expect(page.locator('#onboardingDialog')).toBeVisible();
  await expect(page.locator('#onboardingError')).toContainText('Couldn’t finish');
  const setup=await page.locator('.onboarding-card').evaluate(el=>({width:el.getBoundingClientRect().width,animation:getComputedStyle(el).animationDuration}));
  expect(setup.width).toBeLessThanOrEqual(440);
  expect(setup.animation).toBe('0.16s');
  await page.screenshot({path:info.outputPath(`setup-${appearance}.png`),animations:"disabled"});
  // Enlarged text must grow the dialog without clipping its retry action.
  await page.addStyleTag({content:'#onboardingDialog {font-size:200%} #onboardingDialog h1 {font-size:2em}'});
  await expect(page.locator('#onboardingForm button')).toBeInViewport();
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.locator('.onboarding-card').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});


test('portfolio change label stays readable in both themes', async ({page}) => {
  await boot(page);
  for(const appearance of ['light','dark']) {
    await page.evaluate(a=>{document.body.dataset.appearance=a;polishApp.routeTo('dashboard',{instant:true});},appearance);
    await expect.poll(()=>page.locator('.portfolio-pnl-picker summary').evaluate(el=>{
      const luminance=value=>value.match(/[\d.]+/g).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((s,c,i)=>s+c*[.2126,.7152,.0722][i],0);
      const foreground=luminance(getComputedStyle(el).color);
      const background=luminance(getComputedStyle(document.querySelector('#view-dashboard')).backgroundColor);
      return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
    })).toBeGreaterThanOrEqual(4.5);
  }
});
