// S17 D: S16 B 3배 + 매크로 경보 비율(D.ms)이 th 이상이면 즉시 2배(이탈 문턱 50%보다 낮은 부분 경보). 결측(NaN)이면 S16 B와 동일.
// 챔피언 보유 상태는 S09_lib.run(D), 이탈 규칙은 그대로. 인덱스 j는 j일 종가까지만 사용.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, b = new Uint8Array(n), en = L.run(D).enterSig, H = p.H;
  let age = 0;
  for (let j = 0; j < n; j++) { age = en[j] ? age + 1 : 0; b[j] = age >= H && !(D.ms[j] >= p.th) ? 1 : 0; }
  return { boostSig: b };
};
