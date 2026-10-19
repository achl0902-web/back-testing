#!/usr/bin/env python3
"""Rebuild the QLD risk-signal DCA backtester with the latest daily closes.

Run from the repository root:
    python3 scripts/build.py            # writes site/index.html, site/status.json, data/status.json
Outputs alert.md when the daily signal deserves attention (used by the workflow to open an issue).

Data for days after data/base.json's last date:
  1st choice : Yahoo Finance via yfinance  (^NDX close, QQQ adjusted close, KRW=X, ^IRX)
  fallback   : public GitHub mirrors        (specterz/tqqq_161ma, kydchen/qqq-tqqq-signal-dashboard, datasets/exchange-rates)
"""
import csv, datetime as dt, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
KST = dt.timezone(dt.timedelta(hours=9))

base = json.load(open(P('data', 'base.json')))
days = [base['d0']]
for x in base['dd']:
    days.append(days[-1] + x)
iso = lambda n: (dt.date(1970, 1, 1) + dt.timedelta(days=n)).isoformat()
base_last = iso(days[-1])
start = (dt.date.fromisoformat(base_last) - dt.timedelta(days=20)).isoformat()

ndx, qqq, tb, fx, vix = {}, {}, {}, {}, {}
used = []

# ---------- Yahoo first; public GitHub mirrors only when Yahoo misses a series (Yahoo wins where both have data) ----------
def num(s):
    return float(str(s).replace(',', '').strip())

def mirrors():
    work = tempfile.mkdtemp(prefix='qldsrc-')
    repos = {'spz': 'https://github.com/specterz/tqqq_161ma',
             'kyd': 'https://github.com/kydchen/qqq-tqqq-signal-dashboard',
             'fx': 'https://github.com/datasets/exchange-rates'}
    ok = {}
    for k, url in repos.items():
        r = subprocess.run(['git', 'clone', '-q', '--depth', '1', url, os.path.join(work, k)],
                           capture_output=True, text=True, timeout=600)
        ok[k] = r.returncode == 0
    if ok['kyd']:
        for row in json.load(open(os.path.join(work, 'kyd/data/ndx-snapshot.json'))):
            ndx[row['date'][:10]] = float(row['value'])
        try:
            for row in json.load(open(os.path.join(work, 'kyd/data/vix-snapshot.json'))):
                vix[row['date'][:10]] = float(row['value'])
        except Exception: pass
        for row in json.load(open(os.path.join(work, 'kyd/data/qqq-snapshot.json'))):
            if row.get('adjClose') is not None:
                qqq[row['date'][:10]] = float(row['adjClose'])
    if ok['spz']:
        with open(os.path.join(work, 'spz/data/NDX.csv'), newline='') as f:
            for row in csv.DictReader(f):
                try: ndx[row['Date'][:10]] = num(row['Price'])
                except Exception: pass
        with open(os.path.join(work, 'spz/data/tbill_dgs3mo.csv'), newline='') as f:
            for row in csv.DictReader(f):
                try: tb[row['observation_date'][:10]] = num(row['DGS3MO']) / 100
                except Exception: pass
    if ok['fx']:
        with open(os.path.join(work, 'fx/data/daily.csv'), newline='') as f:
            for row in csv.DictReader(f):
                if row.get('Country') == 'South Korea':
                    try: fx[row['Date'][:10]] = num(row['Exchange rate'])
                    except Exception: pass
    if any(ok.values()):
        used.append('github-mirrors')

def yahoo():
    try:
        import yfinance as yf
        import pandas as pd
    except Exception as e:
        print('yfinance unavailable:', e, file=sys.stderr); return []
    def col(ticker, name):
        try:
            df = yf.download(ticker, start=start, auto_adjust=False, progress=False, threads=False)
            if df is None or df.empty: return {}
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            s = df[name].dropna()
            return {d.strftime('%Y-%m-%d'): float(v) for d, v in s.items()}
        except Exception as e:
            print(f'yahoo {ticker} failed:', e, file=sys.stderr); return {}
    got = []
    for target, ticker, name, scale in [(ndx, '^NDX', 'Close', 1), (qqq, 'QQQ', 'Adj Close', 1),
                                        (fx, 'KRW=X', 'Close', 1), (tb, '^IRX', 'Close', 0.01), (vix, '^VIX', 'Close', 1)]:
        d = col(ticker, name)
        if d:
            got.append((target, {k: v * scale for k, v in d.items()}))
    if got: used.append(f'yahoo({len(got)}/5)')
    return got

if '--offline' not in sys.argv:  # --offline: 저장된 데이터만으로 페이지를 만든다 (로컬 미리보기·비교용)
    got = yahoo()
    if len(got) < 5:  # 야후가 하나라도 비었을 때만 미러 3곳을 클론한다 (클론은 몇 분 걸림)
        mirrors()
    for target, d in got:  # 야후 값이 미러보다 우선
        # QQQ adjusted prices are rescaled after each dividend: only ratios matter, keep the series self-consistent
        if target is qqq: qqq.clear()
        target.update(d)

# ---------- append new rows ----------
def ffill(series, date, prev):
    keys = [k for k in series if k <= date]
    return series[max(keys)] if keys else prev

px, rq, tbl, fxl = list(base['px']), list(base['rq']), list(base['tb']), list(base['fx'])
vxl = list(base.get('vix') or [None] * len(px))
dd = list(base['dd'])
prev_date, prev_px = base_last, px[-1]
added = 0
for d in sorted(k for k in ndx if k > base_last):
    p = ndx[d]
    if not (p > 0) or dt.date.fromisoformat(d).weekday() >= 5:
        continue
    r = qqq[d] / qqq[prev_date] - 1 if (d in qqq and prev_date in qqq) else p / prev_px - 1 + 0.003 / 252
    n = (dt.date.fromisoformat(d) - dt.date(1970, 1, 1)).days
    dd.append(n - days[-1]); days.append(n)
    px.append(round(p, 2)); rq.append(float('%.7g' % r))
    tbl.append(round(ffill(tb, d, tbl[-1]), 4)); fxl.append(round(ffill(fx, d, fxl[-1]), 2))
    vv = ffill(vix, d, vxl[-1]); vxl.append(round(vv, 2) if vv is not None else None)
    prev_date, prev_px = d, p; added += 1

# ---------- macro alarm share (see scripts/macro.py) ----------
ms_l, macro_now, macro_ok = [None] * len(px), [], False
try:
    sys.path.insert(0, P('scripts'))
    import macro, math
    import pandas as pd
    idx = pd.to_datetime([iso(n) for n in days])
    mraw, mz, mshare = macro.compute(P('data', 'macro'), idx)
    ms_l = [None if (v is None or math.isnan(v)) else round(float(v), 3) for v in mshare.values]
    zl = mz.iloc[-1]
    for k, label, how, lag in macro.SPEC:
        z = zl.get(k)
        macro_now.append(dict(k=k, l=label, h=how, z=None if z is None or math.isnan(z) else round(float(z), 2)))
    macro_ok = True
except Exception as e:
    print('macro share unavailable:', type(e).__name__, e, file=sys.stderr)

# ---------- real ETF series for the buy-and-hold comparison page (hold.html) ----------
# daily adjusted-close returns from each ETF's first day, plus dividend events (adj/close ratio, events > 3% dropped
# as split or capital-gain artifacts) so the page can take off the 15% US withholding.
etf = {}
try:
    import pandas as pd
    idx_days = pd.to_datetime([iso(n) for n in days])
    for nm in ['QQQ', 'QLD', 'TQQQ', 'SPY', 'SSO', 'UPRO', 'SPX']:  # SPX = S&P 500 price index, used before SPY existed
        fa, fc = P('data', 'macro', f'Y_{nm}.csv'), P('data', 'macro', f'Y_{nm}_C.csv')
        if not os.path.exists(fa):
            continue
        a = pd.read_csv(fa, parse_dates=['date'], index_col='date')['value'].dropna()
        a = a[~a.index.duplicated()].reindex(idx_days[idx_days >= a.index[0]]).ffill()
        s0 = len(idx_days) - len(a)
        r = (a / a.shift(1) - 1).fillna(0.0).values[1:]
        dv = []
        if os.path.exists(fc):
            c = pd.read_csv(fc, parse_dates=['date'], index_col='date')['value'].dropna()
            c = c[~c.index.duplicated()].reindex(a.index).ffill()
            d = ((a / a.shift(1)) / (c / c.shift(1)) - 1).fillna(0.0).values
            dv = [[s0 + k, round(float(x), 5)] for k, x in enumerate(d) if 1e-5 < x < 0.03]
        etf[nm] = dict(s=s0, r=[float('%.6g' % x) for x in r], d=dv)
except Exception as e:
    print('etf series unavailable:', type(e).__name__, e, file=sys.stderr)

data = dict(d0=base['d0'], dd=dd, px=px, rq=rq, tb=tbl, fx=fxl, vix=vxl, ms=ms_l, macroNow=macro_now, etf=etf)
data_js = json.dumps({k: v for k, v in data.items() if k != 'etf'}, separators=(',', ':'))
hold_js = json.dumps({k: v for k, v in data.items() if k not in ('ms', 'macroNow', 'vix')}, separators=(',', ':'))
last = iso(days[-1])
y, m, d_ = last.split('-')
built = dt.datetime.now(KST).strftime('%Y-%m-%d %H:%M KST')
eng = open(P('src', 'engine.js')).read()
ui_js, ui_css = open(P('src', 'ui.js')).read(), open(P('src', 'ui.css')).read()  # 두 페이지 공통 화면 코드
assert '</script' not in data_js and '</script' not in eng and '</script' not in ui_js


def fill(tpl, data):
    return (tpl.replace('__UI_CSS__', ui_css).replace('__DATA__', data).replace('__ENGINE__', eng).replace('__UI_JS__', ui_js)
               .replace('__LASTDATE__', f'{int(y)}년 {int(m)}월 {int(d_)}일').replace('__BUILT__', built))


page = fill(open(P('src', 'page_tpl.html')).read(), data_js)
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>' + page + '</body></html>')
os.makedirs(P('site'), exist_ok=True)
open(P('site', 'index.html'), 'w').write(html)
hold = fill(open(P('src', 'hold_tpl.html')).read(), hold_js)
open(P('site', 'hold.html'), 'w').write(html.replace(page, hold))

# ---------- daily signal: 최종 전략 v1 (page default since 2026-10-19; exposure-step rule kept as a reference) ----------
RULES = {
    'final': ('최종 전략 v1 (기술 4축 + 매크로 경보)', "{}"),
    'tech': ('기술 4축만', "{useMacro:false}"),
    'kelly': ('노출 조절 (참고)', "{rule:'kelly'}"),
}
js = os.path.join(tempfile.mkdtemp(), 'status.js')
open(js, 'w').write(f"""
const E=require({json.dumps(P('src','engine.js'))});
const RAW={data_js};
const D=E.prepData(RAW);
const j=D.n-1; let i0=0; while(isNaN(D.rv[i0])) i0++;
const P=Object.assign({{}},E.DEFAULTS,{{strategy:true}});
const ax=E.axesAt(D,P,j);
const out={{rv20:D.rv[j],down20:D.vols.down20[j],up20:D.vols.up20[j],r10:D.r10[j],rsiw:D.rsiw[j],expand:D.vols.rv10[j]/D.v60[j],
  axes:ax,votes:ax.reduce((a,b)=>a+b,0),ms:isNaN(D.ms[j])?null:D.ms[j],
  macroOnset:E.macroOnset(D,P,j),reentry:ax.reduce((a,b)=>a+b,0)<=P.reMaxVotes&&D.px[j]>D.ma[20][j]&&D.vols.rv10[j]<D.v60[j],
  px:D.px[j],ma20:D.ma[20][j],rules:{{}}}};
// today's regime, and tomorrow's: replay one copied day so the engine executes today's signal at the next close
const R=E.runBT(D,i0,j,P,true);
const R2raw=Object.assign({{}},RAW,{{dd:RAW.dd.concat([1]),px:RAW.px.concat([RAW.px[j]]),rq:RAW.rq.concat([0]),tb:RAW.tb.concat([RAW.tb[j]]),fx:RAW.fx.concat([RAW.fx[j]]),
  vix:RAW.vix?RAW.vix.concat([RAW.vix[j]]):RAW.vix,ms:RAW.ms?RAW.ms.concat([RAW.ms[j]]):RAW.ms}});
const D2=E.prepData(R2raw), R2=E.runBT(D2,i0,D2.n-1,P,true);
const ev=R2.log.filter(x=>(x.type==='exit'||x.type==='reentry')&&x.d===D2.day[D2.n-1]).pop()||null;
const lastEv=R.log.filter(x=>x.type==='exit'||x.type==='reentry').pop()||null;
out.regime=R.regime; out.next=R2.regime; out.action=ev?{{type:ev.type,msg:ev.msg}}:null; out.lastTrade=lastEv?{{d:lastEv.d,type:lastEv.type}}:null;
""" + ''.join(f"{{const R=E.runBT(D,i0,j,Object.assign({{strategy:true}},{cfg}),false);out.rules[{json.dumps(k)}]={{regime:R.regime}};}}\n" for k, (_, cfg) in RULES.items())
 + "console.log(JSON.stringify(out));\n")
st = subprocess.run(['node', js], capture_output=True, text=True, timeout=600)
if st.returncode != 0:
    print(st.stderr, file=sys.stderr); sys.exit(1)
s = json.loads(st.stdout.strip().splitlines()[-1])
r4 = lambda x: None if x is None else round(x, 4)
NAME = {'in': 'QLD 보유', 'out': '이탈 중 (SGOV)', 'staged': '단계 복귀 중'}
action = s['action']
status = dict(date=last, strategy='final', regime=s['regime'], next=s['next'],
              action=None if not action else dict(type=action['type'], msg=action['msg']),
              lastTrade=None if not s['lastTrade'] else dict(date=iso(s['lastTrade']['d']), type=s['lastTrade']['type']),
              votes=s['votes'], axes=s['axes'],
              down20=r4(s['down20']), up20=r4(s['up20']), r10=r4(s['r10']), rsiw=round(s['rsiw'], 1), expand=round(s['expand'], 2),
              macro=r4(s['ms']), macroOnset=s['macroOnset'], reentryOK=s['reentry'], rv20=r4(s['rv20']),
              ndx=round(s['px'], 2), ma20=round(s['ma20'], 2),
              rules={k: dict(name=RULES[k][0], regime=v['regime']) for k, v in s['rules'].items()},
              macroNow={m['k']: m['z'] for m in macro_now}, macro_ok=macro_ok,
              built=built, sources=used, added_rows=added)
status['title'] = (f"[QLD] {last} 다음 거래일 " + ('이탈: QLD 전량 매도 → SGOV' if action and action['type'] == 'exit' else '복귀: SGOV 전량 → QLD')
                   if action else f"[QLD] {last} {NAME[status['regime']]}")

prev = {}
try: prev = json.load(open(P('data', 'status.json')))
except Exception: pass
json.dump(status, open(P('data', 'status.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(status, open(P('site', 'status.json'), 'w'), ensure_ascii=False, indent=1)

# ---------- alert: only when the next close brings a trade (or once, when the alert strategy changed) ----------
AX = ['변동성', '급락', '추세', '급팽창']
pv = lambda x: '–' if x is None else f'{x*100:.1f}%'
msgs = []
if prev.get('date') != last and action:
    msgs.append(('**다음 거래일 종가에 QLD를 모두 팔아 SGOV로 옮깁니다.**' if action['type'] == 'exit' else '**다음 거래일 종가에 SGOV를 모두 QLD로 옮깁니다.**')
                + f" 사유: {action['msg'].split(' → ')[0]}")
if prev.get('strategy') != 'final':
    msgs.append(f"알림 기준이 **최종 전략 v1**(기술 4축 + 매크로 경보 이탈)로 바뀌었습니다(2026-10-19 비교: 5개 검증 세트 중 4개에서 노출 조절보다 우세). "
                f"현재 상태: **{NAME[status['regime']]}**. 노출 조절(TQQQ·QQQ·SGOV)로 들고 있었다면 QLD 보유로 맞추는 것을 검토하세요.")
if msgs:
    if prev.get('strategy') != 'final' and not action:
        status['title'] = f"[QLD] {last} 알림 기준 변경: 최종 전략 v1 · {NAME[status['regime']]}"
        json.dump(status, open(P('data', 'status.json'), 'w'), ensure_ascii=False, indent=1)
    lines = [f"- {m}" for m in msgs]
    lines.append(f"\n신호: 기술 {status['votes']}/4축" + (f" ({'·'.join(a for a, on in zip(AX, status['axes']) if on)})" if status['votes'] else '')
                 + f" · 하방 변동성 {pv(status['down20'])} · 상방 {pv(status['up20'])} · 10일 {pv(status['r10'])} · 주봉 RSI {status['rsiw']}"
                 + f" · 10일/60일 변동성 {status['expand']}배 · 매크로 경보 {pv(status['macro'])}")
    lines.append('규칙: 기술 4축 중 2개 이상(복귀 후 40거래일은 3개) 또는 매크로 경보 50% 신규 돌파 → 전량 SGOV. 축 1개 이하 · 20일선 위 · 10일 변동성 < 60일 변동성 → 전량 QLD.')
    lines.append(f"데이터 출처: {', '.join(used)}")
    open(P('alert.md'), 'w').write(f"**{last} 종가 기준**\n\n" + '\n'.join(lines) + '\n')
print(json.dumps(status, ensure_ascii=False))
