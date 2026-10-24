// S31 D (기술 축 추가, 새 출처: 은행 대출 기준 SLOOS DRTSCILM, 1990~ 분기, 시차 45일): C&I 대출 기준을 조인 은행 순비율 ≥ th이고
// 지수가 200일선 아래면 다섯째 축 1개를 켠다(축 수 +1: 이탈은 쉬워지고 복귀는 엄격 = extraVote, 이탈·복귀 둘 다).
// 근거: Chava·Gallmeyer·Park 2015(JME) 대출 기준 강화 뒤 주식 수익률 낮음(표본 밖 유지), Lown & Morgan(NY Fed) 신용 공급 축소 → 실물 둔화.
// 200일선은 기존 요소(값 고정). 1990-04(+45일) 이전은 자료 없음 → 챔피언과 같음.
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), U = require('./S31_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const th = p.th ?? 20, sl = U.sloos(D), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = sl[j] >= th && D.px[j] < D.ma[200][j] ? 1 : 0;
  const r = C.run(D, { axes: j => E.axesAt(D, P0, j).reduce((x, y) => x + (y ? 1 : 0), 0) + on[j] });
  return Object.assign(r, { bankTight: on });
};
