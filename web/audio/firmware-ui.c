/* SPDX-License-Identifier: GPL-3.0-only
 * Browser peripherals for SLOOP's unmodified native UI, project and preset code.
 * Flash persistence is supplied by the browser session, not a hardware driver. */
static uint16_t screen[240*240];
static void lcd_sync(void) {}
static void lcd_blit(uint32_t x,uint32_t y,uint32_t w,uint32_t h,const uint16_t *p) {
    if(x+w>240||y+h>240)return;
    for(uint32_t j=0;j<h;j++)memcpy(screen+(y+j)*240+x,p+j*w,w*2);
}
#include "../../firmware/src/gfx.c"
static void lcd_fill(uint32_t x,uint32_t y,uint32_t w,uint32_t h,uint16_t c) {
    if(x+w>240||y+h>240)return;
    for(uint32_t j=0;j<h;j++)for(uint32_t i=0;i<w;i++)screen[(y+j)*240+x+i]=swap16(c);
}
static int32_t encs[7];
static uint32_t fm1_ticks(void) {return fm1_ms*24000u;}
#define FM1_TICKS_PER_US 24u
static int32_t fm1_enc_take(uint32_t e) {int32_t s=encs[e];encs[e]=0;return s;}
static uint8_t fm1_led[16],fm1_led_dim[16],fm1_led_bg[16];
static volatile uint16_t fm1_led_bg_ns;
#define FM1_NCOL 16u
/* A virtual LED matrix with the firmware's logical IDs (buttons 0..13,
   notes 14..40). No GPIO matrix or hardware calibration is needed. */
static const int8_t FM1_KEYMAP[5][16]={
    {-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1},
    {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15},
    {16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31},
    {32,33,34,35,36,37,38,39,40,-1,-1,-1,-1,-1,-1,-1},
    {-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1}};
static void fm1_led_key(uint32_t id,int on) {(void)id;(void)on;}
static uint32_t edges_btn,notes_seen;
static uint32_t fm1_input_edges(int x) {uint32_t e=edges_btn;(void)x;edges_btn=0;return e;}
static uint32_t fm1_input_note_edges(void) {uint32_t e=fm1_in.notes&~notes_seen;notes_seen=fm1_in.notes;return e;}
static void fm1_wdt_feed(void) {}
static int32_t fm1_adc_read(int c) {(void)c;return -1;}
static void fm1_delay_ms(uint32_t ms) {fm1_ms+=ms;}
static struct {uint32_t magic,stage,page,home,ui_frames;} felucca_dbg;
#define FELUCCA_ICONS 1
#define SCOPE_N 512u
static int16_t scope_buf[SCOPE_N];
static uint32_t scope_w;
static struct {uint32_t up,config,suspended,setups,sof_seen;} usb;
#include "../../firmware/src/panel.c"
#include "../../firmware/src/ui.c"
#include "../../firmware/src/upreset.c"
#include "../../firmware/src/project.c"
#include "../../firmware/src/ui_song.c"
#include "../../firmware/src/ui_studio.c"
#include "../../firmware/src/icons.c"
#include "../../firmware/src/ui_draw.c"
#include "../../firmware/src/ui_layers.c"
#include "../../firmware/src/ui_menu.c"
#include "../../firmware/src/ui_input.c"
static void browser_ui_init(void) {
    persist_boot();panel_init();settings_init();layers_init();bank_resolve();
    settings.palette=4;palette_set(4);go_home();ui.force=1;
}
API void fw_tick(void) {ui_input();ui_leds();ui_draw();sections_flush();}
API uint16_t *fw_screen(void) {return screen;}
API void fw_event(unsigned kind,unsigned id,int value) {
    /* Calibration waits for GPIO edges in a blocking loop. Browser peripherals
       have fixed labels, so acknowledge this hardware-only action explicitly. */
    if(kind==0&&id==B_OCTUP&&value&&ui.menu==1&&ui.menu_sel==MI_PANEL){
        ui.menu=0;go_home();ui_message("BROWSER PANEL FIXED");return;
    }
    if(kind==0&&id<NB){uint32_t bit=1u<<panel.btn[id];if(value){if(!(fm1_in.buttons&bit))edges_btn|=bit;fm1_in.buttons|=bit;}else fm1_in.buttons&=~bit;}
    if(kind==1&&id<NE)encs[panel.enc[id]]+=clamp(value,-127,127);
    if(kind==2&&id<27){if(value)fm1_in.notes|=1u<<id;else fm1_in.notes&=~(1u<<id);}
}
API void fw_release(void) {
    fm1_in.notes=fm1_in.buttons=0;edges_btn=notes_seen=0;memset(encs,0,sizeof encs);
    layer_unlock();ui.home_t0=0;ui.hold_kind=0;ui.step_held=0;lk_r=lk_w;
}
static project_t browser_project;
static uint32_t browser_prefs[5],browser_status[21];
static int browser_led(const uint8_t *matrix,unsigned id){unsigned q=led_pos[id];return q!=255&&((matrix[q>>3]>>(q&7))&1u);}
API unsigned fw_layout(unsigned n) {
    const unsigned layout[]={sizeof(project_t),__builtin_offsetof(project_t,t),sizeof(proj_trk_t),
        __builtin_offsetof(proj_trk_t,step),sizeof(up_rec_t),__builtin_offsetof(up_rec_t,p),
        __builtin_offsetof(up_rec_t,note),__builtin_offsetof(up_rec_t,flags),sizeof(arr_config_t)};
    return n<sizeof(layout)/sizeof(*layout)?layout[n]:0;
}
API void *fw_buffer(unsigned kind,unsigned k) {
    if(kind==0){proj_capture(&browser_project);return &browser_project;}
    if(kind==1&&k<4)return &proj_slot[k];
    if(kind==2&&k<UP_SLOTS)return up_rec(k);
    if(kind==3)return &arrangement;
    if(kind==6)return &song_keep;
    if(kind==4){browser_prefs[0]=settings.palette;browser_prefs[1]=settings.lowcut;browser_prefs[2]=settings.zoom;
        browser_prefs[3]=lights_word();browser_prefs[4]=arrangement_enabled;return browser_prefs;}
    if(kind==5){
        browser_status[0]=song.sel;browser_status[1]=song.playing;browser_status[2]=song.rec;
        browser_status[3]=rec_wait;browser_status[4]=ft_on;browser_status[5]=ui.layer;
        browser_status[6]=ly_lock;browser_status[7]=ui.page;browser_status[8]=ui.menu;
        browser_status[9]=fm1_in.notes;browser_status[10]=keys_guide();browser_status[11]=song.solo;
        browser_status[12]=arrangement_clock.index;browser_status[13]=live_sec+1;browser_status[14]=srec;
        browser_status[15]=arrangement_clock.running;
        for(unsigned i=16;i<21;i++)browser_status[i]=0;
        for(unsigned k=0;k<27;k++){
            browser_status[16]|=(unsigned)browser_led(fm1_led,14+k)<<k;
            browser_status[17]|=(unsigned)browser_led(fm1_led_dim,14+k)<<k;
            browser_status[20]|=(unsigned)browser_led(fm1_led_bg,14+k)<<k;
        }
        for(unsigned k=0;k<NB;k++){
            browser_status[18]|=(unsigned)browser_led(fm1_led,panel.btn[k])<<k;
            browser_status[19]|=(unsigned)browser_led(fm1_led_bg,panel.btn[k])<<k;
        }
        return browser_status;
    }
    return 0;
}
API void fw_commit(unsigned kind,unsigned k,int used) {
    if(kind==0||kind==1){
        project_t *p=kind==0?&browser_project:(k<4?&proj_slot[k]:0);if(!p)return;
        p->magic=used?PROJ_MAGIC:0;p->size=sizeof *p;p->sum=proj_sum(p);
        if(kind==0&&used){proj_apply(p,1);song.sel=p->sel<4?p->sel:0;}
    }else if(kind==2&&k<UP_SLOTS){if(!used)memset(up_rec(k),0,sizeof(up_rec_t));up_gen++;}
    else if(kind==3){if(!arr_valid(&arrangement,15))arr_defaults(&arrangement);}
    else if(kind==4){
        settings.palette=browser_prefs[0]%NPALETTES;settings.lowcut=!!browser_prefs[1];settings.zoom=!!browser_prefs[2];
        lights_from_word(browser_prefs[3]);arrangement_enabled=!!browser_prefs[4];settings_init();
    }
    ui.force=1;
}
