// S13 A 규칙 분산: 챔피언(기술 4축+매크로)과 독립 추세 규칙(지수 vs N일선, 고정 밴드 2%)의 평균 노출.
// 둘 다 보유 → QLD(2배), 하나만 보유 → QQQ(1배, slowSig), 둘 다 이탈 → 현금(exitSig). j일 종가까지만 사용.
const L = require('./S09_lib.js');

module.exports = (D, p) => {
  const n = D.n, N = p.ma, BAND = p.band, m = D.ma[N];
  if (!m) throw new Error('ma ' + N + ' 없음');
  const champ = L.run(D).enterSig;
  const ex = new Uint8Array(n), en = new Uint8Array(n), sl = new Uint8Array(n);
  let tr = 1; // 추세 규칙 보유 상태(히스테리시스)
  for (let j = 1; j < n; j++) {
    if (m[j] > 0) { if (tr && D.px[j] < m[j] * (1 - BAND)) tr = 0; else if (!tr && D.px[j] > m[j] * (1 + BAND)) tr = 1; }
    const c = champ[j] ? 1 : 0, k = c + tr;
    ex[j] = k === 0 ? 1 : 0; en[j] = k === 0 ? 0 : 1; sl[j] = k === 1 ? 1 : 0;
  }
  return { exitSig: ex, enterSig: en, slowSig: sl };
};
