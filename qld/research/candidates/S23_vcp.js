// S23 공통: VCP(변동성 수축 후 돌파, 미너비니) 지수 일봉 구조. 지수 종가 D.px만 사용, 인덱스 j는 j일 종가까지만.
// 수축: 끝이 e인 연속 3블록(각 Lb거래일)의 블록 안 최대 낙폭(고점→저점, 종가)이 d1 > d2 > d3 로 줄어듦.
// 돌파: 어제(j−1)까지의 3블록 기반이 수축했고 오늘 종가가 기반 고점(피벗 = j−3Lb..j−1 최고 종가) 위.
function dd(px, a, b) {
  let pk = px[a], m = 0;
  for (let i = a; i <= b; i++) { if (px[i] > pk) pk = px[i]; const d = 1 - px[i] / pk; if (d > m) m = d; }
  return m;
}
function hi(px, a, b) { let h = -Infinity; for (let i = a; i <= b; i++) if (px[i] > h) h = px[i]; return h; }
function contracting(px, e, Lb) {
  const s = e - 3 * Lb + 1;
  if (s < 0) return false;
  const d1 = dd(px, s, s + Lb - 1), d2 = dd(px, s + Lb, s + 2 * Lb - 1), d3 = dd(px, s + 2 * Lb, e);
  return d1 > d2 && d2 > d3;
}
function contractArr(D, Lb) {
  const o = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) if (contracting(D.px, j, Lb)) o[j] = 1;
  return o;
}
function breakout(D, Lb) {
  const px = D.px, o = new Uint8Array(D.n);
  for (let j = 3 * Lb; j < D.n; j++) if (contracting(px, j - 1, Lb) && px[j] > hi(px, j - 3 * Lb, j - 1)) o[j] = 1;
  return o;
}
module.exports = { dd, hi, contracting, contractArr, breakout };
