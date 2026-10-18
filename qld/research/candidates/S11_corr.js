// ④ 200일선 위 + fast일선 아래(상승장 내 조정)만 감속
module.exports = (D, p) => {
  const n = D.n, s = new Uint8Array(n), f = D.ma[p.fast], m2 = D.ma[200];
  for (let j = 0; j < n; j++) s[j] = (D.px[j] > m2[j] && D.px[j] < f[j]) ? 1 : 0;
  return { slowSig: s };
};
