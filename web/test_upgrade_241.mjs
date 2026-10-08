// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {catalogFrom} from './audio/browser.js';
import {NativeState} from './audio/native-state.js';
import {snapshot,validate} from './audio/session.js';
const module=await WebAssembly.compile(await readFile(new URL('./audio/engine.wasm',import.meta.url)));
const catalog=catalogFrom(module);
const html=await readFile(new URL('./editor.html',import.meta.url),'utf8');
const proto=html.split('/*PROTO-BEGIN*/')[1].split('/*PROTO-END*/')[0];
const E=vm.runInNewContext(proto+';({makeMockDevice,FM6,buildSlot})',{setTimeout,clearTimeout,setInterval,clearInterval,console,TextEncoder});
const mock=E.makeMockDevice({auto:false,catalog,noBackup:true});
try {
 const old=JSON.parse(JSON.stringify(snapshot(mock.state)));old.version=1;
 const oldProject=p=>{if(p)p.tracks.forEach(t=>{t.p.splice(50,3);delete t.micro;delete t.locks;delete t.fill;delete t.fm6;});};
 oldProject(old);old.slots.forEach(oldProject);
 old.bank.forEach(p=>{if(p)p.p.splice(50,3);});old.smp.pop();delete old.fm6bank;
 const original=JSON.stringify(old),up=validate(old);
 assert.equal(JSON.stringify(old),original,'migration never mutates the original export');
 assert.deepEqual(up.tracks[0].p.slice(0,50),old.tracks[0].p.slice(0,50));
 assert.deepEqual(up.tracks[0].p.slice(50,53),[0,0,0]);
 assert.deepEqual(up.tracks[0].p.slice(53),old.tracks[0].p.slice(50));
 assert.equal(up.smp.length,4);assert.ok(up.smp[3].flash.every(x=>x===255));
 assert.deepEqual([...up.smp[0].flash],old.smp[0].flash);
 assert.deepEqual(up.tracks[0].micro,new Array(64).fill(0));
 assert.equal(snapshot(up).version,2);
 const bad=structuredClone(old);bad.tracks[0].p.pop();assert.throws(()=>validate(bad));
 console.log('2.3 migration: parameters, projects, samples and original export preserved');

 const e=new WebAssembly.Instance(module).exports;e.synth_init();const native=new NativeState(e);
 const state=validate(JSON.parse(JSON.stringify(snapshot(mock.state))));state.tracks[0].engine=9;
 state.tracks[0].p=catalog.engines[9].presets[0].values.slice();
 state.tracks[0].micro[7]=-19;state.tracks[0].fill[1]=1<<6;
 state.tracks[0].locks=[{step:7,param:50,value:-20},{step:8,param:53,value:16}];
 const voice=E.FM6.factory(0);voice[14]=3; // operator AMS: the 2.4.1 hotfix path
 const patch=Array.from(E.FM6.pack(voice));state.tracks[0].fm6=patch;state.fm6bank[26]=patch;
 native.write(state);let round=native.read();
 assert.deepEqual(round.tracks[0].micro,state.tracks[0].micro);
 assert.deepEqual(round.tracks[0].fill,state.tracks[0].fill);
 assert.deepEqual(round.tracks[0].locks,state.tracks[0].locks);
 assert.deepEqual(round.tracks[0].fm6,patch);assert.deepEqual(round.fm6bank[26],patch);
 const exported=validate(snapshot({...round,smp:state.smp}));
 native.write(exported);round=native.read();assert.deepEqual(round.tracks[0].fm6,patch);
 assert.deepEqual(round.tracks[0].locks,state.tracks[0].locks);
 e.synth_midi(0x90,60,100);let sum=0;const pcm=new Int32Array(e.memory.buffer);
 for(let i=0;i<300;i++){const p=e.synth_render()/4;for(const v of pcm.subarray(p,p+64))sum+=Math.abs(v);}
 assert.ok(sum>1000,'imported FM6 patch renders audio');
 e.synth_panic();
 const sample=Int16Array.from({length:11025},(_,i)=>Math.sin(i*2*Math.PI*220/22050)*18000);
 const slot=E.buildSlot('USR4',[{s:sample,root:60}]);
 const bytes=new Uint8Array(e.memory.buffer,e.synth_sample_buffer(3),0x14000);
 bytes.fill(255);bytes.set(slot.hdr);bytes.set(slot.data,512);e.synth_sample_apply(3);
 e.synth_target(0);e.synth_engine(4);catalog.engines[4].presets[0].values.forEach((v,i)=>e.synth_param(i,v));e.synth_param(53,11);
 for(let i=0;i<100;i++)e.synth_render();e.synth_midi(0x90,60,100);sum=0;
 for(let i=0;i<300;i++){const p=e.synth_render()/4;for(const v of pcm.subarray(p,p+64))sum+=Math.abs(v);}
 assert.ok(sum>1000,'fourth sample slot renders through the real DSP');
 console.log('2.4.1: FM6/AMS patch, bank, microtiming, locks, fills and USR4 roundtrip passed');
} finally {mock.stop();}
