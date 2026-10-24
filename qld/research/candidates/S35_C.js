// S35 C (복귀만, 신용 변화 출처: Baa−10년 스프레드 BAA10Y 1986~): 이탈 중 신용 스프레드가 63거래일 최고점보다 th%p 이상 내려왔고
// 20거래일 변화가 음(−)이면(신용이 먼저 회복) 켜진 축 2개까지 복귀 허용. 나머지 복귀 조건(20일선 위 · 10일 < 60일 변동성 ·
// 인플레 과열 복귀 금지)과 복귀 후 40거래일 보호기간은 챔피언 그대로(champ_v2 timeout 훅 N=0, 챔피언 복귀가 안 될 때만 추가 경로).
const C = require('./champ_v2.js'), U = require('./S35_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.25, on = U.baaHeal(D, th);
  const r = C.run(D, { timeout: { N: 0, ok: (j, st) => on[j] && st.a <= 2 && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
  return Object.assign(r, { creditHeal: on });
};
