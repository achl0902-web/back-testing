"""Shared download helpers for the fetch_*.py scripts (run from the repository root).

- get(): one HTTP GET with retries (urllib, browser-like headers by default)
- fred_rows(): a FRED series as [(date, value)], via the API when FRED_API_KEY is set, else the public CSV
- fred_observations(): raw API observations (extra query parameters such as ALFRED realtime_start / output_type)
Errors never carry the API key: it is replaced by *** in every message raised from here.
"""
import json, os, time, urllib.parse, urllib.request

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept': '*/*'}
FRED_API = 'https://api.stlouisfed.org/fred/series/observations'
FRED_CSV = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id={s}'


def fred_key():
    return os.environ.get('FRED_API_KEY', '').strip() or None


def scrub(msg, key=None):
    """Remove the FRED key from a message (URLs in exceptions, logs)."""
    key = key or fred_key()
    return str(msg).replace(key, '***') if key else str(msg)


def get(url, extra=None, tries=3, timeout=60, wait=5, headers=None):
    """GET url and return the body bytes. Retries `tries` times, sleeping `wait` seconds between attempts."""
    h = dict(headers or UA, **(extra or {}))
    for k in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=timeout).read()
        except Exception as e:
            if k == tries - 1:
                if fred_key() and fred_key() in str(e):
                    raise RuntimeError(scrub(e)) from None
                raise
            time.sleep(wait)


def fred_observations(series, key=None, tries=1, timeout=60, headers=None, **params):
    """FRED API observations (list of dicts). Needs a key (argument or FRED_API_KEY)."""
    key = key or fred_key()
    if not key:
        raise RuntimeError('no FRED key')
    q = urllib.parse.urlencode(dict(series_id=series, file_type='json', **params, api_key=key))
    try:
        return json.loads(get(f'{FRED_API}?{q}', tries=tries, timeout=timeout, headers=headers))['observations']
    except Exception as e:
        raise RuntimeError(f'{type(e).__name__} {scrub(e, key)}') from None


def fred_rows(series, key=None, tries=1, timeout=30, headers=None):
    """[(date, value)] without missing values ('.'), via the API when a key is set, else the public CSV."""
    key = key or fred_key()
    if key:
        return [(o['date'], o['value']) for o in fred_observations(series, key, tries, timeout, headers) if o['value'] not in ('.', '')]
    t = get(FRED_CSV.format(s=series), tries=tries, timeout=timeout, headers=headers).decode()
    rows = [l.split(',') for l in t.strip().split('\n')[1:]]
    return [(a, b) for a, b in rows if b not in ('.', '')]
