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
 await page.goto((process.env.STUDIO_URL || 'http://127.0.0.1:8769/webapp/editor/')+'?mock=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#connect').click();
 await page.locator('#groups .group').first().waitFor({timeout:30000});
 await page.waitForFunction(()=>!document.getElementById('connect').disabled);
 if(await page.locator('#play-keys').count()) {
  await page.evaluate(()=>{window.noteFrames=[];const send=SloopKeyboard.prototype.send;SloopKeyboard.prototype.send=function(bytes){window.noteFrames.push([...bytes]);return send.call(this,bytes);};document.activeElement.blur();});
  await page.keyboard.down('a');await page.keyboard.down('s');await page.keyboard.down('d');
  assert.deepEqual(await page.evaluate(()=>noteFrames.filter(f=>(f[0]&240)===144).map(f=>f[1])),[53,55,57]);
  await page.keyboard.up('a');await page.keyboard.up('s');await page.keyboard.up('d');
  assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),0);
  await page.locator('#play-sustain').click();await page.locator('#play-sustain').evaluate(e=>e.blur());
  await page.keyboard.press('a');assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),1);
  await page.locator('#play-stop').click();assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),0);
  await page.locator('#play-octave').focus();const before=await page.evaluate(()=>noteFrames.length);
  await page.keyboard.press('a');assert.equal(await page.evaluate(()=>noteFrames.length),before,'typing in select does not play');
  await page.locator('#play-octave').evaluate(e=>e.blur());
  await page.keyboard.down('a');await page.locator('.keyboard-tray').click();await page.keyboard.up('a');
  assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),0);
  await page.locator('.keyboard-tray').click();
  await page.locator('#trackbtns button').nth(3).click();
  await page.waitForFunction(()=>document.querySelector('#trackbtns button[data-i="3"]').getAttribute('aria-pressed')==='true');
  await page.locator('#trackbtns button').nth(3).evaluate(e=>e.blur());
  await page.keyboard.press('a');
  assert.equal(await page.evaluate(()=>noteFrames.filter(f=>(f[0]&240)===144).at(-1)[1]),36,'drum lane uses SLOOP GM pitch');
  await page.locator('#trackbtns button').nth(0).click();
  await page.waitForFunction(()=>document.querySelector('#trackbtns button[data-i="0"]').getAttribute('aria-pressed')==='true');
 }
 assert.equal(await page.locator('#tabs button').count(),7);
 assert.equal(await page.locator('#web-skin option').count(),13);
 assert.equal(await page.locator('html').getAttribute('data-skin'),'sloop','native theme is the first-visit default');
 assert.equal(await page.locator('.widget-env [role=slider]').count(),4);
 const attack=page.locator('#groups input[aria-label="ATK"]');
 const attackBefore=Number(await attack.inputValue());
 await page.locator('.widget-env [role=slider]').first().focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(Number(await attack.inputValue()),Math.min(127,attackBefore+1),'graph edits use the parameter control path');
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  for(const theme of ['sloop','stage','matrix','dx','modeld','chocolate','vapor','midnight','space','bauhaus','ocean','arcade','hicon']) {
   for(const mode of ['dark','light']) {
    const messages=await page.evaluate(()=>window.noteFrames?.length||0);
    await page.locator('.settings-menu').evaluate(e=>e.open=true);
    await page.locator('#web-skin').selectOption(theme);
    await page.locator('#web-mode').selectOption(mode);
    await page.locator('.settings-menu').evaluate(e=>e.open=false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),`overflow ${width} ${theme} ${mode}`);
    assert.equal(await page.evaluate(()=>window.noteFrames?.length||0),messages,'theme changes do not emit MIDI');
   }
  }
  await page.locator('.settings-menu').evaluate(e=>e.open=true);
  await page.locator('#web-skin').selectOption('sloop');
  await page.locator('#web-mode').selectOption('dark');
  await page.locator('.settings-menu').evaluate(e=>e.open=false);
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`build/screenshots/studio-${width}.png`,fullPage:true});
  await page.screenshot({path:`build/screenshots/studio-viewport-${width}.png`});
 }
 assert.deepEqual(errors,[]);
 console.log('Studio: 13 themes × 2 modes × desktop/mobile, widgets, keyboard, seven tabs and console passed');
} finally {await browser.close();}
