# Sloop browser synth

Choose **Browser Studio** or **FM-1 Simulator**, or open `?browser=1` and press **Start audio**.
No FM-1 or MIDI permission is needed. Both browser views support QWERTY,
pointer and touch. **FM-1** stops browser playback and returns to
the device connection screen.

The browser engine compiles this repository's SLOOP 2.4.1 DSP: ten synth engines,
76 factory sounds, 37 drum kits, three synth parts and one drum part, insert/send
effects, mixer, arpeggiator, scale/chord controls and 64-step patterns. Browser
volume is independent of track levels. The waveform displays the actual browser
output. **Play sequence** starts from the beginning; **Stop** ends playback and
releases notes. Effect tails may decay after Stop. Hiding the page stops the
browser transport and notes. Collapsing the keyboard releases held keys without
stopping the sequence.

The Samples tab uses the existing WAV/CHOP conversion and the real SLOOP ADPCM
decoder. USR1-USR4 are browser RAM slots in this mode. The same supported file
types, mono 22050 Hz conversion and per-slot limits apply. Select a USR set in
SAMPLE or GRAIN to play it. A new browser workspace starts with empty patterns,
project slots and user preset slots.

Tracks, patterns, four project slots, 32 user preset slots and sample data save
in IndexedDB `sloop-browser-workspace`. **Export session** produces a versioned
`sloop-browser-session` JSON file. **Import session** validates it before replacing
the workspace. This is separate from FM-1 device backups. Studio's patch library
continues to use `sloop-editor`; use its own **Export library** command to back up
that library. Private browsing or storage limits can prevent autosave; the UI
reports that and session export remains available.

## Build and architecture

Requires Python with Pillow and Zig 0.13.0. Build without a firmware toolchain:

```sh
python tools/build_browser_audio.py --zig /path/to/zig
python web/build_locales.py
python web/make_site.py docs/firmware/sloop-2.4.1.fwsc 2.4.1 build/site
python web/make_site.py docs/firmware/sloop-2.4.1.fwsc 2.4.1 build/studio --studio
```

The first site build is the compact standalone simulator; `--studio` builds the
full themed Studio and installer site. Both use the same engine.

Session format 2 keeps FM6 track patches and the 27-slot bank, per-step nudges,
parameter locks, fill conditions, and four sample slots. Format 1 exports and
existing browser storage migrate automatically: the three new common
parameters are inserted before the eight engine parameters. The original
format-1 IndexedDB record is retained under `before-2.4.1` on the first save.

The build writes generated tables under `build/browser-audio/gen` and the runtime
asset `web/audio/engine.wasm`. `engine.c` includes Sloop's existing DSP sources
without modifying them. Browser RAM replaces sample flash access; USB, display,
updater, radio and other hardware drivers are not linked. No imported functions
are required by the WASM module. Its fixed 8 MiB memory includes audio state.

`worklet.js` renders the firmware's 32-frame, 44100 Hz blocks on the audio thread
and resamples to the AudioContext rate. `browser.js` reads the actual compiled
descriptors and preset values and supplies them to a local protocol adapter in
the editor. Existing editor commands update that adapter's state, which is sent
to the worklet. The silent `?mock=1` fixtures retain their prior behavior. Browser
state and MIDI never use the connected hardware's output port.

This port reuses the architecture of Chance Roth's committed Felucca browser
implementation (`558f2b8`), with a fresh SLOOP build. The DSP and FM6 hotfix come from Sloop 2.4.1; the browser adapters are maintained in this fork.
Code is GPL-3.0-only; firmware credits and the CC0 sample attributions in
`assets/samples-cc0/CREDITS.txt` remain applicable. See the repository LICENSE
and LICENSING.md. Keep the corresponding source and build scripts with releases.

## Verification and limits

```sh
node web/test_audio_engine.mjs
node web/test_browser_session.mjs
node web/test_upgrade_241.mjs
node web/test_native_firmware.mjs
node web/test_browser_synth.mjs
node web/test_firmware_view.mjs
node web/test_play_modes.mjs
```

The browser test uses the existing preview at `http://127.0.0.1:8769/webapp/editor/`
and Playwright/Edge; configure `PLAYWRIGHT_MODULE` and `BROWSER_CHANNEL` if needed.
After building `build/site`, start that dedicated preview with
`python tools/preview_site.py`. Its connection queue accommodates simultaneous
browser asset requests on Windows. Port 8768 belongs to the Felucca preview.
If the environment still resets localhost connections, set `STUDIO_STATIC_DIR`
to the absolute `build/site` path for `test_browser_synth.mjs`. Playwright then
serves those exact built files to Edge while the real WASM/audio worklet runs;
this isolates functional checks from preview networking.
DSP tests render every factory preset and drum kit, note releases, sequence
playback, user samples, and worklet output at 44.1/48 kHz. Session tests validate
native preset parity, malformed import rejection and sample byte preservation.

The tested browser is desktop Edge; mobile layouts are simulated. Real-device
mobile performance, listening comparisons against an FM-1, and other browsers
still need testing. External MIDI input, USB audio and physical panel calibration
require separate hardware integration. Browser Firmware mode includes the
native musical controls, recording, arranger and FM6/DX7 patches. AudioWorklet needs HTTPS or localhost;
opening the HTML directly as a local file is insufficient.

## Browser views

The three-state play-mode switch offers FM-1 (hardware), FM-1 Simulator (browser
audio with the native firmware interface), and Browser Studio (the full
Skeuomorph editor). An anchored introduction explains these options once;
dismissal is stored under `sloop.web.soundSourceTipDismissed`.

Firmware has Device and Expanded layouts of the same native panel: a live
240×240 screen, seven encoders, fourteen function buttons and all 27 keys.
`firmware-ui.c` provides browser display/input peripherals and compiles the
original UI, layer, preset, project and arranger modules without changing them.
The framebuffer, scope and key/button lights come from that native code.

Drag knobs vertically; hold Shift for fine tuning. Focus a knob for arrow keys
or the wheel; Shift bypasses native encoder acceleration. Expanded enlarges
the display column on desktop and gives the screen a full row on mobile.
Tap functions for pages; hold FX, EDIT, ARP, SEQ, SCL, GLO or SAVE while playing
keys or adjusting knobs. Hold a layer and tap HOME to lock it. EDIT + OCT−/OCT+
undoes/redoes. Firmware and Studio use the same themed bottom keyboard, note
labels, QWERTY shortcuts, sliding, sustain and toolbar. Its central 27-key bank
operates the native panel; extra keys on wider screens play ordinary notes.
The keyboard octave selector and native OCT buttons stay synchronized.
Focus loss releases all held controls.

REC opens the free/tempo, length and note/count-in controls. In a free take,
REC closes the loop and PLAY cancels it. Hold REC to clear a track. Hold SAVE
and use white keys 1–4 to recall sections, 5–8 to store them (repeat to overwrite),
13 for song playback, 14 for song recording, and 16 for the arranger. The song
page knobs edit entry, section, bars and length. Hold HOME for settings.

Native RAM project slots, user presets, song order and settings are autosaved
with the browser session; “SAVED (RAM)” on the native screen still reaches
browser storage. During song playback, saved sessions retain the original
working loop. Export waits for queued panel edits. Switching to Browser Studio
stops playback and refreshes all shared controls, presets and project slots.
Use Browser Studio for sample upload. Firmware menus retain their native
English labels; surrounding help is available in English and Japanese.

Native tests cover layers, step ratchets, undo/redo, free/tempo recording,
count-in, presets, sections, arranger playback and settings. Edge tests cover
the live canvas, audible QWERTY input, recording, shared edits, focus release,
mobile layout, session export/import/reload and the three-way mode switch.
