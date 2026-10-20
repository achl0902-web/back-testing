#!/usr/bin/env python3
"""T09: macro alarm share under alternative data handling -> data/variants/T09_<v>.json ({"NDX": [...], "SPX2": [...]}).
  V0 same files (recomputed)   V1 fixed denominator (9 indicators present 1986~2026)   V2 without post-hoc indices (STLFSI4, NFCIRISK)
  V3 first releases (ALFRED) for ICSA, NFCIRISK, STLFSI4 from data/vintage/<S>_first.csv
Run from qld/research: python3 lib/macro_variants.py V1 [V2 ...]"""
import json, os, shutil, sys, tempfile
import numpy as np, pandas as pd
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.dirname(R)
sys.path.insert(0, os.path.join(Q, 'scripts')); import macro
DROP = {'V0': [], 'V1': ['STLFSI4', 'TEDRATE', 'VXVCLS', 'Y_RUT', 'Y_COPPER', 'Y_GOLD'], 'V2': ['STLFSI4', 'NFCIRISK'], 'V3': []}
def dates(f):
    r = json.load(open(os.path.join(R, 'data', f))); d = np.cumsum([r['d0']] + r['dd'])
    return pd.to_datetime(d, unit='D'), r
for v in sys.argv[1:]:
    tmp = tempfile.mkdtemp(prefix=f't09{v}-'); src = os.path.join(Q, 'data', 'macro')
    for fn in os.listdir(src):
        if fn.endswith('.csv') and fn[:-4] not in DROP[v]: shutil.copy(os.path.join(src, fn), os.path.join(tmp, fn))
    if v == 'V3':
        for s in ['ICSA', 'NFCIRISK', 'STLFSI4']:
            p = os.path.join(R, 'data', 'vintage', f'{s}_first.csv')
            if not os.path.exists(p): sys.exit(f'{p} 없음 (history-fetch 워크플로 필요)')
            shutil.copy(p, os.path.join(tmp, f'{s}.csv'))
    out = {}
    for name, f in [('NDX', 'ndx_ms.json'), ('SPX2', 'spx_ms.json')]:
        idx, raw = dates(f)
        _, z, share = macro.compute(tmp, idx)
        out[name] = [None if np.isnan(x) else round(float(x), 3) for x in share.values]
        base = np.array([np.nan if x is None else x for x in raw['ms']], dtype=float)
        both = ~np.isnan(base) & ~np.isnan(share.values)
        n = z.notna().sum(axis=1)
        print(f'{v} {name}: 지표 수 {int(n.min())}~{int(n.max())} (중앙 {int(n.median())}) · 저장된 경보 비율과 다른 날 {np.mean(np.abs(base[both] - share.values[both]) > 1e-9) * 100:.1f}% · 50% 이상 날 {np.nanmean(share.values >= 0.5) * 100:.1f}% (저장값 {np.nanmean(base >= 0.5) * 100:.1f}%)')
    json.dump(out, open(os.path.join(R, 'data', 'variants', f'T09_{v}.json'), 'w'), separators=(',', ':'))
    shutil.rmtree(tmp)
