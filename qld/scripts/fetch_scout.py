#!/usr/bin/env python3
"""T19: data recommended by the first scout (research/SCOUT.md, 2026-10-24). Each source independent; log to research/data/scout_fetch_log.txt.
Outputs (qld/data/macro, date,value unless noted):
  CBOE_SKEW.csv                 CBOE SKEW index daily (1990~)
  AAII_BULL.csv / AAII_BEAR.csv / AAII_SPREAD.csv   AAII weekly sentiment (1987~), research use only
  COT_LEGACY_ES.csv / COT_LEGACY_NQ.csv   CFTC legacy futures: non-commercial net / open interest (weekly, report date)
  COT_TFF_ES.csv / COT_TFF_NQ.csv         CFTC TFF: leveraged-funds net / open interest and asset-manager net / OI (multi-column)
  WRMFNS.csv, DRTSCILM.csv      FRED retail money funds (weekly), senior loan officer tightening C&I (quarterly)
  MARGIN_FINRA_M.csv            FINRA margin debt monthly via thetrading.tools mirror (1997~), research use only
"""
import csv, datetime as dt, io, json, os, re, time, urllib.parse, urllib.request
OUT = os.path.join('qld', 'data', 'macro'); LOG = os.path.join('qld', 'research', 'data', 'scout_fetch_log.txt')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9'}
KEY = os.environ.get('FRED_API_KEY'); log = []
def get(u, extra=None, tries=3):
    for k in range(tries):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=dict(UA, **(extra or {}))), timeout=90).read()
        except Exception:
            if k == tries - 1: raise
            time.sleep(5)
def save(name, rows, src, header='date,value'):
    rows = sorted({r[0]: r for r in rows}.values())
    with open(os.path.join(OUT, name), 'w') as f: f.write(header + '\n' + ''.join(','.join(str(x) for x in r) + '\n' for r in rows))
    log.append(f'{name} ({src}): {len(rows)} rows {rows[0][0]}..{rows[-1][0]}' if rows else f'{name} ({src}): 0 rows')
def pdate(s):
    for f in ('%m/%d/%Y', '%Y-%m-%d', '%m/%d/%y', '%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S'):
        try: return dt.datetime.strptime(s.strip()[:26], f).date()
        except ValueError: pass
    return None

# CBOE SKEW
try:
    t = get('https://cdn.cboe.com/api/global/us_indices/daily_prices/SKEW_History.csv').decode('utf8', 'ignore'); rows = []
    for r in csv.reader(io.StringIO(t)):
        if len(r) >= 2 and pdate(r[0]):
            try: rows.append((pdate(r[0]).isoformat(), float(r[-1])))
            except ValueError: pass
    save('CBOE_SKEW.csv', rows, 'cdn.cboe.com SKEW_History.csv')
except Exception as e: log.append(f'CBOE_SKEW: failed {e}')

# AAII sentiment (xls)
try:
    import pandas as pd
    raw = get('https://www.aaii.com/files/surveys/sentiment.xls', extra={'Referer': 'https://www.aaii.com/sentimentsurvey/sent_results'})
    df = pd.read_excel(io.BytesIO(raw), header=None)
    # layout (checked 2026-10-24): col0 date, col1 bullish, col2 neutral, col3 bearish (shares of 1), col6 bull-bear spread; keep rows whose three shares sum to ~1
    bull, bear = [], []
    for _, r in df.iterrows():
        try: d = pd.to_datetime(r.iloc[0]).date(); b, n, e = float(r.iloc[1]), float(r.iloc[2]), float(r.iloc[3])
        except Exception: continue
        if b == b and n == n and e == e and abs(b + n + e - 1) < 0.03: bull.append((d.isoformat(), round(b, 4))); bear.append((d.isoformat(), round(e, 4)))
    save('AAII_BULL.csv', bull, 'aaii.com sentiment.xls'); save('AAII_BEAR.csv', bear, 'aaii.com sentiment.xls')
    save('AAII_SPREAD.csv', [(d, round(b - e, 4)) for (d, b), (_, e) in zip(bull, bear)], 'aaii bull-bear')
except Exception as e: log.append(f'AAII: failed {type(e).__name__} {e}')

# CFTC COT via Socrata (legacy futures-only 6dca-aqww; TFF futures-only gpe5-46if)
MAIN = lambda o: 'MICRO' not in o.get('market_and_exchange_names', '').upper()
def biggest(js):  # one row per report date: the contract with the largest open interest (names change over time)
    best = {}
    for o in js:
        d = o.get('report_date_as_yyyy_mm_dd', '')[:10]
        try: oi = float(o.get('open_interest_all', 0))
        except ValueError: continue
        if d and (d not in best or oi > float(best[d].get('open_interest_all', 0))): best[d] = o
    return list(best.values())
def cot(ds, like):
    q = urllib.parse.urlencode({'$where': f"upper(market_and_exchange_names) like '{like}'", '$limit': '50000', '$order': 'report_date_as_yyyy_mm_dd'})
    return json.loads(get(f'https://publicreporting.cftc.gov/resource/{ds}.json?{q}'))
for tag, like in [('ES', '%E-MINI S&P 500%'), ('NQ', '%NASDAQ%100%')]:
    try:
        js = biggest([o for o in cot('6dca-aqww', like) if MAIN(o)]); rows = []
        for o in js:
            if 'MINI' not in o.get('market_and_exchange_names', '').upper() and tag == 'NQ' and 'MICRO' in o.get('market_and_exchange_names', '').upper(): continue
            try: d = o['report_date_as_yyyy_mm_dd'][:10]; nl, ns, oi = float(o['noncomm_positions_long_all']), float(o['noncomm_positions_short_all']), float(o['open_interest_all'])
            except Exception: continue
            rows.append((d, round((nl - ns) / oi, 5) if oi else ''))
        names = sorted({o.get('market_and_exchange_names') for o in js})[:5]
        save(f'COT_LEGACY_{tag}.csv', rows, f'cftc 6dca-aqww {names}')
    except Exception as e: log.append(f'COT_LEGACY_{tag}: failed {e}')
    try:
        js = biggest([o for o in cot('gpe5-46if', like) if MAIN(o)]); rows = []
        for o in js:
            try:
                d = o['report_date_as_yyyy_mm_dd'][:10]; oi = float(o['open_interest_all'])
                lev = (float(o['lev_money_positions_long']) - float(o['lev_money_positions_short'])) / oi
                am = (float(o['asset_mgr_positions_long']) - float(o['asset_mgr_positions_short'])) / oi
            except Exception: continue
            rows.append((d, round(lev, 5), round(am, 5)))
        save(f'COT_TFF_{tag}.csv', rows, f'cftc gpe5-46if', header='date,levnet_oi,amnet_oi')
    except Exception as e: log.append(f'COT_TFF_{tag}: failed {e}')

# FRED weekly/quarterly
for s in ['WRMFNS', 'DRTSCILM']:
    try:
        if not KEY: raise RuntimeError('no FRED key')
        d = json.loads(get(f'https://api.stlouisfed.org/fred/series/observations?series_id={s}&file_type=json&api_key={KEY}'))
        save(f'{s}.csv', [(o['date'], o['value']) for o in d['observations'] if o['value'] not in ('.', '')], f'FRED {s}')
    except Exception as e: log.append(f'{s}: failed {e}')

# FINRA margin debt monthly (third-party mirror)
try:
    t = get('https://www.thetrading.tools/data/indicators/margin-debt.csv', extra={'Referer': 'https://www.thetrading.tools/margin-debt'}).decode('utf8', 'ignore')
    rd = list(csv.reader(io.StringIO(t))); hdr = [h.lower() for h in rd[0]]; rows = []
    vi = next((k for k, h in enumerate(hdr) if 'debit' in h or 'margin' in h or 'value' in h), 1)
    for r in rd[1:]:
        d = pdate(r[0]) if r else None
        if d:
            try: rows.append((d.replace(day=1).isoformat(), float(r[vi])))
            except (ValueError, IndexError): pass
    save('MARGIN_FINRA_M.csv', rows, f'thetrading.tools margin-debt.csv cols {hdr[:4]}')
except Exception as e: log.append(f'MARGIN_FINRA_M: failed {e}')

# --- 2nd scout (T20) ---
# FOMC dates 1994~: SF Fed US Monetary Policy Event-Study Database (xlsx), fallback borisjoffe/FOMC-dates.js (MIT)
try:
    import pandas as pd
    x = pd.read_excel(io.BytesIO(get('https://www.frbsf.org/wp-content/uploads/USMPD.xlsx', extra={'Referer': 'https://www.frbsf.org/research-and-insights/data-and-indicators/us-monetary-policy-event-study-database/'})), sheet_name=None)
    rows = set()
    for nm, df in x.items():
        for c in df.columns:
            for v in df[c].tolist():
                try:
                    d = pd.to_datetime(v)
                    if 1994 <= d.year <= 2030 and getattr(d, 'hour', 0) == 0: rows.add(d.date().isoformat())
                except Exception: pass
        log.append(f'USMPD sheet {nm}: cols {list(df.columns)[:6]}')
        break  # first sheet: one row per event
    save('FOMC_DATES.csv', [(d, 1) for d in sorted(rows)], 'frbsf USMPD.xlsx first sheet, all date-like cells')
except Exception as e:
    log.append(f'FOMC USMPD: failed {e}')
    try:
        t = get('https://raw.githubusercontent.com/borisjoffe/FOMC-dates.js/master/dates.csv').decode()
        save('FOMC_DATES.csv', [(m.group(0), 1) for m in re.finditer(r'\d{4}-\d{2}-\d{2}', t)], 'borisjoffe/FOMC-dates.js')
    except Exception as e2: log.append(f'FOMC fallback: failed {e2}')
# Ken French 48 industry portfolios, daily value-weighted returns (1926~) for industry breadth
try:
    import zipfile
    z = zipfile.ZipFile(io.BytesIO(get('https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/ftp/48_Industry_Portfolios_daily_CSV.zip')))
    t = z.read(z.namelist()[0]).decode('latin1'); lines = t.split('\n'); out = []; hdr = None
    for l in lines:
        p = [x.strip() for x in l.split(',')]
        if hdr is None and len(p) > 40 and p[0] == '': hdr = p; continue
        if hdr is not None:
            if not re.fullmatch(r'\d{8}', p[0] or ''): 
                if out: break
                continue
            out.append(p)
    with open(os.path.join(OUT, 'FF48_DAILY_VW.csv'), 'w') as f:
        f.write('date,' + ','.join(hdr[1:]) + '\n' + ''.join(f"{r[0][:4]}-{r[0][4:6]}-{r[0][6:]}," + ','.join(r[1:]) + '\n' for r in out))
    log.append(f'FF48_DAILY_VW.csv: {len(out)} rows {out[0][0]}..{out[-1][0]}, {len(hdr) - 1} industries (percent returns, value-weighted)')
except Exception as e: log.append(f'FF48: failed {e}')

open(LOG, 'w').write(dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ') + '\n' + '\n'.join(log) + '\n'); print('\n'.join(log))
