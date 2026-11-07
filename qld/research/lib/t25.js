#!/usr/bin/env node
// T25 (2026-11-07): the research's 7 hybrid candidates (H1~H7) vs the champion, pre-registered in steps/T25-plan.md
// (committed before any result). Does not change the strategy, the engine, the page or the daily alert.
//   node lib/t25.js sanity                     v2r (replica) vs v2 engine; H3e (engine final path) vs H3 (replica)
//   node lib/t25.js main --part tech|full      9 groups x controls + H1~H7 -> data/T25_<part>.json (+ trials.jsonl)
//   node lib/t25.js judge                      pre-registered gates, maximin, weight robustness from both parts
//   node lib/t25.js nbr <H#>                   neighbour grid of the top candidate (tech mode)
//   node lib/t25.js sealed <H#>                sealed 1950~59 check (run once)
//   node lib/t25.js boot <H#> [--n 500]        block bootstrap, mean block 63/252/504 days (report only)
//   node lib/t25.js dsr <H#>                   deflated Sharpe and CSCV-PBO of H1~H7 + v2 (report only)
//   node lib/t25.js events <H#>                trades by episode, 1928~49 exits with the upside-volatility axis
// Tables: weekly 1,000,000 KRW, after-tax KRW IRR, every start month 1~12. Standard scores (trials.jsonl): weekly 700,000.
const fs = require('fs'), path = require('path');
const C = require('./core.js'), V2 = require('./v2.js'), L = require('../candidates/S09_lib.js');
const { E, load, sets, episodes, day } = require('./data.js');
const R = path.join(__dirname, '..');
const args = process.argv.slice(2), cmd = args[0], opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };
const iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
const pc = (x, d = 1) => (x * 100).toFixed(d), sg = (x, d = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(d);
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const qtl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
const W = 1e6, P0 = E.DEFAULTS, HOLD = 39;

// ---------- data ----------
const hist = (file, name) => { const D = E.prepData(JSON.parse(fs.readFileSync(path.join(R, 'data', file))), 2, 0.0089); D.name = name; D.ib = V2.inflBlockHist(D); return D; };
let _ds = null;
function datasets() {
  if (_ds) return _ds;
  const { ND, SP } = load(); if (!ND.ib) ND.ib = V2.inflBlock(ND); if (!SP.ib) SP.ib = V2.inflBlock(SP);
  return (_ds = { ND, SP, H60: hist('hist_spx.json', 'SPX1960'), H28: hist('hist_spx1928.json', 'SPX1928') });
}
function winsAll(D, y0, y1, len, lastISO) {
  const w = [], last = lastISO ? day(lastISO) : D.day[D.n - 1];
  for (let m = 1; m <= 12; m++) for (let y = y0; y <= y1; y++) {
    const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
    if (endD > last || endD > D.day[D.n - 1]) continue; const b = E.idxOfDay(D, endD, false); if (b > a) w.push([a, b]);
  }
  return w;
}
function groups() {
  const { ND, SP, H60, H28 } = datasets();
  return [['N10', ND, 1999, 2016, 10], ['N10oos', ND, 1986, 1998, 10], ['N5', ND, 1986, 2021, 5], ['S10', SP, 1986, 2016, 10], ['S5', SP, 1986, 2021, 5],
    ['H60-10', H60, 1961, 1975, 10, '1985-12-31'], ['H60-5', H60, 1961, 1980, 5, '1985-12-31'], ['H28-10', H28, 1929, 1940, 10, '1949-12-31'], ['H28-5', H28, 1929, 1945, 5, '1949-12-31']]
    .map(([key, D, y0, y1, len, last]) => ({ key, D, w: winsAll(D, y0, y1, len, last) }));
}

// ---------- signals ----------
const memo = new Map();
const cache = (D, key, f) => { const k = D.name + '|' + key; if (!memo.has(k)) memo.set(k, f()); return memo.get(k); };
function sma(D, n) { return cache(D, 'sma' + n, () => { const o = new Float64Array(D.n).fill(NaN); let s = 0; for (let i = 0; i < D.n; i++) { s += D.px[i]; if (i >= n) s -= D.px[i - n]; if (i >= n - 1) o[i] = s / n; } return o; }); }
const above = (D, n = 200, b = 0) => cache(D, `ab${n}_${b}`, () => { const m = sma(D, n), o = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) o[j] = !isNaN(m[j]) && D.px[j] > m[j] * (1 + b) ? 1 : 0; return o; });
const below = (D, n = 200, b = 0) => cache(D, `be${n}_${b}`, () => { const m = sma(D, n), o = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) o[j] = !isNaN(m[j]) && D.px[j] < m[j] * (1 - b) ? 1 : 0; return o; });
// replica options by mode: full = the champion's own macro onset and inflation block; tech = both off
const baseOf = (D, mode) => ({ win: new Uint8Array(D.n), ib: mode === 'full' ? D.ib : new Uint8Array(D.n) });
const repl = (D, mode, o = {}) => L.run(D, Object.assign({ base: baseOf(D, mode) }, mode === 'tech' ? { macro: () => false } : {}, o));
const sigP = s => ({ strategy: true, exitSig: s.exitSig, enterSig: s.enterSig });
const nExitsSig = s => { let c = 0; for (let j = 1; j < s.exitSig.length; j++) if (s.exitSig[j] && !s.exitSig[j - 1]) c++; return c; };

// G1 Gayed & Bilello (2016) and G2 Faber (2007), as in T24
function g1(D) { const n = D.n, m = D.ma[200], ex = new Uint8Array(n), en = new Uint8Array(n); for (let j = 0; j < n; j++) if (!isNaN(m[j])) { ex[j] = D.px[j] < m[j] ? 1 : 0; en[j] = D.px[j] > m[j] ? 1 : 0; } return { exitSig: ex, enterSig: en }; }
function g2(D) { const n = D.n, ex = new Uint8Array(n), en = new Uint8Array(n), me = []; for (let j = 0; j < n - 1; j++) if (D.month[j + 1] !== D.month[j]) { me.push(D.px[j]); if (me.length >= 10) { let s = 0; for (let k = me.length - 10; k < me.length; k++) s += me[k]; const a = s / 10; ex[j] = D.px[j] < a ? 1 : 0; en[j] = D.px[j] > a ? 1 : 0; } } return { exitSig: ex, enterSig: en }; }

// H1~H4 on the champion replica (S09_lib hooks). n = moving-average length, b = band
const H = {
  H1: (D, mode, n = 200, b = 0) => { const ab = above(D, n, b); return repl(D, mode, { enterOk: j => !!ab[j] }); },
  H2: (D, mode, n = 200, b = 0) => { const ab = above(D, n, b); return repl(D, mode, { exitVotes: (j, need) => ab[j] ? 3 : need }); },
  H3: (D, mode, n = 200, b = 0) => { const ab = above(D, n, b); return repl(D, mode, { exitVotes: (j, need) => ab[j] ? 3 : need, enterOk: j => !!ab[j] }); },
  H4: (D, mode, n = 200, b = 0.01) => { const ab = above(D, n, b), be = below(D, n, b); return repl(D, mode, { extraExit: j => !!be[j], enterOk: j => !!ab[j] }); },
};
// H5 time-series momentum 1/3/12 months (21/63/252 trading days), total return minus T-bill, QLD target = votes/3
function h5Target(D, mult = 1) {
  return cache(D, 'h5_' + mult, () => {
    const ks = [21, 63, 252].map(k => Math.round(k * mult)), TB = new Float64Array(D.n), t = new Float64Array(D.n).fill(1); TB[0] = 1;
    for (let i = 1; i < D.n; i++) TB[i] = TB[i - 1] * (1 + D.tb[i] / 252);
    for (let j = Math.max(...ks); j < D.n; j++) { let v = 0; for (const k of ks) if (D.ix[j] / D.ix[j - k] - TB[j] / TB[j - k] > 0) v++; t[j] = v / 3; }
    return t; // before the longest look-back exists the target stays 1 (invested), fixed before results
  });
}
// H6 partial exit: v2 exit -> half (above) or all (below); half -> all once below; re-entry = H1 rule. Same state machine as S09_lib.
function h6Target(D, mode, frac = 0.5, n = 200, b = 0) {
  return cache(D, `h6_${mode}_${frac}_${n}_${b}`, () => {
    const ab = above(D, n, b), be = below(D, n, b), ib = mode === 'full' ? D.ib : null, t = new Float64Array(D.n).fill(1);
    let st = 0, inSince = -1e9;
    for (let j = 1; j < D.n; j++) {
      const a = L.axes(D, j), macro = mode === 'full' && E.macroOnset(D, P0, j) && !(j - inSince <= HOLD);
      if (st === 0) { const need = (j - inSince <= HOLD) ? 3 : 2; if (a >= need || macro) st = be[j] ? 2 : 1; }
      else {
        if (st === 1 && be[j]) st = 2;
        let ok = a <= 1 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] && !!ab[j];
        if (ok && ib && ib[j]) ok = false;
        if (ok) { st = 0; inSince = j; }
      }
      t[j] = st === 0 ? 1 : st === 1 ? 1 - frac : 0;
    }
    return t;
  });
}
const tgtP = t => ({ strategy: true, rule: 'final', votes: 99, strongVotes: 99, useMacro: false, inflBlock: false, qldTarget: t });
const nExitsTgt = t => { let c = 0; for (let j = 1; j < t.length; j++) if (t[j] < t[j - 1]) c++; return c; };
// engine final path that follows a replica's out-state (exact), so engine-only options (contribOut) can be used
const follow = (s, extra = {}) => Object.assign({ strategy: true, rule: 'final', votes: 99, strongVotes: 99, hold: 0, useMacro: false, inflBlock: false, extraExit: s.exitSig, reentryBlock: s.exitSig }, extra);

// strategy table: name -> (D, mode) => { p: engine params, exits: signal-level exit count or null }
function strategies(mode) {
  const S = {
    'DCA': () => ({ p: { strategy: false } }),
    'v2(엔진)': () => ({ p: mode === 'full' ? { strategy: true, rule: 'final', inflBlock: true } : { strategy: true, rule: 'final', useMacro: false } }),
    'v2r': D => { const s = cache(D, 'v2r' + mode, () => repl(D, mode)); return { p: sigP(s), x: s }; },
    'G1 200일선': D => { const s = cache(D, 'g1', () => g1(D)); return { p: sigP(s), x: s }; },
    'G2 10개월선': D => { const s = cache(D, 'g2', () => g2(D)); return { p: sigP(s), x: s }; },
  };
  for (const h of ['H1', 'H2', 'H3', 'H4']) S[h] = D => { const s = cache(D, h + mode, () => H[h](D, mode)); return { p: sigP(s), x: s }; };
  S.H5 = D => { const t = h5Target(D); return { p: tgtP(t), t }; };
  S.H6 = D => { const t = h6Target(D, mode); return { p: tgtP(t), t }; };
  S.H7 = D => { const s = cache(D, 'H3' + mode, () => H.H3(D, mode)); return { p: follow(s, { contribOut: 1 }), x: s }; };
  return S;
}
const run = (D, a, b, p, weekly = W) => E.runBT(D, a, b, Object.assign({ weeklyKRW: weekly, initialKRW: 0 }, p), false);
function evalGroups(build, G) {
  const out = {};
  for (const g of G) {
    const b = build(g.D), rs = g.w.map(([a, c]) => run(g.D, a, c, b.p)), irr = rs.map(r => r.irr);
    // trades: exits counted inside each window (regime exits for binary rules, target cuts for target rules), median
    const ex = g.w.map(([a, c], k) => { if (b.t) { let n = 0; for (let j = a; j < c; j++) if (b.t[j] < (j > a ? b.t[j - 1] : 1)) n++; return n; } return rs[k].exits || 0; });
    out[g.key] = { med: med(irr), min: Math.min(...irr), p10: qtl(irr, 0.1), mdd: med(rs.map(r => r.mddTwr)), trades: med(ex), n: irr.length };
  }
  return out;
}

// =====================================================================================================================
if (cmd === 'sanity') {
  const { ND, SP } = datasets(), G = groups().filter(g => ['N10', 'N5', 'S5', 'H28-10'].includes(g.key));
  for (const mode of ['full', 'tech']) {
    const S = strategies(mode);
    for (const g of G) {
      const D = g.D, eng = S['v2(엔진)'](D).p, rp = S.v2r(D).p, h3 = S.H3(D).p, h3e = follow(cache(D, 'H3' + mode, () => H.H3(D, mode)));
      let d1 = 0, d2 = 0, same1 = 0;
      for (const [a, b] of g.w) { const x = run(D, a, b, eng).irr, y = run(D, a, b, rp).irr; d1 = Math.max(d1, Math.abs(x - y)); if (Math.abs(x - y) < 1e-9) same1++;
        d2 = Math.max(d2, Math.abs(run(D, a, b, h3).irr - run(D, a, b, h3e).irr)); }
      console.log(`${mode} ${g.key}: v2r vs 엔진 v2 최대 |ΔIRR| ${pc(d1, 2)}%p (같은 구간 ${same1}/${g.w.length}) · H3e vs H3 최대 |ΔIRR| ${pc(d2, 4)}%p`);
    }
  }
}

// =====================================================================================================================
else if (cmd === 'main') {
  const part = opt('--part', 'tech'), S = strategies(part), G = groups(), res = { part, groups: G.map(g => ({ key: g.key, n: g.w.length })), s: {} };
  for (const [nm, build] of Object.entries(S)) {
    if (part === 'full' && ['DCA', 'G1 200일선', 'G2 10개월선', 'H5'].includes(nm)) continue; // identical in both modes: computed in the tech part
    const t0 = Date.now(); res.s[nm] = evalGroups(build, G);
    // signal-level exits on the full Nasdaq series since 1999 (binary: out-state starts; targets: cuts)
    const { ND } = datasets(), b = build(ND), j0 = E.idxOfDay(ND, day('1999-01-04'), true);
    res.s[nm]._exits1999 = b.x ? (() => { let c = 0; for (let j = j0 + 1; j < ND.n; j++) if (b.x.exitSig[j] && !b.x.exitSig[j - 1]) c++; return c; })() : b.t ? (() => { let c = 0; for (let j = j0 + 1; j < ND.n; j++) if (b.t[j] < b.t[j - 1]) c++; return c; })() : (run(ND, j0, ND.n - 1, b.p).exits || 0);
    console.error(`${part} ${nm} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  fs.writeFileSync(path.join(R, 'data', `T25_${part}.json`), JSON.stringify(res));
  // standard scores (weekly 700,000 vs champion v2) for the registry, candidates only
  const CFG = { money: { weekly: 700000 } };
  for (const nm of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']) {
    if (part === 'full' && nm === 'H5') continue;
    const pf = D => S[nm](D).p, ev = { sets: {}, episodes: {}, full: null };
    const slim = r => ({ irr: r.irr, mdd: r.mddTwr, mddVal: r.mddValue, fin: r.finalAfter, exits: r.exits || 0, tax: r.taxesPaid || 0 });
    for (const st of sets(1)) ev.sets[st.key] = st.w.map(([a, b]) => slim(run(st.D, a, b, pf(st.D), 700000)));
    for (const ep of episodes()) ev.episodes[ep.key] = slim(run(ep.D, ep.i0, ep.i1, pf(ep.D), 700000));
    const { ND } = datasets(); ev.full = slim(run(ND, E.idxOfDay(ND, day('1999-01-04'), true), ND.n - 1, pf(ND), 700000));
    const s = C.summarize(ev, CFG); C.logTrial(Object.assign({ step: 'T25', by: 'research', name: `${nm} (${part === 'tech' ? '기술' : '전체'} 모드)` }, CFG, { params: { t25: nm, mode: part } }), s);
    console.log('  ' + C.printBrief(`${nm} ${part}`, s));
  }
}

// =====================================================================================================================
else if (cmd === 'judge') {
  const T = JSON.parse(fs.readFileSync(path.join(R, 'data', 'T25_tech.json'))), F = JSON.parse(fs.readFileSync(path.join(R, 'data', 'T25_full.json')));
  for (const nm of ['DCA', 'G1 200일선', 'G2 10개월선', 'H5']) F.s[nm] = T.s[nm];
  const GK = T.groups.map(g => g.key), CAND = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'];
  const score = (X, nm, w = 0.5) => { const d = X.s.DCA, s = X.s[nm]; const per = GK.map(k => 100 * ((s[k].med - d[k].med) + w * (s[k].min - d[k].min))); return { per, mm: Math.min(...per), arg: GK[per.indexOf(Math.min(...per))] }; };
  const gates = (X, nm) => { const d = X.s.DCA, s = X.s[nm], v = X.s.v2r;
    const A = GK.filter(k => s[k].min < d[k].min - 1e-12), B = ['N10', 'N10oos', 'N5'].filter(k => s[k].min < v[k].min - 0.01 - 1e-12); return { A, B }; };
  const out = {};
  for (const [mode, X] of [['tech', T], ['full', F]]) {
    console.log(`\n■ ${mode === 'tech' ? '기술 모드 (주 평가)' : '전체 모드 (확인)'} · 그룹별 IRR 중앙 / 최악 (시간가중 MDD 중앙) · 구간 수 ${T.groups.map(g => `${g.key} ${g.n}`).join(' · ')}`);
    const rows = Object.keys(X.s);
    console.log('  ' + ['전략'.padEnd(11), ...GK.map(k => k.padStart(17))].join(''));
    for (const nm of rows) console.log('  ' + nm.padEnd(11) + GK.map(k => { const s = X.s[nm][k]; return `${pc(s.med)}/${pc(s.min)}(${pc(s.mdd, 0)})`.padStart(17); }).join(''));
    console.log(`  그룹 점수 S_g = Δ중앙 + 0.5·Δ최악 (DCA 대비, %p) · maximin · 관문 A(최악 ≥ DCA) · 관문 B(나스닥 최악 ≥ v2r − 1%p) · 1999~ 나스닥 이탈`);
    out[mode] = {};
    for (const nm of rows.filter(r => r !== 'DCA')) {
      const sc = score(X, nm), g = gates(X, nm); out[mode][nm] = { sc, g, w25: score(X, nm, 0.25).mm, w100: score(X, nm, 1).mm };
      console.log(`  ${nm.padEnd(11)} ${sc.per.map(x => (x >= 0 ? '+' : '') + x.toFixed(1)).join(' ')} | maximin ${(sc.mm >= 0 ? '+' : '') + sc.mm.toFixed(2)} (${sc.arg}) | A ${g.A.length ? '✗ ' + g.A.join(',') : '통과'} | B ${g.B.length ? '✗ ' + g.B.join(',') : '통과'} | 이탈 ${X.s[nm]._exits1999}`);
    }
  }
  // pre-registered decision (steps/T25-plan.md)
  const bar = m => Math.max(out[m].v2r.sc.mm, out[m]['G1 200일선'].sc.mm);
  const passT = CAND.filter(h => !out.tech[h].g.A.length && !out.tech[h].g.B.length);
  const passBar = passT.filter(h => out.tech[h].sc.mm > bar('tech'));
  const top = w => passT.slice().sort((a, b) => (w === 0.5 ? out.tech[b].sc.mm - out.tech[a].sc.mm : w === 0.25 ? out.tech[b].w25 - out.tech[a].w25 : out.tech[b].w100 - out.tech[a].w100))[0] || null;
  console.log(`\n■ 판정 (사전 등록)`);
  console.log(`  기술 모드 기준선: v2r maximin ${out.tech.v2r.sc.mm.toFixed(2)} · G1 ${out.tech['G1 200일선'].sc.mm.toFixed(2)} → 넘어야 할 값 ${bar('tech').toFixed(2)}`);
  console.log(`  관문 A·B 통과 후보: ${passT.join(', ') || '없음'} · 그중 기준선 초과: ${passBar.join(', ') || '없음'}`);
  console.log(`  가중치별 1위(관문 통과 후보 중): 0.25 ${top(0.25) || '-'} · 0.5 ${top(0.5) || '-'} · 1.0 ${top(1) || '-'}`);
  const best = passBar.length ? top(0.5) : null;
  if (!best) {
    const near = CAND.slice().sort((a, b) => out.tech[b].sc.mm - out.tech[a].sc.mm)[0];
    console.log(`  → 기술 모드에서 모든 기준을 통과한 후보 없음: v2 유지. 가장 가까운 후보 ${near} (maximin ${out.tech[near].sc.mm.toFixed(2)}, 관문 A ${out.tech[near].g.A.join(',') || '통과'}, 관문 B ${out.tech[near].g.B.join(',') || '통과'})`);
  } else {
    const robust = top(0.25) === best && top(1) === best;
    const fF = out.full[best], fullOk = !fF.g.A.length && !fF.g.B.length && fF.sc.mm > bar('full');
    console.log(`  → 기술 모드 1위 ${best} (maximin ${out.tech[best].sc.mm.toFixed(2)}) · 가중치 강건성 ${robust ? '통과' : '실패'} · 전체 모드 확인 ${fullOk ? '통과' : '실패'} (maximin ${fF.sc.mm.toFixed(2)} vs 기준 ${bar('full').toFixed(2)}, A ${fF.g.A.join(',') || '통과'}, B ${fF.g.B.join(',') || '통과'})`);
    console.log(robust && fullOk ? `  → 다음: node lib/t25.js nbr ${best} → sealed ${best}` : '  → 기준 미달: v2 유지');
  }
  fs.writeFileSync(path.join(R, 'data', 'T25_judge.json'), JSON.stringify(out));
}

// =====================================================================================================================
else if (cmd === 'nbr') {
  const h = args[1], G = groups(), S = strategies('tech'), dca = evalGroups(S.DCA, G), v2r = evalGroups(S.v2r, G);
  const mm = r => Math.min(...G.map(g => 100 * ((r[g.key].med - dca[g.key].med) + 0.5 * (r[g.key].min - dca[g.key].min))));
  const base = mm(v2r); let cells = [];
  if (['H1', 'H2', 'H3', 'H4', 'H7'].includes(h)) {
    for (const n of [150, 200, 250]) for (const b of [0, 0.01, 0.02]) {
      const build = D => { const s = cache(D, `nb${h}${n}_${b}`, () => H[h === 'H7' ? 'H3' : h](D, 'tech', n, b)); return { p: h === 'H7' ? follow(s, { contribOut: 1 }) : sigP(s) }; };
      cells.push([`${n}일 b${b * 100}%`, mm(evalGroups(build, G))]);
    }
  } else if (h === 'H6') { for (const f of [1 / 3, 0.5, 2 / 3]) cells.push([`매도 ${(f * 100).toFixed(0)}%`, mm(evalGroups(D => ({ p: tgtP(h6Target(D, 'tech', f)), t: h6Target(D, 'tech', f) }), G))]); }
  else if (h === 'H5') { for (const m of [0.8, 1, 1.2]) cells.push([`룩백 ×${m}`, mm(evalGroups(D => ({ p: tgtP(h5Target(D, m)), t: h5Target(D, m) }), G))]); }
  const need = cells.length === 9 ? 7 : 2, ok = cells.filter(([, s]) => s > base).length;
  console.log(`■ ${h} 이웃 (기술 모드 maximin, v2r ${base.toFixed(2)} 초과해야): ` + cells.map(([k, s]) => `${k} ${s.toFixed(2)}${s > base ? '' : '✗'}`).join(' · '));
  console.log(`  → ${ok}/${cells.length} 초과 (기준 ${need}개 이상): ${ok >= need ? '통과' : '실패'}`);
}

// =====================================================================================================================
else if (cmd === 'sealed') {
  const h = args[1], { H60 } = datasets(), w = winsAll(H60, 1951, 1954, 5, '1959-12-31');
  console.log(`■ 봉인 구간 1950~59 S&P 2배 · 5년 구간 ${w.length}개 (1951~1954 시작, 시작 월 1~12) · IRR 중앙 / 최악 · 시간가중 MDD 중앙 · 매매 중앙`);
  const r = {};
  for (const mode of ['tech', 'full']) {
    const S = strategies(mode);
    for (const nm of (mode === 'tech' ? ['DCA', 'v2(엔진)', 'v2r', h] : ['v2(엔진)', 'v2r', h])) {
      const x = evalGroups(S[nm], [{ key: 'SEAL', D: H60, w }]).SEAL; r[mode + nm] = x;
      console.log(`  ${mode === 'tech' ? '기술' : '전체'} ${nm.padEnd(9)} ${pc(x.med)} / ${pc(x.min)} · MDD ${pc(x.mdd, 0)} · 매매 ${x.trades}`);
    }
    // pre-registered: candidate median >= v2 - 1%p and worst >= v2 - 2%p; checked against both v2 implementations (stricter)
    const c = r[mode + h], ok = ['v2r', 'v2(엔진)'].every(k => c.med >= r[mode + k].med - 0.01 && c.min >= r[mode + k].min - 0.02);
    console.log(`  ${mode === 'tech' ? '기술' : '전체'} 판정 (중앙 ≥ v2 − 1%p, 최악 ≥ v2 − 2%p, v2r·엔진 v2 모두): ` + ['v2r', 'v2(엔진)'].map(k => `${k} 대비 중앙 ${sg(c.med - r[mode + k].med)} · 최악 ${sg(c.min - r[mode + k].min)}`).join(' / ') + ` → ${ok ? '통과' : '실패'}`);
  }
}

// =====================================================================================================================
else if (cmd === 'boot') {
  const hs = String(args[1] || '').split(',').filter(Boolean), N = +opt('--n', 500), names = ['v2r', 'G1 200일선', ...hs, 'DCA'];
  const mkRnd = s0 => { let seed = s0 >>> 0; return () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const { ND, SP, H60, H28 } = datasets();
  // pools: [label, sources [{D, lev/er}], mode]. Era mix (tech): S&P 1928~49, 1960~85, 1986~ in proportion to their length
  const POOLS = [['나스닥 1986~ (전체 모드)', [ND], 'full', 0.0095], ['S&P 2배 1986~ (전체 모드)', [SP], 'full', 0.0089], ['S&P 2배 세 시대 섞음 (기술 모드)', [H28, H60, SP], 'tech', 0.0089]];
  for (const MB of [63, 252, 504]) for (const [label, src, mode, er] of POOLS) {
    const rnd = mkRnd(+opt('--seed', 7)), LEN = 300 + 2520, out = Object.fromEntries(names.map(k => [k, []]));
    const tot = src.reduce((s, D) => s + D.n, 0), onsetOf = D => cache(D, 'onset', () => { const o = new Uint8Array(D.n); for (let j = 1; j < D.n; j++) o[j] = E.macroOnset(D, P0, j) ? 1 : 0; return o; });
    for (let k = 0; k < N; k++) {
      const r2 = { d0: day('2000-01-03'), dd: [], px: [1000], rq: [0], tb: [], fx: [1200], ms: [null], vix: null }, on = new Uint8Array(LEN), bl = new Uint8Array(LEN);
      let t = 0;
      while (t < LEN) { // stationary blocks: pick a source in proportion to its length, then a start day, geometric length (mean MB)
        let u = rnd() * tot, D = src[0]; for (const X of src) { if (u < X.n) { D = X; break; } u -= X.n; }
        let s = 1 + Math.floor(rnd() * (D.n - 2)), first = true;
        do {
          if (t === 0) { r2.tb.push(D.tb[s]); t = 1; s++; continue; }
          const o = onsetOf(D);
          r2.dd.push(Math.max(1, D.day[s] - D.day[s - 1])); r2.px.push(r2.px[t - 1] * D.px[s] / D.px[s - 1]); r2.rq.push(D.ix[s] / D.ix[s - 1] - 1); r2.tb.push(D.tb[s]);
          r2.fx.push(r2.fx[t - 1] * (D.fx && D.fx[s - 1] ? D.fx[s] / D.fx[s - 1] : 1)); r2.ms.push(null); on[t] = o[s]; bl[t] = D.ib ? D.ib[s] : 0; t++; s++; first = false;
        } while (s < D.n && t < LEN && rnd() > 1 / MB);
      }
      const D2 = E.prepData(r2, 2, er); D2.name = `b${MB}${label}${k}`; D2.ib = bl;
      const modeOpts = mode === 'full' ? { macro: j => !!on[j] } : { macro: () => false };
      const rep = o => L.run(D2, Object.assign({ base: { win: new Uint8Array(LEN), ib: mode === 'full' ? bl : new Uint8Array(LEN) } }, modeOpts, o));
      const ab = above(D2, 200, 0), be = below(D2, 200, 0.01), ab1 = above(D2, 200, 0.01);
      const mk = nm => {
        if (nm === 'DCA') return { strategy: false };
        if (nm === 'v2r') return sigP(rep());
        if (nm === 'G1 200일선') return sigP(g1(D2));
        if (nm === 'H1') return sigP(rep({ enterOk: j => !!ab[j] }));
        if (nm === 'H2') return sigP(rep({ exitVotes: (j, need) => ab[j] ? 3 : need }));
        if (nm === 'H3') return sigP(rep({ exitVotes: (j, need) => ab[j] ? 3 : need, enterOk: j => !!ab[j] }));
        if (nm === 'H4') return sigP(rep({ extraExit: j => !!be[j], enterOk: j => !!ab1[j] }));
        if (nm === 'H7') return follow(rep({ exitVotes: (j, need) => ab[j] ? 3 : need, enterOk: j => !!ab[j] }), { contribOut: 1 });
        if (nm === 'H5') return tgtP(h5Target(D2));
        if (nm === 'H6') return tgtP(h6Target(D2, mode === 'full' ? 'tech' : 'tech')); // bootstrap paths carry no macro share; H6 uses its technical machine
      };
      for (const nm of names) out[nm].push(E.runBT(D2, 300, LEN - 1, Object.assign({ weeklyKRW: W }, mk(nm)), false));
      for (const key of [...memo.keys()]) if (key.startsWith(D2.name + '|')) memo.delete(key);
    }
    const f = (arr, key) => [0.05, 0.5].map(p => pc(qtl(arr.map(x => x[key]), p))).join(' / ');
    console.log(`\n■ 블록 평균 ${MB}일 · ${label} · 10년 경로 ${N}개 · IRR 5/50% · MDD 5/50% · P(IRR < DCA) · P(IRR < v2r)`);
    for (const nm of names) { const a = out[nm], d = out.DCA, v = out.v2r;
      console.log(`  ${nm.padEnd(11)} IRR ${f(a, 'irr')} · MDD ${f(a, 'mddTwr')}` + (nm === 'DCA' ? '' : ` · ${pc(a.filter((x, i) => x.irr < d[i].irr).length / N)}%`) + (nm === 'v2r' || nm === 'DCA' ? '' : ` · ${pc(a.filter((x, i) => x.irr < v[i].irr).length / N)}%`)); }
  }
}

// =====================================================================================================================
else if (cmd === 'dsr') {
  // same frame as T23 (lib/audit.js pbo): lump sum 1억, daily after-tax KRW time-weighted log returns, Nasdaq-100, full mode
  const h = args[1], { ND } = datasets(), D = ND; let i0 = 0; while (isNaN(D.rv[i0]) || isNaN(D.v60[i0]) || isNaN(D.ms[i0])) i0++; i0 += 60;
  const i1 = D.n - 1, rets = p => { const r = E.runBT(D, i0, i1, Object.assign({ weeklyKRW: 0, initialKRW: 1e8 }, p), false), t = r.twr, o = new Float64Array(t.length - 1); for (let k = 1; k < t.length; k++) o[k - 1] = Math.log(t[k] / t[k - 1]); return o; };
  const S = strategies('full'), bh = rets({ strategy: false });
  const fam = []; for (const dnHi of [0.25, 0.30, 0.35]) for (const crash of [-0.06, -0.08, -0.10]) for (const rsiW of [40, 45, 50]) for (const expand of [1.4, 1.6, 1.8]) for (const macroTh of [0.4, 0.5, 0.6]) for (const inflBlock of [false, true]) fam.push({ strategy: true, rule: 'final', dnHi, crash, rsiW, expand, macroTh, inflBlock });
  const mom = a => { const n = a.length, m = a.reduce((x, y) => x + y, 0) / n; let v = 0, s3 = 0, s4 = 0; for (const x of a) { const d = x - m; v += d * d; s3 += d ** 3; s4 += d ** 4; } v /= n; return { sr: m / Math.sqrt(v), sk: s3 / n / v ** 1.5, ku: s4 / n / v ** 2 }; };
  const srs = fam.map(p => { const r = rets(p); return mom(r.map((x, t) => x - bh[t])).sr; }), mS = srs.reduce((x, y) => x + y, 0) / srs.length, vS = srs.reduce((x, y) => x + (y - mS) ** 2, 0) / (srs.length - 1);
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2)), PhiInv = p => { let lo = -10, hi = 10; for (let k = 0; k < 100; k++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }, g = 0.5772156649;
  const Ntr = fs.readFileSync(path.join(R, 'trials.jsonl'), 'utf8').trim().split('\n').length, T = bh.length;
  const names = ['v2(엔진)', 'v2r', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'], R2 = {};
  for (const nm of names) R2[nm] = rets(S[nm](D).p);
  for (const nm of [...new Set(['v2(엔진)', ...String(h || '').split(',').filter(Boolean)])]) { const m = mom(R2[nm].map((x, t) => x - bh[t]));
    const psr = sr0 => Phi((m.sr - sr0) * Math.sqrt(T - 1) / Math.sqrt(1 - m.sk * m.sr + (m.ku - 1) / 4 * m.sr * m.sr));
    const ds = [500, Ntr].map(Nt => `시도 ${Nt}개 ${pc(psr(Math.sqrt(vS) * ((1 - g) * PhiInv(1 - 1 / Nt) + g * PhiInv(1 - 1 / (Nt * Math.E)))))}%`);
    console.log(`■ ${nm} 초과수익(− QLD 보유, 거치, 전체 모드) 연 샤프 ${(m.sr * Math.sqrt(252)).toFixed(2)} · PSR(0) ${pc(psr(0))}% · DSR ${ds.join(' · ')} (설정군 샤프 표준편차 ${(Math.sqrt(vS) * Math.sqrt(252)).toFixed(2)}/년)`); }
  // CSCV-PBO on the small set (H1~H7 + v2), Sharpe of daily log returns, 16 blocks
  const set = ['v2(엔진)', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'], Sb = 16, Lb = Math.floor(T / Sb);
  const bs = set.map(nm => { const r = R2[nm], s1 = new Float64Array(Sb), s2 = new Float64Array(Sb); for (let b = 0; b < Sb; b++) for (let t = b * Lb; t < (b + 1) * Lb; t++) { s1[b] += r[t]; s2[b] += r[t] * r[t]; } return [s1, s2]; });
  const shp = (a, b2, n) => { const m = a / n, v = b2 / n - m * m; return v > 0 ? m / Math.sqrt(v) : 0; };
  const combos = []; (function rec(st, a) { if (a.length === Sb / 2) { combos.push(a.slice()); return; } for (let b = st; b < Sb; b++) { a.push(b); rec(b + 1, a); a.pop(); } })(0, []);
  let below = 0; const bestCnt = new Array(set.length).fill(0);
  for (const cb of combos) { const inS = new Uint8Array(Sb); for (const b of cb) inS[b] = 1;
    const isv = [], osv = []; for (let k = 0; k < set.length; k++) { let a1 = 0, a2 = 0, o1 = 0, o2 = 0; const [s1, s2] = bs[k]; for (let b = 0; b < Sb; b++) if (inS[b]) { a1 += s1[b]; a2 += s2[b]; } else { o1 += s1[b]; o2 += s2[b]; } isv.push(shp(a1, a2, Lb * Sb / 2)); osv.push(shp(o1, o2, Lb * Sb / 2)); }
    let best = 0; for (let k = 1; k < set.length; k++) if (isv[k] > isv[best]) best = k; bestCnt[best]++;
    let rank = 0; for (let k = 0; k < set.length; k++) if (osv[k] < osv[best]) rank++; if ((rank + 1) / (set.length + 1) <= 0.5) below++; }
  console.log(`■ CSCV-PBO (후보 7개 + v2, 샤프, 블록 ${Sb}개, 조합 ${combos.length}개): PBO ${pc(below / combos.length)}% · 표본 내 1위 횟수 ` + set.map((nm, k) => `${nm} ${pc(bestCnt[k] / combos.length, 0)}%`).join(' · '));
}

// =====================================================================================================================
else if (cmd === 'events') {
  const h = args[1], { ND, SP, H60, H28 } = datasets(), S = strategies('tech');
  const EV = [['1929~32', H28, '1929-01-02', '1932-12-30'], ['1937~42', H28, '1937-01-04', '1942-12-31'], ['1973~74', H60, '1972-07-03', '1975-06-30'],
    ['2000~02', ND, '1999-07-01', '2003-06-30'], ['2008', ND, '2007-07-02', '2009-12-31'], ['2020', ND, '2019-07-01', '2021-06-30'], ['2022', ND, '2021-07-01', '2023-12-29']];
  console.log(`■ 사건별 (기술 모드, 주 100만): 구간 IRR · 매매(이탈) 횟수 · 첫 이탈일 · 마지막 복귀일 — v2r / ${h} / G1 / DCA`);
  for (const [nm, D, a0, b0] of EV) {
    const a = E.idxOfDay(D, day(a0), true), b = E.idxOfDay(D, day(b0), false);
    const cell = key => { const bld = S[key](D), r = run(D, a, b, bld.p); let ex = 0, first = null, lastIn = null;
      const st = j => bld.t ? bld.t[j] < 1 : bld.x ? !!bld.x.exitSig[j] : false;
      for (let j = a; j < b; j++) { if (st(j) && !(j > a ? st(j - 1) : false)) { ex++; if (!first) first = iso(D.day[j]); } if (!st(j) && j > a && st(j - 1)) lastIn = iso(D.day[j]); }
      return `${pc(r.irr)}% · ${ex}회${first ? ` · ${first.slice(2)}` : ''}${lastIn ? `~${lastIn.slice(2)}` : ''}`; };
    console.log(`  ${nm.padEnd(8)} v2r ${cell('v2r')} | ${h} ${cell(h)} | G1 ${cell('G1 200일선')} | DCA ${pc(run(D, a, b, { strategy: false }).irr)}%`);
  }
  // 1928~49: v2r exits whose signal day had the upside-volatility axis on (up20 > 35% while down20 <= 30%)
  const s = cache(H28, 'v2rtech', () => repl(H28, 'tech')), j0 = E.idxOfDay(H28, day('1929-01-02'), true); let n = 0, up = 0, upOnly = 0;
  for (let j = j0 + 1; j < H28.n; j++) if (s.exitSig[j] && !s.exitSig[j - 1]) { n++; const v = H28.vols; if (v.up20[j] > 0.35) { up++; if (!(v.down20[j] > 0.30)) upOnly++; } }
  console.log(`■ 1929~49 v2r 이탈 ${n}회 중 상방 변동성(>35%)이 켜진 이탈 ${up}회, 그중 하방 변동성은 꺼진(상방만으로 ① 축이 켜진) 이탈 ${upOnly}회`);
}
else console.log('usage: node lib/t25.js sanity | main --part tech|full | judge | nbr <H#> | sealed <H#> | boot <H#> [--n 500] | dsr <H#> | events <H#>');
