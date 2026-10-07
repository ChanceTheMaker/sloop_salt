#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Leo Kuroshita (@kurogedelic), Hügelton Instruments
"""Make the site (GitHub Pages):

  index.html                  redirect to the installer
  firmware/felucca-VER.fwsc   the package
  webapp/installer/index.html index_pkg.html with fm1pkg.js, fm1ota.js and the metadata inlined
  webapp/editor/index.html    editor.html (+ fukiai.ttf, FUKIAI-LICENSE.txt)
  src/                        not touched

  web/make_site.py build/felucca-X.Y.fwsc X.Y OUT_DIR [--beta]
  (--beta: web/beta_banner.html at the top of the installer: the beta channel, docs/beta)

The package identity (FM-1_9xx) is read from the package; the device reports it
after the install.
"""
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BLOCKS, BLK, KEEP = 20, 0x30, 0x2F


def strip_module(src):
    src = re.sub(r"^export\s+", "", src, flags=re.M)
    return re.sub(r"^import .*?;\n", "", src, flags=re.M)


def product_of(raw):
    """the package identity: one marker byte after each of the first 20 blocks (fm1pkg.js productOf)"""
    return "".join(chr((m - i - 1) & 0xFF) for i in range(BLOCKS) if (m := raw[i * BLK + KEEP]) != 0x7D)


def main(pkg, version, out):
    pkg, out = Path(pkg), Path(out)
    raw = pkg.read_bytes()
    product = product_of(raw)
    if not re.fullmatch(r"FM-1_9\d\d", product):
        raise SystemExit(f"{pkg}: identity {product!r} is not a Felucca package (FM-1_9xx)")
    if b"FELUCCA-LOADER-1" not in raw:              # marker of firmware/loader
        raise SystemExit(f"{pkg}: no Felucca update loader in it")
    html = (HERE / "index_pkg.html").read_text(encoding="utf-8")
    lib = strip_module((HERE / "fm1pkg.js").read_text(encoding="utf-8")) + "\n" + \
        strip_module((HERE / "fm1ota.js").read_text(encoding="utf-8"))
    name = f"sloop-{re.sub(r'[^A-Za-z0-9.-]', '-', version)}.fwsc"
    meta = json.dumps({"version": version, "product": product, "pkg": "../../firmware/" + name,
                       "sha256": hashlib.sha256(raw).hexdigest()})   # the page checks the download against it
    for mark in ("/*LIB*/", "/*META*/"):
        if html.count(mark) != 1:
            raise SystemExit(f"index_pkg.html must contain {mark} once; update make_site.py")
    html = html.replace("/*LIB*/", lib).replace("/*META*/", meta)
    logo = HERE.parent / "assets" / "logo" / "sloop-logo.svg"     # the SLOOP logo, inline
    html = html.replace("<!--LOGO-->", logo.read_text(encoding="utf-8") if logo.exists() else "<b>SLOOP</b>")
    inst, ed, fw = out / "webapp" / "installer", out / "webapp" / "editor", out / "firmware"
    for d in (inst, ed, fw):
        d.mkdir(parents=True, exist_ok=True)
    guide = HERE.parent / "output/pdf/Studio-0.3-guide-rapide-FR.pdf"
    guide_link = ""
    if guide.exists() and "--studio-guide" in sys.argv:   # LIVE: that guide describes the removed RYTHME tab
        shutil.copy(guide, out / guide.name)
        guide_link = '<p lang="fr"><a href="../../' + guide.name + '">Guide rapide illustré (PDF, 4 pages)</a></p>'
    html = html.replace("<!--STUDIO_GUIDE-->", guide_link)
    banner = ""
    if "--beta" in sys.argv:                       # the beta channel (docs/beta): what it is, what it implies
        notes = HERE / "beta_banner.html"
        banner = notes.read_text(encoding="utf-8") if notes.exists() else "<p><b>BETA</b></p>"
    html = html.replace("<!--BANNER-->", banner)
    # Preserve the redesign as an unlinked alternative. The original installer
    # remains the public entry point and continues using its original template.
    alternate = (HERE / "salt_home_pkg.html").read_text(encoding="utf-8")
    for mark in ("/*LIB*/", "/*META*/"):
        if alternate.count(mark) != 1:
            raise SystemExit(f"salt_home_pkg.html must contain {mark} once")
    alternate = alternate.replace("/*LIB*/", lib).replace("/*META*/", meta)
    alternate = alternate.replace("<!--STUDIO_GUIDE-->", guide_link).replace("<!--BANNER-->", banner)
    salt = out / "webapp" / "salt"
    salt.mkdir(parents=True, exist_ok=True)
    (salt / "index.html").write_text(alternate, encoding="utf-8")
    for old in list(fw.glob("felucca-*.fwsc")) + list(fw.glob("sloop-*.fwsc")):   # one package: the current one
        old.unlink()
    (inst / "index.html").write_text(html, encoding="utf-8")
    shutil.copy(pkg, fw / name)
    shutil.copy(HERE / "editor.html", ed / "index.html")
    # Stack the original vector icon and lettering; the firmware PNG clips p's descender.
    import xml.etree.ElementTree as ET
    from xml.sax.saxutils import escape
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    logo_root = ET.fromstring((HERE.parent / "assets/logo/sloop-logo.svg").read_text(encoding="utf-8"))
    icon_root = ET.fromstring((HERE.parent / "assets/logo/sloop-icon.svg").read_text(encoding="utf-8"))
    icon = "".join(ET.tostring(child, encoding="unicode") for child in icon_root)
    lettering = "".join(ET.tostring(child, encoding="unicode") for child in list(logo_root)[8:])
    (ed / "sloop-boot.svg").write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">'
        '<rect width="240" height="240" fill="black"/>'
        f'<svg x="65" y="8" width="110" height="110" viewBox="0 0 240 240">{icon}</svg>'
        f'<svg x="20" y="114" width="200" height="86" viewBox="260 55 365 157">{lettering}</svg>'
        f'<text x="120" y="213" text-anchor="middle" fill="#c4c4cc" font-family="monospace" font-size="12">{escape(version)}</text>'
        '<text x="120" y="231" text-anchor="middle" fill="#606068" font-family="monospace" font-size="12">based on felucca</text></svg>', encoding="utf-8")
    for asset in ("firmware-view.js", "firmware-view.css", "midi-input.js", "standalone.js", "standalone.css"):
        shutil.copy(HERE / asset, ed / asset)
    (ed / "audio").mkdir(exist_ok=True)
    for asset in ("browser.js", "worklet.js", "session.js", "native-state.js", "engine.wasm"):
        shutil.copy(HERE / "audio" / asset, ed / "audio" / asset)
    for f in ("fukiai.ttf", "FUKIAI-LICENSE.txt"):
        if (HERE / f).exists():
            shutil.copy(HERE / f, ed / f)
    for dest in (ed, salt):
        for asset in ("skin.css", "skin.js", "interface.css", "sloop.css", "fonts.css", "i18n.js", "locales.js", "salt-shaker.png", "keyboard.js", "studio-widgets.js", "select-wheel.js", "site.js", "landing.css", "sloop-logo.svg"):
            shutil.copy(HERE / asset, dest / asset)
        shutil.copytree(HERE / "fonts", dest / "fonts", dirs_exist_ok=True)
    shutil.copytree(HERE / "screenshots", salt / "screenshots", dirs_exist_ok=True)
    # Optional analytics share the owner's GA4 property, with Sloop-only settings.
    for dest in (inst, ed, salt):
        for asset in ("analytics.js", "analytics.css"):
            shutil.copy(HERE / asset, dest / asset)
        page = dest / "index.html"
        page.write_text(page.read_text(encoding="utf-8").replace("</head>", '<link rel="stylesheet" href="analytics.css"><script defer src="analytics.js"></script></head>'), encoding="utf-8")

    (out / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>SLOOP</title>'
        '<meta http-equiv="refresh" content="0; url=webapp/installer/">'
        '<a href="webapp/installer/">SLOOP installer</a>\n', encoding="utf-8")
    print(f"site: {out}: webapp/installer ({len(html)} B), webapp/editor, firmware/{name} ({len(raw)} B, {product})")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a not in ("--studio-guide", "--beta")]
    if len(args) != 3:
        sys.exit(__doc__)
    main(*args)
