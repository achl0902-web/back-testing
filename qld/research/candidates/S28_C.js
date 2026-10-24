// S28 C: Put/Call 공포(헤지 수요 급증) + 지수 200일선 위(상승 추세 유지) → 기술 이탈 거부(이탈만; 매크로 경보 이탈은 그대로). 최종 전략 v2 위.
// 켜짐: Put/Call 10일 평균의 756일 z ≥ th 이고 지수 > 200일선. Put/Call은 1995-09~2003-12, 2006-11~2019-10만 있음(그 밖은 꺼짐 = 챔피언과 같음).
// 실시간 자료원이 없어 채택돼도 알림에 바로 못 씀. 1960~85 재확인 불가(자료 없음).
const C = require('./champ_v2.js'), U = require('./S28_common.js'), K = require('../lib/catalog.js');
module.exports = (D, p) => {
  const z = K.zscore(U.pc10(D)), th = p.th ?? 1.5, veto = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) veto[j] = z[j] >= th && D.px[j] > D.ma[200][j] ? 1 : 0;
  return Object.assign(C.run(D, { exitVeto: j => !!veto[j] }), { fear: veto });
};
