// S32 C (복귀 금지, AAII 다른 쓰임): AAII 강세−약세 20거래일 평균 ≤ th(개인 비관 지속)이고 지수가 200일선 아래면 복귀 금지. 복귀만.
// 근거: S30 B(비관이면 이탈 거부 −9.99)에서 드러난 "개인 비관은 하락장 내내 지속" → 비관 지속 + 장기 추세 아래는 약세장 진행 중의 표지.
// 이탈·매크로 경보·인플레 복귀 금지·보호기간은 챔피언 그대로. 200일선은 기존 요소(값 고정). 1987-09 이전 자료 없음 → 챔피언과 같음.
const C = require('./champ_v2.js'), U = require('./S32_common.js');
module.exports = (D, p) => {
  const th = p.th ?? -0.1, a = U.aaii20(D), blk = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) blk[j] = a[j] <= th && D.px[j] < D.ma[200][j] ? 1 : 0;
  const r = C.run(D, { enterOk: j => !blk[j] });
  return Object.assign(r, { aaiiBlock: blk });
};
