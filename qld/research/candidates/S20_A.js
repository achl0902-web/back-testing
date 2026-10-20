// S20 A: 매크로 경보를 실시간 매크로 8개(R8) 경보비율의 신규 돌파(비율 >= th, 전날 < th)로 대체. params.useMacro false와 함께 사용.
const { load } = require('./S20_r8.js');
module.exports = (D, p) => {
  const { ratio } = load(D), th = p.th, n = D.n, x = new Uint8Array(n);
  const on = j => ratio[j] != null && !isNaN(ratio[j]) && ratio[j] >= th;
  for (let j = 1; j < n; j++) x[j] = on(j) && !on(j - 1) ? 1 : 0;
  return { extraExit: x };
};
