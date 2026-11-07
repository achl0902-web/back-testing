#!/usr/bin/env node
// T24 (2026-11-07): external-audit checks pre-registered in steps/T24-plan.md (committed before any result).
// Does not change the strategy, the engine, the page or the daily alert. Scored variants go to trials.jsonl as step T24.
//   node lib/t24.js simple                      A: G1 200-day MA, G2 10-month SMA, QQQ DCA (reference) vs v2 / v1 / DCA
//   node lib/t24.js tax                         B: shared-deduction stress (deduction 0, no year-end harvest)
//   node lib/t24.js boot [--n 1000] [--seed 7]  C: T06 block bootstrap with v2 and the simple rules added
//   node lib/t24.js track                       D: synthetic vs actual QLD by calendar year
//   node lib/t24.js lag                         E: macro lag sensitivity (run python3 lib/macro_lag.py B0 S60 C12 SRD first)
// Tables use weekly 1,000,000 KRW (the user's amount); standard scores use weekly 700,000 KRW (comparable with trials.jsonl).
const fs = require('fs'), path = require('path');
const C = require('./core.js'), V2 = require('./v2.js');
const { E, load, sets, episodes, day } = require('./data.js');
const R = path.join(__dirname, '..');
const args = process.argv.slice(2), cmd = args[0], opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };
const iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
const pc = (x, d = 1) => (x * 100).toFixed(d);
const sg = (x, d = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(d);
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const qtl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
const W = 1e6;

// ---------- the two published rules, as exitSig/enterSig arrays by signal day (the engine trades at the next close) ----------
// G1 Gayed & Bilello (2016): index above its 200-day simple moving average -> hold the 2x fund, below -> T-bills. Daily, no band.
function g1(D) {
  const n = D.n, m = D.ma[200], ex = new Uint8Array(n), en = new Uint8Array(n);
  for (let j = 0; j < n; j++) if (!isNaN(m[j])) { ex[j] = D.px[j] < m[j] ? 1 : 0; en[j] = D.px[j] > m[j] ? 1 : 0; }
  return { exitSig: ex, enterSig: en, sigName: '200일선' };
}
// G2 Faber (2007): on the last trading day of a month, close vs the mean of the last 10 month-end closes (this one included).
function g2(D) {
  const n = D.n, ex = new Uint8Array(n), en = new Uint8Array(n), me = [];
  for (let j = 0; j < n - 1; j++) if (D.month[j + 1] !== D.month[j]) {
    me.push(D.px[j]);
    if (me.length >= 10) { let s = 0; for (let k = me.length - 10; k < me.length; k++) s += me[k]; const a = s / 10; ex[j] = D.px[j] < a ? 1 : 0; en[j] = D.px[j] > a ? 1 : 0; }
  }
  return { exitSig: ex, enterSig: en, sigName: '10개월선' };
}
// QQQ (1x) DCA with the same engine tax handling: always "slow" (QQQ), never exits
const qqq = D => ({ strategy: true, rule: 'final', votes: 99, strongVotes: 99, useMacro: false, slowSig: new Uint8Array(D.n).fill(1), slowName: 'QQQ' });

const memo = new Map();
const cached = (D, key, f) => { const k = (D.name || '?') + '|' + key; if (!memo.has(k)) memo.set(k, f(D)); return memo.get(k); };
const ibStd = D => (D.ib || (D.ib = V2.inflBlock(D)));
const STR = [
  ['v2', D => (ibStd(D), { strategy: true, rule: 'final', inflBlock: true })],
  ['v1', () => ({ strategy: true, rule: 'final' })],
  ['G1 200일선', D => Object.assign({ strategy: true }, cached(D, 'g1', g1))],
  ['G2 10개월선', D => Object.assign({ strategy: true }, cached(D, 'g2', g2))],
  ['DCA', () => ({ strategy: false })],
  ['QQQ 적립(참고)', D => cached(D, 'qqq', qqq)],
];
const run = (D, a, b, p, weekly = W, extra = {}) => E.runBT(D, a, b, Object.assign({ weeklyKRW: weekly, initialKRW: 0 }, p, extra), false);
const stats = rs => { const irr = rs.map(r => r.irr); return { med: med(irr), p10: qtl(irr, 0.1), min: Math.min(...irr), mdd: med(rs.map(r => r.mddTwr)), irr }; };

// windows for every start month 1..12 that fit in the data (same as lib/audit.js allStarts)
function allStarts() {
  const { ND, SP } = load();
  const spec = [['N10', ND, 1999, 2016, 10], ['N10oos', ND, 1986, 1998, 10], ['S10', SP, 1986, 2016, 10], ['N5', ND, 1986, 2021, 5], ['S5', SP, 1986, 2021, 5]];
  return spec.map(([key, D, y0, y1, len]) => {
    const w = [];
    for (let m = 1; m <= 12; m++) for (let y = y0; y <= y1; y++) {
      const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
      if (endD > D.day[D.n - 1]) continue; const b = E.idxOfDay(D, endD, false); if (b > a) w.push([a, b]);
    }
    return { key, D, w };
  });
}
// 1928~49 (T23) and 1960~85 (T08) windows: 1st and 7th month starts, ending by `last`
function eraWins(D, y0, y1, len, last) {
  const o = [], L = day(last);
  for (const m of [1, 7]) for (let y = y0; y <= y1; y++) {
    const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
    if (endD > L) continue; const b = E.idxOfDay(D, endD, false); if (b > a) o.push([a, b]);
  }
  return o;
}
const hist = (file, name) => { const D = E.prepData(JSON.parse(fs.readFileSync(path.join(R, 'data', file))), 2, 0.0089); D.name = name; D.ib = V2.inflBlockHist(D); return D; };

// standard score (weekly 700,000, champion v2 as base), logged as T24 like every other scored variant
const CFG = { money: { weekly: 700000 } };
function evaluateP(pf, dsMap = null) {
  const pick = D => (dsMap ? dsMap[D.name] : D);
  const out = { sets: {}, episodes: {}, full: null };
  for (const S of sets(1)) { const D = pick(S.D); out.sets[S.key] = S.w.map(([a, b]) => slim(run(D, a, b, pf(D), 700000))); }
  for (const ep of episodes()) { const D = pick(ep.D); out.episodes[ep.key] = slim(run(D, ep.i0, ep.i1, pf(D), 700000)); }
  const { ND } = load(), D = pick(ND); out.full = slim(run(D, E.idxOfDay(D, day('1999-01-04'), true), D.n - 1, pf(D), 700000));
  return out;
}
const slim = r => ({ irr: r.irr, mdd: r.mddTwr == null ? NaN : r.mddTwr, mddVal: r.mddValue, fin: r.finalAfter, exits: r.exits || 0, tax: r.taxesPaid || 0 });
function score(name, pf, dsMap = null) {
  const s = C.summarize(evaluateP(pf, dsMap), CFG);
  C.logTrial(Object.assign({ step: 'T24', by: 'audit', name }, CFG, { params: { audit: name } }), s);
  return s;
}

// =====================================================================================================================
if (cmd === 'simple') {
  const AS = allStarts(), tab = {};
  console.log('■ A. 표준 5개 세트 · 시작 월 1~12 전부 · 주 100만 · 세후 원화 IRR: 중앙 / 하위10% / 최악 · 시간가중 MDD 중앙');
  for (const S of AS) {
    tab[S.key] = {};
    console.log(`  ${S.key} (구간 ${S.w.length}개)`);
    for (const [nm, pf] of STR) { const p = pf(S.D); const st = stats(S.w.map(([a, b]) => run(S.D, a, b, p))); tab[S.key][nm] = st;
      console.log(`    ${nm.padEnd(12)} ${pc(st.med).padStart(5)} / ${pc(st.p10).padStart(5)} / ${pc(st.min).padStart(6)} · MDD ${pc(st.mdd, 0)}`); }
  }
  // exits since 1999 on the full Nasdaq-100 series, and full-period IRR
  { const { ND, SP } = load();
    for (const D of [ND, SP]) { const a = E.idxOfDay(D, day('1999-01-04'), true);
      console.log(`  ${D.name} 1999-01~끝 매매(이탈) 횟수 · 전체 IRR: ` + STR.map(([nm, pf]) => { const r = run(D, a, D.n - 1, pf(D)); return `${nm} ${r.exits || 0}회 ${pc(r.irr)}%`; }).join(' · ')); } }
  // eras
  const ERA = [['1928~49 S&P 2배 (손대지 않은 시대, T23 틀)', hist('hist_spx1928.json', 'SPX1928'), [[1929, 1940, 10], [1929, 1945, 5]], '1949-12-31'],
    ['1960~85 S&P 2배 (T08 틀, v2 선택에 쓰임: 보고만)', hist('hist_spx.json', 'SPX1960'), [[1961, 1975, 10], [1961, 1980, 5]], '1985-12-31']];
  const era = {};
  for (const [title, D, specs, last] of ERA) {
    console.log(`■ ${title}: IRR 중앙 / 최악 · 시간가중 MDD 중앙 · 매매 중앙`); era[title] = {};
    for (const [y0, y1, len] of specs) {
      const w = eraWins(D, y0, y1, len, last); era[title][len] = {};
      console.log(`  ${len}년 (${y0}~${y1} 시작, 1·7월, 구간 ${w.length}개)`);
      for (const [nm, pf] of STR) { const p = pf(D); const rs = w.map(([a, b]) => run(D, a, b, p)); const st = stats(rs); era[title][len][nm] = st;
        console.log(`    ${nm.padEnd(12)} ${pc(st.med).padStart(5)} / ${pc(st.min).padStart(6)} · MDD ${pc(st.mdd, 0)} · 매매 ${med(rs.map(r => r.exits || 0))}`); }
    }
  }
  // pre-registered judgment (steps/T24-plan.md A)
  console.log('■ 판정 (사전 등록)');
  const E28 = era[ERA[0][0]];
  for (const g of ['G1 200일선', 'G2 10개월선']) {
    const j1 = AS.map(S => { const a = tab[S.key][g], v = tab[S.key].v2; return { k: S.key, ok: a.med >= v.med - 0.01 && a.min >= v.min - 0.02, dm: a.med - v.med, dw: a.min - v.min }; });
    const J1 = j1.every(x => x.ok);
    const j2 = [10, 5].map(len => { const a = E28[len][g], v = E28[len].v1; return { len, ok: a.min >= v.min && a.mdd >= v.mdd, dw: a.min - v.min, dd: a.mdd - v.mdd }; });
    const J2 = j2.every(x => x.ok);
    const verdict = J1 && J2 ? '단순 규칙이 v2와 비열등하고 손대지 않은 시대에서 더 강함: 챔피언 교체 후보(사용자 결정)'
      : J2 ? '1986~에서는 v2가 낫지만(v2는 이 데이터로 고름) 손대지 않은 시대에서는 단순 규칙이 낫다: 교체하지 않고 페이지 참고선 후보'
      : J1 ? '비열등이지만 장기 확인 실패: 기록만' : 'v2 유지';
    console.log(`  ${g}: J1 ${J1 ? '통과' : '실패'} (${j1.map(x => `${x.k} ${sg(x.dm)}/${sg(x.dw)}${x.ok ? '' : '✗'}`).join(' · ')}) · J2 ${J2 ? '통과' : '실패'} (${j2.map(x => `${x.len}년 최악 ${sg(x.dw)} MDD ${sg(x.dd)}${x.ok ? '' : '✗'}`).join(' · ')}) → ${verdict}`);
  }
  // standard scores vs champion v2 (logged)
  console.log('■ 표준 점수 (주 70만, 챔피언 v2 대비; trials.jsonl T24 기록)');
  for (const [nm, pf] of STR.filter(([nm]) => !['v2', 'DCA'].includes(nm))) { const s = score(nm, pf); console.log('  ' + C.printBrief(nm, s)); }
}

// =====================================================================================================================
else if (cmd === 'tax') {
  const STRESS = { deduct: 0, harvest: false };
  console.log('■ B. 세금 가정: 기본(공제 250만·연말 하베스팅) → 공제 0·하베스팅 없음 · 1월 시작 · 주 100만 · IRR 중앙 / 최악 (총 납부 세금 중앙, 만원)');
  const res = {};
  for (const S of sets(1)) {
    res[S.key] = {};
    console.log(`  ${S.key} (구간 ${S.w.length}개)`);
    for (const [nm, pf] of STR.filter(([nm]) => nm !== 'QQQ 적립(참고)')) {
      const p = pf(S.D), out = {};
      for (const [tag, ex] of [['기본', {}], ['공제0', STRESS]]) {
        const rs = S.w.map(([a, b]) => run(S.D, a, b, p, W, ex));
        out[tag] = Object.assign(stats(rs), { tax: med(rs.map(r => (r.taxesPaid || 0) + (r.liqTax || 0))) });
      }
      res[S.key][nm] = out;
      console.log(`    ${nm.padEnd(12)} ${pc(out.기본.med)} / ${pc(out.기본.min)} (${Math.round(out.기본.tax / 1e4)}) → ${pc(out.공제0.med)} / ${pc(out.공제0.min)} (${Math.round(out.공제0.tax / 1e4)})`);
    }
  }
  console.log('■ 판정 (사전 등록): (v2 − 단순 적립) 차이의 변화, 중앙 ±1%p · 최악 ±2%p 이내면 둔감');
  let ok = true;
  for (const S of sets(1)) {
    const v = res[S.key].v2, d = res[S.key].DCA;
    const gm0 = v.기본.med - d.기본.med, gm1 = v.공제0.med - d.공제0.med, gw0 = v.기본.min - d.기본.min, gw1 = v.공제0.min - d.공제0.min;
    const o = Math.abs(gm1 - gm0) <= 0.01 && Math.abs(gw1 - gw0) <= 0.02; ok = ok && o;
    console.log(`  ${S.key}: 중앙 차이 ${sg(gm0)} → ${sg(gm1)} · 최악 차이 ${sg(gw0)} → ${sg(gw1)} ${o ? '' : '✗'}`);
  }
  console.log(`  → ${ok ? '공제 가정에 둔감' : '민감'}`);
}

// =====================================================================================================================
else if (cmd === 'boot') {
  const P0 = Object.assign({}, E.DEFAULTS, { strategy: true });
  const SETS = [['나스닥', 'ndx_ms.json', [2, 0.0095], 'NDX'], ['S&P2배', 'spx_ms.json', [2, 0.0089], 'SPX2']];
  for (const [nm, file, [lev, er], name] of SETS) {
    const raw = JSON.parse(fs.readFileSync(path.join(R, 'data', file))), Ds = E.prepData(raw, lev, er), n = Ds.n; Ds.name = name;
    const onset = new Uint8Array(n); for (let j = 1; j < n; j++) onset[j] = E.macroOnset(Ds, P0, j) ? 1 : 0;
    const ib = V2.inflBlock(Ds);
    // mulberry32, same generator, seed and block length as T06 (lib/robust.js boot)
    let seed = (+opt('--seed', 7)) >>> 0; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const N = +opt('--n', 1000), LEN = 300 + 2520, MB = 63;
    const names = ['v2', 'v1', 'G1 200일선', 'G2 10개월선', 'DCA'], out = Object.fromEntries(names.map(k => [k, []]));
    for (let k = 0; k < N; k++) {
      const idx = []; while (idx.length < LEN) { let s = 1 + Math.floor(rnd() * (n - 2)); do { idx.push(s); s++; } while (s < n && idx.length < LEN && rnd() > 1 / MB); }
      const r2 = { d0: day('2000-01-03'), dd: [], px: [1000], rq: [0], tb: [raw.tb[idx[0]]], fx: [1200], ms: [raw.ms ? raw.ms[idx[0]] : null], vix: null };
      const ex = new Uint8Array(LEN), bl = new Uint8Array(LEN);
      for (let t = 1; t < LEN; t++) { const s = idx[t];
        r2.dd.push(Math.max(1, raw.dd[s - 1])); r2.px.push(r2.px[t - 1] * raw.px[s] / raw.px[s - 1]); r2.rq.push(raw.rq[s]); r2.tb.push(raw.tb[s]);
        r2.fx.push(r2.fx[t - 1] * raw.fx[s] / raw.fx[s - 1]); r2.ms.push(raw.ms ? raw.ms[s] : null); ex[t] = onset[s]; bl[t] = ib[s]; }
      const D2 = E.prepData(r2, lev, er); D2.name = 'boot';
      const base = { strategy: true, weeklyKRW: W, useMacro: false, extraExit: ex };
      out.v2.push(E.runBT(D2, 300, LEN - 1, Object.assign({}, base, { reentryBlock: bl }), false));
      out.v1.push(E.runBT(D2, 300, LEN - 1, base, false));
      out['G1 200일선'].push(E.runBT(D2, 300, LEN - 1, Object.assign({ strategy: true, weeklyKRW: W }, g1(D2)), false));
      out['G2 10개월선'].push(E.runBT(D2, 300, LEN - 1, Object.assign({ strategy: true, weeklyKRW: W }, g2(D2)), false));
      out.DCA.push(E.runBT(D2, 300, LEN - 1, { strategy: false, weeklyKRW: W }, false));
    }
    const f = (arr, key) => [0.05, 0.5, 0.95].map(p => pc(qtl(arr.map(x => x[key]), p))).join(' / ');
    console.log(`\n■ C. ${nm} 10년 경로 ${N}개 (블록 평균 ${MB}일, seed ${opt('--seed', 7)}) · IRR 5/50/95% · MDD 5/50/95% · 단순 적립보다 IRR 낮을 확률 · MDD 더 깊을 확률`);
    for (const k of names) {
      const a = out[k], d = out.DCA;
      const lo = a.filter((x, i) => x.irr < d[i].irr).length / N, dp = a.filter((x, i) => x.mddTwr < d[i].mddTwr).length / N;
      console.log(`  ${k.padEnd(12)} IRR ${f(a, 'irr')} · MDD ${f(a, 'mddTwr')}` + (k === 'DCA' ? '' : ` · ${pc(lo)}% · ${pc(dp)}%`));
    }
    const v2 = out.v2;
    console.log(`  v2 대비: G1이 IRR 낮을 확률 ${pc(out['G1 200일선'].filter((x, i) => x.irr < v2[i].irr).length / N)}% · G2 ${pc(out['G2 10개월선'].filter((x, i) => x.irr < v2[i].irr).length / N)}%`);
  }
}

// =====================================================================================================================
else if (cmd === 'track') {
  const { ND } = load();
  const A = new Float64Array(ND.n).fill(NaN), m = new Map();
  for (const ln of fs.readFileSync(path.join(R, '..', 'data', 'macro', 'Y_QLD.csv'), 'utf8').trim().split('\n').slice(1)) { const [d, v] = ln.split(','); if (isFinite(+v)) m.set(day(d), +v); }
  for (let i = 0; i < ND.n; i++) if (m.has(ND.day[i])) A[i] = m.get(ND.day[i]);
  const first = A.findIndex(v => !isNaN(v)); let last = ND.n - 1; while (isNaN(A[last])) last--;
  const miss = (() => { let c = 0; for (let i = first; i <= last; i++) if (isNaN(A[i])) c++; return c; })();
  console.log(`■ D. 합성 QLD(엔진 lx: 2×QQQ 총수익 − (T-bill+0.5%) − 0.95%) vs 실제 QLD 수정종가 · ${iso(ND.day[first])}~${iso(ND.day[last])} · 실제 값 없는 날 ${miss}일`);
  console.log('  연도 · 실제 · 합성 · 차이(합성−실제, %p) · 그해 평균 T-bill');
  let worst = 0, worstY = null; const rows = [];
  for (let y = ND.year[first]; y <= ND.year[last]; y++) {
    let a = -1, b = -1; for (let i = first; i <= last; i++) if (ND.year[i] === y && !isNaN(A[i])) { if (a < 0) a = i; b = i; }
    if (a < 0) continue; const s = a > first ? a - 1 : a; // base = previous year's last close (first year: inception)
    const act = A[b] / A[s] - 1, syn = ND.lx[b] / ND.lx[s] - 1; let tb = 0, c = 0; for (let i = a; i <= b; i++) { tb += ND.tb[i]; c++; }
    rows.push([y, act, syn]); if (Math.abs(syn - act) > Math.abs(worst)) { worst = syn - act; worstY = y; }
    console.log(`  ${y} · ${pc(act).padStart(6)}% · ${pc(syn).padStart(6)}% · ${sg(syn - act, 2).padStart(6)} · ${pc(tb / c, 2)}%${y === ND.year[first] ? ' (상장 연도)' : ''}${y === ND.year[last] ? ' (연중)' : ''}`);
  }
  const yrs = (ND.day[last] - ND.day[first]) / 365.25, ca = Math.pow(A[last] / A[first], 1 / yrs) - 1, cs = Math.pow(ND.lx[last] / ND.lx[first], 1 / yrs) - 1;
  const hi = rows.filter(([y]) => y <= 2007 || y >= 2023), hiD = hi.reduce((s, [, a, b]) => s + (b - a), 0) / hi.length;
  const ok = Math.abs(cs - ca) <= 0.005 && Math.abs(worst) <= 0.03;
  console.log(`  연율: 실제 ${pc(ca, 2)}% · 합성 ${pc(cs, 2)}% · 차이 ${sg(cs - ca, 2)}%p · 최대 연도 차이 ${sg(worst, 2)}%p (${worstY}) · 고금리기(2006~07, 2023~) 평균 차이 ${sg(hiD, 2)}%p`);
  console.log(`  판정 (사전 등록: 연율 ±0.5%p, 연도 ±3%p): ${ok ? '합성 적합' : '편향 있음'}`);
}

// =====================================================================================================================
else if (cmd === 'lag') {
  const { ND, SP } = load();
  const mk = (D, a) => { const X = Object.assign({}, D, { ms: Float64Array.from(a, x => x == null ? NaN : x) }); X.ib = ibStd(D); return X; };
  const V2P = () => ({ strategy: true, rule: 'final', inflBlock: true }), res = {};
  console.log('■ E. 매크로 발표 시차 민감도 (주 70만 표준 점수, 챔피언 v2 대비; 같은 파일로 다시 계산한 B0와 비교)');
  for (const v of ['B0', 'S60', 'C12', 'SRD']) {
    const f = path.join(R, 'data', 'variants', `T24_${v}.json`); if (!fs.existsSync(f)) { console.log(`  ${v}: ${f} 없음 (python3 lib/macro_lag.py B0 S60 C12 SRD)`); continue; }
    const ms = JSON.parse(fs.readFileSync(f)), dsMap = { NDX: mk(ND, ms.NDX), SPX2: mk(SP, ms.SPX2) };
    res[v] = { ds: dsMap, s: score(`v2 매크로 ${{ B0: '같은 시차(재계산)', S60: '삼의 법칙 시차 60일', C12: '실업수당 시차 12일', SRD: '삼의 법칙 BLS 발표일' }[v]}`, V2P, dsMap) };
  }
  if (res.B0) for (const v of ['B0', 'S60', 'C12', 'SRD']) { if (!res[v]) continue;
    let diff = 0; for (const nm of ['NDX', 'SPX2']) { const a = res.B0.ds[nm].ms, b = res[v].ds[nm].ms; for (let j = 0; j < a.length; j++) if (!(isNaN(a[j]) && isNaN(b[j])) && !(Math.abs(a[j] - b[j]) <= 1e-9)) diff++; }
    const d = res[v].s.overall.score - res.B0.s.overall.score;
    console.log(`  ${{ B0: 'B0 같은 시차', S60: '삼의 법칙 36→60일', C12: '실업수당 5→12일', SRD: '삼의 법칙 BLS 발표일(E2)' }[v]}: 점수 ${res[v].s.overall.score.toFixed(2)}` + (v === 'B0' ? ' (저장된 경보 비율 대비)' : ` · B0와 경보 비율이 다른 날 ${diff}일 · Δ점수 ${d >= 0 ? '+' : ''}${d.toFixed(2)} → ${Math.abs(d) < 0.3 ? '영향 미미' : '영향 있음'}`));
    console.log('    ' + C.printBrief(v, res[v].s)); }
}
else console.log('usage: node lib/t24.js simple | tax | boot [--n 1000] [--seed 7] | track | lag');
