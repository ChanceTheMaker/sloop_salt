// SPDX-License-Identifier: GPL-3.0-only
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1000,height:740},deviceScaleFactor:1});
try {
 await mkdir('web/screenshots/themes',{recursive:true});
 await page.goto((process.env.STUDIO_URL||'http://127.0.0.1:8769/webapp/editor/')+'?mock=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.brand-home')).display==='inline-flex');
 await page.locator('#connect').click();await page.waitForFunction(()=>!document.getElementById('connect').disabled);
 const themes=await page.locator('#web-skin option').evaluateAll(options=>options.map(o=>o.value));
 for(const theme of themes) {
  await page.locator('.settings-menu').evaluate(e=>e.open=true);
  await page.locator('#web-skin').selectOption(theme);await page.locator('#web-mode').selectOption('dark');
  await page.locator('.settings-menu').evaluate(e=>e.open=false);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`web/screenshots/themes/${theme}.jpg`,type:'jpeg',quality:78});
 }
 console.log(`Captured ${themes.length} SLOOP Studio theme thumbnails`);
} finally {await browser.close();}
