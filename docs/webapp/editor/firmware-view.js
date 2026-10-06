// SPDX-License-Identifier: GPL-3.0-only
// Browser presentation of the four-column pages in firmware/src/params.c.
// The editor remains responsible for protocol, formatting and session state.
export function mountFirmwareView(host, api) {
 const text=k=>window.SloopI18n.t('view.'+k);
 const make=(tag,attrs={},content='')=>{const e=document.createElement(tag);Object.assign(e,attrs);e.textContent=content;return e;};
 const pages={TRACKS:[[1,1],[0,0],[0,29],[0,39]],ENV:[[0,1],[0,2],[0,3],[0,4]],
  'ENV DEST':[[0,5],[0,6],[0,7]],LFO:[[0,9],[0,10],[0,11],[0,12]],
  'LFO DEST':[[0,13],[0,14],[0,15],[0,16]],FX:[[0,33],[0,34],[0,35],[0,36]],
  SCL:[[0,25],[0,26],[0,27],[0,49]],ARP:[[0,17],[0,18],[0,19],[0,20]],
  'ARP 2':[[0,21],[0,22],[0,23],[0,24]],EDIT:[[0,50],[0,51],[0,52],[0,53]],
  'EDIT 2':[[0,54],[0,55],[0,56],[0,57]],SEQ:[[0,29],[0,30],[0,31],[0,32]],
  VOICE:[[0,37],[0,38],[0,41],[0,42]],'VOICE 2':[[0,43],[0,44],[0,39],[0,40]],
  'SCL 2':[[0,28]],DLY:[[1,4],[1,5],[1,6],[1,7]],'REV/CHO':[[1,8],[1,9],[1,10],[1,11]],
  GLOBAL:[[1,0],[1,1],[1,2],[1,3]],MASTER:[[1,27],[1,28],[1,29],[1,30]],
  SLICER:[[0,45],[0,46],[0,47],[0,48]]};
 let page='TRACKS',signature='',controls=[],frame,visible=false;
 const layouts=make('div',{className:'fw-layouts',role:'group'});
 const compact=make('button',{type:'button'}),expanded=make('button',{type:'button'});
 const layout=mode=>{host.dataset.layout=mode;compact.setAttribute('aria-pressed',String(mode==='device'));expanded.setAttribute('aria-pressed',String(mode==='expanded'));};
 compact.addEventListener('click',()=>layout('device'));expanded.addEventListener('click',()=>layout('expanded'));
 layouts.append(compact,expanded);layout('device');
 const screen=make('div',{className:'fw-screen'});
 const toolbar=make('div',{className:'fw-toolbar'}),title=make('h2',{},'TRACKS');
 const tempo=make('input',{type:'number',min:'40',max:'240',value:'90'});
 const tempoLabel=make('label',{},'BPM ');tempoLabel.append(tempo);
 tempo.addEventListener('change',()=>{if(Number.isFinite(tempo.valueAsNumber))api.set(1,0,Math.max(40,Math.min(240,Math.round(tempo.valueAsNumber))));});
 toolbar.append(title,tempoLabel);
 const rows=make('div',{className:'fw-tracks'});
 const tracks=Array.from({length:4},(_,k)=>{
  const row=make('button',{type:'button',className:'fw-track'});row.style.setProperty('--track-color',['#287cff','#1ecc70','#ffc618','#ff621a'][k]);
  const num=make('strong',{},String(k+1)),name=make('span'),strip=make('span',{className:'fw-strip'});
  const steps=Array.from({length:16},()=>make('i'));strip.append(...steps);row.append(num,name,strip);
  row.addEventListener('click',()=>api.select(k));rows.append(row);return {row,name,steps};
 });
 const browser=make('div',{className:'fw-sound'}),engine=make('select'),preset=make('select');
 const engineLabel=make('label'),presetLabel=make('label');engineLabel.append(engine);presetLabel.append(preset);browser.append(engineLabel,presetLabel);
 engine.addEventListener('change',()=>api.preset(+engine.value,0));
 preset.addEventListener('change',()=>{const s=api.state();if(s) s.sel===3?api.set(0,50,+preset.value):api.preset(s.dump.engine,+preset.value);});
 const nav=make('nav',{className:'fw-pages'}),knobs=make('div',{className:'fw-controls'}),help=make('p',{className:'fw-help'});
 for(const name of Object.keys(pages)){
  const button=make('button',{type:'button'},name);button.addEventListener('click',()=>{page=name;signature='';render();});nav.append(button);
 }
 screen.append(toolbar,rows,knobs);host.append(layouts,screen,browser,nav,help);
 function render(){
  const s=api.state();if(!s){host.hidden=true;return;}host.hidden=!visible;if(!visible)return;
  compact.textContent=text('device');expanded.textContent=text('expanded');layouts.setAttribute('aria-label',text('layout'));
  title.textContent=page;help.textContent=text('help');tempo.setAttribute('aria-label',text('tempo'));
  engine.setAttribute('aria-label',text('engine'));preset.setAttribute('aria-label',text('preset'));nav.setAttribute('aria-label',text('pages'));
  if(document.activeElement!==tempo)tempo.value=s.dump.g[0];
  for(const [k,t] of s.tracks.entries()){
   const row=tracks[k];row.row.setAttribute('aria-pressed',String(k===s.sel));
   row.row.disabled=s.busy;row.name.textContent=k===3?text('drums'):(s.names[t.engine]?.[t.preset]||s.engines[t.engine]);
   const base=Math.floor((s.positions[k]||0)/16)*16;
   row.steps.forEach((e,i)=>{const step=t.step[base+i];e.classList.toggle('on',k===3?!!t.dstep[base+i]?.on:!!step?.n);e.classList.toggle('playing',s.playing&&s.positions[k]===base+i);});
  }
  const sig=JSON.stringify([page,s.sel,s.dump.engine,s.pdesc,s.names,s.kitNames,document.documentElement.lang]);
  if(signature!==sig){
   signature=sig;
   engine.replaceChildren(...s.engines.map((n,i)=>make('option',{value:String(i)},n)));engine.disabled=s.sel===3;
   preset.replaceChildren(...(s.sel===3?s.kitNames:s.names[s.dump.engine]||[]).map((n,i)=>make('option',{value:String(i)},n)));
   knobs.replaceChildren();controls=[];
   const bindings=pages[page].map(pair=>page==='TRACKS'&&s.sel===3&&pair[0]===0&&pair[1]===0?[1,25]:pair);
   for(const [scope,id] of bindings){
    // The drum engine only exposes KIT, not the synth's eight edit controls.
    if(s.sel===3&&id>50&&!scope)continue;
    const d=(scope?s.gdesc:s.pdesc)[id];if(!d||d.max===d.min)continue;
    const label=make('label',{className:'fw-control'}),name=make('span',{},d.label),out=make('output');
    const input=make('input',{type:'range',min:String(d.min),max:String(d.max),step:'1'});input.setAttribute('aria-label',d.label);
    input.addEventListener('input',()=>{api.set(scope,id,+input.value);update({scope,id,d,input,out},+input.value);});
    const dial=make('span',{className:'fw-dial'});dial.setAttribute('aria-hidden','true');
    label.append(name,out,dial,input);knobs.append(label);controls.push({scope,id,d,input,out});
   }
  }
  if(document.activeElement!==engine)engine.value=s.dump.engine;
  if(document.activeElement!==preset)preset.value=s.sel===3?s.dump.p[50]:s.dump.preset;
  engine.disabled=s.busy||s.sel===3;preset.disabled=s.busy;tempo.disabled=s.busy;
  for(const c of controls){c.input.disabled=s.busy;update(c,(c.scope?s.dump.g:s.dump.p)[c.id]);}
  for(const b of nav.children)b.setAttribute('aria-pressed',String(b.textContent===page));
 }
 function update(c,value){if(document.activeElement!==c.input)c.input.value=value;c.out.textContent=api.format(c.d,value).filter(Boolean).join(' ');c.input.parentElement.style.setProperty('--turn',`${-135+270*(value-c.d.min)/(c.d.max-c.d.min)}deg`);}
 function tick(){render();frame=setTimeout(tick,100);}
 return {show(on){visible=on;host.hidden=!on;clearTimeout(frame);if(on)tick();},refresh:render};
}
