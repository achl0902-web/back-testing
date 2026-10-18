#!/usr/bin/env node
// Independent bear-market evidence: synthetic 2x versions of foreign indices (price index, no dividends → conservative),
// financed at the US 3M T-bill + 0.5%, fee 0.95%, KRW conversion and US macro alarm share taken from the NDX dataset by date.
// These sets are EXTRA evidence (they do not replace the fixed validation sets in data.js).
// usage: node lib/intl.js '<cfg>'      (prints champion vs DCA and candidate vs champion per market, 10-year windows)
const fs = require('fs'), path = require('path');
const { E, load, day } = require('./data.js');
const C = require('./core.js');
const MACRO = path.join(__dirname, '..', '..', 'data', 'macro');
const MARKETS = [['N225', '닛케이225', 1984], ['GDAXI', 'DAX', 1990], ['FTSE', 'FTSE100', 1986], ['HSI', '항셍', 1989], ['KS11', '코스피', 1999]];
const EPIS = { N225: [['1990-01-02', '2003-12-31'], ['2007-01-04', '2012-12-28']], GDAXI: [['2000-01-03', '2003-12-31'], ['2007-01-02', '2009-12-30']], FTSE: [['2000-01-04', '2003-12-31'], ['2007-01-02', '2009-12-31']], HSI: [['1997-07-02', '1998-12-31'], ['2007-10-02', '2009-12-31']], KS11: [['2007-10-01', '2009-12-30'], ['2021-06-01', '2023-12-28']] };
let _ds = null;
function datasets() {
  if (_ds) return _ds;
  const { ND } = load();
  const nd = new Map(); for (let i = 0; i < ND.n; i++) nd.set(ND.day[i], i);
  const ndAt = d => { let lo = 0, hi = ND.n - 1; if (d < ND.day[0]) return 0; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ND.day[m] <= d) lo = m; else hi = m - 1; } return lo; };
  _ds = {};
  for (const [k, label, y0] of MARKETS) {
    const rows = fs.readFileSync(path.join(MACRO, `Y_${k}.csv`), 'utf8').trim().split('\n').slice(1).map(l => l.split(',')).map(([d, v]) => [day(d), +v]).filter(r => r[1] > 0 && r[0] >= ND.day[0]);
    const days = rows.map(r => r[0]), px = rows.map(r => r[1]);
    const raw = { d0: days[0], dd: days.slice(1).map((d, i) => d - days[i]), px, rq: px.map((v, i) => i ? v / px[i - 1] - 1 : 0),
      tb: days.map(d => ND.tb[ndAt(d)]), fx: days.map(d => ND.fx[ndAt(d)]), ms: days.map(d => { const v = ND.ms[ndAt(d)]; return isNaN(v) ? null : v; }) };
    const D = E.prepData(raw, 2, 0.0095); D.name = 'INTL_' + k; D.label = label; D.y0 = y0;
    _ds[k] = D;
  }
  return _ds;
}
function windows(D, y0, len = 10) { const w = []; for (let y = y0; y + len - 1 <= 2025; y++) { const a = E.idxOfDay(D, day(`${y}-01-02`), true), b = E.idxOfDay(D, day(`${y + len - 1}-12-31`), false); if (b > a) w.push([a, b]); } return w; }
function evaluate(cfg) {
  const ds = datasets(), out = {};
  const run = C.runner(cfg), base = C.runner(Object.assign({}, cfg, { signals: null }), true), champ = C.runner(C.champion());
  for (const [k, D] of Object.entries(ds)) {
    const w = windows(D, D.y0);
    const r = w.map(([a, b]) => run(D, a, b)), d = w.map(([a, b]) => base(D, a, b)), c = w.map(([a, b]) => champ(D, a, b));
    const eps = (EPIS[k] || []).map(([s, e]) => { const a = E.idxOfDay(D, day(s), true), b = E.idxOfDay(D, day(e), false); return [s.slice(0, 4) + '~' + e.slice(2, 4), run(D, a, b).irr - champ(D, a, b).irr, champ(D, a, b).irr - base(D, a, b).irr]; });
    out[k] = { label: D.label, n: w.length, champMed: C.med(c.map(x => x.irr)), dcaMed: C.med(d.map(x => x.irr)), champMin: Math.min(...c.map(x => x.irr)), dcaMin: Math.min(...d.map(x => x.irr)),
      dMed: C.med(r.map(x => x.irr)) - C.med(c.map(x => x.irr)), dMin: Math.min(...r.map(x => x.irr)) - Math.min(...c.map(x => x.irr)),
      changed: r.filter((x, i) => Math.abs(x.irr - c[i].irr) > 1e-6).length, win: r.filter((x, i) => x.irr > c[i].irr + 1e-6).length, lose: r.filter((x, i) => x.irr < c[i].irr - 1e-6).length, eps };
  }
  return out;
}
if (require.main === module) {
  const src = process.argv[2]; const cfg = src.trim().startsWith('{') ? JSON.parse(src) : JSON.parse(fs.readFileSync(src));
  const res = evaluate(cfg); const f = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(1);
  console.log(`해외 합성 2배 (10년 구간) · ${cfg.name || ''}`);
  for (const v of Object.values(res)) console.log(`  ${v.label.padEnd(6)} n${v.n} | 챔피언 중앙 ${(v.champMed * 100).toFixed(1)} (DCA ${(v.dcaMed * 100).toFixed(1)}) 최악 ${(v.champMin * 100).toFixed(1)} (DCA ${(v.dcaMin * 100).toFixed(1)}) | 후보−챔피언 Δ중앙 ${f(v.dMed)} Δ최악 ${f(v.dMin)} · 달라진 구간 ${v.changed} (승 ${v.win}/패 ${v.lose}) | 약세장: ${v.eps.map(e => `${e[0]} ${f(e[1])} (챔피언−DCA ${f(e[2])})`).join(', ')}`);
}
module.exports = { datasets, evaluate };
