// S32 B (이탈 시점, 새 출처: CFTC COT TFF 자산운용사): E-mini 나스닥100·S&P500 자산운용사 순포지션/OI(amnet_oi, 시차 4일)의
// 756일 z 평균이 th 이상(실물 자금 롱이 3년 기준으로 이례적으로 쏠림)이면 기술 이탈 표 +1(필요 표 −1: 평시 2→1, 보호기간 3→2). 이탈만.
// 복귀·매크로 경보·인플레 복귀 금지는 챔피언 그대로. 2006-06(+z 준비 약 1년) 이전은 자료 없음 → 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S32_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.5, z = U.amZ(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = z[j] >= th ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] ? need - 1 : need) });
  return Object.assign(r, { amCrowd: on });
};
