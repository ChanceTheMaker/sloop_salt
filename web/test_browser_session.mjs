// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {catalogFrom} from './audio/browser.js';
import {snapshot,validate} from './audio/session.js';
const module=await WebAssembly.compile(await readFile(new URL('./audio/engine.wasm',import.meta.url)));
const catalog=catalogFrom(module);
const html=await readFile(new URL('./editor.html',import.meta.url),'utf8');
const proto=html.split('/*PROTO-BEGIN*/')[1].split('/*PROTO-END*/')[0];
const E=vm.runInNewContext(proto+';({makeMockDevice,buildSlot,SMP})',{setTimeout,clearTimeout,setInterval,clearInterval,console,TextEncoder});
const mock=E.makeMockDevice({auto:false,catalog,noBackup:true});
for(let e=0;e<9;e++) {
 mock.state.engine=e;
 catalog.engines[e].presets.forEach((p,i)=>{
  mock.sim.reload(i);
  for(let n=0;n<58;n++)if(![0,25,26,27,29,30,31,32,39,40,49].includes(n))assert.equal(mock.state.p[n],p.values[n],`preset ${e}/${i}, parameter ${n}`);
 });
}
const s=Int16Array.from({length:11025},(_,i)=>Math.sin(i*2*Math.PI*220/22050)*18000);
const slot=E.buildSlot('TEST',[{s,root:60}]);
const u=mock.state.smp[0];u.flash.set(slot.hdr,0);u.flash.set(slot.data,512);u.zones=1;u.name='TEST';u.len=slot.data.length;u.next=512+slot.data.length;
const exported=snapshot(mock.state),restored=validate(JSON.parse(JSON.stringify(exported)));
assert.equal(restored.smp[0].zones,1);assert.deepEqual([...restored.smp[0].flash],[...u.flash]);
assert.deepEqual(restored.tracks,JSON.parse(JSON.stringify(mock.state.tracks)));
for(const mutate of [d=>d.format='felucca-backup',d=>d.tracks.pop(),d=>d.tracks[0].engine=12,d=>d.tracks[1].p[0]=Infinity,d=>d.smp[0].flash[0]=999,d=>d.slots[0].tracks[0].step[0].notes[0]=200]) {
 const bad=structuredClone(exported);mutate(bad);assert.throws(()=>validate(bad));
}
function sampleEnergy(loaded) {
 const e=new WebAssembly.Instance(module).exports;e.synth_init();e.synth_target(0);e.synth_engine(4);
 catalog.engines[4].presets[0].values.forEach((v,i)=>e.synth_param(i,v));
 e.synth_param(50,8);e.synth_param(35,0);e.synth_param(36,0);
 if(loaded){new Uint8Array(e.memory.buffer,e.synth_sample_buffer(0),0x14000).set(restored.smp[0].flash);e.synth_sample_apply(0);}
 e.synth_midi(0x90,60,100);const pcm=new Int32Array(e.memory.buffer);let sum=0;
 for(let b=0;b<300;b++){const p=e.synth_render()/4;for(const x of pcm.subarray(p,p+64))sum+=Math.abs(x);}
 return sum;
}
assert.equal(sampleEnergy(false),0,'empty USR1 is silent');assert.ok(sampleEnergy(true)>10000,'imported ADPCM sample plays through target SAMPLE engine');
mock.stop();console.log('Browser sessions: native preset values, schema rejection, full sample roundtrip and audible USR1 passed');
