// S16 A: 저변동·상승 체제에서 보유 중 합성 3배. 켈리 배수 ≈ mu/sigma^2 → 지수 20일 변동성이 낮고 200일선 위일 때만 3배.
// j일 종가까지만 사용(rv20, ma200). 엔진이 보유 중일 때만 boostSig를 적용.
module.exports = (D, p) => {
  const n = D.n, b = new Uint8Array(n), th = p.volTh;
  for (let j = 0; j < n; j++) b[j] = (D.vols.rv20[j] < th && D.px[j] > D.ma[200][j]) ? 1 : 0;
  return { boostSig: b };
};
