#!/usr/bin/env python3
"""Download macro history into qld/data/macro/ and write a fetch log next to it.

FRED (public CSV, no key) for credit, rates, stress and labour series;
Yahoo Finance (yfinance) for market-based series such as the semiconductor index.
Run from the repository root: python3 qld/scripts/fetch_macro.py
"""
import csv, datetime as dt, io, os, sys, time, urllib.request

OUT = os.path.join('qld', 'data', 'macro')
os.makedirs(OUT, exist_ok=True)
log = []
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'Accept': 'text/csv,text/plain,*/*'}

FRED = ['BAA10Y', 'AAA10Y', 'BAMLH0A0HYM2', 'BAMLC0A0CM', 'T10Y3M', 'T10Y2Y', 'DGS10', 'DGS2', 'DGS3MO', 'DFF',
        'VIXCLS', 'VXNCLS', 'VXVCLS', 'STLFSI4', 'NFCI', 'ANFCI', 'ICSA', 'CCSA', 'SAHMREALTIME', 'UNRATE',
        'DTWEXBGS', 'DCOILWTICO', 'TEDRATE']
URLS = ['https://fred.stlouisfed.org/graph/fredgraph.csv?id={s}',
        'https://fred.stlouisfed.org/series/{s}/downloaddata/{s}.csv']

def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode('utf-8', 'replace')

for s in FRED:
    done = False
    for u in URLS:
        url = u.format(s=s)
        for attempt in range(2):
            try:
                code, body = get(url)
                rows = [r for r in csv.reader(io.StringIO(body)) if r]
                if code == 200 and len(rows) > 10 and len(rows[0]) >= 2:
                    with open(os.path.join(OUT, f'{s}.csv'), 'w') as f:
                        f.write(body)
                    log.append(f'FRED {s}: ok {len(rows) - 1} rows {rows[1][0]}..{rows[-1][0]} via {url}')
                    done = True
                    break
                log.append(f'FRED {s}: bad response {code} {len(rows)} rows head={body[:80]!r} via {url}')
            except Exception as e:
                log.append(f'FRED {s}: {type(e).__name__} {str(e)[:120]} via {url}')
            time.sleep(2)
        if done:
            break

YAHOO = {'SOX': '^SOX', 'NDX': '^NDX', 'VIX': '^VIX', 'VIX3M': '^VIX3M', 'VXN': '^VXN', 'TNX': '^TNX', 'IRX': '^IRX',
         'FVX': '^FVX', 'TYX': '^TYX', 'HYG': 'HYG', 'LQD': 'LQD', 'IEF': 'IEF', 'DXY': 'DX-Y.NYB', 'COPPER': 'HG=F',
         'GOLD': 'GC=F', 'OIL': 'CL=F', 'RUT': '^RUT', 'SPX': '^GSPC', 'RSP': 'RSP', 'XLY': 'XLY', 'XLP': 'XLP',
         'SMH': 'SMH', 'KRE': 'KRE', 'XLF': 'XLF', 'TLT': 'TLT'}
try:
    import yfinance as yf
    import pandas as pd
    for name, t in YAHOO.items():
        try:
            df = yf.download(t, start='1980-01-01', auto_adjust=False, progress=False, threads=False)
            if df is None or df.empty:
                log.append(f'YAHOO {name} {t}: empty'); continue
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            col = 'Adj Close' if 'Adj Close' in df.columns else 'Close'
            s = df[col].dropna()
            s.index = s.index.strftime('%Y-%m-%d')
            s.rename('value').to_csv(os.path.join(OUT, f'Y_{name}.csv'), index_label='date')
            log.append(f'YAHOO {name} {t}: ok {len(s)} rows {s.index[0]}..{s.index[-1]} ({col})')
        except Exception as e:
            log.append(f'YAHOO {name} {t}: {type(e).__name__} {str(e)[:120]}')
except Exception as e:
    log.append(f'yfinance unavailable: {e}')

with open(os.path.join(OUT, '_fetch_log.txt'), 'w') as f:
    f.write(f'fetched {dt.datetime.utcnow():%Y-%m-%d %H:%M} UTC\n' + '\n'.join(log) + '\n')
print('\n'.join(log))
