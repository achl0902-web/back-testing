#!/usr/bin/env python3
"""T16: one-off download of the indicators the user asked about (2026-10-24) that the research data does not have yet.
Writes date,value CSVs into qld/data/macro (read by research/lib/macro.js) and a log to qld/research/data/extra_fetch_log.txt:
  MARGIN_Z1.csv    Fed Z.1 margin accounts at brokers and dealers (FRED BOGZ1FL663067003Q, quarterly, 1945~)
  FINRA_MARGIN.csv FINRA debit balances in customers' securities margin accounts (monthly, 1997~)
  CBOE_TOTALPC.csv / CBOE_EQUITYPC.csv / CBOE_PCARCHIVE.csv  CBOE put/call ratios (daily; the public CSVs stop in 2019)
  CNN_FG.csv       CNN Fear & Greed index (daily, unofficial endpoint; history starts around 2011 at best)
Each source is independent: a failure is logged and the others still run.
"""
import csv, datetime as dt, io, json, os, re, time, urllib.request
OUT = os.path.join('qld', 'data', 'macro'); LOG = os.path.join('qld', 'research', 'data', 'extra_fetch_log.txt')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': '*/*'}
KEY = os.environ.get('FRED_API_KEY'); log = []
def get(u, tries=3, extra=None):
    for k in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=dict(UA, **(extra or {}))), timeout=60).read()
        except Exception as e:
            if k == tries - 1: raise
            time.sleep(5)
def save(name, rows, src):
    rows = sorted({d: v for d, v in rows}.items())
    with open(os.path.join(OUT, name), 'w') as f: f.write('date,value\n' + ''.join(f'{d},{v}\n' for d, v in rows))
    log.append(f'{name} ({src}): {len(rows)} rows {rows[0][0]}..{rows[-1][0]}' if rows else f'{name} ({src}): 0 rows')

# 1) Fed Z.1 margin accounts (FRED)
try:
    u = (f'https://api.stlouisfed.org/fred/series/observations?series_id=BOGZ1FL663067003Q&file_type=json&api_key={KEY}' if KEY
         else 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BOGZ1FL663067003Q')
    t = get(u).decode()
    rows = ([(o['date'], o['value']) for o in json.loads(t)['observations'] if o['value'] not in ('.', '')] if KEY
            else [tuple(l.split(',')) for l in t.strip().split('\n')[1:] if not l.endswith(',.')])
    save('MARGIN_Z1.csv', rows, 'FRED BOGZ1FL663067003Q')
except Exception as e: log.append(f'MARGIN_Z1: failed {e}')

# 2) FINRA margin statistics (xlsx); the site answered 403 to a bare request, so send browser-like headers
FH = {'Accept': 'text/html,application/xhtml+xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://www.finra.org/investors/margin-statistics'}
try:
    import pandas as pd
    url = None
    try:
        page = get('https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics', extra=FH).decode('utf8', 'ignore')
        m = re.findall(r'href="([^"]+margin-statistics[^"]*\.xlsx)"', page); url = m[0] if m else None
        if url and url.startswith('/'): url = 'https://www.finra.org' + url
    except Exception as e: log.append(f'FINRA page: {e}')
    url = url or 'https://www.finra.org/sites/default/files/2021-03/margin-statistics.xlsx'
    df = pd.read_excel(io.BytesIO(get(url, extra=FH)))
    dcol = next(c for c in df.columns if 'debit' in str(c).lower()); mcol = df.columns[0]
    rows = []
    for a, b in zip(df[mcol], df[dcol]):
        try: d = pd.to_datetime(str(a)).date(); rows.append((d.replace(day=1).isoformat(), float(b)))
        except Exception: pass
    save('FINRA_MARGIN.csv', rows, url)
except Exception as e: log.append(f'FINRA_MARGIN: failed {e}')

# 3) CBOE put/call CSVs
for nm, f in [('CBOE_TOTALPC.csv', 'totalpc.csv'), ('CBOE_EQUITYPC.csv', 'equitypc.csv'), ('CBOE_PCARCHIVE.csv', 'pcratioarchive.csv')]:
    try:
        t = get('https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/' + f).decode('utf8', 'ignore'); rows = []
        for r in csv.reader(io.StringIO(t)):
            if not r: continue
            try: d = dt.datetime.strptime(r[0].strip(), '%m/%d/%Y').date()
            except ValueError: continue
            vals = [x for x in (c.strip() for c in r[1:]) if re.fullmatch(r'-?\d+(\.\d+)?', x)]
            if vals: rows.append((d.isoformat(), float(vals[-1])))  # last numeric column = P/C ratio
        save(nm, rows, 'cdn.cboe.com/' + f)
    except Exception as e: log.append(f'{nm}: failed {e}')

# 3b) CBOE daily market statistics JSON (free, by date, 2019-10-07 onward): fills the gap after the CSVs end
try:
    def _load(n):
        p = os.path.join(OUT, n)
        return [tuple(l.split(',')) for l in open(p).read().strip().split('\n')[1:]] if os.path.exists(p) else []
    rows_t, rows_e = _load('CBOE_TOTALPC_D.csv'), _load('CBOE_EQUITYPC_D.csv'); miss = 0  # incremental: start after the last saved day
    d = (dt.date.fromisoformat(rows_t[-1][0]) + dt.timedelta(days=1)) if rows_t else dt.date(2019, 10, 7)
    while d <= dt.date.today():
        if d.weekday() < 5:
            try:
                j = json.loads(get(f'https://cdn.cboe.com/data/us/options/market_statistics/daily/{d.isoformat()}_daily_options', tries=2))
                r = {x['name'].upper(): x['value'] for x in j.get('ratios', [])}
                if 'TOTAL PUT/CALL RATIO' in r: rows_t.append((d.isoformat(), float(r['TOTAL PUT/CALL RATIO'])))
                if 'EQUITY PUT/CALL RATIO' in r: rows_e.append((d.isoformat(), float(r['EQUITY PUT/CALL RATIO'])))
            except Exception: miss += 1
            time.sleep(0.2)
        d += dt.timedelta(days=1)
    save('CBOE_TOTALPC_D.csv', rows_t, f'cdn.cboe.com daily json, {miss} weekdays missing (holidays included)')
    save('CBOE_EQUITYPC_D.csv', rows_e, 'cdn.cboe.com daily json')
except Exception as e: log.append(f'CBOE daily: failed {e}')

# 4) CNN Fear & Greed (unofficial JSON)
try:
    j = json.loads(get('https://production.dataviz.cnn.io/index/fearandgreed/graphdata/2011-01-03', extra={'Referer': 'https://edition.cnn.com/', 'Origin': 'https://edition.cnn.com', 'Accept': 'application/json, text/plain, */*', 'Accept-Language': 'en-US,en;q=0.9'}))
    pts = j.get('fear_and_greed_historical', {}).get('data', [])
    save('CNN_FG.csv', [(dt.datetime.utcfromtimestamp(p['x'] / 1000).date().isoformat(), round(float(p['y']), 2)) for p in pts], 'production.dataviz.cnn.io')
except Exception as e: log.append(f'CNN_FG: failed {e}')

# 4b) Fear & Greed history compiled by FinHacker (2011~, from CNN + Wayback + public repos); used only if it parses
try:
    t = get('https://www.finhacker.cz/fear-greed-data/', extra={'Referer': 'https://www.finhacker.cz/en/fear-and-greed-index-historical-data-and-chart/'}).decode('utf8', 'ignore')
    rows = []
    for r in csv.reader(io.StringIO(t)):
        if len(r) < 2: continue
        m = re.match(r'(\d{4}-\d{2}-\d{2})', r[0].strip())
        v = next((x for x in r[1:] if re.fullmatch(r'\d+(\.\d+)?', x.strip())), None)
        if m and v: rows.append((m.group(1), float(v)))
    if rows: save('FG_FINHACKER.csv', rows, 'finhacker.cz/fear-greed-data')
    else: log.append('FG_FINHACKER: no rows parsed; head: ' + t[:300].replace('\n', ' '))
except Exception as e: log.append(f'FG_FINHACKER: failed {e}')

os.makedirs(os.path.dirname(LOG), exist_ok=True)
open(LOG, 'w').write(dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ') + '\n' + '\n'.join(log) + '\n'); print('\n'.join(log))
