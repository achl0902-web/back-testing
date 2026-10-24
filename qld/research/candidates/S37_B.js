// S37 B (레버리지 선택 · 금리 변동성 감속, SCOUT 3회차 추천 5):
// 보유 중 10년 금리 일간 변화의 20일 변동성 756일 z가 th를 넘으면(금리 난류: 주식·채권이 함께 흔들리는 국면) QLD 대신 QQQ(1배) 보유.
// 이탈·복귀·INF는 챔피언 v2(엔진 final + inflBlock) 그대로. 엔진 훅 slowSig(S11)을 쓰는 추가형.
const U = require('./S37_common.js');
module.exports = (D, p) => {
  const th = p.th ?? 1.5, z = U.rateVolZ(D), s = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) s[j] = z[j] > th ? 1 : 0;
  return { slowSig: s };
};
