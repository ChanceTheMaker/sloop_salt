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
 navigator.requestMIDIAccess=()=>{throw Error('Unexpected hardware access');};
 const Context=window.AudioContext;window.AudioContext=class extends Context {createAnalyser(){const a=super.createAnalyser();window.testAnalyser=a;return a;}};
});
try{
 await page.goto('http://127.0.0.1:8769/webapp/editor/',{waitUntil:'domcontentloaded'});
 await page.locator('#view-firmware').click();
 const tour=page.locator('.native-tour'),next=tour.getByRole('button',{name:'Next',exact:true});
 await tour.waitFor({state:'visible'});
 assert.match(await tour.textContent(),/see it again/);
 assert.ok((await page.context().cookies()).some(c=>c.name==='sloop_simulator_tour_v1'));
 const fits=async()=>assert.ok(await page.locator('.native-tour-bubble').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),'tutorial fits viewport');
 await mkdir('build/screenshots',{recursive:true});
 await fits();await page.screenshot({path:'build/screenshots/tutorial-desktop.png'});
 for(let i=1;i<9;i++){await next.click();await fits();}
 assert.match(await tour.textContent(),/Replay this tour anytime/);
 await tour.getByRole('button',{name:'Back',exact:true}).click();assert.match(await tour.textContent(),/Arrange sections/);
 await next.click();await tour.getByRole('button',{name:'Done',exact:true}).click();
 assert.equal(await tour.isVisible(),false);
 assert.equal(await page.locator('.native-help-button').evaluate(e=>document.activeElement===e),true);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#view-firmware').click();await page.locator('.native-screen').waitFor({state:'visible'});
 assert.equal(await tour.isVisible(),false,'cookie suppresses automatic replay');
 await page.locator('.native-menu>summary').click();await page.locator('.native-menu-content>details>summary').click();
 await page.getByRole('button',{name:'Expanded',exact:true}).click();assert.equal(await page.locator('#firmware-view').getAttribute('data-layout'),'expanded');assert.equal(await page.locator('.native-menu').evaluate(e=>e.open),false);
 for(const viewport of [{width:390,height:844},{width:320,height:568},{width:740,height:360}]){
  await page.setViewportSize(viewport);await page.locator('.native-help-button').click();await fits();
  for(let i=1;i<9;i++){await next.click();await fits();if(i===4&&viewport.width===390)await page.screenshot({path:'build/screenshots/tutorial-mobile.png'});}
  await page.keyboard.press('Escape');assert.equal(await tour.isVisible(),false);
 }
 await page.setViewportSize({width:1440,height:1100});
 const toggle=page.getByRole('switch',{name:'FM-1 Touch Keys',exact:true});
 await page.waitForFunction(()=>document.querySelectorAll('#play-keys button').length>40);
 const originalNotes=await page.locator('#play-keys button').evaluateAll(keys=>keys.map(k=>k.dataset.note));
 await page.locator('.native-menu>summary').click();await toggle.click();
 assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.deepEqual(await page.locator('#play-keys button').evaluateAll(keys=>keys.map(k=>k.dataset.note)),originalNotes);
 await page.locator('.native-menu>summary').click();
 const key=page.locator('#play-keys button').first(),second=page.locator('#play-keys button:not(.black)').nth(1);
 const firstBox=await key.boundingBox(),secondBox=await second.boundingBox();
 const finish=element=>{const s=getComputedStyle(element);return [s.background,s.color,s.boxShadow,s.borderWidth];};
 const idleFinish=await key.evaluate(finish);
 await page.mouse.move(firstBox.x+firstBox.width/2,firstBox.y+firstBox.height-15);await page.mouse.down();
 assert.equal(await key.getAttribute('aria-pressed'),'true');
 assert.deepEqual(await key.evaluate(finish),idleFinish,'pressed capsule body stays unlit');
 assert.equal(await key.evaluate(e=>getComputedStyle(e,'::before').backgroundColor),'rgb(226, 255, 235)');
 await page.screenshot({path:'build/screenshots/fm1-touch-desktop.png'});
 await page.mouse.move(secondBox.x+secondBox.width/2,secondBox.y+secondBox.height-15);
 assert.equal(await key.getAttribute('aria-pressed'),'false');assert.equal(await second.getAttribute('aria-pressed'),'true');await page.mouse.up();
 assert.equal(await second.getAttribute('aria-pressed'),'false');
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('#view-firmware').click();await page.locator('.native-screen').waitFor({state:'visible'});
 assert.ok(await page.locator('body').evaluate(e=>e.classList.contains('fm1-touch-keys')),'touch preference survives reload');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'build/screenshots/fm1-touch-mobile.png'});
 await page.locator('#browser-start').click();await page.locator('#firmware-view').waitFor({state:'hidden'});
 assert.equal(await key.evaluate(e=>getComputedStyle(e).borderRadius)==='999px',false,'touch style is simulator-only');
 await page.locator('#view-firmware').click();await page.setViewportSize({width:1440,height:1100});
 await page.locator('.native-menu>summary').click();await toggle.click();
 assert.ok(await page.locator('#play-keys button').count()>27,'piano range restored');
 assert.deepEqual(errors,[]);console.log('Tutorial, layout menu, touch keys, illumination, sliding, persistence and responsive bounds passed');
}finally{await browser.close();}
