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
try{
 await mkdir('build/screenshots',{recursive:true});
 await page.goto(process.env.STANDALONE_URL||'http://127.0.0.1:8769/webapp/editor/',{waitUntil:'domcontentloaded'});
 await page.locator('#synth-start').waitFor({state:'visible'});
 assert.equal(await page.locator('#utility-drawer').evaluate(e=>e.open),false);
 assert.equal(await page.locator('#page-top').isVisible(),false);
 assert.equal(await page.locator('body').getAttribute('data-fm1-finish'),'orange');
 assert.equal(await page.locator('#firmware-view #play-keys button').count(),27);
 assert.equal(await page.evaluate(()=>!!window.testContext),false,'no audio permission needed to see device');
 assert.match(await page.locator('.device-credits').textContent(),/Chance Roth/);assert.match(await page.locator('.device-credits').textContent(),/Not affiliated/);
 await page.screenshot({path:'build/screenshots/standalone-start.png'});
 await page.locator('#synth-start').click();await page.locator('.synth-start').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>window.createdDuringTap),true,'AudioContext created directly from the tap');
 await page.waitForFunction(()=>document.querySelector('.native-status').textContent.includes('Stopped'));
 await page.locator('.native-splash').waitFor({state:'hidden'});
 const key=page.locator('#play-keys button[data-note="60"]');
 await key.hover();await page.mouse.down();await signal();await page.mouse.up();
 await page.keyboard.down('KeyA');await signal();await page.keyboard.up('KeyA');
 assert.equal(await page.locator('.native-toolbar #play-typing').count(),1);
 assert.equal(await page.locator('.native-toolbar #play-sustain svg').count(),1);
 assert.equal(await page.locator('.native-toolbar #play-stop svg').count(),1);
 await page.locator('#play-typing').uncheck();assert.equal(await page.locator('#play-typing').isChecked(),false);
 await page.locator('#play-typing').check();
 await page.locator('#play-sustain').click();assert.equal(await page.locator('#play-sustain').getAttribute('aria-pressed'),'true');
 await page.locator('#play-stop').click();assert.equal(await page.locator('#play-sustain').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('.play-controls').isVisible(),false);
 const screen=()=>page.locator('.native-screen').evaluate(e=>e.getBoundingClientRect().width);
 const initialWidth=await screen();
 await page.getByRole('button',{name:'Expanded',exact:true}).click();
 assert.ok(await screen()>initialWidth,'Expanded enlarges the screen');
 assert.ok(await page.locator('#play-keys button').count()>27);
 await page.getByRole('button',{name:'Device',exact:true}).click();
 await page.locator('.synth-power').click();await page.waitForFunction(()=>testContext.state==='suspended');
 await page.locator('.synth-power').click();await page.waitForFunction(()=>testContext.state==='running');
 await page.locator('.native-palette-menu>summary').click();await page.getByRole('button',{name:'Purple',exact:true}).click();
 await page.locator('#utility-drawer>summary').click();
 await page.locator('#audio-export').waitFor({state:'visible'});
 const download=page.waitForEvent('download');await page.locator('#audio-export').click();
 const session=JSON.parse(await readFile(await (await download).path(),'utf8'));assert.ok(session.native);
 await page.locator('#utility-drawer>summary').press('Escape');
 assert.equal(await page.locator('#utility-drawer').evaluate(e=>e.open),false);
 await page.locator('.native-help-button').click();await page.locator('.native-tour').waitFor({state:'visible'});await page.keyboard.press('Escape');
 await page.screenshot({path:'build/screenshots/standalone-desktop.png'});
 for(const size of [{width:390,height:844},{width:320,height:568},{width:740,height:360}]){
  await page.setViewportSize(size);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'viewport width');
  assert.ok(await page.locator('#firmware-view .play-keyboard').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right+1;}));
  assert.ok(await page.locator('.native-toolbar').evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.left>=p.left&&r.right<=p.right;}),'toolbar stays inside device');
  if(size.width===390)assert.ok(await page.locator('#firmware-view').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight),'mobile device fits screen');
  if(size.width===390)await page.screenshot({path:'build/screenshots/standalone-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Expanded',exact:true}).click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'Device',exact:true}).click();
 }
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#synth-start').waitFor({state:'visible'});
 assert.equal(await page.locator('#utility-drawer').evaluate(e=>e.open),false);
 assert.equal(await page.locator('body').getAttribute('data-fm1-finish'),'purple');
 assert.deepEqual(errors,[]);console.log('Standalone startup, audio, QWERTY, pause/resume, layout, drawer, export, help, saved finish and responsive bounds passed.');
}catch(error){console.log('Page errors:',errors);console.log(await page.locator('.synth-start-message').textContent());console.log(await page.locator('#status').textContent());throw error;}finally{await browser.close();}
