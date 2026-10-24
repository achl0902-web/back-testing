// S36 B (이탈만 · 인플레+기간 스프레드 약세장 위험, Chen 2009 JBF · Nyberg 2013 JBF): CPI 전년비 z > 1.5(챔피언 INF와 같은 z 문턱, 고정)이고
// 10년−3개월 금리차(GS10−TB3MS 월평균, 시차 35일) ≤ th(곡선 평탄·역전)이면 기술 이탈에 필요한 표를 1 줄인다(보통 2→1, 보호기간 3→2).
// 매크로 경보 이탈, 복귀 조건, 인플레 복귀 금지(INF)는 챔피언 v2 그대로 → INF(복귀 쪽)를 이탈 쪽에서 보완.
const C = require('./champ_v2.js'), U = require('./S36_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.5, z = U.cpiZ(D), s = U.termSpread(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = z[j] > 1.5 && s[j] <= th + 1e-9 ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => (on[j] ? need - 1 : need) });
  return Object.assign(r, { bearRisk: on });
};
