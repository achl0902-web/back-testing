// S28 C: 복귀 후 보호기간(챔피언 40거래일, 기술 이탈 3표 요구) 중 Put/Call 안일(헤지 수요 낮음) + 지수 ma일선 아래면 2표로 이탈 허용.
// 켜짐: Put/Call 5일 평균의 756일 z ≤ −th 이고 지수 < ma일 이평. 보호기간 밖(필요 2표)은 챔피언 그대로. 이탈만에 작용(복귀 조건은 챔피언 그대로).
// Put/Call은 1995-09~2003-12, 2006-11~2019-10만 있음(그 밖은 꺼짐 = 챔피언과 같음). 실시간 자료원이 없어 채택돼도 알림에 바로 못 씀. 1960~85 재확인 불가.
// (첫 check 뒤 설계 변경: 처음안 "Put/Call 공포 + 이평선 위면 기술 이탈 거부"는 200·100·50일선 모두 챔피언과 다른 날 0~12일로 비어 있었음)
const C = require('./champ_v2.js'), U = require('./S28_common.js'), K = require('../lib/catalog.js');
module.exports = (D, p) => {
  const z = K.zscore(U.pcAvg(D, 5)), th = p.th ?? 1, ma = U.ma(D, p.ma ?? 50), on = new Uint8Array(D.n);
  for (let j = 0; j < D.n; j++) on[j] = z[j] <= -th && D.px[j] < ma[j] ? 1 : 0;
  return Object.assign(C.run(D, { exitVotes: (j, need) => (need >= 3 && on[j] ? need - 1 : need) }), { complacent: on });
};
