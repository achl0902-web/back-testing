// S23 C (보유 중 이탈 거부 / 약점: S&P 2배 중앙값 DCA 열위·2025형 휩쏘): 오늘 기술 축 이탈이 나도, 충격 직전(10거래일 전까지)
// 지수가 3블록×20거래일 기반에서 낙폭이 줄어드는 수축 구조였고 오늘 종가가 그 기반 이후 최고 종가(피벗)의 −near 이내이면
// 기술 이탈에 1표 더 요구(이탈 표 −1). 매크로 경보 이탈은 그대로. S09_lib.run의 exitVotes 훅이라 플라시보 가능.
const L = require('./S09_lib.js'), V = require('./S23_vcp.js');
module.exports = (D, p) => {
  const x = p.near ?? 0.05, Lb = 20, lag = 10, px = D.px, t = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) {
    const e = j - lag, s = e - 3 * Lb + 1;
    if (s >= 0 && V.contracting(px, e, Lb) && px[j] >= (1 - x) * V.hi(px, s, j)) t[j] = 1;
  }
  return L.run(D, { exitVotes: (j, need) => (t[j] === 1 ? need + 1 : need) });
};
