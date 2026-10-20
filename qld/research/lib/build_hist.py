#!/usr/bin/env python3
"""T08: build pre-1986 research datasets (data/hist_spx.json, data/hist_ixic0.json, data/hist_ixicd.json) from data/hist/.

Total return = daily close change + Shiller monthly D/P / 252 (S&P). T-bill = TB3MS (monthly). FX fixed (1000).
Macro alarm share: scripts/macro.py on a directory of reconstructed series (only indicators that existed then).
Monthly yields (BAA, AAA, GS10, TB3MS) are used from the first day of the following month, then forward-filled on
business days so the daily shifts in macro.py (63, 126 observations) keep their meaning.
Run from qld/research: python3 lib/build_hist.py
"""
import json, os, sys, tempfile, shutil
import numpy as np, pandas as pd
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); Q = os.path.dirname(R)
H, M = os.path.join(R, 'data', 'hist'), os.path.join(Q, 'data', 'macro')
sys.path.insert(0, os.path.join(Q, 'scripts')); import macro

def ser(path, col=1):
    x = pd.read_csv(path); return pd.Series(pd.to_numeric(x.iloc[:, col], errors='coerce').values, index=pd.to_datetime(x.iloc[:, 0])).dropna()
END = pd.Timestamp('1985-12-31')
gs10, tb3, baa, aaa = ser(os.path.join(M, 'GS10.csv')), ser(os.path.join(M, 'TB3MS.csv')), ser(os.path.join(H, 'BAA.csv')), ser(os.path.join(H, 'AAA.csv'))
bdays = pd.bdate_range('1950-01-01', '1990-12-31')
def monthly_to_daily(s):  # value of month M usable from the first day of M+1
    s = s.copy(); s.index = s.index + pd.offsets.MonthBegin(1)
    return s.reindex(bdays.union(s.index)).ffill().reindex(bdays).dropna()
mdir = tempfile.mkdtemp(prefix='histmacro-')
def put(name, s): s.rename('value').to_csv(os.path.join(mdir, f'{name}.csv'), index_label='date')
put('BAA10Y', monthly_to_daily(baa - gs10.reindex(baa.index)).dropna())
put('AAA10Y', monthly_to_daily(aaa - gs10.reindex(aaa.index)).dropna())
put('T10Y3M', monthly_to_daily(gs10 - tb3.reindex(gs10.index)).dropna())
for f in ['DFF', 'ICSA', 'NFCIRISK', 'SAHMREALTIME']: shutil.copy(os.path.join(M, f'{f}.csv'), os.path.join(mdir, f'{f}.csv'))

sh = pd.read_csv(os.path.join(H, 'shiller_monthly.csv'), parse_dates=['Date']).set_index('Date')
dp = (sh['Dividend'] / sh['SP500']).dropna()            # annual dividend yield by month
tbm = (tb3 / 100)

def build(close, div, out, start):
    c = close[(close.index >= start) & (close.index <= END)]
    idx = c.index
    mkey = idx.to_period('M').to_timestamp()
    y = dp.reindex(mkey).ffill().values if div == 'spx' else np.zeros(len(idx))
    r = c.pct_change().fillna(0).values + y / 252
    tb = tbm.reindex(mkey).ffill().values
    raw_m, z, share = macro.compute(mdir, idx)
    nav = z.notna().sum(axis=1)
    day = ((idx - pd.Timestamp('1970-01-01')).days).astype(int)
    d = dict(d0=int(day[0]), dd=[int(x) for x in np.diff(day)], px=[round(float(v), 4) for v in c.values], rq=[float('%.7g' % v) for v in r],
             tb=[round(float(v), 5) for v in tb], fx=[1000.0] * len(idx), ms=[None if np.isnan(v) else round(float(v), 3) for v in share.values])
    json.dump(d, open(os.path.join(R, 'data', out), 'w'), separators=(',', ':'))
    ok = share.notna()
    print(f'{out}: {idx[0].date()}..{idx[-1].date()} {len(idx)}일 · 배당 {"쉴러 D/P" if div == "spx" else "0%"} · 매크로 지표 수(중앙) {int(nav.median())} · 경보 비율 있는 날 {ok.mean()*100:.0f}% (첫날 {share.dropna().index[0].date() if ok.any() else "-"}) · 50% 이상 날 {(share >= 0.5).mean()*100:.1f}%')

gspc, ixic = ser(os.path.join(H, 'GSPC.csv')), ser(os.path.join(H, 'IXIC.csv'))
build(gspc, 'spx', 'hist_spx.json', pd.Timestamp('1955-01-03'))
build(ixic, 'none', 'hist_ixic0.json', pd.Timestamp('1971-02-05'))
build(ixic, 'spx', 'hist_ixicd.json', pd.Timestamp('1971-02-05'))
shutil.rmtree(mdir)
