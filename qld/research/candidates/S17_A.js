// S17 A: S16 B(복귀 후 H거래일 이상 보유 시 합성 3배) + 기술 4축 중 1개라도 켜지면 즉시 2배, 축이 cool일 연속 모두 꺼져야 3배 재개.
// 챔피언 보유 상태는 S09_lib.run(D)(훅 없음 = 챔피언), 이탈 규칙은 그대로. 인덱스 j는 j일 종가까지만 사용.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, b = new Uint8Array(n), en = L.run(D).enterSig, H = p.H, cool = p.cool;
  let age = 0, quiet = 0;
  for (let j = 0; j < n; j++) {
    age = en[j] ? age + 1 : 0;
    quiet = (j < 1 || L.axes(D, j) >= 1) ? 0 : quiet + 1;
    b[j] = age >= H && quiet >= cool ? 1 : 0;
  }
  return { boostSig: b };
};
