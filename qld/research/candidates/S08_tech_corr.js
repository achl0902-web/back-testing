// T1: stock-bond regime. rho = 63d corr(index daily return, daily change of 10y yield), computed on same-day pairs and
// then shifted one day (yield known next day). Vote when rho < th and the 10y yield rose over 63 days.
const U = require('./S08_tech_util.js');
module.exports = (D, p) => {
  const th = p.th ?? 0, W = 63;
  const y = U.M.series(D, 'DGS10', 0); // same-day pairs; whole signal shifted by 1 below
  const r = new Float64Array(D.n).fill(NaN), dy = new Float64Array(D.n).fill(NaN);
  for (let i = 1; i < D.n; i++) { r[i] = D.px[i] / D.px[i - 1] - 1; dy[i] = y[i] - y[i - 1]; }
  const raw = new Uint8Array(D.n);
  for (let j = W + 63; j < D.n; j++) {
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let k = j - W + 1; k <= j; k++) { if (isNaN(dy[k])) continue; n++; sx += r[k]; sy += dy[k]; sxx += r[k] * r[k]; syy += dy[k] * dy[k]; sxy += r[k] * dy[k]; }
    if (n < 40) continue;
    const c = (sxy - sx * sy / n) / Math.sqrt(Math.max((sxx - sx * sx / n) * (syy - sy * sy / n), 1e-18));
    const rise = y[j] - y[j - 63] > 0;
    raw[j] = c < th && rise ? 1 : 0;
  }
  const extraVote = new Uint8Array(D.n); for (let j = 1; j < D.n; j++) extraVote[j] = raw[j - 1];
  return { extraVote, extraName: '주식-채권 상관' };
};
