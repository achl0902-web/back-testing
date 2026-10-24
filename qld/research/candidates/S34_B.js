// S34 B (조합, 풀 요소 2개 값 고정, 아직 안 해 본 짝): X4(S14 C 축④는 10일 변동성 ≥ 0.25일 때만, 이탈·복귀 축 수 모두)
// + HK(S25 B 2년물 252거래일 +1.5%p 인상 국면이면 보호기간 3표→2표, 이탈만). MW·VRS 없이. 새 자유 파라미터 0개.
// 1960~85(histcheck): X4는 가격만, HK는 DGS2(1976-06~)라 1977-06 이전 꺼짐.
const E = require('../../src/engine.js'), C = require('./champ_v2.js'), C7 = require('./S27_common.js'), P0 = E.DEFAULTS;
module.exports = (D, p) => {
  const floor = 0.25, hike = C7.hike(D, 1.5);
  const r = C.run(D, {
    exitVotes: (j, need) => ((hike[j] && need === 3) ? 2 : need),
    axes: j => { const a = E.axesAt(D, P0, j); return a[0] + a[1] + a[2] + (a[3] && D.vols.rv10[j] >= floor ? 1 : 0); },
  });
  return Object.assign(r, { hikeOn: hike });
};
