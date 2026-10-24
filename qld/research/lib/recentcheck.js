#!/usr/bin/env node
// T17: 2011~ check for indicators that only exist recently (Fear & Greed 2011~, daily put/call 2019~).
//   node lib/recentcheck.js Sxx [dirId]  |  node lib/recentcheck.js '<config json>'
// Windows: 5-year accumulation windows starting each January and July 2011..2021, Nasdaq-100 2x and S&P 2x, weekly 1,000,000 KRW.
// Pass (pre-registered for S29): on BOTH indices, IRR above the champion (v2) in more than half the windows AND worst IRR not below the champion's.
const fs = require('fs'), path = require('path'), C = require('./core.js'), R = path.join(__dirname, '..');
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const { ND, SP } = C.load(), E = C.E, champ = C.champion();
function wins(D) { const o = []; for (const m of [1, 7]) for (let y = 2011; y <= 2021; y++) {
  const a = E.idxOfDay(D, C.day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + 5, m - 1, 1) / 864e5 - 1;
  if (endD > D.day[D.n - 1]) continue; o.push([a, E.idxOfDay(D, endD, false)]); } return o; }
const irrs = (cfg, D) => { const run = C.runner(Object.assign({ money: { weekly: 1e6 } }, cfg)); return wins(D).map(([a, b]) => run(D, a, b).irr); };
const base = { ND: irrs(champ, ND), SP: irrs(champ, SP) };
function check(cfg) {
  const r = {}; let ok = true;
  for (const [k, D] of [['ND', ND], ['SP', SP]]) { const x = irrs(cfg, D), b = base[k], beat = x.filter((v, i) => v > b[i] + 1e-9).length, tie = x.filter((v, i) => Math.abs(v - b[i]) <= 1e-9).length;
    const pass = beat > x.length / 2 && Math.min(...x) >= Math.min(...b) - 1e-9; ok = ok && pass;
    r[k] = `${k === 'ND' ? '나스닥' : 'S&P 2배'} 우위 ${beat}/${x.length}(같음 ${tie}) · 중앙 ${(100 * (med(x) - med(b))).toFixed(2)}%p · 최악 ${(100 * Math.min(...x)).toFixed(1)} vs ${(100 * Math.min(...b)).toFixed(1)} ${pass ? '통과' : '미달'}`; }
  console.log(`${cfg.name}: ${r.ND} | ${r.SP} → ${ok ? '통과' : '미달'}`); return ok;
}
const arg = process.argv[2];
console.log(`2011~ 재확인 · 5년 구간 ${wins(ND).length}개(1·7월 시작 2011~2021) · 챔피언 ${champ.name}`);
if (/^S\d+$/.test(arg || '')) {
  const P = JSON.parse(fs.readFileSync(path.join(R, 'steps', `${arg}-plan.json`)));
  for (const d of P.directions) { if (process.argv[3] && d.id !== process.argv[3]) continue;
    let combos = [{}]; for (const [k, vs] of Object.entries(d.vary || {})) combos = combos.flatMap(c => vs.map(v => Object.assign({}, c, { [k]: v })));
    for (const g of combos) check({ name: `${d.id}` + (Object.keys(g).length ? '·' + Object.entries(g).map(([k, v]) => `${k}=${v}`).join(',') : ''), signals: d.signals, params: Object.assign({ strategy: true }, d.params || {}, g) }); }
} else check(JSON.parse(arg));
