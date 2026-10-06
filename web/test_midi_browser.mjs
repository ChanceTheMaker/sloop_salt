// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
if(process.env.STUDIO_STATIC_DIR){
 const root=resolve(process.env.STUDIO_STATIC_DIR);
 await page.route('http://127.0.0.1:8769/**',async route=>{
  const pathname=decodeURIComponent(new URL(route.request().url()).pathname),path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root+sep))return route.fulfill({status:403,body:''});
  try{await route.fulfill({path});}catch{await route.fulfill({status:404,body:''});}
 });
}
await page.addInitScript(()=>{
 document.cookie='sloop_simulator_tour_v1=seen; Path=/';
 const input=new EventTarget();Object.assign(input,{id:'usb-test',name:'Test USB keyboard',state:'connected'});
 const access=new EventTarget();access.inputs=new Map([[input.id,input]]);window.midiRequests=[];
 navigator.requestMIDIAccess=async options=>{midiRequests.push(options);return access;};
 window.usbNote=data=>{const event=new Event('midimessage');event.data=new Uint8Array(data);input.dispatchEvent(event);};
 window.usbDisconnect=()=>{input.state='disconnected';access.dispatchEvent(new Event('statechange'));};
 window.midiSent=[];const Node=window.AudioWorkletNode;
 window.AudioWorkletNode=class extends Node{constructor(...args){super(...args);const post=this.port.postMessage.bind(this.port);this.port.postMessage=data=>{if(data.type==='midi')midiSent.push(data.bytes);post(data);};}};
 const Context=window.AudioContext;window.AudioContext=class extends Context{createAnalyser(){const a=super.createAnalyser();window.midiAnalyser=a;return a;}};
});
try{
 await page.goto('http://127.0.0.1:8769/webapp/editor/',{waitUntil:'domcontentloaded'});
 await page.locator('#browser-start').click();await page.locator('#midi-enable').click();
 await page.locator('#midi-input').selectOption('usb-test');
 assert.deepEqual(await page.evaluate(()=>midiRequests),[{sysex:false}]);
 await page.evaluate(()=>usbNote([0x90,60,100]));
 await page.waitForFunction(()=>{const a=new Float32Array(midiAnalyser.fftSize);midiAnalyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.001);});
 assert.deepEqual(await page.evaluate(()=>midiSent.at(-1)),[0x90,60,100]);
 await page.evaluate(()=>{usbNote([0xb0,64,127]);usbNote([0x80,60,0]);});
 assert.deepEqual(await page.evaluate(()=>midiSent.at(-1)),[0x90,60,100]);
 await page.evaluate(()=>usbNote([0xb0,64,0]));assert.deepEqual(await page.evaluate(()=>midiSent.at(-1)),[0x80,60,0]);
 await page.locator('#view-firmware').click();await page.locator('#firmware-view').waitFor({state:'visible'});
 await page.evaluate(()=>usbNote([0x91,65,75]));assert.deepEqual(await page.evaluate(()=>midiSent.at(-1)),[0x91,65,75]);
 await page.evaluate(()=>usbDisconnect());assert.deepEqual(await page.evaluate(()=>midiSent.at(-1)),[0x81,65,0]);assert.equal(await page.locator('#midi-input').inputValue(),'');
 await page.screenshot({path:'build/screenshots/device-midi.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('USB MIDI browser: permission, selector, audible Studio audio, sustain, Simulator input and unplug cleanup passed');
}finally{await browser.close();}
