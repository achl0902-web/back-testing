// S08 macro helpers (macro analyst). All values at index j use only data published by day j.
const M = require('../lib/macro.js');
const DAY0 = Math.round(Date.parse('1982-01-01') / 86400000);

// Monthly series -> year-over-year % (obs vs obs 12 months earlier), released lagDays after the observation date,
// forward-filled on D's calendar (NaN 90 days after the series ends).
function monthlyYoY(D, name, lagDays) {
  const raw = M.read(name), yo = [];
  for (let k = 12; k < raw.length; k++) {
    const dd = raw[k][0] - raw[k - 12][0];
    if (dd > 355 && dd < 375) yo.push([raw[k][0] + lagDays, (raw[k][1] / raw[k - 12][1] - 1) * 100]);
  }
  const a = new Float64Array(D.n).fill(NaN); let k = -1; const last = yo.length ? yo[yo.length - 1][0] : -1e9;
  for (let i = 0; i < D.n; i++) {
    while (k + 1 < yo.length && yo[k + 1][0] <= D.day[i]) k++;
    if (k >= 0 && D.day[i] <= last + 90) a[i] = yo[k][1];
  }
  return a;
}

// A weekday calendar from 1982 to D's last day, so z-scores have history before the index data starts (1985-10).
function calendar(D) {
  const days = []; for (let d = DAY0; d <= D.day[D.n - 1]; d++) { const w = new Date(d * 86400000).getUTCDay(); if (w && w < 6) days.push(d); }
  return { n: days.length, day: Int32Array.from(days) };
}
// map an array on calendar C to D (same calendar day; D trading days are all weekdays)
function toD(D, C, arr) {
  const m = new Map(); for (let i = 0; i < C.n; i++) m.set(C.day[i], arr[i]);
  const o = new Float64Array(D.n).fill(NaN); for (let i = 0; i < D.n; i++) { const v = m.get(D.day[i]); if (v !== undefined) o[i] = v; }
  return o;
}
const neg = a => a.map(v => -v);
const oilChg = (a, k) => a.map((v, i) => i >= k ? v / Math.max(a[i - k], 10) - 1 : NaN);

// Inflation / tightening basket (directions fixed before testing: higher = more risk). Returns share of z>1 on D.
const cache = new Map();
function basketShare(D) {
  const key = D.name + D.n; if (cache.has(key)) return cache.get(key);
  const C = calendar(D), s = (nm, lag) => M.series(C, nm, lag);
  const dgs2 = s('DGS2', 1), dff = s('DFF', 1), dgs10 = s('DGS10', 1), oil = s('DCOILWTICO', 1), t102 = s('T10Y2Y', 1);
  const ind = [
    M.change(dgs2, 126), M.change(dff, 126), M.change(dgs10, 126),
    monthlyYoY(C, 'CPIAUCSL', 45), monthlyYoY(C, 'CPILFESL', 45), monthlyYoY(C, 'PPIACO', 45),
    oilChg(oil, 126), neg(monthlyYoY(C, 'M2SL', 55)), neg(M.change(t102, 126)),
  ].map(a => M.z(a, 756, 252));
  const sh = new Float64Array(C.n).fill(NaN);
  for (let i = 0; i < C.n; i++) { let n = 0, on = 0; for (const z of ind) if (!isNaN(z[i])) { n++; if (z[i] > 1) on++; } if (n >= 5) sh[i] = on / n; }
  const out = toD(D, C, sh); cache.set(key, out); return out;
}
module.exports = { M, monthlyYoY, basketShare };
