// SPDX-License-Identifier: GPL-3.0-only
// Browser peripherals for the unmodified native firmware UI.
export function mountFirmwareView(host,api){
 const make=(tag,attrs={},text='')=>{const e=document.createElement(tag);Object.assign(e,attrs);e.textContent=text;return e;};
 const t=k=>window.SloopI18n.t('native.'+k);
 const buttons=['FX','SCL','ENV','LFO','EDIT','GLO','HOME','SAVE','ARP','SEQ','PLAY','REC','OCT−','OCT+'];
 const codes=['KeyA','KeyW','KeyS','KeyE','KeyD','KeyR','KeyF','KeyG','KeyY','KeyH','KeyU','KeyJ','KeyK','KeyO','KeyL','KeyP','Semicolon','KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash'];
 const layout=make('div',{className:'fw-layouts',role:'group'}),device=make('button',{type:'button'}),expanded=make('button',{type:'button'});
 const canvas=make('canvas',{width:240,height:240,className:'native-screen'});canvas.setAttribute('role','img');
 const state=make('p',{className:'native-status'});state.setAttribute('aria-live','off');
 const screen=make('div',{className:'native-display'});screen.append(canvas,state);
 const encoders=make('div',{className:'native-encoders'}),panel=make('div',{className:'native-buttons'}),piano=make('div',{className:'native-piano'});
 const guide=make('details',{className:'native-guide'}),summary=make('summary'),instructions=make('p');guide.append(summary,instructions);
 const controls=make('div',{className:'native-controls'});controls.append(encoders,panel);
 const body=make('div',{className:'native-body'});body.append(screen,controls);
 layout.append(device,expanded);host.replaceChildren(layout,body,piano,guide);
 let shown=false,pendingFrame,lastData;const owners=new Map(),held=new Map();
 const emit=(kind,id,value)=>api.panel(kind,id,value);
 function paintHeld(){for(const b of host.querySelectorAll('[data-native-kind]'))b.setAttribute('aria-pressed',String(held.has(b.dataset.nativeKind+':'+b.dataset.nativeId)));}
 function release(owner){const key=owners.get(owner);if(!key)return;owners.delete(owner);const n=held.get(key)-1;if(n)held.set(key,n);else{held.delete(key);const [kind,id]=key.split(':').map(Number);emit(kind,id,0);}paintHeld();}
 function press(owner,kind,id){release(owner);const key=kind+':'+id;owners.set(owner,key);held.set(key,(held.get(key)||0)+1);if(held.get(key)===1)emit(kind,id,1);paintHeld();}
 function releaseAll(){owners.clear();held.clear();api.release();paintHeld();}
 function wire(button,kind,id){
  button.dataset.nativeKind=kind;button.dataset.nativeId=id;button.setAttribute('aria-pressed','false');
  button.addEventListener('pointerdown',e=>{if(e.button&&e.pointerType==='mouse')return;e.preventDefault();button.focus({preventScroll:true});button.setPointerCapture(e.pointerId);press('pointer:'+e.pointerId,kind,id);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,e=>release('pointer:'+e.pointerId));
  button.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)press('button:'+e.code,kind,id);}});
  button.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();release('button:'+e.code);}});
  button.addEventListener('focusout',()=>{release('button:Space');release('button:Enter');});
  button.addEventListener('click',e=>{if(e.detail===0){const owner='assistive:'+kind+':'+id;press(owner,kind,id);setTimeout(()=>release(owner),50);}});
 }
 buttons.forEach((name,id)=>{const b=make('button',{type:'button'},name);wire(b,0,id);panel.append(b);});
 const keys=[];let white=0;
 for(let id=0;id<27;id++){
  const black=[1,3,6,8,10].includes((id+5)%12),b=make('button',{type:'button',className:black?'black':'white'});
  b.style.setProperty('--key-left',black?white-.32:white++);b.setAttribute('aria-label',`Key ${id+1}`);
  const label=({Semicolon:';',Comma:',',Period:'.',Slash:'/'})[codes[id]]||codes[id].replace('Key','');
  b.append(make('span',{},black?'':String(white)),make('small',{},label));wire(b,2,id);piano.append(b);keys.push(b);
 }
 ['SELECT','ALGORITHM','PRESETS','KNOB 1','KNOB 2','KNOB 3','KNOB 4'].forEach((name,id)=>{
  const wrap=make('div',{className:'native-encoder'}),label=make('span',{},name),dial=make('button',{type:'button',className:'native-dial'},'↕');
  dial.setAttribute('aria-label',name);const minus=make('button',{type:'button'},'−'),plus=make('button',{type:'button'},'+');
  minus.setAttribute('aria-label',name+' −');plus.setAttribute('aria-label',name+' +');minus.onclick=()=>emit(1,id,-1);plus.onclick=()=>emit(1,id,1);
  let drag=null;
  dial.addEventListener('pointerdown',e=>{if(e.button)return;drag={id:e.pointerId,y:e.clientY};dial.setPointerCapture(e.pointerId);dial.focus();e.preventDefault();});
  dial.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;const step=e.shiftKey?12:4,n=Math.trunc((drag.y-e.clientY)/step);if(n){emit(1,id,n);drag.y-=n*step;}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])dial.addEventListener(event,()=>{drag=null;});
  dial.addEventListener('keydown',e=>{const n={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[e.key];if(n){e.preventDefault();emit(1,id,n*(e.shiftKey?10:1));}});
  dial.addEventListener('wheel',e=>{if(document.activeElement!==dial)return;e.preventDefault();emit(1,id,e.deltaY<0?1:-1);},{passive:false});
  const adjust=make('div');adjust.append(minus,plus);wrap.append(label,dial,adjust);encoders.append(wrap);
 });
 const choose=mode=>{host.dataset.layout=mode;device.setAttribute('aria-pressed',String(mode==='device'));expanded.setAttribute('aria-pressed',String(mode==='expanded'));};
 device.onclick=()=>choose('device');expanded.onclick=()=>choose('expanded');choose('device');
 function translate(){device.textContent=window.SloopI18n.t('view.device');expanded.textContent=window.SloopI18n.t('view.expanded');canvas.setAttribute('aria-label',t('screen'));summary.textContent=t('guide');instructions.textContent=t('instructions');}
 translate();window.SloopI18n.onChange(translate);
 const ctx=canvas.getContext('2d',{alpha:false}),pixels=ctx.createImageData(240,240);
 function display(data){
  lastData=data;if(!shown)return;cancelAnimationFrame(pendingFrame);
  pendingFrame=requestAnimationFrame(()=>{
   data.pixels.forEach((swapped,i)=>{const p=(swapped>>8)|((swapped&255)<<8),q=i*4;pixels.data[q]=(p>>11)*255/31;pixels.data[q+1]=((p>>5)&63)*255/63;pixels.data[q+2]=(p&31)*255/31;pixels.data[q+3]=255;});ctx.putImageData(pixels,0,0);
   const s=data.state.status;state.textContent=`${t('track')} ${s[0]+1} · ${s[2]||s[4]?t('recording'):s[3]?t('armed'):s[1]?t('playing'):t('stopped')} · ${t('layer')} ${['PLAY','FX','EDIT','ARP','SEQ','SCL','GLO','SAVE'][s[5]]||'PLAY'}`;
   keys.forEach((b,k)=>{b.classList.toggle('lit',!!(s[16]&(1<<k)));b.classList.toggle('guide',!!(s[17]&(1<<k)));b.classList.toggle('backlit',!!(s[20]&(1<<k)));});
   Array.from(panel.children).forEach((b,k)=>{b.classList.toggle('lit',!!(s[18]&(1<<k)));b.classList.toggle('backlit',!!(s[19]&(1<<k)));});
   panel.children[11].classList.toggle('recording',!!(s[2]||s[3]||s[4]));
  });
 }
 window.addEventListener('keydown',e=>{
  if(!shown||e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.target.closest('input,select,textarea,[contenteditable=true]'))return;
  const k=codes.indexOf(e.code);if(k<0)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)press('qwerty:'+e.code,2,k);
 },true);
 window.addEventListener('keyup',e=>{if(shown&&codes.includes(e.code)){e.preventDefault();e.stopImmediatePropagation();release('qwerty:'+e.code);}},true);
 window.addEventListener('blur',()=>{if(shown)releaseAll();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&shown)releaseAll();});
 api.listen(display);
 return {show(on){shown=on;host.hidden=!on;if(!on){releaseAll();cancelAnimationFrame(pendingFrame);}else if(lastData)display(lastData);}};
}
