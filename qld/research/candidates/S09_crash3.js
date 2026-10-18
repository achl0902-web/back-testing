// 아이디어4 급락 경로: 나스닥100 3일 수익률 < -X% 면 즉시 이탈
module.exports = (D, p) => {
  const n = D.n, x = new Uint8Array(n), th = -p.X / 100;
  for (let j = 3; j < n; j++) x[j] = D.px[j] / D.px[j - 3] - 1 < th ? 1 : 0;
  return { extraExit: x };
};
