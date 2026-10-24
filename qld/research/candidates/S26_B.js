// S26 B 조합(이탈+적립, 가격 자료만): S14 B 달력(pad=2, exitVotes) + S14 C 축④ 바닥(10일 변동성 ≥ 0.25일 때만 축④, axes: 이탈·복귀 모두)
// + S22 D 이탈 중 지수 200일선 위면 적립금 QLD 매수(contribSig). 값은 과거 최고값 고정. 1960~85 histcheck 재확인 가능.
const E = require('../../src/engine.js'), L = require('./S09_lib.js'), C = require('./S26_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const win = C.monthWin(D, p.pad ?? 2), floor = p.floor ?? 0.25;
  const r = L.run(D, {
    exitVotes: (j, need) => win[j] ? need + 1 : need,
    axes: j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && D.vols.rv10[j] >= floor ? 1 : 0); },
  });
  r.contribSig = C.aboveMA(D, p.maN ?? 200);
  return r;
};
