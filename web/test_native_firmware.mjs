// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {NativeState} from './audio/native-state.js';
import {catalogFrom} from './audio/browser.js';
import {snapshot,validate} from './audio/session.js';
const module=await WebAssembly.compile(await readFile(new URL('./audio/engine.wasm',import.meta.url))),catalog=catalogFrom(module);
const B={FX:0,SCL:1,ENV:2,LFO:3,EDIT:4,GLO:5,HOME:6,SAVE:7,ARP:8,SEQ:9,PLAY:10,REC:11,DOWN:12,UP:13};
{
 const e=new WebAssembly.Instance(module).exports;e.synth_init();const state=new NativeState(e);
 for(let palette=0;palette<5;palette++){e.fw_event(5,palette,1);e.fw_tick();assert.equal(state.read().native.prefs[0],palette);}
 e.fw_event(5,100,1);assert.equal(state.read().native.prefs[0],4,'invalid palette ignored');
}
function machine(){
 const e=new WebAssembly.Instance(module).exports;e.synth_init();const codec=new NativeState(e);
 for(let k=0;k<3;k++){e.synth_target(k);catalog.engines[0].presets[0].values.forEach((v,i)=>e.synth_param(i,v));}
 const frame=(n=1)=>{for(let j=0;j<n;j++){for(let i=0;i<22;i++)e.synth_render();e.fw_tick();}};
 const event=(kind,id,v)=>{e.fw_event(kind,id,v);frame();};
 const down=id=>event(0,id,1),up=id=>event(0,id,0),tap=id=>{down(id);up(id);};
 const key=id=>{event(2,id,1);event(2,id,0);};
 return {e,codec,frame,event,down,up,tap,key,knob:(id,n)=>event(1,id,n),state:()=>codec.read()};
}
{
 const m=machine();m.down(B.FX);m.frame(12);assert.equal(m.state().status[5],1);
 m.key(4);m.knob(4,10);assert.ok(m.state().g[27]>0,'FX dust knob');
 m.knob(3,-10);assert.ok(m.state().g[29]<0,'FX filter knob');
 m.tap(B.HOME);m.up(B.FX);m.frame(3);assert.equal(m.state().status[6],1,'layer lock');
 m.e.fw_release();m.frame(2);assert.equal(m.state().status[6],0,'focus loss releases locked layer');
 m.down(B.FX);m.frame(12);m.tap(B.HOME);m.up(B.FX);m.tap(B.ENV);assert.equal(m.state().status[6],0,'other function unlocks');
 m.down(B.SCL);m.frame(10);m.key(9);assert.deepEqual(m.state().tracks.slice(0,3).map(t=>t.p[25]),[2,2,2]);m.up(B.SCL);
 m.down(B.GLO);m.frame(10);m.key(0);m.key(9);assert.equal(m.state().tracks[0].p[40],1);assert.equal(m.state().solo,2);m.up(B.GLO);
 console.log('Native layers: FX, lock/unlock, song key, mute and solo passed');
}
{
 const m=machine();m.e.synth_select(3);m.key(4);m.down(B.SEQ);m.frame(10);m.key(0);m.key(7);m.key(14);
 assert.ok([0,4,8].every(i=>m.state().tracks[3].dstep[i].on&4),'snare steps');
 m.event(2,7,1);m.knob(4,1);m.knob(5,2);m.event(2,7,0);
 assert.equal(m.state().tracks[3].dstep[4].lvl[2],3);assert.equal(m.state().tracks[3].dstep[4].rat[2],2);
 m.key(0);m.up(B.SEQ);m.down(B.EDIT);m.frame(10);m.tap(B.DOWN);
 assert.equal(m.state().tracks[3].dstep[4].on,0,'undo');m.tap(B.UP);assert.ok(m.state().tracks[3].dstep[4].on&4,'redo');
 m.key(4);assert.equal(m.state().tracks[3].dstep[4].on,0,'erase lane');m.knob(4,1);assert.equal(m.state().tracks[3].p[29],32);m.up(B.EDIT);
 m.down(B.ARP);m.frame(10);m.knob(3,1);assert.equal(m.state().g[30],2);m.up(B.ARP);
 console.log('Native step editing: drum grid, level, ratchet, erase, undo/redo, length and roll rate passed');
}
{
 const m=machine();m.tap(B.REC);assert.equal(m.state().status[3],1,'free recording armed');
 m.event(2,0,1);m.frame(65);m.event(2,0,0);m.frame(10);m.tap(B.REC);m.frame(25);
 assert.ok(m.state().tracks[0].step.some(s=>s.n),'free take produced notes');
 m.e.synth_panic();m.frame();m.down(B.REC);m.frame(145);m.up(B.REC);assert.ok(m.state().tracks[0].step.every(s=>!s.n),'hold clears');
 m.down(B.EDIT);m.frame(10);m.tap(B.DOWN);m.up(B.EDIT);assert.ok(m.state().tracks[0].step.some(s=>s.n),'undo clear');
 console.log('Native free recording, hold-to-clear and undo passed');
}
{
 const m=machine();m.tap(B.REC);m.knob(3,1);m.knob(5,1);assert.equal((m.state().native.prefs[3]>>9)&3,3);
 m.tap(B.PLAY);m.frame(180);assert.ok(m.state().status[1]&&m.state().status[2],'count-in entered tempo recording');
 m.event(2,0,1);m.frame(20);m.event(2,0,0);m.tap(B.REC);m.tap(B.PLAY);m.frame(3);
 assert.ok(m.state().tracks[0].step.some(s=>s.n),'tempo recording retains notes');
 console.log('Native tempo recording and count-in passed');
}
{
 const m=machine();m.e.synth_step(0,0,1,0,0,100,0,0,60,0,0,0);
 m.down(B.SAVE);m.frame(15);m.key(7);assert.ok(m.state().slots[0],'section A stored');m.up(B.SAVE);
 m.e.synth_target(0);m.e.synth_param(1,75);m.down(B.SAVE);m.frame(15);m.key(9);assert.ok(m.state().slots[1]);m.key(0);m.frame(3);
 assert.notEqual(m.state().tracks[0].p[1],75,'section A restored');m.up(B.SAVE);
 // Song page: set two entries of one bar, then enable song mode.
 const state=m.state();state.native.arrangement=[2,0,0,0,0,1,1,1,...Array.from({length:14},()=>[0,1]).flat()];state.native.prefs[4]=1;m.codec.write(state);
 m.tap(B.PLAY);m.frame(175);assert.equal(m.state().status[12],1,'advanced to section B');assert.equal(m.state().tracks[0].p[1],75);
 assert.notEqual(m.codec.readProject(6).tracks[0].p[1],75,'autosave preserves original working loop');
 m.frame(180);assert.equal(m.state().status[1],0,'song ended');assert.notEqual(m.state().tracks[0].p[1],75,'original loop restored');
 const data=m.state();data.smp=Array.from({length:3},()=>({flash:new Uint8Array(0x14000).fill(255),zones:0,name:'',len:0,next:512}));
 const portable=validate(snapshot(data));const restored=machine();restored.codec.write(portable);
 assert.deepEqual(restored.state().slots,data.slots);assert.deepEqual(restored.state().native,data.native);
 console.log('Native sections, song transitions/end/loop restore and session persistence passed');
}
{
 const m=machine();m.down(B.SAVE);m.frame(15);m.key(7);m.key(9);m.key(0);m.key(23);m.up(B.SAVE);
 assert.equal(m.state().status[14],1,'song recording armed');m.tap(B.PLAY);m.frame(140);
 m.down(B.SAVE);m.frame(15);m.key(2);m.up(B.SAVE);m.frame(150);m.tap(B.PLAY);m.frame(3);
 const song=m.state().native.arrangement;assert.ok(song[0]>=2,'song recording captured transitions');
 assert.equal(song[4],0);assert.equal(song[6],1);assert.ok(song[5]>=1&&song[7]>=1);
 console.log('Native SONG REC captures bar-aligned live section transitions');
}
{
 const m=machine();m.tap(B.ENV);m.tap(B.SAVE);m.tap(B.SAVE);
 m.knob(6,1);m.knob(6,1);assert.ok(m.state().bank[0],'native preset saved');
 const attack=m.state().tracks[0].p[1];m.e.synth_target(0);m.e.synth_param(1,75);
 m.knob(4,1);m.knob(4,1);m.frame(2);assert.equal(m.state().tracks[0].p[1],attack,'native preset loaded');
 const copy=machine();copy.codec.write(m.state());assert.deepEqual(copy.state().bank,m.state().bank);
 m.knob(5,1);m.knob(5,1);assert.equal(m.state().bank[0],null,'native preset erased');
 m.tap(B.HOME);m.tap(B.SAVE);m.knob(6,-3);m.knob(5,-3);m.knob(3,1);m.knob(4,1);
 assert.equal(m.state().native.arrangement[0],1,'song length knob');
 assert.equal(m.state().native.arrangement[5],1,'song bars knob');
 m.tap(B.HOME);m.down(B.HOME);m.frame(80);m.up(B.HOME);assert.equal(m.state().status[8],1,'settings opened');
 const palette=m.state().native.prefs[0];m.knob(3,1);assert.notEqual(m.state().native.prefs[0],palette,'palette changed');
 for(let i=0;i<7;i++)m.knob(2,1);m.tap(B.UP);assert.equal(m.state().status[8],0,'hardware calibration returns safely');
 m.tap(B.REC);m.event(2,0,1);m.frame(10);m.e.fw_release();m.e.synth_panic();m.frame(3);
 assert.equal(m.state().status[4],0);assert.equal(m.state().status[3],0);assert.equal(m.state().status[2],0);
 console.log('Native user preset save/load/erase, arranger knobs, settings and recording panic passed');
}
{
 const m=machine();m.tap(B.ENV);m.e.synth_target(0);m.e.synth_param(1,20);
 for(let i=0;i<4;i++)m.event(4,3,1);
 assert.equal(m.state().tracks[0].p[1],24,'fine turns bypass native encoder acceleration');
 console.log('Native fine tuning uses exact parameter increments');
}
{
 const m=machine();m.frame();const pixels=new Uint16Array(m.e.memory.buffer,m.e.fw_screen(),240*240);assert.ok(pixels.some(x=>x));
 await mkdir('build/screenshots',{recursive:true});const rgb=Buffer.alloc(240*240*3);pixels.forEach((s,i)=>{const p=(s>>8)|((s&255)<<8);rgb[i*3]=(p>>11)*255/31;rgb[i*3+1]=((p>>5)&63)*255/63;rgb[i*3+2]=(p&31)*255/31;});
 await writeFile('build/screenshots/native-screen.ppm',Buffer.concat([Buffer.from('P6\n240 240\n255\n'),rgb]));
 console.log('Native 240×240 framebuffer rendered');
}
