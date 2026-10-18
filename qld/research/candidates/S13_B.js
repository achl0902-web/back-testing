// S13 B 축별 분해: 챔피언의 기술 이탈(2축/3축) 중 가격 손상 없는 변동성만의 이탈을 거부. 복귀 판정·매크로 경보는 그대로.
// veto 1: 켜진 축이 ①(변동성)·④(변동성 확대)뿐이면 이탈 안 함
// veto 2: 축①을 하방 변동성(down20>30%)으로만 셈(상방 변동성 up20>35%는 이탈 표에서 제외)
// veto 3: 1과 2 모두
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const v = p.veto;
  return L.run(D, {
    exitVotes: (j, base) => {
      const a = E.axesAt(D, P0, j);
      const a1 = (v === 2 || v === 3) ? D.vols.down20[j] > P0.dnHi : !!a[0];
      const cnt = (a1 ? 1 : 0) + (a[1] ? 1 : 0) + (a[2] ? 1 : 0) + (a[3] ? 1 : 0);
      const price = (a[1] ? 1 : 0) + (a[2] ? 1 : 0);
      if (cnt < base) return 99;
      if ((v === 1 || v === 3) && price === 0) return 99;
      return base;
    },
  });
};
