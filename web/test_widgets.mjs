// SPDX-License-Identifier: GPL-3.0-only
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const W=vm.runInNewContext(read('./studio-widgets.js')+';SloopWidgets');
const seq=read('../firmware/src/seq.c');
const body=seq.match(/SCALE_MASK\[\] = \{([\s\S]*?)\};/)[1].replace(/\/\*[\s\S]*?\*\//g,'');
const masks=body.split(',').map(x=>x.trim()).filter(Boolean).map(x=>vm.runInNewContext(x));
for(let scale=0;scale<masks.length;scale++)for(let root=0;root<12;root++) {
 const expected=Array.from({length:12},(_,i)=>i).filter(i=>masks[scale]&(1<<i)).map(i=>(i+root)%12);
 assert.deepEqual(Array.from(W.scaleNotes(root,scale)),expected);
}
const slicer=read('../firmware/src/slicer.c').match(/SL_PAT\[SL_NPAT\] = \{([\s\S]*?)\};/)[1];
const patterns=[...slicer.matchAll(/0x[0-9A-F]+/g)].map(m=>Number(m[0]));
patterns.forEach((p,i)=>assert.deepEqual(Array.from(W.slicerSteps(i+1)),Array.from({length:16},(_,k)=>!!(p&(1<<k)))));
for(let cut=0;cut<=127;cut++)assert.ok(Math.abs(W.filterCutAt(W.filterHandle(cut,64)[0])-cut)<1e-8);
console.log('Widgets: all target scale masks, slicer patterns and filter coordinate round trips passed');
