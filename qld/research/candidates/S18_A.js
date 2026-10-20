// S18 A: 축 수 비례 노출. 보유 중 j일 종가 기준 켜진 기술 축 0개=QLD 100%, 1개=w1, 2개 이상=w2 (나머지 SGOV).
// 3축 이상 전량 이탈은 엔진 params.votes=3, 매크로 경보 이탈은 엔진 그대로. 인덱스 j는 j일 종가까지만 사용.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const n = D.n, t = new Float64Array(n), w1 = p.w1 ?? 0.75, w2 = p.w2 ?? 0.5;
  for (let j = 0; j < n; j++) {
    const a = j > 0 ? L.axes(D, j) : 0;
    t[j] = a === 0 ? 1 : a === 1 ? w1 : w2; // a>=3 은 votes 3 이탈이 처리(보유 중이면 w2 유지)
  }
  return { qldTarget: t };
};
