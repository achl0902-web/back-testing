#!/usr/bin/env node
// Guard for engine edits: `node lib/enginecheck.js --save` before editing src/engine.js, `node lib/enginecheck.js` after.
// Compares champion, DCA and the old rules on every validation window (≈670 runs). Must print "차이 0".
const fs = require('fs'), path = require('path');
const { E, sets } = require('./data.js');
const f = path.join(__dirname, '..', '.cache', 'engine-snapshot.json');
const cfgs = [{ strategy: false }, { strategy: true }, { strategy: true, rule: 'vol', peakRatio: 0.67 }, { strategy: true, weeklyKRW: 0, initialKRW: 1e8 }, { strategy: true, rule: 'kelly', sizing: 'steps', maxLev: 2 }];
const out = [];
for (const S of sets()) for (const [a, b] of S.w) for (const c of cfgs) { const r = E.runBT(S.D, a, b, Object.assign({ weeklyKRW: 700000 }, c), false); out.push([r.finalAfter, r.exits]); }
if (process.argv.includes('--save')) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(out)); console.log(`저장 ${out.length}개`); }
else { const old = JSON.parse(fs.readFileSync(f)); let m = 0, ex = 0; out.forEach((x, k) => { m = Math.max(m, Math.abs(x[0] / old[k][0] - 1)); if (x[1] !== old[k][1]) ex++; }); console.log(m < 1e-9 && !ex ? `차이 0 (${out.length}개)` : `차이 있음: 최대 상대차 ${m.toExponential(2)}, 이탈 수 다른 경우 ${ex}`); }
