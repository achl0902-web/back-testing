#!/usr/bin/env python3
"""T09: first-release (ALFRED, output_type=4) values for revised macro series -> qld/research/data/vintage/<S>_first.csv."""
import os, time
import fetchlib
OUT = os.path.join('qld', 'research', 'data', 'vintage'); os.makedirs(OUT, exist_ok=True)
log = []
for s in ['ICSA', 'NFCIRISK', 'STLFSI4']:
  if os.path.exists(os.path.join(OUT, f'{s}_first.csv')): log.append(f'{s}: kept'); continue
  for attempt in range(3):
    try:
        obs = fetchlib.fred_observations(s, timeout=240, realtime_start='1776-07-04', realtime_end='9999-12-31', output_type=4)
        rows = [(o['date'], o['value'], o.get('realtime_start', '')) for o in obs if o['value'] not in ('.', '')]
        open(os.path.join(OUT, f'{s}_first.csv'), 'w').write('date,value,realtime_start\n' + '\n'.join(','.join(r) for r in rows) + '\n')
        log.append(f'{s}: {len(rows)} rows {rows[0][0]}..{rows[-1][0]} · first vintage {min(r[2] for r in rows)}'); break
    except Exception as e:
        if attempt == 2: log.append(f'{s}: failed {type(e).__name__} {e}')
        time.sleep(10)
# NFCIRISK: the full first-release query times out (504); ask year by year of release instead
if not os.path.exists(os.path.join(OUT, 'NFCIRISK_first.csv')):
    rows = {}
    for yr in range(2011, 2027):
        for attempt in range(3):
            try:
                for o in fetchlib.fred_observations('NFCIRISK', timeout=240, realtime_start=f'{yr}-01-01', realtime_end=f'{yr}-12-31', output_type=4):
                    if o['value'] not in ('.', '') and (o['date'] not in rows or o.get('realtime_start', '') < rows[o['date']][1]):
                        rows[o['date']] = (o['value'], o.get('realtime_start', ''))
                break
            except Exception as e:
                if attempt == 2: log.append(f'NFCIRISK {yr}: failed {type(e).__name__} {e}')
                time.sleep(10)
    if rows:
        ks = sorted(rows)
        open(os.path.join(OUT, 'NFCIRISK_first.csv'), 'w').write('date,value,realtime_start\n' + '\n'.join(f'{k},{rows[k][0]},{rows[k][1]}' for k in ks) + '\n')
        log.append(f'NFCIRISK (by year): {len(ks)} rows {ks[0]}..{ks[-1]} · first vintage {min(v[1] for v in rows.values())}')
open(os.path.join(OUT, 'fetch_log.txt'), 'w').write('\n'.join(log) + '\n'); print('\n'.join(log))
