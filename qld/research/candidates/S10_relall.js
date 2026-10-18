// B3 축①② 절대 문턱 전부 × (지난 3년 중앙 rv20 / volRef)
const L = require('./S09_lib.js'), R = require('./S10_relcommon.js');
module.exports = (D, p) => { const m = R.roll(D, 'rv20').med;
  return L.run(D, { axes: j => { const s = m[j] > 0 ? m[j] / p.volRef : 1; return R.axesWith(D, j, { dn: 0.30 * s, up: 0.35 * s, crash: -0.08 * s }); } }); };
