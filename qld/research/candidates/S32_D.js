// S32 D (보호기간 규칙, 새 출처: 소매 MMF WRMFNS): 소매 MMF 잔고 126거래일 증가율의 756일 z ≥ th(개인 자금의 현금 도피 급증)이면
// 복귀 후 보호기간(40거래일) 재이탈 문턱 3표 → 2표. 이탈만(보호기간 안에서만), 평시 이탈·복귀는 챔피언 그대로.
// 시차 10일(주간 월요일 기준, H.6 목요일 공표 + 여유). 1980-02 + 증가율·z 준비 이전은 꺼짐.
const C = require('./champ_v2.js'), U = require('./S32_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.5, z = U.mmfZ(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = z[j] >= th ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] && need === 3 ? 2 : need) });
  return Object.assign(r, { mmfFlight: on });
};
