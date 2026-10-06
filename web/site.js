// SPDX-License-Identifier: GPL-3.0-only
document.addEventListener('DOMContentLoaded',()=>{
 const button=document.getElementById('back-to-top');
 if(!button)return;
 const sync=()=>{button.hidden=scrollY<300;};
 window.addEventListener('scroll',sync,{passive:true});sync();
 button.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
});
