// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const root=resolve(process.env.STUDIO_STATIC_DIR),id='G-JVF09MZEGD';
try {
 for(const area of ['editor']) {
  const page=await browser.newPage({viewport:{width:390,height:900}}),errors=[],tags=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='www.googletagmanager.com'){tags.push(url.href);return route.fulfill({contentType:'text/javascript',body:''});}
   if(!['chancethemaker.github.io','127.0.0.1'].includes(url.hostname))return route.abort();
   const pathname=url.pathname.replace(/^\/sloop-fm1-sim/,'');
   const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
   if(!path.startsWith(root+sep))return route.abort();
   try{await route.fulfill({path});}catch{await route.fulfill({status:404,body:''});}
  });
  console.log('Checking '+area);
  const url=`https://chancethemaker.github.io/sloop-fm1-sim/webapp/${area}/?private=secret`;
  await page.goto(url,{waitUntil:'networkidle'});
  assert.equal(tags.length,1);assert.ok(tags[0].endsWith(id));
  const config=await page.evaluate(()=>[...window.dataLayer].find(a=>a[0]==='config')[2]);
  assert.equal(config.cookie_prefix,'sloop');assert.equal(config.cookie_path,'/sloop-fm1-sim/');
  assert.ok(!config.page_location.includes('?'));assert.equal(config.allow_google_signals,false);
  await page.locator('.analytics-banner').waitFor({state:'visible'});
  assert.ok(await page.locator('.analytics-banner').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
  await page.locator('.analytics-banner [data-choice=denied]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('sloop.web.analyticsConsent')),'denied');
  await page.reload({waitUntil:'networkidle'});assert.equal(tags.length,1,'decline prevents tag loading');
  if(await page.locator('.settings-menu>summary').isVisible())await page.locator('.settings-menu>summary').click();
  await page.locator('.analytics-menu-button').click();
  await page.locator('.analytics-choice [data-choice=granted]').click();
  await page.waitForFunction(()=>!!document.querySelector('script[src*="googletagmanager"]'));
  await page.evaluate(()=>{window.SloopAnalytics.track('download_click',{file_type:'zip',midi:'private'});window.SloopAnalytics.track('not_allowed');});
  const event=await page.evaluate(()=>[...dataLayer].filter(a=>a[0]==='event').at(-1));
  assert.equal(event[1],'download_click');assert.equal(event[2].midi,undefined);
  await page.goto(`http://127.0.0.1:8769/webapp/${area}/`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('script[src*="googletagmanager"]').count(),0);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Analytics property, site isolation, opt-out/re-enable, preferences, event filtering and mobile notice passed on the standalone simulator; Google requests mocked.');
} finally {await browser.close();}
