// 아이디어2 복귀 저점 상승 확인: 최근 k일 최저 종가 > 그 전 k일 최저 종가가 아니면 복귀 금지
module.exports = (D, p) => {
  const n = D.n, b = new Uint8Array(n), k = p.k, px = D.px;
  for (let j = 2 * k; j < n; j++) {
    let a = Infinity, c = Infinity;
    for (let i = j - k + 1; i <= j; i++) a = Math.min(a, px[i]);
    for (let i = j - 2 * k + 1; i <= j - k; i++) c = Math.min(c, px[i]);
    b[j] = a > c ? 0 : 1;
  }
  return { reentryBlock: b };
};
