// Load a macro series from ../data/macro aligned to trading days with a publication lag (no look-ahead).
//   const M = require('../lib/macro.js');
//   const cpi = M.series(D, 'CPIAUCSL', 45);       // FRED csv: value known 45 calendar days after its observation date
//   const tnx = M.series(D, 'Y_TNX', 1);           // Yahoo csv (Y_*.csv)
// Values are forward-filled from the last published observation and become NaN 90 days after a series ends.
// Helpers: change(a, k) = a[i]-a[i-k];  pctChange(a, k);  yoy for monthly series = pctChange(a, 252);  z(a, win=756, min=252)
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', '..', 'data', 'macro');
const day = s => Math.round(Date.parse(s) / 86400000);
function read(name) {
  const f = path.join(DIR, name.endsWith('.csv') ? name : name + '.csv');
  const rows = fs.readFileSync(f, 'utf8').trim().split('\n').slice(1);
  const out = [];
  for (const r of rows) { const [d, v] = r.split(','); const x = parseFloat(v); if (d && isFinite(x)) out.push([day(d.slice(0, 10)), x]); }
  return out.sort((a, b) => a[0] - b[0]);
}
function series(D, name, lagDays) {
  if (lagDays == null) throw new Error('lagDays required (publication lag)');
  const obs = read(name).map(([d, v]) => [d + lagDays, v]);
  const a = new Float64Array(D.n).fill(NaN); let k = -1;
  const last = obs.length ? obs[obs.length - 1][0] : -1e9;
  for (let i = 0; i < D.n; i++) {
    while (k + 1 < obs.length && obs[k + 1][0] <= D.day[i]) k++;
    if (k >= 0 && D.day[i] <= last + 90) a[i] = obs[k][1];
  }
  return a;
}
const change = (a, k) => a.map((v, i) => i >= k ? v - a[i - k] : NaN);
const pctChange = (a, k) => a.map((v, i) => i >= k ? v / a[i - k] - 1 : NaN);
function z(a, win = 756, min = 252) {
  const o = new Float64Array(a.length).fill(NaN);
  for (let i = 0; i < a.length; i++) {
    let s = 0, s2 = 0, n = 0;
    for (let k = Math.max(0, i - win + 1); k <= i; k++) if (!isNaN(a[k])) { s += a[k]; s2 += a[k] * a[k]; n++; }
    if (n >= min && !isNaN(a[i])) { const m = s / n, sd = Math.sqrt(Math.max(s2 / n - m * m, 1e-12) * n / (n - 1)); o[i] = Math.max(-4, Math.min(4, (a[i] - m) / sd)); }
  }
  return o;
}
module.exports = { series, change, pctChange, z, read };
