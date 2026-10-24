// S24 A (약점: 첫 이탈이 나스닥100 −8~−17% 뒤에 나옴 / IDEAS "첫 하락 줄이기"를 5일 수익률·장중 레인지 대신 옵션 시장으로):
// VIX가 자기 50거래일 평균의 k배 이상이면 이탈 표 +1 (extraVoteExit, 복귀 판정 불변).
// 내재 변동성은 옵션 시장이 앞으로의 위험을 값으로 매긴 것이라, 종가 기반 실현 변동성(축①·④ 20/10일 창)이 쌓이기 전에 먼저 뛴다.
// 수준(z점수, T01 v_vix)이 아니라 자기 최근 평균 대비 '급등'만 본다. VIXCLS(1990~), 발표 시차 1일 → j일 값은 j−1일 종가까지.
const M = require('../lib/macro.js');
module.exports = (D, p) => {
  const k = p.k ?? 1.5, W = 50, n = D.n, vote = new Uint8Array(n);
  const v = M.series(D, 'VIXCLS', 1);
  for (let j = W; j < n; j++) {
    if (isNaN(v[j])) continue;
    let s = 0, c = 0;
    for (let i = j - W + 1; i <= j; i++) if (!isNaN(v[i])) { s += v[i]; c++; }
    if (c >= 40 && v[j] >= k * s / c) vote[j] = 1;
  }
  return { extraVoteExit: vote };
};
