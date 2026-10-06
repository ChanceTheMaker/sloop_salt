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
browser DSP is included. Website preferences use the `sloop` namespace.

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
The mock is silent; browser-only synthesis requires a separate SLOOP DSP port.
