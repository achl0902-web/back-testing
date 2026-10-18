#!/usr/bin/env node
// Automatic red-team battery for 1–3 finalists. Replaces most of the red-team / risk LLM work with code.
// usage: node lib/battery.js <config.json | inline JSON> --step S09 [--neighbors '{"z":[1.2,1.8]}'] [--placebo 20] [--md out.md]
// checks: full scorecard, neighbours (A4), cost x2 and July-start windows (A5), 1억 lump-sum, placebo (signal shifted
// in time by random offsets: is the score better than chance?), year-by-year attribution (is it one episode?),
// decisive trade differences vs champion, exits / taxes / longest time out (A7, practicality), auto-gate A1–A9.
const fs = require('fs');
const path = require('path');
const C = require('./core.js');
const { E, load, day } = C;
const args = process.argv.slice(2);
const opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };
const src = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const cfg = src.trim().startsWith('{') ? JSON.parse(src) : JSON.parse(fs.readFileSync(src));
const step = opt('--step', cfg.step || 'S00'); cfg.step = step; cfg.by = cfg.by || 'battery';
const nPlacebo = +opt('--placebo', 20);
const out = [];
const P = s => out.push(s);
const f1 = x => (x >= 0 ? '+' : '') + (x * 100).toFixed(1);

// ---- 1. scorecard
const s = C.summarize(C.evaluate(cfg), cfg); C.logTrial(cfg, s, 'battery');
P(`## 배터리 · ${cfg.name || 'candidate'}`); P('```'); P(JSON.stringify({ signals: cfg.signals, params: cfg.params })); P(C.printFull(cfg.name || 'candidate', s)); P('```');

// ---- 2. neighbours (A4)
let neighbors = opt('--neighbors') ? JSON.parse(opt('--neighbors')) : null;
if (!neighbors && cfg.params && cfg.params.z != null) neighbors = { z: [+(cfg.params.z * 0.8).toFixed(2), +(cfg.params.z * 1.2).toFixed(2)] };
const nb = [];
if (neighbors) for (const [k, vs] of Object.entries(neighbors)) for (const v of vs) {
  const c2 = Object.assign({}, cfg, { name: `${cfg.name} ${k}=${v}`, params: Object.assign({}, cfg.params, { [k]: v }) });
  const s2 = C.summarize(C.evaluate(c2), c2); C.logTrial(c2, s2, 'battery'); nb.push([`${k}=${v}`, s2]);
}
// ---- 3. stress (A5)
const st = [];
for (const [lab, extra] of [['비용 2배', { costMult: 2 }], ['7월 시작', { startMonth: 7 }], ['1억 거치', { money: { lump: 100000000 } }]]) {
  const c2 = Object.assign({}, cfg, extra, { name: `${cfg.name} ${lab}` });
  const s2 = C.summarize(C.evaluate(c2), c2); C.logTrial(c2, s2, 'battery'); st.push([lab, s2]);
}
P('\n**이웃값·스트레스** (점수 | 세트별 챔피언 대비 Δ중앙/Δ최악 %p | 사례 최악 | 이탈)'); P('```');
P(C.printBrief('중심값', s));
for (const [l, x] of nb) P(C.printBrief(l, x));
for (const [l, x] of st) P(C.printBrief(l, x));
P('```');

// ---- 4. placebo: circularly shift every signal array by a random offset (keeps on-rate and clustering)
let placeboPct = null;
if (cfg.signals && nPlacebo > 0) {
  const scores = [];
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < nPlacebo; k++) {
    const off = 252 + Math.floor(rnd() * 6000);
    const c2 = Object.assign({}, cfg, { name: `placebo ${off}`, signals: 'lib/shiftsig.js', params: Object.assign({}, cfg.params, { _base: cfg.signals, _shift: off }) });
    scores.push(C.summarize(C.evaluate(c2, { noFull: true }), c2).overall.score);
  }
  scores.sort((a, b) => a - b);
  placeboPct = scores.filter(x => x < s.overall.score).length / scores.length;
  if (cfg.params && cfg.params.rule === 'sig') { P('\n(주의: rule "sig" 대체형은 이동하면 챔피언 규칙까지 깨지므로 플라시보가 의미 없음 → A10 해당 없음)'); placeboPct = null; }
  P(`\n**플라시보** (같은 신호를 시간축으로 무작위 이동 ${nPlacebo}회): 후보 점수 ${s.overall.score.toFixed(2)} · 플라시보 중앙 ${scores[scores.length >> 1].toFixed(2)} · 상위 10% ${scores[Math.floor(scores.length * 0.9)].toFixed(2)} · 최대 ${scores[scores.length - 1].toFixed(2)} → 후보가 플라시보의 ${(placeboPct * 100).toFixed(0)}%보다 높음`);
}

// ---- 5. full-period run 1986~: year attribution, decisive differences, practicality
const { ND } = load();
const i0 = E.idxOfDay(ND, day('1986-01-02'), true), i99 = E.idxOfDay(ND, day('1999-01-04'), true);
const champCfg = C.champion();
const rc = C.runner(champCfg)(ND, i0, ND.n - 1, true), rx = C.runner(cfg)(ND, i0, ND.n - 1, true);
const yr = {};
for (let k = 1; k < rc.twr.length; k++) { const y = new Date(ND.day[i0 + k] * 864e5).getUTCFullYear(); yr[y] = yr[y] || [1, 1]; yr[y][0] *= rc.twr[k] / rc.twr[k - 1]; yr[y][1] *= rx.twr[k] / rx.twr[k - 1]; }
const diffs = Object.entries(yr).map(([y, [a, b]]) => [y, Math.log(b) - Math.log(a)]).filter(d => Math.abs(d[1]) > 0.002).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
const tot = diffs.reduce((t, d) => t + d[1], 0), gross = diffs.reduce((t, d) => t + Math.abs(d[1]), 0);
P(`\n**연도별 기여** (1986~ 시간가중 로그수익 차이, 챔피언 대비): 합계 ${f1(tot)}%p · 상위 연도: ` + diffs.slice(0, 6).map(([y, d]) => `${y} ${f1(d)}`).join(', ') + (gross > 0 ? ` · 최대 1개 연도 비중 ${(Math.abs(diffs[0][1]) / gross * 100).toFixed(0)}%` : ''));
const ev = r => r.log.filter(e => e.type === 'exit' || e.type === 'reentry').map(e => `${new Date(e.d * 864e5).toISOString().slice(0, 10)} ${e.type === 'exit' ? '이탈' : '복귀'}`);
const ec = new Set(ev(rc)), ex = new Set(ev(rx));
const only = [...ex].filter(x => !ec.has(x)).map(x => '+ ' + x), gone = [...ec].filter(x => !ex.has(x)).map(x => '− ' + x);
P(`\n**챔피언과 다른 매매** (+ 후보에만, − 챔피언에만; 최대 16개): ` + [...only, ...gone].sort((a, b) => a.slice(2).localeCompare(b.slice(2))).slice(0, 16).join(' · '));
// margin of the indicator on decisive days (catalog candidates)
if (cfg.signals === 'lib/catsig.js') {
  const { zOf } = require('./catalog.js'); const { z } = zOf(ND, cfg.params.ind);
  const dset = [...only, ...gone].map(x => day(x.slice(2, 12)));
  const marg = dset.map(d => { const j = ND.day.findIndex(v => v >= d) - 1; return j > 0 ? Math.abs(z[j] - cfg.params.z) : NaN; }).filter(v => !isNaN(v));
  if (marg.length) P(`문턱 여유 (다른 매매 직전 신호일의 |z − 문턱|): 최소 ${Math.min(...marg).toFixed(2)} · 중앙 ${C.med(marg).toFixed(2)} (0.05 미만이면 경계값 우연 의심)`);
}
const longestOut = r => { let m = 0, c = 0; for (const e of r.expo) { if (e < 0.02) { c++; m = Math.max(m, c); } else c = 0; } return m; };
const r99c = C.runner(champCfg)(ND, i99, ND.n - 1, true), r99x = C.runner(cfg)(ND, i99, ND.n - 1, true);
P(`\n**실행** (1999~ 주 70만): 이탈 ${r99x.exits}회 (챔피언 ${r99c.exits}) · 납부 양도세 ${(r99x.taxesPaid / 1e8).toFixed(0)}억 (챔피언 ${(r99c.taxesPaid / 1e8).toFixed(0)}억) · 최장 시장 밖 ${longestOut(r99x)}거래일 (챔피언 ${longestOut(r99c)}) · 세후 최종 ${(r99x.finalAfter / 1e8).toFixed(0)}억 (챔피언 ${(r99c.finalAfter / 1e8).toFixed(0)}억)`);

// ---- 5b. international synthetic 2x (only with --intl; user decision 2026-10-18: validation scope is Nasdaq + S&P)
if (args.includes('--intl')) try {
  const I = require('./intl.js'); const it = Object.values(I.evaluate(cfg));
  const changed = it.filter(v => v.changed > 0);
  P(`\n**해외 합성 2배** (챔피언 대비 Δ중앙/Δ최악, 달라진 구간 승-패): ` + it.map(v => `${v.label} ${f1(v.dMed)}/${f1(v.dMin)} ${v.win}-${v.lose}`).join(' · ') + ` → 발동한 시장 ${changed.length}/5`);
} catch (e) { P('\n(해외 검증 실패: ' + String(e).slice(0, 80) + ')'); }

// ---- 6. auto-gate
const trials = fs.readFileSync(path.join(C.R, 'trials.jsonl'), 'utf8').split('\n').filter(l => l.includes(`"step":"${step}"`)).length;
const k2 = trials > 30 ? 2 : 1;
const A1raw = ['N10oos', 'S10', 'S5'].every(k => s.sets[k].dMed >= -0.01 && s.sets[k].dMin >= -0.02);
const untouched = ['S10', 'S5'].every(k => Math.abs(s.sets[k].dMed) < 1e-6 && Math.abs(s.sets[k].dMin) < 1e-6);
const A1 = A1raw && !untouched;
const A2 = ['N10', 'N10oos', 'N5'].some(k => s.sets[k].dMin >= 0.02 * k2) || (s.sets.N10.dMed >= 0.01 * k2 && s.sets.N10oos.dMed >= 0.01 * k2);
const epv = Object.values(s.episodes).map(e => e.vsChamp);
const A3 = epv.every(v => v >= -0.05) && epv.filter(v => v >= -1e-9).length >= 4;
const okA13 = x => ['N10oos', 'S10', 'S5'].every(k => x.sets[k].dMed >= -0.01 && x.sets[k].dMin >= -0.02) && Object.values(x.episodes).every(e => e.vsChamp >= -0.05);
const A4 = nb.length ? nb.every(([, x]) => okA13(x) && x.overall.score > 0) : null;
const A5 = st.slice(0, 2).every(([, x]) => x.overall.score > 0);
const A7 = r99x.exits <= 40;
const A10 = placeboPct == null ? null : placeboPct >= 0.95;
const mark = v => v === null ? '해당 없음' : v ? '통과' : '실패';
P(`\n**자동 판정** (이 스텝 시도 ${trials}회 → A2 기준 ×${k2})`);
P(`A1 표본 밖 ${untouched ? '확인 불가 (S&P 세트에서 규칙이 한 번도 발동하지 않음)' : mark(A1)} · A2 개선 ${mark(A2)} · A3 사례 ${mark(A3)} · A4 이웃값 ${mark(A4)} · A5 스트레스 ${mark(A5)} · A7 이탈 ${mark(A7)} · A10 플라시보 95% ${mark(A10)} · A6·A8은 비평가가 코드로 확인`);
const pass = A1 && A2 && A3 && A4 !== false && A5 && A7 && A10 !== false;
P(`→ 숫자 기준 ${pass ? '모두 통과 (A6·A8 확인 필요)' : '미달'}`);

const text = out.join('\n');
console.log(text);
if (opt('--md')) fs.appendFileSync(path.resolve(opt('--md')), text + '\n\n');
