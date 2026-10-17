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

# ---------- fallback mirrors first, Yahoo overrides ----------
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
        print('yfinance unavailable:', e, file=sys.stderr); return
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
    got = 0
    for target, ticker, name, scale in [(ndx, '^NDX', 'Close', 1), (qqq, 'QQQ', 'Adj Close', 1),
                                        (fx, 'KRW=X', 'Close', 1), (tb, '^IRX', 'Close', 0.01), (vix, '^VIX', 'Close', 1)]:
        d = col(ticker, name)
        if d:
            got += 1
            # QQQ adjusted prices are rescaled after each dividend: only ratios matter, keep the series self-consistent
            if target is qqq: qqq.clear()
            target.update({k: v * scale for k, v in d.items()})
    if got: used.append(f'yahoo({got}/5)')

mirrors()
yahoo()

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

data = dict(d0=base['d0'], dd=dd, px=px, rq=rq, tb=tbl, fx=fxl, vix=vxl, ms=ms_l, macroNow=macro_now)
data_js = json.dumps(data, separators=(',', ':'))
last = iso(days[-1])
y, m, d_ = last.split('-')
built = dt.datetime.now(KST).strftime('%Y-%m-%d %H:%M KST')
tpl = open(P('src', 'page_tpl.html')).read()
eng = open(P('src', 'engine.js')).read()
assert '</script' not in data_js and '</script' not in eng
page = (tpl.replace('__DATA__', data_js).replace('__ENGINE__', eng)
           .replace('__LASTDATE__', f'{int(y)}년 {int(m)}월 {int(d_)}일').replace('__BUILT__', built))
html = ('<!doctype html><html lang="ko"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
        'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>'
        '</head><body>' + page + '</body></html>')
os.makedirs(P('site'), exist_ok=True)
open(P('site', 'index.html'), 'w').write(html)

# ---------- daily signal: final strategy (and the two references) ----------
RULES = {
    'kelly': ('변동성 계단 (TQQQ·QQQ·SGOV)', "{rule:'kelly'}"),
    'final': ('이전 최종 (기술 + 매크로 이탈)', "{}"),
    'tech': ('기술 4축만', "{useMacro:false}"),
    'vol': ('이전 방어형', "{rule:'vol',peakRatio:0.67}"),
}
js = os.path.join(tempfile.mkdtemp(), 'status.js')
open(js, 'w').write(f"""
const E=require({json.dumps(P('src','engine.js'))});
const D=E.prepData({data_js});
const j=D.n-1; let i0=0; while(isNaN(D.rv[i0])) i0++;
const P=Object.assign({{}},E.DEFAULTS,{{strategy:true}});
const ax=E.axesAt(D,P,j), axp=E.axesAt(D,P,j-1);
const out={{rv20:D.rv[j],down20:D.vols.down20[j],up20:D.vols.up20[j],r10:D.r10[j],rsiw:D.rsiw[j],expand:D.vols.rv10[j]/D.v60[j],
  axes:ax,votes:ax.reduce((a,b)=>a+b,0),votesPrev:axp.reduce((a,b)=>a+b,0),ms:isNaN(D.ms[j])?null:D.ms[j],msPrev:isNaN(D.ms[j-1])?null:D.ms[j-1],
  macroOnset:E.macroOnset(D,P,j),reentry:ax.reduce((a,b)=>a+b,0)<=P.reMaxVotes&&D.px[j]>D.ma[20][j]&&D.vols.rv10[j]<D.v60[j],
  px:D.px[j],ma20:D.ma[20][j],rules:{{}}}};
{{const K=Object.assign({{}},E.DEFAULTS,{{strategy:true,rule:'kelly'}});const R=E.runBT(D,i0,j,K,true);const e=E.targetFrom(D,K,j,R.tgtE),cur=R.expoTot[R.expoTot.length-1];
  const lastEv=R.log.filter(x=>x.type==='down'||x.type==='up').pop()||null;
  out.kelly={{target:e,mix:E.mixOf(e),hold:cur,holdMix:E.mixOf(cur),band:K.band,act:Math.abs(e-cur)>K.band,sigma:D.rv[j],mu:D.mu[j],lastTrade:lastEv?{{d:lastEv.d,msg:lastEv.msg}}:null,contribMix:E.mixOf(R.tgtE)}};}}
""" + ''.join(f"{{const R=E.runBT(D,i0,j,Object.assign({{strategy:true}},{cfg}),false);out.rules[{json.dumps(k)}]={{regime:R.regime}};}}\n" for k, (_, cfg) in RULES.items())
 + "console.log(JSON.stringify(out));\n")
st = subprocess.run(['node', js], capture_output=True, text=True, timeout=600)
if st.returncode != 0:
    print(st.stderr, file=sys.stderr); sys.exit(1)
s = json.loads(st.stdout.strip().splitlines()[-1])
r4 = lambda x: None if x is None else round(x, 4)
K = s['kelly']
r2 = lambda x: None if x is None else round(x, 2)
kelly = dict(target=r2(K['target']), mix=[round(x, 3) for x in K['mix']], hold=r2(K['hold']), holdMix=[round(x, 3) for x in K['holdMix']],
             band=K['band'], act=bool(K['act']), sigma=r4(K['sigma']), mu=r4(K['mu']), contribMix=[round(x, 3) for x in K['contribMix']],
             lastTrade=None if not K['lastTrade'] else dict(date=iso(K['lastTrade']['d']), msg=K['lastTrade']['msg']))
status = dict(date=last, kelly=kelly, regime=s['rules']['final']['regime'], votes=s['votes'], axes=s['axes'],
              down20=r4(s['down20']), up20=r4(s['up20']), r10=r4(s['r10']), rsiw=round(s['rsiw'], 1), expand=round(s['expand'], 2),
              macro=r4(s['ms']), macroOnset=s['macroOnset'], reentryOK=s['reentry'], rv20=r4(s['rv20']),
              ndx=round(s['px'], 2), ma20=round(s['ma20'], 2),
              rules={k: dict(name=RULES[k][0], regime=v['regime']) for k, v in s['rules'].items()},
              macroNow={m['k']: m['z'] for m in macro_now}, macro_ok=macro_ok,
              built=built, sources=used, added_rows=added)

prev = {}
try: prev = json.load(open(P('data', 'status.json')))
except Exception: pass
json.dump(status, open(P('data', 'status.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(status, open(P('site', 'status.json'), 'w'), ensure_ascii=False, indent=1)

# ---------- alert ----------
NAME = {'in': 'QLD 보유', 'out': '이탈 중 (SGOV)', 'staged': '단계 복귀 중'}
mixtxt = lambda m: f"TQQQ {round(m[0]*100)}% · QQQ {round(m[1]*100)}% · SGOV {round(m[2]*100)}%"
AX = ['변동성', '급락', '추세', '급팽창']
pv = lambda x: '–' if x is None else f'{x*100:.1f}%'
msgs = []
if prev.get('date') != last and kelly['act']:
    msgs.append(f"노출 조절: 목표 **{kelly['target']:.2f}배** ({mixtxt(kelly['mix'])})가 규칙상 보유 {kelly['hold']:.2f}배와 조정 폭 {kelly['band']}배 이상 차이 납니다. "
                f"**다음 거래일 종가에 목표 비중으로 맞춥니다.**")
if msgs:
    lines = [f"- {m}" for m in msgs]
    lines.append(f"\n노출 계산: 나스닥100 20일 변동성 {pv(kelly['sigma'])} → 계단표(25% 미만 2.5배 · 35% 미만 2배 · 45% 미만 1배 · 그 이상 0배, 올릴 땐 경계보다 3%p 낮아야) → 목표 {kelly['target']:.2f}배")
    lines.append(f"참고(이전 규칙): 기술 {status['votes']}/4축 · 하방 변동성 {pv(status['down20'])} · 상방 {pv(status['up20'])} · 10일 {pv(status['r10'])} · "
                 f"주봉 RSI {status['rsiw']} · 10일/60일 변동성 {status['expand']}배 · 매크로 경보 {pv(status['macro'])}")
    lines.append('이전 규칙 상태: ' + ' · '.join(f"{v['name']} {NAME[v['regime']]}" for k, v in status['rules'].items() if k != 'kelly'))
    lines.append('실행: 전날 종가로 계산한 목표 비중으로 다음 거래일 종가에 TQQQ·QQQ·SGOV를 맞춥니다. 이전 규칙 상태는 참고용입니다.')
    lines.append(f"데이터 출처: {', '.join(used)}")
    open(P('alert.md'), 'w').write(f"**{last} 종가 기준**\n\n" + '\n'.join(lines) + '\n')
print(json.dumps(status, ensure_ascii=False))
