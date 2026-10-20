#!/usr/bin/env node
// T08: champion on 1960~1985 data (never used in research). Pre-registered in steps/T08-plan.md. Weekly 1,000,000 KRW.
const fs = require('fs'), path = require('path');
const E = require('../../src/engine.js'), R = path.join(__dirname, '..');
const day = s => Math.round(Date.parse(s) / 864e5), iso = d => new Date(d * 864e5).toISOString().slice(0, 10);
const med = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pc = x => (x * 100).toFixed(1), W = 1e6;
const load = (f, er) => E.prepData(JSON.parse(fs.readFileSync(path.join(R, 'data', f))), 2, er);
function wins(D, y0, y1, len) { const o = [];
  for (const m of [1, 7]) for (let y = y0; y <= y1; y++) { const a = E.idxOfDay(D, day(`${y}-${String(m).padStart(2, '0')}-02`), true), endD = Date.UTC(y + len, m - 1, 1) / 864e5 - 1;
    if (endD > day('1985-12-31')) continue; const b = E.idxOfDay(D, endD, false); if (b > a) o.push([a, b]); } return o; }
const STRATS = [['최종 전략 v1', { strategy: true }], ['기술 4축만', { strategy: true, useMacro: false }], ['단순 적립', { strategy: false }], ['(참고) 노출 조절', { strategy: true, rule: 'kelly' }]];
function group(D, w) { const o = {};
  for (const [nm, p] of STRATS) { const r = w.map(([a, b]) => E.runBT(D, a, b, Object.assign({ weeklyKRW: W }, p), false)); const irr = r.map(x => x.irr);
    o[nm] = { med: med(irr), min: Math.min(...irr), mdd: med(r.map(x => x.mddTwr)), exits: med(r.map(x => x.exits || x.nReb || 0)), win: r.filter((x, i) => x.irr > 0).length, irr }; }
  return o; }
function show(title, D, w) {
  const g = group(D, w), c = g['최종 전략 v1'], d = g['단순 적립'];
  console.log(`\n${title} · 구간 ${w.length}개 (IRR 중앙 / 최악 / MDD 중앙 / 매매 중앙)`);
  for (const [nm] of STRATS) { const x = g[nm]; console.log(`  ${nm.padEnd(10)} ${pc(x.med)} / ${pc(x.min)} / ${pc(x.mdd)} / ${x.exits}`); }
  const beat = c.irr.filter((v, i) => v > d.irr[i]).length;
  const A = c.min >= d.min, Bm = c.med >= d.med - 0.01, Cm = c.mdd > d.mdd;
  console.log(`  판정: (a) 최악 ${A ? '통과' : '실패'} (b) 중앙 −1%p 이내 ${Bm ? '통과' : '실패'} (c) MDD ${Cm ? '통과' : '실패'} → ${A && Bm && Cm ? '새 시대에서도 통함' : A && Cm ? '보험으로서는 통함' : !A ? '1970년대형 장세에서는 약함' : '혼합'} · 구간별 단순 적립보다 IRR 높음 ${beat}/${w.length}`);
  return g; }
const SP = load('hist_spx.json', 0.0089), I0 = load('hist_ixic0.json', 0.0095), ID = load('hist_ixicd.json', 0.0095);
// data sanity: total-return CAGR of the index and of the synthetic 2x
{ const a = E.idxOfDay(SP, day('1961-01-03'), true), b = SP.n - 1, y = (SP.day[b] - SP.day[a]) / 365.25;
  console.log(`S&P 총수익 1961~1985 연 ${pc(Math.pow(SP.ix[b] / SP.ix[a], 1 / y) - 1)}% · 합성 2배 연 ${pc(Math.pow(SP.lx[b] / SP.lx[a], 1 / y) - 1)}% · 1961~ 이탈 ${E.runBT(SP, a, b, { strategy: true, weeklyKRW: W }, false).exits}회`); }
show('S&P 2배 10년 (1961~1975 시작)', SP, wins(SP, 1961, 1975, 10));
show('S&P 2배 5년 (1961~1980 시작)', SP, wins(SP, 1961, 1980, 5));
show('(보조) 나스닥 종합 2배 5년 · 배당 0%', I0, wins(I0, 1973, 1980, 5));
show('(보조) 나스닥 종합 2배 5년 · 배당 S&P 수준', ID, wins(ID, 1973, 1980, 5));
show('(보조) 나스닥 종합 2배 10년 · 배당 0%', I0, wins(I0, 1973, 1975, 10));
console.log('\n사례 IRR (최종 v1 / 기술 4축 / 단순 적립 / 노출 조절), S&P 2배:');
for (const [n, a, b] of [['1965~67', '1965-01-04', '1967-12-29'], ['1968~71', '1968-01-02', '1971-12-31'], ['1972~75', '1972-01-03', '1975-12-31'], ['1976~79', '1976-01-02', '1979-12-31'], ['1980~83', '1980-01-02', '1983-12-30']]) {
  const i0 = E.idxOfDay(SP, day(a), true), i1 = E.idxOfDay(SP, day(b), false);
  console.log(`  ${n}: ` + STRATS.map(([, p]) => pc(E.runBT(SP, i0, i1, Object.assign({ weeklyKRW: W }, p), false).irr)).join(' / '));
}
const L = E.runBT(SP, E.idxOfDay(SP, day('1961-01-03'), true), SP.n - 1, { strategy: true, weeklyKRW: W }, true).log.filter(e => e.type === 'exit' || e.type === 'reentry');
console.log('\nS&P 매매 기록 (1961~): ' + L.map(e => `${iso(e.d)} ${e.type === 'exit' ? '이탈' : '복귀'}`).join(' · '));
