// T21: generic composer of the ELEMENTS.md pool on top of the champion (v2). params.use = "MW,X4,HK,VRS,WR" (any subset).
// Each element keeps its registered value; logic copied from the element modules (S14 B, S14 C, S25 B/S27_common, S30 C, S34 C).
// Composition: exitVotes = HK (protection 3→2) then MW (+1 in the month-turn window); axes = X4; re-entry relaxations (VRS, WR) are OR'ed.
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), C7 = require('./S27_common.js'), U = require('./S30_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const use = new Set(String(p.use || '').split(',').filter(Boolean)), opt = {};
  const win = use.has('MW') ? E.monthWin(D, 2) : null, hike = use.has('HK') ? C7.hike(D, 1.5) : null;
  if (win || hike) opt.exitVotes = (j, need) => { let n = need; if (hike && hike[j] && n === 3) n = 2; if (win && win[j]) n += 1; return n; };
  if (use.has('X4')) opt.axes = j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && D.vols.rv10[j] >= 0.25 ? 1 : 0); };
  let vrs = null;
  if (use.has('VRS')) { const v = U.vrpZ(D), s = U.skewZ(D), hi = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) hi[j] = v[j] >= 1.0 ? 1 : 0;
    const mem = U.memory(hi, 20); vrs = new Uint8Array(D.n); for (let j = 0; j < D.n; j++) vrs[j] = mem[j] && s[j] <= 0 ? 1 : 0; }
  const wr = use.has('WR');
  if (vrs || wr) opt.timeout = { N: 0, ok: (j, st) => {
    if (vrs && vrs[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j]) return true;
    if (wr) { const s = st.outSince, t = s + 1; if (s >= 0 && j > t && j - s <= 5 && !E.macroOnset(D, P0, s) && st.a <= 2 && D.px[j] > D.px[t] && D.px[j] > D.ma[20][j]) return true; }
    return false; } };
  return C.run(D, opt);
};
