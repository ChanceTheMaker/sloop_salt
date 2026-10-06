// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:390,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8769/webapp/editor/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('.mode-tip').waitFor({state:'visible'});
 assert.equal(await page.locator('#audio-mode button').count(),3);
 assert.match(await page.locator('#device-mode').getAttribute('title'),/hardware/);
 assert.match(await page.locator('#view-firmware').getAttribute('title'),/Device and Expanded/);
 assert.match(await page.locator('#browser-start').getAttribute('title'),/Skeuomorph/);
 assert.deepEqual(await page.locator('#audio-mode button').allTextContents(),['FM-1','Firmware','Browser Studio']);
 assert.match(await page.locator('.mode-tip').textContent(),/Both browser modes share/);
 assert.equal(await page.locator('#device-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#audio-mode [aria-pressed=true]').count(),1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const box=await page.locator('.mode-tip').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=900);
 await page.screenshot({path:'build/screenshots/play-mode-notice-mobile.png'});
 await page.getByRole('button',{name:'Dismiss sound-source tip'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('sloop.web.soundSourceTipDismissed')),'1');
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.waitForTimeout(900);
 assert.equal(await page.locator('.mode-tip').isVisible(),false);
 await page.locator('#view-firmware').click();await page.locator('#firmware-view').waitFor({state:'visible',timeout:60000});
 assert.equal(await page.locator('#audio-mode [aria-pressed=true]').count(),1);
 assert.equal(await page.locator('#view-firmware').getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Expanded',exact:true}).click();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#browser-start').click();await page.locator('#firmware-view').waitFor({state:'hidden'});
 assert.equal(await page.locator('#browser-start').getAttribute('aria-pressed'),'true');
 await page.locator('#device-mode').click();await page.locator('#browser-audio').waitFor({state:'hidden'});
 assert.equal(await page.locator('#device-mode').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);console.log('Play mode switch, direct Firmware startup, mobile layouts and one-time notice passed.');
}finally{await browser.close();}
