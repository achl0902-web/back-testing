// S15 C 회복장 보호기간: 이탈이 큰 하락을 피한 뒤의 복귀(복귀 종가 <= 이탈 종가 x (1-deep))는 바닥 이후 회복장일 가능성이 크다.
// 회복장은 변동성이 높게 남아 기술 축이 쉽게 켜지지만 추세는 위(2020·2009형). 이런 복귀 뒤에는 보호기간(3축 이상만 재이탈)을
// 챔피언의 40일에서 H일로 늘린다. 얕은 이탈 뒤 복귀는 챔피언 그대로. 강신호(3축)·매크로(40일 뒤)는 그대로.
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  const deep = p.deep ?? 0.15, H = p.H ?? 120;
  let protUntil = -1;
  return L.run(D, {
    exitVotes: (j, need) => (j <= protUntil ? Math.max(need, 3) : need),
    enterOk: (j, st) => { if (D.px[j] <= D.px[st.outSince] * (1 - deep)) protUntil = j + H; return true; },
  });
};
