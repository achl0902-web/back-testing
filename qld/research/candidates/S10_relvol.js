// B1 축① 문턱 = k × 지난 3년 중앙값(down20 / up20×35/30)
const L = require('./S09_lib.js'), R = require('./S10_relcommon.js');
module.exports = (D, p) => { const md = R.roll(D, 'down20').med, mu = R.roll(D, 'up20').med;
  return L.run(D, { axes: j => R.axesWith(D, j, { dn: md[j] > 0 ? p.k * md[j] : 0.30, up: mu[j] > 0 ? p.k * 35 / 30 * mu[j] : 0.35, crash: -0.08 }) }); };
