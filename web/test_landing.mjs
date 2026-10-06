// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[],bad=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.url());});
try {
 await mkdir('build/screenshots',{recursive:true});
 await page.addInitScript(()=>{navigator.requestMIDIAccess=async()=>{throw new Error('Permission denied in test');};});
 await page.goto(process.env.INSTALLER_URL||'http://127.0.0.1:8769/webapp/salt/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>!document.getElementById('go').disabled);
 assert.equal(await page.locator('html').getAttribute('data-skin'),'sloop');
 assert.equal(await page.locator('.theme-card').count(),13);
 assert.equal(await page.locator('#install-progress').getAttribute('open'),null);
 await page.locator('#go').click();
 assert.equal(await page.locator('#install-progress').getAttribute('open'),'');
 assert.equal(await page.locator('#install-retry').isVisible(),true);
 assert.equal(await page.locator('#install-studio').isVisible(),false);
 await page.locator('#install-retry').click();assert.equal(await page.locator('#install-retry').isVisible(),true);
 // Presentation-only outcomes; real transport simulation is covered by test_web.mjs.
 await page.evaluate(()=>SloopInstallUI.result('done'));assert.equal(await page.locator('#install-studio').isVisible(),true);
 await page.evaluate(()=>SloopInstallUI.result('mismatch'));assert.equal(await page.locator('#install-studio').isVisible(),false);
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
  await page.screenshot({path:`build/screenshots/home-${width}.png`,fullPage:true});
  await page.screenshot({path:`build/screenshots/home-viewport-${width}.png`});
 }
 await page.locator('#lang').click();await page.locator('[data-language="ja"]').click();
 assert.equal(await page.locator('html').getAttribute('lang'),'ja');assert.equal(await page.locator('#language-options').isVisible(),false);
 await page.locator('.theme-card[href*="theme=matrix"]').click();
 await page.waitForFunction(()=>document.documentElement.dataset.skin==='matrix');
 assert.equal(await page.locator('html').getAttribute('data-skin'),'matrix');
 await page.goto('http://127.0.0.1:8769/webapp/installer/');
 assert.equal(await page.locator('.theme-gallery').count(),0,'original homepage restored');
 assert.equal(await page.locator('a[href*="/salt"]').count(),0,'backup is unlinked');
 assert.equal(await page.locator('html').getAttribute('data-skin'),null,'original homepage aesthetic retained');
 await page.screenshot({path:'build/screenshots/original-home.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);
 console.log('Landing: native default, 13 thumbnails, theme launch, locale picker, responsive layout, denied/retry/success presentation passed');
} finally {await browser.close();}
