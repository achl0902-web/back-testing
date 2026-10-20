// S20 D: 같은 계열은 한 표. 축 = max(① 변동성, ③ 주봉 RSI) + ② + ④ + 신용(baa3m z>1). 이탈 2표·복귀 1표 이하 규칙·매크로 경보 그대로(rule "sig").
const E = require('../../src/engine.js');
const L = require('./S09_lib.js');
const { load, over } = require('./S20_r8.js');
module.exports = (D) => {
  const { z } = load(D);
  return L.run(D, { axes: j => { const a = E.axesAt(D, E.DEFAULTS, j); return ((a[0] || a[2]) ? 1 : 0) + (a[1] ? 1 : 0) + (a[3] ? 1 : 0) + (over(z.baa3m, j, 1) ? 1 : 0); } });
};
