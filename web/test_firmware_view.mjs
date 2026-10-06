// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(60000);
page.on('requestfailed',r=>console.error('Request failed:',r.url(),r.failure()));
await page.addInitScript(()=>{
 navigator.requestMIDIAccess=()=>{throw Error('Unexpected hardware access');};
 const Context=window.AudioContext;window.AudioContext=class extends Context {createAnalyser(){const a=super.createAnalyser();window.testAnalyser=a;return a;}};
});
try{
 console.log('Loading editor');
 await page.goto('http://127.0.0.1:8769/webapp/editor/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#browser-start').click();await page.waitForFunction(()=>!document.getElementById('connect').disabled&&document.querySelector('#play-keys button:not(:disabled)'));
 await page.locator('#view-firmware').click();await page.locator('.fw-track').first().waitFor({state:'visible'});
 console.log('Firmware audio started');
 await page.getByRole('button',{name:'Expanded',exact:true}).click();
 assert.equal(await page.locator('#firmware-view').getAttribute('data-layout'),'expanded');
 await page.getByRole('button',{name:'Device',exact:true}).click();
 assert.equal(await page.locator('#tabs').isVisible(),false);
 await page.locator('.fw-pages button').getByText('ENV',{exact:true}).click();
 await page.locator('.fw-control input[aria-label=ATK]').fill('42');
 await page.locator('#browser-start').click();
 await page.waitForFunction(()=>document.querySelector('#groups input[aria-label=ATK]').value==='42');
 await page.locator('#view-firmware').click();
 await page.locator('.fw-track').nth(1).click();
 await page.waitForFunction(()=>document.querySelectorAll('.fw-track')[1].getAttribute('aria-pressed')==='true');
 await page.locator('.fw-sound select').first().selectOption('2');
 await page.waitForFunction(()=>document.querySelector('.fw-sound select').value==='2'&&!document.querySelector('.fw-sound select').disabled);
 await page.locator('.fw-sound select').first().evaluate(e=>e.blur());
 await page.keyboard.down('a');
 await page.waitForFunction(()=>{const a=new Float32Array(testAnalyser.fftSize);testAnalyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.001);});
 await page.keyboard.up('a');
 console.log('Shared state and keyboard audio passed');
 for(const name of ['TRACKS','ENV','ENV DEST','LFO','LFO DEST','FX','SCL','ARP','ARP 2','EDIT','EDIT 2','SEQ','VOICE','SLICER']){
  await page.locator('.fw-pages button').getByText(name,{exact:true}).click();
  assert.ok(await page.locator('.fw-control').count()<=4);
 }
 await page.locator('.fw-track').nth(3).click();
 await page.waitForFunction(()=>document.querySelectorAll('.fw-track')[3].getAttribute('aria-pressed')==='true');
 await page.locator('.fw-pages button').getByText('EDIT',{exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.fw-control').length===1);
 assert.equal(await page.locator('.fw-sound select').first().isDisabled(),true);
 await page.locator('.fw-track').first().click();
 await page.waitForFunction(()=>document.querySelectorAll('.fw-track')[0].getAttribute('aria-pressed')==='true'&&!document.querySelectorAll('.fw-track')[0].disabled);
 await page.locator('.fw-pages button').getByText('TRACKS',{exact:true}).click();
 assert.equal(await page.locator('.fw-control input').last().getAttribute('aria-label'),'PAN');
 await page.setViewportSize({width:390,height:1000});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile fits');
 await page.setViewportSize({width:1440,height:1100});await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(500);
 await mkdir('build/screenshots',{recursive:true});await page.screenshot({path:'build/screenshots/firmware-view.png',fullPage:true});
 const downloaded=page.waitForEvent('download');await page.locator('#audio-export').click();
 const saved=JSON.parse(await readFile(await (await downloaded).path(),'utf8'));
 assert.equal(saved.tracks[0].p[1],42);assert.equal(saved.tracks[1].engine,2);
 await page.locator('#device-mode').click();await page.locator('#firmware-view').waitFor({state:'hidden'});
 assert.equal(await page.locator('#tabs').isVisible(),true);assert.deepEqual(errors,[]);
 console.log('Firmware view: shared parameters, tracks, engines, audio, pages, drums, export, mobile and device exit passed.');
}catch(error){console.error('Editor status:',await page.locator('#status').textContent(),errors);throw error;}finally{await browser.close();}
