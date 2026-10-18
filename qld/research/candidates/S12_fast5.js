// S12 D 첫 하락 빠른 표: 지수 5일 수익률 < −X 이면 이탈 표 +1 (복귀 조건에는 영향 없음)
module.exports = (D, p) => {
  const v = new Uint8Array(D.n);
  for (let j = 5; j < D.n; j++) v[j] = D.px[j] / D.px[j - 5] - 1 < -p.X ? 1 : 0;
  return { extraVoteExit: v };
};
