// S15 A 시장 폭 감속: 보유 중 지수가 200일선 위인데(지수만 오르는 좁은 상승) 섹터·규모 8개 중 k개 이상이 자기 200일선 아래면
// QLD 대신 QQQ(1배)로 감속(slowSig). 꺼짐은 k-2개 이하로 줄 때(고정 히스테리시스 2, 잦은 전환 방지).
// 폭 자료(x_breadth)는 j일 종가까지만 사용, 2000년 이전 NaN 구간은 감속 없음.
const C = require('../lib/catalog.js');
module.exports = (D, p) => {
  const k = p.k ?? 4, n = D.n, br = C.zOf(D, 'x_breadth').raw, ma = D.ma[200], slow = new Uint8Array(n);
  let on = false;
  for (let j = 0; j < n; j++) {
    const b = br[j];
    if (isNaN(b) || isNaN(ma[j])) { on = false; continue; }
    const cnt = Math.round(b * 8);
    if (!on && cnt >= k && D.px[j] > ma[j]) on = true;
    else if (on && (cnt <= k - 2 || D.px[j] <= ma[j])) on = false;
    slow[j] = on ? 1 : 0;
  }
  return { slowSig: slow };
};
