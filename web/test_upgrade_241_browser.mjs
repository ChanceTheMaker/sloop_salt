// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve,sep} from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);
if(process.env.STUDIO_STATIC_DIR){
 const root=resolve(process.env.STUDIO_STATIC_DIR);
 await page.route('http://127.0.0.1:8769/**',async route=>{
  const pathname=decodeURIComponent(new URL(route.request().url()).pathname),path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root+sep))return route.abort();
  try{await route.fulfill({path});}catch{await route.fulfill({status:404,body:''});}
 });
}
await page.addInitScript(()=>{
 localStorage.setItem('sloop.web.analyticsConsent','denied');
 document.cookie='sloop_simulator_tour_v1=seen; Path=/; SameSite=Lax';
 navigator.requestMIDIAccess=()=>{throw Error('Unexpected hardware access');};
 window.directTap=false;document.addEventListener('click',()=>{window.directTap=true;setTimeout(()=>window.directTap=false,0);},true);
 const Context=window.AudioContext;window.AudioContext=class extends Context {constructor(...args){window.createdDuringTap=window.directTap;super(...args);window.testContext=this;}createAnalyser(){const a=super.createAnalyser();window.testAnalyser=a;return a;}};
});
const signal=()=>page.waitForFunction(()=>{const a=new Float32Array(testAnalyser.fftSize);testAnalyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.001);});
try {
 await page.goto('http://127.0.0.1:8769/webapp/editor/',{waitUntil:'domcontentloaded'});
 await page.locator('#browser-start').click();
 await page.waitForFunction(()=>document.body.dataset.editorView!=='firmware' && document.querySelector('#engine option[value="9"]'));
 assert.match(await page.locator('#version').textContent(),/2\.4\.1/);
 await page.locator('#tabs [data-tab="sound"]').click();
 await page.locator('#engine').selectOption('9');
 await page.locator('#fm6panel').waitFor({state:'visible'});
 await page.locator('#fm6read').click();
 await page.locator('#fm6voice input').first().waitFor();
 await page.locator('#fm6send').click();
 const download=page.waitForEvent('download');await page.locator('#audio-export').click();
 const saved=JSON.parse(await readFile(await (await download).path(),'utf8'));
 assert.equal(saved.version,2);assert.equal(saved.smp.length,4);assert.equal(saved.tracks[0].engine,9);
 assert.equal(saved.tracks[0].fm6.length,128);
 await page.locator('#tabs [data-tab="kits"]').click();
 await page.locator('#kit').waitFor({state:'visible'});
 await page.locator('#tabs [data-tab="samples"]').click();
 await page.locator('#smpslots').waitFor({state:'visible'});
 assert.match(await page.locator('#smpslots').textContent(),/USR4/);
 await page.locator('#tabs [data-tab="sound"]').click();
 await page.locator('.settings-menu').evaluate(e=>e.open=true);
 await page.locator('#web-skin').selectOption('stage');
 await page.locator('.settings-menu').evaluate(e=>e.open=false);
 await page.screenshot({path:'build/screenshots/studio-241-fm6.png',fullPage:true});
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  for(const theme of ['sloop','stage','matrix','dx','modeld','chocolate','vapor','midnight','space','bauhaus','ocean','arcade','hicon']) {
   for(const mode of ['dark','light']) {
    await page.locator('.settings-menu').evaluate(e=>e.open=true);
    await page.locator('#web-skin').selectOption(theme);
    await page.locator('#web-mode').selectOption(mode);
    await page.locator('.settings-menu').evaluate(e=>e.open=false);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}/${theme}/${mode}`);
   }
  }
 }
 // An existing 2.3 IndexedDB session is migrated on startup. Keep its exact
 // original record as a rollback backup when autosave first writes v2.
 const legacy=structuredClone(saved);legacy.version=1;legacy.smp.pop();delete legacy.fm6bank;
 const downgrade=p=>{if(p)p.tracks.forEach(t=>{t.engine=0;t.p.splice(50,3);delete t.micro;delete t.locks;delete t.fill;delete t.fm6;});};
 downgrade(legacy);legacy.slots.forEach(downgrade);legacy.bank.forEach(p=>{if(p){p.engine=0;p.p.splice(50,3);}});
 await page.evaluate(async data=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('sloop-browser-workspace',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('sessions','readwrite');tx.objectStore('sessions').put(data,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 },legacy);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('#browser-start').click();
 await page.waitForFunction(()=>document.getElementById('version').textContent.includes('2.4.1'));
 await page.waitForFunction(async()=>{
  const db=await new Promise(r=>{const q=indexedDB.open('sloop-browser-workspace',1);q.onsuccess=()=>r(q.result);});
  const values=await Promise.all(['current','before-2.4.1'].map(key=>new Promise(r=>{const q=db.transaction('sessions').objectStore('sessions').get(key);q.onsuccess=()=>r(q.result);})));db.close();
  return values[0]?.version===2&&values[1]?.version===1;
 });
 assert.deepEqual(errors,[]);
 console.log('Studio 2.4.1: FM6 editor/send, export, kits, USR4, 13 themes/light/dark/responsive and IndexedDB migration backup passed');
} catch(error) {console.log('Page errors:',errors);console.log(await page.locator('#status').textContent());throw error;}
finally {await browser.close();}
