// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 for(const scenario of ['audio','storage']){
  const page=await browser.newPage();page.setDefaultTimeout(25000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(scenario=>{
   localStorage.setItem('sloop.web.analyticsConsent','denied');
   document.cookie='sloop_simulator_tour_v1=seen; Path=/; SameSite=Lax';
   if(scenario==='audio'){
    const Context=window.AudioContext;let first=true;
    window.AudioContext=class extends Context {resume(){if(first){first=false;return new Promise(()=>{});}return super.resume();}};
   }else{
    const open=indexedDB.open.bind(indexedDB);let first=true;
    indexedDB.open=(...args)=>{if(first&&args[0]==='sloop-browser-workspace'){first=false;return {};}return open(...args);};
   }
  },scenario);
  await page.goto('http://127.0.0.1:8769/webapp/editor/',{waitUntil:'domcontentloaded'});
  await page.locator('#synth-start').click();
  try{await page.waitForFunction(()=>document.querySelector('#synth-start').textContent==='Try again');}catch(e){console.log(scenario,await page.locator('.synth-start-message').textContent(),await page.locator('#status').textContent(),errors);throw e;}
  assert.equal(await page.locator('#synth-start').isEnabled(),true);
  assert.match(await page.locator('.synth-start-message').textContent(),scenario==='audio'?/Audio activation timed out/:/storage did not respond/);
  await page.locator('#synth-start').click();await page.locator('.synth-start').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('.native-status').textContent.includes('Stopped'));
  assert.deepEqual(errors,[]);console.log(scenario+' stalled startup recovered through Retry');await page.close();
 }
}finally{await browser.close();}
