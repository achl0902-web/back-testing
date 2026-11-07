#!/usr/bin/env python3
"""T23: build the untouched 1928~1949 S&P 2x dataset (pre-registered in steps/T23-plan.md) from data/hist/.

Total return = daily close change + Shiller monthly D/P / 252. Short rate: NBER short-term US government yields
(M1329AUSM193NNBR) through 1933-12, TB3MS from 1934-01; each monthly value is used from the first day of the next month.
Sensitivity file: commercial paper (New York, M13002US35620M156NNBR) instead of government yields before 1934.
Macro alarm share: scripts/macro.py on the indicators that existed then (BAA and AAA minus Shiller's long rate, long minus
short rate). Only four exist, so the share is empty by the existing rule (needs five) and the macro alarm is off.
Run from qld/research: python3 lib/build_era1928.py
"""
import json, os, sys, tempfile, shutil
import numpy as np, pandas as pd
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.dirname(R)
H, M = os.path.join(R, 'data', 'hist'), os.path.join(Q, 'data', 'macro')
sys.path.insert(0, os.path.join(Q, 'scripts')); import macro

def ser(path, col=1):
    x = pd.read_csv(path); return pd.Series(pd.to_numeric(x.iloc[:, col], errors='coerce').values, index=pd.to_datetime(x.iloc[:, 0])).dropna()
END = pd.Timestamp('1949-12-31')
gspc = ser(os.path.join(H, 'GSPC_1927.csv')); gspc = gspc[gspc.index <= END]
sh = pd.read_csv(os.path.join(H, 'shiller_monthly.csv'), parse_dates=['Date']).set_index('Date')
dp = (sh['Dividend'] / sh['SP500']).dropna()
lng = sh['Long Interest Rate'].dropna()
gov, cp, tb3 = ser(os.path.join(H, 'M1329AUSM193NNBR.csv')), ser(os.path.join(H, 'M13002US35620M156NNBR.csv')), ser(os.path.join(M, 'TB3MS.csv'))
baa, aaa = ser(os.path.join(H, 'BAA.csv')), ser(os.path.join(H, 'AAA.csv'))
idx = gspc.index
bdays = pd.bdate_range('1919-01-01', '1950-01-31')

def short(pre):  # monthly short rate in percent: `pre` before 1934-01, TB3MS after
    s = pd.concat([pre[pre.index < '1934-01-01'], tb3[tb3.index >= '1934-01-01']]).sort_index()
    return s[~s.index.duplicated()]
def next_month(s):  # value of month M usable from the first day of M+1
    s = s.copy(); s.index = s.index + pd.offsets.MonthBegin(1); return s
def daily(s):
    s = next_month(s); return s.reindex(bdays.union(s.index)).ffill().reindex(bdays).dropna()

def build(pre, out):
    sr = short(pre)
    mdir = tempfile.mkdtemp(prefix='era1928-')
    put = lambda name, s: s.rename('value').to_csv(os.path.join(mdir, f'{name}.csv'), index_label='date')
    put('BAA10Y', daily(baa - lng.reindex(baa.index)).dropna())
    put('AAA10Y', daily(aaa - lng.reindex(aaa.index)).dropna())
    put('T10Y3M', daily(lng - sr.reindex(lng.index)).dropna())
    raw_m, z, share = macro.compute(mdir, idx); shutil.rmtree(mdir)
    nav = z.notna().sum(axis=1)
    mkey = idx.to_period('M').to_timestamp()
    y = dp.reindex(mkey).ffill().values
    r = gspc.pct_change().fillna(0).values + y / 252
    nm = next_month(sr) / 100
    tb = nm.reindex(pd.DatetimeIndex(sorted(set(mkey))).union(nm.index)).ffill().reindex(mkey).values
    day = ((idx - pd.Timestamp('1970-01-01')).days).astype(int)
    d = dict(d0=int(day[0]), dd=[int(x) for x in np.diff(day)], px=[round(float(v), 4) for v in gspc.values], rq=[float('%.7g' % v) for v in r],
             tb=[round(float(v), 5) for v in tb], fx=[1000.0] * len(idx), ms=[None if np.isnan(v) else round(float(v), 3) for v in share.values])
    json.dump(d, open(os.path.join(R, 'data', out), 'w'), separators=(',', ':'))
    yrs = (idx[-1] - idx[0]).days / 365.25
    print(f'{out}: {idx[0].date()}..{idx[-1].date()} {len(idx)}일 · 매크로 지표 수(최대) {int(nav.max())} → 경보 비율 있는 날 {share.notna().mean()*100:.0f}% · '
          f'단기금리 평균 1928~33 {np.nanmean(tb[(idx.year <= 1933)])*100:.2f}% / 1934~49 {np.nanmean(tb[(idx.year >= 1934)])*100:.2f}% · '
          f'S&P 총수익 연 {(np.prod(1 + r) ** (1 / yrs) - 1)*100:.1f}%')

build(gov, 'hist_spx1928.json')
build(cp, 'hist_spx1928cp.json')
