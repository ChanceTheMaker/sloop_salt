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
The suffix uses rounded vector lettering matched to the original logo's 12-unit
monoline strokes; it is no longer typeset in the theme's display font.
