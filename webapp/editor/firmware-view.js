// SPDX-License-Identifier: GPL-3.0-only
// Browser peripherals for the unmodified native firmware UI.
export function mountFirmwareView(host,api){
 const make=(tag,attrs={},text='')=>{const e=document.createElement(tag);Object.assign(e,attrs);e.textContent=text;return e;};
 const t=k=>window.SloopI18n.t('native.'+k);
 const buttons=['FX','SCL','ENV','LFO','EDIT','GLO','HOME','SAVE','ARP','SEQ','PLAY','REC','OCT−','OCT+'];
 const layout=make('div',{className:'fw-layouts',role:'group'}),device=make('button',{type:'button'}),expanded=make('button',{type:'button'});
 const canvas=make('canvas',{width:240,height:240,className:'native-screen'});canvas.setAttribute('role','img');
 const state=make('p',{className:'native-status'});state.setAttribute('aria-live','off');
 const screen=make('div',{className:'native-display'}),frame=make('div',{className:'native-screen-frame'}),splash=make('img',{className:'native-splash',src:'sloop-boot.svg',alt:'SLOOP startup splash',hidden:true});frame.append(canvas,splash);screen.append(frame,state);
 const encoders=make('div',{className:'native-encoders'}),panel=make('div',{className:'native-buttons'});
 const navigation=make('div',{className:'native-navigation'}),octaves=make('div',{className:'native-buttons native-octaves'});
 const toolbar=make('div',{className:'native-toolbar'}),help=make('button',{type:'button',className:'native-help-button'},'?');
 const menu=make('details',{className:'native-menu'}),menuToggle=make('summary',{},'☰'),submenu=make('details'),layoutToggle=make('summary');
 const menuContent=make('div',{className:'native-menu-content'}),touchKeys=make('button',{type:'button',className:'native-touch-toggle',role:'switch'});
 let touchEnabled=false;try{touchEnabled=localStorage.getItem('sloop.fm1TouchKeys')==='true';}catch{}
 const applyTouchKeys=()=>{touchKeys.setAttribute('aria-checked',String(touchEnabled));document.body.classList.toggle('fm1-touch-keys',touchEnabled||document.body.classList.contains('fm1-device-layout'));};
 touchKeys.onclick=()=>{touchEnabled=!touchEnabled;applyTouchKeys();try{localStorage.setItem('sloop.fm1TouchKeys',String(touchEnabled));}catch{}};
 submenu.append(layoutToggle,layout);menuContent.append(submenu,touchKeys);menu.append(menuToggle,menuContent);toolbar.append(help,menu);applyTouchKeys();
 // Names and five-stop swatches from firmware/src/gfx.c.
 const palettes=[['GREEN',['#00280c','#00541e','#108c36','#38c85c','#78ff92']],['AMBER',['#3c1a00','#6e3200','#aa5200','#e17808','#ffa628']],['CYAN',['#001e32','#003e60','#1070a0','#38acde','#8cdeff']],['RED',['#340808','#64120e','#aa241a','#e24030','#ff705c']],['MONO',['#282828','#505050','#828282','#bababa','#e2e2e2']]];
 const paletteMenu=make('details',{className:'native-palette-menu'}),paletteToggle=make('summary'),palettePopup=make('div',{className:'native-palette-popup'}),paletteHeading=make('strong');
 palettePopup.append(paletteHeading);paletteMenu.append(paletteToggle,palettePopup);toolbar.insertBefore(paletteMenu,menu);
 const paletteButtons=palettes.map(([name,colors],index)=>{const b=make('button',{type:'button',className:'native-palette-option'}),swatch=make('span',{className:'native-palette-strip'}),label=make('span',{},name);swatch.style.background=`linear-gradient(90deg,${colors.join(',')})`;b.append(swatch,label);b.onclick=()=>{emit(5,index,1);paletteMenu.open=false;paletteToggle.focus();};palettePopup.append(b);return b;});
 function paintPalette(index){const colors=palettes[index]?.[1]||palettes[4][1];paletteToggle.style.background=`conic-gradient(${colors.join(',')},${colors[0]})`;paletteButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));}
 paintPalette(4);
 document.addEventListener('pointerdown',e=>{if(!paletteMenu.contains(e.target))paletteMenu.open=false;});
 paletteMenu.addEventListener('toggle',()=>{if(paletteMenu.open)menu.open=false;});menu.addEventListener('toggle',()=>{if(menu.open)paletteMenu.open=false;});
 paletteMenu.addEventListener('keydown',e=>{if(e.key==='Escape'){paletteMenu.open=false;paletteToggle.focus();}});
 const controls=make('div',{className:'native-controls'});controls.append(encoders,panel);
 const body=make('div',{className:'native-body'});body.append(navigation,screen,controls);
 layout.append(device,expanded);host.replaceChildren(toolbar,body);
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
 buttons.forEach((name,id)=>{const b=make('button',{type:'button'},name);if(name==='PLAY'){b.textContent='PLAY\nSTOP';b.style.whiteSpace='pre-line';b.setAttribute('aria-label','PLAY');}wire(b,0,id);(id<12?panel:octaves).append(b);});
 ['MASTER','SELECT','ALGORITHM','PRESETS','KNOB 1','KNOB 2','KNOB 3','KNOB 4'].forEach((name,index)=>{
  const id=index-1;
  const wrap=make('div',{className:'native-encoder'}),label=make('span',{},name),dial=make('button',{type:'button',className:'native-dial'});
  let angle=0;const change=(n,fine=false)=>{if(id<0)api.volume(n);else emit(fine?4:1,id,n);angle=(angle+n*8)%360;dial.style.setProperty('--knob-angle',angle+'deg');};
  dial.setAttribute('aria-label',name);
  let drag=null;
  dial.addEventListener('pointerdown',e=>{if(e.button)return;drag={id:e.pointerId,y:e.clientY,fine:e.shiftKey};dial.setPointerCapture(e.pointerId);dial.focus();e.preventDefault();});
  dial.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;if(drag.fine!==e.shiftKey){drag.fine=e.shiftKey;drag.y=e.clientY;return;}const step=e.shiftKey?32:4,n=Math.trunc((drag.y-e.clientY)/step);if(n){change(n,e.shiftKey);drag.y-=n*step;}});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])dial.addEventListener(event,()=>{drag=null;});
  dial.addEventListener('keydown',e=>{const n={ArrowUp:1,ArrowRight:1,ArrowDown:-1,ArrowLeft:-1}[e.key];if(n){e.preventDefault();change(n,e.shiftKey);}});
  dial.addEventListener('wheel',e=>{if(document.activeElement!==dial)return;e.preventDefault();if(e.deltaY)change(e.deltaY<0?1:-1,e.shiftKey);},{passive:false});
  wrap.append(label,dial);
  if(id<3){wrap.style.order=String(id<1?id+1:id===2?2:3);navigation.append(wrap);}else encoders.append(wrap);
 });
 navigation.append(octaves);
 const keyboard=document.querySelector('.play-keyboard'),keyboardHome=document.createComment('Keyboard dock');keyboard.before(keyboardHome);
 let wasCollapsed=false,booted=false,bootTimer;
 function dockKeyboard(){
  const dock=shown&&host.dataset.layout==='device',wasDocked=document.body.classList.contains('fm1-device-layout');
  if(dock!==wasDocked){window.SloopPlay.release();if(dock){wasCollapsed=keyboard.classList.contains('collapsed');keyboard.classList.remove('collapsed');host.append(keyboard);}else{keyboardHome.after(keyboard);keyboard.classList.toggle('collapsed',wasCollapsed);}}
  document.body.classList.toggle('fm1-device-layout',dock);applyTouchKeys();window.SloopPlay.dock(dock);
 }
 const choose=mode=>{host.dataset.layout=mode;device.setAttribute('aria-pressed',String(mode==='device'));expanded.setAttribute('aria-pressed',String(mode==='expanded'));dockKeyboard();};
 device.onclick=()=>{choose('device');menu.open=false;};expanded.onclick=()=>{choose('expanded');menu.open=false;};choose('device');
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.open=false;});
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;menuToggle.focus();}});
 const tour=make('dialog',{className:'native-tour'}),spotlight=make('div',{className:'native-tour-spotlight'}),bubble=make('div',{className:'native-tour-bubble'});
 const progress=make('div',{className:'native-tour-progress'}),title=make('h2',{id:'native-tour-title'}),copy=make('p',{id:'native-tour-copy'}),actions=make('div',{className:'native-tour-actions'});
 const skip=make('button',{type:'button'}),back=make('button',{type:'button'}),next=make('button',{type:'button'});
 actions.append(skip,back,next);bubble.append(progress,title,copy,actions);tour.append(spotlight,bubble);document.body.append(tour);
 tour.setAttribute('aria-labelledby',title.id);tour.setAttribute('aria-describedby',copy.id);
 const steps=[['welcome',()=>help],['layout',()=>menuToggle],['sound',()=>navigation],['knobs',()=>encoders],['keyboard',()=>document.querySelector('.play-keyboard')],['layers',()=>panel],['record',()=>panel.children[11]],['song',()=>panel.children[7]],['finish',()=>help]];
 let step=0,tourStarted=false,tourFrame;
 function positionTour(){
  if(!tour.open)return;
  const r=steps[step][1]().getBoundingClientRect(),pad=12,w=innerWidth,h=innerHeight;
  const left=Math.max(pad,Math.min(w-pad,r.left)),right=Math.max(left,Math.min(w-pad,r.right)),top=Math.max(pad,Math.min(h-pad,r.top)),bottom=Math.max(top,Math.min(h-pad,r.bottom));
  Object.assign(spotlight.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
  const bh=bubble.offsetHeight,bw=bubble.offsetWidth,below=h-bottom>bh+28;
  const x=Math.max(pad,Math.min(w-bw-pad,(left+right-bw)/2)),y=Math.max(pad,Math.min(h-bh-pad,below?bottom+20:top-bh-20));
  Object.assign(bubble.style,{left:x+'px',top:y+'px'});bubble.dataset.arrow=below?'top':'bottom';
  bubble.style.setProperty('--arrow-x',Math.max(24,Math.min(bw-24,(left+right)/2-x))+'px');
 }
 function renderStep(){
  title.textContent=t('tour.'+steps[step][0]+'.title');copy.textContent=t('tour.'+steps[step][0]+'.body');progress.textContent=(step+1)+' / '+steps.length;
  skip.textContent=t('tour.close');back.textContent=t('tour.back');next.textContent=t(step===steps.length-1?'tour.done':'tour.next');back.disabled=step===0;
  steps[step][1]().scrollIntoView({block:'center',behavior:'instant'});positionTour();
 }
 function startTour(){
  if(tour.open)return;releaseAll();window.SloopPlay.release();menu.open=false;tourStarted=true;
  document.cookie='sloop_simulator_tour_v1=seen; Max-Age=31536000; Path=/; SameSite=Lax';
  step=0;tour.showModal();renderStep();next.focus({preventScroll:true});
 }
 function closeTour(restore=true){if(tour.open)tour.close();if(restore&&shown)help.focus({preventScroll:true});}
 help.onclick=startTour;skip.onclick=()=>closeTour();back.onclick=()=>{if(step){step--;renderStep();}};
 next.onclick=()=>{if(step===steps.length-1)closeTour();else{step++;renderStep();}};
 tour.addEventListener('cancel',e=>{e.preventDefault();closeTour();});
 tour.addEventListener('keydown',e=>e.stopPropagation());tour.addEventListener('keyup',e=>e.stopPropagation());
 const reposition=()=>{cancelAnimationFrame(tourFrame);tourFrame=requestAnimationFrame(positionTour);};
 window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);
 new ResizeObserver(reposition).observe(bubble);
 function translate(){device.textContent=window.SloopI18n.t('view.device');expanded.textContent=window.SloopI18n.t('view.expanded');canvas.setAttribute('aria-label',t('screen'));
  paletteToggle.title=t('colors');paletteToggle.setAttribute('aria-label',t('colors'));paletteHeading.textContent=t('colors');
  help.title=t('guide');help.setAttribute('aria-label',t('guide'));menuToggle.title=t('menu');menuToggle.setAttribute('aria-label',t('menu'));layoutToggle.textContent=t('layout');touchKeys.textContent=t('touchKeys');if(tour.open)renderStep();
  host.querySelectorAll('.native-dial').forEach(dial=>{dial.title=t('knobHelp');dial.setAttribute('aria-description',t('knobHelp'));});
 }
 translate();window.SloopI18n.onChange(translate);
 const ctx=canvas.getContext('2d',{alpha:false}),pixels=ctx.createImageData(240,240);
 function display(data){
  lastData=data;if(!shown)return;cancelAnimationFrame(pendingFrame);
  pendingFrame=requestAnimationFrame(()=>{
   paintPalette(data.state.native.prefs[0]);
   data.pixels.forEach((swapped,i)=>{const p=(swapped>>8)|((swapped&255)<<8),q=i*4;pixels.data[q]=(p>>11)*255/31;pixels.data[q+1]=((p>>5)&63)*255/63;pixels.data[q+2]=(p&31)*255/31;pixels.data[q+3]=255;});ctx.putImageData(pixels,0,0);
   const s=data.state.status;window.SloopPlay.nativeStatus(s);state.textContent=`${t('track')} ${s[0]+1} · ${s[2]||s[4]?t('recording'):s[3]?t('armed'):s[1]?t('playing'):t('stopped')} · ${t('layer')} ${['PLAY','FX','EDIT','ARP','SEQ','SCL','GLO','SAVE'][s[5]]||'PLAY'}`;
   host.querySelectorAll('[data-native-kind="0"]').forEach(b=>{const k=+b.dataset.nativeId;b.classList.toggle('lit',!!(s[18]&(1<<k)));b.classList.toggle('backlit',!!(s[19]&(1<<k)));});
   panel.children[11].classList.toggle('recording',!!(s[2]||s[3]||s[4]));
  });
 }
 window.addEventListener('blur',()=>{if(shown)releaseAll();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&shown)releaseAll();});
 api.listen(display);
 const maybeTour=()=>{if(shown&&!tourStarted&&!document.cookie.split('; ').includes('sloop_simulator_tour_v1=seen'))startTour();};
 return {show(on){shown=on;host.hidden=!on;window.SloopPlay.firmware(on?{panel:emit}:null);dockKeyboard();if(!on){clearTimeout(bootTimer);splash.hidden=true;host.removeAttribute('aria-busy');closeTour(false);menu.open=false;releaseAll();cancelAnimationFrame(pendingFrame);}else{if(lastData)display(lastData);if(!booted){booted=true;splash.hidden=false;host.setAttribute('aria-busy','true');bootTimer=setTimeout(()=>{splash.hidden=true;host.removeAttribute('aria-busy');maybeTour();},1000);}else requestAnimationFrame(maybeTour);}}};
}
