// S33 D (보호기간 규칙, 새 자료 FF48로 계산한 흡수비율 근사): 산업 동조화 지수(63일)의 표준화 변화
// (15일 평균 − 252일 평균)/252일 표준편차 ≥ th(동조화가 아직 높아지는 중 = 위기 정점 전)이면 복귀 후 보호기간 재이탈 문턱 3표→2표.
// 이탈만(보호기간 안에서만). 복귀를 막거나 늦추지 않음. 정점을 지나 동조화가 내려오면 자동으로 꺼져 챔피언과 같아짐.
const C = require('./champ_v2.js'), U = require('./S33_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.0, z = U.arShift(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = z[j] >= th ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] && need === 3 ? 2 : need) });
  return Object.assign(r, { arRising: on });
};
