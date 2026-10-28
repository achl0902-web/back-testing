#!/usr/bin/env python3
"""T08: download pre-1986 history for the out-of-sample check (run by .github/workflows/history-fetch.yml).

Writes qld/research/data/hist/: GSPC.csv (S&P 500 daily close, 1950~), IXIC.csv (Nasdaq Composite daily close, 1971~),
BAA.csv / AAA.csv (Moody's monthly yields, FRED), fetch_log.txt. Dividends come from Shiller's monthly data (datasets/s-and-p-500).
"""
import os, time
import fetchlib
OUT = os.path.join('qld', 'research', 'data', 'hist'); os.makedirs(OUT, exist_ok=True)
log = []
UA = {'User-Agent': 'Mozilla/5.0', 'Accept': 'text/csv,*/*'}

def fred(s):
    rows = fetchlib.fred_rows(s, timeout=30, headers=UA)  # API when FRED_API_KEY is set, else the public CSV
    open(os.path.join(OUT, f'{s}.csv'), 'w').write('date,value\n' + '\n'.join(f'{a},{b}' for a, b in rows) + '\n')
    log.append(f'FRED {s}: {len(rows)} rows {rows[0][0]}..{rows[-1][0]}')

for s in ['BAA', 'AAA', 'WTISPLC', 'TWEXMMTH']:  # T14: monthly oil (1946~) and trade-weighted dollar (1973~) for the 1960~85 check of S26 A
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
