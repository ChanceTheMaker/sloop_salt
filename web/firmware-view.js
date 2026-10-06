// SPDX-License-Identifier: GPL-3.0-only
// Browser peripherals for the unmodified native firmware UI.
export function mountFirmwareView(host,api){
 const make=(tag,attrs={},text='')=>{const e=document.createElement(tag);Object.assign(e,attrs);e.textContent=text;return e;};
 const t=k=>window.SloopI18n.t('native.'+k);
 const buttons=['FX','SCL','ENV','LFO','EDIT','GLO','HOME','SAVE','ARP','SEQ','PLAY','REC','OCT−','OCT+'];
 const layout=make('div',{className:'fw-layouts',role:'group'}),device=make('button',{type:'button'}),expanded=make('button',{type:'button'});
 const canvas=make('canvas',{width:240,height:240,className:'native-screen'});canvas.setAttribute('role','img');
 const state=make('p',{className:'native-status'});state.setAttribute('aria-live','off');
 const screen=make('div',{className:'native-display'});screen.append(canvas,state);
 const encoders=make('div',{className:'native-encoders'}),panel=make('div',{className:'native-buttons'});
 const navigation=make('div',{className:'native-navigation'}),octaves=make('div',{className:'native-buttons native-octaves'});
 const guide=make('details',{className:'native-guide'}),summary=make('summary'),instructions=make('p');guide.append(summary,instructions);
 const controls=make('div',{className:'native-controls'});controls.append(encoders,panel);
 const body=make('div',{className:'native-body'});body.append(navigation,screen,controls);
 layout.append(device,expanded);host.replaceChildren(layout,body,guide);
 let shown=false,pendingFrame,lastData;const owners=new Map(),held=new Map();
 const emit=(kind,id,value)=>api.panel(kind,id,value);
 function paintHeld(){for(const b of host.querySelectorAll('[data-native-kind]'))b.setAttribute('aria-pressed',String(held.has(b.dataset.nativeKind+':'+b.dataset.nativeId)));}
 function release(owner){const key=owners.get(owner);if(!key)return;owners.delete(owner);const n=held.get(key)-1;if(n)held.set(key,n);else{held.delete(key);const [kind,id]=key.split(':').map(Number);emit(kind,id,0);}paintHeld();}
 function press(owner,kind,id){const key=kind+':'+id;if(owners.get(owner)===key)return;release(owner);owners.set(owner,key);held.set(key,(held.get(key)||0)+1);if(held.get(key)===1)emit(kind,id,1);paintHeld();}
 function releaseAll(){owners.clear();held.clear();api.release();paintHeld();}
 function wire(button,kind,id){
  button.dataset.nativeKind=kind;button.dataset.nativeId=id;button.setAttribute('aria-pressed','false');
  button.addEventListener('pointerdown',e=>{if(e.button&&e.pointerType==='mouse')return;e.preventDefault();button.focus({preventScroll:true});button.setPointerCapture(e.pointerId);press('pointer:'+e.pointerId,kind,id);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,e=>{release('pointer:'+e.pointerId);});
  button.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)press('button:'+e.code,kind,id);}});
  button.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();release('button:'+e.code);}});
  button.addEventListener('focusout',()=>{release('button:Space');release('button:Enter');});
  button.addEventListener('click',e=>{if(e.detail===0){const owner='assistive:'+kind+':'+id;press(owner,kind,id);setTimeout(()=>release(owner),50);}});
 }
 buttons.forEach((name,id)=>{const b=make('button',{type:'button'},name);wire(b,0,id);(id<12?panel:octaves).append(b);});
 ['MASTER','SELECT','ALGORITHM','PRESETS','KNOB 1','KNOB 2','KNOB 3','KNOB 4'].forEach((name,index)=>{
  const id=index-1;
  const wrap=make('div',{className:'native-encoder'}),label=make('span',{},name),dial=make('button',{type:'button',className:'native-dial'});
  let angle=0;const change=n=>{if(id<0)api.volume(n);else emit(1,id,n);angle=(angle+n*8)%360;dial.style.setProperty('--knob-angle',angle+'deg');};
  dial.setAttribute('aria-label',name);const minus=make('button',{type:'button'},'−'),plus=make('button',{type:'button'},'+');
  minus.setAttribute('aria-label',name+' −');plus.setAttribute('aria-label',name+' +');minus.onclick=()=>change(-1);plus.onclick=()=>change(1);
  let drag=null;
  dial.addEventListener('pointerdown',e=>{if(e.button)return;drag={id:e.pointerId,y:e.clientY};dial.setPointerCapture(e.pointerId);dial.focus();e.preventDefault();});
  dial.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;const step=e.shiftKey?12:4,n=Math.trunc((drag.y-e.clientY)/step);if(n){change(n);drag.y-=n*step;}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])dial.addEventListener(event,()=>{drag=null;});
  dial.addEventListener('keydown',e=>{const n={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[e.key];if(n){e.preventDefault();change(n*(e.shiftKey?10:1));}});
  dial.addEventListener('wheel',e=>{if(document.activeElement!==dial)return;e.preventDefault();change(e.deltaY<0?1:-1);},{passive:false});
  const adjust=make('div');adjust.append(minus,plus);wrap.append(label,dial,adjust);
  if(id<3){wrap.style.order=String(id<1?id+1:id===2?2:3);navigation.append(wrap);}else encoders.append(wrap);
 });
 navigation.append(octaves);
 const choose=mode=>{host.dataset.layout=mode;device.setAttribute('aria-pressed',String(mode==='device'));expanded.setAttribute('aria-pressed',String(mode==='expanded'));};
 device.onclick=()=>choose('device');expanded.onclick=()=>choose('expanded');choose('device');
 function translate(){device.textContent=window.SloopI18n.t('view.device');expanded.textContent=window.SloopI18n.t('view.expanded');canvas.setAttribute('aria-label',t('screen'));summary.textContent=t('guide');instructions.textContent=t('instructions');
 }
 translate();window.SloopI18n.onChange(translate);
 const ctx=canvas.getContext('2d',{alpha:false}),pixels=ctx.createImageData(240,240);
 function display(data){
  lastData=data;if(!shown)return;cancelAnimationFrame(pendingFrame);
  pendingFrame=requestAnimationFrame(()=>{
   data.pixels.forEach((swapped,i)=>{const p=(swapped>>8)|((swapped&255)<<8),q=i*4;pixels.data[q]=(p>>11)*255/31;pixels.data[q+1]=((p>>5)&63)*255/63;pixels.data[q+2]=(p&31)*255/31;pixels.data[q+3]=255;});ctx.putImageData(pixels,0,0);
   const s=data.state.status;window.SloopPlay.nativeStatus(s);state.textContent=`${t('track')} ${s[0]+1} · ${s[2]||s[4]?t('recording'):s[3]?t('armed'):s[1]?t('playing'):t('stopped')} · ${t('layer')} ${['PLAY','FX','EDIT','ARP','SEQ','SCL','GLO','SAVE'][s[5]]||'PLAY'}`;
   host.querySelectorAll('[data-native-kind="0"]').forEach(b=>{const k=+b.dataset.nativeId;b.classList.toggle('lit',!!(s[18]&(1<<k)));b.classList.toggle('backlit',!!(s[19]&(1<<k)));});
   panel.children[11].classList.toggle('recording',!!(s[2]||s[3]||s[4]));
  });
 }
 window.addEventListener('blur',()=>{if(shown)releaseAll();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&shown)releaseAll();});
 api.listen(display);
 return {show(on){shown=on;host.hidden=!on;window.SloopPlay.firmware(on?{panel:emit}:null);if(!on){releaseAll();cancelAnimationFrame(pendingFrame);}else if(lastData)display(lastData);}};
}
