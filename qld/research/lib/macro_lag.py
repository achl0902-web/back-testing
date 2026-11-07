#!/usr/bin/env python3
"""T24 E (pre-registered in steps/T24-plan.md): macro alarm share with longer publication lags, a proxy for release delays
(e.g. government shutdowns) -> data/variants/T24_<v>.json ({"NDX": [...], "SPX2": [...]}), same format as T09 variants.
  B0   same files and lags, recomputed (the base the others are compared with)
  S60  Sahm rule (SAHMREALTIME) lag 36 -> 60 days
  C12  initial claims (ICSA) lag 5 -> 12 days
  SRD  Sahm rule available on the BLS Employment Situation release day: the third Friday after the reference week
       (the Sunday-Saturday week containing the 12th), with the verified delays below (E2, pre-registered addendum)
Run from qld/research: python3 lib/macro_lag.py B0 S60 C12 SRD"""
import json, os, sys
import numpy as np, pandas as pd
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.dirname(R)
sys.path.insert(0, os.path.join(Q, 'scripts')); import macro
LAGS = {'B0': (None, None), 'S60': ('sahm', 60), 'C12': ('claims', 12), 'SRD': (None, None)}
# verified release delays (BLS archives / news; steps/T24-plan.md E2). 2025-10 was never published (missing in the file too).
DELAYED = {'1995-12': '1996-01-19', '2013-09': '2013-10-22', '2013-10': '2013-11-08', '2025-09': '2025-11-20', '2025-11': '2025-12-16', '2026-01': '2026-02-11'}


def release_day(obs):
    """BLS rule: third Friday after the Saturday that ends the week containing the 12th; verified delays override it."""
    k = obs.strftime('%Y-%m')
    if k in DELAYED: return pd.Timestamp(DELAYED[k])
    d12 = pd.Timestamp(obs.year, obs.month, 12)
    sat = d12 + pd.Timedelta(days=(5 - d12.weekday()) % 7)  # Saturday ending the Sunday-Saturday week of the 12th
    return sat + pd.Timedelta(days=20)


_orig_raw = macro.raw_indicators
SRC = os.path.join(Q, 'data', 'macro')


def dates(f):
    r = json.load(open(os.path.join(R, 'data', f))); d = np.cumsum([r['d0']] + r['dd'])
    return pd.to_datetime(d, unit='D'), r


for v in sys.argv[1:]:
    k, lag = LAGS[v]; old = macro.LAG.get(k) if k else None
    if k: macro.LAG[k] = lag
    if v == 'SRD':  # re-date each Sahm observation so that date + LAG['sahm'] = its release day
        def raw_srd(mdir, _o=_orig_raw):
            d = _o(mdir); s0 = d['sahm'].dropna()
            d['sahm'] = pd.Series(s0.values, index=[release_day(t) - pd.Timedelta(days=macro.LAG['sahm']) for t in s0.index])
            gap = [(release_day(t) - t).days for t in s0.index if t.year >= 1986]
            print(f'  SRD: 1986~ 발표까지 일수 최소 {min(gap)} · 중앙 {int(np.median(gap))} · 최대 {max(gap)} (고정 시차 {macro.LAG["sahm"]}일보다 늦은 달 {sum(g > macro.LAG["sahm"] for g in gap)}개 / {len(gap)}개)')
            return d
        macro.raw_indicators = raw_srd
    else:
        macro.raw_indicators = _orig_raw
    out = {}
    for name, f in [('NDX', 'ndx_ms.json'), ('SPX2', 'spx_ms.json')]:
        idx, raw = dates(f)
        _, z, share = macro.compute(SRC, idx)
        out[name] = [None if np.isnan(x) else round(float(x), 3) for x in share.values]
        base = np.array([np.nan if x is None else x for x in raw['ms']], dtype=float)
        both = ~np.isnan(base) & ~np.isnan(share.values)
        diff = np.mean(np.abs(base[both] - np.round(share.values[both], 3)) > 1e-9) * 100
        print(f'{v} {name}: ' + (f'{k} 시차 {old}→{lag}일 · ' if k else '') + f'저장된 경보 비율과 다른 날 {diff:.2f}%')
    if k: macro.LAG[k] = old
    json.dump(out, open(os.path.join(R, 'data', 'variants', f'T24_{v}.json'), 'w'), separators=(',', ':'))
