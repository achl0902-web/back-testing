#!/usr/bin/env node
// Broad automatic screen: every catalog indicator × hook (vote/alarm/block) × z threshold {1, 1.5, 2},
// plus structural action variants. No LLM tokens: run it, then read only the compact summary.
//
// usage: node lib/screen.js --step S09 [--fam price,rates] [--hooks vote,block] [--z 1,1.5,2] [--top 25] [--extra extra.json]
//        node lib/screen.js --step S09 --pairs steps/S09-screen.jsonl [--pairTop 10]   (two-indicator AND combos of the best singles)
//   --extra: JSON array of additional configs (same format as score.js) to include, e.g. strategist ideas
// output: steps/<step>-screen.jsonl (all results) and a compact table on stdout
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const os = require('os');

const args = process.argv.slice(2);
const opt = (f, d) => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : d; };

if (args[0] === '--worker') {
  const C = require('./core.js');
  const list = JSON.parse(fs.readFileSync(args[1]));
  for (const cfg of list) {
    try { const s = C.summarize(C.evaluate(cfg), cfg); process.send({ cfg, s }); }
    catch (e) { process.send({ cfg, err: String(e).slice(0, 200) }); }
  }
  process.exit(0);
}

if (require.main !== module) return;
const C = require('./core.js');
const { CATALOG } = require('./catalog.js');
const step = opt('--step', 'S00');
const fams = opt('--fam', null) ? opt('--fam').split(',') : null;
const hooks = opt('--hooks', 'vote,alarm,block').split(',');
const zs = opt('--z', '1,1.5,2').split(',').map(Number);
const top = +opt('--top', 25);

const list = [];
for (const [key, fam, label] of CATALOG) {
  if (fams && !fams.includes(fam)) continue;
  for (const hook of hooks) for (const z of zs)
    list.push({ name: `${key}·${hook}·z${z}`, step, by: 'screen', fam, label, signals: 'lib/catsig.js', params: { strategy: true, ind: key, hook, z } });
}
// pairwise AND of the best indicators from an earlier screen: --pairs <screen.jsonl> [--pairTop 10]
if (opt('--pairs')) {
  const prev = fs.readFileSync(path.resolve(opt('--pairs')), 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(r => r.cfg && r.cfg.params && r.cfg.params.ind && !r.cfg.params.ind2);
  const best = {}; for (const r of prev) { const k = r.cfg.params.ind; if (!best[k] || r.overall.score > best[k].overall.score) best[k] = r; }
  const topInd = Object.values(best).sort((a, b) => b.overall.score - a.overall.score).slice(0, +opt('--pairTop', 10)).map(r => r.cfg.params.ind);
  list.length = 0;
  for (let a = 0; a < topInd.length; a++) for (let b = a + 1; b < topInd.length; b++) for (const hook of hooks.filter(h => h !== 'alarm'))
    list.push({ name: `${topInd[a]}&${topInd[b]}·${hook}·z1`, step, by: 'screen', fam: 'pair', label: '두 지표 동시', signals: 'lib/catsig.js', params: { strategy: true, ind: topInd[a], ind2: topInd[b], hook, z: 1, z2: 1 } });
}
// structural action variants (no indicator): de-lever to QQQ instead of SGOV when out; volatility-sized exposure rules
if (!opt('--pairs') && (!fams || fams.includes('action'))) {
  for (const [nm, p] of [['volsteps2x', { rule: 'kelly', sizing: 'steps', maxLev: 2 }], ['volsteps2.5x', { rule: 'kelly', sizing: 'steps', maxLev: 2.5 }], ['kellyHalf', { rule: 'kelly', sizing: 'kelly', kellyFrac: 0.5, maxLev: 2 }], ['oldVol35', { rule: 'vol', peakRatio: 0.67 }], ['votes3', { votes: 3 }], ['noMacro', { useMacro: false }], ['hold20', { hold: 20 }], ['hold60', { hold: 60 }],
    // action types (S09): staged exit, core holding, buying while out, contrarian re-entry, cap on time out
    ...[0.33, 0.5, 0.67].map(v => [`fExit1_${v}`, { fExit1: v }]), ...[0.2, 0.33, 0.5].map(v => [`fCore_${v}`, { fCore: v }]),
    ...[0.25, 0.5, 1].map(v => [`contribOut_${v}`, { contribOut: v }]), ...[0.2, 0.3, 0.4].map(v => [`ddRe_${v}`, { ddRe: v }]),
    ...[60, 120, 250].map(v => [`maxOut_${v}`, { maxOut: v }])])
    list.push({ name: `action·${nm}`, step, by: 'screen', fam: 'action', label: '구조 변형', params: Object.assign({ strategy: true }, p) });
}
// structural action variants (no indicator): de-lever to QQQ instead of SGOV when out
if (!opt('--pairs') && (!fams || fams.includes('action'))) for (const pq of [0.5, 1]) list.push({ name: `action·parkQQQ${pq}`, step, by: 'screen', fam: 'action', label: `이탈 시 QQQ ${pq * 100}%로 감속`, params: { strategy: true, parkQQQ: pq } });
if (opt('--extra')) for (const c of JSON.parse(fs.readFileSync(opt('--extra')))) list.push(Object.assign({ step, by: 'strategist', fam: 'extra' }, c));

// warm the baseline cache once before forking
C.cached('dca', {}); C.cached('champ', {});
const nW = Math.max(1, Math.min(os.cpus().length, 4));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-'));
let out = path.join(C.R, 'steps', `${step}-screen.jsonl`);
for (let k = 2; fs.existsSync(out); k++) out = path.join(C.R, 'steps', `${step}-screen-${k}.jsonl`); // never overwrite an earlier screen
fs.writeFileSync(out, '');
const results = [];
let done = 0; const t0 = Date.now();
const chunks = Array.from({ length: nW }, (_, w) => list.filter((_, i) => i % nW === w));
let alive = chunks.length;
chunks.forEach((chunk, w) => {
  const f = path.join(tmp, `w${w}.json`); fs.writeFileSync(f, JSON.stringify(chunk));
  const ch = fork(__filename, ['--worker', f], { stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  ch.on('message', m => {
    done++; results.push(m);
    fs.appendFileSync(out, JSON.stringify(m.err ? { name: m.cfg.name, err: m.err } : { name: m.cfg.name, fam: m.cfg.fam, label: m.cfg.label, cfg: m.cfg, overall: m.s.overall, sets: Object.fromEntries(Object.entries(m.s.sets).map(([k, v]) => [k, { dMed: v.dMed, dMin: v.dMin, irrMed: v.irrMed, irrMin: v.irrMin }])), episodes: m.s.episodes }) + '\n');
    if (done % 50 === 0) process.stderr.write(`  ${done}/${list.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  });
  ch.on('exit', () => { if (--alive === 0) finish(); });
});

function finish() {
  const ok = results.filter(r => !r.err);
  // one trial record per screened config (multiple-testing ledger)
  const tr = path.join(C.R, 'trials.jsonl');
  fs.appendFileSync(tr, ok.map(r => JSON.stringify({ t: new Date().toISOString(), step, by: r.cfg.by, name: r.cfg.name, params: r.cfg.params, signals: r.cfg.signals || null, screen: true, score: +r.s.overall.score.toFixed(3) })).join('\n') + (ok.length ? '\n' : ''));
  ok.sort((a, b) => b.s.overall.score - a.s.overall.score);
  console.log(`스크린 ${step}: ${ok.length}개 설정, 오류 ${results.length - ok.length}개, ${((Date.now() - t0) / 1000).toFixed(0)}초. 점수 = min(발견세트, 확인세트)의 평균(Δ중앙+0.5·Δ최악) %p − 사례 5%p 초과 악화 벌점`);
  console.log(`점수 0 초과: ${ok.filter(r => r.s.overall.score > 0).length}개 · 0.5 초과: ${ok.filter(r => r.s.overall.score > 0.5).length}개 · 1 초과: ${ok.filter(r => r.s.overall.score > 1).length}개`);
  console.log(`\n상위 ${top} (점수 | 세트별 챔피언 대비 Δ중앙/Δ최악 %p | 사례 최악 | 1999~ 이탈 | 이름)`);
  for (const r of ok.slice(0, top)) console.log(C.printBrief(`${r.cfg.name} (${r.cfg.label})`, r.s));
  const byFam = {};
  for (const r of ok) { const f = r.cfg.fam; if (!byFam[f] || r.s.overall.score > byFam[f].s.overall.score) byFam[f] = r; }
  console.log('\n가족별 최고:');
  for (const [f, r] of Object.entries(byFam).sort((a, b) => b[1].s.overall.score - a[1].s.overall.score)) console.log(`  ${f.padEnd(10)} ${r.s.overall.score.toFixed(2).padStart(6)}  ${r.cfg.name}`);
  for (const e of results.filter(r => r.err).slice(0, 5)) console.log('오류:', e.cfg.name, e.err);
  console.log(`\n전체 결과: ${path.relative(C.R, out)}`);
}
