// S30 A (이탈 시점, 사용자 제안: 신용융자 월간 + 기존 요소 200일선): 신용융자(FINRA 월간, 시차 50일)가 12개월 최고 대비
// th 이상 줄었고(디레버리징 국면) 지수가 200일선 아래면 기술 이탈 표 +1(필요 표 −1: 평시 2→1, 보호기간 3→2).
// 이탈만에 작용(extraVoteExit와 같음). 복귀·매크로 경보·인플레 복귀 금지는 챔피언 그대로. 1997-01 이전(+50일)은 자료 없음 → 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S30_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.10, dd = U.marginDD(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = dd[j] <= -th && D.px[j] < D.ma[200][j] ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] ? need - 1 : need) });
  return Object.assign(r, { marginDelev: on });
};
