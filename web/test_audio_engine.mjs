// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {catalogFrom} from './audio/browser.js';
import {NativeState} from './audio/native-state.js';
const module=await WebAssembly.compile(await readFile(new URL('./audio/engine.wasm',import.meta.url)));
assert.deepEqual(WebAssembly.Module.imports(module),[],'no hardware/runtime imports');
const catalog=catalogFrom(module);
assert.equal(catalog.engines.length,10);assert.equal(catalog.common.length,53);assert.equal(catalog.globals.length,32);
const fresh=()=>{const e=new WebAssembly.Instance(module).exports;e.synth_init();return e;};
function preset(e,engine,p=0,k=0) {
 e.synth_target(k);e.synth_engine(engine);
 catalog.engines[engine].presets[p].values.forEach((v,i)=>e.synth_param(i,v));
 e.synth_param(17,0);e.synth_param(35,0);e.synth_param(36,0);
}
function energy(e,blocks=700) {
 const pcm=new Int32Array(e.memory.buffer);let sum=0,peak=0;
 for(let b=0;b<blocks;b++) {
  const offset=e.synth_render()/4;
  for(const x of pcm.subarray(offset,offset+64)){assert.ok(Number.isFinite(x));sum+=Math.abs(x);peak=Math.max(peak,Math.abs(x));}
 }
 return {sum,peak};
}
let presets=0;
for(let engine=0;engine<10;engine++) {
 for(let p=0;p<catalog.engines[engine].presets.length;p++) {
  const e=fresh();preset(e,engine,p);e.synth_midi(0x90,engine===4&&catalog.engines[engine].presets[p].values[53]===7?36:60,110);
  assert.ok(energy(e).sum>1000,`${catalog.engines[engine].name}/${p} is audible`);
  presets++;
 }
}
const e=fresh();preset(e,0);e.synth_target(0);e.synth_param(4,0);
e.synth_midi(0x90,60,100);assert.ok(energy(e).sum>1000);
e.synth_midi(0x80,60,0);energy(e,2000);assert.ok(energy(e,100).peak<10,'released voice settles to silence');
// All drum kits, including sampled kit zero and synthesised kit 36.
for(let kit=0;kit<37;kit++) {
 const d=fresh();d.synth_target(3);d.synth_param(53,kit);d.synth_midi(0x99,36,110);
 assert.ok(energy(d,300).sum>1000,`drum kit ${kit}`);
}
const seq=fresh();preset(seq,0);seq.synth_step(0,0,1,0,0,100,0,0,60,0,0,0);
seq.synth_transport(1);assert.ok(energy(seq,1500).sum>1000);assert.equal(seq.synth_playing(),1);
assert.ok(seq.synth_position(0)>0);seq.synth_panic();energy(seq,1);assert.equal(seq.synth_playing(),0);
// Exercise actual worklet resampling at both common device sample rates.
for(const sampleRate of [44100,48000]) {
 let Processor;const messages=[];
 const sandbox={WebAssembly,Int32Array,Uint8Array,Math,JSON,sampleRate,NativeState,
  AudioWorkletProcessor:class {constructor(){this.port={postMessage:data=>messages.push(data)};}},
  registerProcessor:(name,klass)=>{assert.equal(name,'sloop-dsp');Processor=klass;}};
 vm.runInNewContext((await readFile(new URL('./audio/worklet.js',import.meta.url),'utf8')).replace(/^import .*;$/m,''),sandbox);
 const p=new Processor({processorOptions:{module}});preset(p.engine,0);p.engine.synth_midi(0x90,60,100);
 let sum=0;
 for(let i=0;i<100;i++){const channels=[new Float32Array(128),new Float32Array(128)];p.process([], [channels]);for(const c of channels)for(const x of c){assert.ok(Number.isFinite(x)&&Math.abs(x)<=1);sum+=Math.abs(x);}}
 assert.ok(sum>1);assert.ok(messages.length>0);
}
console.log(`SLOOP DSP: ${presets} factory presets, 10 engines, 37 drum kits, release/panic, sequencer and 44.1/48kHz worklets passed`);
