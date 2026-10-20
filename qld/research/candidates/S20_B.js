// S20 B: 매크로 그룹 합의. 신용 3개(baa, baa3m, dflt) 중 z>1 2개 이상 AND 실물(claims, sahm, curve, cut) 중 z>1 1개 이상인 상태가 새로 시작되는 날 extraExit. params.useMacro false.
const { load, over } = require('./S20_r8.js');
module.exports = (D) => {
  const { z } = load(D), n = D.n, x = new Uint8Array(n);
  const st = j => ['baa', 'baa3m', 'dflt'].filter(k => over(z[k], j, 1)).length >= 2 && ['claims', 'sahm', 'curve', 'cut'].some(k => over(z[k], j, 1));
  for (let j = 1; j < n; j++) x[j] = st(j) && !st(j - 1) ? 1 : 0;
  return { extraExit: x };
};
