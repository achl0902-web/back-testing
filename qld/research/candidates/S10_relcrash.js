// B2 축② 문턱 = −z × 지난 3년 중앙 rv20 × √(10/252)
const L = require('./S09_lib.js'), R = require('./S10_relcommon.js');
module.exports = (D, p) => { const m = R.roll(D, 'rv20').med;
  return L.run(D, { axes: j => R.axesWith(D, j, { dn: 0.30, up: 0.35, crash: m[j] > 0 ? -p.z * m[j] * Math.sqrt(10 / 252) : -0.08 }) }); };
