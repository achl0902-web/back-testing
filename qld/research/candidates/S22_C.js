// S22 C: 보유 중 매크로 경보 비율이 th 이상(이탈 문턱 50% 미만의 부분 경보 포함)이면 적립 보류(pauseSig)
module.exports = (D, p) => {
  const s = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) if (D.ms[j] >= p.th) s[j] = 1;
  return { pauseSig: s };
};
