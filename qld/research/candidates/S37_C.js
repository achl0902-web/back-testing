// S37 C (이탈만 · 조합: 풀 X4 + 새 요소 GT(Growth-Trend Timing, Philosophical Economics 2016), 값 고정·새 자유 파라미터 0):
// GT: 실업률(UNRATE, 시차 40일)이 자기 12개월 이동평균 이하(경기 양호)이면 기술 이탈에 3표 필요(보통 2→3, 보호기간 3은 그대로).
// X4: 축④(10일/60일 변동성 확대)는 10일 변동성 ≥ 0.25일 때만 센다(POOL.js와 같음, 이탈·복귀 축 수 모두).
// 매크로 경보 이탈과 INF(복귀 금지)는 챔피언 v2 그대로. 실업률이 12개월 평균 위로 오르면(경기 악화) 챔피언 문턱으로 돌아간다.
const C = require('./champ_v2.js'), U = require('./S37_common.js');
module.exports = (D, p) => {
  const h = U.laborHealthy(D);
  const r = C.run(D, { axes: U.x4Axes(D), exitVotes: (j, need) => h[j] ? Math.max(need, 3) : need });
  return Object.assign(r, { laborHealthy: h });
};
