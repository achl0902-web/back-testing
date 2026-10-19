// S17 B: S16 B 3배에 진입 조건 강화: 지수 20일 실현변동성 < vmax 일 때만 3배(켈리 L* = mu/sigma^2, mu~8%면 3배 정당화는 sigma ~0.16 이하).
// 챔피언 보유 상태는 S09_lib.run(D), 이탈 규칙은 그대로. 인덱스 j는 j일 종가까지만 사용.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, b = new Uint8Array(n), en = L.run(D).enterSig, H = p.H, rv = D.vols.rv20;
  let age = 0;
  for (let j = 0; j < n; j++) { age = en[j] ? age + 1 : 0; b[j] = age >= H && rv[j] < p.vmax ? 1 : 0; }
  return { boostSig: b };
};
