// S28 A: 신용융자 과열 + 10년 금리 급등 → 기술 이탈 표 +1(이탈만, 복귀 조건은 챔피언 그대로). 최종 전략 v2(champ_v2.run) 위.
// 켜짐: 신용융자 전년비 ≥ mth 이고 10년 금리 126거래일 상승폭 ≥ tth(%p). 1960~85 재확인 가능(Z.1 1945~, DGS10 1962~).
const C = require('./champ_v2.js'), U = require('./S28_common.js');
module.exports = (D, p) => {
  const my = U.marginYoY(D), dt = U.tnxChg(D, 126), mth = p.mth ?? 0.3, tth = p.tth ?? 0.5, on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = my[j] >= mth && dt[j] >= tth ? 1 : 0;
  return Object.assign(C.run(D, { exitVotes: (j, need) => on[j] ? need - 1 : need }), { heat: on });
};
