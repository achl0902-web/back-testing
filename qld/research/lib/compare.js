#!/usr/bin/env node
// Side-by-side scorecard of whole strategies (not candidates vs champion): IRR median / worst / MDD median per set, cases, 1999~ run.
// usage: node lib/compare.js [--weekly 1000000]
const C = require('./core.js');
const args = process.argv.slice(2), opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };
const money = { weekly: +opt('--weekly', 700000) };
const S = { '단순 적립': { strategy: false }, '최종 전략 v1': { strategy: true }, '노출 조절': { strategy: true, rule: 'kelly' } };
const res = {};
for (const [nm, p] of Object.entries(S)) {
  const cfg = { name: nm, params: p, money }; const r = C.evaluate(cfg, { base: !p.strategy });
  res[nm] = r;
}
const pct = x => (x * 100).toFixed(1);
console.log(`주 ${money.weekly / 1e4}만원 · 세트별 IRR 중앙 / 최악 / MDD 중앙 (%) · 세트 점수 = 중앙 + 0.5·최악`);
const sets = Object.keys(res['단순 적립'].sets), score = {};
for (const k of sets) {
  const row = [];
  for (const nm of Object.keys(S)) {
    const irr = res[nm].sets[k].map(x => x.irr), mdd = res[nm].sets[k].map(x => x.mdd);
    const m = C.med(irr), w = Math.min(...irr); score[nm] = score[nm] || {}; score[nm][k] = m + 0.5 * w;
    row.push(`${nm} ${pct(m)}/${pct(w)}/${pct(C.med(mdd))} [${pct(m + 0.5 * w)}]`);
  }
  console.log(`${k.padEnd(6)} ${row.join(' · ')}`);
}
const a = '최종 전략 v1', b = '노출 조절';
const wa = sets.filter(k => score[a][k] > score[b][k]).length, wb = sets.filter(k => score[b][k] > score[a][k]).length;
console.log(`세트 점수 승: ${a} ${wa} · ${b} ${wb}`);
console.log('사례 IRR (단순 적립 / 최종 / 노출 조절): ' + Object.keys(res[a].episodes).map(e => `${e} ${Object.keys(S).map(nm => pct(res[nm].episodes[e].irr)).join('/')}`).join(' · '));
console.log('1999~ 실행: ' + Object.keys(S).map(nm => { const f = res[nm].full; return `${nm} IRR ${pct(f.irr)} · MDD ${pct(f.mdd)} · 세후 ${(f.fin / 1e8).toFixed(0)}억 · 매매 ${f.exits}`; }).join(' | '));
