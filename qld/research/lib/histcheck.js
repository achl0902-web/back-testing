#!/usr/bin/env node
// T13: re-check a research config on 1960~1985 S&P 2x data (never used to choose anything). Same windows as T08.
//   node lib/histcheck.js '<config json>'        config = {name, signals?, params}, as for score.js
//   node lib/histcheck.js Sxx [dirId]            every planned config of a step (or one direction)
//   add --era 1928 for the sealed 1928~1949 S&P 2x era (T23 data and windows; PROTOCOL A11: run once, only for a candidate
//   that already passed A1~A10; worst IRR of the 10- and 5-year groups must not be more than 2%p below the champion's)
// Output per config: Δ score vs the champion on the 10-year and 5-year window groups, score = IRR median + 0.5 × worst IRR,
// and the signal on-rate there (0% usually means the data the signal needs did not exist then: "확인 불가").
const fs = require('fs'), path = require('path');
const E = require('../../src/engine.js'), { highLow } = require('./data.js'), R = path.join(__dirname, '..');
const day = s => Math.round(Date.parse(s) / 864e5);
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const W = 1e6;
const ARGV = process.argv.slice(2), EI = ARGV.indexOf('--era'), ERA = EI >= 0 ? ARGV.splice(EI, 2)[1] : '1960';
const SPEC = ERA === '1928' ? { file: 'hist_spx1928.json', last: '1949-12-31', g10: [1929, 1940], g5: [1929, 1945], title: '1928~49 S&P 2배 봉인 구간 확인(A11, 한 번만)' }
  : { file: 'hist_spx.json', last: '1985-12-31', g10: [1961, 1975], g5: [1961, 1980], title: '1960~85 S&P 2배 재확인' };
const D = E.prepData(JSON.parse(fs.readFileSync(path.join(R, 'data', SPEC.file))), 2, 0.0089);
function wins(y0, y1, len) { const o = [];
  for (const m of [1, 7]) for (let y = y0; y <= y1; y++) { const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
    if (endD > day(SPEC.last)) continue; const b = E.idxOfDay(D, endD, false); if (b > a) o.push([a, b]); } return o; }
const G = { '10년': wins(SPEC.g10[0], SPEC.g10[1], 10), '5년': wins(SPEC.g5[0], SPEC.g5[1], 5) };
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
  const ok = ERA === '1928' ? r['10년'].min >= base['10년'].champ.min - 0.02 && r['5년'].min >= base['5년'].champ.min - 0.02 : r['10년'].d >= 0 && r['5년'].d >= 0;
  const a11 = ERA === '1928' ? ` · 최악 IRR 챔피언 대비 10년 ${((r['10년'].min - base['10년'].champ.min) * 100).toFixed(1)}%p 5년 ${((r['5년'].min - base['5년'].champ.min) * 100).toFixed(1)}%p (A11 기준 −2%p)` : '';
  console.log(`${cfg.name}: 10년 ${r['10년'].d >= 0 ? '+' : ''}${r['10년'].d.toFixed(2)} · 5년 ${r['5년'].d >= 0 ? '+' : ''}${r['5년'].d.toFixed(2)}${a11} → ${ok ? '통과' : '미달'}${rate ? ` (신호 ${rate})` : ''}`);
  return ok;
}

const arg = ARGV[0];
console.log(`${SPEC.title} · 10년 구간 ${G['10년'].length}개, 5년 ${G['5년'].length}개 · 점수 = 중앙 + 0.5 × 최악, 챔피언 대비 (챔피언 10년 ${sc(base['10년'].champ).toFixed(2)} / 5년 ${sc(base['5년'].champ).toFixed(2)}, 단순 적립 ${sc(base['10년'].dca).toFixed(2)} / ${sc(base['5년'].dca).toFixed(2)})`);
if (/^[ST]\d+$/.test(arg || '')) {
  const P = JSON.parse(fs.readFileSync(path.join(R, 'steps', `${arg}-plan.json`)));
  for (const d of P.directions) { if (ARGV[1] && d.id !== ARGV[1]) continue;
    let combos = [{}]; for (const [k, vs] of Object.entries(d.vary || {})) combos = combos.flatMap(c => vs.map(v => Object.assign({}, c, { [k]: v })));
    for (const g of combos) { try { check({ name: `${d.id}:${d.title}` + (Object.keys(g).length ? '·' + Object.entries(g).map(([k, v]) => `${k}=${v}`).join(',') : ''), signals: d.signals, params: Object.assign({}, d.params || {}, g) }); } catch (e) { console.log(`${d.id}: 오류(확인 불가) ${String(e).slice(0, 120)}`); } }
  }
} else check(JSON.parse(arg));
