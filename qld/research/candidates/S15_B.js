// S15 B 휩쏘 기억(성과 피드백): 챔피언 자신의 최근 이탈 성과로 보통 이탈 문턱을 조절.
// 휩쏘 = 복귀 신호일 지수 종가 >= 이탈 신호일 지수 종가(이탈이 아무것도 아끼지 못함). 연속 휩쏘가 m회 이상이면
// 보통(2축) 이탈도 3축을 요구(강신호·매크로 경보는 그대로). 이탈이 하락을 피하면(복귀가 이탈보다 낮음) 0으로 초기화.
// 복귀일 j에 이미 아는 값만 쓴다. S09_lib.run 훅(exitVotes·enterOk)으로 구현 → 플라시보 가능.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const m = p.m ?? 2;
  let streak = 0;
  return L.run(D, {
    exitVotes: (j, need) => (streak >= m ? Math.max(need, 3) : need),
    enterOk: (j, st) => { streak = D.px[j] >= D.px[st.outSince] ? streak + 1 : 0; return true; },
  });
};
