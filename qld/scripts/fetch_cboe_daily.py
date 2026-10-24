#!/usr/bin/env python3
"""T16b: can CBOE's free daily market statistics page give put/call ratios by date (to fill 2019-10 onward and keep it current)?
Probe mode (default): fetch a few dates, save what the page returns for each, log parsed ratios.
Writes qld/research/data/cboe_probe.txt only.
"""
import datetime as dt, json, re, time, urllib.request
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': 'text/html,application/json,*/*'}
def get(u):
    try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode('utf8', 'ignore'), None
    except Exception as e: return '', str(e)
out = [dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')]
for d in ['2004-06-01', '2019-12-02', '2020-03-16', '2023-06-05', '2026-10-22']:
    for u in [f'https://www.cboe.com/us/options/market_statistics/daily/?dt={d}',
              f'https://cdn.cboe.com/data/us/options/market_statistics/daily/{d}_daily_options']:
        t, err = get(u)
        if err: out.append(f'{d} {u}: ERROR {err}'); continue
        ratios = re.findall(r'(TOTAL PUT/CALL RATIO|INDEX PUT/CALL RATIO|EQUITY PUT/CALL RATIO)[^0-9]{0,200}?([0-9]\.[0-9]{2})', t, re.I)
        nd = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', t, re.S)
        dates = sorted(set(re.findall(r'20\d\d-\d\d-\d\d', t)))[:8]
        out.append(f'{d} {u}: {len(t)} bytes, ratios {ratios[:3]}, next_data {len(nd.group(1)) if nd else 0}, dates {dates}')
        if nd:
            s = nd.group(1); k = s.lower().find('put/call')
            out.append('   next_data snippet: ' + s[max(0, k - 300):k + 500].replace('\n', ' '))
        elif t.lstrip().startswith('{'): out.append('   json head: ' + t[:600])
        time.sleep(2)
open('qld/research/data/cboe_probe.txt', 'w').write('\n'.join(out) + '\n'); print('\n'.join(out))
