// ① ER40 < th 이고 rv20 >= volTh 이면 감속(QQQ). j일 종가까지만 사용
module.exports = (D, p) => {
  const n = D.n, s = new Uint8Array(n), K = 40, th = p.th, vt = p.volTh ?? 0.20, px = D.px;
  for (let j = K; j < n; j++) {
    let path = 0; for (let i = j - K + 1; i <= j; i++) path += Math.abs(px[i] - px[i - 1]);
    const er = path > 0 ? Math.abs(px[j] - px[j - K]) / path : 1;
    s[j] = (er < th && D.vols.rv20[j] >= vt) ? 1 : 0;
  }
  return { slowSig: s };
};
