#!/usr/bin/env python3
"""Refresh research/data/ndx_ms.json with the latest closes and macro alarm share.

Runs scripts/build.py (latest prices + macro share) and copies the embedded data block of the built page.
The S&P 2x series (spx_ms.json) is a fixed snapshot used only as an out-of-sample market; it is not refreshed.
Run from qld/: python3 research/refresh_data.py
"""
import json, os, re, subprocess, sys
Q = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
r = subprocess.run([sys.executable, os.path.join(Q, 'scripts', 'build.py')], cwd=Q, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-2000:]); sys.exit(1)
try: os.remove(os.path.join(Q, 'alert.md'))
except FileNotFoundError: pass
html = open(os.path.join(Q, 'site', 'index.html')).read()
raw = json.loads(re.search(r'const RAW = (\{.*?\});\n', html, re.S).group(1))
keep = {k: raw[k] for k in ('d0', 'dd', 'px', 'rq', 'tb', 'fx', 'ms')}
out = os.path.join(Q, 'research', 'data', 'ndx_ms.json')
json.dump(keep, open(out, 'w'), separators=(',', ':'))
print('ndx_ms.json rows', len(keep['px']))
