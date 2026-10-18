// S12 C 복귀 후 손절: 복귀 뒤 40거래일(챔피언 보유 구간) 안에 지수가 복귀일 종가 대비 X 이상 하락하면 즉시 재이탈
const L = require('./S09_lib.js');
module.exports = (D, p) => {
  let inJ = -1e9;
  return L.run(D, {
    enterOk: j => { inJ = j; return true; },
    extraExit: j => j - inJ <= 40 && D.px[j] < D.px[inJ] * (1 - p.X),
  });
};
