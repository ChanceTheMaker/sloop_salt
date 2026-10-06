#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Build SLOOP's browser DSP without building or modifying an FM-1 package.

Requires Zig 0.13.0 (zig cc). Pass --zig or set ZIG to its executable.
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--zig', default=os.environ.get('ZIG', 'zig'))
args = parser.parse_args()
gen = ROOT / 'build/browser-audio/gen'
gen.mkdir(parents=True, exist_ok=True)
for script, header in [('gen_tables.py', 'felucca_tables.h'),
                       ('gen_samples.py', 'felucca_samples.h'),
                       ('gen_drumkits.py', 'felucca_drumkits.h')]:
    subprocess.run([sys.executable, str(ROOT/'tools'/script), str(gen/header)], cwd=ROOT, check=True)
exports = ['synth_init','synth_target','synth_select','synth_engine','synth_param',
           'synth_global','synth_midi','synth_render','synth_step','synth_drum_step',
           'synth_transport','synth_playing','synth_position','synth_panic','synth_solo',
           'synth_sample_buffer','synth_sample_apply','engine_count','param_count',
           'global_count','preset_count','preset_name','preset_value','engine_name',
           'descriptor_value','descriptor_text']
env = {**os.environ, 'ZIG_GLOBAL_CACHE_DIR': str(ROOT/'build/zig-cache'),
       'ZIG_LOCAL_CACHE_DIR': str(ROOT/'build/zig-local-cache')}
subprocess.run([args.zig, 'cc', '-target', 'wasm32-freestanding', '-O2', '-fno-builtin',
                '-fwrapv', '-nostdlib', '-Wl,--no-entry',
                *['-Wl,--export='+name for name in exports],
                '-Wl,-z,stack-size=0x40000', '-Wl,--initial-memory=0x800000',
                '-Wl,--max-memory=0x800000', '-I'+str(gen), str(ROOT/'web/audio/engine.c'),
                '-o', str(ROOT/'web/audio/engine.wasm')], cwd=ROOT, env=env, check=True)
print('Built web/audio/engine.wasm from SLOOP firmware sources')
