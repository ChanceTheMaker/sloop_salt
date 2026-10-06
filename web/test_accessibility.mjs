// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url=process.env.STUDIO_URL||'http://127.0.0.1:8769/webapp/editor/';
try {
 await page.goto(url+'?mock=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.brand-home')).display==='inline-flex');
 await page.locator('#connect').click();
 await page.waitForFunction(()=>!document.getElementById('connect').disabled&&document.querySelector('#play-keys button:not(:disabled)'));
 await page.evaluate(()=>{window.frames=[];const send=SloopKeyboard.prototype.send;SloopKeyboard.prototype.send=function(bytes){frames.push([...bytes]);return send.call(this,bytes);};});
 assert.equal(await page.locator('#play-keys [tabindex="0"]').count(),1);
 await page.locator('.keyboard-tray').focus();await page.keyboard.press('Tab');
 assert.equal(await page.locator(':focus').getAttribute('data-note'),'53','Tab enters at F3');
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator(':focus').getAttribute('data-note'),'54');
 await page.keyboard.press('Home');
 assert.equal(await page.locator(':focus').getAttribute('data-note'),await page.locator('#play-keys button').first().getAttribute('data-note'));
 await page.keyboard.press('End');
 assert.equal(await page.locator(':focus').getAttribute('data-note'),await page.locator('#play-keys button').last().getAttribute('data-note'));
 assert.equal(await page.evaluate(()=>frames.length),0,'navigation must not play');
 await page.keyboard.down('Space');
 assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),1);
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#play-keys')),false,'one Tab leaves the piano');
 assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),0,'leaving a focused note releases it');
 await page.keyboard.up('Space');
 await page.locator('#play-typing').uncheck();
 await page.locator('#play-keys [tabindex="0"]').focus();
 await page.keyboard.down('Enter');
 assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),1,'focused keys work without QWERTY');
 await page.keyboard.up('Enter');
 await page.locator('#play-typing').check();
 // Pointer and keyboard can share a pitch without cutting each other off.
 const f=page.locator('#play-keys [data-note="53"]'),r=await f.boundingBox();
 await page.mouse.move(r.x+r.width/2,r.y+r.height-8);await page.mouse.down();
 await page.keyboard.down('a');await page.mouse.up();
 assert.equal(await f.getAttribute('aria-pressed'),'true');
 await page.keyboard.up('a');assert.equal(await f.getAttribute('aria-pressed'),'false');
 await page.locator('#lang').click();await page.locator('#language-options [data-language="ja"]').click();
 assert.equal(await page.locator('.site-nav a').first().textContent(),'インストール');
 assert.equal(await page.title(),'Sloop [salt] スタジオ');
 assert.match(await page.locator('#play-navigation').textContent(),/左右キー/);
 await page.locator('#lang').click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('#lang').getAttribute('aria-expanded'),'false');
 assert.equal(await page.locator(':focus').getAttribute('id'),'lang');
 for(const width of [1440,390,320]) {
  await page.setViewportSize({width,height:1000});
  for(const wide of [false,true]) {
   await page.locator('.settings-menu').evaluate(e=>e.open=true);
   await page.locator('#web-width').setChecked(wide);
   await page.locator('.settings-menu').evaluate(e=>e.open=false);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Japanese overflow at ${width}, wide=${wide}`);
   assert.ok(await page.locator('#tabs button').evaluateAll(buttons=>buttons.every(b=>b.scrollWidth<=b.clientWidth+1)),`tab labels clipped at ${width}`);
   assert.equal(await page.locator('#play-keys [tabindex="0"]').count(),1);
  }
 }
 await mkdir('build/screenshots',{recursive:true});
 await page.screenshot({path:'build/screenshots/accessibility-mobile-ja.png'});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.lang==='ja');
 assert.equal(await page.locator('.site-nav a').first().textContent(),'インストール','locale survives reload');
 assert.deepEqual(errors,[]);
 console.log('Accessibility: piano Tab/arrow navigation, focus cleanup, mixed note ownership, Japanese labels/persistence and 320px/wide layouts passed');
} finally {await browser.close();}
