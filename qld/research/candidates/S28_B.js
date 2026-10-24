// S28 B: 신용융자 디레버리징 + 지수 장기 이평선 아래 → 복귀 금지(복귀만, 이탈은 챔피언 그대로). 최종 전략 v2(champ_v2.run) 위.
// 켜짐: 신용융자 전년비 ≤ dth 이고 지수 < N일 이평. 1960~85 재확인 가능(Z.1 1945~, 지수 이평).
const C = require('./champ_v2.js'), U = require('./S28_common.js');
module.exports = (D, p) => {
  const my = U.marginYoY(D), ma = U.ma(D, p.ma ?? 200), dth = p.dth ?? -0.1, blk = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) blk[j] = my[j] <= dth && D.px[j] < ma[j] ? 1 : 0;
  return Object.assign(C.run(D, { enterOk: j => !blk[j] }), { delever: blk });
};
