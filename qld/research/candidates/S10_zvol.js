// B4 축① = down20 또는 up20의 3년 z점수 > zt
const L = require('./S09_lib.js'), R = require('./S10_relcommon.js');
module.exports = (D, p) => { const a = R.roll(D, 'down20'), b = R.roll(D, 'up20'), v = D.vols;
  const vol = j => (a.sd[j] > 0 && b.sd[j] > 0) ? ((v.down20[j] - a.mu[j]) / a.sd[j] > p.zt || (v.up20[j] - b.mu[j]) / b.sd[j] > p.zt) : (v.down20[j] > 0.30 || v.up20[j] > 0.35);
  return L.run(D, { axes: j => R.axesWith(D, j, { vol, crash: -0.08 }) }); };
