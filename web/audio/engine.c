/* SPDX-License-Identifier: GPL-3.0-only
 * SLOOP browser adapter. Worklet architecture adapted from Chance Roth's
 * Felucca browser port. DSP is compiled directly from this repository.
 * No USB, flash, display, updater or other hardware driver is linked. */
#include <stdint.h>
#include "felucca_tables.h"
#include "../../firmware/src/libc.c"
static struct { volatile uint32_t notes, buttons; } fm1_in;
static void fm1_irq_off(void) {}
static void fm1_irq_on(void) {}
static uint8_t browser_samples[3][0x14000];
#define SMP_USER_XIP(k) (browser_samples[k])
#include "../../firmware/src/core.h"
#include "../../firmware/src/engines.c"
#include "../../firmware/src/drums.c"
#include "../../firmware/src/params.c"
#include "../../firmware/src/voice.c"
#include "../../firmware/src/slicer.c"
#include "../../firmware/src/fx.c"
#define MQ 256u
static uint32_t midi_in_q[MQ], mi_r, mi_w;
static void midi_out_event(uint32_t p) { (void)p; }
#include "../../firmware/src/seq.c"
#define API __attribute__((visibility("default")))
static int32_t output[CTL * 2];
static uint64_t frames;
static unsigned target;
API void synth_init(void) {
    for(unsigned i=0;i<G_COUNT;i++) song.g[i]=GP[i].def;
    for(unsigned k=0;k<NTRK;k++) {
        for(unsigned i=0;i<P_E0;i++) trk[k].p[i]=TP[i].def;
        steps_clear(&trk[k]);
    }
    song.master_q12=4096;
    memset(browser_samples,255,sizeof browser_samples);
    for(unsigned k=0;k<3;k++) smp_user_scan(k);
}
API void synth_target(unsigned k) { if(k<NTRK) target=k; }
API void synth_select(unsigned k) { if(k<NTRK) song.sel=k; }
API void synth_solo(unsigned mask) { song.solo=mask&15; }
API void synth_engine(unsigned e) { if(target<NPART && e<NENGINES) trk[target].eng_req=e; }
API void synth_param(unsigned i,int v) {
    if(i>=P_COUNT) return;
    if(target==TRK_DRUM && i==P_E0) {trk[target].p[i]=clamp(v,0,DRUM_KITS-1);return;}
    const param_desc_t *d=i<P_E0?&TP[i]:&ENGINES[trk[target].eng_req]->edit[i-P_E0];
    trk[target].p[i]=clamp(v,d->min,d->max);
}
API void synth_global(unsigned i,int v) {
    if(i<G_COUNT) song.g[i]=clamp(v,GP[i].min,GP[i].max);
}
API void synth_midi(unsigned status,unsigned d1,unsigned d2) {
    if((status&0xf0)!=0x90 && (status&0xf0)!=0x80)return;
    if(mi_w-mi_r>=MQ) {panic_req=15;mi_r=mi_w;return;}
    midi_in_q[mi_w++%MQ]=(status>>4)|((status&255)<<8)|((d1&127)<<16)|((d2&127)<<24);
}
API void synth_step(unsigned k,unsigned i,unsigned n,unsigned time,unsigned flags,unsigned vel,unsigned lvl,unsigned rat,unsigned n0,unsigned n1,unsigned n2,unsigned n3) {
    if(k>=NPART||i>=NSTEP)return;
    step_t *s=&trk[k].step[i];s->n=n>4?4:n;s->time=time>2?2:time;
    s->flags=flags&3;s->vel=vel&127;s->lvl=lvl&255;s->rat=rat&255;
    s->note[0]=n0&127;s->note[1]=n1&127;s->note[2]=n2&127;s->note[3]=n3&127;
}
API void synth_drum_step(unsigned i,unsigned on,unsigned lvl,unsigned rat) {
    if(i>=NSTEP)return;
    dstep_t *s=&TDRUM->dstep[i];s->on[0]=on&255;s->on[1]=(on>>8)&255;
    for(unsigned k=0;k<4;k++){s->lvl[k]=lvl>>(8*k);s->rat[k]=rat>>(8*k);}
}
API void synth_transport(unsigned op) { if(op==2){transport_req=0;seq_stop();}else if(op==1)transport_req=1; }
API void synth_panic(void) {
    transport_req=0;seq_stop();panic_req=0;mi_r=mi_w;
    memset(midi_sel_on,0,sizeof midi_sel_on);
    for(unsigned k=0;k<NTRK;k++) {
        track_t *t=&trk[k];trk_all_off(t);t->nheld=0;t->arp_phys=0;t->arp_note=0;
        for(unsigned v=0;v<NVOICE;v++)voice_kill(&t->v[v]);
    }
    for(unsigned v=0;v<NDRUM;v++)drums.v[v].active=0;
}
API unsigned synth_playing(void) {return song.playing;}
API unsigned synth_position(unsigned k) {return k<NTRK?trk[k].seq_idx:0;}
API uint8_t *synth_sample_buffer(unsigned k) {return k<3?browser_samples[k]:0;}
API void synth_sample_apply(unsigned k) {if(k<3){panic_req=15;smp_user_scan(k);}}
API int32_t *synth_render(void) {fm1_ms=(uint32_t)(frames*1000/FS);mix_block(output,CTL);frames+=CTL;return output;}
API unsigned engine_count(void) {return NENGINES;}
API unsigned param_count(void) {return P_COUNT;}
API unsigned global_count(void) {return G_COUNT;}
API const char *engine_name(unsigned e) {return e<NENGINES?N_ENGNAME[e]:"";}
API unsigned preset_count(unsigned e) {return e<NENGINES?ENGINES[e]->npresets:0;}
API const char *preset_name(unsigned e,unsigned p) {return e<NENGINES&&p<ENGINES[e]->npresets?ENGINES[e]->presets[p].name:"";}
API int preset_value(unsigned e,unsigned p,unsigned i) {
    if(e>=NENGINES||p>=ENGINES[e]->npresets||i>=P_COUNT)return 0;
    const preset_t *pr=&ENGINES[e]->presets[p];
    int16_t v[P_COUNT];
    for(unsigned j=0;j<P_E0;j++)v[j]=TP[j].def;
    for(unsigned j=0;j<8;j++)v[P_E0+j]=pr->e[j];
    for(unsigned j=0;j<4;j++)v[P_ATK+j]=pr->env[j];
    v[P_ED_FLT]=pr->fenv;v[P_ED_FX]=preset_trim(e,p);v[P_VOICE]=pr->mono?V_LEGATO:V_POLY;
    const uint8_t fx[]={0,24,28,36};
    for(unsigned j=0;j<4;j++){v[P_DIST+j]=pr->fx[j]?pr->fx[j]-1:fx[j];v[P_AMODE+j]=pr->arp[j]?pr->arp[j]-1:TP[P_AMODE+j].def;}
    preset_extras(v,pr);return v[i];
}
static const param_desc_t *descriptor(unsigned e,unsigned scope,unsigned i) {
    if(scope==1)return i<G_COUNT?&GP[i]:0;
    return i<P_E0?&TP[i]:i<P_COUNT&&e<NENGINES?&ENGINES[e]->edit[i-P_E0]:0;
}
API int descriptor_value(unsigned e,unsigned scope,unsigned i,unsigned field) {
    const param_desc_t *d=descriptor(e,scope,i);if(!d)return 0;
    return field==0?d->fmt:field==1?d->min:field==2?d->max:d->def;
}
API const char *descriptor_text(unsigned e,unsigned scope,unsigned i,int item) {
    const param_desc_t *d=descriptor(e,scope,i);if(!d)return "";
    return item==-2?(d->unit?d->unit:""):item==-1?d->label:d->names&&item>=d->min&&item<=d->max?d->names[item-d->min]:"";
}
