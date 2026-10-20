#!/usr/bin/env python3
"""T08: download pre-1986 history for the out-of-sample check (run by .github/workflows/history-fetch.yml).

Writes qld/research/data/hist/: GSPC.csv (S&P 500 daily close, 1950~), IXIC.csv (Nasdaq Composite daily close, 1971~),
BAA.csv / AAA.csv (Moody's monthly yields, FRED), fetch_log.txt. Dividends come from Shiller's monthly data (datasets/s-and-p-500).
"""
import io, os, sys, time, urllib.request
OUT = os.path.join('qld', 'research', 'data', 'hist'); os.makedirs(OUT, exist_ok=True)
log = []
UA = {'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv,*/*'}
KEY = os.environ.get('FRED_API_KEY')

def fred(s):
    if KEY:
        import json
        u = f'https://api.stlouisfed.org/fred/series/observations?series_id={s}&file_type=json&api_key={KEY}'
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))
        rows = [(o['date'], o['value']) for o in d['observations'] if o['value'] not in ('.', '')]
    else:
        t = urllib.request.urlopen(urllib.request.Request(f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={s}', headers=UA), timeout=30).read().decode()
        rows = [l.split(',') for l in t.strip().split('\n')[1:]]; rows = [(a, b) for a, b in rows if b not in ('.', '')]
    open(os.path.join(OUT, f'{s}.csv'), 'w').write('date,value\n' + '\n'.join(f'{a},{b}' for a, b in rows) + '\n')
    log.append(f'FRED {s}: {len(rows)} rows {rows[0][0]}..{rows[-1][0]}')

for s in ['BAA', 'AAA']:
    for k in range(3):
        try: fred(s); break
        except Exception as e:
            if k == 2: log.append(f'FRED {s}: failed {e}')
            time.sleep(5)

try:
    import yfinance as yf, pandas as pd
    for tk, nm, start in [('^GSPC', 'GSPC', '1950-01-01'), ('^IXIC', 'IXIC', '1971-01-01')]:
        df = yf.download(tk, start=start, end='1990-12-31', auto_adjust=False, progress=False, threads=False)
        if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
        s = df['Close'].dropna()
        s.rename('value').to_csv(os.path.join(OUT, f'{nm}.csv'), index_label='date', float_format='%.4f')
        log.append(f'YAHOO {tk}: {len(s)} rows {s.index[0].date()}..{s.index[-1].date()}')
except Exception as e:
    log.append(f'YAHOO failed: {e}')
open(os.path.join(OUT, 'fetch_log.txt'), 'w').write('\n'.join(log) + '\n')
print('\n'.join(log))
