// S22 D: 이탈 중 지수가 N일선 위면(얕은 조정·V자 반등) 적립금으로 QLD 매수(contribSig). 깊은 약세장(N일선 아래)은 SGOV 적립 유지
module.exports = (D, p) => {
  const m = D.ma[p.maN], s = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) if (m[j] > 0 && D.px[j] > m[j]) s[j] = 1;
  return { contribSig: s };
};
