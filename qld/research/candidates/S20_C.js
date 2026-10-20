// S20 C: 추세 축(③ 주봉 RSI) 대신 신용축(BAA 스프레드 3개월 확대 baa3m z>1). 축 = ① + ② + ④ + 신용. 챔피언 상태기계·매크로 경보 그대로(rule "sig").
const E = require('../../src/engine.js');
const L = require('./S09_lib.js');
const { load, over } = require('./S20_r8.js');
module.exports = (D) => {
  const { z } = load(D);
  return L.run(D, { axes: j => { const a = E.axesAt(D, E.DEFAULTS, j); return (a[0] ? 1 : 0) + (a[1] ? 1 : 0) + (a[3] ? 1 : 0) + (over(z.baa3m, j, 1) ? 1 : 0); } });
};
