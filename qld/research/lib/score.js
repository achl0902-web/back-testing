#!/usr/bin/env node
// Standard scorecard for a QLD strategy candidate. Every run is appended to research/trials.jsonl
// so the number of things tried is always known (multiple-testing control, see PROTOCOL.md).
//
// usage: node lib/score.js <config.json | inline JSON> [--grid '{"key":[v1,v2]}'] [--quiet] [--no-log]
//
// config fields
//   name      short label                         step   step id, e.g. "S07"      by  role (tech|macro|redteam|risk|chair)
//   sim       "engine" (default; src/engine.js runBT) | "buy" (lib/buyrules.js: buy-side / rebalancing rules)
//   params    passed to the simulator (engine: runBT params, e.g. {"strategy":true,"votes":2}; buy: {"mode":"rule",...})
//   signals   optional path (relative to research/) of a module: (D, params, H, L) => ({ exitSig, enterSig }) arrays
//             indexed by trading day; the engine exits when exitSig[j] and re-enters when enterSig[j] (j = signal day)
//   money     {"weekly":700000} (default) | {"lump":100000000} | both
//   costMult  multiply fee and FX spread (red team: 2)       startMonth  1 (default) or 7 (red team: shifted windows)
const fs = require('fs');
const path = require('path');
const { E, B, load, highLow, sets, episodes, day } = require('./data.js');
const R = path.join(__dirname, '..');

const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : null; };
const src = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--grid');
if (!src) { console.error('config required'); process.exit(1); }
const cfg0 = src.trim().startsWith('{') ? JSON.parse(src) : JSON.parse(fs.readFileSync(src));
const champion = JSON.parse(fs.readFileSync(path.join(R, 'champion.json')));

const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q10 = a => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.1)];
const pct = (x, d = 1) => (x * 100).toFixed(d);

const sigCache = new Map();
function runner(cfg) {
  const money = cfg.money || { weekly: 700000 };
  const cm = cfg.costMult || 1;
  if ((cfg.sim || 'engine') === 'engine') {
    return (D, i0, i1, base) => {
      const p = Object.assign({ weeklyKRW: money.weekly || 0, initialKRW: money.lump || 0 }, cfg.params || {});
      p.fee = (p.fee ?? E.DEFAULTS.fee) * cm; p.fxSpread = (p.fxSpread ?? E.DEFAULTS.fxSpread) * cm;
      if (base) p.strategy = false; else if (p.strategy === undefined) p.strategy = true;
      if (cfg.signals && !base) {
        const key = cfg.signals + '|' + D.name + '|' + JSON.stringify(cfg.params || {});
        if (!sigCache.has(key)) sigCache.set(key, require(path.resolve(R, cfg.signals))(D, cfg.params || {}, ...highLow(D)));
        Object.assign(p, sigCache.get(key));
      }
      return E.runBT(D, i0, i1, p, false);
    };
  }
  // buy-side simulator (daily cash flow; see lib/buyrules.js)
  return (D, i0, i1, base) => {
    const key = 'sig|' + D.name; if (!sigCache.has(key)) sigCache.set(key, B.signals(D, ...highLow(D)));
    const daily = money.weekly ? money.weekly * 52 / 252 : 0;
    const p = Object.assign({ daily, initial: money.lump || 0 }, base ? { mode: 'dca' } : cfg.params || {});
    const r = B.run(D, sigCache.get(key), i0, i1, p);
    return { irr: r.irr, finalAfter: r.fin, mddValue: r.mddV, worstVsPaid: r.worst, exits: 0, cashAvg: r.cashAvg };
  };
}

function score(cfg) {
  const run = runner(cfg), runBase = runner(Object.assign({}, cfg, { signals: null })), runChamp = runner(Object.assign({}, champion, { money: cfg.money, costMult: cfg.costMult }));
  const out = { sets: {}, episodes: {}, overall: {} };
  let wD = 0, wC = 0, n = 0;
  for (const S of sets(cfg.startMonth || 1)) {
    const r = S.w.map(([a, b]) => run(S.D, a, b, false));
    const d = S.w.map(([a, b]) => runBase(S.D, a, b, true));
    const c = S.w.map(([a, b]) => runChamp(S.D, a, b, false));
    const winD = r.filter((x, k) => x.irr > d[k].irr).length, winC = r.filter((x, k) => x.irr > c[k].irr + 1e-9).length;
    wD += winD; wC += winC; n += r.length;
    out.sets[S.key] = { label: S.label, n: r.length, oos: S.oos,
      irrMed: med(r.map(x => x.irr)), irrMin: Math.min(...r.map(x => x.irr)), irrP10: q10(r.map(x => x.irr)),
      dcaMed: med(d.map(x => x.irr)), dcaMin: Math.min(...d.map(x => x.irr)),
      champMed: med(c.map(x => x.irr)), champMin: Math.min(...c.map(x => x.irr)),
      winVsDca: winD, winVsChamp: winC, mddMed: med(r.map(x => x.mddValue)), dcaMddMed: med(d.map(x => x.mddValue)),
      exitsMed: med(r.map(x => x.exits || 0)) };
  }
  for (const ep of episodes()) {
    const r = run(ep.D, ep.i0, ep.i1, false), d = runBase(ep.D, ep.i0, ep.i1, true), c = runChamp(ep.D, ep.i0, ep.i1, false);
    out.episodes[ep.key] = { vsDca: r.irr - d.irr, vsChamp: r.irr - c.irr };
  }
  const { ND } = load();
  const i99 = E.idxOfDay(ND, day('1999-01-04'), true);
  const full = run(ND, i99, ND.n - 1, false);
  out.overall = { winRateVsDca: wD / n, winRateVsChamp: wC / n, windows: n, exits1999: full.exits || 0 };
  return out;
}

function print(name, s) {
  const L = [];
  L.push(`■ ${name}`);
  L.push(`  단순 적립보다 높은 구간 ${pct(s.overall.winRateVsDca, 0)}% · 챔피언보다 높은 구간 ${pct(s.overall.winRateVsChamp, 0)}% · 1999년 이후 이탈 ${s.overall.exits1999}회`);
  for (const [k, v] of Object.entries(s.sets))
    L.push(`  ${k.padEnd(7)} IRR 중앙 ${pct(v.irrMed)} (DCA ${pct(v.dcaMed)}, 챔피언 ${pct(v.champMed)}) · 최악 ${pct(v.irrMin)} (DCA ${pct(v.dcaMin)}, 챔피언 ${pct(v.champMin)}) · 하위10% ${pct(v.irrP10)} · MDD중앙 ${pct(v.mddMed, 0)} (DCA ${pct(v.dcaMddMed, 0)}) · 승 DCA ${v.winVsDca}/${v.n} 챔피언 ${v.winVsChamp}/${v.n}`);
  L.push('  사례 (DCA 대비 / 챔피언 대비 %p): ' + Object.entries(s.episodes).map(([k, v]) => `${k} ${pct(v.vsDca)}/${pct(v.vsChamp)}`).join(' · '));
  return L.join('\n');
}

function log(cfg, s) {
  if (flag('--no-log')) return;
  const rec = { t: new Date().toISOString(), step: cfg.step || null, by: cfg.by || null, name: cfg.name || null, sim: cfg.sim || 'engine',
    params: cfg.params || {}, signals: cfg.signals || null, money: cfg.money || { weekly: 700000 }, costMult: cfg.costMult || 1, startMonth: cfg.startMonth || 1,
    winVsDca: +s.overall.winRateVsDca.toFixed(3), winVsChamp: +s.overall.winRateVsChamp.toFixed(3),
    N10: [+s.sets.N10.irrMed.toFixed(4), +s.sets.N10.irrMin.toFixed(4)], N10oos: [+s.sets.N10oos.irrMed.toFixed(4), +s.sets.N10oos.irrMin.toFixed(4)],
    S10: [+s.sets.S10.irrMed.toFixed(4), +s.sets.S10.irrMin.toFixed(4)], N5: [+s.sets.N5.irrMed.toFixed(4), +s.sets.N5.irrMin.toFixed(4)], S5: [+s.sets.S5.irrMed.toFixed(4), +s.sets.S5.irrMin.toFixed(4)],
    episodes: Object.fromEntries(Object.entries(s.episodes).map(([k, v]) => [k, +v.vsDca.toFixed(4)])) };
  fs.appendFileSync(path.join(R, 'trials.jsonl'), JSON.stringify(rec) + '\n');
}

const grid = opt('--grid') ? JSON.parse(opt('--grid')) : null;
const combos = [{}];
if (grid) for (const [k, vs] of Object.entries(grid)) { const nx = []; for (const c of combos) for (const v of vs) nx.push(Object.assign({}, c, { [k]: v })); combos.splice(0, combos.length, ...nx); }
const results = [];
for (const g of combos) {
  const cfg = Object.assign({}, cfg0, { params: Object.assign({}, cfg0.params || {}, g) });
  const s = score(cfg); log(cfg, s);
  const name = (cfg.name || 'candidate') + (grid ? ' ' + JSON.stringify(g) : '');
  results.push({ name, params: cfg.params, score: s });
  if (!flag('--quiet')) console.log(print(name, s));
}
if (flag('--json')) console.log(JSON.stringify(results));
