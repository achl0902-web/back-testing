// S37 A (복귀만 · 젊은 하락의 복귀 완화, 챔피언 손실 사례 2020·2025 겨냥):
// 이탈 중 지수의 252일 최고점이 최근 K거래일 안에 있으면(강세장 직후의 충격·조정: Maheu·McCurdy·Song 2012의 '강세장 조정' 상태는
// 강세 레짐 안의 짧은 국면) 켜진 축 2개까지 복귀 허용. 20일선 위·10일<60일 변동성·인플레 과열 아님(INF)은 그대로 요구.
// 하락이 K거래일보다 오래되면(약세장 반등: 2001·2002·2008 하반기·2022 하반기) 챔피언과 같다. 복귀 후 40거래일 보호기간도 그대로.
// 구현: champ_v2.run의 timeout 훅(N=0, hold 유지) — 그 경로도 INF가 막는다.
const C = require('./champ_v2.js'), U = require('./S37_common.js');
module.exports = (D, p) => {
  const y = U.young(D, p.K ?? 63);
  const r = C.run(D, { timeout: { N: 0, ok: (j, st) => !!y[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
  return Object.assign(r, { youngDecline: y });
};
