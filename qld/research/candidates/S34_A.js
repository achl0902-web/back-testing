// S34 A (새 정보 출처: 예정된 매크로 발표일 — 고용 보고서 BLS 규칙 근사 1985~ + FOMC 성명 1994-02~):
// 기술 축①(20일 하방·상방 변동성)과 축④(10일/60일 변동성 확대)를 발표일(span=2면 다음 거래일까지) 수익률을 뺀 표본으로 센다.
// 이탈·복귀 축 수 모두(둘 다)에 작용. 축②·③, 매크로 경보, 복귀의 10일<60일 변동성 조건, 인플레 복귀 금지는 챔피언 그대로.
const C = require('./champ_v2.js'), U = require('./S34_common.js');
module.exports = (D, p) => {
  const ax = U.axesEx(D, p.span ?? 1);
  const r = C.run(D, { axes: j => ax.n[j] });
  return Object.assign(r, { annDay: U.annMask(D, p.span ?? 1) });
};
