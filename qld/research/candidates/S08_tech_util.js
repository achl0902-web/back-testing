// Shared helpers for S08 technical candidates (no look-ahead: every array value at j uses data up to day j only).
const fs = require('fs'), path = require('path');
const M = require('../lib/macro.js');
const day = s => Math.round(Date.parse(s) / 86400000);
// 10-year Treasury yield (FRED DGS10, %), published next day -> lag 1
const y10 = D => M.series(D, 'DGS10', 1);
// k-day change of a series
const chg = (a, k) => a.map((v, i) => i >= k ? v - a[i - k] : NaN);
// first day a boolean state turns on (onset)
const onset = st => { const o = new Uint8Array(st.length); for (let j = 1; j < st.length; j++) o[j] = st[j] && !st[j - 1] ? 1 : 0; return o; };
// closing value of the other index (same closing time as D.px -> lag 0), forward-filled
function closeOf(D, file) {
  const m = new Map();
  for (const ln of fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'macro', file), 'utf8').trim().split('\n').slice(1)) {
    const [d, , , c] = ln.split(','); m.set(day(d), +c);
  }
  const a = new Float64Array(D.n).fill(NaN); let last = NaN;
  for (let i = 0; i < D.n; i++) { const v = m.get(D.day[i]); if (isFinite(v)) last = v; a[i] = last; }
  return a;
}
// MA200 trend helpers
const below200 = (D, j) => !isNaN(D.ma[200][j]) && D.px[j] < D.ma[200][j];
const falling200 = (D, j, k) => k <= 0 || (j >= k && D.ma[200][j] < D.ma[200][j - k]);
module.exports = { M, y10, chg, onset, closeOf, below200, falling200 };
