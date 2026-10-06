# Website development

Baseline: isod89/sloop-fm1 `d691ba7b2d922f1a1f41a3622cffe29ce41c5506` (SLOOP 2.3).
Work is prepared in focused branches on ChanceTheMaker/sloop-fm1 for review and
possible upstream contribution. Firmware, SysEx command definitions, storage
formats and update transports are outside the website changes.

## Sources and licenses

The theme chassis, dial presentation and appearance preferences are adapted from
[Felucca Salt](https://github.com/ChanceTheMaker/Felucca), reference revision
`558f2b864d7ee6492947473a1702aa721665e21d`, by Chance Roth, based on Felucca by
Leo Kuroshita / Hügelton Instruments. Code is GPL-3.0-only. Locally hosted fonts
retain the license notices in `web/fonts/`. The original SLOOP controls and
descriptor-driven editor remain the source of truth. No Salt analytics or
Felucca DSP binary is included. Website preferences use the `sloop` namespace.

## Preview and checks

Generate a preview using the unchanged tracked SLOOP firmware package:

```sh
python web/build_locales.py
python web/make_site.py docs/firmware/sloop-2.3.fwsc 2.3 build/site
python -m http.server 8769 --bind 127.0.0.1 --directory build/site
node web/test_web.mjs
```

Canonical preview: http://127.0.0.1:8769/webapp/editor/
Use `?mock=1` and Connect for silent UI testing without hardware. Port 8768 is
reserved for Felucca. Inspect occupied ports before starting another server.
Mock tests do not establish hardware MIDI or installation success.

The original test suite had a Windows-only ESM import error. Use a file URL
relative to the test module so its final package-validation check runs on Windows.
Build-dependent package tests still require a firmware build; the website work
does not rebuild firmware. Preview generation must preserve package bytes.

The existing English/Japanese support is retained, with source catalogs for new
appearance controls in `web/locales/`; regenerate `web/locales.js` after edits.

## Playable keyboard

`node web/test_keyboard.mjs` checks shared note ownership, software sustain,
retriggering and cleanup. Browser checks use `node web/test_studio.mjs` with
`PLAYWRIGHT_MODULE` pointing to an installed Playwright module if it is not a
local dependency. `BROWSER_CHANNEL` defaults to installed Edge.

SLOOP's `seq.c` accepts note-on/off but ignores controller messages, so the web
keyboard defers note-offs for sustain and explicitly releases its pitches for
panic. No CC64/120/123 dependency is introduced. Follow-track routing uses a
selected-track channel that differs from the configurable drum channel. On the
drum track, white keys map to the editor's authoritative `DRUM_LANES` pitches and
black keys repeat the lane on their left. Explicit MIDI channels remain available.
The mock remains silent. The separately selected browser synth compiles SLOOP's
DSP; see [browser audio documentation](../web/audio/README.md).

## Native aesthetic and widgets

SLOOP Original is the shared first-visit default: black surfaces and the
firmware's blue/green/yellow/orange track colors. The twelve Salt themes remain
available. The owner requested the Sloop [Salt] name and shaker after the title.

Parameter cards retain all existing controls and split long groups into their
existing pages. Diagram helpers are selectively reused: bindings check SLOOP
descriptors, scale masks and slicer patterns match the target source, and graph
edits use the same `userSet` path as native controls. SLOOP has no ARP REPEAT
mode, so that Salt-only example was removed. Curves are illustrative, not audio
measurements. `node web/test_widgets.mjs` checks target scale/pattern tables.

## Original homepage and unlinked backup

The owner chose to retain the upstream homepage. `web/index_pkg.html` and the
public installer remain unchanged. The redesigned source is preserved separately
as `web/salt_home_pkg.html`, generated at `/webapp/salt/`, with no public navigation
link and a noindex directive. Local backup URL:
http://127.0.0.1:8769/webapp/salt/

The backup has the theme gallery, real SLOOP screen image, progress/retry UI and
shared appearance settings. `node web/capture_themes.mjs` regenerates its thirteen
screenshots from the actual mock editor; `node web/test_landing.mjs` checks it.
The original SLOOP logo is reused in Studio with its background rectangle removed
in the website copy only. `[Salt]` and the shaker follow it. Original logo assets
and firmware remain untouched.
The lowercase `[salt]` suffix uses rounded vector lettering matched to the
original logo's 12-unit monoline strokes. The website SVG trims the empty space
after the logo while preserving the visible artwork's size.

## Keyboard access and localization

The piano has one Tab stop. Left/Right moves between notes, Home/End selects the
first/last visible note, and Space/Enter plays the focused note even when QWERTY
is disabled. Moving focus releases notes owned by Space/Enter while preserving
independent pointer/QWERTY ownership and the sustain setting. Resizing preserves
piano focus when keys are rebuilt. Screen-reader instructions explain navigation.

The Studio and unlinked backup headers, navigation, page titles and piano help
follow the existing English/Japanese picker. Native musical names and firmware
values remain unchanged. The original public homepage retains its own language
handling. Additional languages from the Felucca reference are not yet ported.

`node web/test_accessibility.mjs` covers Tab/arrow navigation, focus cleanup,
mixed pointer/QWERTY ownership, language selection/persistence and Japanese labels
at 1440/390/320 pixels in standard and full-width layouts. Narrow tabs size to
their labels so translated text cannot overlap adjacent buttons.

## Browser synth

`feat/browser-synth` adds an optional local audio mode on top of the website PR
stack. Its canonical preview is http://127.0.0.1:8769/webapp/editor/?browser=1.
Audio starts only after a user gesture. The browser adapter extends the local
mock with optional compiled metadata and state/MIDI callbacks; the hardware
protocol codec, command IDs, updater, original homepage and firmware sources
are unchanged. Full hardware backups are hidden in browser mode; its sessions
use a separate validated format and IndexedDB namespace.

Build and validation commands, source attribution, supported browser features
and remaining hardware/mobile checks are recorded in `web/audio/README.md`.

## Native Firmware mode

`feat/native-firmware-mode` follows `feat/firmware-view` in the draft PR stack.
It replaces the first parameter-page approximation with the repository's native
framebuffer renderer, panel/layer input, recording, preset/project and arranger
modules compiled into the browser WASM. Only browser adapters and website files
change; `firmware/`, the public homepage, hardware protocol and packaged firmware
remain unchanged.

Native input runs on the audio thread with ordered events. Snapshot/mode barriers
wait behind pending edits; native state bridges to the existing browser session.
Song playback exports/autosaves the original working loop rather than replacing
it with the currently playing section. Browser Studio refreshes its descriptors,
bank and project slots after leaving Firmware mode. Hardware calibration is
handled explicitly by the adapter because the physical routine waits on GPIO.

Validation: native tests cover layers/lock release, drum step velocity and
ratchets, undo/redo, free and tempo recording, count-in, section/song playback,
SONG REC, user presets, settings and session restoration. Edge tests verify the
real WASM/worklet, framebuffer, QWERTY audio, recording, bank persistence, shared
edits, import/export/reload, mobile layout and mode switching. Static request
routing in tests avoids intermittent localhost resets while executing the exact
built assets. Real mobile audio and hardware listening parity remain unverified.
