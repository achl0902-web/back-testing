#!/usr/bin/env node
// Robustness checks for the champion (T06): walk-forward, block bootstrap, execution delay. Does not change the strategy.
//   node lib/robust.js wf      walk-forward over the 27-point threshold grid (train: windows ending by 2010, test: starting 2011+)
//   node lib/robust.js boot [--n 1000] [--seed 7]   stationary block bootstrap of daily data (mean block 63 days), 10-year paths
//   node lib/robust.js sanity  checks that "macro onset as extraExit, useMacro off" reproduces the champion on real data
// Weekly 1,000,000 KRW, engine defaults otherwise. Execution delay is run with score.js (see steps/T06-plan.md).
const fs = require('fs'), path = require('path');
const { E, load, day } = require('./data.js');
const R = path.join(__dirname, '..');
const args = process.argv.slice(2), cmd = args[0], opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };
const W = 1e6, med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
const pc = x => (x * 100).toFixed(1);

// windows of `len` years starting on the first trading day of month m in years y0..y1, kept only if they end on or before `lim`
function wins(D, y0, y1, m, len, lim) {
  const out = [], L = day(lim);
  for (let y = y0; y <= y1; y++) {
    const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true);
    const endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
    if (endD > L) continue;
    const b = E.idxOfDay(D, endD, false); if (b > a && b < D.n) out.push([a, b]);
  }
  return out;
}
function groups(phase) {
  const { ND, SP } = load(), G = [];
  for (const [nm, D] of [['나스닥', ND], ['S&P2배', SP]]) for (const len of [5, 10]) {
    let w;
    if (phase === 'train') w = [...wins(D, 1986, 2010, 1, len, '2010-12-31'), ...wins(D, 1986, 2010, 7, len, '2010-12-31')];
    else w = [...wins(D, 2011, 2021, 1, len, D === ND ? '2026-10-16' : '2026-10-16'), ...wins(D, 2011, 2021, 7, len, '2026-10-16')];
    G.push({ name: `${nm} ${len}년`, D, w });
  }
  return G;
}
function evalCfg(p, G) {
  return G.map(g => { const r = g.w.map(([a, b]) => E.runBT(g.D, a, b, Object.assign({ weeklyKRW: W }, p), false));
    const irr = r.map(x => x.irr); return { name: g.name, n: r.length, med: med(irr), min: Math.min(...irr), mdd: med(r.map(x => x.mddTwr)), sc: med(irr) + 0.5 * Math.min(...irr) }; });
}
const avgSc = g => g.reduce((t, x) => t + x.sc, 0) / g.length;

if (cmd === 'wf') {
  const GT = groups('train'), GS = groups('test');
  console.log('학습 구간 수: ' + GT.map(g => `${g.name} ${g.w.length}`).join(' · ') + ' | 시험 구간 수: ' + GS.map(g => `${g.name} ${g.w.length}`).join(' · '));
  const grid = []; for (const dnHi of [0.25, 0.3, 0.35]) for (const rsiW of [40, 45, 50]) for (const expand of [1.4, 1.6, 1.8]) grid.push({ strategy: true, dnHi, rsiW, expand });
  const res = grid.map(p => ({ p, tr: evalCfg(p, GT), te: evalCfg(p, GS) }));
  res.forEach(r => { r.trS = avgSc(r.tr); r.teS = avgSc(r.te); });
  const byTr = [...res].sort((a, b) => b.trS - a.trS), byTe = [...res].sort((a, b) => b.teS - a.teS);
  const isCh = r => r.p.dnHi === 0.3 && r.p.rsiW === 45 && r.p.expand === 1.6, champ = res.find(isCh), best = byTr[0];
  const dca = { tr: evalCfg({ strategy: false }, GT), te: evalCfg({ strategy: false }, GS) }; dca.trS = avgSc(dca.tr); dca.teS = avgSc(dca.te);
  const key = p => `하방${p.dnHi}·RSI${p.rsiW}·급팽창${p.expand}`;
  console.log(`\n학습 최고: ${key(best.p)} (점수 ${pc(best.trS)}) · 챔피언 학습 순위 ${byTr.indexOf(champ) + 1}/27 (점수 ${pc(champ.trS)}) · 단순 적립 ${pc(dca.trS)}`);
  console.log('학습 상위 5: ' + byTr.slice(0, 5).map(r => `${key(r.p)} ${pc(r.trS)}`).join(' | '));
  console.log(`\n시험(2011~) 그룹 점수 평균: 학습 최고 ${pc(best.teS)} · 챔피언 ${pc(champ.teS)} · 단순 적립 ${pc(dca.teS)} · 챔피언 시험 순위 ${byTe.indexOf(champ) + 1}/27 · 시험 최고 ${key(byTe[0].p)} ${pc(byTe[0].teS)}`);
  const line = (nm, g) => `${nm.padEnd(6)} ` + g.map(x => `${x.name} ${pc(x.med)}/${pc(x.min)}/MDD${pc(x.mdd)}`).join(' · ');
  console.log('시험 IRR 중앙/최악/MDD중앙:'); console.log(line('학습최고', best.te)); console.log(line('챔피언', champ.te)); console.log(line('단순적립', dca.te));
  console.log('학습 IRR 중앙/최악:'); console.log(line('챔피언', champ.tr)); console.log(line('단순적립', dca.tr));
  // rank correlation between train and test scores across the grid (does in-sample ranking carry over?)
  const rk = a => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), o = new Array(a.length); s.forEach(([, i], k) => { o[i] = k; }); return o; };
  const ra = rk(res.map(r => r.trS)), rb = rk(res.map(r => r.teS)), n = res.length;
  const rho = 1 - 6 * ra.reduce((t, v, i) => t + (v - rb[i]) ** 2, 0) / (n * (n * n - 1));
  console.log(`\n학습↔시험 순위 상관(스피어만) ${rho.toFixed(2)} · 시험에서 단순 적립보다 점수 높은 설정 ${res.filter(r => r.teS > dca.teS).length}/27`);
}

else if (cmd === 'sanity' || cmd === 'boot') {
  const P0 = Object.assign({}, E.DEFAULTS, { strategy: true });
  const SETS = [['나스닥', 'ndx_ms.json', [2, 0.0095]], ['S&P2배', 'spx_ms.json', [2, 0.0089]]];
  for (const [nm, file, [lev, er]] of SETS) {
    const raw = JSON.parse(fs.readFileSync(path.join(R, 'data', file))), Ds = E.prepData(raw, lev, er), n = Ds.n;
    const onset = new Uint8Array(n); for (let j = 1; j < n; j++) onset[j] = E.macroOnset(Ds, P0, j) ? 1 : 0;
    if (cmd === 'sanity') {
      let i0 = 0; while (isNaN(Ds.rv[i0])) i0++;
      const a = E.runBT(Ds, i0, n - 1, { strategy: true, weeklyKRW: W }, false), b = E.runBT(Ds, i0, n - 1, { strategy: true, weeklyKRW: W, useMacro: false, extraExit: onset }, false);
      console.log(`${nm}: 챔피언 ${a.finalAfter.toFixed(0)} 이탈 ${a.exits} · 대체 ${b.finalAfter.toFixed(0)} 이탈 ${b.exits} → ${Math.abs(a.finalAfter / b.finalAfter - 1) < 1e-9 && a.exits === b.exits ? '동일' : '다름'}`);
      continue;
    }
    // mulberry32 (the LCG used for placebo shifts repeats paths here: successive draws are correlated)
    let seed = (+opt('--seed', 7)) >>> 0; const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const N = +opt('--n', 1000), LEN = 300 + 2520, MB = 63;
    const out = { s: [], d: [] };
    for (let k = 0; k < N; k++) {
      const idx = []; while (idx.length < LEN) { let s = 1 + Math.floor(rnd() * (n - 2)); do { idx.push(s); s++; } while (s < n && idx.length < LEN && rnd() > 1 / MB); }
      const r2 = { d0: day('2000-01-03'), dd: [], px: [1000], rq: [0], tb: [raw.tb[idx[0]]], fx: [1200], ms: [raw.ms ? raw.ms[idx[0]] : null], vix: null };
      const ex = new Uint8Array(LEN);
      for (let t = 1; t < LEN; t++) { const s = idx[t];
        r2.dd.push(Math.max(1, raw.dd[s - 1])); r2.px.push(r2.px[t - 1] * raw.px[s] / raw.px[s - 1]); r2.rq.push(raw.rq[s]); r2.tb.push(raw.tb[s]);
        r2.fx.push(r2.fx[t - 1] * raw.fx[s] / raw.fx[s - 1]); r2.ms.push(raw.ms ? raw.ms[s] : null); ex[t] = onset[s]; }
      const D2 = E.prepData(r2, lev, er);
      const a = E.runBT(D2, 300, LEN - 1, { strategy: true, weeklyKRW: W, useMacro: false, extraExit: ex }, false), b = E.runBT(D2, 300, LEN - 1, { strategy: false, weeklyKRW: W }, false);
      out.s.push(a); out.d.push(b);
    }
    const uniq = new Set(out.d.map(x => x.irr.toFixed(8))).size;
    const f = (arr, key) => [0.05, 0.25, 0.5, 0.75, 0.95].map(p => pc(q(arr.map(x => x[key]), p))).join(' / ');
    const worse = out.s.filter((x, i) => x.irr < out.d[i].irr).length / N, mddW = out.s.filter((x, i) => x.mddTwr < out.d[i].mddTwr).length / N;
    const gap = out.s.map((x, i) => x.irr - out.d[i].irr);
    console.log(`\n${nm} 10년 경로 ${N}개 (블록 평균 ${MB}일) · 분위 5/25/50/75/95%`);
    console.log(`  IRR  챔피언 ${f(out.s, 'irr')} · 단순 적립 ${f(out.d, 'irr')}`);
    console.log(`  MDD  챔피언 ${f(out.s, 'mddTwr')} · 단순 적립 ${f(out.d, 'mddTwr')}`);
    console.log(`  IRR 차이(챔피언−단순) ${[0.05, 0.25, 0.5, 0.75, 0.95].map(p => pc(q(gap, p))).join(' / ')} · 단순 적립보다 IRR 낮을 확률 ${pc(worse)}% · MDD가 더 깊을 확률 ${pc(mddW)}% · 평균 이탈 ${(out.s.reduce((t, x) => t + x.exits, 0) / N).toFixed(1)}회 · 서로 다른 경로 ${uniq}개`);
  }
}
else console.log('usage: node lib/robust.js wf | boot [--n 1000] | sanity');
