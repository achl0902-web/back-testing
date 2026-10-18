// ② 126일 연율 로그추세 mu < k*rv20^2 이면 감속 (2배 초과기대 mu-sigma^2 열위)
module.exports = (D, p) => {
  const n = D.n, s = new Uint8Array(n), W = 126, px = D.px;
  for (let j = W; j < n; j++) {
    const mu = Math.log(px[j] / px[j - W]) * 252 / W, v = D.vols.rv20[j];
    s[j] = (v > 0 && mu < p.k * v * v) ? 1 : 0;
  }
  return { slowSig: s };
};
