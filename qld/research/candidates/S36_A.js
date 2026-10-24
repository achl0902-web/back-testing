// S36 A (노출 크기 · 추세 국면 4분할, Goulding·Harvey·Mazzoleni 2023 "Momentum Turning Points"):
// 보유 중 j일 종가 기준 '반등 국면'(지수 12개월 수익률 < 0 이고 2개월 수익률 > 0: 느린 신호와 빠른 신호가 엇갈림)이면
// QLD 목표 비중 w(나머지 SGOV, 적립금도 그 비중), 다른 국면이면 100%. 이탈·복귀·인플레 복귀 금지는 챔피언 v2(엔진 final + inflBlock) 그대로.
// 엔진 훅 qldTarget(S18)을 쓰는 추가형(rule 생략 = final). rebound 배열은 발동률 표시용.
const U = require('./S36_common.js');
module.exports = (D, p) => {
  const w = p.w ?? 0.5, st = U.trendState(D), t = new Float64Array(D.n), rb = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) { rb[j] = st[j] === 3 ? 1 : 0; t[j] = rb[j] ? w : 1; }
  return { qldTarget: t, rebound: rb };
};
