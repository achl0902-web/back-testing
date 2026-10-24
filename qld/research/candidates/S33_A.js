// S33 A (달력·이벤트, 새 자료 FOMC_DATES 1994-02~): Cieslak·Morse·Vissing-Jorgensen(2019 JF) FOMC 주기의 짝수 주
// (지난 성명 발표일부터 5거래일 단위로 센 0·2·4·6주, maxW 이하)에는 기술 이탈에 1표 더 요구 (이탈만). 매크로 경보·복귀·인플레 금지는 챔피언 그대로.
// 발표일부터 센다(비예정 회의를 미리 알 수 없어 원 논문의 '발표 전날'은 쓰지 않음 → 미래 정보 없음). 1994-02 이전은 꺼짐(챔피언과 같음).
const C = require('./champ_v2.js'), U = require('./S33_common.js');
module.exports = (D, p) => {
  const on = U.fomcEven(D, p.maxW ?? 2);
  const r = C.run(D, { exitVotes: (j, need) => (on[j] ? need + 1 : need) });
  return Object.assign(r, { fomcEven: on });
};
