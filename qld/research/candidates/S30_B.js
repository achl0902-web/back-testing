// S30 B (이탈 문턱, AAII 설문 + 기존 요소 인플레 과열): AAII 강세−약세 스프레드 4주(20거래일) 평균이 th 이하(개인 비관 극단)이고
// 챔피언의 인플레 과열 판정(lib/v2.js inflBlock)이 꺼져 있으면 기술 이탈에 1표 더 요구(평시 2→3, 보호기간 3→4).
// 이탈만에 작용(이탈을 더 엄격하게). 매크로 경보 이탈·복귀는 챔피언 그대로. 1987-09 이전은 자료 없음 → 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S30_common.js');
module.exports = (D, p) => {
  const th = p.th ?? -0.15, a = U.aaii20(D), ib = C.base(D).ib, on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = a[j] <= th && !ib[j] ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] ? need + 1 : need) });
  return Object.assign(r, { aaiiBear: on });
};
