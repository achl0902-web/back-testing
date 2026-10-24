// T14: S26 A for the 1960~85 check (steps/T14-plan.md). Same rule and values as candidates/S26_A.js; only the oil and dollar
// series are replaced by their monthly FRED histories (the daily series start in 1986/1980). Before 1973 the dollar is NaN
// (fixed rates), so it never counts as overheated. Not a research candidate: run it with lib/histcheck.js only.
const fs = require('fs'), path = require('path');
const L = require('./S09_lib.js'), K = require('../lib/catalog.js'), C = require('./S26_common.js');
const day = s => Math.round(Date.parse(s) / 864e5);
function series(D, file, lag) { // forward-filled after the publication lag, NaN 90 days after the last observation (as lib/macro.js)
  const obs = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map(r => r.split(',')).filter(([d, v]) => d && isFinite(parseFloat(v)))
    .map(([d, v]) => [day(d.slice(0, 10)) + lag, parseFloat(v)]).sort((a, b) => a[0] - b[0]);
  const a = new Float64Array(D.n).fill(NaN), last = obs.length ? obs[obs.length - 1][0] : -1e9; let k = -1;
  for (let i = 0; i < D.n; i++) { while (k + 1 < obs.length && obs[k + 1][0] <= D.day[i]) k++; if (k >= 0 && D.day[i] <= last + 90) a[i] = obs[k][1]; }
  return a;
}
const R = path.join(__dirname, '..'), ret = K.helpers.ret;
module.exports = (D, p) => {
  const ppi = ret(series(D, path.join(R, '..', 'data', 'macro', 'PPIACO.csv'), 50), 252);
  const oil = ret(series(D, path.join(R, 'data', 'hist', 'WTISPLC.csv'), 35), 126);
  const usd = ret(series(D, path.join(R, 'data', 'hist', 'TWEXMMTH.csv'), 35), 126);
  const zs = [usd, ppi, oil].map(a => K.zscore(Float64Array.from(a, v => isFinite(v) ? v : NaN))), z = p.z ?? 1.5, need = p.need ?? 2;
  const blk = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) { let c = 0; for (const s of zs) if (s[j] > z) c++; blk[j] = c >= need ? 1 : 0; }
  const win = C.monthWin(D, p.pad ?? 2), out = L.run(D, { exitVotes: (j, n) => win[j] ? n + 1 : n, enterOk: j => !blk[j] });
  out.inflBlock = blk; // reported as an on-rate by histcheck (not a hook: run() already applied it)
  return out;
};
