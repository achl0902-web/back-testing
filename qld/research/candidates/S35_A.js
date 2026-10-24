// S35 A (이탈만, 유동성 출처: 연준 총자산 WALCL 2002-12~): 연준 대차대조표가 126거래일 동안 th 이상 늘고(QE·준비금 확대 국면)
// 지수가 200일선 위(상승 추세 안의 조정)면 기술 이탈에 1표 더 필요(보통 2→3표, 보호기간 3→4표).
// 매크로 경보 이탈·복귀 조건·인플레 복귀 금지·40일 보호기간은 챔피언 v2 그대로. 2003-06 이전(126일 준비 전)은 꺼짐 → 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S35_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 0.10, g = U.walclGrowth(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = g[j] >= th && D.px[j] > D.ma[200][j] ? 1 : 0;
  const r = C.run(D, { exitVotes: (j, need) => need + on[j] });
  return Object.assign(r, { qeUp: on });
};
