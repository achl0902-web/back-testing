#!/usr/bin/env node
// T23 audit (2026-11-07): independent checks of champion v2 and of the research process. Does not change the strategy,
// the engine, the page or the daily alert. Every scored variant is logged to trials.jsonl as step T23 (registry stays honest).
//   node lib/audit.js sanity            local evaluate == core.evaluate for v1 and v2; v1 + reentryBlock(v2 array) == v2
//   node lib/audit.js inf               v2 vs v1: every period where holdings differ, QLD return in it, share by year
//   node lib/audit.js starts            all 12 start months (weekly 1,000,000 KRW): v2 / v1 / DCA median, p10, worst per set
//   node lib/audit.js infnbr            inflation block neighbourhood (z, need, window) on the standard scorer
//   node lib/audit.js infplacebo [--n 200] [--seed 7]   circular shifts of the block array on v1 → null distribution
//   node lib/audit.js pbo               CSCV probability of backtest overfitting + deflated Sharpe for a 486-config family
// Weekly 700,000 KRW for scores (research standard, comparable with trials.jsonl); weekly 1,000,000 KRW for the tables.
const fs = require('fs'), path = require('path');
const C = require('./core.js'), V2 = require('./v2.js'), K = require('./catalog.js');
const { E, load, sets, day } = require('./data.js');
const R = path.join(__dirname, '..');
const args = process.argv.slice(2), cmd = args[0], opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };
const iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
const pc = (x, d = 1) => (x * 100).toFixed(d);
const sgn = (x, d = 1) => (x >= 0 ? '+' : '') + (x * 100).toFixed(d);
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const qtl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))]; };
const V2P = { strategy: true, rule: 'final', inflBlock: true }, V1P = { strategy: true, rule: 'final' };
const ibOf = D => (D.ib || (D.ib = V2.inflBlock(D)));
const slim = r => ({ irr: r.irr, mdd: r.mddTwr == null ? NaN : r.mddTwr, mddVal: r.mddValue, fin: r.finalAfter, exits: r.exits || 0, tax: r.taxesPaid || 0 });

// same parameter assembly as core.runner (money, cost multiplier, strategy flag, v2 array); pf(D) adds per-dataset arrays
function run(D, i0, i1, params, money = { weekly: 700000 }, wantLog = false) {
  const p = Object.assign({ weeklyKRW: money.weekly || 0, initialKRW: money.lump || 0 }, params);
  if (p.strategy === undefined) p.strategy = true;
  if (p.inflBlock) ibOf(D);
  return E.runBT(D, i0, i1, p, wantLog);
}
function evaluateP(pf, startMonth = 1) {
  const out = { sets: {}, episodes: {}, full: null };
  for (const S of sets(startMonth)) out.sets[S.key] = S.w.map(([a, b]) => slim(run(S.D, a, b, pf(S.D))));
  for (const ep of C.episodes()) out.episodes[ep.key] = slim(run(ep.D, ep.i0, ep.i1, pf(ep.D)));
  const { ND } = load(); out.full = slim(run(ND, E.idxOfDay(ND, day('1999-01-04'), true), ND.n - 1, pf(ND)));
  return out;
}
const CFG = { money: { weekly: 700000 } };
function score(name, pf, log = true) {
  const s = C.summarize(evaluateP(pf), CFG);
  if (log) C.logTrial(Object.assign({ step: 'T23', by: 'audit', name }, CFG, { params: { audit: name } }), s);
  return s;
}

// inflation block with its three knobs (v2: z 1.5, need 2 of 3, 756-day z window)
const KEYS = ['x_dxy', 'i_ppi', 'x_oil'];
function blockArr(D, z = 1.5, need = 2, win = 756) {
  const zs = KEYS.map(k => win === 756 ? K.zOf(D, k).z : K.zscore(K.zOf(D, k).raw, win, Math.min(252, win)));
  const b = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) { let c = 0; for (const s of zs) if (s[j] > z) c++; b[j] = c >= need ? 1 : 0; }
  return b;
}

// ---------------------------------------------------------------------------------------------------------------
if (cmd === 'sanity') {
  const { ND, SP } = load();
  const cmp = (a, b) => { let m = 0; for (const k of Object.keys(a.sets)) a.sets[k].forEach((x, i) => { m = Math.max(m, Math.abs(x.irr - b.sets[k][i].irr)); }); return m; };
  const r2 = evaluateP(() => V2P), c2 = C.evaluate(Object.assign({}, C.champion(), CFG));
  const r1 = evaluateP(() => V1P), c1 = C.evaluate(Object.assign({ params: V1P }, CFG));
  const rb = evaluateP(D => Object.assign({}, V1P, { reentryBlock: blockArr(D) }));
  console.log(`local v2 vs core v2: max |ΔIRR| ${cmp(r2, c2).toExponential(1)} · local v1 vs core v1: ${cmp(r1, c1).toExponential(1)} · v1+reentryBlock(z1.5,2,756) vs v2: ${cmp(rb, r2).toExponential(1)}`);
  for (const D of [ND, SP]) { const a = blockArr(D), b = ibOf(D); let d = 0; for (let j = 0; j < D.n; j++) d += a[j] !== b[j]; console.log(`${D.name}: block days ${a.reduce((s, v) => s + v, 0)} / ${D.n}, differs from v2.js on ${d} days`); }
}

// ---------------------------------------------------------------------------------------------------------------
if (cmd === 'inf') {
  const { ND, SP } = load(), W = { weekly: 1e6 };
  for (const D of [ND, SP]) {
    let i0 = 0; while (isNaN(D.rv[i0]) || isNaN(D.v60[i0])) i0++;
    const a = run(D, i0, D.n - 1, V1P, W), b = run(D, i0, D.n - 1, V2P, W);
    const ib = ibOf(D); const inA = a.expo.map(x => x > 0.5), inB = b.expo.map(x => x > 0.5);
    console.log(`\n■ ${D.name === 'NDX' ? '나스닥100 합성 QLD' : 'S&P 2배'} ${iso(D.day[i0])}~${iso(D.day[D.n - 1])} · 인플레 과열 켜진 날 ${ib.slice(i0).reduce((s, v) => s + v, 0)}일 · 이탈 v1 ${a.exits}회 / v2 ${b.exits}회`);
    console.log(`  전체 기간 적립(주 100만) IRR v1 ${pc(a.irr, 2)}% → v2 ${pc(b.irr, 2)}% · 세후 청산 v1 ${(a.finalAfter / 1e8).toFixed(1)}억 → v2 ${(b.finalAfter / 1e8).toFixed(1)}억 · 시간가중 MDD v1 ${pc(a.mddTwr, 0)}% / v2 ${pc(b.mddTwr, 0)}%`);
    // periods where one holds QLD and the other holds SGOV
    const eps = []; let s = -1;
    for (let k = 0; k <= inA.length; k++) { const diff = k < inA.length && inA[k] !== inB[k]; if (diff && s < 0) s = k; if (!diff && s >= 0) { eps.push([s, k - 1]); s = -1; } }
    const byYear = {}; let tot = 0;
    console.log('  보유가 다른 기간 (v1만 QLD = v2가 쉬는 기간): 시작 ~ 끝 · 거래일 · 그 기간 QLD 수익률 · 현금 수익률 · v2 몫(로그)');
    for (const [p, q] of eps) {
      const ia = i0 + p, ib2 = i0 + q, gQ = D.lx[ib2] / D.lx[ia - 1], gC = Math.exp(Array.from({ length: ib2 - ia + 1 }, (_, t) => Math.log(1 + Math.max(D.tb[ia + t] - 0.001, 0) * (1 - 0.154) / 252)).reduce((x, y) => x + y, 0));
      const v1in = inA[p], gain = v1in ? Math.log(gC / gQ) : Math.log(gQ / gC); tot += gain;
      const y = D.year[ia]; byYear[y] = (byYear[y] || 0) + gain;
      console.log(`   ${iso(D.day[ia])} ~ ${iso(D.day[ib2])} · ${String(q - p + 1).padStart(3)}일 · ${v1in ? 'v1 QLD/v2 SGOV' : 'v1 SGOV/v2 QLD'} · QLD ${sgn(gQ - 1)}% · 현금 ${sgn(gC - 1)}% · v2 ${sgn(gain, 1)}`);
    }
    const ys = Object.entries(byYear).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
    const gross = ys.reduce((x, [, v]) => x + Math.abs(v), 0);
    console.log(`  합계 v2 몫 ${sgn(tot)}(로그, 거치 1회 기준 근사) · 연도별: ${ys.map(([y, v]) => `${y} ${sgn(v)}`).join(' · ')} · 최대 연도 비중 ${gross ? pc(Math.abs(ys[0][1]) / gross, 0) : 0}%`);
  }
  // window level, all 12 start months: does v2 ever lose to v1?
  console.log('\n■ 구간 단위 v2 − v1 (주 100만, 시작 월 1~12 전부): 세트 · v2>v1 / 같음 / v2<v1 · 차이 최소·최대(%p)');
  for (const S of allStarts()) {
    let up = 0, eq = 0, dn = 0, lo = Infinity, hi = -Infinity;
    for (const [a, b] of S.w) { const d = run(S.D, a, b, V2P, { weekly: 1e6 }).irr - run(S.D, a, b, V1P, { weekly: 1e6 }).irr; if (d > 1e-6) up++; else if (d < -1e-6) dn++; else eq++; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    console.log(`  ${S.key.padEnd(6)} ${up} / ${eq} / ${dn} (구간 ${S.w.length}) · ${sgn(lo, 2)} ~ ${sgn(hi, 2)}`);
  }
}

// windows for every start month 1..12, kept only if the full window fits in the data (no truncated windows)
function allStarts() {
  const { ND, SP } = load();
  const spec = [['N10', ND, 1999, 2016, 10], ['N10oos', ND, 1986, 1998, 10], ['S10', SP, 1986, 2016, 10], ['N5', ND, 1986, 2021, 5], ['S5', SP, 1986, 2021, 5]];
  return spec.map(([key, D, y0, y1, len]) => {
    const w = [];
    for (let m = 1; m <= 12; m++) for (let y = y0; y <= y1; y++) {
      const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
      if (endD > D.day[D.n - 1]) continue; const b = E.idxOfDay(D, endD, false); if (b > a) w.push([a, b, m]);
    }
    return { key, D, w };
  });
}

// ---------------------------------------------------------------------------------------------------------------
if (cmd === 'starts') {
  const W = { weekly: 1e6 }, ST = [['v2', V2P], ['v1', V1P], ['DCA', { strategy: false }]];
  console.log('■ 시작 월 1~12 전부 (주 100만, 세후 원화 IRR): 세트 · 전략 · 중앙 / 하위10% / 최악 · 시작 월별 최악의 범위 · 시간가중 MDD 중앙');
  for (const S of allStarts()) {
    const res = {};
    for (const [nm, p] of ST) res[nm] = S.w.map(([a, b, m]) => { const r = run(S.D, a, b, p, W); return { irr: r.irr, mdd: r.mddTwr, m }; });
    for (const [nm] of ST) {
      const irr = res[nm].map(x => x.irr), byM = {};
      for (const x of res[nm]) byM[x.m] = Math.min(byM[x.m] ?? Infinity, x.irr);
      const mins = Object.values(byM);
      console.log(`  ${S.key.padEnd(6)} ${nm.padEnd(3)} ${pc(med(irr))} / ${pc(qtl(irr, 0.1))} / ${pc(Math.min(...irr))} · 월별 최악 ${pc(Math.min(...mins))}~${pc(Math.max(...mins))} · MDD ${pc(med(res[nm].map(x => x.mdd)), 0)}`);
    }
    const n = S.w.length, w2d = res.v2.filter((x, i) => x.irr > res.DCA[i].irr).length, w1d = res.v1.filter((x, i) => x.irr > res.DCA[i].irr).length;
    const jan = res.v2.filter(x => x.m === 1).map(x => x.irr), janD = res.DCA.filter(x => x.m === 1).map(x => x.irr);
    console.log(`         v2가 DCA보다 높은 구간 ${w2d}/${n} (${pc(w2d / n, 0)}%) · v1 ${w1d}/${n} · 1월 시작만 보면 최악 v2 ${pc(Math.min(...jan))} vs DCA ${pc(Math.min(...janD))}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
if (cmd === 'infnbr') {
  console.log('■ 인플레 복귀 금지 이웃값 (v1 + 차단 배열, 표준 점수 = 챔피언 v2 대비; v2 자신은 0.00)');
  const grid = [];
  for (const z of [1.0, 1.25, 1.5, 1.75, 2.0]) for (const need of [1, 2, 3]) grid.push([z, need, 756]);
  for (const win of [504, 1008]) grid.push([1.5, 2, win]);
  const v1s = score('v1 (인플레 차단 없음)', () => V1P);
  console.log(`  v1(차단 없음) ${C.printBrief('', v1s)}`);
  for (const [z, need, win] of grid) {
    const s = score(`INF z${z} need${need} win${win}`, D => Object.assign({}, V1P, { reentryBlock: blockArr(D, z, need, win) }));
    console.log(`  z ${z.toFixed(2)} · ${need}개 이상 · ${win}일 ${C.printBrief('', s)}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------
if (cmd === 'infplacebo') {
  const n = +opt('--n', 200); let seed = +opt('--seed', 7);
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const shift = (a, k) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[(i + k) % a.length] = a[i]; return o; };
  const v1s = score('v1 (인플레 차단 없음)', () => V1P, false).overall.score; // v2 itself scores 0 against itself
  const sc = [];
  for (let t = 0; t < n; t++) {
    const u = rnd();
    const s = C.summarize(evaluateP(D => { const k = 252 + Math.floor(u * (D.n - 504)); return Object.assign({}, V1P, { reentryBlock: shift(ibOf(D), k) }); }), CFG).overall.score;
    sc.push(s); if ((t + 1) % 25 === 0) process.stderr.write(`placebo ${t + 1}/${n}\n`);
  }
  const ge = sc.filter(x => x >= 0).length, mu = sc.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(sc.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1));
  const zReal = (0 - mu) / sd;
  fs.writeFileSync(path.join(R, 'steps', 'T23-infplacebo.json'), JSON.stringify({ n, seed: +opt('--seed', 7), v1: v1s, scores: sc.map(x => +x.toFixed(3)) }));
  console.log(`■ 인플레 차단 배열을 시간축으로 무작위 이동 ${n}회 (v1 위, 점수는 v2 대비 · 진짜 v2 = 0.00, v1 = ${v1s.toFixed(2)})`);
  console.log(`  플라시보 점수 중앙 ${qtl(sc, 0.5).toFixed(2)} · 상위 10% ${qtl(sc, 0.9).toFixed(2)} · 상위 1% ${qtl(sc, 0.99).toFixed(2)} · 최대 ${Math.max(...sc).toFixed(2)} · 평균 ${mu.toFixed(2)} ± ${sd.toFixed(2)}`);
  console.log(`  진짜 v2(0.00) 이상인 플라시보 ${ge}/${n} → 경험적 p ${((ge + 1) / (n + 1)).toFixed(3)} · 정규 근사 z ${zReal.toFixed(2)}`);
  console.log(`  v1 대비 개선 ${(-v1s).toFixed(2)}점이 플라시보 평균 대비 개선(${(mu - v1s).toFixed(2)})의 몇 배인가: ${((-v1s) / (mu - v1s)).toFixed(1)}배`);
}

// ---------------------------------------------------------------------------------------------------------------
// CSCV (Bailey, Borwein, López de Prado, Zhu 2017) on a 486-config family around the champion, lump sum 1억, daily
// after-tax KRW time-weighted returns 1987~2026 (Nasdaq-100 synthetic QLD). Also the deflated Sharpe ratio of the
// champion's active return vs buy-and-hold QLD (Bailey & López de Prado 2014), with the family's dispersion.
if (cmd === 'pbo') {
  const { ND } = load(), D = ND; let i0 = 0; while (isNaN(D.rv[i0]) || isNaN(D.v60[i0]) || isNaN(D.ms[i0])) i0++; i0 += 60;
  const i1 = D.n - 1, money = { lump: 1e8 };
  const fam = [];
  for (const dnHi of [0.25, 0.30, 0.35]) for (const crash of [-0.06, -0.08, -0.10]) for (const rsiW of [40, 45, 50])
    for (const expand of [1.4, 1.6, 1.8]) for (const macroTh of [0.4, 0.5, 0.6]) for (const inflBlock of [false, true])
      fam.push({ strategy: true, rule: 'final', dnHi, crash, rsiW, expand, macroTh, inflBlock });
  const isChamp = p => p.dnHi === 0.30 && p.crash === -0.08 && p.rsiW === 45 && p.expand === 1.6 && p.macroTh === 0.5;
  const rets = p => { const r = run(D, i0, i1, p, money); const t = r.twr, o = new Float64Array(t.length - 1); for (let k = 1; k < t.length; k++) o[k - 1] = Math.log(t[k] / t[k - 1]); return o; };
  const bh = rets({ strategy: false });
  const R2 = fam.map(rets), T = bh.length, N = fam.length, S = 16, L = Math.floor(T / S);
  const ci = fam.findIndex(p => isChamp(p) && p.inflBlock), c1 = fam.findIndex(p => isChamp(p) && !p.inflBlock);
  // block sums of r and r^2 for each config
  const bs = R2.map(r => { const s1 = new Float64Array(S), s2 = new Float64Array(S); for (let b = 0; b < S; b++) for (let t = b * L; t < (b + 1) * L; t++) { s1[b] += r[t]; s2[b] += r[t] * r[t]; } return [s1, s2]; });
  const sharpe = (s1, s2, n) => { const m = s1 / n, v = s2 / n - m * m; return v > 0 ? m / Math.sqrt(v) : 0; };
  const combos = []; (function rec(st, a) { if (a.length === S / 2) { combos.push(a.slice()); return; } for (let b = st; b < S; b++) { a.push(b); rec(b + 1, a); a.pop(); } })(0, []);
  for (const metric of ['sharpe', 'logwealth']) {
    let below = 0, lam = [], champBest = 0;
    for (const cb of combos) {
      const inS = new Uint8Array(S); for (const b of cb) inS[b] = 1;
      const isv = new Float64Array(N), osv = new Float64Array(N);
      for (let k = 0; k < N; k++) { let a1 = 0, a2 = 0, o1 = 0, o2 = 0; const [s1, s2] = bs[k]; for (let b = 0; b < S; b++) if (inS[b]) { a1 += s1[b]; a2 += s2[b]; } else { o1 += s1[b]; o2 += s2[b]; }
        const nn = L * S / 2; isv[k] = metric === 'sharpe' ? sharpe(a1, a2, nn) : a1; osv[k] = metric === 'sharpe' ? sharpe(o1, o2, nn) : o1; }
      let best = 0; for (let k = 1; k < N; k++) if (isv[k] > isv[best]) best = k; if (best === ci) champBest++;
      let rank = 0; for (let k = 0; k < N; k++) if (osv[k] < osv[best]) rank++;
      const w = (rank + 1) / (N + 1), l = Math.log(w / (1 - w)); lam.push(l); if (l <= 0) below++;
    }
    console.log(`■ CSCV (${metric === 'sharpe' ? '샤프' : '로그 자산'}) 설정 ${N}개 · 블록 ${S}개 · 조합 ${combos.length}개: PBO ${pc(below / combos.length)}% · 표본 내 1위의 표본 밖 순위 중앙 ${pc(1 / (1 + Math.exp(-med(lam))), 0)}%(백분위) · 챔피언 v2가 표본 내 1위였던 조합 ${pc(champBest / combos.length, 1)}%`);
  }
  // deflated Sharpe of the active return (config − buy & hold QLD), daily
  const act = R2.map(r => r.map((x, t) => x - bh[t]));
  const mom = a => { const n = a.length, m = a.reduce((x, y) => x + y, 0) / n; let v = 0, s3 = 0, s4 = 0; for (const x of a) { const d = x - m; v += d * d; s3 += d ** 3; s4 += d ** 4; } v /= n; return { sr: m / Math.sqrt(v), sk: s3 / n / v ** 1.5, ku: s4 / n / v ** 2 }; };
  const srs = act.map(a => mom(a).sr), mS = srs.reduce((x, y) => x + y, 0) / N, vS = srs.reduce((x, y) => x + (y - mS) ** 2, 0) / (N - 1);
  const Phi = x => 0.5 * (1 + erf(x / Math.SQRT2)), PhiInv = p => { let lo = -10, hi = 10; for (let k = 0; k < 100; k++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
  function erf(x) { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const g = 0.5772156649;
  for (const [nm, idx] of [['챔피언 v2', ci], ['v1', c1]]) {
    const m = mom(act[idx]);
    const psr = sr0 => Phi((m.sr - sr0) * Math.sqrt(T - 1) / Math.sqrt(1 - m.sk * m.sr + (m.ku - 1) / 4 * m.sr * m.sr));
    const out = [500, 4500].map(Nt => { const sr0 = Math.sqrt(vS) * ((1 - g) * PhiInv(1 - 1 / Nt) + g * PhiInv(1 - 1 / (Nt * Math.E))); return `시도 ${Nt}개 기준 ${pc(psr(sr0))}%`; });
    console.log(`■ ${nm} 초과수익(− QLD 단순 보유, 거치) 연 샤프 ${(m.sr * Math.sqrt(252)).toFixed(2)} · 왜도 ${m.sk.toFixed(1)} · 첨도 ${m.ku.toFixed(0)} · PSR(0) ${pc(psr(0))}% · DSR ${out.join(' · ')} (설정군 샤프 표준편차 ${(Math.sqrt(vS) * Math.sqrt(252)).toFixed(2)}/년)`);
  }
  const rk = srs.map((s, k) => [s, k]).sort((a, b) => b[0] - a[0]).findIndex(([, k]) => k === ci);
  console.log(`  전체 기간 초과수익 샤프 순위: 챔피언 v2 ${rk + 1}/${N} · 설정군 중앙 ${(med(srs) * Math.sqrt(252)).toFixed(2)} · 최고 ${(Math.max(...srs) * Math.sqrt(252)).toFixed(2)}`);
}
