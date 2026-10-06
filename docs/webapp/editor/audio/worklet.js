// SPDX-License-Identifier: GPL-3.0-only
// Resampling/worklet structure adapted from Chance Roth's Felucca browser port.
class SloopProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.engine=new WebAssembly.Instance(options.processorOptions.module).exports;
    this.engine.synth_init();
    this.samples=new Int32Array(this.engine.memory.buffer);
    this.index=32;this.position=0;this.a=[0,0];this.b=[0,0];
    this.state={tracks:[],g:[]};this.statusFrames=0;
    this.port.onmessage=({data})=>{
      if(data.type==='state') {
        data.tracks.forEach((t,k)=>{
          const old=this.state.tracks[k];this.engine.synth_target(k);
          if(old?.engine!==t.engine)this.engine.synth_engine(t.engine);
          t.p.forEach((v,i)=>{if(old?.engine!==t.engine||old?.p[i]!==v)this.engine.synth_param(i,v);});
          if(k<3)t.step.forEach((s,i)=>{
            if(JSON.stringify(s)!==JSON.stringify(old?.step?.[i]))this.engine.synth_step(k,i,s.n,s.time,s.flags,s.vel,s.lvl||0,s.rat||0,...s.notes);
          });
          else t.dstep.forEach((s,i)=>{
            const pack=a=>a.reduce((bits,v,k)=>bits|((v&3)<<(k*2)),0)>>>0;
            if(JSON.stringify(s)!==JSON.stringify(old?.dstep?.[i]))this.engine.synth_drum_step(i,s.on,pack(s.lvl),pack(s.rat));
          });
        });
        data.g.forEach((v,i)=>{if(this.state.g[i]!==v)this.engine.synth_global(i,v);});
        this.engine.synth_select(data.sel);this.engine.synth_solo(data.solo||0);this.state=data;
      } else if(data.type==='midi')this.engine.synth_midi(...data.bytes);
      else if(data.type==='transport')this.engine.synth_transport(data.op);
      else if(data.type==='panic')this.engine.synth_panic();
      else if(data.type==='sample') {
        if(data.slot>=0&&data.slot<3&&data.bytes.length===0x14000) {
          new Uint8Array(this.engine.memory.buffer,this.engine.synth_sample_buffer(data.slot),0x14000).set(data.bytes);
          this.engine.synth_sample_apply(data.slot);
        }
      }
    };
  }
  next() {
    if(this.index===32){this.offset=this.engine.synth_render()/4;this.index=0;}
    const i=this.offset+this.index++*2;
    this.b[0]=Math.max(-1,Math.min(1,this.samples[i]/32768));
    this.b[1]=Math.max(-1,Math.min(1,this.samples[i+1]/32768));
  }
  process(inputs,outputs) {
    const channels=outputs[0];if(!channels.length)return true;
    for(let i=0;i<channels[0].length;i++) {
      while(this.position>=1){this.a[0]=this.b[0];this.a[1]=this.b[1];this.next();this.position--;}
      for(let c=0;c<channels.length;c++)channels[c][i]=this.a[c%2]+(this.b[c%2]-this.a[c%2])*this.position;
      this.position+=44100/sampleRate;
    }
    this.statusFrames+=channels[0].length;
    if(this.statusFrames>=sampleRate/20) {
      this.statusFrames=0;
      this.port.postMessage({type:'transport',playing:!!this.engine.synth_playing(),positions:[0,1,2,3].map(k=>this.engine.synth_position(k))});
    }
    return true;
  }
}
registerProcessor('sloop-dsp',SloopProcessor);
