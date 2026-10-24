#!/usr/bin/env node
// T13: re-check a research config on 1960~1985 S&P 2x data (never used to choose anything). Same windows as T08.
//   node lib/histcheck.js '<config json>'        config = {name, signals?, params}, as for score.js
//   node lib/histcheck.js Sxx [dirId]            every planned config of a step (or one direction)
// Output per config: Δ score vs the champion on the 10-year and 5-year window groups, score = IRR median + 0.5 × worst IRR,
// and the signal on-rate there (0% usually means the data the signal needs did not exist then: "확인 불가").
const fs = require('fs'), path = require('path');
const E = require('../../src/engine.js'), { highLow } = require('./data.js'), R = path.join(__dirname, '..');
const day = s => Math.round(Date.parse(s) / 864e5);
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const W = 1e6;
const D = E.prepData(JSON.parse(fs.readFileSync(path.join(R, 'data', 'hist_spx.json'))), 2, 0.0089);
function wins(y0, y1, len) { const o = [];
  for (const m of [1, 7]) for (let y = y0; y <= y1; y++) { const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
    if (endD > day('1985-12-31')) continue; const b = E.idxOfDay(D, endD, false); if (b > a) o.push([a, b]); } return o; }
const G = { '10년': wins(1961, 1975, 10), '5년': wins(1961, 1980, 5) };
const group = (p, w) => { const irr = w.map(([a, b]) => E.runBT(D, a, b, Object.assign({ weeklyKRW: W }, p), false).irr); return { med: med(irr), min: Math.min(...irr) }; };
const sc = g => 100 * (g.med + 0.5 * g.min);
// champion = 최종 전략 v2 (since 2026-10-24); its inflation block uses the monthly oil/dollar histories (T14)
D.ib = require('./v2.js').inflBlockHist(D);
const CHAMP = JSON.parse(fs.readFileSync(path.join(R, 'champion.json'))).params;
const base = {}; for (const [k, w] of Object.entries(G)) base[k] = { champ: group(Object.assign({}, CHAMP), w), dca: group({ strategy: false }, w) };

function check(cfg) {
  const p = Object.assign({ strategy: true }, cfg.params || {}); let rate = '';
  if (cfg.signals) {
    const out = require(path.resolve(R, cfg.signals))(D, p, ...highLow(D));
    const ent = Object.entries(out).filter(([, a]) => a && a.length === D.n);
    rate = ent.map(([k, a]) => { let on = 0; for (let j = 0; j < D.n; j++) on += a[j] ? 1 : 0; return `${k} ${(100 * on / D.n).toFixed(1)}%`; }).join(' · ');
    Object.assign(p, out);
  }
  const r = {}; for (const [k, w] of Object.entries(G)) { const g = group(p, w); r[k] = { d: sc(g) - sc(base[k].champ), med: g.med, min: g.min }; }
  const ok = r['10년'].d >= 0 && r['5년'].d >= 0;
  console.log(`${cfg.name}: 10년 ${r['10년'].d >= 0 ? '+' : ''}${r['10년'].d.toFixed(2)} · 5년 ${r['5년'].d >= 0 ? '+' : ''}${r['5년'].d.toFixed(2)} → ${ok ? '통과' : '미달'}${rate ? ` (신호 ${rate})` : ''}`);
  return ok;
}

const arg = process.argv[2];
console.log(`1960~85 S&P 2배 재확인 · 10년 구간 ${G['10년'].length}개, 5년 ${G['5년'].length}개 · 점수 = 중앙 + 0.5 × 최악, 챔피언 대비 (챔피언 10년 ${sc(base['10년'].champ).toFixed(2)} / 5년 ${sc(base['5년'].champ).toFixed(2)}, 단순 적립 ${sc(base['10년'].dca).toFixed(2)} / ${sc(base['5년'].dca).toFixed(2)})`);
if (/^[ST]\d+$/.test(arg || '')) {
  const P = JSON.parse(fs.readFileSync(path.join(R, 'steps', `${arg}-plan.json`)));
  for (const d of P.directions) { if (process.argv[3] && d.id !== process.argv[3]) continue;
    let combos = [{}]; for (const [k, vs] of Object.entries(d.vary || {})) combos = combos.flatMap(c => vs.map(v => Object.assign({}, c, { [k]: v })));
    for (const g of combos) { try { check({ name: `${d.id}:${d.title}` + (Object.keys(g).length ? '·' + Object.entries(g).map(([k, v]) => `${k}=${v}`).join(',') : ''), signals: d.signals, params: Object.assign({}, d.params || {}, g) }); } catch (e) { console.log(`${d.id}: 오류(확인 불가) ${String(e).slice(0, 120)}`); } }
  }
} else check(JSON.parse(arg));
