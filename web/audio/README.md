# Sloop browser synth

Choose **Play in browser** in Studio, or open `?browser=1` and press **Start audio**.
No FM-1 or MIDI permission is needed. QWERTY, pointer and touch playing use the
same keyboard as device mode. **Use FM-1** stops browser playback and returns to
the device connection screen.

The browser engine compiles this repository's SLOOP 2.3 DSP: nine synth engines,
68 factory sounds, 37 drum kits, three synth parts and one drum part, insert/send
effects, mixer, arpeggiator, scale/chord controls and 64-step patterns. Browser
volume is independent of track levels. The waveform displays the actual browser
output. **Play sequence** starts from the beginning; **Stop** ends playback and
releases notes. Effect tails may decay after Stop. Hiding the page stops the
browser transport and notes. Collapsing the keyboard releases held keys without
stopping the sequence.

The Samples tab uses the existing WAV/CHOP conversion and the real SLOOP ADPCM
decoder. USR1–USR3 are browser RAM slots in this mode. The same supported file
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

Requires Python and Zig 0.13.0. Build without a firmware toolchain:

```sh
python tools/build_browser_audio.py --zig /path/to/zig
python web/build_locales.py
python web/make_site.py docs/firmware/sloop-2.3.fwsc 2.3 build/site
```

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
implementation (`558f2b8`), with a fresh SLOOP build. Felucca's WASM, FM6 engine,
song-chain model and unfinished sample/session implementation are not included.
Code is GPL-3.0-only; firmware credits and the CC0 sample attributions in
`assets/samples-cc0/CREDITS.txt` remain applicable. See the repository LICENSE
and LICENSING.md. Keep the corresponding source and build scripts with releases.

## Verification and limits

```sh
node web/test_audio_engine.mjs
node web/test_browser_session.mjs
node web/test_browser_synth.mjs
```

The browser test uses the existing preview at `http://127.0.0.1:8769/webapp/editor/`
and Playwright/Edge; configure `PLAYWRIGHT_MODULE` and `BROWSER_CHANNEL` if needed.
DSP tests render every factory preset and drum kit, note releases, sequence
playback, user samples, and worklet output at 44.1/48 kHz. Session tests validate
native preset parity, malformed import rejection and sample byte preservation.

The tested browser is desktop Edge; mobile layouts are simulated. Real-device
mobile performance, listening comparisons against an FM-1, and other browsers
still need testing. Browser live-recording/arranger controls, external MIDI
input, USB audio and hardware settings are not added by this port. Editing
patterns and playing the four-track sequence are supported. No FM6 engine is
present because it is not a SLOOP engine. AudioWorklet needs HTTPS or localhost;
opening the HTML directly as a local file is insufficient.
