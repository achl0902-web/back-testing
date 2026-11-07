#!/usr/bin/env node
// T23: champion on the untouched 1928~1949 S&P 2x data (pre-registered in steps/T23-plan.md). Weekly 1,000,000 KRW.
// Rules unchanged. Macro alarm is off by the existing rule (only 4 indicators existed); v2's inflation block uses
// lib/v2.js inflBlockHist (oil from 1946, so it can only switch on from 1947). Build data first: python3 lib/build_era1928.py
const fs = require('fs'), path = require('path');
const E = require('../../src/engine.js'), V2 = require('./v2.js'), R = path.join(__dirname, '..');
const day = s => Math.round(Date.parse(s) / 864e5), iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pc = x => (x * 100).toFixed(1), W = 1e6, LAST = day('1949-12-31');
const load = f => { const D = E.prepData(JSON.parse(fs.readFileSync(path.join(R, 'data', f))), 2, 0.0089); D.ib = V2.inflBlockHist(D); return D; };
function wins(D, y0, y1, len, months) { const o = [];
  for (const m of months) for (let y = y0; y <= y1; y++) { const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
    if (endD > LAST) continue; const b = E.idxOfDay(D, endD, false); if (b > a) o.push([a, b]); } return o; }
const STRATS = [['최종 전략 v1', { strategy: true }], ['최종 전략 v2', { strategy: true, inflBlock: true }], ['단순 적립', { strategy: false }]];
function show(title, D, w, judge = true) {
  const g = {};
  for (const [nm, p] of STRATS) { const r = w.map(([a, b]) => E.runBT(D, a, b, Object.assign({ weeklyKRW: W }, p), false)); const irr = r.map(x => x.irr);
    g[nm] = { med: med(irr), min: Math.min(...irr), mdd: med(r.map(x => x.mddTwr)), exits: med(r.map(x => x.exits)), irr }; }
  console.log(`\n${title} · 구간 ${w.length}개 (IRR 중앙 / 최악 / 시간가중 MDD 중앙 / 이탈 중앙)`);
  for (const [nm] of STRATS) { const x = g[nm]; console.log(`  ${nm.padEnd(8)} ${pc(x.med)} / ${pc(x.min)} / ${pc(x.mdd)} / ${x.exits}`); }
  const c = g['최종 전략 v1'], d = g['단순 적립'], beat = c.irr.filter((v, i) => v > d.irr[i]).length;
  const A = c.min >= d.min, B = c.med >= d.med - 0.01, Cc = c.mdd > d.mdd;
  if (judge) console.log(`  판정: (a) 최악 ${A ? '통과' : '실패'} (b) 중앙 −1%p 이내 ${B ? '통과' : '실패'} (c) MDD ${Cc ? '통과' : '실패'} → ${A && B && Cc ? '손대지 않은 시대에서도 통함' : A && Cc ? '보험으로서는 통함' : !A ? '그 시대에는 약함' : '혼합'}`);
  console.log(`  구간별 v1이 단순 적립보다 IRR 높음 ${beat}/${w.length} · v2−v1 최대 ${pc(Math.max(...g['최종 전략 v2'].irr.map((v, i) => v - c.irr[i])))}%p`);
  return g;
}
for (const [f, label] of [['hist_spx1928.json', '단기 국채 금리(주 시험)'], ['hist_spx1928cp.json', '민감도: 1933년 이전 기업어음 금리']]) {
  const D = load(f), main = f === 'hist_spx1928.json';
  const a = E.idxOfDay(D, day('1928-01-03'), true), b = D.n - 1, y = (D.day[b] - D.day[a]) / 365.25;
  console.log(`\n===== ${label} =====`);
  console.log(`데이터: S&P 총수익 1928~1949 연 ${pc(Math.pow(D.ix[b] / D.ix[a], 1 / y) - 1)}% · 합성 2배 연 ${pc(Math.pow(D.lx[b] / D.lx[a], 1 / y) - 1)}% · 2배 최대 낙폭 ${pc(Math.min(...Array.from(D.lx).map((v, i, A) => v / Math.max(...A.slice(0, i + 1)) - 1).filter((_, i) => i % 5 === 0)))}% · 인플레 과열 켜진 날 ${D.ib.reduce((s, v) => s + v, 0)}`);
  show('S&P 2배 10년 (1929~1940 시작, 1·7월)', D, wins(D, 1929, 1940, 10, [1, 7]), main);
  show('S&P 2배 5년 (1929~1945 시작, 1·7월)', D, wins(D, 1929, 1945, 5, [1, 7]), main);
  if (!main) continue;
  const all = Array.from({ length: 12 }, (_, k) => k + 1);
  show('(보조) 10년, 시작 월 1~12 전부', D, wins(D, 1929, 1940, 10, all), false);
  show('(보조) 5년, 시작 월 1~12 전부', D, wins(D, 1929, 1945, 5, all), false);
  console.log('\n사례 IRR (v1 / v2 / 단순 적립):');
  for (const [n, s, e] of [['1929~32', '1929-01-02', '1932-12-30'], ['1937~38', '1936-07-01', '1938-12-30'], ['1940~42', '1939-07-03', '1942-12-31'], ['1946~49', '1946-01-02', '1949-12-30']]) {
    const i0 = E.idxOfDay(D, day(s), true), i1 = E.idxOfDay(D, day(e), false);
    console.log(`  ${n}: ` + STRATS.map(([, p]) => pc(E.runBT(D, i0, i1, Object.assign({ weeklyKRW: W }, p), false).irr)).join(' / '));
  }
  const L = E.runBT(D, a, b, { strategy: true, weeklyKRW: W }, true).log.filter(e => e.type === 'exit' || e.type === 'reentry');
  console.log(`\nv1 매매 ${L.length}건 (1928~49), 1929~1933만: ` + L.filter(e => D.day && iso(e.d) < '1934').map(e => `${iso(e.d)} ${e.type === 'exit' ? '이탈' : '복귀'}`).join(' · '));
}
