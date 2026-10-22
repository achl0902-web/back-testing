// S23 B (복귀 필터 / 약점: 2022형 약세장 반등에 복귀했다 다시 이탈): 챔피언 복귀 조건이 켜져도 지수 최근 3블록(각 10거래일)
// 낙폭이 줄어드는 수축 구조가 없으면 복귀 보류. 안전장치: 이번 이탈에서 챔피언 복귀 조건이 처음 켜진 날부터 W거래일이 지나면
// 구조 없이도 복귀. S09_lib.run의 enterOk 훅이라 플라시보 가능.
const L = require('./S09_lib.js'), V = require('./S23_vcp.js');
module.exports = (D, p) => {
  const W = p.W ?? 20, c = V.contractArr(D, 10);
  let last = -2, first = 0;
  return L.run(D, {
    enterOk: (j, st) => {
      if (st.outSince !== last || j < first) { last = st.outSince; first = j; }
      return c[j] === 1 || j - first >= W;
    },
  });
};
