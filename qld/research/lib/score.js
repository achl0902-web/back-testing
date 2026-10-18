#!/usr/bin/env node
// Standard scorecard for one candidate (or a pre-registered grid). Every run is logged to trials.jsonl.
// usage: node lib/score.js <config.json | inline JSON> [--grid '{"key":[v1,v2]}'] [--brief] [--quiet] [--json] [--no-log]
// config: name, step, by, sim ("engine"|"buy"), params, signals (module path relative to research/),
//         money ({"weekly":700000} | {"lump":100000000}), costMult, startMonth (1|7)
// Baselines (DCA, champion) are cached in research/.cache, so a run is one simulation pass (~1–2 s).
const fs = require('fs');
const C = require('./core.js');
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const k = args.indexOf(f); return k >= 0 ? args[k + 1] : null; };
const src = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--grid');
if (!src) { console.error('config required'); process.exit(1); }
const cfg0 = src.trim().startsWith('{') ? JSON.parse(src) : JSON.parse(fs.readFileSync(src));
// reject unknown top-level keys: a parameter placed outside "params" would silently run the champion (S11 critic)
const KNOWN = ['name', 'step', 'by', 'sim', 'params', 'signals', 'money', 'costMult', 'startMonth', 'fam', 'label'];
const bad = Object.keys(cfg0).filter(k => !KNOWN.includes(k));
if (bad.length) { console.error(`알 수 없는 설정 키: ${bad.join(', ')} — 파라미터는 "params" 안에 넣는다`); process.exit(1); }
const grid = opt('--grid') ? JSON.parse(opt('--grid')) : null;
const combos = [{}];
if (grid) for (const [k, vs] of Object.entries(grid)) { const nx = []; for (const c of combos) for (const v of vs) nx.push(Object.assign({}, c, { [k]: v })); combos.splice(0, combos.length, ...nx); }
const results = [];
for (const g of combos) {
  const cfg = Object.assign({}, cfg0, { params: Object.assign({}, cfg0.params || {}, g) });
  const s = C.summarize(C.evaluate(cfg), cfg);
  if (!flag('--no-log')) C.logTrial(cfg, s);
  const name = (cfg.name || 'candidate') + (grid ? ' ' + JSON.stringify(g) : '');
  results.push({ name, params: cfg.params, score: s });
  if (!flag('--quiet')) console.log(flag('--brief') ? C.printBrief(name, s) : C.printFull(name, s));
}
if (flag('--json')) console.log(JSON.stringify(results));
