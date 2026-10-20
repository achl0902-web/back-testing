#!/usr/bin/env python3
"""Refresh research/data/ndx_ms.json with the latest closes and macro alarm share.

The daily GitHub Actions run already keeps research/data/ndx_ms.json fresh (scripts/build.py writes it and the workflow
commits it), so this only matters when working offline. It runs scripts/build.py with --research: the build writes the
research series only if it is not older than the saved one, and never touches data/status.json or alert.md
(an earlier version overwrote the live status with stale mirror data; T09).
The S&P 2x series (spx_ms.json) is a fixed snapshot used only as an out-of-sample market; it is not refreshed.
Run from qld/: python3 research/refresh_data.py
"""
import os, subprocess, sys
Q = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
r = subprocess.run([sys.executable, os.path.join(Q, 'scripts', 'build.py'), '--research'], cwd=Q, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-2000:]); sys.exit(1)
print(r.stderr.strip().splitlines()[-1] if r.stderr.strip() else '', r.stdout.strip().splitlines()[-1])
