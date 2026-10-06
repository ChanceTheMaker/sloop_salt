// SPDX-License-Identifier: GPL-3.0-only
// PLAYWRIGHT_MODULE can point to an existing installation; no machine paths shipped.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await mkdir('build/screenshots',{recursive:true});
try {
 await page.goto((process.env.STUDIO_URL || 'http://127.0.0.1:8769/webapp/editor/')+'?mock=1');
 await page.locator('#connect').click();
 await page.locator('#groups .group').first().waitFor({timeout:30000});
 assert.equal(await page.locator('#tabs button').count(),7);
 assert.equal(await page.locator('#web-skin option').count(),12);
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  for(const theme of ['stage','matrix','dx','modeld','chocolate','vapor','midnight','space','bauhaus','ocean','arcade','hicon']) {
   for(const mode of ['dark','light']) {
    await page.locator('.settings-menu').evaluate(e=>e.open=true);
    await page.locator('#web-skin').selectOption(theme);
    await page.locator('#web-mode').selectOption(mode);
    await page.locator('.settings-menu').evaluate(e=>e.open=false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`overflow ${width} ${theme} ${mode}`);
   }
  }
  await page.locator('.settings-menu').evaluate(e=>e.open=true);
  await page.locator('#web-skin').selectOption('stage');
  await page.locator('#web-mode').selectOption('dark');
  await page.locator('.settings-menu').evaluate(e=>e.open=false);
  await page.screenshot({path:`build/screenshots/studio-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('Studio: 12 themes × 2 modes × desktop/mobile, seven tabs and console passed');
} finally {await browser.close();}
