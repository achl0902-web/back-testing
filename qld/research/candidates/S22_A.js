// S22 A: 이탈 중 깊은 낙폭 적립. 지수 252일 고점 대비 낙폭 <= -dd 인 날 contribSig=1 (j일 종가까지)
module.exports = (D, p) => {
  const dd = p.dd, s = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) {
    let hi = 0; for (let k = Math.max(0, j - 251); k <= j; k++) if (D.px[k] > hi) hi = D.px[k];
    if (D.px[j] / hi - 1 <= -dd) s[j] = 1;
  }
  return { contribSig: s };
};
