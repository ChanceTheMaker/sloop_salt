// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
// Optional static transport for environments that reset localhost connections.
// This still executes the built editor, native WASM and worklet in real Edge.
if(process.env.STUDIO_STATIC_DIR){
 const root=resolve(process.env.STUDIO_STATIC_DIR);
 await page.route('http://127.0.0.1:8769/**',async route=>{
  const pathname=decodeURIComponent(new URL(route.request().url()).pathname);
  const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!path.startsWith(root+sep))return route.fulfill({status:403,body:''});
  try{await route.fulfill({path});}catch{await route.fulfill({status:404,body:''});}
 });
}
const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('requestfailed',r=>console.error('Request failed:',r.url(),r.failure()));
page.setDefaultTimeout(20000);
await page.addInitScript(()=>{
 window.midiRequests=0;navigator.requestMIDIAccess=async()=>{midiRequests++;throw new Error('Hardware MIDI must not be requested');};
 const Context=window.AudioContext;
 window.AudioContext=class extends Context {constructor(options){super(options);window.testAudio=this;}createAnalyser(){const a=super.createAnalyser();window.testAnalyser=a;return a;}};
});
const url=process.env.STUDIO_URL||'http://127.0.0.1:8769/webapp/editor/';
const signal=()=>page.evaluate(()=>{const a=new Float32Array(testAnalyser.fftSize);testAnalyser.getFloatTimeDomainData(a);return a.reduce((v,x)=>v+x*x,0)/a.length;});
const waitSignal=async()=>page.waitForFunction(()=>{const a=new Float32Array(testAnalyser.fftSize);testAnalyser.getFloatTimeDomainData(a);return a.some(v=>Math.abs(v)>.001);});
try {
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#browser-start').click();
 await page.waitForFunction(()=>!document.getElementById('connect').disabled&&document.querySelector('#play-keys button:not(:disabled)'),null,{timeout:60000});
 assert.equal(await page.evaluate(()=>midiRequests),0);
 assert.match(await page.locator('#version').textContent(),/BROWSER/);
 assert.equal(await page.locator('#bkgroup').isVisible(),false,'device backup unavailable in browser mode');
 await page.locator('#connect').evaluate(e=>e.blur());
 await page.keyboard.down('a');await waitSignal();assert.ok(await signal()>0);
 await page.keyboard.up('a');
 await page.locator('#play-sustain').click();await page.locator('#play-sustain').evaluate(e=>e.blur());
 await page.keyboard.press('s');assert.ok(await page.locator('#play-keys [aria-pressed=true]').count()>0);
 await page.locator('#audio-stop').click();assert.equal(await page.locator('#play-keys [aria-pressed=true]').count(),0);
 await page.locator('#trackbtns button').nth(3).click();await page.locator('#trackbtns button').nth(3).evaluate(e=>e.blur());
 await page.waitForFunction(()=>document.querySelectorAll('#trackbtns button')[3].getAttribute('aria-pressed')==='true'&&document.getElementById('status').textContent==='Browser synth ready');
 await page.keyboard.press('a');await waitSignal();
 await page.locator('#trackbtns button').nth(0).click();
 await page.waitForFunction(()=>document.querySelectorAll('#trackbtns button')[0].getAttribute('aria-pressed')==='true'&&document.getElementById('status').textContent==='Browser synth ready');
 // Upload a real WAV through the existing sample editor, then play USR1.
 page.on('dialog',d=>d.accept());
 const wav=Buffer.alloc(44+11025*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);
 wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
 for(let i=0;i<11025;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/22050)*18000),44+2*i);
 await page.locator('#tabs [data-tab="samples"]').click();
 await page.locator('.smp[data-k="0"] input[type=file]').setInputFiles({name:'tone_C4.wav',mimeType:'audio/wav',buffer:wav});
 await page.locator('.smp[data-k="0"]').getByRole('button',{name:'Upload',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Uploaded USR'));
 await page.locator('#tabs [data-tab="sound"]').click();
 await page.locator('#engine').selectOption('4');
 await page.waitForFunction(()=>document.getElementById('status').textContent==='Browser synth ready'&&document.getElementById('engine').value==='4');
 await page.locator('#groups select[aria-label="SET"]').selectOption('8');
 // selectOption does not move focus: leave the Sound tab before QWERTY play.
 await page.evaluate(()=>document.activeElement?.blur());
 await page.keyboard.down('a');await waitSignal();await page.keyboard.up('a');
 const exportPromise=page.waitForEvent('download');await page.locator('#audio-export').click();
 const exported=await exportPromise;const session=JSON.parse(await readFile(await exported.path(),'utf8'));
 assert.equal(session.format,'sloop-browser-session');assert.equal(session.tracks.length,4);assert.equal(session.smp.length,3);
 assert.equal(session.tracks[0].engine,4);assert.equal(session.tracks[0].p[50],8);assert.equal(session.smp[0].zones,1);
 // Restore an edited sequence through the user-facing session import.
 session.tracks[0].step[0]={n:1,notes:[60,0,0,0],time:0,flags:0,vel:100,lvl:0,rat:0};
 session.tracks[0].p[29]=4;
 await page.locator('#audio-file').setInputFiles({name:'session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(session))});
 await page.waitForFunction(()=>!document.getElementById('audio-play').disabled);
 await page.locator('#audio-play').click();
 await page.waitForFunction(()=>document.getElementById('audio-play').getAttribute('aria-pressed')==='true');
 await waitSignal();assert.notEqual(await page.locator('#audio-position').textContent(),'');
 await page.locator('#audio-stop').click();
 await page.waitForFunction(()=>document.getElementById('audio-play').getAttribute('aria-pressed')==='false');
 await page.setViewportSize({width:390,height:1000});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'browser controls fit mobile');
 await page.setViewportSize({width:1440,height:1000});
 await mkdir('build/screenshots',{recursive:true});
 await page.locator('#audio-stop').evaluate(e=>e.blur());await page.keyboard.down('a');await waitSignal();
 await page.screenshot({path:'build/screenshots/browser-synth.png'});await page.keyboard.up('a');
 await page.locator('#connect').click();
 await page.waitForFunction(()=>testAudio.state==='suspended');
 await page.locator('#connect').click();await page.waitForFunction(()=>testAudio.state==='running'&&!document.getElementById('connect').disabled);
 await page.locator('#device-mode').click();await page.waitForFunction(()=>testAudio.state==='suspended');
 assert.equal(await page.locator('#browser-audio').isVisible(),false);assert.equal(await page.evaluate(()=>midiRequests),0);
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await page.locator('#browser-start').click();
 await page.waitForFunction(()=>!document.getElementById('connect').disabled&&document.querySelector('#play-keys button:not(:disabled)'));
 const againPromise=page.waitForEvent('download');await page.locator('#audio-export').click();
 const again=JSON.parse(await readFile(await(await againPromise).path(),'utf8'));
 assert.equal(again.tracks[0].step[0].notes[0],60,'pattern persists across reload');assert.equal(again.tracks[0].p[29],4);
 assert.deepEqual(again.smp[0].flash,session.smp[0].flash,'uploaded sample persists across reload');
 assert.deepEqual(errors,[]);
 console.log('Browser synth: real audio, QWERTY/drums/sustain/panic, sequencer, session export/import/persistence, mobile and FM-1 isolation passed');
}catch(error){
 console.error('Browser state:',await page.locator('#status').textContent(),await page.locator('#audio-status').textContent(),errors);
 await page.screenshot({path:'build/screenshots/browser-synth-failure.png'});throw error;
}finally{await browser.close();}
