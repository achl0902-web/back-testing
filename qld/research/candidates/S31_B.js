// S31 B (이탈 시점, 새 출처: CFTC COT Legacy): E-mini 나스닥100·S&P500 비상업(대형 투기자) 순포지션/OI의 756일 z 평균이
// −th 이하(투기자가 3년 기준으로 이례적으로 순매도 쪽)면 기술 이탈 표 +1(필요 표 −1: 평시 2→1, 보호기간 3→2). 이탈만에 작용.
// 근거: Wang 2003(Applied Fin. Econ.) S&P 선물 대형 투기자 심리는 가격 지속(추세) 지표, 극단값일수록 신뢰도 높음.
// 복귀·매크로 경보·인플레 복귀 금지는 챔피언 그대로. 1996-04(+756일 z 준비 약 1년) 이전은 자료 없음 → 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S31_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.0, z = U.cotZ(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = z[j] <= -th ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] ? need - 1 : need) });
  return Object.assign(r, { cotShort: on });
};
