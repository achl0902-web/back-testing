#!/usr/bin/env python3
"""T09: first-release (ALFRED, output_type=4) values for revised macro series -> qld/research/data/vintage/<S>_first.csv."""
import json, os, time, urllib.request
OUT = os.path.join('qld', 'research', 'data', 'vintage'); os.makedirs(OUT, exist_ok=True)
KEY = os.environ.get('FRED_API_KEY'); log = []
for s in ['ICSA', 'NFCIRISK', 'STLFSI4']:
    try:
        u = (f'https://api.stlouisfed.org/fred/series/observations?series_id={s}&realtime_start=1776-07-04&realtime_end=9999-12-31'
             f'&output_type=4&file_type=json&api_key={KEY}')
        obs = json.load(urllib.request.urlopen(u, timeout=60))['observations']
        rows = [(o['date'], o['value'], o.get('realtime_start', '')) for o in obs if o['value'] not in ('.', '')]
        open(os.path.join(OUT, f'{s}_first.csv'), 'w').write('date,value,realtime_start\n' + '\n'.join(','.join(r) for r in rows) + '\n')
        log.append(f'{s}: {len(rows)} rows {rows[0][0]}..{rows[-1][0]} · first vintage {min(r[2] for r in rows)}')
    except Exception as e:
        log.append(f'{s}: failed {type(e).__name__} {e}')
    time.sleep(1)
open(os.path.join(OUT, 'fetch_log.txt'), 'w').write('\n'.join(log) + '\n'); print('\n'.join(log))
