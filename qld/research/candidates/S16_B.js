// S16 B: 복귀 후 H거래일 이상 연속 보유했으면 합성 3배. 챔피언 보유 상태는 S09_lib.run(D) 복제(훅 없음 = 챔피언).
// 휩쏘는 복귀 직후(보호기간 40일)에 몰리고, 오래 보유 중이면 이탈 규칙이 고변동을 걸러낸 추세 구간이라는 가정.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, b = new Uint8Array(n), en = L.run(D).enterSig, H = p.H;
  let age = 0;
  for (let j = 0; j < n; j++) { age = en[j] ? age + 1 : 0; b[j] = age >= H ? 1 : 0; }
  return { boostSig: b };
};
