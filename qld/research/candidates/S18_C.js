// S18 C: 매크로 낮을 때 복귀 완화. 챔피언 복제(S09_lib.run) + 매크로 경보 비율 D.ms < msTh 이면 켜진 축 maxA 개 이하에서도 복귀
// (20일선 위·10일 변동성 < 60일 변동성은 그대로). S09_lib 훅이라 플라시보 가능. 인덱스 j는 j일 종가까지만 사용.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const msTh = p.msTh ?? 0.3, maxA = p.maxA ?? 2;
  return L.run(D, { timeout: { N: 0, ok: (j, st) => st.a <= maxA && D.ms[j] < msTh && D.px[j] > D.ma[20][j] && D.vols.rv10[j] < D.v60[j] } });
};
