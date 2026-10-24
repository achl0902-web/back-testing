// 최종 전략 v2 (S26 A, adopted 2026-10-24): the inflation re-entry block, built outside the engine and passed in as D.ib.
//   inflBlock(D)      research/page data: 달러 6개월 상승(Y_DXY) · PPI 전년비(PPIACO, 시차 50일) · 유가 6개월 상승(DCOILWTICO),
//                     each z-scored on its own trailing 756 days (lib/catalog.js), block when 2 or more are above 1.5
//   inflBlockHist(D)  1960~85 check (T14): same rule, oil = WTISPLC and dollar = TWEXMMTH monthly (lag 35 days), dollar NaN before 1973
//   zNow(D, j)        the three z-scores on day j, for the page
const fs = require('fs'), path = require('path'), K = require('./catalog.js');
const Z = 1.5, NEED = 2, KEYS = ['x_dxy', 'i_ppi', 'x_oil'];
const block = zs => { const n = zs[0].length, b = new Uint8Array(n); for (let j = 0; j < n; j++) { let c = 0; for (const s of zs) if (s[j] > Z) c++; b[j] = c >= NEED ? 1 : 0; } return b; };
const inflBlock = D => block(KEYS.map(k => K.zOf(D, k).z));
const zNow = (D, j) => KEYS.map(k => K.zOf(D, k).z[j]);
function monthly(D, file, lag) {
  const day = s => Math.round(Date.parse(s) / 864e5);
  const obs = fs.readFileSync(file, 'utf8').trim().split('\n').slice(1).map(r => r.split(',')).filter(([d, v]) => d && isFinite(parseFloat(v)))
    .map(([d, v]) => [day(d.slice(0, 10)) + lag, parseFloat(v)]).sort((a, b) => a[0] - b[0]);
  const a = new Float64Array(D.n).fill(NaN), last = obs.length ? obs[obs.length - 1][0] : -1e9; let k = -1;
  for (let i = 0; i < D.n; i++) { while (k + 1 < obs.length && obs[k + 1][0] <= D.day[i]) k++; if (k >= 0 && D.day[i] <= last + 90) a[i] = obs[k][1]; }
  return a;
}
function inflBlockHist(D) {
  const R = path.join(__dirname, '..'), ret = K.helpers.ret;
  const ppi = ret(monthly(D, path.join(R, '..', 'data', 'macro', 'PPIACO.csv'), 50), 252);
  const oil = ret(monthly(D, path.join(R, 'data', 'hist', 'WTISPLC.csv'), 35), 126);
  const usd = ret(monthly(D, path.join(R, 'data', 'hist', 'TWEXMMTH.csv'), 35), 126);
  return block([usd, ppi, oil].map(a => K.zscore(Float64Array.from(a, v => isFinite(v) ? v : NaN))));
}
module.exports = { inflBlock, inflBlockHist, zNow, Z, NEED };
