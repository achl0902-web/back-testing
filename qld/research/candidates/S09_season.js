// 아이디어1 계절성: 5월부터 p.M개월간 이탈 표 +1
module.exports = (D, p) => {
  const n = D.n, x = new Uint8Array(n), M = p.M;
  for (let j = 0; j < n; j++) { const k = (D.month[j] - 5 + 12) % 12; x[j] = k < M ? 1 : 0; }
  return { extraVoteExit: x };
};
