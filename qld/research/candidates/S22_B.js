// S22 B: 보유 중 챔피언 기술 4축 중 1개 이상 켜지면 적립 보류(pauseSig). 축이 cool일 연속 0개여야 해제(cool=1이면 0개 첫날 해제)
const { axes } = require('./S09_lib.js');
module.exports = (D, p) => {
  const cool = p.cool, s = new Uint8Array(D.n); let calm = cool;
  for (let j = 0; j < D.n; j++) {
    if (axes(D, j) >= 1) calm = 0; else calm++;
    s[j] = calm < cool ? 1 : 0;
  }
  return { pauseSig: s };
};
